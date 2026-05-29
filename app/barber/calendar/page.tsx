"use client";

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import {
    format, addDays, subDays, addWeeks, subWeeks,
    startOfWeek, endOfWeek, eachDayOfInterval,
    isToday, isSunday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Barber, Booking } from '@/lib/types';
import { TIME_SLOTS, SERVICE_COLORS } from '@/lib/services-data';

type CalView = 'day' | 'week';

export default function BarberCalendarPage() {
    const supabase = createClient();
    const [view, setView] = useState<CalView>('day');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [barber, setBarber] = useState<Barber | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

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

    const weekDays = useMemo(() => {
        const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
        const end = endOfWeek(selectedDate, { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [selectedDate]);

    const navigate = (dir: -1 | 1) => {
        if (view === 'day') {
            let next = dir === 1 ? addDays(selectedDate, 1) : subDays(selectedDate, 1);
            // Skip Sundays
            if (isSunday(next)) next = dir === 1 ? addDays(next, 1) : subDays(next, 1);
            setSelectedDate(next);
        } else {
            setSelectedDate(dir === 1 ? addWeeks(selectedDate, 1) : subWeeks(selectedDate, 1));
        }
    };

    const bookingsForDate = (dateStr: string) =>
        bookings.filter(b => b.date === dateStr);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
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

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="font-heading text-2xl uppercase tracking-widest text-white">My Calendar</h1>
                <div className="flex gap-2">
                    {(['day', 'week'] as const).map(v => (
                        <button
                            key={v}
                            onClick={() => setView(v)}
                            className={cn(
                                "px-4 py-2 text-xs uppercase tracking-widest border rounded-savron transition-all",
                                view === v
                                    ? "bg-savron-green/15 text-savron-green border-savron-green/20"
                                    : "text-savron-silver border-white/5 hover:text-white"
                            )}
                        >
                            {v}
                        </button>
                    ))}
                </div>
            </div>

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
                        <p className="text-savron-green text-[10px] uppercase tracking-widest mt-0.5">Today</p>
                    )}
                </div>
                <button onClick={() => navigate(1)} className="p-2 text-savron-silver hover:text-white transition-colors">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Today button */}
            {!isToday(selectedDate) && (
                <button
                    onClick={() => setSelectedDate(new Date())}
                    className="text-xs uppercase tracking-widest text-savron-green hover:text-savron-green-light transition-colors"
                >
                    Jump to Today
                </button>
            )}

            {/* Day View */}
            {view === 'day' && (
                <div className="space-y-2">
                    {TIME_SLOTS.map((slot) => {
                        const dateStr = format(selectedDate, 'yyyy-MM-dd');
                        const booking = bookingsForDate(dateStr).find(b => b.time === slot);
                        const colorClass = booking ? SERVICE_COLORS[booking.service] || 'bg-white/10 border-white/20 text-white' : '';
                        return (
                            <div
                                key={slot}
                                className={cn(
                                    "flex items-center gap-4 p-4 border rounded-savron transition-all",
                                    booking
                                        ? `${colorClass}`
                                        : "border-white/[0.04] bg-savron-grey/50"
                                )}
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
                        return (
                            <div
                                key={dateStr}
                                onClick={() => { setSelectedDate(day); setView('day'); }}
                                className={cn(
                                    "bg-savron-grey border rounded-savron p-4 cursor-pointer transition-all hover:border-white/20",
                                    isToday(day) ? "border-savron-green/30" : "border-white/5"
                                )}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <p className={cn(
                                        "text-xs uppercase tracking-widest font-heading",
                                        isToday(day) ? "text-savron-green" : "text-savron-silver"
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
