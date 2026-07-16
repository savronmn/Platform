/** America/Chicago helpers — correct CST/CDT offset per date (fixes summer availability bugs). */

export const CHICAGO_TZ = 'America/Chicago';

const OFFSET_CANDIDATES = ['-06:00', '-05:00'] as const;

function parseWallClock(time: string): { hours: number; minutes: number } {
    const [timePart, meridiem] = time.trim().split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return { hours, minutes };
}

function pad2(n: number): string {
    return String(n).padStart(2, '0');
}

/** Resolve -05:00 (CST) or -06:00 (CDT) for a Chicago local date/time. */
export function getChicagoOffsetForLocalTime(date: string, hours: number, minutes: number): string {
    for (const offset of OFFSET_CANDIDATES) {
        const iso = `${date}T${pad2(hours)}:${pad2(minutes)}:00${offset}`;
        const d = new Date(iso);
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: CHICAGO_TZ,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(d);

        const y = parts.find(p => p.type === 'year')?.value;
        const m = parts.find(p => p.type === 'month')?.value;
        const day = parts.find(p => p.type === 'day')?.value;
        const h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '-1', 10);
        const min = parseInt(parts.find(p => p.type === 'minute')?.value ?? '-1', 10);
        const [dy, dm, dd] = date.split('-');

        if (y === dy && m === dm && day === dd && h === hours && min === minutes) {
            return offset;
        }
    }

    return '-06:00';
}

/** ISO 8601 string for a Chicago wall-clock appointment time. */
export function toChicagoIsoString(date: string, time: string): string {
    const { hours, minutes } = parseWallClock(time);
    const offset = getChicagoOffsetForLocalTime(date, hours, minutes);
    return `${date}T${pad2(hours)}:${pad2(minutes)}:00${offset}`;
}

/** Start/end of a Chicago calendar day for Google Calendar API queries. */
export function chicagoDayBoundsIso(date: string): { timeMin: string; timeMax: string } {
    const startOffset = getChicagoOffsetForLocalTime(date, 0, 0);
    const endOffset = getChicagoOffsetForLocalTime(date, 23, 59);
    return {
        timeMin: `${date}T00:00:00${startOffset}`,
        timeMax: `${date}T23:59:59${endOffset}`,
    };
}

/** Milliseconds since epoch for a Chicago wall-clock slot. */
export function chicagoSlotToMs(date: string, time: string): number {
    return new Date(toChicagoIsoString(date, time)).getTime();
}
