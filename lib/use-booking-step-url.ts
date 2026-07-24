'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { gtagEvent } from '@/lib/gtag';
import {
    asapFlowSlugToStep,
    asapFlowStepToSlug,
    barberFlowSlugToStep,
    barberFlowStepToSlug,
    bookingStepPath,
    buildBookingStepQuery,
    parseBookingStepSlug,
    type BookingFlowKind,
    type BookingStepSlug,
} from '@/lib/booking-step-urls';

type UseBookingStepUrlOptions = {
    flow: BookingFlowKind;
    step: number;
    setStep: (step: number) => void;
    skipServiceStep?: boolean;
    /** Barber slug when flow is "barber" — included in analytics events. */
    barberSlug?: string;
    /** Extra context written to the URL on each step (service name/id, date, time). */
    serviceParam?: string | null;
    selectedDate?: string | null;
    selectedTime?: string | null;
    bookingId?: string | null;
    /** When true, read ?step= from URL once on mount and sync wizard state. */
    hydrateFromUrl?: boolean;
};

function stepToSlug(
    flow: BookingFlowKind,
    step: number,
    skipServiceStep: boolean,
): BookingStepSlug {
    return flow === 'asap'
        ? asapFlowStepToSlug(step, skipServiceStep)
        : barberFlowStepToSlug(step);
}

function slugToStep(
    flow: BookingFlowKind,
    slug: BookingStepSlug | null,
    skipServiceStep: boolean,
): number {
    return flow === 'asap'
        ? asapFlowSlugToStep(slug, skipServiceStep)
        : barberFlowSlugToStep(slug);
}

/**
 * Keeps the booking wizard step in sync with ?step= (and related params) so GA
 * pageviews and ad conversion pixels can track each funnel step by URL.
 */
export function useBookingStepUrl({
    flow,
    step,
    setStep,
    skipServiceStep = false,
    barberSlug,
    serviceParam,
    selectedDate,
    selectedTime,
    bookingId,
    hydrateFromUrl = true,
}: UseBookingStepUrlOptions) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const hydrated = useRef(false);
    const lastTrackedSlug = useRef<string | null>(null);

    const pushStepUrl = useCallback((
        nextStep: number,
        overrides?: { bookingId?: string | null },
    ) => {
        const slug = stepToSlug(flow, nextStep, skipServiceStep);
        const query = buildBookingStepQuery(searchParams, {
            step: slug,
            service: serviceParam ?? undefined,
            date: selectedDate ?? undefined,
            time: selectedTime ?? undefined,
            bookingId: overrides?.bookingId ?? (nextStep === 4 ? bookingId ?? undefined : undefined),
        });
        const url = bookingStepPath(pathname, query);
        router.replace(url, { scroll: false });
    }, [
        flow,
        skipServiceStep,
        searchParams,
        serviceParam,
        selectedDate,
        selectedTime,
        bookingId,
        pathname,
        router,
    ]);

    const goToStep = useCallback((
        nextStep: number,
        overrides?: { bookingId?: string | null },
    ) => {
        setStep(nextStep);
        pushStepUrl(nextStep, overrides);
    }, [setStep, pushStepUrl]);

    // Hydrate wizard step from URL on first mount.
    useEffect(() => {
        if (!hydrateFromUrl || hydrated.current) return;
        hydrated.current = true;

        const urlSlug = parseBookingStepSlug(searchParams.get('step'));
        if (!urlSlug) {
            pushStepUrl(step);
            return;
        }

        if (urlSlug === 'confirmed' && !searchParams.get('bookingId')) {
            const fallbackStep = flow === 'asap' ? 1 : 1;
            setStep(fallbackStep);
            pushStepUrl(fallbackStep);
            return;
        }

        const urlStep = slugToStep(flow, urlSlug, skipServiceStep);
        if (urlStep !== step) {
            setStep(urlStep);
        }
    }, [hydrateFromUrl, flow, skipServiceStep, searchParams, step, setStep, pushStepUrl]);

    // Fire GA step-view + conversion events when the URL step changes.
    useEffect(() => {
        const slug = stepToSlug(flow, step, skipServiceStep);
        const trackKey = `${flow}:${slug}:${bookingId ?? ''}`;
        if (lastTrackedSlug.current === trackKey) return;
        lastTrackedSlug.current = trackKey;

        gtagEvent('booking_step_view', {
            step: slug,
            flow,
            ...(barberSlug ? { barber_slug: barberSlug } : {}),
        });

        if (slug === 'confirmed' && bookingId) {
            gtagEvent('booking_complete', {
                booking_id: bookingId,
                flow,
                ...(barberSlug ? { barber_slug: barberSlug } : {}),
            });
        }
    }, [flow, step, skipServiceStep, barberSlug, bookingId]);

    return { goToStep, pushStepUrl };
}
