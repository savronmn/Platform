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

const WalkInModal    = dynamic(() => import('@/components/crm/WalkInModal'),     { ssr: false });
const EditBookingModal = dynamic(() => import('@/components/crm/EditBookingModal'), { ssr: false });

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG = {
    confirmed:  { label: 'Confirmed',  dot: 'bg-emerald-400 animate-pulse', pill: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
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
    function handleBookingSaved(updated: Booking) {
        setBookings(prev => prev.map(b => b.id === updated.id ? updated : b));
    }

    async function quickStatus(booking: Booking, status: Booking['status']) {
        const { data } = await supabase
            .from('bookings').update({ status }).eq('id', booking.id).select().single();
        if (data) handleBookingSaved(data as Booking);
    }

    // ── render ────────────────────────────────────────────────────────────────
    const today = new Date();

    const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="flex flex-col gap-5 entry-fade h-[calc(100vh-6rem)]">
            {/* ── Header ── */}
            <div className="flex items-center justify-between flex-wrap gap-3 shrink-0">
                <div>
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Calendar</h1>
                    <p className="text-savron-silver text-sm uppercase tracking-wider mt-1">
                        Appointments &amp; Walk-ins
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Barber filter */}
                    <div className="relative">
                        <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-savron-silver pointer-events-none" />
                        <select
                            value={barberFilter}
                            onChange={e => setBarberFilter(e.target.value)}
                            className="pl-7 pr-3 py-2 text-[10px] uppercase tracking-widest bg-white/5 border border-white/10 rounded-savron text-savron-silver focus:outline-none focus:border-white/20 appearance-none"
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
                            "flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-widest border rounded-savron transition-all",
                            showCancelled
                                ? "bg-white/10 border-white/20 text-white"
                                : "bg-white/5 border-white/10 text-savron-silver hover:text-white"
                        )}
                    >
                        <Filter className="w-3 h-3" />
                        {showCancelled ? 'Hiding none' : 'Show cancelled'}
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={fetchAll}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 text-[10px] uppercase tracking-widest bg-white/5 border border-white/10 rounded-savron text-savron-silver hover:text-white transition-all disabled:opacity-40"
                    >
                        <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
                    </button>

                    {/* Walk-in */}
                    <button
                        onClick={() => setShowWalkIn(true)}
                        className="flex items-center gap-2 px-4 py-2 text-[10px] uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all"
                    >
                        <UserPlus className="w-3.5 h-3.5" /> Walk-in
                    </button>
                </div>
            </div>

            {/* ── Main grid: Calendar + Day panel ── */}
            <div className="flex gap-4 flex-1 min-h-0">

                {/* ── Calendar ── */}
                <div className="flex flex-col flex-1 card-savron min-w-0 overflow-hidden">
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
                            <div key={d} className="text-center text-[9px] uppercase tracking-widest text-savron-silver/50 py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Day cells */}
                    <div className="grid grid-cols-7 flex-1 gap-px overflow-auto">
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
                                        "flex flex-col items-start p-1.5 rounded-lg text-left transition-all min-h-[60px] relative",
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
                                                    "text-[9px] leading-none",
                                                    confirmed > 0 ? "text-emerald-400" : "text-savron-silver/50"
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
                </div>

                {/* ── Day Detail Panel ── */}
                <div className="w-80 shrink-0 card-savron flex flex-col overflow-hidden">
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
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
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
                                    className="text-emerald-400 hover:text-emerald-300 text-[10px] uppercase tracking-widest transition-colors"
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
                                />
                            ))
                        )}
                    </div>
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
}

function AppointmentCard({ booking, onEdit, onStatusChange }: AppointmentCardProps) {
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
                    <span className="font-mono text-xs text-emerald-400">{booking.time}</span>
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
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-widest bg-savron-green/15 hover:bg-savron-green/25 border border-savron-green/30 hover:border-savron-green/50 rounded-savron text-emerald-400 hover:text-emerald-300 font-medium transition-all"
                >
                    <Pencil className="w-3 h-3" /> Edit Appointment
                </button>

                {booking.status === 'confirmed' && (
                    <>
                        <button
                            onClick={() => onStatusChange('completed')}
                            className="flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-widest bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded text-blue-400 hover:text-blue-300 transition-all"
                        >
                            <CheckCircle2 className="w-2.5 h-2.5" /> Done
                        </button>
                        <button
                            onClick={() => onStatusChange('cancelled')}
                            className="flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-widest bg-red-500/5 hover:bg-red-500/10 border border-red-500/15 rounded text-red-400/70 hover:text-red-400 transition-all"
                        >
                            <XCircle className="w-2.5 h-2.5" /> Cancel
                        </button>
                    </>
                )}

                {booking.status === 'completed' && (
                    <button
                        onClick={() => onStatusChange('confirmed')}
                        className="flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-widest bg-white/5 hover:bg-white/10 border border-white/10 rounded text-savron-silver hover:text-white transition-all"
                    >
                        ↩ Revert
                    </button>
                )}

                {booking.status === 'cancelled' && (
                    <button
                        onClick={() => onStatusChange('confirmed')}
                        className="flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-widest bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded text-emerald-400 transition-all"
                    >
                        ↩ Restore
                    </button>
                )}
            </div>
        </div>
    );
}
