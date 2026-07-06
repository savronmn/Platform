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

interface CalendarNavBarProps<V extends CalendarView = CalendarView> {
    view: V;
    onViewChange: (view: V) => void;
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    views?: readonly V[];
    weekStartsOn?: 0 | 1;
    skipSundays?: boolean;
    todayLabel?: string;
    viewLabels?: Partial<Record<CalendarView, string>>;
    className?: string;
    enableKeyboard?: boolean;
    /** Larger typography and kiosk-style centered layout for host view. */
    variant?: 'default' | 'host';
}

const DEFAULT_VIEWS = ['day', 'week', 'month'] as const satisfies readonly CalendarView[];

export default function CalendarNavBar<V extends CalendarView = CalendarView>({
    view,
    onViewChange,
    selectedDate,
    onDateChange,
    views = DEFAULT_VIEWS as unknown as readonly V[],
    weekStartsOn = 1,
    skipSundays = false,
    todayLabel = 'Today',
    viewLabels,
    className,
    enableKeyboard = true,
    variant = 'default',
}: CalendarNavBarProps<V>) {
    const isHost = variant === 'host';
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

    const todayButtonClass = cn(
        'shrink-0 rounded-full uppercase tracking-widest font-semibold border transition-all',
        isHost ? 'px-5 py-2.5 text-sm' : 'px-3.5 py-2 text-[11px] font-medium',
        onToday
            ? 'border-savron-blue/15 text-savron-silver/40 cursor-default'
            : 'border-savron-blue/40 text-white hover:bg-savron-blue/15 hover:text-white',
    );

    const navButtonClass = cn(
        'rounded-full text-savron-silver hover:text-white hover:bg-savron-blue/15 transition-colors',
        isHost ? 'p-3' : 'p-2',
    );

    const chevronClass = isHost ? 'w-5 h-5' : 'w-4 h-4';

    const dateNavCluster = (
        <div
            className={cn(
                'flex items-center justify-center gap-2 sm:gap-3 flex-wrap',
                isHost && 'rounded-full border border-white/15 bg-savron-black/50 px-4 py-2 shadow-lg shadow-black/20',
            )}
        >
            <button type="button" onClick={goToday} disabled={onToday} className={todayButtonClass}>
                {todayLabel}
            </button>

            <div className="flex items-center shrink-0">
                <button type="button" onClick={goPrev} className={navButtonClass} aria-label="Previous">
                    <ChevronLeft className={chevronClass} />
                </button>
                <button type="button" onClick={goNext} className={navButtonClass} aria-label="Next">
                    <ChevronRight className={chevronClass} />
                </button>
            </div>

            <div className="relative min-w-0" ref={pickerRef}>
                <button
                    type="button"
                    onClick={() => setPickerOpen(open => !open)}
                    className={cn(
                        'flex items-center gap-2 min-w-0 rounded-savron hover:bg-savron-blue/10 transition-colors text-center group',
                        isHost ? 'px-3 py-2' : 'px-2 py-1.5',
                    )}
                    aria-expanded={pickerOpen}
                    aria-haspopup="dialog"
                >
                    <div className="min-w-0">
                        <p className={cn(
                            'text-white font-heading uppercase tracking-wider truncate',
                            isHost ? 'text-lg sm:text-xl' : 'text-sm sm:text-base',
                        )}>
                            {primary}
                        </p>
                        {secondary && (
                            <p className={cn(
                                'uppercase tracking-widest truncate',
                                isHost ? 'text-savron-cream/70 text-xs sm:text-sm' : 'text-savron-cream/45 text-[10px]',
                            )}>
                                {secondary}
                            </p>
                        )}
                    </div>
                    <ChevronDown
                        className={cn(
                            'shrink-0 text-savron-silver/70 transition-transform',
                            isHost ? 'w-5 h-5' : 'w-4 h-4',
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
                            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 rounded-savron border border-savron-blue/25 bg-savron-charcoal shadow-2xl shadow-black/40 overflow-hidden"
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
    );

    const viewToggles = views.length > 1 && (
        <div className={cn(
            'flex justify-center rounded-full border bg-savron-black/40 p-1',
            isHost ? 'border-white/15 gap-1' : 'border-savron-blue/20',
        )}>
            {views.map(v => (
                <button
                    key={v}
                    type="button"
                    onClick={() => onViewChange(v)}
                    className={cn(
                        'rounded-full uppercase tracking-widest transition-all font-semibold',
                        isHost ? 'px-5 py-2 text-xs sm:text-sm' : 'px-3.5 py-1.5 text-[10px]',
                        view === v
                            ? 'bg-savron-blue text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                            : 'text-savron-silver hover:text-white hover:bg-savron-blue/10',
                    )}
                >
                    {labelForView(v)}
                </button>
            ))}
        </div>
    );

    return (
        <div
            className={cn(
                'flex flex-col items-center w-full',
                isHost ? 'gap-4 py-4' : 'gap-3 py-2.5',
                'bg-savron-grey border border-savron-blue/20 savron-grid-surface rounded-savron px-3 sm:px-4',
                className,
            )}
        >
            <div className="w-full flex justify-center">
                {dateNavCluster}
            </div>
            {viewToggles}
        </div>
    );
}
