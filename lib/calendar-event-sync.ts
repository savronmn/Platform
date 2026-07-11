import type { SupabaseClient } from '@supabase/supabase-js';

const SYSTEM_EMAILS = new Set([
    'info@savronmn.com',
    'savronmn@gmail.com',
    'aah8903@gmail.com',
]);

interface CalendarAttendee {
    email?: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
}

export interface CalendarSyncEvent {
    id?: string;
    status?: string;
    summary?: string;
    sequence?: number;
    start?: { dateTime?: string };
    attendees?: CalendarAttendee[];
}

export interface BookingDeclineTarget {
    client_email: string | null;
    client_name: string | null;
    status: string;
    date?: string;
    time?: string;
}

export type CalendarCancellationReason =
    | 'event_deleted'
    | 'client_declined'
    | 'client_proposed_new_time'
    | 'event_time_changed';

function clientMatchesAttendee(
    attendee: CalendarAttendee,
    booking: Pick<BookingDeclineTarget, 'client_email' | 'client_name'>,
): boolean {
    const clientEmail = booking.client_email?.toLowerCase().trim();
    const clientName = booking.client_name;

    if (clientEmail && attendee.email?.toLowerCase() === clientEmail) return true;
    if (clientName && attendee.displayName && namesMatch(clientName, attendee.displayName)) return true;
    if (clientName && attendee.email) {
        const localPart = attendee.email.split('@')[0]?.replace(/[._]/g, ' ');
        if (localPart && namesMatch(clientName, localPart)) return true;
    }
    return false;
}

function clientHasResponseStatus(
    event: CalendarSyncEvent,
    booking: Pick<BookingDeclineTarget, 'client_email' | 'client_name'>,
    responseStatus: string,
): boolean {
    if (!event.attendees?.length) return false;

    const clientName = booking.client_name;
    const eventClientName = extractClientNameFromEvent(event);

    for (const attendee of event.attendees) {
        if (attendee.organizer || isSystemAttendee(attendee.email)) continue;
        if (attendee.responseStatus !== responseStatus) continue;
        if (clientMatchesAttendee(attendee, booking)) return true;
    }

    const matchingStatusExists = event.attendees.some(
        attendee => !attendee.organizer
            && !isSystemAttendee(attendee.email)
            && attendee.responseStatus === responseStatus,
    );
    if (!matchingStatusExists) return false;

    if (clientName && eventClientName && namesMatch(clientName, eventClientName)) return true;
    if (clientName && event.summary && namesMatch(clientName, event.summary)) return true;

    return false;
}

export function normalizePersonName(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');
}

export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false;
    const left = normalizePersonName(a);
    const right = normalizePersonName(b);
    return left === right || left.includes(right) || right.includes(left);
}

function isSystemAttendee(email: string | null | undefined): boolean {
    if (!email) return false;
    return SYSTEM_EMAILS.has(email.toLowerCase());
}

/** Extract a clean client name from GCal event data. */
export function extractClientNameFromEvent(event: CalendarSyncEvent): string | null {
    const attendees = event.attendees ?? [];
    for (const attendee of attendees) {
        const email = attendee.email?.toLowerCase();
        if (isSystemAttendee(email)) continue;
        if (attendee.displayName && !attendee.displayName.includes('@')) {
            return attendee.displayName;
        }
    }

    const summary = (event.summary ?? '').trim();
    const scissorsMatch = summary.match(/^✂️?\s*(.+?)\s*[—–-]\s*.+/);
    if (scissorsMatch) {
        const name = scissorsMatch[1].trim();
        if (name && !name.includes('@')) return name;
    }

    const parenMatch = summary.match(/\(([^)]+)\)\s*$/);
    if (parenMatch) {
        const name = parenMatch[1].trim();
        if (name && !name.includes('@')) return name;
    }

    const dashMatch = summary.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)+)\s*[—–-]/);
    if (dashMatch) {
        const name = dashMatch[1].trim();
        if (name && !name.includes('@')) return name;
    }

    if (/^[A-Z][a-z]+(?: [A-Z][a-z]+){0,2}$/.test(summary)) {
        return summary;
    }

    return null;
}

