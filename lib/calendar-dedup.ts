import type { Booking } from '@/lib/types';
import {
    extractServiceFromEventSummary,
    namesMatch,
} from '@/lib/calendar-event-sync';
import { timeToMins } from '@/lib/calendar-timeline';

/** Booking statuses that still occupy the calendar and should hide linked GCal copies. */
export const CALENDAR_VISIBLE_BOOKING_STATUSES = ['confirmed', 'completed', 'no_show'] as const;

export type CalendarVisibleBookingStatus = (typeof CALENDAR_VISIBLE_BOOKING_STATUSES)[number];

export interface CalendarExternalEvent {
    id: string;
    barberId?: string;
    summary: string;
    service?: string;
    clientName?: string | null;
    attendee?: string | null;
    start: string;
    end: string;
    date: string;
    time: string;
    htmlLink?: string | null;
    bookingId?: string | null;
}

export interface BookingCalendarMeta {
    eventId: string;
    summary: string;
    htmlLink: string | null;
    start: string;
    end: string;
}

export type LinkedCalendarByBookingId = Record<string, BookingCalendarMeta>;

export function bookingCalendarMetaFromGoogleEvent(event: {
    id: string;
    summary?: string | null;
    htmlLink?: string | null;
    start: string;
    end: string;
}): BookingCalendarMeta {
    return {
        eventId: event.id,
        summary: event.summary?.trim() || 'Appointment',
        htmlLink: event.htmlLink ?? null,
        start: event.start,
        end: event.end,
    };
}

export function mergeLinkedCalendarMeta(
    target: LinkedCalendarByBookingId,
    bookingId: string,
    meta: BookingCalendarMeta,
): void {
    const existing = target[bookingId];
    if (!existing || (meta.htmlLink && !existing.htmlLink)) {
        target[bookingId] = meta;
    }
}

export function linkedCalendarMetaToMap(
    linkedCalendarByBookingId: LinkedCalendarByBookingId | undefined,
): Map<string, BookingCalendarMeta> {
    return new Map(Object.entries(linkedCalendarByBookingId ?? {}));
}

export function mergeCalendarMetaMaps(
    ...sources: Array<Map<string, BookingCalendarMeta> | LinkedCalendarByBookingId | undefined>
): Map<string, BookingCalendarMeta> {
    const merged = new Map<string, BookingCalendarMeta>();
    for (const source of sources) {
        if (!source) continue;
        const entries = source instanceof Map
            ? Array.from(source.entries())
            : Object.entries(source);
        for (const [bookingId, meta] of entries) {
            const existing = merged.get(bookingId);
            if (!existing || (meta.htmlLink && !existing.htmlLink)) {
                merged.set(bookingId, meta);
            }
        }
    }
    return merged;
}

export interface CalendarDedupResult<T extends CalendarExternalEvent> {
    externalEvents: T[];
    calendarMetaByBookingId: Map<string, BookingCalendarMeta>;
}

export function servicesRoughMatch(a: string, b: string): boolean {
    const left = a.toLowerCase().trim();
    const right = b.toLowerCase().trim();
    if (!left || !right) return false;
    return left === right || left.includes(right) || right.includes(left);
}

function isCalendarVisibleBooking(booking: Pick<Booking, 'status'>): boolean {
    return CALENDAR_VISIBLE_BOOKING_STATUSES.includes(
        booking.status as CalendarVisibleBookingStatus,
    );
}

function bookingLinkedEventIds(booking: Pick<Booking, 'google_event_id' | 'shop_google_event_id'>): string[] {
    return [booking.google_event_id, booking.shop_google_event_id].filter(
        (id): id is string => Boolean(id),
    );
}

export function externalEventMatchesBooking(
    event: CalendarExternalEvent,
    booking: Booking,
    options: { requireBarberMatch?: boolean } = {},
): boolean {
    if (!isCalendarVisibleBooking(booking)) return false;
    if (booking.date !== event.date) return false;

    if (event.bookingId && event.bookingId === booking.id) return true;

    if (bookingLinkedEventIds(booking).includes(event.id)) return true;

    if (options.requireBarberMatch && event.barberId && booking.barber_id !== event.barberId) {
        return false;
    }

    const eventMins = timeToMins(event.time);
    const bookingMins = timeToMins(booking.time);
    const timeClose = Math.abs(bookingMins - eventMins) <= 22;
    if (!timeClose) return false;

    const eventService = event.service || extractServiceFromEventSummary(event.summary);
    const nameMatch = namesMatch(event.clientName ?? event.attendee, booking.client_name);
    const serviceMatch = servicesRoughMatch(eventService, booking.service);

    return (nameMatch && serviceMatch) || (nameMatch && timeClose) || (serviceMatch && timeClose);
}

export function findMatchingBookingForExternalEvent(
    event: CalendarExternalEvent,
    bookings: Booking[],
    options: { requireBarberMatch?: boolean } = {},
): Booking | null {
    return bookings.find(booking => externalEventMatchesBooking(event, booking, options)) ?? null;
}

export function dedupeExternalEventsAgainstBookings<T extends CalendarExternalEvent>(
    externalEvents: T[],
    bookings: Booking[],
    options: { requireBarberMatch?: boolean } = {},
): CalendarDedupResult<T> {
    const calendarMetaByBookingId = new Map<string, BookingCalendarMeta>();
    const visibleExternals: T[] = [];

    for (const event of externalEvents) {
        const matchedBooking = findMatchingBookingForExternalEvent(event, bookings, options);
        if (matchedBooking) {
            const existing = calendarMetaByBookingId.get(matchedBooking.id);
            if (!existing || (event.htmlLink && !existing.htmlLink)) {
                calendarMetaByBookingId.set(matchedBooking.id, {
                    eventId: event.id,
                    summary: event.summary,
                    htmlLink: event.htmlLink ?? null,
                    start: event.start,
                    end: event.end,
                });
            }
            continue;
        }
        visibleExternals.push(event);
    }

    return { externalEvents: visibleExternals, calendarMetaByBookingId };
}
