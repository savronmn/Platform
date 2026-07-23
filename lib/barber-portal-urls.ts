export function barberPortalLoginUrl(slug: string, origin = ''): string {
    return `${origin}/barber/${slug}/login`;
}

export function barberPortalCalendarUrl(slug: string, origin = ''): string {
    return `${origin}/barber/${slug}/calendar`;
}

export function barberPortalProfileUrl(slug: string, origin = ''): string {
    return `${origin}/barber/${slug}/profile`;
}

export function barberPortalRequestsUrl(slug: string, origin = ''): string {
    return `${origin}/barber/${slug}/requests`;
}

export function barberPortalShareUrl(slug: string, origin = ''): string {
    return `${origin}/barber/${slug}/share`;
}

export function barberBookingPageUrl(slug: string, origin = ''): string {
    return `${origin}/book/${slug}`;
}

export function adminBarberPortalUrl(barberId: string, slug: string, origin = ''): string {
    return `${origin}/barber/${slug}/calendar?adminManage=1`;
}

/** @deprecated Use adminBarberPortalUrl */
export function adminBarberPortalPreviewUrl(barberId: string, origin = ''): string {
    return `${origin}/admin/barbers/${barberId}/portal`;
}
