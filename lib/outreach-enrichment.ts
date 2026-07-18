import { runApifyActorSync } from '@/lib/apify-client';
import type { OutreachArea, OutreachProspect, OutreachScanParams } from '@/lib/outreach-prospects';

const MAPS_ACTOR = process.env.APIFY_BARBER_ACTOR_ID || 'compass~crawler-google-places';
const WEBSITE_ACTOR = process.env.APIFY_WEBSITE_ACTOR_ID || 'apify~website-content-crawler';
const REVIEWS_ACTOR = process.env.APIFY_REVIEWS_ACTOR_ID || 'compass~google-maps-reviews-scraper';

const AREA_SEARCH: Record<Exclude<OutreachArea, 'all'>, string[]> = {
    north_minneapolis: ['barbershop north minneapolis mn', 'barber north minneapolis mn'],
    south_minneapolis: ['barbershop south minneapolis mn', 'barbershop uptown minneapolis mn'],
    downtown: ['barbershop downtown minneapolis mn'],
    northeast: ['barbershop northeast minneapolis mn'],
    st_paul: ['barbershop st paul mn', 'barbershop saint paul mn'],
    suburbs: ['barbershop bloomington mn', 'barbershop eden prairie mn', 'barbershop maple grove mn'],
};

const ALL_SEARCH = Object.values(AREA_SEARCH).flat();

interface ApifyPlaceRow {
    placeId?: string;
    title?: string;
    name?: string;
    address?: string;
    street?: string;
    city?: string;
    state?: string;
    phone?: string;
    phoneUnformatted?: string;
    website?: string;
    email?: string;
    emails?: string[];
    url?: string;
    instagram?: string;
    facebooks?: string[];
    totalScore?: number;
    reviewsCount?: number;
    price?: string;
    categoryName?: string;
    neighborhood?: string;
}

interface WebsiteCrawlRow {
    url?: string;
    text?: string;
    markdown?: string;
}

interface ReviewRow {
    placeId?: string;
    stars?: number;
    text?: string;
    publishedAtDate?: string;
}

function inferArea(address: string, city?: string): Exclude<OutreachArea, 'all'> {
    const haystack = `${address} ${city ?? ''}`.toLowerCase();
    if (haystack.includes('saint paul') || haystack.includes('st paul') || haystack.includes('st. paul')) return 'st_paul';
    if (haystack.includes('north minneapolis') || haystack.includes('northside')) return 'north_minneapolis';
    if (haystack.includes('south minneapolis') || haystack.includes('uptown') || haystack.includes('lyn lake')) return 'south_minneapolis';
    if (haystack.includes('northeast') || haystack.includes('ne minneapolis')) return 'northeast';
    if (haystack.includes('downtown')) return 'downtown';
    if (haystack.includes('minneapolis')) return 'south_minneapolis';
    return 'suburbs';
}

function pickEmail(row: ApifyPlaceRow): string {
    if (row.email?.includes('@')) return row.email.trim().toLowerCase();
    const fromList = row.emails?.find(e => e.includes('@'));
    return fromList?.trim().toLowerCase() ?? '';
}

function slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'prospect';
}

function parseYearsExperience(text: string): number | null {
    const patterns = [
        /(\d{1,2})\+?\s*years?\s*(?:of\s*)?(?:experience|exp)/i,
        /(?:experience|exp)[:\s]+(\d{1,2})\+?\s*years?/i,
        /(\d{1,2})\+?\s*yrs?\s*(?:in\s*(?:the\s*)?(?:industry|business))?/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            const years = parseInt(match[1], 10);
            if (years >= 0 && years <= 50) return years;
        }
    }
    return null;
}

function parsePriceRangeCents(text: string): { min: number | null; max: number | null } {
    const prices: number[] = [];
    const regex = /\$\s*(\d{1,3}(?:\.\d{2})?)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
        const dollars = parseFloat(match[1]);
        if (dollars >= 5 && dollars <= 500) prices.push(Math.round(dollars * 100));
    }
    if (prices.length === 0) return { min: null, max: null };
    return { min: Math.min(...prices), max: Math.max(...prices) };
}

