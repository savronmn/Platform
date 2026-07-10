// Server-side booking cancellation — shared by API routes and webhooks.

import { createClient } from '@supabase/supabase-js';
import {
    getValidAccessToken,
    deleteCalendarEvent,
    type CalendarToken,
} from '@/lib/google-calendar';
import { sendCancellationEmails } from '@/lib/cancellation-email';

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
    warning?: string;
    error?: string;
}

/**
 * Cancel a booking: set status, send cancellation email, remove Google Calendar event.
 * Idempotent — repeated calls do not resend email, but retry calendar cleanup.
 */
export async function cancelBooking(
    bookingId: string,
    options: { skipEmail?: boolean; skipCalendar?: boolean } = {},
): Promise<CancelBookingResult> {
    const supabase = getAdmin();

    const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .select('*, barbers(name, email, google_calendar_id, google_calendar_tokens)')
        .eq('id', bookingId)
        .single();

    if (bookingError || !booking) {
        return { success: false, bookingId, error: bookingError?.message ?? 'Booking not found' };
    }

    let alreadyCancelled = booking.status === 'cancelled';
    let cancelledRows: Array<{ id: string; google_event_id: string | null }> = [];

    // Cancel every active twin in one operation. This releases the DB-backed slot
    // immediately and prevents one duplicate row from keeping it unavailable.
    if (!alreadyCancelled) {
        const updateQuery = supabase
            .from('bookings')
            .update({ status: 'cancelled' })
            .eq('status', booking.status);

        const { data, error: updateError } =
            booking.status === 'confirmed' && booking.barber_id && booking.date && booking.time
                ? await updateQuery
                    .eq('barber_id', booking.barber_id)
                    .eq('date', booking.date)
                    .eq('time', booking.time)
                    .select('id, google_event_id')
                : await updateQuery.eq('id', bookingId).select('id, google_event_id');

        if (updateError) {
            return { success: false, bookingId, error: updateError.message };
        }
        cancelledRows = data ?? [];
        // A concurrent request may have completed the cancellation first.
        alreadyCancelled = cancelledRows.length === 0;
    }

    let emailSent = false;
    let calendarDeleted = false;
    const warnings: string[] = [];
    const barberRelation = Array.isArray(booking.barbers)
        ? booking.barbers[0] ?? null
        : booking.barbers;
    let calendarRows = cancelledRows.length
        ? cancelledRows
        : [{ id: booking.id, google_event_id: booking.google_event_id }];

    // Include previously-cancelled twins left by older workflows so their orphaned
    // Google events cannot continue blocking this newly-available slot.
    if (booking.barber_id && booking.date && booking.time) {
        const { data: slotRows, error: slotRowsError } = await supabase
            .from('bookings')
            .select('id, google_event_id')
            .eq('barber_id', booking.barber_id)
            .eq('date', booking.date)
            .eq('time', booking.time)
            .eq('status', 'cancelled');
        if (slotRowsError) {
            console.error('Failed to load duplicate calendar events:', slotRowsError);
        } else if (slotRows) {
            calendarRows = slotRows;
        }
    }

    if (!options.skipEmail && !alreadyCancelled) {
        try {
            const emailResult = await sendCancellationEmails({
                ...booking,
                barbers: barberRelation
                    ? { name: barberRelation.name, email: barberRelation.email }
                    : null,
            });
            emailSent = emailResult.success;
            if (!emailResult.success) {
                warnings.push(emailResult.error ?? 'Cancellation email could not be sent');
            }
        } catch (error) {
            console.error('Failed to send cancellation emails:', error);
            warnings.push('Cancellation email could not be sent');
        }
    }

    if (!options.skipCalendar) {
        const barber = barberRelation as {
            google_calendar_id: string | null;
            google_calendar_tokens: CalendarToken | null;
        } | null;

        const eventRows = calendarRows
            .filter((row): row is { id: string; google_event_id: string } => Boolean(row.google_event_id));

        if (barber?.google_calendar_tokens && barber.google_calendar_id && eventRows.length > 0) {
            try {
                const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
                const results = await Promise.allSettled(eventRows.map(async row => {
                    await deleteCalendarEvent(accessToken, barber.google_calendar_id!, row.google_event_id);
                    await supabase.from('bookings').update({ google_event_id: null }).eq('id', row.id);
                }));
                const failed = results.filter(result => result.status === 'rejected');
                calendarDeleted = failed.length === 0;
                if (failed.length > 0) {
                    failed.forEach(result => {
                        if (result.status === 'rejected') {
                            console.error('Failed to delete cancelled calendar event:', result.reason);
                        }
                    });
                    warnings.push('Google Calendar cleanup is incomplete; the database slot is available');
                }
            } catch (error) {
                console.error('Failed to delete cancelled calendar events:', error);
                warnings.push('Google Calendar cleanup failed; the database slot is available');
            }
        } else {
            calendarDeleted = eventRows.length === 0;
            if (eventRows.length > 0) {
                warnings.push('Google Calendar is not connected; the database slot is available');
            }
        }
    }

    return {
        success: true,
        bookingId,
        alreadyCancelled,
        emailSent,
        calendarDeleted,
        warning: warnings.length ? warnings.join('. ') : undefined,
    };
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
