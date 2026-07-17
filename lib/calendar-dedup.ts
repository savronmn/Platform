import type { Booking } from '@/lib/types';
import {
    extractClientNameFromEvent,
    extractSavronBookingId,
    extractServiceFromEventSummary,
    isoDateTimeToTimeSlot,
    namesMatch,
    type CalendarSyncEvent,
} from '@/lib/calendar-event-sync';
import { parseDurationMins, isoToMins, rangesOverlapMins, timeToMins } from '@/lib/calendar-timeline';

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
    savronBookingId?: string | null;
}

export interface BookingCalendarMeta {
    eventId: string;
    summary: string;
    htmlLink: string | null;
    start: string;
    end: string;
}

export type LinkedCalendarByBookingId = Record<string, BookingCalendarMeta>;

export type CalendarBookingForDedup = Pick<
    Booking,
    | 'id'
    | 'google_event_id'
    | 'shop_google_event_id'
    | 'barber_id'
    | 'status'
    | 'date'
    | 'time'
    | 'service'
    | 'client_name'
    | 'duration'
>;

export type GoogleCalendarRawEvent = CalendarSyncEvent & {
    htmlLink?: string | null;
    end?: { dateTime?: string };
};

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

export function isSavronManagedEventSummary(summary: string | null | undefined): boolean {
    const trimmed = (summary ?? '').trim();
    if (!trimmed) return false;
    return /^✂️/.test(trimmed)
        || /\s·\s*SAVRON\b/i.test(trimmed)
        || /\s·\s*Savron\b/.test(trimmed);
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

function bookingDurationMins(booking: Pick<Booking, 'duration'>): number {
    return parseDurationMins(booking.duration ?? null) || 45;
}

function externalEventDurationMins(event: Pick<CalendarExternalEvent, 'start' | 'end'>): number {
    const start = isoToMins(event.start);
    const end = isoToMins(event.end);
    return Math.max(end - start, 15);
}

function eventBookingTimesAlign(
    event: CalendarExternalEvent,
    booking: Pick<Booking, 'date' | 'time' | 'duration'>,
): boolean {
    if (booking.date !== event.date) return false;

    const eventMins = timeToMins(event.time);
    const bookingMins = timeToMins(booking.time);
    if (Math.abs(bookingMins - eventMins) <= 22) return true;

    return rangesOverlapMins(
        isoToMins(event.start),
        externalEventDurationMins(event),
        bookingMins,
        bookingDurationMins(booking),
    );
}

function barberIdsAlign(
    event: CalendarExternalEvent,
    booking: Pick<Booking, 'barber_id'>,
    options: { requireBarberMatch?: boolean },
): boolean {
    if (!options.requireBarberMatch) return true;
    if (!event.barberId || !booking.barber_id) return true;
    return booking.barber_id === event.barberId;
}

export function externalEventMatchesBooking(
    event: CalendarExternalEvent,
    booking: Booking,
    options: { requireBarberMatch?: boolean } = {},
): boolean {
    if (!isCalendarVisibleBooking(booking)) return false;
    if (booking.date !== event.date) return false;
    if (!barberIdsAlign(event, booking, options)) return false;

    if (event.bookingId && event.bookingId === booking.id) return true;
    if (event.savronBookingId && event.savronBookingId === booking.id) return true;
    if (bookingLinkedEventIds(booking).includes(event.id)) return true;

    if (!eventBookingTimesAlign(event, booking)) return false;

    if (isSavronManagedEventSummary(event.summary)) return true;

    const eventService = event.service || extractServiceFromEventSummary(event.summary);
    const nameMatch = namesMatch(event.clientName ?? event.attendee, booking.client_name);
    const serviceMatch = servicesRoughMatch(eventService, booking.service);

    return nameMatch || serviceMatch;
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

export function mapGoogleEventToExternal(
    raw: GoogleCalendarRawEvent,
    barber: { id: string; name: string },
): CalendarExternalEvent {
    const start = raw.start!.dateTime!;
    const end = raw.end?.dateTime ?? start;
    const summary = raw.summary?.trim() || 'Appointment';
    const clientName = extractClientNameFromEvent(raw);

    return {
        id: raw.id!,
        barberId: barber.id,
        summary,
        service: extractServiceFromEventSummary(summary),
        clientName,
        attendee: clientName,
        start,
        end,
        date: start.slice(0, 10),
        time: isoDateTimeToTimeSlot(start),
        htmlLink: raw.htmlLink ?? null,
        bookingId: extractSavronBookingId(raw),
        savronBookingId: extractSavronBookingId(raw),
    };
}

function dedupeExternalEventSlots<T extends CalendarExternalEvent>(
    events: T[],
    slotKey: (event: T) => string,
): T[] {
    const slotMap = new Map<string, T>();
    for (const event of events) {
        const key = slotKey(event);
        const existing = slotMap.get(key);
        if (!existing) {
            slotMap.set(key, event);
            continue;
        }
        if (event.clientName && !existing.clientName) slotMap.set(key, event);
    }
    return Array.from(slotMap.values());
}

function dedupeExternalEventsGlobally<T extends CalendarExternalEvent>(events: T[]): T[] {
    const globalSeen = new Map<string, T>();
    for (const event of events) {
        const normalName = (event.clientName ?? event.summary).toLowerCase().trim().replace(/\s+/g, ' ');
        const globalKey = `${normalName}|${event.date}|${event.time}|${event.barberId ?? ''}`;
        const existing = globalSeen.get(globalKey);
        if (!existing) {
            globalSeen.set(globalKey, event);
            continue;
        }
        if (event.clientName && !existing.clientName) globalSeen.set(globalKey, event);
    }
    return Array.from(globalSeen.values());
}

export function resolveLinkedBookingIdForGoogleEvent(
    raw: GoogleCalendarRawEvent,
    mapped: CalendarExternalEvent,
    bookings: CalendarBookingForDedup[],
    options: { requireBarberMatch?: boolean } = {},
): string | null {
    const visibleBookings = bookings.filter(isCalendarVisibleBooking);

    if (mapped.bookingId && visibleBookings.some(booking => booking.id === mapped.bookingId)) {
        return mapped.bookingId;
    }

    if (mapped.savronBookingId && visibleBookings.some(booking => booking.id === mapped.savronBookingId)) {
        return mapped.savronBookingId;
    }

    if (raw.id) {
        const byStoredId = visibleBookings.find(booking => bookingLinkedEventIds(booking).includes(raw.id!));
        if (byStoredId) return byStoredId.id;
    }

    const fuzzyMatch = findMatchingBookingForExternalEvent(mapped, visibleBookings as Booking[], options);
    return fuzzyMatch?.id ?? null;
}

export function processGoogleCalendarEventsForDisplay(
    rawEvents: GoogleCalendarRawEvent[],
    bookings: CalendarBookingForDedup[],
    barber: { id: string; name: string },
    options: { requireBarberMatch?: boolean } = {},
): { externalEvents: CalendarExternalEvent[]; linkedCalendarByBookingId: LinkedCalendarByBookingId } {
    const linkedCalendarByBookingId: LinkedCalendarByBookingId = {};
    const externalCandidates: CalendarExternalEvent[] = [];
    const consumedEventIds = new Set<string>();

    for (const raw of rawEvents) {
        if (!raw.id || raw.status === 'cancelled' || !raw.start?.dateTime) continue;
        if (consumedEventIds.has(raw.id)) continue;

        const mapped = mapGoogleEventToExternal(raw, barber);
        const linkedBookingId = resolveLinkedBookingIdForGoogleEvent(raw, mapped, bookings, options);

        if (linkedBookingId) {
            mergeLinkedCalendarMeta(
                linkedCalendarByBookingId,
                linkedBookingId,
                bookingCalendarMetaFromGoogleEvent({
                    id: raw.id,
                    summary: raw.summary ?? null,
                    htmlLink: raw.htmlLink ?? null,
                    start: mapped.start,
                    end: mapped.end,
                }),
            );
            consumedEventIds.add(raw.id);
            continue;
        }

        externalCandidates.push({ ...mapped, bookingId: null });
        consumedEventIds.add(raw.id);
    }

    const slotDeduped = dedupeExternalEventSlots(
        externalCandidates,
        event => `${event.barberId ?? ''}|${event.date}|${event.time}`,
    );
    const externalEvents = dedupeExternalEventsGlobally(slotDeduped);

    return { externalEvents, linkedCalendarByBookingId };
}

export function googleBusyOverlapsBooking(
    block: { start: string; end: string },
    booking: Pick<Booking, 'date' | 'time' | 'duration'>,
): boolean {
    const blockDate = block.start.slice(0, 10);
    if (blockDate !== booking.date) return false;

    return rangesOverlapMins(
        isoToMins(block.start),
        externalEventDurationMins({ start: block.start, end: block.end }),
        timeToMins(booking.time),
        bookingDurationMins(booking),
    );
}

export function filterGoogleBusyAgainstBookings<T extends { start: string; end: string }>(
    busyBlocks: T[],
    bookings: Pick<Booking, 'date' | 'time' | 'duration'>[],
): T[] {
    return busyBlocks.filter(block => {
        const blockDate = block.start.slice(0, 10);
        const dayBookings = bookings.filter(booking => booking.date === blockDate);
        return !dayBookings.some(booking => googleBusyOverlapsBooking(block, booking));
    });
}
