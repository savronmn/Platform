"use client";

import { cn } from '@/lib/utils';
import { format, addDays, isToday } from 'date-fns';
import { TIME_SLOTS } from '@/lib/services-data';
import { isSlotInPast } from '@/lib/time-helpers';

interface DatePickerProps {
    selected: Date;
    onChange: (date: Date) => void;
    daysAhead?: number;
}

export function DatePicker({ selected, onChange, daysAhead = 21 }: DatePickerProps) {
    const today = new Date();
    const days: Date[] = [];
    let cursor = new Date(today);
    while (days.length < daysAhead) {
        const isToday_ = isToday(cursor);
        const allSlotsPast = isToday_ && TIME_SLOTS.every((t) => isSlotInPast(cursor, t, 5));
        if (!allSlotsPast) days.push(new Date(cursor));
        cursor = addDays(cursor, 1);
    }

    return (
        <div className="overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth">
            <div className="flex gap-2.5 w-max">
                {days.map((day, i) => {
                    const isSelected =
                        format(day, 'yyyy-MM-dd') === format(selected, 'yyyy-MM-dd');
                    const todayFlag = isToday(day);
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onChange(day)}
                            aria-pressed={isSelected}
                            aria-label={`${todayFlag ? 'Today' : format(day, 'EEEE')}, ${format(day, 'MMMM d')}`}
                            className={cn(
                                "flex flex-col items-center justify-center w-[4.25rem] h-[4.5rem] border rounded-savron transition-all duration-300 shrink-0 touch-manipulation",
                                isSelected
                                    ? "border-savron-green bg-savron-green text-white"
                                    : "border-white/10 hover:border-white/30 text-savron-silver hover:text-white"
                            )}
                        >
                            <span className="text-[11px] uppercase tracking-widest font-medium">
                                {todayFlag ? "Today" : format(day, 'EEE')}
                            </span>
                            <span className="text-xl font-heading font-bold leading-none mt-0.5">
                                {format(day, 'd')}
                            </span>
                            <span className="text-[11px] uppercase tracking-wider opacity-75">
                                {format(day, 'MMM')}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
