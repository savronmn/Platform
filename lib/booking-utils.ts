import type { Barber } from '@/lib/types';
import type { ServiceItem } from '@/lib/services-data';

export const DEFAULT_BOOKING_BARBER_SLUG = 'albe';

/** Primary barber for main /booking ASAP flow (Albe). */
export function findDefaultBookingBarber(barbers: Barber[]): Barber | null {
    const bySlug = barbers.find((barber) => barber.slug === DEFAULT_BOOKING_BARBER_SLUG);
    if (bySlug) return bySlug;
    return barbers.find((barber) => barber.name.toLowerCase().startsWith('albe')) ?? null;
}

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

export function buildBookingUrl(serviceNameOrId?: string | number): string {
    const params = new URLSearchParams({ step: 'barber' });
    if (serviceNameOrId !== undefined && serviceNameOrId !== '') {
        params.set('service', String(serviceNameOrId));
    }
    return `/booking?${params.toString()}`;
}

/** Link to a barber's public booking page, optionally with a pre-selected service or pre-filled member details. */
export function buildBarberPageUrl(
    slug: string,
    options?: { serviceName?: string; name?: string; email?: string; step?: string },
): string {
    const base = `/book/${encodeURIComponent(slug)}`;
    const params = new URLSearchParams({ step: options?.step ?? 'service' });
    if (options?.serviceName) params.set('service', options.serviceName);
    if (options?.name) params.set('name', options.name);
    if (options?.email) params.set('email', options.email);
    return `${base}?${params.toString()}`;
}

/** Build the service label stored on bookings, with optional eyebrows add-on. */
export function formatBookingServices(
    serviceNames: string[],
    includeEyebrows: boolean,
): string {
    const names = [...serviceNames];
    if (includeEyebrows) names.push('Eyebrows');
    return names.join(', ');
}

export function bookingTotals(
    priceCents: number,
    durationMin: number,
    includeEyebrows: boolean,
): { priceCents: number; durationMin: number; price: string; duration: string } {
    const totalCents = priceCents + (includeEyebrows ? 1000 : 0);
    return {
        priceCents: totalCents,
        durationMin,
        price: `$${totalCents / 100}`,
        duration: `${durationMin} min`,
    };
}