function priceLevelToCents(level?: string): { min: number | null; max: number | null } {
    if (!level) return { min: null, max: null };
    const count = (level.match(/\$/g) ?? []).length;
    switch (count) {
        case 1: return { min: 1500, max: 3500 };
        case 2: return { min: 3500, max: 6000 };
        case 3: return { min: 6000, max: 9000 };
        case 4: return { min: 9000, max: 15000 };
        default: return { min: null, max: null };
    }
}

function computeReputationScore(rating: number | null, reviewCount: number | null): number | null {
    if (rating == null) return null;
    const reviews = reviewCount ?? 0;
    const volumeBoost = Math.min(reviews / 100, 1) * 0.5;
    return Math.round((rating + volumeBoost) * 100) / 100;
}

function buildSearchQueries(area?: OutreachArea): string[] {
    if (!area || area === 'all') return ALL_SEARCH;
    return AREA_SEARCH[area] ?? ALL_SEARCH;
}

export function mapApifyPlaceToProspect(row: ApifyPlaceRow, index: number): OutreachProspect | null {
    const businessName = (row.title || row.name || '').trim();
    if (!businessName) return null;

    const address = [row.address, row.street, row.city, row.state].filter(Boolean).join(', ');
    const externalId = row.placeId || row.url || `${slugify(businessName)}-${index}`;
    const levelPrices = priceLevelToCents(row.price);

    return {
        id: `apify-${externalId}`,
        name: businessName,
        email: pickEmail(row),
        businessName,
        area: inferArea(address, row.city),
        phone: row.phone || row.phoneUnformatted,
        instagram: row.instagram,
        website: row.website,
        googleMapsUrl: row.url,
        rating: row.totalScore ?? null,
        reviewCount: row.reviewsCount ?? null,
        priceMinCents: levelPrices.min,
        priceMaxCents: levelPrices.max,
        reputationScore: computeReputationScore(row.totalScore ?? null, row.reviewsCount ?? null),
        source: 'apify',
        isSavronBarber: false,
    };
}

async function discoverPlaces(params: OutreachScanParams): Promise<ApifyPlaceRow[]> {
    const maxPerSearch = Number(process.env.APIFY_MAX_PLACES_PER_SEARCH || 20);
    const searchStrings = buildSearchQueries(params.area);

    return runApifyActorSync<ApifyPlaceRow>(MAPS_ACTOR, {
        searchStringsArray: searchStrings,
        maxCrawledPlacesPerSearch: maxPerSearch,
        language: 'en',
        skipClosedPlaces: true,
        scrapePlaceDetailPage: true,
        scrapeReviewsPersonalData: false,
    }, { timeoutSec: 300 });
}

async function enrichWebsites(prospects: OutreachProspect[], limit = 15): Promise<Map<string, string>> {
    const urls = prospects
        .filter(p => p.website?.startsWith('http'))
        .slice(0, limit)
        .map(p => p.website!);

    if (urls.length === 0) return new Map();

    try {
        const rows = await runApifyActorSync<WebsiteCrawlRow>(WEBSITE_ACTOR, {
            startUrls: urls.map(url => ({ url })),
            maxCrawlPages: 1,
            maxCrawlDepth: 0,
        }, { timeoutSec: 180 });

        const textByUrl = new Map<string, string>();
        for (const row of rows) {
            if (!row.url) continue;
            const text = row.text || row.markdown || '';
            textByUrl.set(row.url.replace(/\/$/, ''), text);
        }
        return textByUrl;
    } catch (err) {
        console.warn('[outreach-enrichment] website crawl skipped:', err);
        return new Map();
    }
}

