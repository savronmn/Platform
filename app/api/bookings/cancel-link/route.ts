// GET  /api/bookings/cancel-link?token=... — preview booking for cancel page
// POST /api/bookings/cancel-link — body: { token } — cancel without login

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cancelBooking } from '@/lib/cancel-booking';
import { verifyBookingCancelToken } from '@/lib/booking-cancel-token';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function loadBooking(bookingId: string) {
    const supabaseAdmin = getAdmin();
    const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('id, service, date, time, status, client_name, barber_name, barbers(name)')
        .eq('id', bookingId)
        .single();

    if (!booking) return null;

    const barber = booking.barbers as { name: string } | { name: string }[] | null;
    const barberName = Array.isArray(barber)
        ? barber[0]?.name
        : barber?.name ?? booking.barber_name ?? 'Your barber';

    return {
        id: booking.id,
        service: booking.service,
        date: booking.date,
        time: booking.time,
        status: booking.status,
        clientFirstName: booking.client_name?.split(' ')[0] ?? null,
        barberName,
    };
}

export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get('token') ?? undefined;
    const verified = verifyBookingCancelToken(token);
    if (!verified) {
        return NextResponse.json({ error: 'Invalid or expired cancel link' }, { status: 400 });
    }

    const booking = await loadBooking(verified.bookingId);
    if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({
        booking,
        canCancel: booking.status === 'confirmed',
        alreadyCancelled: booking.status === 'cancelled',
    });
}

export async function POST(request: NextRequest) {
    const { token } = await request.json() as { token?: string };
    const verified = verifyBookingCancelToken(token);
    if (!verified) {
        return NextResponse.json({ error: 'Invalid or expired cancel link' }, { status: 400 });
    }

    const booking = await loadBooking(verified.bookingId);
    if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status === 'cancelled') {
        return NextResponse.json({ success: true, alreadyCancelled: true });
    }

    if (booking.status !== 'confirmed') {
        return NextResponse.json({ error: 'This appointment can no longer be cancelled online' }, { status: 400 });
    }

    const result = await cancelBooking(verified.bookingId);
    if (!result.success) {
        return NextResponse.json({ error: result.error ?? 'Cancellation failed' }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        alreadyCancelled: result.alreadyCancelled,
        warning: result.warning,
    });
}
