"use client";

import { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
    Calendar, UserPlus, Pencil,
    CheckCircle2, XCircle, Clock, Filter, RefreshCw, Users
} from 'lucide-react';
import { format, startOfMonth, endOfMonth,
         startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay,
         parseISO } from 'date-fns';
import { createClient } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { Booking, Barber } from '@/lib/types';
import CalendarNavBar from '@/components/calendar/CalendarNavBar';
import CalendarScrollArea from '@/components/calendar/CalendarScrollArea';
import { triggerCancelBooking } from '@/lib/confirm-booking';
import { useBookingsRealtime } from '@/lib/use-bookings-realtime';

const WalkInModal    = dynamic(() => import('@/components/crm/WalkInModal'),     { ssr: false });
const EditBookingModal = dynamic(() => import('@/components/crm/EditBookingModal'), { ssr: false });

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    confirmed:  { label: 'Confirmed',  dot: 'bg-savron-blue-light animate-pulse', pill: 'bg-savron-blue/15 text-accent-blue border-savron-blue/30' },
    completed:  { label: 'Completed',  dot: 'bg-blue-400',                  pill: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    cancelled:  { label: 'Cancelled',  dot: 'bg-white/20',                  pill: 'bg-white/5 text-white/30 border-white/10' },
    no_show:    { label: 'No-show',    dot: 'bg-red-400/60',                pill: 'bg-red-500/10 text-red-400/70 border-red-500/20' },
} satisfies Record<Booking['status'], { label: string; dot: string; pill: string }>;

// Calendar dot color (compact) based on status
function statusDot(s: Booking['status']) {
    return STATUS_CONFIG[s]?.dot ?? 'bg-white/20';
}

// ─── Day helpers ─────────────────────────────────────────────────────────────

function buildCalendarDays(month: Date): Date[] {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end   = endOfWeek(endOfMonth(month),     { weekStartsOn: 0 });
    const days: Date[] = [];
    let cur = start;
    while (cur <= end) { days.push(cur); cur = addDays(cur, 1); }
    return days;
}

function toDateKey(d: Date) { return format(d, 'yyyy-MM-dd'); }

// ─── Component ───────────────────────────────────────────────────────────────

