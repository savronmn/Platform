import { createClient } from '@supabase/supabase-js';
import {
    getValidAccessToken,
    getEventBusySlots,
    toIsoString,
    type CalendarToken,
} from '@/lib/google-calendar';
import { parseDurationMins, timeToMins } from '@/lib/calendar-timeline';
import { slotConflictsWithBusy, slotToMs } from '@/lib/time-helpers';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Statuses that block new bookings on the same barber/day. */
export const BLOCKING_BOOKING_STATUSES = ['confirmed', 'completed', 'no_show'] as const;

const PLATFORM_BOOKING_MATCH_TOLERANCE_MINS = 22;

function minsToTimeStr(totalMins: number): string {
    const h24 = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const meridiem = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${meridiem}`;
}

export function bookingToBusySlot(date: string, time: string, duration: string | null): { start: string; end: string } {
    const durationMin = parseDurationMins(duration);
    const endMins = timeToMins(time) + durationMin;
    return {
        start: toIsoString(date, time),
        end: toIsoString(date, minsToTimeStr(endMins)),
    };
}

/** True when a GCal event is the same platform appointment already counted from DB. */
export function googleEventMatchesPlatformBooking(
    eventStartIso: string,
    date: string,
    bookingTimes: string[],
    toleranceMins = PLATFORM_BOOKING_MATCH_TOLERANCE_MINS,
): boolean {
    if (bookingTimes.length === 0) return false;
    const eventStartMs = new Date(eventStartIso).getTime();
    const dayAnchor = new Date(`${date}T12:00:00`);
    return bookingTimes.some((bookingTime) => {
        const bookingStartMs = slotToMs(dayAnchor, bookingTime);
        return Math.abs(eventStartMs - bookingStartMs) <= toleranceMins * 60_000;
    });
}

export async function getBarberDatabaseBusySlots(
    barberId: string,
    date: string,
    options: { excludeBookingId?: string } = {},
): Promise<{
    busy: { start: string; end: string }[];
    linkedGoogleEventIds: Set<string>;
    bookingTimes: string[];
}> {
    const supabaseAdmin = getAdmin();
    let query = supabaseAdmin
        .from('bookings')
        .select('id, time, duration, status, google_event_id, shop_google_event_id')
        .eq('barber_id', barberId)
        .eq('date', date)
        .in('status', [...BLOCKING_BOOKING_STATUSES]);

    if (options.excludeBookingId) {
        query = query.neq('id', options.excludeBookingId);
    }

    const { data: dbBookings } = await query;

    const busy = (dbBookings ?? []).map(booking =>
        bookingToBusySlot(date, booking.time, booking.duration),
    );

    const linkedGoogleEventIds = new Set(
        (dbBookings ?? [])
            .flatMap(booking => [booking.google_event_id, booking.shop_google_event_id])
            .filter((id): id is string => Boolean(id)),
    );

    const bookingTimes = (dbBookings ?? []).map(booking => booking.time);

    return { busy, linkedGoogleEventIds, bookingTimes };
}

export async function getBarberGoogleBusySlots(
    accessToken: string,
    calendarId: string,
    date: string,
    linkedGoogleEventIds: Set<string>,
    bookingTimes: string[],
): Promise<{ start: string; end: string }[]> {
    const timeMin = `${date}T00:00:00-05:00`;
    const timeMax = `${date}T23:59:59-05:00`;

    const slots = await getEventBusySlots(accessToken, calendarId, timeMin, timeMax).catch(() => []);

    return slots
        .filter(slot => {
            if (slot.id && linkedGoogleEventIds.has(slot.id)) return false;
            if (googleEventMatchesPlatformBooking(slot.start, date, bookingTimes)) return false;
            return true;
        })
        .map(({ start, end }) => ({ start, end }));
}

export async function getBarberAvailability(
    barberId: string,
    date: string,
    options: { excludeBookingId?: string } = {},
): Promise<{ busy: { start: string; end: string }[]; workingHours: Record<string, { open: string; close: string } | null> | null }> {
    const supabaseAdmin = getAdmin();

    const [{ data: barber }, dbAvailability] = await Promise.all([
        supabaseAdmin
            .from('barbers')
            .select('google_calendar_id, google_calendar_tokens, working_hours')
            .eq('id', barberId)
            .single(),
        getBarberDatabaseBusySlots(barberId, date, options),
    ]);

    if (!barber) {
        throw new Error('Barber not found');
    }

    const workingHours = (barber.working_hours ?? null) as Record<string, { open: string; close: string } | null> | null;
    // Platform bookings from DB are canonical — GCal only adds external blocks.
    let busy = [...dbAvailability.busy];

    const tokens = barber.google_calendar_tokens as CalendarToken | null;
    const calendarId = barber.google_calendar_id;

    if (tokens && calendarId) {
        try {
            const accessToken = await getValidAccessToken(tokens);
            const gcalBusy = await getBarberGoogleBusySlots(
                accessToken,
                calendarId,
                date,
                dbAvailability.linkedGoogleEventIds,
                dbAvailability.bookingTimes,
            );
            busy = [...busy, ...gcalBusy];
        } catch (err) {
            console.error('[booking-availability] Google busy fetch failed:', err);
        }
    }

    return { busy, workingHours };
}

export function slotIsAvailable(
    date: Date,
    timeStr: string,
    durationMin: number,
    busySlots: { start: string; end: string }[],
): boolean {
    return !slotConflictsWithBusy(date, timeStr, durationMin, busySlots);
}
