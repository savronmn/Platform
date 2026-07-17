import type { OutreachArea, OutreachProspect } from '@/lib/outreach-prospects';

const DEFAULT_ACTOR_ID = 'compass~crawler-google-places';

const SEARCH_QUERIES = [
    'barbershop north minneapolis mn',
    'barbershop south minneapolis mn',
    'barbershop downtown minneapolis mn',
    'barbershop northeast minneapolis mn',
    'barbershop st paul mn',
    'barbershop minneapolis suburbs mn',
];

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
    categoryName?: string;
    url?: string;
    instagram?: string;
    neighborhood?: string;
}

function inferArea(address: string, city?: string): Exclude<OutreachArea, 'all'> {
    const haystack = `${address} ${city ?? ''}`.toLowerCase();

    if (haystack.includes('saint paul') || haystack.includes('st paul') || haystack.includes('st. paul')) {
        return 'st_paul';
    }
    if (haystack.includes('north minneapolis') || haystack.includes('northside')) {
        return 'north_minneapolis';
    }
    if (haystack.includes('south minneapolis') || haystack.includes('uptown') || haystack.includes('lyn lake')) {
        return 'south_minneapolis';
    }
    if (haystack.includes('northeast') || haystack.includes('ne minneapolis')) {
        return 'northeast';
    }
    if (haystack.includes('downtown')) {
        return 'downtown';
    }
    if (haystack.includes('minneapolis')) {
        return 'south_minneapolis';
    }
    if (haystack.includes('bloomington') || haystack.includes('eden prairie') || haystack.includes('maple grove') || haystack.includes('suburb')) {
        return 'suburbs';
    }

    return 'suburbs';
}

function pickEmail(row: ApifyPlaceRow): string {
    if (row.email?.includes('@')) return row.email.trim().toLowerCase();
    const fromList = row.emails?.find(e => e.includes('@'));
    if (fromList) return fromList.trim().toLowerCase();
    return '';
}

function slugify(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'prospect';
}

export function mapApifyRowToProspect(row: ApifyPlaceRow, index: number): OutreachProspect | null {
    const businessName = (row.title || row.name || '').trim();
    if (!businessName) return null;

    const address = [row.address, row.street, row.city, row.state].filter(Boolean).join(', ');
    const email = pickEmail(row);
    const externalId = row.placeId || row.url || `${slugify(businessName)}-${index}`;

    return {
        id: `apify-${externalId}`,
        name: businessName,
        email,
        businessName,
        area: inferArea(address, row.city),
        phone: row.phone || row.phoneUnformatted,
        instagram: row.instagram,
        source: 'apify',
    };
}

export async function fetchBarberProspectsFromApify(): Promise<OutreachProspect[]> {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
        throw new Error('Apify is not configured. Set APIFY_API_TOKEN in environment variables.');
    }

    const actorId = process.env.APIFY_BARBER_ACTOR_ID || DEFAULT_ACTOR_ID;
    const maxPerSearch = Number(process.env.APIFY_MAX_PLACES_PER_SEARCH || 25);

    const response = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=300`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchStringsArray: SEARCH_QUERIES,
                maxCrawledPlacesPerSearch: maxPerSearch,
                language: 'en',
                skipClosedPlaces: true,
            }),
        },
    );

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Apify import failed (${response.status}): ${detail.slice(0, 200)}`);
    }

    const rows = await response.json() as ApifyPlaceRow[];
    if (!Array.isArray(rows)) {
        throw new Error('Apify returned an unexpected response format');
    }

    const seen = new Set<string>();
    const prospects: OutreachProspect[] = [];

    rows.forEach((row, index) => {
        const prospect = mapApifyRowToProspect(row, index);
        if (!prospect) return;

        const dedupeKey = prospect.email || prospect.id;
        if (seen.has(dedupeKey)) return;
        seen.add(dedupeKey);
        prospects.push(prospect);
    });

    return prospects;
}
