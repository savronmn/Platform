"use client";

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
    getCalendarGridBounds,
    getTimelineGridLines,
    getTimelineLayout,
    getTimelineOverlapLayouts,
    minsToPx,
    minsToTime12,
    isoToMins,
    parseDurationMins,
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
    /** Larger, higher-contrast labels for host / kiosk displays. */
    emphasized?: boolean;
}

/**
 * Shared proportional day-view timeline grid used by host and admin barber calendars.
 * Events are positioned by actual start time and duration on a linear px-per-minute scale.
 */
export default function TimelineDayGrid({
    columns,
    getEventsForColumn,
    renderEvent,
    renderColumnBackground,
    timeLabelWidth,
    columnWidth = 'min-w-[300px] sm:min-w-[360px]',
    emphasized = false,
}: TimelineDayGridProps) {
    const { totalHeightPx, startMins } = getCalendarGridBounds();
    const gridLines = getTimelineGridLines();
    const resolvedTimeLabelWidth = timeLabelWidth ?? (emphasized ? 'w-28 sm:w-32' : 'w-20 sm:w-24');

    return (
        <div className="min-w-max bg-savron-black savron-grid-surface">
            {/* Column headers */}
            <div className="flex border-b border-savron-blue/20 bg-savron-grey sticky top-0 z-10 shadow-lg shadow-black/20">
                <div className={cn(resolvedTimeLabelWidth, 'shrink-0 p-3 sm:p-4 border-r border-savron-blue/15 sticky left-0 z-20 bg-savron-grey savron-grid-surface')}>
                    <span className={cn(
                        'uppercase tracking-widest font-semibold',
                        emphasized ? 'text-xs text-savron-silver/90' : 'text-[10px] text-savron-silver/40',
                    )}>Time</span>
                </div>
                {columns.map(col => (
                    <div
                        key={col.id}
                        className={cn(columnWidth, 'shrink-0 p-3 sm:p-4 border-r border-savron-blue/15')}
                    >
                        {col.header}
                    </div>
                ))}
            </div>

            {/* Timeline body */}
            <div className="flex">
                {/* Time labels at exact hour / half-hour positions */}
                <div
                    className={cn(resolvedTimeLabelWidth, 'shrink-0 border-r border-savron-blue/15 relative sticky left-0 z-10 bg-savron-black savron-grid-surface')}
                    style={{ height: totalHeightPx }}
                >
                    {gridLines.map(({ mins, isHour }) => (
                        <div
                            key={mins}
                            className="absolute left-0 right-0 px-3 flex items-start pointer-events-none"
                            style={{ top: minsToPx(mins, startMins) }}
                        >
                            {isHour ? (
                                <span className={cn(
                                    'font-mono whitespace-nowrap leading-none -mt-1 font-semibold',
                                    emphasized ? 'text-sm sm:text-base text-white' : 'text-xs text-savron-silver/80',
                                )}>
                                    {minsToTime12(mins)}
                                </span>
                            ) : (
                                <span className={cn(
                                    'font-mono whitespace-nowrap leading-none -mt-0.5',
                                    emphasized ? 'text-xs sm:text-sm text-savron-silver/75' : 'text-[10px] text-savron-silver/25',
                                )}>
                                    {minsToTime12(mins).replace(':00 ', ' ')}
                                </span>
                            )}
                        </div>
                    ))}
                </div>

                {/* Event columns */}
                {columns.map(col => (
                    <div
                        key={col.id}
                        className={cn(columnWidth, 'shrink-0 border-r border-savron-blue/15 relative bg-savron-black savron-grid-surface')}
                        style={{ height: totalHeightPx }}
                    >
                        {/* Grid lines at exact time positions */}
                        {gridLines.map(({ mins, isHour }) => (
                            <div
                                key={mins}
                                className={cn(
                                    'absolute left-0 right-0 border-b',
                                    isHour
                                        ? emphasized ? 'border-savron-blue/25' : 'border-savron-blue/20'
                                        : emphasized ? 'border-savron-blue/12' : 'border-savron-blue/10',
                                )}
                                style={{ top: minsToPx(mins, startMins) }}
                            />
                        ))}

                        {renderColumnBackground?.(col.id)}

                        {/* Events positioned proportionally with overlap lanes */}
                        {(() => {
                            const events = getEventsForColumn(col.id).sort((a, b) => a.startMins - b.startMins || a.id.localeCompare(b.id));
                            const overlapLayouts = getTimelineOverlapLayouts(events);

                            return events.map(event => {
                                const layout = getTimelineLayout(event.startMins, event.durationMins);
                                if (layout.heightPx <= 0) return null;
                                const overlap = overlapLayouts.get(event.id) ?? { lane: 0, laneCount: 1 };
                                const gutterPx = 6;
                                const widthPercent = 100 / overlap.laneCount;
                                return (
                                    <div
                                        key={event.id}
                                        className="absolute z-[1] overflow-hidden"
                                        style={{
                                            top: layout.topPx,
                                            height: layout.heightPx,
                                            left: `calc(${overlap.lane * widthPercent}% + ${gutterPx}px)`,
                                            width: `calc(${widthPercent}% - ${gutterPx + 4}px)`,
                                        }}
                                    >
                                        {renderEvent(event, col.id, layout)}
                                    </div>
                                );
                            });
                        })()}
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

/** Helper to build a TimelineEvent from ISO start/end strings (timezone-safe). */
export function isoRangeToTimelineEvent(id: string, startIso: string, endIso: string): TimelineEvent {
    const startMins = isoToMins(startIso);
    const endMins = isoToMins(endIso);
    let durationMins = endMins - startMins;
    if (durationMins <= 0) {
        durationMins = Math.max(15, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
    }
    return { id, startMins, durationMins: Math.max(15, durationMins) };
}
