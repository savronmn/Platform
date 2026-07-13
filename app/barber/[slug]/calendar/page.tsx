"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { isAdminUser } from '@/lib/admin-auth-client';
import { motion } from 'framer-motion';
import {
    format,
    startOfWeek, endOfWeek, eachDayOfInterval,
    isToday, isSunday,
} from 'date-fns';
import {
    RefreshCw, ExternalLink, Link2, Link2Off, XCircle,
    CheckCircle, User, Clock, CalendarDays,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Barber, Booking } from '@/lib/types';
import { serviceBlockStyle } from '@/lib/services-data';
import {
    formatTimeCompact, formatTimeRange, time24ToMins, getCalendarGridBounds, getTimelineLayout,
} from '@/lib/calendar-timeline';
import TimelineDayGrid, { bookingToTimelineEvent, isoRangeToTimelineEvent, type TimelineEvent } from '@/components/calendar/TimelineDayGrid';
import CalendarNavBar from '@/components/calendar/CalendarNavBar';
import { useServices } from '@/lib/use-services';
import { triggerCancelBooking } from '@/lib/confirm-booking';
import Image from 'next/image';

type CalView = 'day' | 'week';
type ListTab = 'calendar' | 'upcoming' | 'cancelled';

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
type DayKey = typeof DAY_KEYS[number];
type WorkingHours = Partial<Record<DayKey, { open: string; close: string } | null>>;

type GcalEvent = { id: string; summary: string; start: string; end: string; htmlLink: string | null };

