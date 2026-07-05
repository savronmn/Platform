"use client";

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { HOST_TIME_SLOTS } from '@/lib/services-data';
import {
    CALENDAR_ROW_HEIGHT_PX,
    getCalendarGridBounds,
    getTimelineLayout,
    timeToMins,
    parseDurationMins,
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
    timeLabelWidth = 'w-20 sm:w-24',
    columnWidth = 'min-w-[300px] sm:min-w-[360px]',
}: TimelineDayGridProps) {
    const { totalHeightPx } = getCalendarGridBounds();

    return (
        <div className="min-w-max bg-savron-black">
            {/* Column headers */}
            <div className="flex border-b border-white/10 bg-savron-grey sticky top-0 z-10 shadow-lg shadow-black/20">
                <div className={cn(timeLabelWidth, 'shrink-0 p-3 sm:p-4 border-r border-white/10 sticky left-0 z-20 bg-savron-grey')}>
                    <span className="text-[10px] uppercase tracking-widest text-savron-silver/50">Time</span>
                </div>
                {columns.map(col => (
                    <div
                        key={col.id}
                        className={cn(columnWidth, 'shrink-0 p-3 sm:p-4 border-r border-white/10')}
                    >
                        {col.header}
                    </div>
                ))}
            </div>

            {/* Timeline body */}
            <div className="flex">
                {/* Time labels — show hour marks prominently */}
                <div
                    className={cn(timeLabelWidth, 'shrink-0 border-r border-white/10 relative sticky left-0 z-10 bg-savron-black')}
                    style={{ height: totalHeightPx }}
                >
                    {HOST_TIME_SLOTS.map((time, i) => {
                        const isHour = time.includes(':00 ');
                        return (
                            <div
                                key={time}
                                className="absolute left-0 right-0 px-3 flex items-start"
                                style={{ top: i * CALENDAR_ROW_HEIGHT_PX, height: CALENDAR_ROW_HEIGHT_PX }}
                            >
                                {isHour ? (
                                    <span className="text-savron-silver/80 text-xs font-mono whitespace-nowrap leading-none -mt-1">
                                        {time}
                                    </span>
                                ) : (
                                    <span className="text-savron-silver/30 text-[10px] font-mono whitespace-nowrap leading-none -mt-0.5">
                                        {time.replace(':00 ', ' ')}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Event columns */}
                {columns.map(col => (
                    <div
                        key={col.id}
                        className={cn(columnWidth, 'shrink-0 border-r border-white/10 relative bg-savron-black')}
                        style={{ height: totalHeightPx }}
                    >
                        {/* Grid lines */}
                        {HOST_TIME_SLOTS.map((time, i) => {
                            const isHour = time.includes(':00 ');
                            return (
                                <div
                                    key={time}
                                    className={cn(
                                        'absolute left-0 right-0 border-b',
                                        isHour ? 'border-white/10' : 'border-white/[0.05]',
                                        i % 2 !== 0 && 'bg-white/[0.015]',
                                    )}
                                    style={{ top: i * CALENDAR_ROW_HEIGHT_PX, height: CALENDAR_ROW_HEIGHT_PX }}
                                />
                            );
                        })}

                        {renderColumnBackground?.(col.id)}

                        {getEventsForColumn(col.id).map(event => {
                            const layout = getTimelineLayout(event.startMins, event.durationMins);
                            if (layout.heightPx <= 0) return null;
                            return (
                                <div
                                    key={event.id}
                                    className="absolute z-[1] overflow-hidden px-1.5"
                                    style={{
                                        top: layout.topPx,
                                        height: layout.heightPx,
                                        left: 0,
                                        right: 0,
                                    }}
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
        durationMins: parseDurationMins(duration),
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
