// POST /api/calendar/events/cancel
// Deletes a Google Calendar event and cancels any linked booking.
// Body: { googleEventId: string, barberId: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase-server';
import { cancelBooking } from '@/lib/cancel-booking';
import { deleteCalendarEvent, getValidAccessToken, type CalendarToken } from '@/lib/google-calendar';
import { resolveBookingActor } from '@/lib/booking-auth';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
    const { googleEventId, barberId } = await request.json() as {
        googleEventId?: string;
        barberId?: string;
    };

    if (!googleEventId || !barberId) {
        return NextResponse.json({ error: 'Missing googleEventId or barberId' }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getAdmin();
    const { isStaff } = await resolveBookingActor(
        supabaseAdmin,
        user.id,
        user.email,
        { client_id: null, client_email: null },
    );

    if (!isStaff) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('id, status')
        .eq('google_event_id', googleEventId)
        .maybeSingle();

    if (booking && booking.status === 'confirmed') {
        const result = await cancelBooking(booking.id);
        if (!result.success) {
            return NextResponse.json({ error: result.error ?? 'Cancellation failed' }, { status: 500 });
        }
        return NextResponse.json({
            success: true,
            bookingCancelled: true,
            emailSent: result.emailSent,
            calendarDeleted: result.calendarDeleted,
            warning: result.warning,
        });
    }

    const { data: barber } = await supabaseAdmin
        .from('barbers')
        .select('google_calendar_id, google_calendar_tokens')
        .eq('id', barberId)
        .single();

    if (!barber?.google_calendar_tokens || !barber.google_calendar_id) {
        return NextResponse.json({ error: 'Barber calendar not connected' }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(barber.google_calendar_tokens as CalendarToken);
    await deleteCalendarEvent(accessToken, barber.google_calendar_id, googleEventId);

    return NextResponse.json({ success: true, bookingCancelled: false });
}