export default function BarberSlugCalendarPage() {
    const params = useParams();
    const slug = params.slug as string;
    const router = useRouter();
    const searchParams = useSearchParams();
    const isAdminPreview = searchParams.get('adminPreview') === '1';
    const supabase = createClient();
    const services = useServices();
    const serviceColorMap = useMemo(() => Object.fromEntries(services.map(s => [s.name, s.color])), [services]);

    const [view, setView] = useState<CalView>('day');
    const [listTab, setListTab] = useState<ListTab>('calendar');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [barber, setBarber] = useState<Barber | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [googleBusy, setGoogleBusy] = useState<{ start: string; end: string }[]>([]);
    const [gcalEvents, setGcalEvents] = useState<GcalEvent[]>([]);
    const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [calConnected, setCalConnected] = useState(false);
    const [calError, setCalError] = useState<string | null>(null);
    const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const today = new Date().toISOString().split('T')[0];

    const rangeStart = useMemo(() => {
        if (view === 'week') return format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        return format(selectedDate, 'yyyy-MM-dd');
    }, [view, selectedDate]);

    const rangeEnd = useMemo(() => {
        if (view === 'week') return format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        return format(selectedDate, 'yyyy-MM-dd');
    }, [view, selectedDate]);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        setCalConnected(urlParams.get('cal_connected') === '1');
        setCalError(urlParams.get('cal_error'));
        if (urlParams.has('cal_connected') || urlParams.has('cal_error')) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace(`/barber/${slug}/login`);
                return;
            }

            const { data: barberData } = await supabase
                .from('barbers')
                .select('*')
                .eq('slug', slug)
                .maybeSingle();

            if (!barberData) {
                setLoading(false);
                return;
            }

            if (isAdminPreview) {
                const admin = await isAdminUser(supabase);
                if (!admin) {
                    router.replace('/admin/barbers');
                    return;
                }
            } else if (barberData.auth_id !== user.id) {
                await supabase.auth.signOut();
                router.replace(`/barber/${slug}/login`);
                return;
            }

            setBarber(barberData);
            setWorkingHours((barberData.working_hours as WorkingHours) ?? null);

            const { data: bookingsData } = await supabase
                .from('bookings')
                .select('*')
                .eq('barber_id', barberData.id)
                .order('date')
                .order('time');

            if (bookingsData) setBookings(bookingsData);
            setLoading(false);
        }
        load();
    }, [slug, router, isAdminPreview, supabase]);

    const refreshCalendar = useCallback(async () => {
        if (!barber) return;
        setSyncing(true);
        try {
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const eventsUrl = isAdminPreview
                ? `/api/calendar/barber/events?barberId=${barber.id}&dateStart=${rangeStart}&dateEnd=${rangeEnd}`
                : `/api/calendar/barber/events?dateStart=${rangeStart}&dateEnd=${rangeEnd}`;
            const [busyRes, eventsRes] = await Promise.all([
                fetch(`/api/calendar/busy?barberId=${barber.id}&date=${dateStr}`),
                fetch(eventsUrl, { credentials: 'include' }),
            ]);

            if (busyRes.ok) {
                const data = await busyRes.json();
                setGoogleBusy(data.busy || []);
                if (data.workingHours) setWorkingHours(data.workingHours);
            }

            if (eventsRes.ok) {
                const data = await eventsRes.json();
                setGcalEvents(data.events || []);
            }
        } catch {
            setGoogleBusy([]);
            setGcalEvents([]);
        }
        setSyncing(false);
    }, [barber, selectedDate, rangeStart, rangeEnd, isAdminPreview]);

    useEffect(() => {
        if (!barber) return;
        refreshCalendar();
    }, [barber, selectedDate, rangeStart, rangeEnd, refreshCalendar]);

    const weekDays = useMemo(() => {
        const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [selectedDate]);

    const bookingsForDate = (dateStr: string) =>
        bookings.filter(b => b.date === dateStr && b.status !== 'cancelled');

    const upcomingBookings = useMemo(() =>
        bookings
            .filter(b => b.date >= today && b.status === 'confirmed')
            .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)),
    [bookings, today]);

    const cancelledBookings = useMemo(() =>
        bookings
            .filter(b => b.status === 'cancelled')
            .sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [bookings]);

    const nextAppointment = upcomingBookings[0] ?? null;

    const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

    const dayTimelineMap = useMemo(() => {
        const map = new Map<string, { kind: 'booking'; b: Booking } | { kind: 'gcal'; start: string; end: string; summary: string; htmlLink: string | null }>();
        for (const b of bookings.filter(bk => bk.date === selectedDateStr && bk.status !== 'cancelled')) {
            map.set(`b-${b.id}`, { kind: 'booking', b });
        }
        const seen = new Set<string>();
        for (const block of googleBusy) {
            const key = `${block.start}|${block.end}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const match = gcalEvents.find(e => e.start === block.start && e.end === block.end);
            map.set(`g-${key}`, {
                kind: 'gcal',
                start: block.start,
                end: block.end,
                summary: match?.summary ?? 'External',
                htmlLink: match?.htmlLink ?? null,
            });
        }
        return map;
    }, [bookings, googleBusy, gcalEvents, selectedDateStr]);

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
            if (booking.status !== 'cancelled') map.set(`b-${booking.id}`, booking);
        }
        return map;
    }, [bookings]);

    const timelineEventsForDate = (dateStr: string): TimelineEvent[] =>
        bookingsForDate(dateStr).map(booking =>
            bookingToTimelineEvent(`b-${booking.id}`, booking.time, booking.duration),
        );

    const getScheduleForDate = (date: Date): { open: string; close: string } | null => {
        if (!workingHours) return null;
        return workingHours[DAY_KEYS[date.getDay()]] ?? null;
    };

    const handleStatusUpdate = async (id: string, status: string) => {
        setActionError(null);
        if (status === 'cancelled') {
            const result = await triggerCancelBooking(id);
            if (result.success) {
                setBookings(prev => prev.map(b => b.id === id ? { ...b, status: 'cancelled' as Booking['status'] } : b));
                setSelectedBooking(null);
                if (result.warning) setActionError(result.warning);
            } else {
                setActionError(result.error ?? 'Could not cancel');
            }
            return;
        }
        await supabase.from('bookings').update({ status }).eq('id', id);
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: status as Booking['status'] } : b));
        setSelectedBooking(prev => prev?.id === id ? { ...prev, status: status as Booking['status'] } : prev);
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
                <h1 className="font-heading text-2xl uppercase tracking-widest text-white">Barber Not Found</h1>
                <p className="text-savron-silver text-sm">This calendar link is invalid.</p>
            </div>
        );
    }

    const daySchedule = getScheduleForDate(selectedDate);
    const isDayOff = workingHours !== null && daySchedule === null;
    const isGcalConnected = !!(barber.google_calendar_id && barber.google_calendar_tokens);

    const timelineServiceStyle = (service: string): Record<string, string> => {
        const base = serviceBlockStyle(serviceColorMap[service]);
        return {
            ...base,
            backgroundColor: String(base.backgroundColor).replace(/0\.12\)$/, '0.28)'),
            borderColor: String(base.borderColor).replace(/0\.38\)$/, '0.85)'),
        };
    };

    const connectUrl = `/api/calendar/connect?barberId=${barber.id}&redirect=/barber/${slug}/calendar`;

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    {barber.image_url && (
                        <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/10 hidden sm:block">
                            <Image src={barber.image_url} alt={barber.name} fill className="object-cover" />
                        </div>
                    )}
                    <div>
                        <h1 className="font-heading text-2xl uppercase tracking-widest text-white">{barber.name}</h1>
                        <p className="text-savron-silver text-xs mt-0.5">{barber.role}</p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={refreshCalendar}
                        disabled={syncing}
                        className="p-2 border border-white/10 text-savron-silver hover:text-white hover:border-white/25 transition-all rounded-savron disabled:opacity-40"
                        title="Refresh calendar"
                    >
                        <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                    </button>
                    {isGcalConnected ? (
                        <span className="text-[10px] uppercase tracking-widest text-savron-blue-light flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-savron-blue-light inline-block" />
                            Google connected
                        </span>
                    ) : (
                        <a
                            href={connectUrl}
                            className="px-3 py-2 bg-white/5 border border-white/10 text-white text-[10px] uppercase tracking-widest rounded-savron hover:bg-white/10 transition-all flex items-center gap-1"
                        >
                            <Link2 className="w-3 h-3" /> Connect Google
                        </a>
                    )}
                </div>
            </div>

            {/* Google connect banner */}
            {(calConnected || calError || !isGcalConnected) && (
                <div className={cn(
                    "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-savron",
                    calConnected ? "bg-savron-blue/20 border-savron-blue-light/35" :
                    calError ? "bg-red-500/10 border-red-500/30" :
                    "bg-savron-grey border-white/10",
                )}>
                    <div className="flex items-center gap-3">
                        {calConnected ? (
                            <Link2 className="w-4 h-4 text-savron-blue-light" />
                        ) : (
                            <Link2Off className="w-4 h-4 text-savron-silver" />
                        )}
                        <div>
                            <p className={cn("text-xs uppercase tracking-widest font-medium",
                                calConnected ? "text-savron-blue-light" : calError ? "text-red-400" : "text-savron-silver",
                            )}>
                                {calConnected ? "Google Calendar connected" : calError ? "Connection failed" : "Connect Google Calendar"}
                            </p>
                            <p className="text-savron-silver/50 text-[11px] mt-0.5">
                                {calConnected
                                    ? "Your personal calendar events show alongside SAVRON bookings."
                                    : "Authorize Google to see external appointments on your schedule."}
                            </p>
                        </div>
                    </div>
                    {!isGcalConnected && (
                        <a href={connectUrl} className="px-3 py-2 bg-savron-green text-white text-xs uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all">
                            Connect with Google
                        </a>
                    )}
                </div>
            )}

            {/* Next appointment highlight */}
            {nextAppointment && (
                <div className="px-4 py-3 border border-savron-blue-light/25 bg-savron-blue/10 rounded-savron flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-savron-blue-light" />
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-savron-blue-light">Next appointment</p>
                            <p className="text-white text-sm font-medium">
                                {nextAppointment.client_name || 'Walk-in'} · {nextAppointment.service}
                            </p>
                            <p className="text-savron-silver text-xs">{nextAppointment.date} at {nextAppointment.time}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { setListTab('calendar'); setSelectedDate(new Date(`${nextAppointment.date}T12:00:00`)); setSelectedBooking(nextAppointment); }}
                        className="text-[10px] uppercase tracking-widest text-savron-blue-light hover:text-white transition-colors"
                    >
                        View
                    </button>
                </div>
            )}

            {actionError && (
                <div className="px-4 py-3 border border-amber-500/20 bg-amber-500/10 rounded-savron text-amber-300 text-sm">
                    {actionError}
                </div>
            )}

            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
                {([
                    { id: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
                    { id: 'upcoming' as const, label: `Upcoming (${upcomingBookings.length})`, icon: Clock },
                    { id: 'cancelled' as const, label: `Cancelled (${cancelledBookings.length})`, icon: XCircle },
                ]).map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setListTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-savron text-xs uppercase tracking-widest transition-all border",
                            listTab === tab.id
                                ? "bg-savron-blue border-savron-blue-light/20 text-white"
                                : "text-savron-silver border-white/5 hover:text-white",
                        )}
                    >
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Calendar tab */}
            {listTab === 'calendar' && (
                <>
                    <CalendarNavBar
                        view={view}
                        onViewChange={setView}
                        selectedDate={selectedDate}
                        onDateChange={setSelectedDate}
                        views={['day', 'week'] as const}
                        skipSundays
                    />

                    {workingHours && view === 'day' && (
                        <div className={cn(
                            "flex items-center justify-between px-4 py-3 border rounded-savron text-xs",
                            isDayOff
                                ? "border-amber-500/20 bg-amber-500/5 text-amber-400/70"
                                : "border-savron-blue-light/20 bg-savron-blue/10 text-savron-blue-light",
                        )}>
                            <span className="uppercase tracking-widest">
                                {isDayOff
                                    ? `Day off — ${selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}`
                                    : `Hours: ${daySchedule ? `${daySchedule.open} – ${daySchedule.close}` : 'All day'}`
                                }
                            </span>
                            {syncing && (
                                <span className="text-savron-silver/30 flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 animate-spin" /> Syncing…
                                </span>
                            )}
                        </div>
                    )}

                    {view === 'day' && (
                        <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-widest text-savron-silver/40">
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-savron-blue/20 border border-savron-blue/30 inline-block" />SAVRON</span>
                            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500/20 border border-blue-500/30 inline-block" />Google Calendar</span>
                        </div>
                    )}

                    {view === 'day' && (
                        <div className="overflow-auto border border-white/5 rounded-savron">
                            <TimelineDayGrid
                                columns={[{
                                    id: barber.id,
                                    header: <p className="text-white text-xs font-heading uppercase tracking-widest">{format(selectedDate, 'EEEE, MMM d')}</p>,
                                }]}
                                columnWidth="flex-1 min-w-0 sm:min-w-[320px]"
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
                                            <div key="before" className="absolute left-0 right-0 bg-savron-black/30 pointer-events-none z-0" style={{ top: layout.topPx, height: layout.heightPx }} />,
                                        );
                                    }
                                    if (closeMins < gridEnd) {
                                        const layout = getTimelineLayout(closeMins, gridEnd - closeMins);
                                        overlays.push(
                                            <div key="after" className="absolute left-0 right-0 bg-savron-black/30 pointer-events-none z-0" style={{ top: layout.topPx, height: layout.heightPx }} />,
                                        );
                                    }
                                    return overlays;
                                }}
                                renderEvent={(event, _columnId, layout) => {
                                    const item = dayTimelineMap.get(event.id);
                                    if (!item) return null;
                                    const tight = layout.heightPx < 80;
                                    if (item.kind === 'booking') {
                                        const booking = item.b;
                                        return (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedBooking(booking)}
                                                className={cn(
                                                    'h-full w-full rounded-lg border overflow-hidden flex flex-col justify-center text-left shadow-lg shadow-black/20 cursor-pointer hover:brightness-110 transition-all',
                                                    tight ? 'px-3 py-2' : 'p-3',
                                                )}
                                                style={timelineServiceStyle(booking.service)}
                                            >
                                                <p className="text-white text-sm font-semibold truncate">{booking.client_name || 'Walk-in'}</p>
                                                {!tight && <p className="opacity-85 truncate text-xs mt-0.5">{booking.service}</p>}
                                                <p className={cn('opacity-70 font-mono truncate', tight ? 'text-[10px] mt-0.5' : 'text-[11px] mt-1')}>
                                                    {formatTimeRange(booking.time, event.durationMins)}
                                                </p>
                                            </button>
                                        );
                                    }
                                    const gcalTime = formatTimeCompact(new Date(item.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
                                    const content = (
                                        <div className={cn(
                                            'h-full rounded-lg border overflow-hidden flex flex-col justify-center bg-blue-950/90 border-blue-400/60 text-blue-100 shadow-lg shadow-black/20',
                                            tight ? 'px-3 py-2' : 'p-3',
                                            item.htmlLink && 'cursor-pointer hover:brightness-110',
                                        )}>
                                            <span className="font-semibold text-white truncate text-sm">{item.summary}</span>
                                            {!tight && <span className="text-blue-200/75 text-[10px] mt-0.5">{gcalTime}</span>}
                                        </div>
                                    );
                                    if (item.htmlLink) {
                                        return (
                                            <a href={item.htmlLink} target="_blank" rel="noopener noreferrer" className="block h-full">
                                                {content}
                                            </a>
                                        );
                                    }
                                    return content;
                                }}
                            />
                        </div>
                    )}

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
                                                className={cn('w-full rounded-savron p-1 text-center hover:bg-white/5 transition-colors', isToday(day) && 'bg-savron-blue/5')}
                                            >
                                                <p className={cn('text-xs uppercase tracking-widest font-heading', isToday(day) ? 'text-savron-blue-light' : 'text-savron-silver')}>
                                                    {format(day, 'EEE')}
                                                </p>
                                                <p className={cn('text-lg font-heading', isToday(day) ? 'text-white' : 'text-savron-silver/60')}>
                                                    {format(day, 'd')}
                                                </p>
                                                {dayOff ? (
                                                    <p className="text-savron-silver/20 text-[9px] uppercase tracking-widest">Off</p>
                                                ) : sched ? (
                                                    <p className="text-savron-silver/30 text-[9px]">{sched.open} – {sched.close}</p>
                                                ) : null}
                                            </button>
                                        ),
                                    };
                                })}
                                columnWidth="min-w-[140px] sm:min-w-[200px] md:min-w-[220px]"
                                getEventsForColumn={timelineEventsForDate}
                                renderEvent={(event) => {
                                    const booking = bookingTimelineMap.get(event.id);
                                    if (!booking) return null;
                                    const tight = event.durationMins <= 30;
                                    return (
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedDate(new Date(`${booking.date}T12:00:00`)); setView('day'); setSelectedBooking(booking); }}
                                            className={cn(
                                                'h-full w-full rounded-lg border text-xs overflow-hidden flex flex-col justify-center text-left cursor-pointer shadow-xl shadow-black/25 hover:brightness-110 transition-all',
                                                tight ? 'px-3 py-2' : 'p-3',
                                            )}
                                            style={timelineServiceStyle(booking.service)}
                                        >
                                            <p className="font-mono text-[10px] uppercase tracking-wider opacity-80">{formatTimeCompact(booking.time)}</p>
                                            <p className="text-white font-semibold truncate">{booking.client_name || 'Walk-in'}</p>
                                            {!tight && <p className="opacity-85 truncate">{booking.service}</p>}
                                        </button>
                                    );
                                }}
                            />
                        </div>
                    )}
                </>
            )}

            {/* Upcoming list */}
            {listTab === 'upcoming' && (
                <BookingList
                    bookings={upcomingBookings}
                    emptyLabel="No upcoming appointments"
                    onSelect={setSelectedBooking}
                />
            )}

            {/* Cancelled list */}
            {listTab === 'cancelled' && (
                <BookingList
                    bookings={cancelledBookings}
                    emptyLabel="No cancelled appointments"
                    onSelect={setSelectedBooking}
                    showCancelled
                />
            )}

            {/* Booking detail panel */}
            {selectedBooking && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedBooking(null)}>
                    <div
                        className="bg-savron-grey border border-white/10 rounded-savron p-6 w-full max-w-md space-y-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="font-heading text-lg uppercase tracking-widest text-white">{selectedBooking.client_name || 'Walk-in'}</p>
                                <p className="text-savron-silver text-sm mt-1">{selectedBooking.service} · {selectedBooking.duration}</p>
                                <p className="text-savron-silver text-xs">{selectedBooking.date} at {selectedBooking.time}</p>
                                {selectedBooking.client_phone && <p className="text-savron-silver/60 text-xs mt-1">{selectedBooking.client_phone}</p>}
                                {selectedBooking.client_email && <p className="text-savron-silver/60 text-xs">{selectedBooking.client_email}</p>}
                            </div>
                            <button onClick={() => setSelectedBooking(null)} className="text-savron-silver hover:text-white p-1">
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        {selectedBooking.price && (
                            <p className="text-white font-mono">{selectedBooking.price}</p>
                        )}

                        <div className="flex flex-wrap gap-2">
                            {selectedBooking.status === 'confirmed' && !isAdminPreview && (
                                <>
                                    <button
                                        onClick={() => handleStatusUpdate(selectedBooking.id, 'completed')}
                                        className="flex items-center gap-1 px-3 py-2 bg-green-500/10 text-green-400 border border-green-500/20 rounded-savron text-xs uppercase tracking-wider hover:bg-green-500/20"
                                    >
                                        <CheckCircle className="w-3 h-3" /> Complete
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(selectedBooking.id, 'cancelled')}
                                        className="flex items-center gap-1 px-3 py-2 bg-red-500/10 text-red-400 border border-red-500/20 rounded-savron text-xs uppercase tracking-wider hover:bg-red-500/20"
                                    >
                                        <XCircle className="w-3 h-3" /> Cancel
                                    </button>
                                </>
                            )}
                            {selectedBooking.status === 'cancelled' && (
                                <span className="badge-rejected">Cancelled</span>
                            )}
                            {selectedBooking.status === 'completed' && (
                                <span className="badge-approved">Completed</span>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}

function BookingList({
    bookings,
    emptyLabel,
    onSelect,
    showCancelled,
}: {
    bookings: Booking[];
    emptyLabel: string;
    onSelect: (b: Booking) => void;
    showCancelled?: boolean;
}) {
    if (bookings.length === 0) {
        return (
            <div className="text-center py-16 bg-savron-grey border border-white/5 rounded-savron">
                <p className="text-savron-silver text-sm uppercase tracking-wider">{emptyLabel}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {bookings.map(booking => (
                <button
                    key={booking.id}
                    type="button"
                    onClick={() => onSelect(booking)}
                    className="w-full bg-savron-grey border border-white/5 rounded-savron p-5 flex items-center justify-between gap-4 text-left hover:border-white/15 transition-all"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-savron-charcoal border border-white/10 rounded-full flex items-center justify-center">
                            <User className="w-4 h-4 text-savron-silver" />
                        </div>
                        <div>
                            <p className="text-white font-medium">{booking.client_name || 'Walk-in'}</p>
                            <p className="text-savron-silver text-xs">{booking.service} · {booking.time} · {booking.date}</p>
                        </div>
                    </div>
                    {showCancelled ? (
                        <span className="badge-rejected">Cancelled</span>
                    ) : booking.price ? (
                        <span className="text-savron-silver font-mono text-sm">{booking.price}</span>
                    ) : null}
                </button>
            ))}
        </div>
    );
}
