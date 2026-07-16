import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';
import { updateBooking, type UpdateBookingInput } from '@/lib/update-booking';
import { SlotUnavailableError } from '@/lib/booking-availability';
import { requireStaff } from '@/lib/staff-auth';

export async function POST(request: NextRequest) {
    const staff = await requireStaff();
    if (!staff.ok) {
        return NextResponse.json({ error: staff.error }, { status: staff.status });
    }

    let body: UpdateBookingInput;
    try {
        body = await request.json() as UpdateBookingInput;
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body.bookingId || !body.barber_id || !body.date || !body.time || !body.service?.trim()) {
        return NextResponse.json({ error: 'Missing required booking fields' }, { status: 400 });
    }

    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { booking } = await updateBooking(body);
        return NextResponse.json({ booking });
    } catch (err) {
        if (err instanceof SlotUnavailableError) {
            return NextResponse.json({ error: err.message }, { status: 409 });
        }
        const message = err instanceof Error ? err.message : 'Booking update failed';
        if (message === 'Booking not found') {
            return NextResponse.json({ error: message }, { status: 404 });
        }
        console.error('[bookings/update] failed:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
