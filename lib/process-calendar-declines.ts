import type { SupabaseClient } from '@supabase/supabase-js';
import { cancelBooking } from '@/lib/cancel-booking';
import {
    findBookingForCalendarEvent,
    shouldCancelBookingFromCalendarEvent,
    type CalendarSyncEvent,
} from '@/lib/calendar-event-sync';
import { getValidAccessToken, listAccountCalendarIds, type CalendarToken } from '@/lib/google-calendar';

const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

async function listEvents(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string,
): Promise<CalendarSyncEvent[]> {
    const url = new URL(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');

    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as CalendarSyncEvent[];
}

export async function processDeclinedCalendarEvents(
    supabase: SupabaseClient,
    dateStart: string,
    dateEnd: string,
): Promise<{ cancelled: number; reasons: string[] }> {
    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name, google_calendar_id, google_calendar_tokens')
        .not('google_calendar_tokens', 'is', null)
        .not('google_calendar_id', 'is', null)
        .eq('active', true);

    if (!barbers?.length) {
        return { cancelled: 0, reasons: [] };
    }

    const timeMin = `${dateStart}T00:00:00-05:00`;
    const timeMax = `${dateEnd}T23:59:59-05:00`;
    let cancelled = 0;
    const reasons: string[] = [];

    for (const barber of barbers) {
        const tokens = barber.google_calendar_tokens as CalendarToken;
        const accessToken = await getValidAccessToken(tokens);
        const calendarIds = await listAccountCalendarIds(accessToken);
        const idsToFetch = calendarIds.length > 0 ? calendarIds : [barber.google_calendar_id as string];

        const events = (
            await Promise.all(idsToFetch.map(calendarId => listEvents(accessToken, calendarId, timeMin, timeMax)))
        ).flat();

        const seenEventIds = new Set<string>();
        for (const event of events) {
            if (!event.id || seenEventIds.has(event.id)) continue;
            seenEventIds.add(event.id);
            if (event.status === 'cancelled') continue;

            const booking = await findBookingForCalendarEvent(supabase, barber.id, event);
            if (!booking) continue;

            const action = shouldCancelBookingFromCalendarEvent(event, booking);
            if (!action) continue;

            const result = await cancelBooking(booking.id, { skipCalendar: action.skipCalendar });
            if (result.success) {
                cancelled += 1;
                reasons.push(action.reason);
            }
        }
    }

    return { cancelled, reasons };
}
