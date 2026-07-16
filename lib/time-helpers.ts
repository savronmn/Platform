// Shared time-slot utilities for the booking flow.
// Centralized so both BookingFlow and AsapBookingFlow stay consistent.

import { format, addDays } from 'date-fns';
import { chicagoSlotToMs } from './chicago-time';
import { TIME_SLOTS, getShopScheduleForDate, generateTimeSlots } from './services-data';

export function slotToMs(date: Date, timeStr: string): number {
    const dateStr = format(date, 'yyyy-MM-dd');
    return chicagoSlotToMs(dateStr, timeStr);
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
            ? generateTimeSlots(schedule.open, schedule.close, 45)
            : TIME_SLOTS;
        const hasFutureSlot = slots.some((t) => !isSlotInPast(cursor, t, 5));
        if (hasFutureSlot) return cursor;
        cursor = addDays(cursor, 1);
    }
    return cursor;
}
