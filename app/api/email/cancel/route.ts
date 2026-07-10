// POST /api/email/cancel
// Sends cancellation notices to the client, barber, and shop.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendCancellationEmails } from '@/lib/cancellation-email';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
    const { bookingId } = await request.json() as { bookingId?: string };
    if (!bookingId) {
        return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    const { data: booking, error } = await getAdmin()
        .from('bookings')
        .select('id, client_email, client_name, date, duration, service, time, barber_name, barbers(name, email)')
        .eq('id', bookingId)
        .single();

    if (error || !booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const result = await sendCancellationEmails({
        ...booking,
        barbers: Array.isArray(booking.barbers) ? booking.barbers[0] ?? null : booking.barbers,
    });

    return NextResponse.json(
        result,
        { status: result.success ? 200 : result.error === 'Email service not configured' ? 503 : 502 },
    );
}