export function isoDateTimeToTimeSlot(iso: string): string {
    const match = iso.match(/T(\d{2}):(\d{2})/);
    if (!match) return '9:00 AM';
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (iso.endsWith('Z')) hours = (hours - 5 + 24) % 24;
    const meridiem = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

export function eventSlot(event: CalendarSyncEvent): { date: string; time: string } | null {
    const iso = event.start?.dateTime;
    if (!iso) return null;
    return {
        date: iso.slice(0, 10),
        time: isoDateTimeToTimeSlot(iso),
    };
}

export function clientDeclinedInvite(
    event: CalendarSyncEvent,
    booking: Pick<BookingDeclineTarget, 'client_email' | 'client_name'>,
): boolean {
    return clientHasResponseStatus(event, booking, 'declined');
}

/** Tentative / Maybe — includes Google Calendar "Propose a new time". */
export function clientProposedNewTime(
    event: CalendarSyncEvent,
    booking: Pick<BookingDeclineTarget, 'client_email' | 'client_name'>,
): boolean {
    return clientHasResponseStatus(event, booking, 'tentative');
}

/** Client accepted the invite (Yes). Not treated as cancellation — confirms attendance. */
export function clientAcceptedInvite(
    event: CalendarSyncEvent,
    booking: Pick<BookingDeclineTarget, 'client_email' | 'client_name'>,
): boolean {
    return clientHasResponseStatus(event, booking, 'accepted');
}

export function eventTimeDiffersFromBooking(
    event: CalendarSyncEvent,
    booking: Pick<BookingDeclineTarget, 'date' | 'time'>,
): boolean {
    if (!booking.date || !booking.time) return false;
    const slot = eventSlot(event);
    if (!slot) return false;
    return slot.date !== booking.date || slot.time !== booking.time;
}

/** True when a non-system attendee declined and no booking match is required. */
export function eventHasDeclinedClient(event: CalendarSyncEvent): boolean {
    return eventHasClientCalendarCancellationSignal(event);
}

/** True when any client RSVP or propose-new-time signal is present on the event. */
export function eventHasClientCalendarCancellationSignal(event: CalendarSyncEvent): boolean {
    return (event.attendees ?? []).some(
        attendee => !attendee.organizer
            && !isSystemAttendee(attendee.email)
            && (
                ['declined', 'tentative'].includes(attendee.responseStatus ?? '')
                || (attendee.responseStatus === 'accepted' && (event.sequence ?? 0) > 0)
            ),
    );
}

export function shouldCancelBookingFromCalendarEvent(
    event: CalendarSyncEvent,
    booking: BookingDeclineTarget,
): { skipCalendar: boolean; reason: CalendarCancellationReason } | null {
    if (booking.status === 'cancelled') return null;

    if (event.status === 'cancelled') {
        return { skipCalendar: true, reason: 'event_deleted' };
    }

    if (clientDeclinedInvite(event, booking)) {
        return { skipCalendar: false, reason: 'client_declined' };
    }

    if (clientProposedNewTime(event, booking)) {
        return { skipCalendar: false, reason: 'client_proposed_new_time' };
    }

    // After an edit (Google sequence > 0), Yes/Accept on the updated invite cancels per shop policy.
    if (clientAcceptedInvite(event, booking) && (event.sequence ?? 0) > 0) {
        return { skipCalendar: false, reason: 'client_declined' };
    }

    if (eventTimeDiffersFromBooking(event, booking)) {
        return { skipCalendar: false, reason: 'event_time_changed' };
    }

    return null;
}

export async function findBookingForCalendarEvent(
    supabase: SupabaseClient,
    barberId: string,
    event: CalendarSyncEvent,
): Promise<{
    id: string;
    status: string;
    client_email: string | null;
    client_name: string | null;
    date: string;
    time: string;
} | null> {
    if (event.id) {
        const { data } = await supabase
            .from('bookings')
            .select('id, status, client_email, client_name, date, time')
            .eq('google_event_id', event.id)
            .maybeSingle();
        if (data) return data;
    }

    const slot = eventSlot(event);
    if (!slot) return null;

    const { data: slotBookings } = await supabase
        .from('bookings')
        .select('id, status, client_email, client_name, date, time')
        .eq('barber_id', barberId)
        .eq('date', slot.date)
        .eq('time', slot.time)
        .in('status', ['confirmed']);

    if (!slotBookings?.length) return null;
    if (slotBookings.length === 1) return slotBookings[0];

    const eventClientName = extractClientNameFromEvent(event);
    if (eventClientName) {
        const matched = slotBookings.find(booking => namesMatch(booking.client_name, eventClientName));
        if (matched) return matched;
    }

    return slotBookings[0];
}
