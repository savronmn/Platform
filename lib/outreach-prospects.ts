// Outreach prospect types and seed data.
// Replace `SEED_PROSPECTS` with Apify/Apollo imports via /api/outreach/prospects in the future.

import type { EmailSource } from '@/lib/outreach-lead-classifier';

export type { EmailSource };

export type OutreachArea =
    | 'all'
    | 'north_minneapolis'
    | 'south_minneapolis'
    | 'downtown'
    | 'northeast'
    | 'st_paul'
    | 'suburbs';

export type OutreachSource = 'seed' | 'apify' | 'apollo' | 'savron';
export type ProspectType = 'individual' | 'shop';

export interface OutreachProspect {
    id: string;
    name: string;
    email: string;
    businessName: string;
    area: Exclude<OutreachArea, 'all'>;
    phone?: string;
    instagram?: string;
    website?: string;
    googleMapsUrl?: string;
    yearsExperience?: number | null;
    priceMinCents?: number | null;
    priceMaxCents?: number | null;
    rating?: number | null;
    reviewCount?: number | null;
    reputationScore?: number | null;
    prospectType?: ProspectType;
    isSavronBarber?: boolean;
    barberId?: string | null;
    emailSource?: EmailSource;
    enrichmentData?: Record<string, unknown> | null;
    enrichedAt?: string | null;
    source: OutreachSource;
}

export interface OutreachScanParams {
    minYearsExperience?: number;
    minPriceDollars?: number;
    maxPriceDollars?: number;
    minRating?: number;
    area?: OutreachArea;
    includeSavronBarbers?: boolean;
    enrichWebsites?: boolean;
    individualsOnly?: boolean;
    purgeShops?: boolean;
}

export const OUTREACH_AREA_LABELS: Record<Exclude<OutreachArea, 'all'>, string> = {
    north_minneapolis: 'North Minneapolis',
    south_minneapolis: 'South Minneapolis',
    downtown: 'Downtown MPLS',
    northeast: 'Northeast MPLS',
    st_paul: 'St. Paul',
    suburbs: 'Suburbs',
};

/** Seed prospects — individual barbers only (no barbershop businesses). */
export const SEED_PROSPECTS: OutreachProspect[] = [
    {
        id: 'seed-001',
        name: 'Marcus Johnson',
        email: '',
        businessName: 'Marcus Johnson',
        area: 'north_minneapolis',
        phone: '612-555-0101',
        instagram: '@marcusjohnsoncuts',
        source: 'seed',
        prospectType: 'individual',
    },
    {
        id: 'seed-002',
        name: 'Diego Ramirez',
        email: '',
        businessName: 'Diego Ramirez',
        area: 'south_minneapolis',
        phone: '612-555-0102',
        instagram: '@diegoramirezbarber',
        source: 'seed',
        prospectType: 'individual',
    },
    {
        id: 'seed-003',
        name: 'Tyler Brooks',
        email: '',
        businessName: 'Tyler Brooks',
        area: 'downtown',
        phone: '612-555-0103',
        instagram: '@tylerbrooksbarber',
        source: 'seed',
        prospectType: 'individual',
    },
    {
        id: 'seed-004',
        name: 'Jamal Williams',
        email: '',
        businessName: 'Jamal Williams',
        area: 'northeast',
        phone: '612-555-0104',
        instagram: '@jamalwilliamsbarber',
        source: 'seed',
        prospectType: 'individual',
    },
];

export function getAllProspects(): OutreachProspect[] {
    return SEED_PROSPECTS;
}

/** @deprecated Use async getProspectsByIds from lib/outreach-store in API routes. */
export function getProspectsByIds(ids: string[]): OutreachProspect[] {
    const idSet = new Set(ids);
    return SEED_PROSPECTS.filter(p => idSet.has(p.id));
}
