import { HOST_TIME_SLOTS } from './services-data';

/** Target vertical space per hour on the day timeline (px). */
export const CALENDAR_HOUR_HEIGHT_PX = 150;

/** Pixels per minute — linear time scale for exact event placement. */
export const CALENDAR_PX_PER_MIN = CALENDAR_HOUR_HEIGHT_PX / 60;

/** Interval between HOST_TIME_SLOTS entries (minutes). */
export const CALENDAR_SLOT_INTERVAL_MINS = 45;

/** Height in px of each 45-min grid row (week view slot rows). */
export const CALENDAR_ROW_HEIGHT_PX = Math.round(
    CALENDAR_HOUR_HEIGHT_PX * (CALENDAR_SLOT_INTERVAL_MINS / 60),
);

/** Minimum rendered block height so short appointments stay readable. */
export const CALENDAR_MIN_EVENT_HEIGHT_PX = Math.round(CALENDAR_HOUR_HEIGHT_PX * (15 / 60));

/** Convert a 12-hour time string ("10:00 AM") to minutes since midnight. */
export function timeToMins(timeStr: string): number {
    const trimmed = timeStr.trim();
    const [timePart, mer] = trimmed.split(' ');
    let [h, m] = timePart.split(':').map(Number);
    if (mer === 'PM' && h !== 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    return h * 60 + m;
}

/** Shop day bounds for the host timeline (minutes since midnight). */
export const CALENDAR_GRID_OPEN_MINS = timeToMins(HOST_TIME_SLOTS[0]);
export const CALENDAR_GRID_CLOSE_MINS = 21 * 60; // 9:00 PM

/** Convert a 24-hour time string ("10:00") to minutes since midnight. */
export function time24ToMins(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

/** Convert minutes since midnight to a 12-hour label ("10:00 AM"). */
export function minsToTime12(mins: number): string {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h24 < 12 ? 'AM' : 'PM';
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Parse minutes from an ISO datetime without browser timezone conversion. */
export function isoToMins(iso: string): number {
    const match = iso.match(/T(\d{2}):(\d{2})/);
    if (!match) return 0;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (iso.endsWith('Z')) h = (h - 5 + 24) % 24;
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

/** Format a start time + duration as a compact range ("10am – 10:45am"). */
export function formatTimeRange(startTime: string, durationMins: number): string {
    const start = formatTimeCompact(startTime);
    const end = formatTimeCompact(minsToTime12(timeToMins(startTime) + durationMins));
    return `${start} – ${end}`;
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

/** Compute the shared calendar grid bounds on a linear time scale. */
export function getCalendarGridBounds(): CalendarGridBounds {
    const startMins = CALENDAR_GRID_OPEN_MINS;
    const endMins = CALENDAR_GRID_CLOSE_MINS;
    const totalMins = endMins - startMins;
    const totalHeightPx = totalMins * CALENDAR_PX_PER_MIN;
    const slotCount = HOST_TIME_SLOTS.length;
    return {
        startMins,
        endMins,
        totalMins,
        totalHeightPx,
        slotCount,
    };
}

/** Convert a clock time to a Y offset within the timeline grid. */
export function minsToPx(minsSinceMidnight: number, gridStartMins?: number): number {
    const gridStart = gridStartMins ?? getCalendarGridBounds().startMins;
    return (minsSinceMidnight - gridStart) * CALENDAR_PX_PER_MIN;
}

/** Convert a duration in minutes to pixel height. */
export function durationToPx(durationMins: number): number {
    return durationMins * CALENDAR_PX_PER_MIN;
}

export interface TimelineGridLine {
    mins: number;
    isHour: boolean;
}

/** Hour and half-hour grid lines for the day timeline. */
export function getTimelineGridLines(): TimelineGridLine[] {
    const { startMins, endMins } = getCalendarGridBounds();
    const lines: TimelineGridLine[] = [];
    const firstLine = Math.ceil(startMins / 30) * 30;
    for (let mins = firstLine; mins <= endMins; mins += 30) {
        lines.push({ mins, isHour: mins % 60 === 0 });
    }
    return lines;
}

/** Hour start times for week-view rows (one row per clock hour). */
export function getCalendarHourStarts(): number[] {
    const hours: number[] = [];
    for (let mins = CALENDAR_GRID_OPEN_MINS; mins < CALENDAR_GRID_CLOSE_MINS; mins += 60) {
        hours.push(mins);
    }
    return hours;
}

export interface TimelineLayout {
    topPx: number;
    heightPx: number;
}

/**
 * Compute absolute top/height (px) for an event within the shared calendar grid.
 * Position is proportional to actual start time and duration on a linear scale.
 */
export function getTimelineLayout(startMins: number, durationMins: number): TimelineLayout {
    const { startMins: gridStart } = getCalendarGridBounds();
    const clampedStart = Math.max(startMins, gridStart);
    const topPx = minsToPx(clampedStart, gridStart);
    const heightPx = Math.max(durationToPx(durationMins), CALENDAR_MIN_EVENT_HEIGHT_PX);
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

/** Filter items that start within a clock-hour row [hourMins, hourMins + 60). */
export function itemsInHour<T>(
    items: T[],
    hourMins: number,
    getStartMins: (item: T) => number,
): T[] {
    const hourEnd = hourMins + 60;
    return items.filter(item => {
        const m = getStartMins(item);
        return m >= hourMins && m < hourEnd;
    });
}
