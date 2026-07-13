// Shared time-slot utilities for the booking flow.
// Centralized so both BookingFlow and AsapBookingFlow stay consistent.

import { format, addDays } from 'date-fns';
import { TIME_SLOTS, BOOKING_SLOT_INTERVAL_MINS, getShopScheduleForDate, generateTimeSlots } from './services-data';

// Central Time (-05:00). TODO: replace with proper TZ handling (date-fns-tz) for DST safety.
const TZ_OFFSET = '-05:00';

export function slotToMs(date: Date, timeStr: string): number {
    const dateStr = format(date, 'yyyy-MM-dd');
    const [timePart, meridiem] = timeStr.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00${TZ_OFFSET}`).getTime();
}

export function isSlotInPast(date: Date, timeStr: string, bufferMinutes = 0): boolean {
    const slotMs = slotToMs(date, timeStr);
    return slotMs <= Date.now() + bufferMinutes * 60000;
}

/** True when a proposed appointment overlaps a busy block. Back-to-back slots are allowed (zero buffer). */
export function slotConflictsWithBusy(
    date: Date,
    timeStr: string,
    durationMin: number,
    busySlots: { start: string; end: string }[],
): boolean {
    const slotStart = slotToMs(date, timeStr);
    const slotEnd = slotStart + durationMin * 60000;
    return busySlots.some(busy => {
        const bStart = new Date(busy.start).getTime();
        const bEnd = new Date(busy.end).getTime();
        return slotStart < bEnd && slotEnd > bStart;
    });
}

// Returns the first date where at least one bookable slot is still in the future.
export function nextBookableDate(from: Date = new Date()): Date {
    let cursor = new Date(from);
    for (let i = 0; i < 14; i++) {
        const schedule = getShopScheduleForDate(cursor);
        const slots = schedule
            ? generateTimeSlots(schedule.open, schedule.close, BOOKING_SLOT_INTERVAL_MINS)
            : TIME_SLOTS;
        const hasFutureSlot = slots.some((t) => !isSlotInPast(cursor, t, 5));
        if (hasFutureSlot) return cursor;
        cursor = addDays(cursor, 1);
    }
    return cursor;
}
