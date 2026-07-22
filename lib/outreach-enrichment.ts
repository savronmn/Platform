import { runApifyActorSync } from '@/lib/apify-client';
import { enrichInstagramProfiles } from '@/lib/outreach-instagram';
import {
    buildContactPageUrls,
    classifyProspectType,
    extractEmailsFromText,
    extractInstagramHandle,
    isValidReachableEmail,
    normalizeWebsiteUrl,
    pickBestEmailWithSource,
    type EmailSource,
} from '@/lib/outreach-lead-classifier';
import type { OutreachArea, OutreachProspect, OutreachScanParams } from '@/lib/outreach-prospects';

const MAPS_ACTOR = process.env.APIFY_BARBER_ACTOR_ID || 'compass~crawler-google-places';
const WEBSITE_ACTOR = process.env.APIFY_WEBSITE_ACTOR_ID || 'apify~website-content-crawler';
const REVIEWS_ACTOR = process.env.APIFY_REVIEWS_ACTOR_ID || 'compass~google-maps-reviews-scraper';

const WEBSITE_ENRICH_LIMIT = Number(process.env.APIFY_WEBSITE_ENRICH_LIMIT || 100);
const REVIEWS_ENRICH_LIMIT = Number(process.env.APIFY_REVIEWS_ENRICH_LIMIT || 50);
const INSTAGRAM_ENRICH_LIMIT = Number(process.env.APIFY_INSTAGRAM_ENRICH_LIMIT || 100);
const WEBSITE_BATCH_SIZE = 25;

/** Search for independent barbers — not barbershop businesses. */
const AREA_SEARCH: Record<Exclude<OutreachArea, 'all'>, string[]> = {
    north_minneapolis: [
        'independent barber north minneapolis mn',
        'mobile barber north minneapolis mn',
        'barber stylist north minneapolis',
    ],
    south_minneapolis: [
        'independent barber south minneapolis mn',
        'barber uptown minneapolis mn',
        'freelance barber minneapolis mn',
    ],
    downtown: [
        'independent barber downtown minneapolis mn',
        'barber downtown minneapolis',
    ],
    northeast: [
        'independent barber northeast minneapolis mn',
        'barber stylist northeast minneapolis',
    ],
    st_paul: [
        'independent barber st paul mn',
        'mobile barber saint paul mn',
    ],
    suburbs: [
        'independent barber bloomington mn',
        'mobile barber eden prairie mn',
        'barber stylist maple grove mn',
    ],
};

const ALL_SEARCH = Object.values(AREA_SEARCH).flat();

interface ApifyContactDetails {
    emails?: string[];
    phones?: string[];
    instagrams?: string[];
}

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
    emailsFromWebsite?: string[];
    url?: string;
    instagram?: string;
    instagrams?: string[];
    facebooks?: string[];
    contactDetails?: ApifyContactDetails;
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

function slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'prospect';
}

