/** Semantic booking funnel steps — used in URL ?step= for ad/analytics tracking. */
export type BookingStepSlug = 'barber' | 'service' | 'datetime' | 'details' | 'confirmed';

export const BOOKING_STEP_SLUGS: BookingStepSlug[] = [
    'barber',
    'service',
    'datetime',
    'details',
    'confirmed',
];

export type BookingFlowKind = 'barber' | 'asap';

/** Map numeric wizard step → URL slug for /book/[slug] flow. */
export function barberFlowStepToSlug(step: number): BookingStepSlug {
    switch (step) {
        case 1: return 'service';
        case 2: return 'datetime';
        case 3: return 'details';
        case 4: return 'confirmed';
        default: return 'service';
    }
}

/** Map URL slug → numeric wizard step for /book/[slug] flow. */
export function barberFlowSlugToStep(slug: BookingStepSlug | null): number {
    switch (slug) {
        case 'service': return 1;
        case 'datetime': return 2;
        case 'details': return 3;
        case 'confirmed': return 4;
        default: return 1;
    }
}

/** Map numeric wizard step → URL slug for ASAP (/epass) flow. */
export function asapFlowStepToSlug(step: number, skipServiceStep: boolean): BookingStepSlug {
    if (step === 4) return 'confirmed';
    if (skipServiceStep) {
        if (step === 1) return 'datetime';
        if (step === 2) return 'details';
    } else {
        if (step === 1) return 'datetime';
        if (step === 2) return 'service';
        if (step === 3) return 'details';
    }
    return 'datetime';
}

/** Map URL slug → numeric wizard step for ASAP flow. */
export function asapFlowSlugToStep(slug: BookingStepSlug | null, skipServiceStep: boolean): number {
    if (slug === 'confirmed') return 4;
    if (skipServiceStep) {
        switch (slug) {
            case 'datetime': return 1;
            case 'details': return 2;
            default: return 1;
        }
    }
    switch (slug) {
        case 'datetime': return 1;
        case 'service': return 2;
        case 'details': return 3;
        default: return 1;
    }
}

export function parseBookingStepSlug(raw: string | null): BookingStepSlug | null {
    if (!raw) return null;
    const decoded = decodeURIComponent(raw).trim().toLowerCase();
    return BOOKING_STEP_SLUGS.includes(decoded as BookingStepSlug)
        ? (decoded as BookingStepSlug)
        : null;
}

export type BookingStepUrlParams = {
    step?: BookingStepSlug;
    service?: string;
    name?: string;
    email?: string;
    date?: string;
    time?: string;
    bookingId?: string;
};

/** Merge booking funnel params into a query string (preserves unrelated params). */
export function buildBookingStepQuery(
    existing: { toString(): string },
    updates: BookingStepUrlParams,
): string {
    const params = new URLSearchParams(existing.toString());

    if (updates.step !== undefined) params.set('step', updates.step);
    if (updates.service !== undefined) {
        if (updates.service) params.set('service', updates.service);
        else params.delete('service');
    }
    if (updates.name !== undefined) {
        if (updates.name) params.set('name', updates.name);
        else params.delete('name');
    }
    if (updates.email !== undefined) {
        if (updates.email) params.set('email', updates.email);
        else params.delete('email');
    }
    if (updates.date !== undefined) {
        if (updates.date) params.set('date', updates.date);
        else params.delete('date');
    }
    if (updates.time !== undefined) {
        if (updates.time) params.set('time', updates.time);
        else params.delete('time');
    }
    if (updates.bookingId !== undefined) {
        if (updates.bookingId) params.set('bookingId', updates.bookingId);
        else params.delete('bookingId');
    }

    return params.toString();
}

export function bookingStepPath(pathname: string, query: string): string {
    return query ? `${pathname}?${query}` : pathname;
}
