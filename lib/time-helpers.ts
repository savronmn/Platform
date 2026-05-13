// Shared time-slot utilities for the booking flow.
// Centralized so both BookingFlow and AsapBookingFlow stay consistent.

import { format, addDays, isSunday } from 'date-fns';
import { TIME_SLOTS } from './services-data';

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

// Returns the first date where at least one TIME_SLOT is still in the future.
// Skips Sundays (shop closed).
export function nextBookableDate(from: Date = new Date()): Date {
    let cursor = new Date(from);
    for (let i = 0; i < 14; i++) {
        if (!isSunday(cursor)) {
            const hasFutureSlot = TIME_SLOTS.some((t) => !isSlotInPast(cursor, t, 5));
            if (hasFutureSlot) return cursor;
        }
        cursor = addDays(cursor, 1);
    }
    return cursor;
}
