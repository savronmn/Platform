import type { StatKey } from '@/components/crm/StatDetailModal';

export const STAT_SLUGS: Record<StatKey, string> = {
    todayAppointments: 'today-appointments',
    todayRevenue: 'today-revenue',
    pipeline: 'pipeline',
    recentCancellations: 'recent-cancellations',
    totalRevenue: 'total-revenue',
    totalAppointments: 'total-appointments',
    avgTicket: 'avg-ticket',
    topService: 'top-service',
    totalClients: 'total-clients',
    dueForVisit: 'due-for-visit',
    barbersActive: 'barbers-active',
    pendingApplicants: 'pending-applicants',
};

export const SLUG_TO_STAT_KEY = Object.fromEntries(
    Object.entries(STAT_SLUGS).map(([key, slug]) => [slug, key as StatKey]),
) as Record<string, StatKey>;

export const ALL_STAT_SLUGS = Object.values(STAT_SLUGS);

export function statPageHref(statKey: StatKey): string {
    return `/admin/stats/${STAT_SLUGS[statKey]}`;
}

export function statKeyFromSlug(slug: string): StatKey | null {
    return SLUG_TO_STAT_KEY[slug] ?? null;
}
