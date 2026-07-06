// Server-side booking cancellation — shared by API routes and webhooks.

import { createClient } from '@supabase/supabase-js';
import {
    getValidAccessToken,
    deleteCalendarEvent,
    type CalendarToken,
} from '@/lib/google-calendar';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface CancelBookingResult {
    success: boolean;
    bookingId: string;
    alreadyCancelled?: boolean;
    emailSent?: boolean;
    calendarDeleted?: boolean;
    error?: string;
}

/**
 * Cancel a booking: set status, send cancellation email, remove Google Calendar event.
 * Idempotent — safe to call on an already-cancelled booking (skips side effects).
 */
export async function cancelBooking(
    bookingId: string,
    options: { skipEmail?: boolean; skipCalendar?: boolean } = {},
): Promise<CancelBookingResult> {
    const supabase = getAdmin();

    const { data: booking } = await supabase
        .from('bookings')
        .select('*, barbers(name, email, google_calendar_id, google_calendar_tokens)')
        .eq('id', bookingId)
        .single();

    if (!booking) {
        return { success: false, bookingId, error: 'Booking not found' };
    }

    if (booking.status === 'cancelled') {
        return { success: true, bookingId, alreadyCancelled: true };
    }

    const { error: updateError } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

    if (updateError) {
        return { success: false, bookingId, error: updateError.message };
    }

    // Cancel duplicate confirmed rows at the same slot (GCal sync can create twins)
    if (booking.barber_id && booking.date && booking.time) {
        await supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('barber_id', booking.barber_id)
            .eq('date', booking.date)
            .eq('time', booking.time)
            .eq('status', 'confirmed')
            .neq('id', bookingId);
    }

    let emailSent = false;
    let calendarDeleted = false;

    if (!options.skipEmail) {
        try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL
                ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://savronmn.com');
            const res = await fetch(`${appUrl}/api/email/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId }),
            });
            emailSent = res.ok;
        } catch {
            // Email failure should not roll back cancellation
        }
    }

    if (!options.skipCalendar) {
        const barber = booking.barbers as {
            google_calendar_id: string | null;
            google_calendar_tokens: CalendarToken | null;
        } | null;

        if (barber?.google_calendar_tokens && barber.google_calendar_id && booking.google_event_id) {
            try {
                const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
                await deleteCalendarEvent(accessToken, barber.google_calendar_id, booking.google_event_id);
                await supabase.from('bookings').update({ google_event_id: null }).eq('id', bookingId);
                calendarDeleted = true;
            } catch {
                // Calendar delete failure should not roll back cancellation
            }
        }
    }

    return { success: true, bookingId, emailSent, calendarDeleted };
}

/** Returns barber IDs whose Google Calendar webhook sync channel is unhealthy. */
export async function getBarbersWithUnhealthySync(): Promise<{ id: string; name: string }[]> {
    const supabase = getAdmin();
    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name, google_calendar_tokens, google_calendar_id, google_sync_token, google_channel_id')
        .not('google_calendar_tokens', 'is', null)
        .not('google_calendar_id', 'is', null);

    return (barbers ?? [])
        .filter(b => !b.google_sync_token || !b.google_channel_id)
        .map(b => ({ id: b.id, name: b.name }));
}
