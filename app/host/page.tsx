"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
    format, addDays, subDays, isToday, isSameMonth,
    startOfWeek, endOfWeek, eachDayOfInterval,
    startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, RefreshCw, Wifi, X, UserCheck, UserX, RotateCcw, Phone, Scissors, Menu, LayoutDashboard, Users, CreditCard, Mail, MonitorPlay, Ban, Camera, Upload, ClipboardList, Plus, Filter, Calendar, AtSign, DollarSign, Pencil, Trash2, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import type { Barber, Booking } from '@/lib/types';
import { HOST_TIME_SLOTS, serviceBlockStyle } from '@/lib/services-data';
import {
    timeToMins, formatTimeCompact, parseDurationMins, itemsInSlot,
} from '@/lib/calendar-timeline';
import TimelineDayGrid, { bookingToTimelineEvent, isoRangeToTimelineEvent, type TimelineEvent } from '@/components/calendar/TimelineDayGrid';
import { useServices } from '@/lib/use-services';
import { triggerPostBooking, triggerCancelBooking } from '@/lib/confirm-booking';
import EditBookingModal from '@/components/crm/EditBookingModal';
import { LanguageProvider, useLanguage } from '@/lib/language-context';

const NAV_ITEMS = [
    { label: 'Dashboard',      href: '/admin',                icon: LayoutDashboard },
    { label: 'Host View',      href: '/host',                 icon: MonitorPlay },
    { label: 'Barbers',        href: '/admin/barbers',        icon: Scissors },
    { label: 'Clients',        href: '/admin/clients',        icon: Users },
    { label: 'Membership',     href: '/admin/membership',     icon: CreditCard },
    { label: 'Communications', href: '/admin/communications', icon: Mail },
    { label: 'Hiring',         href: '/admin/applicants',     icon: ClipboardList },
];

type CalView = 'day' | 'week' | 'month';

type ExternalEvent = {
    id: string;
    barberId: string;
    barberName: string;
    summary: string;
    attendee: string | null;
    clientName: string | null;
    start: string;
    end: string;
    date: string;
    time: string;
    htmlLink: string | null;
    source: 'google';
};

export default function HostDashboard() {
    return (
        <LanguageProvider>
            <HostDashboardInner />
        </LanguageProvider>
    );
}

