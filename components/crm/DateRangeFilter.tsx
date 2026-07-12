"use client";

import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';

export interface DateRange {
    start: string;
    end: string;
}

interface DateRangeFilterProps {
    start: string;
    end: string;
    onChange: (range: DateRange) => void;
    className?: string;
}

function todayStr() {
    return format(new Date(), 'yyyy-MM-dd');
}

export function getDatePresets(): { id: string; label: string; getRange: () => DateRange }[] {
    const today = todayStr();
    return [
        { id: 'today', label: 'Today', getRange: () => ({ start: today, end: today }) },
        {
            id: 'yesterday',
            label: 'Yesterday',
            getRange: () => {
                const d = format(subDays(new Date(), 1), 'yyyy-MM-dd');
                return { start: d, end: d };
            },
        },
        {
            id: 'last7',
            label: 'Last 7 days',
            getRange: () => ({ start: format(subDays(new Date(), 6), 'yyyy-MM-dd'), end: today }),
        },
        {
            id: 'last30',
            label: 'Last 30 days',
            getRange: () => ({ start: format(subDays(new Date(), 29), 'yyyy-MM-dd'), end: today }),
        },
        {
            id: 'thisMonth',
            label: 'This month',
            getRange: () => ({
                start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
                end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
            }),
        },
        {
            id: 'lastMonth',
            label: 'Last month',
            getRange: () => {
                const prev = subMonths(new Date(), 1);
                return {
                    start: format(startOfMonth(prev), 'yyyy-MM-dd'),
                    end: format(endOfMonth(prev), 'yyyy-MM-dd'),
                };
            },
        },
        { id: 'allTime', label: 'All time', getRange: () => ({ start: '', end: '' }) },
    ];
}

function activePresetId(start: string, end: string): string | null {
    for (const preset of getDatePresets()) {
        const range = preset.getRange();
        if (range.start === start && range.end === end) return preset.id;
    }
    if (start || end) return 'custom';
    return 'allTime';
}

export function formatRangeLabel(start: string, end: string): string {
    if (!start && !end) return 'All time';
    if (start && end && start === end) {
        try {
            return format(new Date(start + 'T12:00:00'), 'EEE, MMM d, yyyy');
        } catch {
            return start;
        }
    }
    const fmt = (d: string) => {
        try {
            return format(new Date(d + 'T12:00:00'), 'MMM d, yyyy');
        } catch {
            return d;
        }
    };
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return `From ${fmt(start)}`;
    return `Until ${fmt(end)}`;
}

export function bookingInRange(date: string, range: DateRange): boolean {
    if (range.start && date < range.start) return false;
    if (range.end && date > range.end) return false;
    return true;
}

export default function DateRangeFilter({ start, end, onChange, className }: DateRangeFilterProps) {
    const active = activePresetId(start, end);
    const presets = getDatePresets();

    return (
        <div className={cn('space-y-3 py-4 border-b border-white/[0.06]', className)}>
            <p className="text-[10px] uppercase tracking-widest text-savron-silver/60">Date range</p>
            <div className="flex flex-wrap gap-1.5">
                {presets.map(preset => (
                    <button
                        key={preset.id}
                        type="button"
                        onClick={() => onChange(preset.getRange())}
                        className={cn(
                            'px-2.5 py-1 text-[10px] uppercase tracking-widest rounded-full border transition-colors',
                            active === preset.id
                                ? 'bg-savron-green/20 text-accent-blue border-savron-green/30'
                                : 'bg-white/[0.03] text-savron-silver border-white/[0.08] hover:text-white hover:border-white/20',
                        )}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-savron-silver/50">From</span>
                    <input
                        type="date"
                        value={start}
                        onChange={e => onChange({ start: e.target.value, end })}
                        className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-savron text-white [color-scheme:dark] focus:outline-none focus:border-savron-green/40"
                    />
                </label>
                <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-widest text-savron-silver/50">To</span>
                    <input
                        type="date"
                        value={end}
                        min={start || undefined}
                        onChange={e => onChange({ start, end: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.08] rounded-savron text-white [color-scheme:dark] focus:outline-none focus:border-savron-green/40"
                    />
                </label>
            </div>
            <p className="text-[10px] text-savron-silver/50">
                Showing: <span className="text-savron-silver">{formatRangeLabel(start, end)}</span>
            </p>
        </div>
    );
}
