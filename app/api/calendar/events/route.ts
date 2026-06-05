// GET /api/calendar/events?dateStart=YYYY-MM-DD&dateEnd=YYYY-MM-DD
// Returns Google Calendar events for all connected barbers in the given date range.
// Used by the host view to show external appointments alongside platform bookings.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidAccessToken, type CalendarToken } from '@/lib/google-calendar';

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

function isoToTimeSlot(iso: string): string {
    // Parse h/m directly from the ISO string so the server's UTC timezone
    // doesn't shift the hour. e.g. "2026-06-05T10:30:00-05:00" → h=10, m=30.
    // If the string is UTC (ends in Z), shift by CDT offset (-5).
    const match = iso.match(/T(\d{2}):(\d{2})/);
    if (!match) return '9:00 AM';
    let h = parseInt(match[1], 10);
    let m = parseInt(match[2], 10);
    if (iso.endsWith('Z')) h = (h - 5 + 24) % 24; // UTC → CDT
    // Round to nearest 45 min so events land on a HOST_TIME_SLOTS row
    m = Math.round(m / 45) * 45;
    if (m >= 60) { m = m - 60; h = (h + 1) % 24; }
    const meridiem = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${meridiem}`;
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

    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name, google_calendar_id, google_calendar_tokens')
        .not('google_calendar_tokens', 'is', null)
        .not('google_calendar_id', 'is', null)
        .eq('active', true);

    if (!barbers?.length) return NextResponse.json([]);

    const timeMin = `${dateStart}T00:00:00-05:00`;
    const timeMax = `${dateEnd}T23:59:59-05:00`;

    const settled = await Promise.allSettled(
        barbers.map(async (barber) => {
            const tokens = barber.google_calendar_tokens as CalendarToken;
            const accessToken = await getValidAccessToken(tokens);
            const events = await listEvents(accessToken, barber.google_calendar_id, timeMin, timeMax);

            return events
                .filter((e) => e.status !== 'cancelled' && e.start?.dateTime)
                .map((e) => ({
                    id: e.id as string,
                    barberId: barber.id as string,
                    barberName: barber.name as string,
                    summary: (e.summary as string) || 'Appointment',
                    attendee: (e.attendees?.[0]?.displayName ?? e.attendees?.[0]?.email ?? null) as string | null,
                    start: e.start.dateTime as string,
                    end: (e.end?.dateTime ?? e.start.dateTime) as string,
                    date: (e.start.dateTime as string).slice(0, 10),
                    time: isoToTimeSlot(e.start.dateTime as string),
                    source: 'google' as const,
                }));
        })
    );

    const events = settled
        .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);

    return NextResponse.json(events);
}
