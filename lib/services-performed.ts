import { chicagoSlotToMs, CHICAGO_TZ } from '@/lib/chicago-time';
import { parseDurationMins } from '@/lib/booking-duration';

/** Historical services performed before live tracking in the app. */
export const SERVICES_PERFORMED_BASE = 7000;

/** SAVRON opened May 30, 2026 — only count bookings from this date onward. */
export const SHOP_OPEN_DATE = '2026-05-30';

export type ServicesPerformedBooking = {
    date: string;
    time: string;
    duration?: string | null;
    status: string;
};

/** Statuses that represent a service that happened (or likely happened if staff forgot check-in). */
export const COUNTED_SERVICE_STATUSES = ['confirmed', 'completed'] as const;

export function formatServicesPerformedCount(total: number): string {
    return `${total.toLocaleString('en-US')}+`;
}

export function servicesPerformedTotal(performedBookings: number): number {
    return SERVICES_PERFORMED_BASE + performedBookings;
}

export function chicagoTodayYmd(now = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: CHICAGO_TZ }).format(now);
}

/** When the appointment slot ends (start + duration). */
export function bookingServiceEndMs(
    booking: Pick<ServicesPerformedBooking, 'date' | 'time' | 'duration'>,
): number {
    const startMs = chicagoSlotToMs(booking.date, booking.time);
    const durationMin = parseDurationMins(booking.duration, 45);
    return startMs + durationMin * 60_000;
}

/** Count non-cancelled bookings once their scheduled service window has finished. */
export function isCountedService(
    booking: ServicesPerformedBooking,
    nowMs = Date.now(),
): boolean {
    if (booking.date < SHOP_OPEN_DATE) return false;
    if (!COUNTED_SERVICE_STATUSES.includes(booking.status as (typeof COUNTED_SERVICE_STATUSES)[number])) {
        return false;
    }
    return bookingServiceEndMs(booking) <= nowMs;
}

export function countPerformedServices(
    bookings: ServicesPerformedBooking[],
    nowMs = Date.now(),
): number {
    return bookings.filter(booking => isCountedService(booking, nowMs)).length;
}
