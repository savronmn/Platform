import { createClient } from '@supabase/supabase-js';
import {
    getEventBusySlots,
    listAccountCalendarIds,
    toIsoString,
    type CalendarToken,
} from '@/lib/google-calendar';
import { resolveBarberAccessToken } from '@/lib/barber-calendar-sync';
import { chicagoDayBoundsIso, toChicagoIsoString } from '@/lib/chicago-time';
import { timeToMins } from '@/lib/calendar-timeline';
import {
    getServiceDurationCatalog,
    parseDurationMins,
    resolveBookingDurationMins,
    type ServiceDurationEntry,
} from '@/lib/booking-duration';
import { slotConflictsWithBusy } from '@/lib/time-helpers';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Statuses that block new bookings on the same barber/day. */
export const BLOCKING_BOOKING_STATUSES = ['confirmed', 'completed', 'no_show'] as const;

export class GoogleCalendarUnavailableError extends Error {
    constructor(message = 'Google Calendar availability could not be loaded.') {
        super(message);
        this.name = 'GoogleCalendarUnavailableError';
    }
}

function minsToTimeStr(totalMins: number): string {
    const h24 = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const meridiem = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${meridiem}`;
}

export function bookingToBusySlot(
    date: string,
    time: string,
    booking: { duration?: string | null; service?: string | null },
    catalog: ServiceDurationEntry[],
): { start: string; end: string } {
    const durationMin = resolveBookingDurationMins(booking, catalog);
    const endMins = timeToMins(time) + durationMin;
    return {
        start: toIsoString(date, time),
        end: toIsoString(date, minsToTimeStr(endMins)),
    };
}

export async function getBarberDatabaseBusySlots(
    barberId: string,
    date: string,
    options: { excludeBookingId?: string } = {},
): Promise<{ busy: { start: string; end: string }[] }> {
    const supabaseAdmin = getAdmin();
    const catalog = await getServiceDurationCatalog();

    let query = supabaseAdmin
        .from('bookings')
        .select('id, time, duration, service, status, google_event_id, shop_google_event_id')
        .eq('barber_id', barberId)
        .eq('date', date)
        .in('status', [...BLOCKING_BOOKING_STATUSES]);

    if (options.excludeBookingId) {
        query = query.neq('id', options.excludeBookingId);
    }

    const { data: dbBookings } = await query;

    const busy = (dbBookings ?? []).map(booking =>
        bookingToBusySlot(date, booking.time, booking, catalog),
    );

    return { busy };
}

export async function getBarberGoogleBusySlots(
    accessToken: string,
    date: string,
    options: { extraCalendarIds?: string[] } = {},
): Promise<{ start: string; end: string }[]> {
    const { timeMin, timeMax } = chicagoDayBoundsIso(date);

    const calendarIds = new Set<string>(['primary']);
    for (const id of options.extraCalendarIds ?? []) {
        if (id) calendarIds.add(id);
    }

    try {
        const listed = await listAccountCalendarIds(accessToken);
        for (const id of listed) calendarIds.add(id);
    } catch (err) {
        console.warn('[booking-availability] calendarList failed; using primary only:', err);
    }

    const ids = Array.from(calendarIds);
    const primarySlots = await getEventBusySlots(accessToken, 'primary', timeMin, timeMax);

    const otherResults = await Promise.allSettled(
        ids
            .filter(id => id !== 'primary')
            .map(calendarId => getEventBusySlots(accessToken, calendarId, timeMin, timeMax)),
    );

    const seen = new Set<string>();
    const merged: { start: string; end: string }[] = [];

    const addSlots = (slots: { id?: string; start: string; end: string }[]) => {
        for (const slot of slots) {
            const key = slot.id ?? `${slot.start}|${slot.end}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push({ start: slot.start, end: slot.end });
        }
    };

    addSlots(primarySlots);
    for (const result of otherResults) {
        if (result.status === 'fulfilled') {
            addSlots(result.value);
        }
    }

    return merged;
}

export type BarberAvailabilityResult = {
    busy: { start: string; end: string }[];
    workingHours: Record<string, { open: string; close: string } | null> | null;
    googleCalendarConnected: boolean;
    googleBusyCount: number;
};

export async function getBarberAvailability(
    barberId: string,
    date: string,
    options: { excludeBookingId?: string } = {},
): Promise<BarberAvailabilityResult> {
    const supabaseAdmin = getAdmin();

    const [{ data: barber }, dbAvailability] = await Promise.all([
        supabaseAdmin
            .from('barbers')
            .select('id, google_calendar_id, google_calendar_tokens, working_hours')
            .eq('id', barberId)
            .single(),
        getBarberDatabaseBusySlots(barberId, date, options),
    ]);

    if (!barber) {
        throw new Error('Barber not found');
    }

    const workingHours = (barber.working_hours ?? null) as Record<string, { open: string; close: string } | null> | null;
    let busy = [...dbAvailability.busy];
    let googleBusyCount = 0;

    const tokens = barber.google_calendar_tokens as CalendarToken | null;
    const googleCalendarConnected = Boolean(tokens);

    if (tokens) {
        try {
            const accessToken = await resolveBarberAccessToken(barberId, tokens);
            const gcalBusy = await getBarberGoogleBusySlots(accessToken, date, {
                extraCalendarIds: barber.google_calendar_id ? [barber.google_calendar_id] : [],
            });
            googleBusyCount = gcalBusy.length;
            busy = [...gcalBusy, ...busy];
        } catch (err) {
            console.error('[booking-availability] Google busy fetch failed:', err);
            throw new GoogleCalendarUnavailableError();
        }
    }

    return { busy, workingHours, googleCalendarConnected, googleBusyCount };
}

export function slotIsAvailable(
    date: Date,
    timeStr: string,
    durationMin: number,
    busySlots: { start: string; end: string }[],
): boolean {
    return !slotConflictsWithBusy(date, timeStr, durationMin, busySlots);
}

/** Stable noon anchor for a booking date string (Central Time). */
export function bookingSlotDate(date: string): Date {
    return new Date(toChicagoIsoString(date, '12:00 PM'));
}

export class SlotUnavailableError extends Error {
    constructor(message = 'This time slot is no longer available.') {
        super(message);
        this.name = 'SlotUnavailableError';
    }
}

/** Throws SlotUnavailableError when the barber slot overlaps DB or Google Calendar busy time. */
export async function assertBarberSlotAvailable(
    barberId: string,
    date: string,
    time: string,
    duration: string,
    options: { excludeBookingId?: string } = {},
): Promise<void> {
    const durationMin = parseDurationMins(duration);
    const { busy } = await getBarberAvailability(barberId, date, options);
    if (!slotIsAvailable(bookingSlotDate(date), time, durationMin, busy)) {
        throw new SlotUnavailableError();
    }
}
