import { timeToMins, time24ToMins } from '@/lib/calendar-timeline';
import { generateTimeSlots, TIME_SLOTS } from '@/lib/services-data';

export const BARBER_DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export type BarberDayKey = (typeof BARBER_DAY_KEYS)[number];
export type WorkingHours = Record<string, { open: string; close: string } | null> | null;

function dateAnchor(date: string | Date): Date {
    return typeof date === 'string' ? new Date(`${date}T12:00:00`) : date;
}

export function getBarberDayKey(date: string | Date): BarberDayKey {
    return BARBER_DAY_KEYS[dateAnchor(date).getDay()];
}

export function getBarberDaySchedule(
    workingHours: WorkingHours,
    date: string | Date,
): { open: string; close: string } | null {
    if (!workingHours) return null;
    return workingHours[getBarberDayKey(date)] ?? null;
}

/** True when the barber has a schedule configured and is off on this date. */
export function isBarberOffOnDate(workingHours: WorkingHours, date: string | Date): boolean {
    if (!workingHours) return false;
    return getBarberDaySchedule(workingHours, date) === null;
}

/** Bookable slots for a barber on a date. Empty when off. Falls back to shop hours when unset. */
export function getBarberSlotsForDate(
    workingHours: WorkingHours,
    date: string | Date,
    intervalMin = 45,
): string[] {
    const schedule = getBarberDaySchedule(workingHours, date);
    if (workingHours) {
        if (!schedule) return [];
        return generateTimeSlots(schedule.open, schedule.close, intervalMin);
    }
    return [...TIME_SLOTS];
}

export function isBarberAvailableAtTime(
    workingHours: WorkingHours,
    date: string,
    time: string,
    durationMin: number,
): boolean {
    const schedule = getBarberDaySchedule(workingHours, date);
    const openMins = schedule ? time24ToMins(schedule.open) : time24ToMins('10:00');
    const closeMins = schedule ? time24ToMins(schedule.close) : time24ToMins('19:00');

    if (workingHours && !schedule) return false;

    const start = timeToMins(time);
    const end = start + durationMin;
    return start >= openMins && end <= closeMins;
}
