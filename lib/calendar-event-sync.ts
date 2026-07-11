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
    start?: { dateTime?: string };
    attendees?: CalendarAttendee[];
}

export interface BookingDeclineTarget {
    client_email: string | null;
    client_name: string | null;
    status: string;
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
    if (!event.attendees?.length) return false;

    const clientEmail = booking.client_email?.toLowerCase().trim();
    const clientName = booking.client_name;
    const eventClientName = extractClientNameFromEvent(event);

    for (const attendee of event.attendees) {
        if (attendee.organizer || isSystemAttendee(attendee.email)) continue;
        if (attendee.responseStatus !== 'declined') continue;

        if (clientEmail && attendee.email?.toLowerCase() === clientEmail) return true;
        if (clientName && attendee.displayName && namesMatch(clientName, attendee.displayName)) return true;
        if (clientName && attendee.email) {
            const localPart = attendee.email.split('@')[0]?.replace(/[._]/g, ' ');
            if (localPart && namesMatch(clientName, localPart)) return true;
        }
    }

    const declinedClientExists = event.attendees.some(
        attendee => !attendee.organizer
            && !isSystemAttendee(attendee.email)
            && attendee.responseStatus === 'declined',
    );
    if (!declinedClientExists) return false;

    if (clientName && eventClientName && namesMatch(clientName, eventClientName)) return true;
    if (clientName && event.summary && namesMatch(clientName, event.summary)) return true;

    return false;
}

/** True when a non-system attendee declined and no booking match is required. */
export function eventHasDeclinedClient(event: CalendarSyncEvent): boolean {
    return (event.attendees ?? []).some(
        attendee => !attendee.organizer
            && !isSystemAttendee(attendee.email)
            && attendee.responseStatus === 'declined',
    );
}

export function shouldCancelBookingFromCalendarEvent(
    event: CalendarSyncEvent,
    booking: BookingDeclineTarget,
): { skipCalendar: boolean; reason: 'event_deleted' | 'client_declined' } | null {
    if (booking.status === 'cancelled') return null;

    if (event.status === 'cancelled') {
        return { skipCalendar: true, reason: 'event_deleted' };
    }

    if (clientDeclinedInvite(event, booking)) {
        return { skipCalendar: false, reason: 'client_declined' };
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
} | null> {
    if (event.id) {
        const { data } = await supabase
            .from('bookings')
            .select('id, status, client_email, client_name')
            .eq('google_event_id', event.id)
            .maybeSingle();
        if (data) return data;
    }

    const slot = eventSlot(event);
    if (!slot) return null;

    const { data: slotBookings } = await supabase
        .from('bookings')
        .select('id, status, client_email, client_name')
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