export default function BookingsPage() {
    const supabase = createClient();

    // ── state ────────────────────────────────────────────────────────────────
    const [bookings,       setBookings]       = useState<Booking[]>([]);
    const [barbers,        setBarbers]        = useState<Barber[]>([]);
    const [loading,        setLoading]        = useState(true);
    const [currentMonth,   setCurrentMonth]   = useState(new Date());
    const [selectedDay,    setSelectedDay]    = useState<Date>(new Date());
    const [showWalkIn,     setShowWalkIn]     = useState(false);
    const [editBooking,    setEditBooking]    = useState<Booking | null>(null);
    const [showCancelled,  setShowCancelled]  = useState(false);
    const [barberFilter,   setBarberFilter]   = useState<string>('all');
    const [statusError,    setStatusError]    = useState<string | null>(null);
    const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

    // ── fetch ────────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true);
        const [bookRes, barberRes] = await Promise.all([
            supabase.from('bookings').select('*').order('date').order('time'),
            supabase.from('barbers').select('id, name, active').order('name'),
        ]);
        if (!bookRes.error) {
            const raw = bookRes.data as Booking[];

            // Pass 1: deduplicate by Supabase row id
            const byId = Array.from(
                new Map(raw.map(b => [b.id, b])).values()
            );

            // Pass 2: deduplicate by composite key — catches GCal sync duplicates
            // where the same appointment was written twice with different IDs.
            // We keep whichever row came first (lowest created_at).
            const seen = new Set<string>();
            const deduped = byId.filter(b => {
                // Build a fingerprint: date|time|barber_id|normalized_client_name
                const name = (b.client_name ?? 'walkin').toLowerCase().trim();
                const key  = `${b.date}|${b.time}|${b.barber_id ?? ''}|${name}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });

            setBookings(deduped);
        }
        if (!barberRes.error) setBarbers((barberRes.data as Barber[]) ?? []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useBookingsRealtime(fetchAll, 'admin-bookings');

    // ── derived data ─────────────────────────────────────────────────────────
    const visibleBookings = useMemo(() => {
        return bookings.filter(b => {
            if (!showCancelled && (b.status === 'cancelled' || b.status === 'no_show')) return false;
            if (barberFilter !== 'all' && b.barber_id !== barberFilter) return false;
            return true;
        });
    }, [bookings, showCancelled, barberFilter]);

    // Map: dateKey → bookings[]
    const bookingsByDay = useMemo(() => {
        const map = new Map<string, Booking[]>();
        for (const b of visibleBookings) {
            const key = b.date; // already 'yyyy-MM-dd'
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(b);
        }
        return map;
    }, [visibleBookings]);

    const selectedDayKey      = toDateKey(selectedDay);
    const selectedDayBookings = useMemo(
        () => (bookingsByDay.get(selectedDayKey) ?? []).sort((a, b) => a.time.localeCompare(b.time)),
        [bookingsByDay, selectedDayKey]
    );

    const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);

    // ── handlers ─────────────────────────────────────────────────────────────
    function handleBookingSaved() {
        void fetchAll();
    }

    async function quickStatus(booking: Booking, status: Booking['status']) {
        if (status === 'cancelled' && booking.status === 'confirmed') {
            setStatusUpdatingId(booking.id);
            setStatusError(null);
            const result = await triggerCancelBooking(booking.id);
            if (result.success) {
                await fetchAll();
                setStatusError(result.warning ?? null);
            } else {
                setStatusError(result.error ?? 'Could not cancel appointment');
            }
            setStatusUpdatingId(null);
            return;
        }

        const { data, error } = await supabase
            .from('bookings').update({ status }).eq('id', booking.id).select().single();
        if (error) {
            setStatusError(error.message);
            return;
        }
        if (data) {
            setStatusError(null);
            handleBookingSaved();
        }
    }

    // ── render ────────────────────────────────────────────────────────────────
    const today = new Date();

    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="flex flex-col gap-6 lg:gap-8 entry-fade lg:h-[calc(100vh-8rem)]">
            {/* ── Header ── */}
            <div className="admin-header shrink-0">
                <div>
                    <p className="admin-kicker">Bookings</p>
                    <h1 className="admin-title">Calendar</h1>
                    <p className="admin-subtitle">
                        Appointments &amp; Walk-ins
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    {/* Barber filter */}
                    <div className="relative flex-1 sm:flex-none min-w-[140px]">
                        <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-savron-silver pointer-events-none" />
                        <select
                            value={barberFilter}
                            onChange={e => setBarberFilter(e.target.value)}
                            className="w-full pl-7 pr-3 py-2.5 min-h-11 text-xs uppercase tracking-widest bg-white/5 border border-white/10 rounded-savron text-savron-silver focus:outline-none focus:border-white/20 appearance-none"
                        >
                            <option value="all" className="bg-savron-grey">All Barbers</option>
                            {barbers.map(b => (
                                <option key={b.id} value={b.id} className="bg-savron-grey">{b.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Show cancelled toggle */}
                    <button
                        onClick={() => setShowCancelled(v => !v)}
                        className={cn(
                            "admin-action-btn border rounded-savron transition-all",
                            showCancelled
                                ? "bg-white/10 border-white/20 text-white"
                                : "bg-white/5 border-white/10 text-savron-silver hover:text-white"
                        )}
                    >
                        <Filter className="w-3.5 h-3.5" />
                        {showCancelled ? 'All statuses' : 'Cancelled'}
                    </button>

                    <button
                        onClick={fetchAll}
                        disabled={loading}
                        className="admin-action-btn bg-white/5 border border-white/10 rounded-savron text-savron-silver hover:text-white transition-all disabled:opacity-40"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                    </button>

                    <button
                        onClick={() => setShowWalkIn(true)}
                        className="admin-action-btn bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all w-full sm:w-auto"
                    >
                        <UserPlus className="w-3.5 h-3.5" /> Walk-in
                    </button>
                </div>
            </div>

            {statusError && (
                <div className="px-4 py-2 border border-red-500/20 bg-red-500/10 rounded-savron text-red-400 text-xs shrink-0">
                    {statusError}
                </div>
            )}

            {/* ── Main grid: Calendar + Day panel ── */}
            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0">

                {/* ── Calendar ── */}
                <div className="flex flex-col flex-1 card-savron min-w-0 overflow-hidden min-h-[320px] lg:min-h-0">
                    <CalendarNavBar
                        view="month"
                        onViewChange={() => {}}
                        selectedDate={selectedDay}
                        onDateChange={date => {
                            setSelectedDay(date);
                            setCurrentMonth(startOfMonth(date));
                        }}
                        views={[]}
                        className="mb-4 shrink-0"
                    />

                    {/* Day labels */}
                    <div className="grid grid-cols-7 mb-1 shrink-0">
                        {DAY_LABELS.map(d => (
                            <div key={d} className="text-center text-[10px] sm:text-[9px] uppercase tracking-widest text-savron-silver/50 py-1">
                                <span className="hidden sm:inline">{d}</span>
                                <span className="sm:hidden">{d.charAt(0)}</span>
                            </div>
                        ))}
                    </div>

                    {/* Day cells */}
                    <CalendarScrollArea
                        fill
                        gestureOrientation="vertical"
                        maxHeightClass="min-h-[240px]"
                        className="border-0 rounded-none"
                    >
                        <div className="grid grid-cols-7 gap-px">
                        {calendarDays.map(day => {
                            const key          = toDateKey(day);
                            const dayBookings  = bookingsByDay.get(key) ?? [];
                            const isToday      = isSameDay(day, today);
                            const isSelected   = isSameDay(day, selectedDay);
                            const isCurrentMo  = isSameMonth(day, currentMonth);
                            const confirmed    = dayBookings.filter(b => b.status === 'confirmed').length;
                            const completed    = dayBookings.filter(b => b.status === 'completed').length;
                            const total        = dayBookings.length;

                            return (
                                <button
                                    key={key}
                                    onClick={() => setSelectedDay(day)}
                                    className={cn(
                                        "flex flex-col items-start p-1 sm:p-1.5 rounded-lg text-left transition-all min-h-[52px] sm:min-h-[60px] relative touch-manipulation",
                                        isCurrentMo ? "hover:bg-savron-blue/5" : "opacity-30",
                                        isSelected && "bg-savron-blue/10 ring-1 ring-savron-blue/35",
                                    )}
                                >
                                    <span className={cn(
                                        "text-[11px] font-mono leading-none mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full",
                                        isToday && !isSelected && "bg-savron-blue/15 text-savron-blue-light font-bold",
                                        isToday && isSelected && "bg-savron-blue text-white font-bold",
                                        !isToday && isSelected && "text-white",
                                        !isToday && !isSelected && (isCurrentMo ? "text-savron-cream/75" : "text-savron-silver"),
                                    )}>
                                        {format(day, 'd')}
                                    </span>

                                    {/* Appointment indicators */}
                                    {total > 0 && (
                                        <div className="flex flex-col gap-0.5 w-full">
                                            {/* Compact dot row */}
                                            <div className="flex gap-0.5 flex-wrap">
                                                {dayBookings.slice(0, 5).map(b => (
                                                    <div
                                                        key={b.id}
                                                        className={cn("w-1.5 h-1.5 rounded-full", statusDot(b.status))}
                                                    />
                                                ))}
                                                {total > 5 && (
                                                    <span className="text-[8px] text-savron-silver/60">+{total - 5}</span>
                                                )}
                                            </div>
                                            {/* Count badge */}
                                            {total > 0 && (
                                                <span className={cn(
                                                    "text-[9px] leading-none hidden sm:inline",
                                                    confirmed > 0 ? "text-accent-blue" : "text-savron-silver/50"
                                                )}>
                                                    {confirmed > 0 && `${confirmed} conf`}
                                                    {confirmed > 0 && completed > 0 && ' · '}
                                                    {completed > 0 && `${completed} done`}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                        </div>
                    </CalendarScrollArea>
                </div>

                {/* ── Day Detail Panel ── */}
                <div className="w-full lg:w-80 lg:shrink-0 card-savron flex flex-col overflow-hidden min-h-[280px] lg:min-h-0">
                    {/* Panel header */}
                    <div className="shrink-0 pb-4 border-b border-white/5 mb-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-savron-green" />
                            <span className="font-heading text-sm uppercase tracking-widest text-white">
                                {isSameDay(selectedDay, today) ? 'Today' : format(selectedDay, 'EEE, MMM d')}
                            </span>
                        </div>
                        <p className="text-savron-silver/60 text-[10px] uppercase tracking-widest mt-0.5">
                            {selectedDayBookings.length === 0
                                ? 'No appointments'
                                : `${selectedDayBookings.length} appointment${selectedDayBookings.length !== 1 ? 's' : ''}`}
                        </p>
                    </div>

                    {/* Appointment list */}
                    <CalendarScrollArea
                        fill
                        gestureOrientation="vertical"
                        className="border-0 rounded-none -mr-1 pr-1"
                    >
                        <div className="space-y-2">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
                            </div>
                        ) : selectedDayBookings.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                                <Calendar className="w-8 h-8 text-savron-silver/15" />
                                <p className="text-savron-silver/40 text-[11px] uppercase tracking-widest">
                                    No appointments
                                </p>
                                <button
                                    onClick={() => setShowWalkIn(true)}
                                    className="text-accent-blue hover:text-savron-cream text-[10px] uppercase tracking-widest transition-colors"
                                >
                                    + Add walk-in
                                </button>
                            </div>
                        ) : (
                            selectedDayBookings.map(booking => (
                                <AppointmentCard
                                    key={booking.id}
                                    booking={booking}
                                    onEdit={() => setEditBooking(booking)}
                                    onStatusChange={status => quickStatus(booking, status)}
                                    isUpdating={statusUpdatingId === booking.id}
                                />
                            ))
                        )}
                        </div>
                    </CalendarScrollArea>
                </div>
            </div>

            {/* ── Modals ── */}
            <WalkInModal
                open={showWalkIn}
                onClose={() => setShowWalkIn(false)}
                onBooked={fetchAll}
            />
            <EditBookingModal
                booking={editBooking}
                barbers={barbers}
                onClose={() => setEditBooking(null)}
                onSaved={handleBookingSaved}
            />
        </div>
    );
}

// ─── AppointmentCard ──────────────────────────────────────────────────────────

interface AppointmentCardProps {
    booking: Booking;
    onEdit: () => void;
    onStatusChange: (s: Booking['status']) => void;
    isUpdating?: boolean;
}

function AppointmentCard({ booking, onEdit, onStatusChange, isUpdating }: AppointmentCardProps) {
    const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.confirmed;

    return (
        <div className={cn(
            "rounded-lg border p-3 space-y-2 transition-all group",
            booking.status === 'cancelled' || booking.status === 'no_show'
                ? "bg-white/[0.02] border-white/5 opacity-50"
                : "bg-white/[0.04] border-white/10 hover:border-white/20"
        )}>
            {/* Time + status */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-savron-silver/50" />
                    <span className="font-mono text-xs text-accent-blue">{booking.time}</span>
                </div>
                <span className={cn(
                    "text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full border",
                    cfg.pill
                )}>
                    {cfg.label}
                </span>
            </div>

            {/* Client + service */}
            <div>
                <p className="text-white text-xs font-medium leading-tight">
                    {booking.client_name || 'Walk-in'}
                </p>
                <p className="text-savron-silver/70 text-[11px] mt-0.5">
                    {booking.service}
                    {booking.barber_name ? ` · ${booking.barber_name}` : ''}
                </p>
            </div>

            {/* Price + duration */}
            {(booking.price || booking.duration) && (
                <div className="flex gap-3">
                    {booking.price && (
                        <span className="font-mono text-[11px] text-savron-silver">{booking.price}</span>
                    )}
                    {booking.duration && (
                        <span className="text-[11px] text-savron-silver/50">{booking.duration}</span>
                    )}
                </div>
            )}

            {/* Notes */}
            {booking.notes && (
                <p className="text-[10px] text-savron-silver/50 italic border-t border-white/5 pt-1.5">
                    {booking.notes}
                </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1.5 border-t border-white/8 flex-wrap">
                <button
                    onClick={onEdit}
                    className="admin-action-btn bg-savron-green/15 hover:bg-savron-green/25 border border-savron-green/30 hover:border-savron-green/50 rounded-savron text-accent-blue hover:text-savron-cream font-medium transition-all"
                >
                    <Pencil className="w-3.5 h-3.5" /> Edit
                </button>

                {booking.status === 'confirmed' && (
                    <>
                        <button
                            onClick={() => onStatusChange('completed')}
                            className="admin-action-btn bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-savron text-blue-400 hover:text-blue-300 transition-all"
                        >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                        </button>
                        <button
                            onClick={() => onStatusChange('cancelled')}
                            disabled={isUpdating}
                            className="admin-action-btn bg-red-500/5 hover:bg-red-500/10 border border-red-500/15 rounded-savron text-red-400/70 hover:text-red-400 transition-all disabled:opacity-50"
                        >
                            <XCircle className="w-3.5 h-3.5" /> {isUpdating ? 'Cancelling…' : 'Cancel'}
                        </button>
                    </>
                )}

                {booking.status === 'completed' && (
                    <button
                        onClick={() => onStatusChange('confirmed')}
                        className="admin-action-btn bg-white/5 hover:bg-white/10 border border-white/10 rounded-savron text-savron-silver hover:text-white transition-all"
                    >
                        ↩ Revert
                    </button>
                )}

                {booking.status === 'cancelled' && (
                    <button
                        onClick={() => onStatusChange('confirmed')}
                        className="admin-action-btn bg-savron-blue/10 hover:bg-savron-blue/15 border border-savron-blue/20 rounded-savron text-accent-blue transition-all"
                    >
                        ↩ Restore
                    </button>
                )}
            </div>
        </div>
    );
}
