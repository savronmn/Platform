import { createClient } from '@supabase/supabase-js';
import {
    createCalendarEvent,
    getValidAccessToken,
    updateCalendarEvent,
    type CalendarToken,
} from '@/lib/google-calendar';
import { buildBookingCalendarPayload, type BookingCalendarInput } from '@/lib/booking-calendar-payload';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type BarberCalendarReady = {
    name: string;
    google_calendar_id: string;
    google_calendar_tokens: CalendarToken;
};

export function barberCalendarReady(
    barber: {
        google_calendar_id: string | null;
        google_calendar_tokens: CalendarToken | null;
    } | null,
): barber is BarberCalendarReady {
    return !!(barber?.google_calendar_tokens && barber.google_calendar_id);
}

/** Create/update a silent busy block on the barber's Google Calendar (no client invite email). */
export async function upsertBarberCalendarBlock(
    booking: BookingCalendarInput,
    barber: BarberCalendarReady,
    options: { existingEventId?: string | null } = {},
): Promise<string | null> {
    const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
    const payload = buildBookingCalendarPayload(booking, barber.name);

    const event = {
        summary: payload.staffSummary,
        description: payload.staffDescription,
        location: payload.location,
        startIso: payload.startIso,
        endIso: payload.endIso,
        attendeeEmails: [] as string[],
        bookingId: booking.id,
    };

    let eventId: string;
    if (options.existingEventId) {
        eventId = await updateCalendarEvent(
            accessToken,
            barber.google_calendar_id,
            options.existingEventId,
            event,
            'none',
        );
    } else {
        eventId = await createCalendarEvent(
            accessToken,
            barber.google_calendar_id,
            event,
            'none',
        );
    }

    await getAdmin()
        .from('bookings')
        .update({ google_event_id: eventId })
        .eq('id', booking.id);

    return eventId;
}
