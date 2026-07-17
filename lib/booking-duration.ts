import { createClient } from '@supabase/supabase-js';
import { SERVICES } from '@/lib/services-data';

export type ServiceDurationEntry = { name: string; durationMin: number };

let catalogCache: { entries: ServiceDurationEntry[]; expiresAt: number } | null = null;

export async function getServiceDurationCatalog(): Promise<ServiceDurationEntry[]> {
    if (catalogCache && Date.now() < catalogCache.expiresAt) {
        return catalogCache.entries;
    }

    const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data } = await admin
        .from('services')
        .select('name, duration_minutes')
        .eq('active', true);

    const entries: ServiceDurationEntry[] = data?.length
        ? data.map(row => ({ name: row.name, durationMin: row.duration_minutes }))
        : SERVICES.map(s => ({ name: s.name, durationMin: s.durationMin }));

    catalogCache = { entries, expiresAt: Date.now() + 60_000 };
    return entries;
}

/** Parse duration strings — sums compound values like "45 min, 45 min" or "75 min". */
export function parseDurationMins(duration: string | null | undefined, defaultMins = 45): number {
    if (!duration?.trim()) return defaultMins;

    const normalized = duration.trim();

    const minParts = Array.from(normalized.matchAll(/(\d+)\s*(?:min(?:ute)?s?)\b/gi));
    if (minParts.length > 0) {
        return minParts.reduce((sum, part) => sum + parseInt(part[1], 10), 0);
    }

    const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?(?:\s*(\d+)\s*m(?:in(?:ute)?s?)?)?/i);
    if (hourMatch) {
        const hours = parseFloat(hourMatch[1]);
        const extra = hourMatch[2] ? parseInt(hourMatch[2], 10) : 0;
        return Math.round(hours * 60) + extra;
    }

    const single = normalized.match(/(\d+)/);
    return single ? parseInt(single[1], 10) : defaultMins;
}

export function resolveDurationFromServices(
    serviceField: string | null | undefined,
    catalog: ServiceDurationEntry[],
    defaultMins = 45,
): number {
    if (!serviceField?.trim()) return defaultMins;

    const names = serviceField.split(',').map(s => s.trim()).filter(Boolean);
    let total = 0;
    let matched = 0;

    for (const name of names) {
        if (name.toLowerCase() === 'eyebrows') continue;
        const entry = catalog.find(e => e.name.toLowerCase() === name.toLowerCase());
        if (entry) {
            total += entry.durationMin;
            matched++;
        }
    }

    return matched > 0 ? total : defaultMins;
}

/** Use stored duration and service names — whichever blocks more time wins. */
export function resolveBookingDurationMins(
    booking: { duration?: string | null; service?: string | null },
    catalog: ServiceDurationEntry[],
    defaultMins = 45,
): number {
    const fromStored = booking.duration?.trim()
        ? parseDurationMins(booking.duration, 0)
        : 0;
    const fromServices = booking.service
        ? resolveDurationFromServices(booking.service, catalog, 0)
        : 0;

    const resolved = Math.max(fromStored, fromServices);
    return resolved > 0 ? resolved : defaultMins;
}
