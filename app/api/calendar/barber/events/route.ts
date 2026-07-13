// GET /api/calendar/barber/events?dateStart=YYYY-MM-DD&dateEnd=YYYY-MM-DD
// Returns the authenticated barber's Google Calendar events for the date range.

import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken, type CalendarToken } from '@/lib/google-calendar';
import { createServerSupabase } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/staff-auth';

const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function listCalendarIds(accessToken: string): Promise<string[]> {
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

async function listEvents(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string,
) {
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
    return (data.items ?? []) as Array<{
        id: string;
        status?: string;
        summary?: string;
        htmlLink?: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
    }>;
}

export async function GET(request: NextRequest) {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getAdmin();
    const { searchParams } = request.nextUrl;
    const previewBarberId = searchParams.get('barberId');

    let barber: {
        id: string;
        google_calendar_id: string | null;
        google_calendar_tokens: CalendarToken | null;
    } | null = null;

    if (previewBarberId) {
        const staff = await requireStaff();
        if (!staff.ok || !staff.user.isAdmin) {
            return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }

        const { data } = await admin
            .from('barbers')
            .select('id, google_calendar_id, google_calendar_tokens')
            .eq('id', previewBarberId)
            .maybeSingle();
        barber = data;
    } else {
        const { data } = await admin
            .from('barbers')
            .select('id, google_calendar_id, google_calendar_tokens')
            .eq('auth_id', user.id)
            .maybeSingle();
        barber = data;
    }

    if (!barber) {
        return NextResponse.json({ error: 'Barber profile not found' }, { status: 404 });
    }

    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');

    if (!dateStart || !dateEnd) {
        return NextResponse.json({ error: 'dateStart and dateEnd required' }, { status: 400 });
    }

    const tokens = barber.google_calendar_tokens as CalendarToken | null;
    if (!tokens || !barber.google_calendar_id) {
        return NextResponse.json({ events: [], connected: false });
    }

    const { data: linkedBookings } = await admin
        .from('bookings')
        .select('id, shop_google_event_id, status')
        .eq('barber_id', barber.id)
        .gte('date', dateStart)
        .lte('date', dateEnd)
        .not('shop_google_event_id', 'is', null);

    const linkedEventIds = new Set(
        (linkedBookings ?? [])
            .filter(b => b.status === 'confirmed' && b.shop_google_event_id)
            .map(b => b.shop_google_event_id as string),
    );

    try {
        const accessToken = await getValidAccessToken(tokens);
        const calendarIds = await listCalendarIds(accessToken);
        const idsToFetch = calendarIds.length > 0
            ? calendarIds
            : [barber.google_calendar_id];

        const timeMin = `${dateStart}T00:00:00-05:00`;
        const timeMax = `${dateEnd}T23:59:59-05:00`;

        const allRaw = await Promise.all(
            idsToFetch.map(id => listEvents(accessToken, id, timeMin, timeMax)),
        );

        const events = allRaw
            .flat()
            .filter(e => e.status !== 'cancelled' && e.start?.dateTime)
            .filter(e => !linkedEventIds.has(e.id))
            .map(e => ({
                id: e.id,
                summary: e.summary || 'Busy',
                start: e.start!.dateTime!,
                end: e.end?.dateTime ?? e.start!.dateTime!,
                htmlLink: e.htmlLink ?? null,
            }));

        return NextResponse.json({ events, connected: true });
    } catch (err) {
        console.error('[calendar/barber/events]', err);
        return NextResponse.json({ events: [], connected: true, warning: 'fetch_failed' });
    }
}
