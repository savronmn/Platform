// Server-side booking cancellation — shared by API routes and webhooks.

import { createClient } from '@supabase/supabase-js';
import { deleteAllBookingCalendarEvents } from '@/lib/booking-calendar-cleanup';
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
 * Cancel a booking: set status, remove Google Calendar events.
 * When shop calendar is connected, Google (savronmn@gmail.com) notifies attendees on delete/decline.
 */
export async function cancelBooking(
    bookingId: string,
    options: { skipEmail?: boolean; skipCalendar?: boolean; fallbackDate?: string; fallbackTime?: string } = {},
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
        alreadyCancelled = cancelledRows.length === 0;
    }

    let emailSent = false;
    let calendarDeleted = true;
    const warnings: string[] = [];
    const barberRelation = Array.isArray(booking.barbers)
        ? booking.barbers[0] ?? null
        : booking.barbers;

    const shouldSendEmail = !options.skipEmail
        && !alreadyCancelled
        && !booking.shop_google_event_id
        && !booking.google_event_id;
    const shouldCleanupCalendar = !options.skipCalendar;

    const emailPromise = shouldSendEmail
        ? sendCancellationEmails({
            ...booking,
            barbers: barberRelation
                ? { name: barberRelation.name, email: barberRelation.email }
                : null,
        }).catch((error) => {
            console.error('Failed to send cancellation emails:', error);
            return { success: false, error: 'Cancellation email could not be sent' };
        })
        : Promise.resolve(null);

    const calendarPromise = shouldCleanupCalendar
        ? deleteAllBookingCalendarEvents(
            {
                id: booking.id,
                google_event_id: booking.google_event_id,
                shop_google_event_id: booking.shop_google_event_id,
                barber_id: booking.barber_id,
                date: options.fallbackDate ?? booking.date,
                time: options.fallbackTime ?? booking.time,
                client_name: booking.client_name,
                client_email: booking.client_email,
                service: booking.service,
            },
            {
                barberId: booking.barber_id,
                fallbackDate: options.fallbackDate ?? booking.date,
                fallbackTime: options.fallbackTime ?? booking.time,
            },
        ).catch((error) => {
            console.error('Failed to delete calendar events:', error);
            return { deleted: 0, failed: 1, calendarsChecked: [] as string[] };
        })
        : Promise.resolve(null);

    const [emailResult, cleanup] = await Promise.all([emailPromise, calendarPromise]);

    if (emailResult) {
        emailSent = emailResult.success;
        if (!emailResult.success) {
            warnings.push(emailResult.error ?? 'Cancellation email could not be sent');
        }
    }

    if (cleanup) {
        calendarDeleted = cleanup.failed === 0;

        const rowIds = cancelledRows.length
            ? cancelledRows.map(r => r.id)
            : [booking.id];

        await supabase
            .from('bookings')
            .update({ google_event_id: null, shop_google_event_id: null })
            .in('id', rowIds);

        if (cleanup.failed > 0) {
            console.error('[cancel-booking] Calendar cleanup partial failure:', cleanup);
            warnings.push(
                'Some Google Calendar events could not be removed. The slot is available in the app; retry cancel or check barber/Savron calendar connection.',
            );
        }
    } else if (shouldCleanupCalendar) {
        calendarDeleted = false;
        warnings.push(
            'Google Calendar cleanup failed. The slot is available in the app; verify barber and Savron calendars are connected.',
        );
    }

    return {
        success: true,
        bookingId,
        alreadyCancelled,
        emailSent,
        calendarDeleted,
        warning: warnings.length ? warnings.join(' ') : undefined,
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