function HostDashboardInner() {
    const { lang, toggle, t } = useLanguage();
    const supabase = createClient();
    const services = useServices();
    const serviceColorMap = useMemo(() =>
        Object.fromEntries(services.map(s => [s.name, s.color])),
        [services]
    );
    const [view, setView] = useState<CalView>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [realtimeConnected, setRealtimeConnected] = useState(false);
    const [syncHealthWarning, setSyncHealthWarning] = useState<string | null>(null);

    // Appointment detail modal
    const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
    const [updating, setUpdating] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    // Edit + delete
    const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);

    // External Google Calendar events
    const [externalEvents, setExternalEvents] = useState<ExternalEvent[]>([]);
    const [activeExternal, setActiveExternal] = useState<ExternalEvent | null>(null);

    // Burger nav
    const [showNav, setShowNav] = useState(false);

    // Quick-Add walk-in
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [quickFormDate, setQuickFormDate] = useState(new Date());
    const [quickForm, setQuickForm] = useState({
        clientName: '', clientPhone: '', clientEmail: '', service: '', barberId: '', time: '',
    });
    const [quickSubmitting, setQuickSubmitting] = useState(false);
    const [quickError, setQuickError] = useState<string | null>(null);

    // Barber filter (empty set = show all)
    const [filteredBarberIds, setFilteredBarberIds] = useState<Set<string>>(new Set());
    const toggleBarberFilter = (id: string) => {
        setFilteredBarberIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };
    const visibleBarbers = filteredBarberIds.size > 0
        ? barbers.filter(b => filteredBarberIds.has(b.id))
        : barbers;
    const isBookingVisible = (b: Booking) =>
        filteredBarberIds.size === 0 || (b.barber_id != null && filteredBarberIds.has(b.barber_id));

    const [rangeStart, rangeEnd] = useMemo(() => {
        if (view === 'day') {
            const d = format(selectedDate, 'yyyy-MM-dd');
            return [d, d];
        }
        if (view === 'week') {
            return [
                format(startOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
                format(endOfWeek(selectedDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
            ];
        }
        return [
            format(startOfMonth(selectedDate), 'yyyy-MM-dd'),
            format(endOfMonth(selectedDate), 'yyyy-MM-dd'),
        ];
    }, [view, selectedDate]);

    const fetchBookings = useCallback(async () => {
        const { data } = await supabase
            .from('bookings')
            .select('*')
            .gte('date', rangeStart)
            .lte('date', rangeEnd)
            .in('status', ['confirmed', 'completed', 'no_show', 'cancelled'])
            .order('time');
        setBookings(data ?? []);
    }, [rangeStart, rangeEnd]);

    const fetchExternalEvents = useCallback(async () => {
        try {
            const res = await fetch(`/api/calendar/events?dateStart=${rangeStart}&dateEnd=${rangeEnd}`);
            if (res.ok) setExternalEvents(await res.json());
        } catch { /* silent — platform bookings still show */ }
    }, [rangeStart, rangeEnd]);

    useEffect(() => {
        async function init() {
            setLoading(true);
            const { data: barberData } = await supabase
                .from('barbers').select('*').eq('active', true).order('name');
            setBarbers(barberData ?? []);
            await Promise.all([fetchBookings(), fetchExternalEvents()]);
            setLoading(false);
        }
        init();
    }, [rangeStart, rangeEnd]);

    useEffect(() => {
        const channel = supabase
            .channel(`host-${rangeStart}-${rangeEnd}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
            .subscribe(status => setRealtimeConnected(status === 'SUBSCRIBED'));
        return () => { supabase.removeChannel(channel); };
    }, [rangeStart, rangeEnd, fetchBookings]);

    useEffect(() => {
        fetch('/api/calendar/sync-health')
            .then(r => r.json())
            .then(data => {
                if (data.count > 0) {
                    const names = data.unhealthy.map((b: { name: string }) => b.name).join(', ');
                    setSyncHealthWarning(
                        `Google Calendar sync is unhealthy for: ${names}. Deletions in Google Calendar may not cancel bookings here until sync is renewed.`,
                    );
                }
            })
            .catch(() => {});
    }, []);

    // Update a booking's status — optimistic local update + DB write
    const updateStatus = async (booking: Booking, status: Booking['status']) => {
        setUpdating(true);
        if (status === 'cancelled') {
            const result = await triggerCancelBooking(booking.id);
            if (result.success) {
                setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'cancelled' } : b));
                setActiveBooking(prev => prev?.id === booking.id ? { ...prev, status: 'cancelled' } : prev);
            }
        } else {
            await supabase.from('bookings').update({ status }).eq('id', booking.id);
            setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status } : b));
            setActiveBooking(prev => prev?.id === booking.id ? { ...prev, status } : prev);
            if (status === 'no_show') {
                fetch('/api/calendar/sync', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bookingId: booking.id, action: 'delete' }),
                }).catch(err => console.error('Failed to sync calendar deletion:', err));
            }
        }
        setUpdating(false);
    };

    // Hard-delete a booking from DB + sync calendar
    const deleteBooking = async (booking: Booking) => {
        setDeletingId(booking.id);
        await supabase.from('bookings').delete().eq('id', booking.id);
        fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: booking.id, action: 'delete' }),
        }).catch(() => {});
        setBookings(prev => prev.filter(b => b.id !== booking.id));
        setDeletingId(null);
        setConfirmDelete(false);
        setActiveBooking(null);
    };



    // Quick-Add walk-in — creates a booking directly from the host view
    const submitQuickAdd = async () => {
        if (!quickForm.service || !quickForm.barberId || !quickForm.time) {
            setQuickError('Please select a service, barber, and time slot.');
            return;
        }
        setQuickSubmitting(true);
        setQuickError(null);
        const dateStr = format(quickFormDate, 'yyyy-MM-dd');

        // Race-condition guard: re-check availability fresh from DB right before inserting
        const { data: conflictCheck } = await supabase
            .from('bookings')
            .select('id')
            .eq('barber_id', quickForm.barberId)
            .eq('date', dateStr)
            .eq('time', quickForm.time)
            .in('status', ['confirmed', 'completed', 'no_show'])
            .limit(1);
        if (conflictCheck && conflictCheck.length > 0) {
            setQuickError('That slot was just booked. Please choose a different time.');
            setQuickSubmitting(false);
            await fetchBookings(); // refresh so the UI reflects reality
            return;
        }

        const barber = barbers.find(b => b.id === quickForm.barberId);
        const { data: inserted, error } = await supabase.from('bookings').insert({
            client_name: quickForm.clientName.trim() || 'Walk-in',
            client_phone: quickForm.clientPhone.trim() || null,
            client_email: quickForm.clientEmail.trim() || null,
            service: quickForm.service,
            barber_id: quickForm.barberId,
            barber_name: barber?.name ?? '',
            date: dateStr,
            time: quickForm.time,
            duration: '45 min',
            price: '',
            status: 'confirmed',
        }).select('id').single();
        if (error) { setQuickSubmitting(false); setQuickError(error.message); return; }
        if (inserted?.id) triggerPostBooking(inserted.id);
        setQuickSubmitting(false);
        setShowQuickAdd(false);
        setQuickForm({ clientName: '', clientPhone: '', clientEmail: '', service: '', barberId: '', time: '' });
        await fetchBookings();
    };

    const uploadClientPhoto = async (booking: Booking, file: File) => {
        setUploadingPhoto(true);
        try {
            const ext = file.name.split('.').pop();
            const path = `client-photos/${booking.id}.${ext}`;
            const { error: upErr } = await supabase.storage
                .from('barbers')
                .upload(path, file, { upsert: true, contentType: file.type });
            if (upErr) throw upErr;
            const { data: { publicUrl } } = supabase.storage.from('barbers').getPublicUrl(path);
            await supabase.from('bookings').update({ client_photo_url: publicUrl }).eq('id', booking.id);
            const updated = { ...booking, client_photo_url: publicUrl };
            setBookings(prev => prev.map(b => b.id === booking.id ? updated : b));
            setActiveBooking(updated);
        } catch (err) {
            console.error('Photo upload failed:', err);
        }
        setUploadingPhoto(false);
    };

    // Navigation
    const prev = () => {
        if (view === 'day')   setSelectedDate(d => subDays(d, 1));
        if (view === 'week')  setSelectedDate(d => subWeeks(d, 1));
        if (view === 'month') setSelectedDate(d => subMonths(d, 1));
    };
    const next = () => {
        if (view === 'day')   setSelectedDate(d => addDays(d, 1));
        if (view === 'week')  setSelectedDate(d => addWeeks(d, 1));
        if (view === 'month') setSelectedDate(d => addMonths(d, 1));
    };

    // Header labels
    const headingLabel = (() => {
        if (view === 'day')   return isToday(selectedDate) ? 'Today' : format(selectedDate, 'EEEE');
        if (view === 'week') {
            const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
            const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
            return format(ws, 'MMM') === format(we, 'MMM')
                ? format(ws, 'MMMM yyyy')
                : `${format(ws, 'MMM')} – ${format(we, 'MMM yyyy')}`;
        }
        return format(selectedDate, 'MMMM yyyy');
    })();

    const subLabel = (() => {
        if (view === 'day')   return format(selectedDate, 'MMMM d, yyyy');
        if (view === 'week') {
            const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
            const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
            return `${format(ws, 'MMM d')} – ${format(we, 'MMM d')}`;
        }
        return `${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`;
    })();

    // Data helpers — range-based bucketing for week view (day view uses proportional timeline).
    const bookingsForBarberTime = (barberId: string, slotIdx: number) => {
        const d = format(selectedDate, 'yyyy-MM-dd');
        return itemsInSlot(
            bookings.filter(b => b.barber_id === barberId && b.date === d),
            slotIdx,
            b => timeToMins(b.time),
        );
    };
    const bookingsForDayTime = (day: Date, slotIdx: number) => {
        const d = format(day, 'yyyy-MM-dd');
        return itemsInSlot(
            bookings.filter(b => b.date === d && isBookingVisible(b)),
            slotIdx,
            b => timeToMins(b.time),
        );
    };
    const bookingsForDay = (day: Date) => {
        const d = format(day, 'yyyy-MM-dd');
        return bookings.filter(b => b.date === d && isBookingVisible(b));
    };

    const formatTime = formatTimeCompact;

    // Deduplicate: hide GCal events that overlap with a platform booking
    // (same barber + date, event time within 22 mins of booking time).
    const deduplicatedExternal = useMemo(() => {
        return externalEvents.filter(e => {
            const eMins = timeToMins(e.time);
            return !bookings.some(b =>
                b.barber_id === e.barberId &&
                b.date === e.date &&
                Math.abs(timeToMins(b.time) - eMins) <= 22
            );
        });
    }, [externalEvents, bookings]);

    const bookingDurationMins = (b: Booking): number => parseDurationMins(b.duration);

    // Slot availability helpers — blocks a slot if any active booking or GCal event
    // for the selected barber overlaps with it (accounting for duration).
    const slotTakenByBooking = (barberId: string, dateStr: string, slotMins: number): boolean =>
        bookings.some(b => {
            if (b.barber_id !== barberId || b.date !== dateStr) return false;
            if (!['confirmed', 'completed', 'no_show'].includes(b.status)) return false;
            const bStart = timeToMins(b.time);
            const bEnd   = bStart + bookingDurationMins(b);
            return slotMins >= bStart && slotMins < bEnd;
        });

    const slotTakenByExternal = (barberId: string, dateStr: string, slotMins: number): boolean =>
        deduplicatedExternal.some(e => {
            if (e.barberId !== barberId || e.date !== dateStr) return false;
            const eStart = timeToMins(e.time);
            const eEnd   = eStart + 45;
            return slotMins >= eStart && slotMins < eEnd;
        });

    // Quick-Add slot availability — excludes past, booked (all active statuses), and GCal-occupied slots
    const allTimeSlotsWithStatus = useMemo(() => {
        const dateStr = format(quickFormDate, 'yyyy-MM-dd');
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const isViewingToday = dateStr === todayStr;
        const now = new Date();
        const nowMins = now.getHours() * 60 + now.getMinutes();

        return HOST_TIME_SLOTS.map(slot => {
            const slotMins = timeToMins(slot);
            if (isViewingToday && slotMins <= nowMins) return { slot, status: 'past' as const };
            if (quickForm.barberId) {
                const taken =
                    slotTakenByBooking(quickForm.barberId, dateStr, slotMins) ||
                    slotTakenByExternal(quickForm.barberId, dateStr, slotMins);
                if (taken) return { slot, status: 'taken' as const };
            }
            return { slot, status: 'available' as const };
        });
    }, [quickFormDate, quickForm.barberId, bookings, deduplicatedExternal]);

    const availableTimeSlots = allTimeSlotsWithStatus
        .filter(s => s.status === 'available')
        .map(s => s.slot);


    const isExternalVisible = (e: ExternalEvent) =>
        filteredBarberIds.size === 0 || filteredBarberIds.has(e.barberId);

    const externalForBarberTime = (barberId: string, slotIdx: number) => {
        const d = format(selectedDate, 'yyyy-MM-dd');
        return itemsInSlot(
            deduplicatedExternal.filter(e => e.barberId === barberId && e.date === d),
            slotIdx,
            e => timeToMins(e.time),
        );
    };
    const externalForDayTime = (day: Date, slotIdx: number) => {
        const d = format(day, 'yyyy-MM-dd');
        return itemsInSlot(
            deduplicatedExternal.filter(e => e.date === d && isExternalVisible(e)),
            slotIdx,
            e => timeToMins(e.time),
        );
    };

    // Day-view timeline: map event id → full object for rendering
    type DayTimelineItem =
        | { kind: 'booking'; b: Booking }
        | { kind: 'external'; e: ExternalEvent };
    const dayTimelineMap = useMemo(() => {
        const map = new Map<string, DayTimelineItem>();
        const d = format(selectedDate, 'yyyy-MM-dd');
        for (const b of bookings.filter(b => b.date === d && isBookingVisible(b))) {
            map.set(`b-${b.id}`, { kind: 'booking', b });
        }
        for (const e of deduplicatedExternal.filter(e => e.date === d && isExternalVisible(e))) {
            map.set(`e-${e.id}`, { kind: 'external', e });
        }
        return map;
    }, [bookings, deduplicatedExternal, selectedDate, filteredBarberIds]);

    const dayTimelineEventsForBarber = (barberId: string): TimelineEvent[] => {
        const events: TimelineEvent[] = [];
        dayTimelineMap.forEach((item, id) => {
            if (item.kind === 'booking') {
                if (item.b.barber_id !== barberId) return;
                events.push(bookingToTimelineEvent(id, item.b.time, item.b.duration));
            } else {
                if (item.e.barberId !== barberId) return;
                events.push(isoRangeToTimelineEvent(id, item.e.start, item.e.end));
            }
        });
        return events;
    };
    const externalForDay = (day: Date) => {
        const d = format(day, 'yyyy-MM-dd');
        return deduplicatedExternal.filter(e => e.date === d && isExternalVisible(e));
    };

    const svcColor = (s: string, cancelled = false): { className: string; style?: Record<string, string> } =>
        cancelled
            ? { className: 'bg-white/5 border-white/10 text-white/25 line-through' }
            : { className: '', style: serviceBlockStyle(serviceColorMap[s]) };
    const statusDot = (s: Booking['status']) =>
        s === 'confirmed' ? 'bg-savron-green' :
        s === 'completed' ? 'bg-blue-400' :
        s === 'no_show'   ? 'bg-red-400' :
        s === 'cancelled' ? 'bg-white/20' : 'bg-savron-silver';

    const confirmed  = bookings.filter(b => b.status === 'confirmed').length;
    const completed  = bookings.filter(b => b.status === 'completed').length;
    const noShow     = bookings.filter(b => b.status === 'no_show').length;
    const cancelled  = bookings.filter(b => b.status === 'cancelled').length;
    const totalToday = view === 'day'
        ? bookings.filter(b => b.date === format(selectedDate, 'yyyy-MM-dd')).length
        : bookings.length;

    const weekDays = eachDayOfInterval({
        start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
        end:   endOfWeek(selectedDate,   { weekStartsOn: 1 }),
    });
    const calDays = eachDayOfInterval({
        start: startOfWeek(startOfMonth(selectedDate), { weekStartsOn: 1 }),
        end:   endOfWeek(endOfMonth(selectedDate),     { weekStartsOn: 1 }),
    });

    // ExternalCheckIn — creates a platform booking from a GCal event so it can be tracked for revenue
    const ExternalCheckIn = ({
        event, barbers, onDone,
    }: { event: ExternalEvent; barbers: Barber[]; onDone: (b: Booking) => void }) => {
        const [checking, setChecking] = useState(false);
        const [done, setDone] = useState(false);

        const handleCheckIn = async () => {
            setChecking(true);
            // Parse service from summary (strip ✂️ prefix and barber name)
            const rawSummary = event.summary;
            let service = rawSummary
                .replace(/^✂️\s*/, '')
                .replace(/^.+?\s*[—–-]\s*/, '')
                .trim() || rawSummary;

            const clientName = event.clientName ?? event.attendee ?? 'Walk-in';

            const { data, error } = await supabase.from('bookings').insert({
                client_name: clientName,
                service,
                barber_id: event.barberId,
                barber_name: event.barberName,
                date: event.date,
                time: event.time,
                duration: '45 min',
                price: '',
                status: 'completed', // Check In = completed
                notes: `Checked in from Google Calendar event`,
            }).select('*').single();

            if (!error && data) {
                setDone(true);
                setTimeout(() => onDone(data as Booking), 600);
            }
            setChecking(false);
        };

        if (done) {
            return (
                <div className="flex items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-savron">
                    <UserCheck className="w-4 h-4" /> {t('host.checked_in')} ✓
                </div>
            );
        }

        return (
            <button
                onClick={handleCheckIn}
                disabled={checking}
                className="flex items-center justify-center gap-2 w-full py-3 text-[11px] uppercase tracking-widest font-medium bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50"
            >
                {checking
                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : <><UserCheck className="w-4 h-4" /> {t('host.check_in')}</>}
            </button>
        );
    };

    // External Google Calendar event pill
    const ExternalPill = ({ e, compact = false }: { e: ExternalEvent; compact?: boolean }) => {
        const displayName = e.clientName ?? e.attendee ?? e.summary;
        return (
            <div
                onClick={ev => { ev.stopPropagation(); setActiveExternal(e); }}
                className={cn(
                    "rounded-savron border cursor-pointer transition-opacity hover:opacity-80 mb-1",
                    compact ? "p-1.5 text-[10px] space-y-0.5" : "p-2.5 text-xs space-y-1",
                    "bg-violet-500/10 border-violet-500/25 text-violet-300"
                )}
            >
                <div className="flex items-center justify-between gap-1">
                    <span className="font-medium truncate">{displayName}</span>
                    <span className="text-[8px] uppercase tracking-widest opacity-50 shrink-0">GCal</span>
                </div>
                {!compact && <p className="opacity-50 truncate text-[10px]">{e.time} · {e.barberName}</p>}
                {compact && <p className="opacity-60 truncate">{e.barberName}</p>}
            </div>
        );
    };

    // Reusable pill — used in all three views
    const Pill = ({ b, compact = false }: { b: Booking; compact?: boolean }) => {
        const { className: colorClass, style: colorStyle } = svcColor(b.service, b.status === 'cancelled');
        return (
        <motion.div
            key={b.id}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={e => { e.stopPropagation(); setActiveBooking(b); }}
            className={cn(
                "rounded-savron border cursor-pointer transition-opacity hover:opacity-80 mb-1",
                compact ? "p-1.5 text-[10px] space-y-0.5" : "p-2.5 text-xs space-y-1",
                colorClass
            )}
            style={colorStyle}
        >
            <div className="flex items-center justify-between gap-1">
                <span className="font-medium truncate">{b.client_name ?? 'Walk-in'}</span>
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot(b.status))} />
            </div>
            <p className="opacity-70 truncate">{compact ? (b.barber_name ?? b.service) : b.service}</p>
            {!compact && b.time       && <p className="opacity-60 text-[10px] font-mono">{b.time}</p>}
            {!compact && b.duration   && <p className="opacity-50 text-[10px]">{b.duration}</p>}
            {!compact && b.client_phone && <p className="opacity-50 text-[10px] font-mono">{b.client_phone}</p>}
            {compact  && b.time       && <p className="opacity-50 text-[9px] font-mono">{formatTime(b.time)}</p>}
        </motion.div>
    );
    };

    return (
        <div className="min-h-screen bg-savron-black flex flex-col">

            {/* ── Row 1: main bar ── */}
            <header className="bg-savron-grey border-b border-white/5 px-6 py-3 flex items-center justify-between shrink-0 gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowNav(true)}
                        className="p-2 -ml-1 text-savron-silver hover:text-white transition-colors"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <h1 className="font-heading text-xl uppercase tracking-widest text-white">{t('host.title')}</h1>
                    <div className="flex items-center gap-1.5">
                        <Wifi className={cn("w-3 h-3", realtimeConnected ? "text-emerald-400" : "text-savron-silver/40")} />
                        <span className={cn("text-[10px] uppercase tracking-widest", realtimeConnected ? "text-emerald-400" : "text-savron-silver/40")}>
                            {realtimeConnected ? t('host.live') : t('host.connecting')}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-center hidden sm:block"><p className="text-white font-mono text-lg">{confirmed}</p><p className="text-savron-silver text-[10px] uppercase tracking-widest">{t('host.confirmed')}</p></div>
                    <div className="text-center hidden sm:block"><p className="text-blue-400 font-mono text-lg">{completed}</p><p className="text-savron-silver text-[10px] uppercase tracking-widest">{t('host.done')}</p></div>
                    <div className="text-center hidden sm:block"><p className="text-red-400 font-mono text-lg">{noShow}</p><p className="text-savron-silver text-[10px] uppercase tracking-widest">{t('host.no_show')}</p></div>
                    <button onClick={fetchBookings} className="p-2 text-savron-silver hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
                    {/* Quick-Add walk-in */}
                    <button
                        onClick={() => { setQuickFormDate(new Date()); setShowQuickAdd(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-savron-green text-white border border-savron-green-light/20 text-[10px] uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all"
                    >
                        <Plus className="w-3.5 h-3.5" /> Walk-in
                    </button>
                </div>
            </header>

            {syncHealthWarning && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 text-amber-400 text-[11px] uppercase tracking-widest shrink-0">
                    {syncHealthWarning}
                </div>
            )}

            {/* ── Row 2: date nav + view toggle ── */}
            <div className="bg-savron-grey border-b border-white/[0.04] px-6 py-2 flex items-center justify-between shrink-0 relative">
                <div className="flex-1"></div> {/* Spacer to allow absolute centering */}
                
                {/* Centered Date Nav */}
                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
                    <button onClick={prev} className="p-1.5 text-savron-silver hover:text-white transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                    <div className="text-center min-w-[148px]">
                        <p className="text-white font-heading uppercase tracking-widest text-sm leading-none">{headingLabel}</p>
                        <p className="text-savron-silver/50 text-[10px] uppercase tracking-widest mt-0.5">{subLabel}</p>
                    </div>
                    <button onClick={next} className="p-1.5 text-savron-silver hover:text-white transition-colors"><ChevronRight className="w-4 h-4" /></button>
                    {!isToday(selectedDate) && (
                        <button onClick={() => setSelectedDate(new Date())}
                            className="ml-1 text-[10px] uppercase tracking-widest text-emerald-400 border border-savron-green-light/20 hover:bg-savron-green/10 transition-colors px-2.5 py-1 rounded-savron">
                            {t('host.today')}
                        </button>
                    )}
                </div>

                <div className="flex border border-white/10 rounded-savron overflow-hidden z-10">
                    {(['day', 'week', 'month'] as CalView[]).map(v => (
                        <button key={v} onClick={() => setView(v)}
                            className={cn("px-3 py-1.5 text-[10px] uppercase tracking-widest transition-all",
                                view === v ? "bg-savron-green text-white border border-savron-green-light/20" : "text-savron-silver hover:text-white hover:bg-white/5"
                            )}>
                            {t(`host.${v}`) || v}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Day summary strip (day view only) ── */}
            {view === 'day' && !loading && (
                <div className="bg-savron-black border-b border-white/[0.04] px-6 py-2 flex items-center gap-6 shrink-0 overflow-x-auto">
                    <span className="text-[10px] uppercase tracking-widest text-savron-silver/40 shrink-0">{t('host.today_progress')}</span>
                    {/* Progress bar */}
                    <div className="flex-1 min-w-[120px] max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-500"
                            style={{ width: totalToday > 0 ? `${Math.round(((completed + noShow + cancelled) / totalToday) * 100)}%` : '0%' }}
                        />
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                            <span className="text-emerald-400 font-mono">{confirmed}</span>
                            <span className="text-savron-silver/40">{t('host.waiting')}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                            <span className="text-blue-400 font-mono">{completed}</span>
                            <span className="text-savron-silver/40">{t('host.done_s')}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                            <span className="text-red-400 font-mono">{noShow}</span>
                            <span className="text-savron-silver/40">{t('host.no_show_s')}</span>
                        </span>
                        {cancelled > 0 && (
                            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                                <span className="w-2 h-2 rounded-full bg-white/20 inline-block" />
                                <span className="text-savron-silver/40 font-mono">{cancelled}</span>
                                <span className="text-savron-silver/40">{t('host.cancelled_s')}</span>
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* ── Row 3: barber filter ── */}
            {barbers.length > 1 && (
                <div className="bg-savron-black border-b border-white/[0.04] px-6 py-2 flex items-center gap-3 shrink-0 overflow-x-auto">
                    <Filter className="w-3.5 h-3.5 text-savron-silver/40 shrink-0" />
                    <span className="text-[10px] uppercase tracking-widest text-savron-silver/40 shrink-0">{t('host.filter')}</span>
                    <button
                        onClick={() => setFilteredBarberIds(new Set())}
                        className={cn(
                            "px-3 py-1 text-[10px] uppercase tracking-widest border rounded-savron transition-all shrink-0",
                            filteredBarberIds.size === 0
                                ? "bg-savron-green border-savron-green-light/20 text-white"
                                : "border-white/10 text-savron-silver/60 hover:text-white"
                        )}
                    >
                        {t('host.all')}
                    </button>
                    {barbers.map(b => (
                        <button
                            key={b.id}
                            onClick={() => toggleBarberFilter(b.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-widest border rounded-savron transition-all shrink-0",
                                filteredBarberIds.has(b.id)
                                    ? "bg-savron-green border-savron-green-light/20 text-white"
                                    : "border-white/10 text-savron-silver/60 hover:text-white"
                            )}
                        >
                            {b.image_url && (
                                <div className="w-4 h-4 rounded-full overflow-hidden relative">
                                    <Image src={b.image_url} alt={b.name} fill className="object-cover" />
                                </div>
                            )}
                            {b.name.split(' ')[0]}
                        </button>
                    ))}
                </div>
            )}

            {/* ── Burger nav drawer ── */}
            <AnimatePresence>
                {showNav && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
                            onClick={() => setShowNav(false)}
                        />
                        <motion.nav
                            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
                            transition={{ type: 'tween', duration: 0.2 }}
                            className="fixed top-0 left-0 h-full w-64 bg-savron-grey border-r border-white/5 z-50 flex flex-col"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <div className="relative w-24 h-6">
                                    <Image src="/logo.png" alt="SAVRON" fill className="object-contain object-left" />
                                </div>
                                <button onClick={() => setShowNav(false)} className="text-savron-silver hover:text-white transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 py-4 px-3 space-y-1">
                                {NAV_ITEMS.map(item => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setShowNav(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-3 rounded-savron text-sm uppercase tracking-wider transition-all",
                                            item.href === '/host'
                                                ? "bg-savron-green border border-savron-green-light/20 text-white"
                                                : "text-savron-silver hover:text-white hover:bg-white/5 border border-transparent"
                                        )}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                            <div className="p-3 border-t border-white/5">
                                <button
                                    onClick={toggle}
                                    className="flex items-center gap-3 px-3 py-3 rounded-savron text-sm uppercase tracking-wider text-savron-silver hover:text-white hover:bg-white/5 transition-all w-full border border-transparent"
                                >
                                    <Languages className="w-4 h-4" />
                                    <span className="flex items-center gap-1.5">
                                        <span className={cn("transition-colors", lang === 'en' ? "text-white" : "text-savron-silver/40")}>EN</span>
                                        <span className="text-savron-silver/30">/</span>
                                        <span className={cn("transition-colors", lang === 'es' ? "text-white" : "text-savron-silver/40")}>ES</span>
                                    </span>
                                    <span className={cn(
                                        "ml-auto text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border transition-colors",
                                        lang === 'es'
                                            ? "border-savron-green/40 text-savron-green bg-savron-green/10"
                                            : "border-white/10 text-savron-silver/40"
                                    )}>
                                        {lang === 'en' ? 'EN' : 'ES'}
                                    </span>
                                </button>
                            </div>
                        </motion.nav>
                    </>
                )}
            </AnimatePresence>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* ══════════════════════════════════════
                        DAY VIEW
                    ══════════════════════════════════════ */}
                    {view === 'day' && (
                        <div className="flex-1 overflow-auto">
                            <TimelineDayGrid
                                columns={visibleBarbers.map(barber => ({
                                    id: barber.id,
                                    header: (
                                        <div className="flex items-center gap-2 sm:gap-3">
                                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden bg-savron-black relative shrink-0">
                                                {barber.image_url && <Image src={barber.image_url} alt={barber.name} fill className="object-cover grayscale" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-white text-[10px] sm:text-xs font-heading uppercase tracking-widest leading-none truncate">{barber.name}</p>
                                                <p className="text-savron-silver text-[9px] sm:text-[10px] mt-0.5 truncate">{barber.role}</p>
                                            </div>
                                        </div>
                                    ),
                                }))}
                                getEventsForColumn={dayTimelineEventsForBarber}
                                renderEvent={(event) => {
                                    const item = dayTimelineMap.get(event.id);
                                    if (!item) return null;
                                    if (item.kind === 'booking') {
                                        const b = item.b;
                                        const { className: colorClass, style: colorStyle } = svcColor(b.service, b.status === 'cancelled');
                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.96 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                onClick={e => { e.stopPropagation(); setActiveBooking(b); }}
                                                className={cn(
                                                    'h-full rounded-savron border cursor-pointer transition-opacity hover:opacity-80 p-1.5 text-[10px] space-y-0.5 overflow-hidden',
                                                    colorClass,
                                                )}
                                                style={colorStyle}
                                            >
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="font-medium truncate">{b.client_name ?? 'Walk-in'}</span>
                                                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDot(b.status))} />
                                                </div>
                                                <p className="opacity-70 truncate">{b.service}</p>
                                                {b.time && <p className="opacity-60 text-[9px] font-mono">{b.time}</p>}
                                            </motion.div>
                                        );
                                    }
                                    const e = item.e;
                                    const displayName = e.clientName ?? e.attendee ?? e.summary.replace(/^✂️\s*/, '').split(/[—–-]/)[0].trim();
                                    return (
                                        <div
                                            onClick={ev => { ev.stopPropagation(); setActiveExternal(e); }}
                                            className="h-full rounded-savron border cursor-pointer transition-opacity hover:opacity-80 p-1.5 text-[10px] space-y-0.5 overflow-hidden bg-violet-500/10 border-violet-500/25 text-violet-300"
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <span className="font-medium truncate">{displayName}</span>
                                                <span className="text-[8px] uppercase tracking-widest opacity-50 shrink-0">GCal</span>
                                            </div>
                                            <p className="opacity-50 truncate text-[9px]">{e.time}</p>
                                        </div>
                                    );
                                }}
                            />
                        </div>
                    )}

                    {/* ══════════════════════════════════════
                        WEEK VIEW
                    ══════════════════════════════════════ */}
                    {view === 'week' && (
                        <div className="flex-1 overflow-auto">
                            <div className="min-w-max">
                                <div className="flex border-b border-white/5 bg-savron-grey sticky top-0 z-10">
                                    <div className="w-14 sm:w-20 shrink-0 p-2 sm:p-4 border-r border-white/5">
                                        <span className="text-[10px] uppercase tracking-widest text-savron-silver/40">Time</span>
                                    </div>
                                    {weekDays.map(day => {
                                        const count = bookingsForDay(day).length + externalForDay(day).length;
                                        return (
                                            <div key={day.toISOString()}
                                                onClick={() => { setSelectedDate(day); setView('day'); }}
                                                className={cn("w-36 sm:w-44 shrink-0 p-2 sm:p-3 border-r border-white/5 text-center cursor-pointer hover:bg-white/5 transition-colors", isToday(day) && "bg-savron-green/5")}>
                                                <p className={cn("text-[10px] sm:text-xs font-heading uppercase tracking-widest", isToday(day) ? "text-savron-green" : "text-white")}>{format(day, 'EEE')}</p>
                                                <p className={cn("text-base sm:text-lg font-mono", isToday(day) ? "text-savron-green" : "text-savron-silver/70")}>{format(day, 'd')}</p>
                                                {count > 0 && <span className="text-[9px] text-savron-silver/40 uppercase tracking-widest">{count} appt{count !== 1 ? 's' : ''}</span>}
                                            </div>
                                        );
                                    })}
                                </div>

                                {HOST_TIME_SLOTS.map((time, i) => (
                                    <div key={i} className={cn(
                                        "flex border-b border-white/[0.05]",
                                        i % 2 !== 0 && "bg-white/[0.01]"
                                    )}>
                                        <div className="w-14 sm:w-20 shrink-0 px-2 py-1.5 border-r border-white/5 flex items-center">
                                            <span className="text-savron-silver/50 text-[9px] font-mono whitespace-nowrap">{time}</span>
                                        </div>
                                        {weekDays.map(day => (
                                            <div key={day.toISOString()}
                                                className={cn("w-36 sm:w-44 shrink-0 px-1 py-0.5 border-r border-white/5 min-h-[36px]", isToday(day) && "bg-savron-green/[0.03]")}>
                                                {bookingsForDayTime(day, i).map(b => <Pill key={b.id} b={b} compact />)}
                                                {externalForDayTime(day, i).map(e => <ExternalPill key={e.id} e={e} compact />)}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ══════════════════════════════════════
                        MONTH VIEW
                    ══════════════════════════════════════ */}
                    {view === 'month' && (
                        <div className="flex-1 overflow-auto p-6">
                            <div className="grid grid-cols-7 mb-1">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                    <div key={d} className="text-center py-2 text-[10px] uppercase tracking-widest text-savron-silver/40">{d}</div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 rounded-savron overflow-hidden">
                                {calDays.map(day => {
                                    const dayBookings = bookingsForDay(day);
                                    const dayExternal = externalForDay(day);
                                    const inMonth = isSameMonth(day, selectedDate);
                                    const today = isToday(day);
                                    const MAX = 3;
                                    const allItems = [
                                        ...dayBookings.map(b => ({ type: 'booking' as const, b })),
                                        ...dayExternal.map(e => ({ type: 'external' as const, e })),
                                    ];
                                    return (
                                        <div key={day.toISOString()}
                                            onClick={() => { setSelectedDate(day); setView('day'); }}
                                            className={cn("min-h-[120px] p-2 bg-savron-black cursor-pointer transition-colors hover:bg-savron-grey/80", !inMonth && "opacity-25")}>
                                            <div className={cn("w-7 h-7 flex items-center justify-center rounded-full text-xs font-mono mb-1.5",
                                                today ? "bg-savron-green text-white border border-savron-green-light/20 font-semibold" : "text-savron-silver")}>
                                                {format(day, 'd')}
                                            </div>
                                            <div className="space-y-0.5">
                                                {allItems.slice(0, MAX).map(item =>
                                                    item.type === 'booking' ? (() => {
                                                        const { className: mc, style: ms } = svcColor(item.b.service, item.b.status === 'cancelled');
                                                        return (
                                                        <div key={item.b.id}
                                                            onClick={ev => { ev.stopPropagation(); setActiveBooking(item.b); }}
                                                            className={cn("px-1.5 py-0.5 rounded text-[9px] truncate border leading-tight cursor-pointer hover:opacity-80 transition-opacity", mc)}
                                                            style={ms}>
                                                            {formatTime(item.b.time)} · {item.b.client_name ?? 'Walk-in'}
                                                        </div>
                                                        );
                                                    })() : (
                                                        <div key={item.e.id}
                                                            onClick={ev => { ev.stopPropagation(); setActiveExternal(item.e); }}
                                                            className="px-1.5 py-0.5 rounded text-[9px] truncate border leading-tight cursor-pointer hover:opacity-80 transition-opacity bg-violet-500/10 border-violet-500/25 text-violet-300">
                                                            {formatTime(item.e.time)} · {item.e.attendee ?? item.e.summary}
                                                        </div>
                                                    )
                                                )}
                                                {allItems.length > MAX && (
                                                    <p className="text-[9px] text-savron-silver/40 pl-1">+{allItems.length - MAX} more</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ══════════════════════════════════════
                APPOINTMENT DETAIL MODAL
            ══════════════════════════════════════ */}
            <AnimatePresence>
                {activeBooking && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => { setActiveBooking(null); setConfirmDelete(false); }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                            transition={{ duration: 0.15 }}
                            className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-sm shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Status bar */}
                            <div className={cn("h-1 w-full",
                                activeBooking.status === 'confirmed' ? "bg-savron-green" :
                                activeBooking.status === 'completed' ? "bg-blue-400" :
                                activeBooking.status === 'cancelled' ? "bg-white/20" : "bg-red-400"
                            )} />

                            {/* Header */}
                            <div className="flex items-start justify-between p-5 pb-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-savron-silver/50 mb-1">
                                        {activeBooking.status === 'confirmed' ? t('host.appointment') :
                                         activeBooking.status === 'completed' ? t('host.checked_in') :
                                         activeBooking.status === 'cancelled' ? t('host.cancelled_b') : t('host.no_show_btn')}
                                    </p>
                                    <h2 className="text-white font-heading text-xl uppercase tracking-wider leading-tight">
                                        {activeBooking.client_name ?? 'Walk-in'}
                                    </h2>
                                </div>
                                <button onClick={() => { setActiveBooking(null); setConfirmDelete(false); }}
                                    className="text-savron-silver hover:text-white transition-colors p-1 -mr-1 -mt-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Details */}
                            <div className="px-5 pb-5 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-savron-charcoal rounded-savron p-3">
                                        <p className="text-[9px] uppercase tracking-widest text-savron-silver/40 mb-1">{t('host.service')}</p>
                                        <div className={cn("inline-flex px-2 py-0.5 rounded text-[10px] border", svcColor(activeBooking.service))}>
                                            {activeBooking.service}
                                        </div>
                                        {activeBooking.price && (
                                            <p className="text-savron-silver/50 text-[10px] mt-1.5 flex items-center gap-1">
                                                <DollarSign className="w-3 h-3" />{activeBooking.price}
                                            </p>
                                        )}
                                    </div>
                                    <div className="bg-savron-charcoal rounded-savron p-3">
                                        <p className="text-[9px] uppercase tracking-widest text-savron-silver/40 mb-1">{t('host.date_time')}</p>
                                        <p className="text-white text-sm font-mono">{activeBooking.time}</p>
                                        {activeBooking.date && (
                                            <p className="text-savron-silver/50 text-[10px] mt-0.5">{activeBooking.date}</p>
                                        )}
                                        {activeBooking.duration && (
                                            <p className="text-savron-silver/40 text-[10px]">{activeBooking.duration}</p>
                                        )}
                                    </div>
                                </div>

                                {activeBooking.barber_name && (
                                    <div className="flex items-center gap-2 text-sm text-savron-silver">
                                        <Scissors className="w-3.5 h-3.5 shrink-0 text-savron-silver/40" />
                                        {activeBooking.barber_name}
                                    </div>
                                )}
                                {activeBooking.client_phone && (
                                    <div className="flex items-center gap-2 text-sm text-savron-silver font-mono">
                                        <Phone className="w-3.5 h-3.5 shrink-0 text-savron-silver/40" />
                                        {activeBooking.client_phone}
                                    </div>
                                )}
                                {activeBooking.client_email && (
                                    <div className="flex items-center gap-2 text-sm text-savron-silver">
                                        <AtSign className="w-3.5 h-3.5 shrink-0 text-savron-silver/40" />
                                        {activeBooking.client_email}
                                    </div>
                                )}
                                {activeBooking.notes && (
                                    <p className="text-savron-silver/50 text-xs leading-relaxed border-t border-white/5 pt-3">
                                        {activeBooking.notes}
                                    </p>
                                )}

                                {/* Client photo */}
                                <div className="border-t border-white/5 pt-3">
                                    <p className="text-[9px] uppercase tracking-widest text-savron-silver/40 mb-2">{t('host.client_photo')}</p>
                                    <label className="group relative cursor-pointer block">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                            onChange={e => {
                                                const f = e.target.files?.[0];
                                                if (f) uploadClientPhoto(activeBooking, f);
                                                e.target.value = '';
                                            }}
                                        />
                                        {activeBooking.client_photo_url ? (
                                            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-savron-green/40 transition-all">
                                                <Image src={activeBooking.client_photo_url} alt="Client" fill className="object-cover" />
                                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    {uploadingPhoto
                                                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        : <Camera className="w-4 h-4 text-white" />}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/10 group-hover:border-savron-green/40 transition-all flex items-center justify-center bg-savron-charcoal">
                                                {uploadingPhoto
                                                    ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    : <Upload className="w-4 h-4 text-white/30 group-hover:text-savron-green transition-colors" />}
                                            </div>
                                        )}
                                    </label>
                                </div>

                                {/* ── Track This Visit ── */}
                                <div className="pt-3 border-t border-white/5 space-y-2">
                                    <p className="text-[9px] uppercase tracking-[0.3em] text-savron-silver/40 mb-3">{t('host.track_visit')}</p>

                                    {activeBooking.status === 'confirmed' && (
                                        <>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    onClick={() => updateStatus(activeBooking, 'completed')}
                                                    disabled={updating}
                                                    className="flex items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-widest font-medium bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50"
                                                >
                                                    {updating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><UserCheck className="w-4 h-4" /> {t('host.check_in')}</>}
                                                </button>
                                                <button
                                                    onClick={() => updateStatus(activeBooking, 'no_show')}
                                                    disabled={updating}
                                                    className="flex items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-widest font-medium bg-red-500/15 text-red-400 border border-red-500/25 rounded-savron hover:bg-red-500/25 transition-all disabled:opacity-50"
                                                >
                                                    {updating ? <div className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" /> : <><UserX className="w-4 h-4" /> {t('host.no_show_btn')}</>}
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => updateStatus(activeBooking, 'cancelled')}
                                                disabled={updating}
                                                className="w-full flex items-center justify-center gap-2 py-2.5 text-[11px] uppercase tracking-widest font-medium bg-white/5 text-white/40 border border-white/10 rounded-savron hover:bg-white/10 hover:text-white/70 transition-all disabled:opacity-50"
                                            >
                                                {updating ? <div className="w-4 h-4 border-2 border-white/20 border-t-white/50 rounded-full animate-spin" /> : <><Ban className="w-4 h-4" /> {t('host.cancel_appt')}</>}
                                            </button>
                                        </>
                                    )}

                                    {activeBooking.status === 'completed' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-widest text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-savron">
                                                <UserCheck className="w-4 h-4" /> {t('host.checked_in')}
                                            </div>
                                            <button
                                                onClick={() => updateStatus(activeBooking, 'confirmed')}
                                                disabled={updating}
                                                className="w-full flex items-center justify-center gap-2 py-2 text-[10px] uppercase tracking-widest text-savron-silver/60 hover:text-white transition-colors disabled:opacity-50"
                                            >
                                                <RotateCcw className="w-3 h-3" /> {t('host.undo')}
                                            </button>
                                        </div>
                                    )}

                                    {activeBooking.status === 'no_show' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 rounded-savron">
                                                <UserX className="w-4 h-4" /> {t('host.no_show_btn')}
                                            </div>
                                            <button
                                                onClick={() => updateStatus(activeBooking, 'confirmed')}
                                                disabled={updating}
                                                className="w-full flex items-center justify-center gap-2 py-2 text-[10px] uppercase tracking-widest text-savron-silver/60 hover:text-white transition-colors disabled:opacity-50"
                                            >
                                                <RotateCcw className="w-3 h-3" /> {t('host.undo')}
                                            </button>
                                        </div>
                                    )}

                                    {activeBooking.status === 'cancelled' && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-widest text-white/30 bg-white/5 border border-white/10 rounded-savron">
                                                <Ban className="w-4 h-4" /> {t('host.cancelled_b')}
                                            </div>
                                            <button
                                                onClick={() => updateStatus(activeBooking, 'confirmed')}
                                                disabled={updating}
                                                className="w-full flex items-center justify-center gap-2 py-2 text-[10px] uppercase tracking-widest text-savron-silver/60 hover:text-white transition-colors disabled:opacity-50"
                                            >
                                                <RotateCcw className="w-3 h-3" /> {t('host.restore')}
                                            </button>
                                        </div>
                                    )}

                                    {/* Edit + Delete row */}
                                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5 mt-1">
                                        <button
                                            onClick={() => { setEditingBooking(activeBooking); setActiveBooking(null); }}
                                            className="flex items-center justify-center gap-2 py-2.5 text-[11px] uppercase tracking-widest font-medium bg-savron-green/15 hover:bg-savron-green/25 text-emerald-400 hover:text-emerald-300 border border-savron-green/30 hover:border-savron-green/50 rounded-savron transition-all"
                                        >
                                            <Pencil className="w-3.5 h-3.5" /> {t('host.edit')}
                                        </button>
                                        {confirmDelete ? (
                                            <button
                                                onClick={() => deleteBooking(activeBooking)}
                                                disabled={deletingId === activeBooking.id}
                                                className="flex items-center justify-center gap-2 py-2.5 text-[11px] uppercase tracking-widest text-red-400 bg-red-500/20 border border-red-500/30 rounded-savron hover:bg-red-500/30 transition-all disabled:opacity-50"
                                            >
                                                {deletingId === activeBooking.id
                                                    ? <div className="w-3.5 h-3.5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                                                    : <><Trash2 className="w-3.5 h-3.5" /> {t('host.confirm')}</>}
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => setConfirmDelete(true)}
                                                className="flex items-center justify-center gap-2 py-2.5 text-[11px] uppercase tracking-widest text-savron-silver/50 border border-white/10 rounded-savron hover:border-red-500/30 hover:text-red-400 transition-all"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> {t('host.delete')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══════════════════════════════════════
                EXTERNAL EVENT MODAL
            ══════════════════════════════════════ */}
            <AnimatePresence>
                {activeExternal && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setActiveExternal(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 8 }}
                            transition={{ duration: 0.15 }}
                            className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-sm shadow-2xl overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="h-1 w-full bg-violet-500/60" />
                            <div className="flex items-start justify-between p-5 pb-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-violet-400/70 mb-1 flex items-center gap-1.5">
                                        <Calendar className="w-3 h-3" /> Google Calendar
                                    </p>
                                    <h2 className="text-white font-heading text-xl uppercase tracking-wider leading-tight">
                                        {activeExternal.clientName ?? activeExternal.attendee ?? activeExternal.summary}
                                    </h2>
                                    <p className="text-savron-silver/40 text-[11px] mt-0.5">{activeExternal.time} · {activeExternal.barberName}</p>
                                </div>
                                <button onClick={() => setActiveExternal(null)}
                                    className="text-savron-silver hover:text-white transition-colors p-1 -mr-1 -mt-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="px-5 pb-5 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-savron-charcoal rounded-savron p-3">
                                        <p className="text-[9px] uppercase tracking-widest text-savron-silver/40 mb-1">{t('host.service')}</p>
                                        <p className="text-violet-300 text-xs truncate">{activeExternal.summary.replace(/^✂️\s*/, '').replace(/^.+?\s*[—–-]\s*/, '') || activeExternal.summary}</p>
                                    </div>
                                    <div className="bg-savron-charcoal rounded-savron p-3">
                                        <p className="text-[9px] uppercase tracking-widest text-savron-silver/40 mb-1">{t('host.date_time')}</p>
                                        <p className="text-white text-sm font-mono">{activeExternal.time}</p>
                                        <p className="text-savron-silver/50 text-[10px] mt-0.5">{activeExternal.date}</p>
                                    </div>
                                </div>

                                {/* ── Check In — creates a platform booking for revenue tracking ── */}
                                <div className="pt-1 border-t border-white/5 space-y-2">
                                    <p className="text-[9px] uppercase tracking-[0.3em] text-savron-silver/40">{t('host.track_visit')}</p>
                                    <ExternalCheckIn event={activeExternal} barbers={barbers} onDone={(b) => {
                                        setBookings(prev => [...prev, b]);
                                        setActiveExternal(null);
                                    }} />
                                </div>

                                {/* Open in Google Calendar */}
                                <a
                                    href={activeExternal.htmlLink ?? `https://calendar.google.com/calendar/r/day/${activeExternal.date.replace(/-/g, '/')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full py-2.5 text-[10px] uppercase tracking-widest font-medium bg-white/5 hover:bg-white/10 text-savron-silver hover:text-white border border-white/10 hover:border-white/20 rounded-savron transition-all"
                                    onClick={() => setActiveExternal(null)}
                                >
                                    <Pencil className="w-3 h-3" /> {t('host.open_gcal')}
                                </a>
                                <p className="text-[9px] text-savron-silver/25 text-center uppercase tracking-widest">{t('host.gcal_hint')}</p>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ══════════════════════════════════════
                EDIT BOOKING MODAL
            ══════════════════════════════════════ */}
            <EditBookingModal
                booking={editingBooking}
                barbers={barbers}
                onClose={() => setEditingBooking(null)}
                onSaved={(updated) => {
                    setBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
                    setEditingBooking(null);
                }}
            />

            {/* ══════════════════════════════════════
                QUICK-ADD WALK-IN MODAL
            ══════════════════════════════════════ */}
            <AnimatePresence>
                {showQuickAdd && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
                        onClick={() => setShowQuickAdd(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-sm shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-5 border-b border-white/5">
                                <div>
                                    <h3 className="font-heading text-white uppercase tracking-wider">Quick-Add Walk-in</h3>
                                </div>
                                <button onClick={() => setShowQuickAdd(false)} className="text-savron-silver hover:text-white transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-5 space-y-4">
                                {/* Date */}
                                <div className="flex flex-col items-center">
                                    <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-2">Date *</label>
                                    <input
                                        type="date"
                                        value={format(quickFormDate, 'yyyy-MM-dd')}
                                        onChange={e => setQuickFormDate(new Date(e.target.value + 'T00:00:00'))}
                                        className="input-savron"
                                    />
                                </div>

                                {/* Barber */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-2">Barber *</label>
                                    <select
                                        value={quickForm.barberId}
                                        onChange={e => setQuickForm(f => ({ ...f, barberId: e.target.value, time: '' }))}
                                        className="input-savron"
                                    >
                                        <option value="">Select barber…</option>
                                        {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                    </select>
                                </div>

                                {/* Service */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-2">Service *</label>
                                    <select
                                        value={quickForm.service}
                                        onChange={e => setQuickForm(f => ({ ...f, service: e.target.value }))}
                                        className="input-savron"
                                    >
                                        <option value="">Select service…</option>
                                        {services.map(s => (
                                            <option key={s.id} value={s.name}>{s.name} — {s.price}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Time */}
                                <div>
                                    <label className="block text-[10px] uppercase tracking-widest text-savron-silver/50 mb-2">Time *</label>
                                    {!quickForm.barberId ? (
                                        <p className="text-savron-silver/40 text-xs uppercase tracking-widest py-3">Select a barber first.</p>
                                    ) : availableTimeSlots.length === 0 ? (
                                        <p className="text-yellow-400 text-xs uppercase tracking-widest py-3">No available slots — barber is fully booked.</p>
                                    ) : (
                                        <select
                                            value={quickForm.time}
                                            onChange={e => setQuickForm(f => ({ ...f, time: e.target.value }))}
                                            className="input-savron"
                                        >
                                            <option value="">Select time…</option>
                                            {allTimeSlotsWithStatus
                                                .filter(s => s.status !== 'past')
                                                .map(({ slot, status }) => (
                                                    <option
                                                        key={slot}
                                                        value={slot}
                                                        disabled={status === 'taken'}
                                                    >
                                                        {slot}{status === 'taken' ? ' — booked' : ''}
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    )}
                                </div>

                                {/* Client name (optional) */}
                                <input
                                    type="text"
                                    placeholder="CLIENT NAME (OPTIONAL)"
                                    value={quickForm.clientName}
                                    onChange={e => setQuickForm(f => ({ ...f, clientName: e.target.value }))}
                                    className="input-savron"
                                />

                                {/* Client phone (optional) */}
                                <input
                                    type="tel"
                                    placeholder="PHONE (OPTIONAL)"
                                    value={quickForm.clientPhone}
                                    onChange={e => setQuickForm(f => ({ ...f, clientPhone: e.target.value }))}
                                    className="input-savron"
                                />

                                {/* Client email — triggers confirmation email if provided */}
                                <div>
                                    <input
                                        type="email"
                                        placeholder="EMAIL (SENDS CONFIRMATION)"
                                        value={quickForm.clientEmail}
                                        onChange={e => setQuickForm(f => ({ ...f, clientEmail: e.target.value }))}
                                        className="input-savron"
                                    />
                                    {quickForm.clientEmail.trim() && (
                                        <p className="text-savron-green text-[10px] uppercase tracking-widest mt-1.5">
                                            Confirmation will be sent to client + barber
                                        </p>
                                    )}
                                </div>

                                {quickError && <p className="text-red-400 text-xs">{quickError}</p>}

                                <div className="flex gap-3 pt-1">
                                    <button
                                        onClick={() => setShowQuickAdd(false)}
                                        className="flex-1 py-3 text-[11px] uppercase tracking-widest border border-white/20 text-white bg-white/5 hover:bg-white/10 rounded-savron transition-all font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={submitQuickAdd}
                                        disabled={quickSubmitting}
                                        className="flex-1 py-3 text-[11px] uppercase tracking-widest bg-savron-green hover:bg-savron-green-light text-white rounded-savron transition-all disabled:opacity-50 flex items-center justify-center gap-2 font-medium border border-savron-green/50 hover:border-savron-green-light"
                                    >
                                        {quickSubmitting
                                            ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            : <><Plus className="w-3.5 h-3.5" /> Add</>
                                        }
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
