interface CalendarAttendee {
    email?: string;
    responseStatus?: string;
    organizer?: boolean;
}

export interface CalendarSyncEvent {
    id?: string;
    status?: string;
    attendees?: CalendarAttendee[];
}

export function clientDeclinedInvite(
    event: CalendarSyncEvent,
    clientEmail: string | null,
): boolean {
    if (!clientEmail || !event.attendees?.length) return false;
    const email = clientEmail.toLowerCase();
    return event.attendees.some(
        (attendee) =>
            !attendee.organizer &&
            attendee.email?.toLowerCase() === email &&
            attendee.responseStatus === 'declined',
    );
}

export function shouldCancelBookingFromCalendarEvent(
    event: CalendarSyncEvent,
    booking: { client_email: string | null; status: string },
): { skipCalendar: boolean; reason: 'event_deleted' | 'client_declined' } | null {
    if (booking.status === 'cancelled') return null;

    if (event.status === 'cancelled') {
        return { skipCalendar: true, reason: 'event_deleted' };
    }

    if (clientDeclinedInvite(event, booking.client_email)) {
        return { skipCalendar: false, reason: 'client_declined' };
    }

    return null;
}
