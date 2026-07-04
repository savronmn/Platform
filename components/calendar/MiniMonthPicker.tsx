"use client";

import { useMemo, useState } from 'react';
import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameDay,
    isSameMonth,
    isToday,
    startOfMonth,
    startOfWeek,
    subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAY_LABELS_SUNDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const DAY_LABELS_MONDAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

interface MiniMonthPickerProps {
    selectedDate: Date;
    onSelect: (date: Date) => void;
    weekStartsOn?: 0 | 1;
    className?: string;
}

export default function MiniMonthPicker({
    selectedDate,
    onSelect,
    weekStartsOn = 0,
    className,
}: MiniMonthPickerProps) {
    const [visibleMonth, setVisibleMonth] = useState(startOfMonth(selectedDate));

    const dayLabels = weekStartsOn === 1 ? DAY_LABELS_MONDAY : DAY_LABELS_SUNDAY;

    const days = useMemo(() => {
        const monthStart = startOfMonth(visibleMonth);
        const monthEnd = endOfMonth(visibleMonth);
        const gridStart = startOfWeek(monthStart, { weekStartsOn });
        const gridEnd = endOfWeek(monthEnd, { weekStartsOn });
        return eachDayOfInterval({ start: gridStart, end: gridEnd });
    }, [visibleMonth, weekStartsOn]);

    return (
        <div className={cn('w-[280px] p-3 savron-grid-surface', className)}>
            <div className="flex items-center justify-between mb-3">
                <button
                    type="button"
                    onClick={() => setVisibleMonth(m => subMonths(m, 1))}
                    className="p-1.5 rounded-full text-savron-silver hover:text-white hover:bg-savron-blue/10 transition-colors"
                    aria-label="Previous month"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-sm font-heading uppercase tracking-wider text-white">
                    {format(visibleMonth, 'MMMM yyyy')}
                </p>
                <button
                    type="button"
                    onClick={() => setVisibleMonth(m => addMonths(m, 1))}
                    className="p-1.5 rounded-full text-savron-silver hover:text-white hover:bg-savron-blue/10 transition-colors"
                    aria-label="Next month"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
                {dayLabels.map((label, i) => (
                    <div
                        key={`${label}-${i}`}
                        className="text-center text-[10px] uppercase tracking-widest text-savron-cream/35 py-1"
                    >
                        {label}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
                {days.map(day => {
                    const inMonth = isSameMonth(day, visibleMonth);
                    const selected = isSameDay(day, selectedDate);
                    const today = isToday(day);

                    return (
                        <button
                            key={day.toISOString()}
                            type="button"
                            onClick={() => onSelect(day)}
                            className={cn(
                                'h-9 w-9 mx-auto rounded-full text-sm font-mono transition-all',
                                !inMonth && 'text-savron-silver/25 hover:text-savron-silver/45',
                                inMonth && !selected && !today && 'text-savron-cream/80 hover:bg-savron-blue/10',
                                today && !selected && 'text-savron-blue-light ring-1 ring-savron-blue/40',
                                selected && 'bg-savron-blue text-white shadow-[0_0_0_1px_rgba(26,106,138,0.35)]',
                            )}
                        >
                            {format(day, 'd')}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
