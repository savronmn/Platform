import { HOST_TIME_SLOTS } from './services-data';

/** Target vertical space per hour on the day timeline (px). */
export const CALENDAR_HOUR_HEIGHT_PX = 250;

/** Interval between HOST_TIME_SLOTS entries (minutes). */
export const CALENDAR_SLOT_INTERVAL_MINS = 45;

/** Height in px of each grid row — derived so each hour spans CALENDAR_HOUR_HEIGHT_PX. */
export const CALENDAR_ROW_HEIGHT_PX = Math.round(
    CALENDAR_HOUR_HEIGHT_PX * (CALENDAR_SLOT_INTERVAL_MINS / 60),
);

/** Minimum rendered block height so short appointments stay readable. */
export const CALENDAR_MIN_EVENT_HEIGHT_PX = Math.round(CALENDAR_HOUR_HEIGHT_PX * (15 / 60));

/** Convert a 12-hour time string ("10:00 AM") to minutes since midnight. */
export function timeToMins(timeStr: string): number {
    const [timePart, mer] = timeStr.split(' ');
    let [h, m] = timePart.split(':').map(Number);
    if (mer === 'PM' && h !== 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return h * 60 + m;
}

/** Convert a 24-hour time string ("10:00") to minutes since midnight. */
export function time24ToMins(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

/** Format "10:00 AM" → "10am", "1:30 PM" → "1:30pm" for compact display. */
export function formatTimeCompact(timeStr: string | null | undefined): string {
    if (!timeStr) return '';
    const [timePart, mer] = timeStr.split(' ');
    const [, m] = timePart.split(':').map(Number);
    const hPart = timePart.split(':')[0];
    const suffix = (mer ?? '').toLowerCase();
    return m === 0 ? `${hPart}${suffix}` : `${hPart}:${String(m).padStart(2, '0')}${suffix}`;
}

/** Parse a duration string ("45 min", "1 hour") into minutes. */
export function parseDurationMins(duration: string | null | undefined, defaultMins = 45): number {
    if (!duration) return defaultMins;
    const match = duration.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : defaultMins;
}

export interface CalendarGridBounds {
    startMins: number;
    endMins: number;
    totalMins: number;
    totalHeightPx: number;
    slotCount: number;
}

/** Compute the shared calendar grid bounds derived from HOST_TIME_SLOTS. */
export function getCalendarGridBounds(): CalendarGridBounds {
    const startMins = timeToMins(HOST_TIME_SLOTS[0]);
    const lastSlotMins = timeToMins(HOST_TIME_SLOTS[HOST_TIME_SLOTS.length - 1]);
    const endMins = lastSlotMins + CALENDAR_SLOT_INTERVAL_MINS;
    const totalMins = endMins - startMins;
    const totalHeightPx = HOST_TIME_SLOTS.length * CALENDAR_ROW_HEIGHT_PX;
    return {
        startMins,
        endMins,
        totalMins,
        totalHeightPx,
        slotCount: HOST_TIME_SLOTS.length,
    };
}

export interface TimelineLayout {
    topPx: number;
    heightPx: number;
}

/**
 * Compute absolute top/height (px) for an event within the shared calendar grid.
 * Position is proportional to actual start time and duration.
 */
export function getTimelineLayout(startMins: number, durationMins: number): TimelineLayout {
    const { startMins: gridStart, totalMins, totalHeightPx } = getCalendarGridBounds();
    const clampedStart = Math.max(startMins, gridStart);
    const topPx = ((clampedStart - gridStart) / totalMins) * totalHeightPx;
    const heightPx = Math.max((durationMins / totalMins) * totalHeightPx, CALENDAR_MIN_EVENT_HEIGHT_PX);
    return { topPx, heightPx };
}

/** Whether an event overlaps a slot range [lo, hi). */
export function eventOverlapsSlot(
    eventStartMins: number,
    eventDurationMins: number,
    slotLoMins: number,
    slotHiMins: number,
): boolean {
    const eventEnd = eventStartMins + eventDurationMins;
    return eventStartMins < slotHiMins && eventEnd > slotLoMins;
}

/** Precomputed minute values for each HOST_TIME_SLOTS entry. */
export const SLOT_MINS = HOST_TIME_SLOTS.map(timeToMins);

/** Get [lo, hi) minute bounds for a slot index. */
export function slotBounds(slotIdx: number): { lo: number; hi: number } {
    const lo = SLOT_MINS[slotIdx];
    const hi = slotIdx + 1 < SLOT_MINS.length ? SLOT_MINS[slotIdx + 1] : lo + CALENDAR_SLOT_INTERVAL_MINS;
    return { lo, hi };
}

/** Filter items whose start time falls within [lo, hi) — legacy bucket helper for week view. */
export function itemsInSlot<T>(
    items: T[],
    slotIdx: number,
    getStartMins: (item: T) => number,
): T[] {
    const { lo, hi } = slotBounds(slotIdx);
    return items.filter(item => {
        const m = getStartMins(item);
        return m >= lo && m < hi;
    });
}