async function fetchExtraReviews(placeIds: string[]): Promise<Map<string, ReviewRow[]>> {
    const ids = placeIds.filter(Boolean).slice(0, 10);
    if (ids.length === 0) return new Map();

    try {
        const rows = await runApifyActorSync<ReviewRow>(REVIEWS_ACTOR, {
            placeIds: ids,
            maxReviews: 5,
            reviewsSort: 'newest',
        }, { timeoutSec: 120 });

        const byPlace = new Map<string, ReviewRow[]>();
        for (const row of rows) {
            if (!row.placeId) continue;
            const list = byPlace.get(row.placeId) ?? [];
            list.push(row);
            byPlace.set(row.placeId, list);
        }
        return byPlace;
    } catch (err) {
        console.warn('[outreach-enrichment] reviews scrape skipped:', err);
        return new Map();
    }
}

function applyTextEnrichment(prospect: OutreachProspect, text: string): OutreachProspect {
    const years = parseYearsExperience(text);
    const prices = parsePriceRangeCents(text);

    return {
        ...prospect,
        yearsExperience: years ?? prospect.yearsExperience ?? null,
        priceMinCents: prices.min ?? prospect.priceMinCents ?? null,
        priceMaxCents: prices.max ?? prospect.priceMaxCents ?? null,
        enrichedAt: new Date().toISOString(),
    };
}

function matchesFilters(prospect: OutreachProspect, params: OutreachScanParams): boolean {
    if (params.minRating != null && (prospect.rating ?? 0) < params.minRating) return false;

    if (params.minYearsExperience != null && prospect.yearsExperience != null) {
        if (prospect.yearsExperience < params.minYearsExperience) return false;
    }

    const minCents = params.minPriceDollars != null ? params.minPriceDollars * 100 : null;
    const maxCents = params.maxPriceDollars != null ? params.maxPriceDollars * 100 : null;

    if (minCents != null && prospect.priceMaxCents != null && prospect.priceMaxCents < minCents) return false;
    if (maxCents != null && prospect.priceMinCents != null && prospect.priceMinCents > maxCents) return false;

    if (params.area && params.area !== 'all' && prospect.area !== params.area) return false;

    return true;
}

export async function runBarberOutreachScan(params: OutreachScanParams = {}): Promise<{
    discovered: number;
    enriched: number;
    matched: number;
    prospects: OutreachProspect[];
}> {
    const places = await discoverPlaces(params);
    const seen = new Set<string>();
    let prospects: OutreachProspect[] = [];

    places.forEach((row, index) => {
        const prospect = mapApifyPlaceToProspect(row, index);
        if (!prospect) return;
        const key = prospect.googleMapsUrl || prospect.id;
        if (seen.has(key)) return;
        seen.add(key);
        prospects.push(prospect);
    });

    const placeIds = prospects
        .map(p => p.id.replace(/^apify-/, ''))
        .filter(id => id.length > 10);

    if (params.enrichWebsites !== false) {
        const websiteText = await enrichWebsites(prospects);
        prospects = prospects.map(p => {
            if (!p.website) return p;
            const normalized = p.website.replace(/\/$/, '');
            const text = websiteText.get(normalized);
            return text ? applyTextEnrichment(p, text) : p;
        });

        const reviewsByPlace = await fetchExtraReviews(placeIds);
        prospects = prospects.map(p => {
            const placeId = p.id.replace(/^apify-/, '');
            const reviews = reviewsByPlace.get(placeId);
            if (!reviews?.length) return p;

            const reviewText = reviews.map(r => r.text ?? '').join(' ');
            const withExp = applyTextEnrichment(p, reviewText);
            return withExp;
        });
    }

    prospects = prospects.map(p => ({
        ...p,
        enrichedAt: p.enrichedAt ?? new Date().toISOString(),
    }));

    const matched = prospects.filter(p => matchesFilters(p, params));

    return {
        discovered: prospects.length,
        enriched: prospects.filter(p => p.enrichedAt).length,
        matched: matched.length,
        prospects: matched,
    };
}
