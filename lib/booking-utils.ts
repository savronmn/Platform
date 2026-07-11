import type { Barber } from '@/lib/types';
import type { ServiceItem } from '@/lib/services-data';

/** Match a service from a URL query param (id or name). */
export function resolveServiceFromParam(
    param: string | null | undefined,
    services: ServiceItem[],
): ServiceItem | null {
    if (!param || services.length === 0) return null;

    const decoded = decodeURIComponent(param).trim();
    const byId = services.find((s) => String(s.id) === decoded);
    if (byId) return byId;

    const lower = decoded.toLowerCase();
    return services.find((s) => s.name.toLowerCase() === lower) ?? null;
}

/** True when the barber offers this service (empty list = offers all). */
export function barberOffersService(barber: Barber, serviceName: string): boolean {
    if (!barber.services_offered?.length) return true;
    return barber.services_offered.includes(serviceName);
}

/** True when the barber offers at least one of the given services. */
export function barberOffersAnyService(barber: Barber, serviceNames: string[]): boolean {
    if (serviceNames.length === 0) return true;
    if (!barber.services_offered?.length) return true;
    return serviceNames.some((name) => barber.services_offered!.includes(name));
}

export function serviceNamesForIds(services: ServiceItem[], ids: number[]): string[] {
    return ids
        .map((id) => services.find((s) => s.id === id)?.name)
        .filter((name): name is string => Boolean(name));
}

export function buildBookingUrl(serviceName?: string): string {
    if (!serviceName) return '/booking';
    return `/booking?service=${encodeURIComponent(serviceName)}`;
}
