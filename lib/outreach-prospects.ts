// Outreach prospect types and seed data.
// Replace `SEED_PROSPECTS` with Apify/Apollo imports via /api/outreach/prospects in the future.

export type OutreachArea =
    | 'all'
    | 'north_minneapolis'
    | 'south_minneapolis'
    | 'downtown'
    | 'northeast'
    | 'st_paul'
    | 'suburbs';

export type OutreachSource = 'seed' | 'apify' | 'apollo';

export interface OutreachProspect {
    id: string;
    name: string;
    email: string;
    businessName: string;
    area: Exclude<OutreachArea, 'all'>;
    phone?: string;
    instagram?: string;
    source: OutreachSource;
}

export const OUTREACH_AREA_LABELS: Record<Exclude<OutreachArea, 'all'>, string> = {
    north_minneapolis: 'North Minneapolis',
    south_minneapolis: 'South Minneapolis',
    downtown: 'Downtown MPLS',
    northeast: 'Northeast MPLS',
    st_paul: 'St. Paul',
    suburbs: 'Suburbs',
};

/** Seed prospects for development — swap with Apify/Apollo pipeline data later. */
export const SEED_PROSPECTS: OutreachProspect[] = [
    {
        id: 'seed-001',
        name: 'Marcus Johnson',
        email: 'marcus.j@example-barber.com',
        businessName: 'Fade Factory MPLS',
        area: 'north_minneapolis',
        phone: '612-555-0101',
        instagram: '@fadefactorympls',
        source: 'seed',
    },
    {
        id: 'seed-002',
        name: 'Diego Ramirez',
        email: 'diego@sharpcuts.co',
        businessName: 'Sharp Cuts Barbershop',
        area: 'south_minneapolis',
        phone: '612-555-0102',
        instagram: '@sharpcutsmpls',
        source: 'seed',
    },
    {
        id: 'seed-003',
        name: 'Tyler Brooks',
        email: 'tyler@downtownfade.com',
        businessName: 'Downtown Fade Lounge',
        area: 'downtown',
        phone: '612-555-0103',
        instagram: '@downtownfade',
        source: 'seed',
    },
    {
        id: 'seed-004',
        name: 'Jamal Williams',
        email: 'jamal@nebarber.com',
        businessName: 'NE Barber Co.',
        area: 'northeast',
        phone: '612-555-0104',
        instagram: '@nebarberco',
        source: 'seed',
    },
    {
        id: 'seed-005',
        name: 'Chris Nguyen',
        email: 'chris@capitalcuts.com',
        businessName: 'Capital Cuts',
        area: 'st_paul',
        phone: '651-555-0105',
        instagram: '@capitalcuts',
        source: 'seed',
    },
    {
        id: 'seed-006',
        name: 'Andre Mitchell',
        email: 'andre@suburbansharp.com',
        businessName: 'Suburban Sharp',
        area: 'suburbs',
        phone: '952-555-0106',
        instagram: '@suburbansharp',
        source: 'seed',
    },
    {
        id: 'seed-007',
        name: 'Kevin Ortiz',
        email: 'kevin@uptownblends.com',
        businessName: 'Uptown Blends',
        area: 'south_minneapolis',
        phone: '612-555-0107',
        instagram: '@uptownblends',
        source: 'seed',
    },
    {
        id: 'seed-008',
        name: 'Darius Cole',
        email: 'darius@northsidecuts.com',
        businessName: 'Northside Cuts',
        area: 'north_minneapolis',
        phone: '612-555-0108',
        instagram: '@northsidecuts',
        source: 'seed',
    },
];

export function getProspectsByIds(ids: string[]): OutreachProspect[] {
    const idSet = new Set(ids);
    return SEED_PROSPECTS.filter(p => idSet.has(p.id));
}

export function getAllProspects(): OutreachProspect[] {
    return SEED_PROSPECTS;
}
