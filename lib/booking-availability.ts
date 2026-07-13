import { createClient } from '@supabase/supabase-js';
import {
    getValidAccessToken,
    getEventBusySlots,
    listAccountCalendarIds,
    toIsoString,
    type CalendarToken,
} from '@/lib/google-calendar';
import { parseDurationMins, timeToMins } from '@/lib/calendar-timeline';
import { slotConflictsWithBusy } from '@/lib/time-helpers';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Statuses that block new bookings on the same barber/day. */
export const BLOCKING_BOOKING_STATUSES = ['confirmed', 'completed', 'no_show'] as const;

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

export async function getBarberDatabaseBusySlots(
    barberId: string,
    date: string,
    options: { excludeBookingId?: string } = {},
): Promise<{ busy: { start: string; end: string }[]; linkedGoogleEventIds: Set<string> }> {
    const supabaseAdmin = getAdmin();
    let query = supabaseAdmin
        .from('bookings')
        .select('id, time, duration, status, google_event_id')
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
            .map(booking => booking.google_event_id)
            .filter((id): id is string => Boolean(id)),
    );

    return { busy, linkedGoogleEventIds };
}

export async function getBarberGoogleBusySlots(
    accessToken: string,
    date: string,
    linkedGoogleEventIds: Set<string>,
): Promise<{ start: string; end: string }[]> {
    const calendarIds = await listAccountCalendarIds(accessToken);
    if (calendarIds.length === 0) return [];

    const timeMin = `${date}T00:00:00-05:00`;
    const timeMax = `${date}T23:59:59-05:00`;

    const perCalendar = await Promise.all(
        calendarIds.map(calendarId =>
            getEventBusySlots(accessToken, calendarId, timeMin, timeMax).catch(() => []),
        ),
    );

    const seen = new Set<string>();
    const merged: { start: string; end: string }[] = [];

    for (const slots of perCalendar) {
        for (const slot of slots) {
            if (slot.id && linkedGoogleEventIds.has(slot.id)) continue;
            const key = slot.id ?? `${slot.start}|${slot.end}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push({ start: slot.start, end: slot.end });
        }
    }

    return merged;
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
    let busy = [...dbAvailability.busy];

    const tokens = barber.google_calendar_tokens as CalendarToken | null;
    if (tokens) {
        try {
            const accessToken = await getValidAccessToken(tokens);
            const gcalBusy = await getBarberGoogleBusySlots(
                accessToken,
                date,
                dbAvailability.linkedGoogleEventIds,
            );
            busy = [...gcalBusy, ...busy];
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
