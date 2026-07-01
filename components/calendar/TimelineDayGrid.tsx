"use client";

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { HOST_TIME_SLOTS } from '@/lib/services-data';
import {
    CALENDAR_ROW_HEIGHT_PX,
    getCalendarGridBounds,
    getTimelineLayout,
    timeToMins,
} from '@/lib/calendar-timeline';

export interface TimelineEvent {
    id: string;
    startMins: number;
    durationMins: number;
}

export interface TimelineColumn {
    id: string;
    header: ReactNode;
}

interface TimelineDayGridProps {
    columns: TimelineColumn[];
    getEventsForColumn: (columnId: string) => TimelineEvent[];
    renderEvent: (event: TimelineEvent, columnId: string, layout: { topPx: number; heightPx: number }) => ReactNode;
    /** Optional background overlays per column (e.g. outside-hours shading). */
    renderColumnBackground?: (columnId: string) => ReactNode;
    timeLabelWidth?: string;
    columnWidth?: string;
}

/**
 * Shared proportional day-view timeline grid used by host and admin barber calendars.
 * Events are positioned by actual start time and duration, not snapped to discrete rows.
 */
export default function TimelineDayGrid({
    columns,
    getEventsForColumn,
    renderEvent,
    renderColumnBackground,
    timeLabelWidth = 'w-14 sm:w-20',
    columnWidth = 'w-40 sm:w-52',
}: TimelineDayGridProps) {
    const { totalHeightPx } = getCalendarGridBounds();

    return (
        <div className="min-w-max">
            {/* Column headers */}
            <div className="flex border-b border-white/5 bg-savron-grey sticky top-0 z-10">
                <div className={cn(timeLabelWidth, 'shrink-0 p-2 sm:p-4 border-r border-white/5')}>
                    <span className="text-[10px] uppercase tracking-widest text-savron-silver/40">Time</span>
                </div>
                {columns.map(col => (
                    <div
                        key={col.id}
                        className={cn(columnWidth, 'shrink-0 p-3 sm:p-4 border-r border-white/5')}
                    >
                        {col.header}
                    </div>
                ))}
            </div>

            {/* Timeline body */}
            <div className="flex">
                {/* Time labels */}
                <div className={cn(timeLabelWidth, 'shrink-0 border-r border-white/5 relative')}
                    style={{ height: totalHeightPx }}
                >
                    {HOST_TIME_SLOTS.map((time, i) => (
                        <div
                            key={time}
                            className="absolute left-0 right-0 px-2 flex items-start"
                            style={{ top: i * CALENDAR_ROW_HEIGHT_PX, height: CALENDAR_ROW_HEIGHT_PX }}
                        >
                            <span className="text-savron-silver/50 text-[9px] font-mono whitespace-nowrap -mt-1.5">
                                {time}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Event columns */}
                {columns.map(col => (
                    <div
                        key={col.id}
                        className={cn(columnWidth, 'shrink-0 border-r border-white/5 relative')}
                        style={{ height: totalHeightPx }}
                    >
                        {/* Grid lines */}
                        {HOST_TIME_SLOTS.map((time, i) => (
                            <div
                                key={time}
                                className={cn(
                                    'absolute left-0 right-0 border-b border-white/[0.05]',
                                    i % 2 !== 0 && 'bg-white/[0.01]',
                                )}
                                style={{ top: i * CALENDAR_ROW_HEIGHT_PX, height: CALENDAR_ROW_HEIGHT_PX }}
                            />
                        ))}

                        {/* Optional background overlays */}
                        {renderColumnBackground?.(col.id)}

                        {/* Events positioned proportionally */}
                        {getEventsForColumn(col.id).map(event => {
                            const layout = getTimelineLayout(event.startMins, event.durationMins);
                            return (
                                <div
                                    key={event.id}
                                    className="absolute left-0.5 right-0.5 z-[1] overflow-hidden"
                                    style={{ top: layout.topPx, height: layout.heightPx }}
                                >
                                    {renderEvent(event, col.id, layout)}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Helper to build a TimelineEvent from a booking-like object. */
export function bookingToTimelineEvent(
    id: string,
    time: string,
    duration: string | null | undefined,
): TimelineEvent {
    return {
        id,
        startMins: timeToMins(time),
        durationMins: (() => {
            if (!duration) return 45;
            const match = duration.match(/(\d+)/);
            return match ? parseInt(match[1], 10) : 45;
        })(),
    };
}

/** Helper to build a TimelineEvent from ISO start/end strings. */
export function isoRangeToTimelineEvent(id: string, startIso: string, endIso: string): TimelineEvent {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const startMins = start.getHours() * 60 + start.getMinutes();
    const durationMins = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    return { id, startMins, durationMins };
}
