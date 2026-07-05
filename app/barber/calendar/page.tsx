"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import {
    format,
    startOfWeek, endOfWeek, eachDayOfInterval,
    isToday, isSunday,
} from 'date-fns';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Barber, Booking } from '@/lib/types';
import { TIME_SLOTS, serviceBlockStyle } from '@/lib/services-data';
import { useServices } from '@/lib/use-services';
import CalendarNavBar from '@/components/calendar/CalendarNavBar';

type CalView = 'day' | 'week';

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
type DayKey = typeof DAY_KEYS[number];
type WorkingHours = Partial<Record<DayKey, { open: string; close: string } | null>>;

function slotToMinutes(timeStr: string): number {
    const [timePart, meridiem] = timeStr.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

function timeStrToMinutes(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function isSlotInHours(timeStr: string, schedule: { open: string; close: string }): boolean {
    const slotMin = slotToMinutes(timeStr);
    const openMin = timeStrToMinutes(schedule.open);
    const closeMin = timeStrToMinutes(schedule.close);
    return slotMin >= openMin && slotMin < closeMin;
}

export default function BarberCalendarPage() {
    const supabase = createClient();
    const services = useServices();
    const serviceColorMap = useMemo(() => Object.fromEntries(services.map(s => [s.name, s.color])), [services]);
    const [view, setView] = useState<CalView>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [barber, setBarber] = useState<Barber | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [googleBusy, setGoogleBusy] = useState<{ start: string; end: string }[]>([]);
    const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: barberData } = await supabase
                .from('barbers')
                .select('*')
                .eq('auth_id', user.id)
                .single();
            if (barberData) {
                setBarber(barberData);
                setWorkingHours((barberData.working_hours as WorkingHours) ?? null);
                const { data: bookingsData } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('barber_id', barberData.id)
                    .in('status', ['confirmed', 'completed'])
                    .order('date')
                    .order('time');
                if (bookingsData) setBookings(bookingsData);
            }
            setLoading(false);
        }
        load();
    }, []);

    // Fetch Google Calendar busy blocks whenever date or barber changes
    useEffect(() => {
        if (!barber) return;
        fetchGoogleBusy();
    }, [barber, selectedDate]);

    const fetchGoogleBusy = async () => {
        if (!barber) return;
        setSyncing(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const res = await fetch(`/api/calendar/busy?barberId=${barber.id}&date=${dateStr}`);
            if (res.ok) {
                const data = await res.json();
                setGoogleBusy(data.busy || []);
            }
        } catch {
            setGoogleBusy([]);
        }
        setSyncing(false);
    };

    const weekDays = useMemo(() => {
        const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [selectedDate]);

    const bookingsForDate = (dateStr: string) =>
        bookings.filter(b => b.date === dateStr);

    // Check if a time slot is blocked by Google Calendar
    const isGoogleBusy = (timeStr: string, dateStr: string): boolean => {
        const slotMin = slotToMinutes(timeStr);
        const slotStart = new Date(`${dateStr}T${String(Math.floor(slotMin / 60)).padStart(2, '0')}:${String(slotMin % 60).padStart(2, '0')}:00-05:00`).getTime();
        const slotEnd = slotStart + 45 * 60000;
        return googleBusy.some(b =>
            slotStart < new Date(b.end).getTime() && slotEnd > new Date(b.start).getTime()
        );
    };

    // Get the working hours schedule for a given date
    const getScheduleForDate = (date: Date): { open: string; close: string } | null => {
        if (!workingHours) return null;
        const dayKey = DAY_KEYS[date.getDay()];
        return workingHours[dayKey] ?? null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (!barber) {
        return (
            <div className="text-center py-20 space-y-4">
                <h1 className="font-heading text-2xl uppercase tracking-widest text-white">Account Not Linked</h1>
                <p className="text-savron-silver text-sm">Your login is not linked to a barber profile. Contact admin.</p>
            </div>
        );
    }

    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
    const daySchedule = getScheduleForDate(selectedDate);
    const isDayOff = workingHours !== null && daySchedule === null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="font-heading text-2xl uppercase tracking-widest text-white">My Calendar</h1>
                <div className="flex gap-2 items-center">
                    {/* Sync button */}
                    <button
                        onClick={fetchGoogleBusy}
                        disabled={syncing}
                        className="p-2 border border-white/10 text-savron-silver hover:text-white hover:border-white/25 transition-all rounded-savron disabled:opacity-40"
                        title="Sync Google Calendar"
                    >
                        <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                    </button>
                    {/* Google Calendar connect status */}
                    {barber.google_calendar_id ? (
                        <span className="text-[10px] uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                            Google Calendar connected
                        </span>
                    ) : (
                        <a
                            href="/barber/calendar/connect"
                            className="text-[10px] uppercase tracking-widest text-savron-silver/50 hover:text-white flex items-center gap-1 transition-colors"
                        >
                            <ExternalLink className="w-3 h-3" /> Connect Google Calendar
                        </a>
                    )}
                </div>
            </div>

            <CalendarNavBar
                view={view}
                onViewChange={setView}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                views={['day', 'week'] as const}
                skipSundays
            />

            {/* Working hours banner */}
            {workingHours && view === 'day' && (
                <div className={cn(
                    "flex items-center justify-between px-4 py-3 border rounded-savron text-xs",
                    isDayOff
                        ? "border-amber-500/20 bg-amber-500/5 text-amber-400/70"
                        : "border-savron-green-light/20 bg-savron-green/10 text-emerald-400"
                )}>
                    <span className="uppercase tracking-widest">
                        {isDayOff
                            ? `Day off — ${selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}`
                            : `Schedule: ${daySchedule ? `${daySchedule.open} – ${daySchedule.close}` : 'All day'}`
                        }
                    </span>
                    {syncing && (
                        <span className="text-savron-silver/30 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" /> Syncing…
                        </span>
                    )}
                </div>
            )}

            {/* Legend */}
            {view === 'day' && (
                <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-widest text-savron-silver/40">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-savron-green/20 border border-savron-green/30 inline-block" />SAVRON booking</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/30 inline-block" />Google Calendar</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white/[0.03] border border-white/[0.04] inline-block opacity-40" />Outside hours</span>
                </div>
            )}

            {/* Day View */}
            {view === 'day' && (
                <div className="space-y-2">
                    {TIME_SLOTS.map((slot) => {
                        const booking = bookingsForDate(selectedDateStr).find(b => b.time === slot);
                        const gBusy = !booking && isGoogleBusy(slot, selectedDateStr);
                        const inHours = !daySchedule ? true : isSlotInHours(slot, daySchedule);
                        return (
                            <div
                                key={slot}
                                className={cn(
                                    "flex items-center gap-4 p-4 border rounded-savron transition-all",
                                    !booking && (gBusy
                                        ? "border-blue-500/25 bg-blue-500/10"
                                        : !inHours
                                            ? "border-white/[0.03] bg-savron-grey/20 opacity-40"
                                            : "border-white/[0.04] bg-savron-grey/50")
                                )}
                                style={booking ? serviceBlockStyle(serviceColorMap[booking.service]) : undefined}
                            >
                                <span className="text-savron-silver/50 font-mono text-xs w-20 flex-shrink-0">{slot}</span>
                                {booking ? (
                                    <div className="flex-1 flex items-center justify-between">
                                        <div>
                                            <p className="text-white text-sm font-medium">{booking.client_name || 'Walk-in'}</p>
                                            <p className="text-xs opacity-70">{booking.service} · {booking.duration}</p>
                                        </div>
                                        {booking.client_phone && (
                                            <span className="text-xs opacity-50">{booking.client_phone}</span>
                                        )}
                                    </div>
                                ) : gBusy ? (
                                    <span className="text-blue-300/60 text-xs uppercase tracking-widest">External booking</span>
                                ) : !inHours ? (
                                    <span className="text-savron-silver/20 text-xs uppercase tracking-widest">Outside hours</span>
                                ) : (
                                    <span className="text-savron-silver/20 text-xs uppercase tracking-widest">Available</span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Week View */}
            {view === 'week' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {weekDays.filter(d => !isSunday(d)).map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayBookings = bookingsForDate(dateStr);
                        const sched = getScheduleForDate(day);
                        const dayOff = workingHours !== null && sched === null;
                        return (
                            <div
                                key={dateStr}
                                onClick={() => { setSelectedDate(day); setView('day'); }}
                                className={cn(
                                    "bg-savron-grey border rounded-savron p-4 cursor-pointer transition-all hover:border-white/20",
                                    dayOff
                                        ? "border-white/[0.03] opacity-50"
                                        : isToday(day)
                                            ? "border-savron-green/30"
                                            : "border-white/5"
                                )}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <p className={cn(
                                        "text-xs uppercase tracking-widest font-heading",
                                        isToday(day) ? "text-emerald-400" : "text-savron-silver"
                                    )}>
                                        {format(day, 'EEE')}
                                    </p>
                                    <p className={cn(
                                        "text-lg font-heading",
                                        isToday(day) ? "text-white" : "text-savron-silver/60"
                                    )}>
                                        {format(day, 'd')}
                                    </p>
                                </div>
                                {dayOff ? (
                                    <p className="text-savron-silver/20 text-[10px] uppercase tracking-widest">Day off</p>
                                ) : sched ? (
                                    <p className="text-savron-silver/30 text-[9px] mb-2">{sched.open} – {sched.close}</p>
                                ) : null}
                                {dayBookings.length === 0 ? (
                                    <p className="text-savron-silver/20 text-[10px] uppercase tracking-widest">No bookings</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {dayBookings.slice(0, 4).map(b => (
                                            <div key={b.id} className="text-[10px] text-savron-silver truncate">
                                                <span className="text-white/60 font-mono">{b.time}</span> {b.client_name?.split(' ')[0] || 'Walk-in'}
                                            </div>
                                        ))}
                                        {dayBookings.length > 4 && (
                                            <p className="text-savron-silver/30 text-[10px]">+{dayBookings.length - 4} more</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </motion.div>
    );
}
