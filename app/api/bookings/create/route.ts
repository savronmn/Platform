// POST /api/bookings/create
// Atomically validates barber slot availability (DB + Google Calendar) then inserts the booking.
// Body: CreateBookingInput fields (see lib/create-booking.ts)

import { NextRequest, NextResponse } from 'next/server';
import { createBooking, type CreateBookingInput } from '@/lib/create-booking';
import { SlotUnavailableError } from '@/lib/booking-availability';

export async function POST(request: NextRequest) {
    let body: CreateBookingInput;
    try {
        body = await request.json() as CreateBookingInput;
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body.barber_id || !body.date || !body.time || !body.service?.trim()) {
        return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 });
    }

    const hasClientIdentity =
        Boolean(body.client_name?.trim())
        || Boolean(body.client_email?.trim());

    if (!hasClientIdentity && body.status !== 'completed') {
        return NextResponse.json({ error: 'Client name or email is required' }, { status: 400 });
    }

    try {
        const { id } = await createBooking(body);
        return NextResponse.json({ id }, { status: 201 });
    } catch (err) {
        if (err instanceof SlotUnavailableError) {
            return NextResponse.json({ error: err.message }, { status: 409 });
        }
        console.error('[bookings/create] failed:', err);
        const message = err instanceof Error ? err.message : 'Booking creation failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
