import {
    addDays,
    addMonths,
    addWeeks,
    format,
    isSunday,
    isToday,
    startOfWeek,
    endOfWeek,
    subDays,
    subMonths,
    subWeeks,
} from 'date-fns';

export type CalendarView = 'day' | 'week' | 'month';

export function shiftCalendarDate(
    date: Date,
    view: CalendarView,
    direction: -1 | 1,
    options?: { skipSundays?: boolean; weekStartsOn?: 0 | 1 },
): Date {
    const weekStartsOn = options?.weekStartsOn ?? 1;
    const skipSundays = options?.skipSundays ?? false;

    if (view === 'day') {
        let next = direction === 1 ? addDays(date, 1) : subDays(date, 1);
        if (skipSundays) {
            while (isSunday(next)) {
                next = direction === 1 ? addDays(next, 1) : subDays(next, 1);
            }
        }
        return next;
    }

    if (view === 'week') {
        return direction === 1 ? addWeeks(date, 1) : subWeeks(date, 1);
    }

    return direction === 1 ? addMonths(date, 1) : subMonths(date, 1);
}

export function getCalendarNavTitle(
    date: Date,
    view: CalendarView,
    options?: { weekStartsOn?: 0 | 1; todayLabel?: string },
): { primary: string; secondary?: string } {
    const weekStartsOn = options?.weekStartsOn ?? 1;
    const todayLabel = options?.todayLabel ?? 'Today';

    if (view === 'day') {
        const primary = isToday(date) ? todayLabel : format(date, 'EEEE');
        return {
            primary,
            secondary: format(date, 'MMMM d, yyyy'),
        };
    }

    if (view === 'week') {
        const ws = startOfWeek(date, { weekStartsOn });
        const we = endOfWeek(date, { weekStartsOn });
        const sameMonth = format(ws, 'MMM') === format(we, 'MMM');
        return {
            primary: sameMonth
                ? format(ws, 'MMMM yyyy')
                : `${format(ws, 'MMM')} – ${format(we, 'MMM yyyy')}`,
            secondary: `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`,
        };
    }

    return {
        primary: format(date, 'MMMM yyyy'),
    };
}
