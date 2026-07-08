import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidAccessToken, getEventBusySlots, toIsoString, type CalendarToken } from '@/lib/google-calendar';
import { parseDurationMins, timeToMins } from '@/lib/calendar-timeline';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function minsToTimeStr(totalMins: number): string {
    const h24 = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const meridiem = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${meridiem}`;
}

function bookingToBusySlot(date: string, time: string, duration: string | null): { start: string; end: string } {
    const durationMin = parseDurationMins(duration);
    const endMins = timeToMins(time) + durationMin;
    return {
        start: toIsoString(date, time),
        end: toIsoString(date, minsToTimeStr(endMins)),
    };
}

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const barberId = searchParams.get('barberId');
    const date = searchParams.get('date'); // YYYY-MM-DD

    if (!barberId || !date) {
        return NextResponse.json({ error: 'Missing barberId or date' }, { status: 400 });
    }

    const supabaseAdmin = getAdmin();

    const [{ data: barber }, { data: dbBookings }] = await Promise.all([
        supabaseAdmin
            .from('barbers')
            .select('google_calendar_id, google_calendar_tokens, working_hours')
            .eq('id', barberId)
            .single(),
        supabaseAdmin
            .from('bookings')
            .select('time, duration')
            .eq('barber_id', barberId)
            .eq('date', date)
            .eq('status', 'confirmed'),
    ]);

    if (!barber) {
        return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const workingHours = barber.working_hours ?? null;
    const dbBusy = (dbBookings ?? []).map(b => bookingToBusySlot(date, b.time, b.duration));

    const tokens = barber.google_calendar_tokens as CalendarToken | null;
    const calendarId = barber.google_calendar_id;

    if (!tokens || !calendarId) {
        return NextResponse.json({ busy: dbBusy, workingHours });
    }

    try {
        const accessToken = await getValidAccessToken(tokens);

        const timeMin = `${date}T00:00:00-05:00`;
        const timeMax = `${date}T23:59:59-05:00`;

        // Use exact event times — freeBusy pads appointments with Google Calendar buffer time.
        const gcalBusy = await getEventBusySlots(accessToken, calendarId, timeMin, timeMax);

        return NextResponse.json({ busy: [...gcalBusy, ...dbBusy], workingHours });
    } catch (err) {
        console.error('Error fetching calendar busy slots:', err);
        return NextResponse.json({ busy: dbBusy, workingHours });
    }
}
