"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import {
    getCalendarNavTitle,
    shiftCalendarDate,
    type CalendarView,
} from '@/lib/calendar-nav';
import MiniMonthPicker from '@/components/calendar/MiniMonthPicker';

interface CalendarNavBarProps {
    view: CalendarView;
    onViewChange: (view: CalendarView) => void;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    views?: CalendarView[];
    weekStartsOn?: 0 | 1;
    skipSundays?: boolean;
    todayLabel?: string;
    viewLabels?: Partial<Record<CalendarView, string>>;
    className?: string;
    enableKeyboard?: boolean;
}

const DEFAULT_VIEWS: CalendarView[] = ['day', 'week', 'month'];

export default function CalendarNavBar({
    view,
    onViewChange,
    selectedDate,
    onDateChange,
    views = DEFAULT_VIEWS,
    weekStartsOn = 1,
    skipSundays = false,
    todayLabel = 'Today',
    viewLabels,
    className,
    enableKeyboard = true,
}: CalendarNavBarProps) {
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);
    const onToday = isToday(selectedDate);
    const { primary, secondary } = getCalendarNavTitle(selectedDate, view, { weekStartsOn, todayLabel });

    const goPrev = useCallback(
        () => onDateChange(shiftCalendarDate(selectedDate, view, -1, { skipSundays, weekStartsOn })),
        [onDateChange, selectedDate, view, skipSundays, weekStartsOn],
    );
    const goNext = useCallback(
        () => onDateChange(shiftCalendarDate(selectedDate, view, 1, { skipSundays, weekStartsOn })),
        [onDateChange, selectedDate, view, skipSundays, weekStartsOn],
    );
    const goToday = useCallback(() => onDateChange(new Date()), [onDateChange]);

    useEffect(() => {
        if (!pickerOpen) return;

        const onPointerDown = (event: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setPickerOpen(false);
            }
        };

        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [pickerOpen]);

    useEffect(() => {
        if (!enableKeyboard) return;

        const onKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;

            if (event.key === 't' || event.key === 'T') {
                event.preventDefault();
                goToday();
                return;
            }
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                goPrev();
                return;
            }
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                goNext();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enableKeyboard, goPrev, goNext, goToday]);

    const labelForView = (v: CalendarView) => viewLabels?.[v] ?? v;

    return (
        <div
            className={cn(
                'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
                'bg-savron-grey border border-savron-blue/20 savron-grid-surface rounded-savron px-3 py-2.5 sm:px-4',
                className,
            )}
        >
            <div className="flex items-center gap-2 min-w-0">
                <button
                    type="button"
                    onClick={goToday}
                    disabled={onToday}
                    className={cn(
                        'shrink-0 px-3.5 py-2 rounded-full text-[11px] uppercase tracking-widest font-medium border transition-all',
                        onToday
                            ? 'border-savron-blue/15 text-savron-silver/40 cursor-default'
                            : 'border-savron-blue/30 text-savron-cream/80 hover:bg-savron-blue/10 hover:text-white',
                    )}
                >
                    {todayLabel}
                </button>

                <div className="flex items-center shrink-0">
                    <button
                        type="button"
                        onClick={goPrev}
                        className="p-2 rounded-full text-savron-silver hover:text-white hover:bg-savron-blue/10 transition-colors"
                        aria-label="Previous"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={goNext}
                        className="p-2 rounded-full text-savron-silver hover:text-white hover:bg-savron-blue/10 transition-colors"
                        aria-label="Next"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="relative min-w-0" ref={pickerRef}>
                    <button
                        type="button"
                        onClick={() => setPickerOpen(open => !open)}
                        className="flex items-center gap-2 min-w-0 px-2 py-1.5 rounded-savron hover:bg-savron-blue/10 transition-colors text-left group"
                        aria-expanded={pickerOpen}
                        aria-haspopup="dialog"
                    >
                        <div className="min-w-0">
                            <p className="text-white font-heading text-sm sm:text-base uppercase tracking-wider truncate">
                                {primary}
                            </p>
                            {secondary && (
                                <p className="text-savron-cream/45 text-[10px] uppercase tracking-widest truncate">
                                    {secondary}
                                </p>
                            )}
                        </div>
                        <ChevronDown
                            className={cn(
                                'w-4 h-4 shrink-0 text-savron-silver/50 transition-transform',
                                pickerOpen && 'rotate-180 text-savron-blue-light',
                            )}
                        />
                    </button>

                    <AnimatePresence>
                        {pickerOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                transition={{ duration: 0.16 }}
                                className="absolute left-0 top-full mt-2 z-50 rounded-savron border border-savron-blue/25 bg-savron-charcoal shadow-2xl shadow-black/40 overflow-hidden"
                            >
                                <MiniMonthPicker
                                    selectedDate={selectedDate}
                                    weekStartsOn={weekStartsOn === 1 ? 1 : 0}
                                    onSelect={date => {
                                        onDateChange(date);
                                        setPickerOpen(false);
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {views.length > 1 && (
                <div className="flex self-end sm:self-auto rounded-full border border-savron-blue/20 bg-savron-black/40 p-1">
                    {views.map(v => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => onViewChange(v)}
                            className={cn(
                                'px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-widest transition-all',
                                view === v
                                    ? 'bg-savron-blue text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                                    : 'text-savron-silver hover:text-white hover:bg-savron-blue/10',
                            )}
                        >
                            {labelForView(v)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
