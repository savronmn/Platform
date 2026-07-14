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
    extendedProperties?: {
        private?: {
            savronBookingId?: string;
        };
    };
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
    | 'invitee_declined'
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

function guestAttendeeEmails(event: CalendarSyncEvent): string[] {
    return Array.from(new Set(
        (event.attendees ?? [])
            .filter(attendee => !attendee.organizer && attendee.email && !isSystemAttendee(attendee.email))
            .map(attendee => attendee.email!.toLowerCase()),
    ));
}

function declinedGuestEmails(event: CalendarSyncEvent): string[] {
    return Array.from(new Set(
        (event.attendees ?? [])
            .filter(attendee => !attendee.organizer
                && attendee.email
                && !isSystemAttendee(attendee.email)
                && attendee.responseStatus === 'declined')
            .map(attendee => attendee.email!.toLowerCase()),
    ));
}

export function extractSavronBookingId(event: CalendarSyncEvent): string | null {
    const bookingId = event.extendedProperties?.private?.savronBookingId?.trim();
    return bookingId || null;
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

/** Parse service label from a Google Calendar event summary. */
export function extractServiceFromEventSummary(summary: string): string {
    const trimmed = summary.trim();
    const scissorsMatch = trimmed.match(/^✂️?\s*.+?\s*[—–-]\s*(.+)$/);
    if (scissorsMatch) return scissorsMatch[1].trim();

    const withBarberMatch = trimmed.match(/^(.+?)\s+with\s+/i);
    if (withBarberMatch) return withBarberMatch[1].trim();

    const shopMatch = trimmed.match(/^(.+?)\s*·/);
    if (shopMatch) return shopMatch[1].trim();

    return trimmed || 'Appointment';
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

/** True when a non-system attendee declined the invite. */
export function eventHasClientCalendarCancellationSignal(event: CalendarSyncEvent): boolean {
    return (event.attendees ?? []).some(
        attendee => !attendee.organizer
            && !isSystemAttendee(attendee.email)
            && attendee.responseStatus === 'declined',
    );
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

/** True when any invited guest (not organizer / shop system accounts) declined. */
export function anyInviteeDeclined(event: CalendarSyncEvent): boolean {
    return eventHasClientCalendarCancellationSignal(event);
}

export function shouldCancelBookingFromCalendarEvent(
    event: CalendarSyncEvent,
    booking: BookingDeclineTarget,
): { skipCalendar: boolean; reason: CalendarCancellationReason } | null {
    if (booking.status === 'cancelled') return null;

    if (event.status === 'cancelled') {
        return { skipCalendar: true, reason: 'event_deleted' };
    }

    // Any invitee tapping "No" cancels the booking and deletes the Google event.
    if (anyInviteeDeclined(event) || clientDeclinedInvite(event, booking)) {
        return { skipCalendar: false, reason: 'invitee_declined' };
    }

    // Accepting an invite (including after an edit) confirms attendance — never auto-cancel.
    // Time changes on the organizer event still cancel so the app stays the source of truth.
    if (eventTimeDiffersFromBooking(event, booking)) {
        return { skipCalendar: false, reason: 'event_time_changed' };
    }

    return null;
}

const BOOKING_LOOKUP_SELECT = 'id, status, client_email, client_name, date, time';

export async function findBookingForCalendarEvent(
    supabase: SupabaseClient,
    barberId: string | null,
    event: CalendarSyncEvent,
): Promise<{
    id: string;
    status: string;
    client_email: string | null;
    client_name: string | null;
    date: string;
    time: string;
} | null> {
    const savronBookingId = extractSavronBookingId(event);
    if (savronBookingId) {
        const { data: byEmbeddedId } = await supabase
            .from('bookings')
            .select(BOOKING_LOOKUP_SELECT)
            .eq('id', savronBookingId)
            .maybeSingle();
        if (byEmbeddedId) return byEmbeddedId;
    }

    if (event.id) {
        const { data: byBarberEvent } = await supabase
            .from('bookings')
            .select(BOOKING_LOOKUP_SELECT)
            .eq('google_event_id', event.id)
            .maybeSingle();
        if (byBarberEvent) return byBarberEvent;

        const { data: byShopEvent } = await supabase
            .from('bookings')
            .select(BOOKING_LOOKUP_SELECT)
            .eq('shop_google_event_id', event.id)
            .maybeSingle();
        if (byShopEvent) return byShopEvent;
    }

    // Cancelled Google events without a stored event id must not cancel by slot guesswork.
    if (event.status === 'cancelled') return null;

    const slot = eventSlot(event);
    if (!slot) return null;

    let query = supabase
        .from('bookings')
        .select(BOOKING_LOOKUP_SELECT)
        .eq('date', slot.date)
        .eq('time', slot.time)
        .in('status', ['confirmed']);

    if (barberId) {
        query = query.eq('barber_id', barberId);
    }

    const { data: slotBookings } = await query;
    if (!slotBookings?.length) return null;

    const matchByClientEmail = (email: string) => slotBookings.find(
        booking => booking.client_email?.toLowerCase() === email,
    ) ?? null;

    for (const email of declinedGuestEmails(event)) {
        const byDeclinedEmail = matchByClientEmail(email);
        if (byDeclinedEmail) return byDeclinedEmail;
    }

    for (const email of guestAttendeeEmails(event)) {
        const byGuestEmail = matchByClientEmail(email);
        if (byGuestEmail) return byGuestEmail;
    }

    const eventClientName = extractClientNameFromEvent(event);
    if (eventClientName) {
        const matched = slotBookings.find(booking => namesMatch(booking.client_name, eventClientName));
        if (matched) return matched;
    }

    // Shop calendar webhook has no barber scope — only accept a unique slot match.
    if (!barberId) {
        if (slotBookings.length === 1 && anyInviteeDeclined(event)) return slotBookings[0];
        return null;
    }

    if (slotBookings.length === 1) return slotBookings[0];
    return null;
}
