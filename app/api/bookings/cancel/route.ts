// POST /api/bookings/cancel
// Cancels a booking with email + calendar sync. Used by host, client, and admin flows.
// Body: { bookingId: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase-server';
import { cancelBooking } from '@/lib/cancel-booking';
import { resolveBookingActor } from '@/lib/booking-auth';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
    const { bookingId, hardDelete = false } = await request.json() as {
        bookingId?: string;
        hardDelete?: boolean;
    };

    if (!bookingId) {
        return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    const supabaseAdmin = getAdmin();

    const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('id, client_id, client_email, status, barber_id')
        .eq('id', bookingId)
        .single();

    if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Auth: client may cancel own booking; staff (admin/barber/host) may cancel any
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { isStaff, ownsBooking } = await resolveBookingActor(
        supabaseAdmin,
        user.id,
        user.email,
        booking,
    );

    // Staff can remove cancelled/no-show tombstones from the cancellation report without re-running cancel.
    if (hardDelete && isStaff && (booking.status === 'cancelled' || booking.status === 'no_show')) {
        const { error: deleteError } = await supabaseAdmin
            .from('bookings')
            .delete()
            .eq('id', bookingId);

        if (deleteError) {
            return NextResponse.json(
                { error: `Could not delete report entry: ${deleteError.message}` },
                { status: 500 },
            );
        }

        return NextResponse.json({ success: true, deleted: true });
    }

    // Repeated requests for an already-cancelled booking remain idempotent.
    if (booking.status !== 'confirmed' && booking.status !== 'cancelled') {
        return NextResponse.json({ error: 'Only confirmed bookings can be cancelled' }, { status: 400 });
    }

    if (hardDelete && !isStaff) {
        return NextResponse.json({ error: 'Only staff can delete bookings' }, { status: 403 });
    }

    if (!isStaff && !ownsBooking) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await cancelBooking(bookingId);

    if (!result.success) {
        return NextResponse.json({ error: result.error ?? 'Cancellation failed' }, { status: 500 });
    }

    // Keep a cancelled tombstone when Google cleanup failed. The busy-slot API
    // uses its event ID to ignore the orphan, guaranteeing immediate availability.
    const shouldDelete = hardDelete && result.calendarDeleted !== false;
    if (shouldDelete) {
        const { error: deleteError } = await supabaseAdmin
            .from('bookings')
            .delete()
            .eq('id', bookingId)
            .eq('status', 'cancelled');
        if (deleteError) {
            return NextResponse.json(
                {
                    error: `Appointment was cancelled, but could not be deleted: ${deleteError.message}`,
                    cancelled: true,
                    warning: result.warning,
                },
                { status: 500 },
            );
        }
    }

    return NextResponse.json({
        success: true,
        deleted: shouldDelete,
        emailSent: result.emailSent,
        calendarDeleted: result.calendarDeleted,
        warning: result.warning,
    });
}
