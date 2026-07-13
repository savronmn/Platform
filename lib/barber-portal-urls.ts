export function barberPortalLoginUrl(slug: string, origin = ''): string {
    return `${origin}/barber/${slug}/login`;
}

export function barberPortalCalendarUrl(slug: string, origin = ''): string {
    return `${origin}/barber/${slug}/calendar`;
}

export function barberBookingPageUrl(slug: string, origin = ''): string {
    return `${origin}/book/${slug}`;
}

export function adminBarberPortalPreviewUrl(barberId: string, origin = ''): string {
    return `${origin}/admin/barbers/${barberId}/portal`;
}
