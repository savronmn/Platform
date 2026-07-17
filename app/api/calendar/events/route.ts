// GET /api/calendar/events?dateStart=YYYY-MM-DD&dateEnd=YYYY-MM-DD
// Returns Google Calendar events for all connected barbers in the given date range.
// Used by the host view to show external appointments alongside platform bookings.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidAccessToken, type CalendarToken } from '@/lib/google-calendar';
import { processDeclinedCalendarEvents } from '@/lib/process-calendar-declines';
import { requireStaff } from '@/lib/staff-auth';
import { eventHasClientCalendarCancellationSignal } from '@/lib/calendar-event-sync';
import {
    mergeLinkedCalendarMeta,
    processGoogleCalendarEventsForDisplay,
    type GoogleCalendarRawEvent,
    type LinkedCalendarByBookingId,
} from '@/lib/calendar-dedup';

const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

const BOOKING_DEDUP_COLUMNS =
    'id, shop_google_event_id, google_event_id, barber_id, status, date, time, service, client_name, duration';

async function listEvents(accessToken: string, calendarId: string, timeMin: string, timeMax: string) {
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
    const data = await res.json();
    return (data.items ?? []) as GoogleCalendarRawEvent[];
}

async function listAllCalendarIds(accessToken: string): Promise<string[]> {
    const url = new URL(`${GOOGLE_CALENDAR_BASE}/users/me/calendarList`);
    url.searchParams.set('minAccessRole', 'reader');
    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.items ?? []) as Array<{ id: string }>).map(c => c.id).filter(Boolean);
}

export async function GET(req: NextRequest) {
    const staff = await requireStaff();
    if (!staff.ok) {
        return NextResponse.json({ error: staff.error }, { status: staff.status });
    }

    const { searchParams } = req.nextUrl;
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');
    const skipDeclineSweep = searchParams.get('skipDeclineSweep') === '1';

    if (!dateStart || !dateEnd) {
        return NextResponse.json({ error: 'dateStart and dateEnd required' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    if (!skipDeclineSweep) {
        await processDeclinedCalendarEvents(supabase, dateStart, dateEnd);
    }

    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name, google_calendar_id, google_calendar_tokens')
        .not('google_calendar_tokens', 'is', null)
        .not('google_calendar_id', 'is', null)
        .eq('active', true);

    if (!barbers?.length) return NextResponse.json([]);

    const barberIds = barbers.map(barber => barber.id);
    const { data: linkedBookings } = await supabase
        .from('bookings')
        .select(BOOKING_DEDUP_COLUMNS)
        .in('barber_id', barberIds)
        .gte('date', dateStart)
        .lte('date', dateEnd);

    const bookings = linkedBookings ?? [];
    const timeMin = `${dateStart}T00:00:00-05:00`;
    const timeMax = `${dateEnd}T23:59:59-05:00`;
    const linkedCalendarByBookingId: LinkedCalendarByBookingId = {};
    const allExternalEvents: Array<ReturnType<typeof processGoogleCalendarEventsForDisplay>['externalEvents'][number] & {
        barberName: string;
        source: 'google';
    }> = [];

    const settled = await Promise.allSettled(
        barbers.map(async (barber) => {
            const tokens = barber.google_calendar_tokens as CalendarToken;
            const accessToken = await getValidAccessToken(tokens);

            const calendarIds = await listAllCalendarIds(accessToken);
            const idsToFetch = calendarIds.length > 0 ? calendarIds : [barber.google_calendar_id];

            const allRaw = await Promise.all(
                idsToFetch.map(id => listEvents(accessToken, id, timeMin, timeMax)),
            );

            const events = allRaw
                .flat()
                .filter(event => event.status !== 'cancelled' && event.start?.dateTime)
                .filter(event => !eventHasClientCalendarCancellationSignal(event));

            return processGoogleCalendarEventsForDisplay(events, bookings, {
                id: barber.id,
                name: barber.name,
            }, { requireBarberMatch: true });
        }),
    );

    for (const result of settled) {
        if (result.status !== 'fulfilled') continue;
        for (const [bookingId, meta] of Object.entries(result.value.linkedCalendarByBookingId)) {
            mergeLinkedCalendarMeta(linkedCalendarByBookingId, bookingId, meta);
        }
        for (const event of result.value.externalEvents) {
            allExternalEvents.push({
                ...event,
                barberName: barbers.find(barber => barber.id === event.barberId)?.name ?? '',
                source: 'google',
            });
        }
    }

    const globalSeen = new Map<string, typeof allExternalEvents[number]>();
    for (const event of allExternalEvents) {
        const normalName = (event.clientName ?? event.summary).toLowerCase().trim().replace(/\s+/g, ' ');
        const globalKey = `${normalName}|${event.date}|${event.time}|${event.barberId ?? ''}`;
        const existing = globalSeen.get(globalKey);
        if (!existing) {
            globalSeen.set(globalKey, event);
            continue;
        }
        if (event.clientName && !existing.clientName) globalSeen.set(globalKey, event);
    }

    return NextResponse.json({
        events: Array.from(globalSeen.values()),
        linkedCalendarByBookingId,
    });
}