function parseYearsExperience(text: string): number | null {
    const patterns = [
        /(\d{1,2})\+?\s*years?\s*(?:of\s*)?(?:experience|exp|barbering|cutting)/i,
        /(?:experience|exp|barbering)[:\s]+(\d{1,2})\+?\s*years?/i,
        /(\d{1,2})\+?\s*yrs?\s*(?:in\s*(?:the\s*)?(?:industry|business|barbering))?/i,
        /since\s+(19|20)\d{2}/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            if (match[0].toLowerCase().startsWith('since')) {
                const year = parseInt(match[0].replace(/\D/g, ''), 10);
                if (year >= 1970 && year <= new Date().getFullYear()) {
                    return Math.max(0, new Date().getFullYear() - year);
                }
            }
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

function resolveDisplayName(rawTitle: string, categoryName?: string): { name: string; businessName: string; prospectType: OutreachProspect['prospectType'] } {
    const title = rawTitle.trim();
    const prospectType = classifyProspectType(title, categoryName);
    const primary = title.split(/\s*[-–|@]\s*/)[0]?.trim() || title;

    if (prospectType === 'individual') {
        return {
            name: primary.replace(/^@/, ''),
            businessName: primary.replace(/^@/, ''),
            prospectType: 'individual',
        };
    }

    return {
        name: title,
        businessName: title,
        prospectType: 'shop',
    };
}

function collectEmailsFromPlaceRow(row: ApifyPlaceRow): string[] {
    return [
        row.email,
        ...(row.emails ?? []),
        ...(row.emailsFromWebsite ?? []),
        ...(row.contactDetails?.emails ?? []),
    ].filter(Boolean) as string[];
}

function resolveInstagramFromRow(row: ApifyPlaceRow): string | undefined {
    const candidates = [
        row.instagram,
        ...(row.instagrams ?? []),
        ...(row.contactDetails?.instagrams ?? []),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
        const handle = extractInstagramHandle(candidate);
        if (handle) return handle.startsWith('@') ? handle : `@${handle}`;
    }
    return undefined;
}

export function mapApifyPlaceToProspect(row: ApifyPlaceRow, index: number): OutreachProspect | null {
    const rawTitle = (row.title || row.name || '').trim();
    if (!rawTitle) return null;

    const { name, businessName, prospectType } = resolveDisplayName(rawTitle, row.categoryName);
    const address = [row.address, row.street, row.city, row.state].filter(Boolean).join(', ');
    const externalId = row.placeId || row.url || `${slugify(rawTitle)}-${index}`;
    const levelPrices = priceLevelToCents(row.price);
    const mapEmails = collectEmailsFromPlaceRow(row);
    const emailPick = pickBestEmailWithSource(
        name,
        mapEmails.map(email => ({ email, source: 'maps' as EmailSource })),
    );

    return {
        id: `apify-${externalId}`,
        name,
        email: emailPick.email,
        emailSource: emailPick.source,
        businessName,
        area: inferArea(address, row.city),
        phone: row.phone || row.phoneUnformatted,
        instagram: resolveInstagramFromRow(row),
        website: row.website,
        googleMapsUrl: row.url,
        rating: row.totalScore ?? null,
        reviewCount: row.reviewsCount ?? null,
        priceMinCents: levelPrices.min,
        priceMaxCents: levelPrices.max,
        reputationScore: computeReputationScore(row.totalScore ?? null, row.reviewsCount ?? null),
        prospectType,
        source: 'apify',
        isSavronBarber: false,
        enrichmentData: {
            mapsEmails: mapEmails,
            instagramCandidates: row.instagrams ?? row.contactDetails?.instagrams ?? [],
        },
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
        scrapeContacts: true,
        scrapeSocialMediaProfiles: {
            instagrams: true,
            facebooks: false,
            youtubes: false,
            tiktoks: false,
            twitters: false,
        },
    }, { timeoutSec: 300 });
}

async function crawlWebsiteBatch(urls: string[]): Promise<Map<string, string>> {
    if (urls.length === 0) return new Map();

    const rows = await runApifyActorSync<WebsiteCrawlRow>(WEBSITE_ACTOR, {
        startUrls: urls.map(url => ({ url })),
        maxCrawlPages: Math.min(urls.length, 50),
        maxCrawlDepth: 1,
        maxRequestsPerCrawl: urls.length,
    }, { timeoutSec: 180 });

    const textByUrl = new Map<string, string>();
    for (const row of rows) {
        if (!row.url) continue;
        const text = row.text || row.markdown || '';
        const key = normalizeWebsiteUrl(row.url);
        const existing = textByUrl.get(key) ?? '';
        textByUrl.set(key, `${existing}\n${text}`.trim());
    }
    return textByUrl;
}

async function enrichWebsites(prospects: OutreachProspect[], limit = WEBSITE_ENRICH_LIMIT): Promise<Map<string, string>> {
    const withWebsites = prospects.filter(p => p.website?.startsWith('http')).slice(0, limit);
    if (withWebsites.length === 0) return new Map();

    const allUrls = Array.from(new Set(
        withWebsites.flatMap(p => buildContactPageUrls(p.website!)),
    ));

    const merged = new Map<string, string>();

    for (let i = 0; i < allUrls.length; i += WEBSITE_BATCH_SIZE) {
        const batch = allUrls.slice(i, i + WEBSITE_BATCH_SIZE);
        try {
            const batchResult = await crawlWebsiteBatch(batch);
            for (const [key, text] of Array.from(batchResult.entries())) {
                const existing = merged.get(key) ?? '';
                merged.set(key, `${existing}\n${text}`.trim());
            }
        } catch (err) {
            console.warn('[outreach-enrichment] website crawl batch skipped:', err);
        }
    }

    // Map back to prospect website keys
    const byProspectKey = new Map<string, string>();
    for (const prospect of withWebsites) {
        const keys = buildContactPageUrls(prospect.website!).map(normalizeWebsiteUrl);
        const combined = keys.map(k => merged.get(k) ?? '').filter(Boolean).join('\n');
        if (combined) {
            byProspectKey.set(normalizeWebsiteUrl(prospect.website!), combined);
        }
    }

    return byProspectKey;
}

async function fetchExtraReviews(placeIds: string[]): Promise<Map<string, ReviewRow[]>> {
    const ids = placeIds.filter(Boolean).slice(0, REVIEWS_ENRICH_LIMIT);
    if (ids.length === 0) return new Map();

    try {
        const rows = await runApifyActorSync<ReviewRow>(REVIEWS_ACTOR, {
            placeIds: ids,
            maxReviews: 8,
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

function applyTextEnrichment(
    prospect: OutreachProspect,
    text: string,
    source: EmailSource,
): OutreachProspect {
    const years = parseYearsExperience(text);
    const prices = parsePriceRangeCents(text);
    const emails = extractEmailsFromText(text);
    const instagramFromText = text.match(/instagram\.com\/([a-zA-Z0-9._]+)/i)?.[1];
    const emailPick = pickBestEmailWithSource(prospect.name, [
        { email: prospect.email, source: prospect.emailSource },
        ...emails.map(email => ({ email, source })),
    ]);

    return {
        ...prospect,
        email: emailPick.email,
        emailSource: emailPick.source ?? prospect.emailSource,
        instagram: prospect.instagram ?? (instagramFromText ? `@${instagramFromText}` : undefined),
        yearsExperience: years ?? prospect.yearsExperience ?? null,
        priceMinCents: prices.min ?? prospect.priceMinCents ?? null,
        priceMaxCents: prices.max ?? prospect.priceMaxCents ?? null,
        enrichedAt: new Date().toISOString(),
        enrichmentData: {
            ...prospect.enrichmentData,
            [`${source}TextLength`]: text.length,
            [`${source}EmailsFound`]: emails,
        },
    };
}

async function enrichFromInstagram(prospects: OutreachProspect[]): Promise<OutreachProspect[]> {
    const handles = prospects
        .map(p => extractInstagramHandle(p.instagram))
        .filter(Boolean) as string[];

    const profiles = await enrichInstagramProfiles(handles, INSTAGRAM_ENRICH_LIMIT);
    if (profiles.size === 0) return prospects;

    return prospects.map(p => {
        const handle = extractInstagramHandle(p.instagram);
        if (!handle) return p;

        const profile = profiles.get(handle.toLowerCase());
        if (!profile) return p;

        const displayName = profile.fullName?.trim();
        const isPerson = displayName ? classifyProspectType(displayName) === 'individual' : p.prospectType === 'individual';
        const emailPick = pickBestEmailWithSource(isPerson && displayName ? displayName : p.name, [
            { email: p.email, source: p.emailSource },
            { email: profile.email, source: 'instagram' },
        ]);

        return {
            ...p,
            name: isPerson && displayName ? displayName : p.name,
            businessName: isPerson && displayName ? displayName : p.businessName,
            email: emailPick.email,
            emailSource: emailPick.source ?? p.emailSource,
            phone: p.phone ?? profile.phone,
            prospectType: isPerson ? 'individual' : (p.prospectType ?? 'shop'),
            enrichedAt: new Date().toISOString(),
            enrichmentData: {
                ...p.enrichmentData,
                instagramFollowers: profile.followersCount,
                instagramBio: profile.biography?.slice(0, 500),
            },
        };
    });
}

function matchesFilters(prospect: OutreachProspect, params: OutreachScanParams): boolean {
    if (params.individualsOnly !== false && prospect.prospectType === 'shop' && !prospect.isSavronBarber) {
        return false;
    }

    if (params.minRating != null && (prospect.rating ?? 0) < params.minRating) return false;

    if (params.minYearsExperience != null) {
        if (prospect.yearsExperience == null) return false;
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
    withEmail: number;
    shopsSkipped: number;
    prospects: OutreachProspect[];
}> {
    const places = await discoverPlaces(params);
    const seen = new Set<string>();
    let prospects: OutreachProspect[] = [];
    let shopsSkipped = 0;

    places.forEach((row, index) => {
        const prospect = mapApifyPlaceToProspect(row, index);
        if (!prospect) return;

        if (params.individualsOnly !== false && prospect.prospectType === 'shop') {
            shopsSkipped++;
            return;
        }

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
            const text = websiteText.get(normalizeWebsiteUrl(p.website));
            return text ? applyTextEnrichment(p, text, 'website') : p;
        });

        const reviewsByPlace = await fetchExtraReviews(placeIds);
        prospects = prospects.map(p => {
            const placeId = p.id.replace(/^apify-/, '');
            const reviews = reviewsByPlace.get(placeId);
            if (!reviews?.length) return p;
            const reviewText = reviews.map(r => r.text ?? '').join(' ');
            return applyTextEnrichment(p, reviewText, 'reviews');
        });
    }

    prospects = await enrichFromInstagram(prospects);

    prospects = prospects.map(p => ({
        ...p,
        email: isValidReachableEmail(p.email) ? p.email.toLowerCase() : '',
        enrichedAt: p.enrichedAt ?? new Date().toISOString(),
    }));

    const matched = prospects.filter(p => matchesFilters(p, params));
    const withEmail = prospects.filter(p => isValidReachableEmail(p.email)).length;

    return {
        discovered: prospects.length,
        enriched: prospects.filter(p => p.enrichedAt).length,
        matched: matched.length,
        withEmail,
        shopsSkipped,
        prospects,
    };
}
