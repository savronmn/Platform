"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import {
    format, addDays, subDays, addWeeks, subWeeks,
    startOfWeek, endOfWeek, eachDayOfInterval,
    isToday, isSunday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, RefreshCw, ExternalLink, ArrowLeft, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Barber, Booking } from '@/lib/types';
import { serviceBlockStyle } from '@/lib/services-data';
import {
    formatTimeCompact, time24ToMins, getCalendarGridBounds, getTimelineLayout,
} from '@/lib/calendar-timeline';
import TimelineDayGrid, { bookingToTimelineEvent, isoRangeToTimelineEvent, type TimelineEvent } from '@/components/calendar/TimelineDayGrid';
import { useServices } from '@/lib/use-services';
import Link from 'next/link';

type CalView = 'day' | 'week';

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
type DayKey = typeof DAY_KEYS[number];
type WorkingHours = Partial<Record<DayKey, { open: string; close: string } | null>>;

export default function AdminBarberCalendarPage() {
    const params = useParams();
    const router = useRouter();
    const barberId = params.id as string;
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
            // Verify admin session
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/admin/login'); return; }

            const { data: barberData } = await supabase
                .from('barbers')
                .select('*')
                .eq('id', barberId)
                .single();

            if (!barberData) { router.push('/admin/barbers'); return; }

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
            setLoading(false);
        }
        load();
    }, [barberId]);

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

    const navigate = (dir: -1 | 1) => {
        if (view === 'day') {
            let next = dir === 1 ? addDays(selectedDate, 1) : subDays(selectedDate, 1);
            if (isSunday(next)) next = dir === 1 ? addDays(next, 1) : subDays(next, 1);
            setSelectedDate(next);
        } else {
            setSelectedDate(dir === 1 ? addWeeks(selectedDate, 1) : subWeeks(selectedDate, 1));
        }
    };

    const bookingsForDate = (dateStr: string) =>
        bookings.filter(b => b.date === dateStr);

    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

    // Day-view timeline items for this barber
    const dayTimelineMap = useMemo(() => {
        const map = new Map<string, { kind: 'booking'; b: Booking } | { kind: 'gcal'; start: string; end: string }>();
        for (const b of bookings.filter(bk => bk.date === selectedDateStr)) {
            map.set(`b-${b.id}`, { kind: 'booking', b });
        }
        googleBusy.forEach((block, i) => {
            map.set(`g-${i}`, { kind: 'gcal', start: block.start, end: block.end });
        });
        return map;
    }, [bookings, googleBusy, selectedDateStr]);

    const dayTimelineEvents = useMemo((): TimelineEvent[] => {
        const events: TimelineEvent[] = [];
        dayTimelineMap.forEach((item, id) => {
            if (item.kind === 'booking') {
                events.push(bookingToTimelineEvent(id, item.b.time, item.b.duration));
            } else {
                events.push(isoRangeToTimelineEvent(id, item.start, item.end));
            }
        });
        return events;
    }, [dayTimelineMap]);

    const bookingTimelineMap = useMemo(() => {
        const map = new Map<string, Booking>();
        for (const booking of bookings) {
            map.set(`b-${booking.id}`, booking);
        }
        return map;
    }, [bookings]);

    const timelineEventsForDate = (dateStr: string): TimelineEvent[] =>
        bookingsForDate(dateStr).map(booking =>
            bookingToTimelineEvent(`b-${booking.id}`, booking.time, booking.duration)
        );

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

    if (!barber) return null;

    const daySchedule = getScheduleForDate(selectedDate);
    const isDayOff = workingHours !== null && daySchedule === null;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Link
                        href="/admin/barbers"
                        className="p-2 text-savron-silver hover:text-white transition-colors border border-white/10 rounded-savron hover:border-white/25"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <h1 className="font-heading text-2xl uppercase tracking-widest text-white">
                            {barber.name}&rsquo;s Calendar
                        </h1>
                        <p className="text-savron-silver/40 text-[10px] uppercase tracking-widest mt-0.5">Host View</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                    <button
                        onClick={fetchGoogleBusy}
                        disabled={syncing}
                        className="p-2 border border-white/10 text-savron-silver hover:text-white hover:border-white/25 transition-all rounded-savron disabled:opacity-40"
                        title="Sync Google Calendar"
                    >
                        <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                    </button>
                    {barber.google_calendar_id ? (
                        <span className="text-[10px] uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                            Google Calendar synced
                        </span>
                    ) : (
                        <span className="text-[10px] uppercase tracking-widest text-amber-400/70 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                            Google Calendar not connected
                        </span>
                    )}
                    {(['day', 'week'] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={cn(
                                "px-4 py-2 text-xs uppercase tracking-widest border rounded-savron transition-all",
                                view === v
                                    ? "bg-savron-green border border-savron-green-light/20 text-white"
                                    : "text-savron-silver border-white/5 hover:text-white"
                            )}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </div>

            {barber.google_calendar_id && (!barber.google_sync_token || !barber.google_channel_id) && (
                <div className="px-4 py-3 border border-amber-500/20 bg-amber-500/5 rounded-savron text-amber-400 text-xs uppercase tracking-widest">
                    Calendar sync channel is missing or expired for {barber.name}. Deleting events in Google Calendar will not cancel bookings here until sync is renewed.
                </div>
            )}

            {/* Booking Links */}
            {barber.booking_links && barber.booking_links.length > 0 && (
                <div className="bg-savron-grey border border-white/5 rounded-savron p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Link2 className="w-3.5 h-3.5 text-savron-silver/50" />
                        <span className="text-[10px] uppercase tracking-widest text-savron-silver/50">Personal Booking Links ({barber.booking_links.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {barber.booking_links.map((url, i) => (
                            <a
                                key={i}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 rounded-savron text-[10px] uppercase tracking-widest text-savron-silver hover:text-white hover:border-white/25 transition-all"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Link {i + 1}
                            </a>
                        ))}
                    </div>
                </div>
            )}

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

            {/* Date Navigation */}
            <div className="flex items-center justify-between bg-savron-grey border border-white/5 rounded-savron p-4">
                <button onClick={() => navigate(-1)} className="p-2 text-savron-silver hover:text-white transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                    <p className="text-white font-heading text-lg uppercase tracking-wider">
                        {view === 'day'
                            ? format(selectedDate, 'EEEE, MMMM d')
                            : `${format(weekDays[0], 'MMM d')} — ${format(weekDays[6], 'MMM d, yyyy')}`}
                    </p>
                    {view === 'day' && isToday(selectedDate) && (
                        <p className="text-emerald-400 text-[10px] uppercase tracking-widest mt-0.5">Today</p>
                    )}
                </div>
                <button onClick={() => navigate(1)} className="p-2 text-savron-silver hover:text-white transition-colors">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {!isToday(selectedDate) && (
                <button
                    onClick={() => setSelectedDate(new Date())}
                    className="text-xs uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                    Jump to Today
                </button>
            )}

            {/* Legend */}
            {view === 'day' && (
                <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-widest text-savron-silver/40">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-savron-green/20 border border-savron-green/30 inline-block" />SAVRON booking</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/30 inline-block" />External (Google Calendar)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white/[0.03] border border-white/[0.04] inline-block opacity-40" />Outside hours</span>
                </div>
            )}

            {/* Day View */}
            {view === 'day' && (
                <div className="overflow-auto border border-white/5 rounded-savron">
                    <TimelineDayGrid
                        columns={[{
                            id: barber.id,
                            header: (
                                <p className="text-white text-xs font-heading uppercase tracking-widest">{barber.name}</p>
                            ),
                        }]}
                        columnWidth="flex-1 min-w-[280px]"
                        getEventsForColumn={() => dayTimelineEvents}
                        renderColumnBackground={() => {
                            if (!daySchedule || isDayOff) return null;
                            const { startMins: gridStart, endMins: gridEnd } = getCalendarGridBounds();
                            const openMins = time24ToMins(daySchedule.open);
                            const closeMins = time24ToMins(daySchedule.close);
                            const overlays = [];
                            if (openMins > gridStart) {
                                const layout = getTimelineLayout(gridStart, openMins - gridStart);
                                overlays.push(
                                    <div
                                        key="before-hours"
                                        className="absolute left-0 right-0 bg-savron-black/30 pointer-events-none z-0"
                                        style={{ top: layout.topPx, height: layout.heightPx }}
                                    />,
                                );
                            }
                            if (closeMins < gridEnd) {
                                const layout = getTimelineLayout(closeMins, gridEnd - closeMins);
                                overlays.push(
                                    <div
                                        key="after-hours"
                                        className="absolute left-0 right-0 bg-savron-black/30 pointer-events-none z-0"
                                        style={{ top: layout.topPx, height: layout.heightPx }}
                                    />,
                                );
                            }
                            return overlays;
                        }}
                        renderEvent={(event) => {
                            const item = dayTimelineMap.get(event.id);
                            if (!item) return null;
                            const tight = event.durationMins <= 30;
                            if (item.kind === 'booking') {
                                const booking = item.b;
                                return (
                                    <div
                                        className={cn(
                                            'h-full rounded-savron border text-xs overflow-hidden flex flex-col justify-center shadow-lg shadow-black/10',
                                            tight ? 'px-2 py-1' : 'p-2',
                                        )}
                                        style={serviceBlockStyle(serviceColorMap[booking.service])}
                                    >
                                        <p className="text-white text-sm font-medium truncate">{booking.client_name || 'Walk-in'}</p>
                                        {!tight && <p className="opacity-70 truncate">{booking.service} · {booking.duration}</p>}
                                        {!tight && <p className="opacity-60 text-[10px] font-mono">{booking.time}</p>}
                                    </div>
                                );
                            }
                            const gcalTime = formatTimeCompact(new Date(item.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
                            return (
                                <div className="h-full rounded-savron border p-2 text-xs overflow-hidden flex flex-col justify-center bg-blue-500/10 border-blue-500/25 text-blue-300/80 shadow-lg shadow-black/10">
                                    <span className="uppercase tracking-widest text-[10px]">External (Google Calendar)</span>
                                    {!tight && <span className="opacity-60 text-[10px] font-mono">{gcalTime}</span>}
                                </div>
                            );
                        }}
                    />
                </div>
            )}

            {/* Week View */}
            {view === 'week' && (
                <div className="overflow-auto border border-white/5 rounded-savron">
                    <TimelineDayGrid
                        columns={weekDays.filter(d => !isSunday(d)).map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const sched = getScheduleForDate(day);
                            const dayOff = workingHours !== null && sched === null;
                            return {
                                id: dateStr,
                                header: (
                                    <button
                                        onClick={() => { setSelectedDate(day); setView('day'); }}
                                        className={cn('w-full rounded-savron p-1 text-center hover:bg-white/5 transition-colors', isToday(day) && 'bg-savron-green/5')}
                                    >
                                        <p className={cn('text-xs uppercase tracking-widest font-heading', isToday(day) ? 'text-emerald-400' : 'text-savron-silver')}>
                                            {format(day, 'EEE')}
                                        </p>
                                        <p className={cn('text-lg font-heading', isToday(day) ? 'text-white' : 'text-savron-silver/60')}>
                                            {format(day, 'd')}
                                        </p>
                                        {dayOff ? (
                                            <p className="text-savron-silver/20 text-[9px] uppercase tracking-widest">Day off</p>
                                        ) : sched ? (
                                            <p className="text-savron-silver/30 text-[9px]">{sched.open} – {sched.close}</p>
                                        ) : null}
                                    </button>
                                ),
                            };
                        })}
                        columnWidth="min-w-[150px] sm:min-w-[190px]"
                        getEventsForColumn={timelineEventsForDate}
                        renderEvent={(event) => {
                            const booking = bookingTimelineMap.get(event.id);
                            if (!booking) return null;
                            const tight = event.durationMins <= 30;
                            return (
                                <div
                                    onClick={() => { setSelectedDate(new Date(`${booking.date}T12:00:00`)); setView('day'); }}
                                    className={cn(
                                        'h-full rounded-savron border text-xs overflow-hidden flex flex-col justify-center cursor-pointer shadow-lg shadow-black/10',
                                        tight ? 'px-2 py-1' : 'p-2',
                                    )}
                                    style={serviceBlockStyle(serviceColorMap[booking.service])}
                                >
                                    <p className="text-white font-medium truncate">{booking.client_name || 'Walk-in'}</p>
                                    {!tight && <p className="opacity-70 truncate">{booking.service}</p>}
                                    {!tight && <p className="opacity-60 text-[10px] font-mono">{booking.time}</p>}
                                </div>
                            );
                        }}
                    />
                </div>
            )}
        </motion.div>
    );
}
