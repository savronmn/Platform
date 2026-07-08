"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
    format, isToday, isSameMonth,
    startOfWeek, endOfWeek, eachDayOfInterval,
    startOfMonth, endOfMonth,
} from 'date-fns';
import { RefreshCw, Wifi, X, UserCheck, UserX, RotateCcw, Phone, Scissors, Menu, LayoutDashboard, Users, CreditCard, Mail, MonitorPlay, Ban, Camera, Upload, ClipboardList, Plus, Filter, Calendar, AtSign, DollarSign, Pencil, Trash2, Languages, Layers, Inbox, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import type { Barber, Booking } from '@/lib/types';
import { HOST_TIME_SLOTS, serviceBlockStyle, getShopScheduleForDate, formatScheduleRange } from '@/lib/services-data';
import {
    timeToMins, formatTimeCompact, formatTimeRange, parseDurationMins, itemsInHour,
    CALENDAR_HOUR_HEIGHT_PX, minsToTime12, getCalendarHourStarts,
    getCalendarGridBounds, time24ToMins,
    HOST_CALENDAR_HOUR_HEIGHT_PX,
    rangesOverlapMins,
} from '@/lib/calendar-timeline';
import TimelineDayGrid, { bookingToTimelineEvent, isoRangeToTimelineEvent, type TimelineEvent } from '@/components/calendar/TimelineDayGrid';
import CalendarNavBar from '@/components/calendar/CalendarNavBar';
import { useServices } from '@/lib/use-services';
import { triggerPostBooking, triggerCancelBooking } from '@/lib/confirm-booking';
import EditBookingModal from '@/components/crm/EditBookingModal';
import { LanguageProvider, useLanguage } from '@/lib/language-context';

const QRScannerModal = dynamic(() => import('@/components/qr/QRScannerModal'), { ssr: false });

const NAV_ITEMS = [
    { label: 'Dashboard',      href: '/admin',                icon: LayoutDashboard },
    { label: 'Host View',      href: '/host',                 icon: MonitorPlay },
    { label: 'Bookings',       href: '/admin/bookings',       icon: Calendar },
    { label: 'Requests',       href: '/admin/requests',       icon: Inbox },
    { label: 'Barbers',        href: '/admin/barbers',        icon: Scissors },
    { label: 'Clients',        href: '/admin/clients',        icon: Users },
    { label: 'Membership',     href: '/admin/membership',     icon: CreditCard },
    { label: 'Communications', href: '/admin/communications', icon: Mail },
    { label: 'Services',       href: '/admin/services',       icon: Layers },
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
    const [clientPhotoError, setClientPhotoError] = useState<string | null>(null);

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
    const [showScanner, setShowScanner] = useState(false);
    const [quickFormDate, setQuickFormDate] = useState(new Date());
    const [quickForm, setQuickForm] = useState({
        clientName: '', clientPhone: '', clientEmail: '', service: '', barberId: '', time: '',
    });
    const [quickSubmitting, setQuickSubmitting] = useState(false);
    const [quickError, setQuickError] = useState<string | null>(null);
    const [cancelError, setCancelError] = useState<string | null>(null);

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
            .order('date')
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
        setCancelError(null);
        if (status === 'cancelled') {
            const result = await triggerCancelBooking(booking.id);
            if (result.success) {
                setBookings(prev => prev.map(b =>
                    b.barber_id === booking.barber_id &&
                    b.date === booking.date &&
                    b.time === booking.time &&
                    b.status === 'confirmed'
                        ? { ...b, status: 'cancelled' }
                        : b.id === booking.id
                            ? { ...b, status: 'cancelled' }
                            : b
                ));
                setActiveBooking(prev =>
                    prev?.barber_id === booking.barber_id &&
                    prev?.date === booking.date &&
                    prev?.time === booking.time &&
                    prev?.status === 'confirmed'
                        ? { ...prev, status: 'cancelled' }
                        : prev?.id === booking.id
                            ? { ...prev, status: 'cancelled' }
                            : prev
                );
                await fetchExternalEvents();
            } else {
                setCancelError(result.error ?? 'Could not cancel appointment');
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

    // Hard-delete a booking from DB + sync calendar (GCal delete must run before DB row is removed)
    const deleteBooking = async (booking: Booking) => {
        setDeletingId(booking.id);
        try {
            await fetch('/api/calendar/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: booking.id, action: 'delete' }),
            });
        } catch (err) {
            console.error('Failed to delete Google Calendar event:', err);
        }
        await supabase.from('bookings').delete().eq('id', booking.id);
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
        setClientPhotoError(null);
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
            setClientPhotoError('Photo upload failed. Please try a different image.');
        }
        setUploadingPhoto(false);
    };

    // Data helpers — hour-based bucketing for week view (day view uses proportional timeline).
    const bookingsForDayHour = (day: Date, hourMins: number) => {
        const d = format(day, 'yyyy-MM-dd');
        return itemsInHour(
            bookings.filter(b => b.date === d && isBookingVisible(b)),
            hourMins,
            b => timeToMins(b.time),
        );
    };
    const bookingsForDay = (day: Date) => {
        const d = format(day, 'yyyy-MM-dd');
        return bookings.filter(b => b.date === d && isBookingVisible(b));
    };

    const formatTime = formatTimeCompact;

    const externalDurationMins = (e: ExternalEvent): number => {
        const duration = Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000);
        return Number.isFinite(duration) && duration > 0 ? duration : 45;
    };

    // Deduplicate: hide GCal events that overlap with an active platform booking
    // (same barber + date, event time within 22 mins of booking time).
    const deduplicatedExternal = useMemo(() => {
        return externalEvents.filter(e => {
            const eMins = timeToMins(e.time);
            return !bookings.some(b =>
                b.barber_id === e.barberId &&
                b.date === e.date &&
                ['confirmed', 'completed', 'no_show'].includes(b.status) &&
                Math.abs(timeToMins(b.time) - eMins) <= 22
            );
        });
    }, [externalEvents, bookings]);

    const bookingDurationMins = (b: Booking): number => parseDurationMins(b.duration);

    const quickAddDurationMins = useMemo(() => {
        const svc = services.find(s => s.name === quickForm.service);
        return svc?.durationMin ?? 45;
    }, [quickForm.service, services]);

    // Slot availability — zero buffer between appointments; back-to-back bookings are allowed.
    const slotTakenByBooking = (barberId: string, dateStr: string, slotMins: number, durationMins: number): boolean =>
        bookings.some(b => {
            if (b.barber_id !== barberId || b.date !== dateStr) return false;
            if (!['confirmed', 'completed', 'no_show'].includes(b.status)) return false;
            return rangesOverlapMins(slotMins, durationMins, timeToMins(b.time), bookingDurationMins(b));
        });

    const slotTakenByExternal = (barberId: string, dateStr: string, slotMins: number, durationMins: number): boolean =>
        deduplicatedExternal.some(e => {
            if (e.barberId !== barberId || e.date !== dateStr) return false;
            return rangesOverlapMins(slotMins, durationMins, timeToMins(e.time), externalDurationMins(e));
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
                    slotTakenByBooking(quickForm.barberId, dateStr, slotMins, quickAddDurationMins) ||
                    slotTakenByExternal(quickForm.barberId, dateStr, slotMins, quickAddDurationMins);
                if (taken) return { slot, status: 'taken' as const };
            }
            return { slot, status: 'available' as const };
        });
    }, [quickFormDate, quickForm.barberId, quickForm.service, quickAddDurationMins, bookings, deduplicatedExternal]);

    const availableTimeSlots = allTimeSlotsWithStatus
        .filter(s => s.status === 'available')
        .map(s => s.slot);


    const isExternalVisible = (e: ExternalEvent) =>
        filteredBarberIds.size === 0 || filteredBarberIds.has(e.barberId);

    const externalForDayHour = (day: Date, hourMins: number) => {
        const d = format(day, 'yyyy-MM-dd');
        return itemsInHour(
            deduplicatedExternal.filter(e => e.date === d && isExternalVisible(e)),
            hourMins,
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

    const timelineItemMap = useMemo(() => {
        const map = new Map<string, DayTimelineItem>();
        for (const b of bookings.filter(isBookingVisible)) {
            map.set(`b-${b.id}`, { kind: 'booking', b });
        }
        for (const e of deduplicatedExternal.filter(isExternalVisible)) {
            map.set(`e-${e.id}`, { kind: 'external', e });
        }
        return map;
    }, [bookings, deduplicatedExternal, filteredBarberIds]);

    const timelineEventsForDay = (dayKey: string): TimelineEvent[] => {
        const events: TimelineEvent[] = [];
        timelineItemMap.forEach((item, id) => {
            if (item.kind === 'booking') {
                if (item.b.date !== dayKey) return;
                events.push(bookingToTimelineEvent(id, item.b.time, item.b.duration));
            } else {
                if (item.e.date !== dayKey) return;
                events.push(isoRangeToTimelineEvent(id, item.e.start, item.e.end));
            }
        });
        return events;
    };

    const externalForDay = (day: Date) => {
        const d = format(day, 'yyyy-MM-dd');
        return deduplicatedExternal.filter(e => e.date === d && isExternalVisible(e));
    };

    const daySchedule = useMemo(() => getShopScheduleForDate(selectedDate), [selectedDate]);

    const renderOutsideHoursBackground = () => {
        if (!daySchedule) return null;
        const { startMins: gridStart, endMins: gridEnd } = getCalendarGridBounds();
        const pxPerMin = HOST_CALENDAR_HOUR_HEIGHT_PX / 60;
        const minH = Math.round(HOST_CALENDAR_HOUR_HEIGHT_PX * (15 / 60));
        const layoutAt = (start: number, dur: number) => {
            const end = start + dur;
            const visStart = Math.max(start, gridStart);
            const visEnd = Math.min(end, gridEnd);
            if (visEnd <= visStart) return { topPx: 0, heightPx: 0 };
            return {
                topPx: (visStart - gridStart) * pxPerMin,
                heightPx: Math.max((visEnd - visStart) * pxPerMin, minH),
            };
        };
        const openMins = time24ToMins(daySchedule.open);
        const closeMins = time24ToMins(daySchedule.close);
        const overlays: React.ReactNode[] = [];
        if (openMins > gridStart) {
            const layout = layoutAt(gridStart, openMins - gridStart);
            overlays.push(
                <div
                    key="before-hours"
                    className="absolute left-0 right-0 bg-savron-black/55 pointer-events-none z-0"
                    style={{ top: layout.topPx, height: layout.heightPx }}
                />,
            );
        }
        if (closeMins < gridEnd) {
            const layout = layoutAt(closeMins, gridEnd - closeMins);
            overlays.push(
                <div
                    key="after-hours"
                    className="absolute left-0 right-0 bg-savron-black/55 pointer-events-none z-0"
                    style={{ top: layout.topPx, height: layout.heightPx }}
                />,
            );
        }
        return overlays;
    };

    const svcColor = (s: string, cancelled = false): { className: string; style?: Record<string, string> } =>
        cancelled
            ? { className: 'bg-white/5 border-white/10 text-white/25 line-through' }
            : { className: '', style: serviceBlockStyle(serviceColorMap[s]) };
    const timelineServiceStyle = (s: string): Record<string, string> => {
        const base = serviceBlockStyle(serviceColorMap[s]);
        return {
            ...base,
            backgroundColor: String(base.backgroundColor).replace(/0\.12\)$/, '0.28)'),
            borderColor: String(base.borderColor).replace(/0\.38\)$/, '0.85)'),
        };
    };
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
                    compact ? "p-2 text-xs space-y-0.5" : "p-2.5 text-xs space-y-1",
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
                compact ? "p-2 text-xs space-y-0.5" : "p-2.5 text-xs space-y-1",
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
            {compact  && b.time       && <p className="opacity-70 text-[11px] font-mono font-medium">{formatTime(b.time)}</p>}
        </motion.div>
    );
    };

    const renderTimelineEvent = (
        event: TimelineEvent,
        layout: { heightPx: number },
        itemMap: Map<string, DayTimelineItem>,
        compact = false,
    ) => {
        const item = itemMap.get(event.id);
        if (!item) return null;
        const tight = layout.heightPx < 58;
        const roomy = layout.heightPx >= 86;

        if (item.kind === 'booking') {
            const b = item.b;
            const { className: colorClass } = svcColor(b.service, b.status === 'cancelled');
            return (
                <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={e => { e.stopPropagation(); setActiveBooking(b); }}
                    className={cn(
                        'h-full rounded-lg border cursor-pointer transition-all hover:brightness-110 overflow-hidden shadow-xl shadow-black/25 backdrop-blur-sm',
                        tight ? 'px-3 py-2 text-[11px]' : 'p-3 text-xs space-y-1',
                        compact && 'text-[11px]',
                        colorClass,
                    )}
                    style={timelineServiceStyle(b.service)}
                >
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider opacity-80 shrink-0">
                            {formatTime(b.time)}
                        </span>
                        <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDot(b.status))} />
                    </div>
                    <p className="font-semibold text-white truncate">{b.client_name ?? 'Walk-in'}</p>
                    {!tight && <p className="opacity-85 truncate">{compact ? (b.barber_name ?? b.service) : b.service}</p>}
                    {roomy && b.duration && <p className="opacity-60 text-[10px]">{b.duration}</p>}
                </motion.div>
            );
        }

        const e = item.e;
        const displayName = e.clientName ?? e.attendee ?? e.summary.replace(/^✂️\s*/, '').split(/[—–-]/)[0].trim();
        return (
            <div
                onClick={ev => { ev.stopPropagation(); setActiveExternal(e); }}
                className={cn(
                    'h-full rounded-lg border cursor-pointer transition-all hover:brightness-110 overflow-hidden bg-violet-950/95 border-violet-400/75 text-violet-100 shadow-xl shadow-black/25',
                    tight ? 'px-3 py-2 text-[11px]' : 'p-3 text-xs space-y-1',
                    compact && 'text-[11px]',
                )}
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-violet-200/80 shrink-0">{formatTime(e.time)}</span>
                    <span className="text-[8px] uppercase tracking-widest text-violet-200/60 shrink-0">GCal</span>
                </div>
                <p className="font-semibold text-white truncate">{displayName || 'External event'}</p>
                {!tight && <p className="text-violet-200/75 truncate text-[10px]">{!compact ? e.barberName : 'External calendar'}</p>}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-savron-black savron-grid-bg flex flex-col">

            {/* ── Row 1: main bar ── */}
            <header className="bg-savron-grey border-b border-savron-blue/20 savron-grid-surface px-4 py-2.5 flex items-center justify-between shrink-0 gap-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowNav(true)}
                        className="p-1 -ml-0.5 text-savron-silver hover:text-white transition-colors"
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                    <h1 className="font-heading text-2xl uppercase tracking-widest text-white">{t('host.title')}</h1>
                    <div className="flex items-center gap-1.5">
                        <Wifi className={cn("w-2.5 h-2.5", realtimeConnected ? "text-accent-blue" : "text-savron-silver/40")} />
                        <span className={cn("text-[9px] uppercase tracking-widest", realtimeConnected ? "text-accent-blue" : "text-savron-silver/40")}>
                            {realtimeConnected ? t('host.live') : t('host.connecting')}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="text-center hidden sm:block"><p className="text-white font-mono text-[21px] leading-none">{confirmed}</p><p className="text-savron-silver text-xs uppercase tracking-widest mt-0.5">{t('host.confirmed')}</p></div>
                    <div className="text-center hidden sm:block"><p className="text-blue-400 font-mono text-[21px] leading-none">{completed}</p><p className="text-savron-silver text-xs uppercase tracking-widest mt-0.5">{t('host.done')}</p></div>
                    <div className="text-center hidden sm:block"><p className="text-red-400 font-mono text-[21px] leading-none">{noShow}</p><p className="text-savron-silver text-xs uppercase tracking-widest mt-0.5">{t('host.no_show')}</p></div>
                    <button onClick={fetchBookings} className="p-1 text-savron-silver hover:text-white transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>
                    <button
                        onClick={() => setShowScanner(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 text-savron-silver border border-white/15 text-[13.5px] uppercase tracking-widest rounded-savron hover:text-white hover:border-white/30 transition-all"
                    >
                        <ScanLine className="w-[18px] h-[18px]" /> Scan ePass
                    </button>
                    <button
                        onClick={() => { setQuickFormDate(new Date()); setShowQuickAdd(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-savron-green text-white border border-savron-green-light/20 text-[13.5px] uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all"
                    >
                        <Plus className="w-[18px] h-[18px]" /> Walk-in
                    </button>
                </div>
            </header>

            <QRScannerModal open={showScanner} onClose={() => setShowScanner(false)} />

            {syncHealthWarning && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 text-amber-400 text-[11px] uppercase tracking-widest shrink-0">
                    {syncHealthWarning}
                </div>
            )}
            {cancelError && (
                <div className="bg-red-500/10 border-b border-red-500/20 px-6 py-2.5 text-red-400 text-[11px] uppercase tracking-widest shrink-0">
                    {cancelError}
                </div>
            )}

            <CalendarNavBar
                view={view}
                onViewChange={setView}
                selectedDate={selectedDate}
                onDateChange={setSelectedDate}
                todayLabel={t('host.today')}
                viewLabels={{
                    day: t('host.day'),
                    week: t('host.week'),
                    month: t('host.month'),
                }}
                variant="host"
                className="rounded-none border-x-0 border-t-0 shrink-0"
            />

            {/* ── Day summary strip (day view only) ── */}
            {view === 'day' && !loading && (
                <div className="bg-savron-black border-b border-white/[0.04] px-4 py-1 flex items-center gap-4 shrink-0 overflow-x-auto">
                    {daySchedule && (
                        <span className="text-[10px] uppercase tracking-widest text-savron-green shrink-0 font-medium">
                            Open {formatScheduleRange(daySchedule)}
                        </span>
                    )}
                    <span className="text-[10px] uppercase tracking-widest text-savron-silver/40 shrink-0">{t('host.today_progress')}</span>
                    {/* Progress bar */}
                    <div className="flex-1 min-w-[120px] max-w-xs h-1.5 bg-white/5 rounded-full overflow-hidden hidden sm:block">
                        <div
                            className="h-full bg-gradient-to-r from-savron-blue-light to-savron-blue rounded-full transition-all duration-500"
                            style={{ width: totalToday > 0 ? `${Math.round(((completed + noShow + cancelled) / totalToday) * 100)}%` : '0%' }}
                        />
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                            <span className="w-2 h-2 rounded-full bg-savron-blue-light animate-pulse inline-block" />
                            <span className="text-accent-blue font-mono">{confirmed}</span>
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
                            <div className="w-4 h-4 rounded-full overflow-hidden relative bg-savron-grey flex items-center justify-center">
                                {b.image_url ? (
                                    <Image src={b.image_url} alt={b.name} fill sizes="16px" className="object-cover" />
                                ) : (
                                    <span className="text-[8px] font-heading text-savron-silver/60">{b.name.charAt(0)}</span>
                                )}
                            </div>
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
                        <div className="flex-1 overflow-y-auto overflow-x-hidden">
                            <TimelineDayGrid
                                emphasized
                                fitViewport
                                hourHeightPx={HOST_CALENDAR_HOUR_HEIGHT_PX}
                                columns={visibleBarbers.map(barber => ({
                                    id: barber.id,
                                    header: (
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full overflow-hidden bg-savron-black relative shrink-0">
                                                {barber.image_url ? (
                                                    <Image src={barber.image_url} alt={barber.name} fill sizes="36px" className="object-cover grayscale" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[10px] font-heading text-savron-silver/60">
                                                        {barber.name.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-white text-[11px] font-heading uppercase tracking-widest leading-none truncate">{barber.name}</p>
                                                <p className="text-savron-silver/80 text-[9px] mt-0.5 truncate">{barber.role}</p>
                                            </div>
                                        </div>
                                    ),
                                }))}
                                renderColumnBackground={renderOutsideHoursBackground}
                                getEventsForColumn={dayTimelineEventsForBarber}
                                renderEvent={(event, _columnId, layout) => {
                                    const item = dayTimelineMap.get(event.id);
                                    if (!item) return null;
                                    const tight = layout.heightPx < 65;
                                    const roomy = layout.heightPx >= 100;
                                    if (item.kind === 'booking') {
                                        const b = item.b;
                                        const { className: colorClass, style: colorStyle } = svcColor(b.service, b.status === 'cancelled');
                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.98 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                onClick={e => { e.stopPropagation(); setActiveBooking(b); }}
                                                className={cn(
                                                    'h-full rounded-md border cursor-pointer transition-all hover:brightness-110 overflow-hidden flex flex-col justify-center shadow-lg shadow-black/20',
                                                    tight ? 'px-2 py-1 text-[10px]' : 'px-2 py-1.5 text-[11px]',
                                                    colorClass,
                                                )}
                                                style={colorStyle}
                                            >
                                                <div className="flex items-center justify-between gap-2 min-w-0">
                                                    <span className="font-semibold text-white truncate">{b.client_name ?? 'Walk-in'}</span>
                                                    <div className={cn('w-2 h-2 rounded-full shrink-0', statusDot(b.status))} />
                                                </div>
                                                {!tight && (
                                                    <p className="opacity-85 truncate mt-0.5">{b.service}{b.duration ? ` · ${b.duration}` : ''}</p>
                                                )}
                                                <p className={cn('font-mono font-medium truncate', tight ? 'text-[9px] mt-0.5 opacity-90' : 'text-[10px] mt-0.5 opacity-90')}>
                                                    {formatTimeRange(b.time, event.durationMins)}
                                                </p>
                                                {roomy && b.client_phone && (
                                                    <p className="opacity-60 text-[10px] font-mono truncate mt-1">{b.client_phone}</p>
                                                )}
                                            </motion.div>
                                        );
                                    }
                                    const e = item.e;
                                    const displayName = e.clientName ?? e.attendee ?? e.summary.replace(/^✂️\s*/, '').split(/[—–-]/)[0].trim();
                                    return (
                                        <div
                                            onClick={ev => { ev.stopPropagation(); setActiveExternal(e); }}
                                            className={cn(
                                                'h-full rounded-md border cursor-pointer transition-all hover:brightness-110 overflow-hidden flex flex-col justify-center bg-violet-950/90 border-violet-400/60 text-violet-100 shadow-lg shadow-black/20',
                                                tight ? 'px-2 py-1 text-[10px]' : 'px-2 py-1.5 text-[11px]',
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-2 min-w-0">
                                                <span className="font-semibold text-white truncate">{displayName || 'External event'}</span>
                                                <span className="text-[9px] uppercase tracking-widest text-violet-200/70 shrink-0">GCal</span>
                                            </div>
                                            {!tight && <p className="text-violet-200/75 text-[10px] truncate mt-0.5">{e.barberName}</p>}
                                            <p className={cn('font-mono font-medium truncate', tight ? 'text-[11px] mt-0.5 opacity-90' : 'text-xs sm:text-sm mt-1 opacity-90')}>
                                                {formatTimeRange(e.time, event.durationMins)}
                                            </p>
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
                            <TimelineDayGrid
                                emphasized
                                columns={weekDays.map(day => {
                                    const dayKey = format(day, 'yyyy-MM-dd');
                                    const count = bookingsForDay(day).length + externalForDay(day).length;
                                    return {
                                        id: dayKey,
                                        header: (
                                            <button
                                                onClick={() => { setSelectedDate(day); setView('day'); }}
                                                className={cn('w-full text-center rounded-savron p-1 hover:bg-white/5 transition-colors', isToday(day) && 'bg-savron-green/5')}
                                            >
                                                <p className={cn('text-xs sm:text-sm font-heading uppercase tracking-widest', isToday(day) ? 'text-savron-green' : 'text-white')}>{format(day, 'EEE')}</p>
                                                <p className={cn('text-lg sm:text-xl font-mono font-semibold', isToday(day) ? 'text-savron-green' : 'text-savron-silver/80')}>{format(day, 'd')}</p>
                                                {count > 0 && <span className="text-[10px] sm:text-xs text-savron-silver/60 uppercase tracking-widest">{count} appt{count !== 1 ? 's' : ''}</span>}
                                            </button>
                                        ),
                                    };
                                })}
                                columnWidth="min-w-[220px] sm:min-w-[260px]"
                                getEventsForColumn={timelineEventsForDay}
                                renderEvent={(event, _columnId, layout) => renderTimelineEvent(event, layout, timelineItemMap, true)}
                            />
                        </div>
                    )}

                    {/* ══════════════════════════════════════
                        MONTH VIEW
                    ══════════════════════════════════════ */}
                    {view === 'month' && (
                        <div className="flex-1 overflow-auto p-6">
                            <div className="grid grid-cols-7 mb-1">
                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                                    <div key={d} className="text-center py-2 text-xs uppercase tracking-widest text-savron-silver/80 font-semibold">{d}</div>
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
                                    ].sort((a, b) =>
                                        timeToMins(a.type === 'booking' ? a.b.time : a.e.time) -
                                        timeToMins(b.type === 'booking' ? b.b.time : b.e.time)
                                    );
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
                                <button onClick={() => { setActiveBooking(null); setConfirmDelete(false); setClientPhotoError(null); }}
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
                                                <Image src={activeBooking.client_photo_url} alt="Client" fill sizes="64px" className="object-cover" />
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
                                    {clientPhotoError && (
                                        <p className="mt-2 text-[11px] text-red-400">{clientPhotoError}</p>
                                    )}
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
                                            className="flex items-center justify-center gap-2 py-2.5 text-[11px] uppercase tracking-widest font-medium bg-savron-green/15 hover:bg-savron-green/25 text-accent-blue hover:text-savron-cream border border-savron-green/30 hover:border-savron-green/50 rounded-savron transition-all"
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
                                        onChange={e => setQuickForm(f => ({ ...f, service: e.target.value, time: '' }))}
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
