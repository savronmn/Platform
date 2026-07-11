// GET /api/calendar/events?dateStart=YYYY-MM-DD&dateEnd=YYYY-MM-DD
// Returns Google Calendar events for all connected barbers in the given date range.
// Used by the host view to show external appointments alongside platform bookings.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidAccessToken, type CalendarToken } from '@/lib/google-calendar';
import { processDeclinedCalendarEvents } from '@/lib/process-calendar-declines';
import {
    eventHasClientCalendarCancellationSignal,
    extractClientNameFromEvent,
    isoDateTimeToTimeSlot,
} from '@/lib/calendar-event-sync';

const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

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
    return (data.items ?? []) as any[];
}

// Returns all calendar IDs in the account — catches events booked on secondary/personal calendars.
async function listAllCalendarIds(accessToken: string): Promise<string[]> {
    const url = new URL(`${GOOGLE_CALENDAR_BASE}/users/me/calendarList`);
    url.searchParams.set('minAccessRole', 'reader');
    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.items ?? []) as any[]).map((c: any) => c.id as string).filter(Boolean);
}

function isoToTimeSlot(iso: string): string {
    return isoDateTimeToTimeSlot(iso);
}

/** Extract a clean client name from GCal event data.
 *  Priority:
 *  1. Non-email displayName from attendees (exclude savronmn & info@savronmn)
 *  2. Name parsed from summary patterns: "✂️ {Name} — {service}", "{service} ({Name})", etc.
 *  3. Name parsed from summary if it looks like a name (no special chars, short enough)
 *  4. null
 */
function extractClientName(e: { summary?: string; attendees?: Array<{ email?: string; displayName?: string }> }): string | null {
    return extractClientNameFromEvent(e);
}

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');

    if (!dateStart || !dateEnd) {
        return NextResponse.json({ error: 'dateStart and dateEnd required' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Cancel bookings when clients decline in Google Calendar before building host view data.
    await processDeclinedCalendarEvents(supabase, dateStart, dateEnd);

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
        .select('id, google_event_id, barber_id, status')
        .in('barber_id', barberIds)
        .gte('date', dateStart)
        .lte('date', dateEnd)
        .not('google_event_id', 'is', null);

    const linkedEventIds = new Set(
        (linkedBookings ?? [])
            .filter(booking => booking.status === 'confirmed' && booking.google_event_id)
            .map(booking => booking.google_event_id as string),
    );
    const bookingByEventId = new Map(
        (linkedBookings ?? [])
            .filter(booking => booking.google_event_id)
            .map(booking => [booking.google_event_id as string, booking.id as string]),
    );

    const timeMin = `${dateStart}T00:00:00-05:00`;
    const timeMax = `${dateEnd}T23:59:59-05:00`;

    const settled = await Promise.allSettled(
        barbers.map(async (barber) => {
            const tokens = barber.google_calendar_tokens as CalendarToken;
            const accessToken = await getValidAccessToken(tokens);

            // Fetch from every calendar in the account so events on secondary/personal
            // calendars aren't missed. Fall back to the stored ID if listing fails.
            const calendarIds = await listAllCalendarIds(accessToken);
            const idsToFetch = calendarIds.length > 0 ? calendarIds : [barber.google_calendar_id];

            const allRaw = await Promise.all(
                idsToFetch.map(id => listEvents(accessToken, id, timeMin, timeMax))
            );
            const events = allRaw.flat();

            const mapped = events
                .filter((e) => e.status !== 'cancelled' && e.start?.dateTime)
                .filter((e) => !eventHasClientCalendarCancellationSignal(e))
                .filter((e) => !linkedEventIds.has(e.id as string))
                .map((e) => {
                    const clientName = extractClientName(e);
                    return {
                        id: e.id as string,
                        barberId: barber.id as string,
                        barberName: barber.name as string,
                        summary: (e.summary as string) || 'Appointment',
                        // clientName is the clean extracted name; attendee kept for backward compat
                        clientName,
                        attendee: clientName,
                        start: e.start.dateTime as string,
                        end: (e.end?.dateTime ?? e.start.dateTime) as string,
                        date: (e.start.dateTime as string).slice(0, 10),
                        time: isoToTimeSlot(e.start.dateTime as string),
                        bookingId: bookingByEventId.get(e.id as string) ?? null,
                        // htmlLink is the canonical Google Calendar URL to view/edit this event
                        htmlLink: (e.htmlLink as string | undefined) ?? null,
                        source: 'google' as const,
                    };
                });

            // Dedup pass 1: keep one event per barber+date+time.
            // Among duplicates at the same time, prefer the one with a real client name.
            const slotMap = new Map<string, typeof mapped[number]>();
            for (const ev of mapped) {
                const slotKey = `${ev.barberId}|${ev.date}|${ev.time}`;
                const existing = slotMap.get(slotKey);
                if (!existing) { slotMap.set(slotKey, ev); continue; }
                // Prefer whichever has a real client name
                if (ev.clientName && !existing.clientName) slotMap.set(slotKey, ev);
            }

            const pass1 = Array.from(slotMap.values());

            // Dedup pass 2: if same client name appears at same date+time (across barbers),
            // keep only the first. This handles duplicate calendars reading the same event.
            return pass1;
        })
    );

    const allEvents = settled
        .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);

    // Global dedup by name+date+time — catches the same appointment showing from
    // multiple connected calendars (e.g. personal + appointment calendar both connected).
    const globalSeen = new Map<string, typeof allEvents[number]>();
    for (const ev of allEvents) {
        const normalName = (ev.clientName ?? ev.summary).toLowerCase().trim().replace(/\s+/g, ' ');
        const globalKey = `${normalName}|${ev.date}|${ev.time}`;
        if (!globalSeen.has(globalKey)) {
            globalSeen.set(globalKey, ev);
        } else {
            // Keep whichever has the better name
            const existing = globalSeen.get(globalKey)!;
            if (ev.clientName && !existing.clientName) globalSeen.set(globalKey, ev);
        }
    }

    return NextResponse.json(Array.from(globalSeen.values()));
}
