"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Calendar, User, ChevronDown, ChevronUp, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Booking } from '@/lib/types';
import { triggerCancelBooking } from '@/lib/confirm-booking';

export default function MemberBookingsPage() {
    const supabase = createClient();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'upcoming' | 'past'>('upcoming');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [cancelError, setCancelError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: client } = await supabase
                .from('clients')
                .select('id')
                .eq('auth_id', user.id)
                .single();

            if (client) {
                const { data } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('client_id', client.id)
                    .order('date', { ascending: false })
                    .order('time', { ascending: false });
                if (data) setBookings(data);
            } else {
                const { data } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('client_email', user.email)
                    .order('date', { ascending: false })
                    .order('time', { ascending: false });
                if (data) setBookings(data);
            }
            setLoading(false);
        }
        load();
    }, []);

    const handleCancel = async (booking: Booking) => {
        if (!confirm(`Cancel your ${booking.service} appointment on ${booking.date} at ${booking.time}?`)) return;
        setCancellingId(booking.id);
        setCancelError(null);
        const result = await triggerCancelBooking(booking.id);
        if (result.success) {
            setBookings(prev => prev.map(b =>
                b.id === booking.id ? { ...b, status: 'cancelled' } : b
            ));
            setExpandedId(null);
        } else {
            setCancelError(result.error ?? 'Could not cancel booking');
        }
        setCancellingId(null);
    };

    const today = new Date().toISOString().split('T')[0];
    const filtered = bookings.filter(b =>
        filter === 'upcoming' ? b.date >= today : b.date < today
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h1 className="font-heading text-2xl uppercase tracking-widest text-white">My Bookings</h1>

            {cancelError && (
                <div className="px-4 py-3 border border-red-500/20 bg-red-500/10 rounded-savron text-red-400 text-sm">
                    {cancelError}
                </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2">
                {(['upcoming', 'past'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "px-4 py-2 rounded-savron text-xs uppercase tracking-widest transition-all border",
                            filter === f
                                ? "bg-savron-green border border-savron-green-light/20 text-white"
                                : "text-savron-silver border-white/5 hover:text-white"
                        )}
                    >
                        {f} ({bookings.filter(b => f === 'upcoming' ? b.date >= today : b.date < today).length})
                    </button>
                ))}
            </div>

            {/* Bookings */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-savron-grey border border-white/5 rounded-savron">
                    <Calendar className="w-8 h-8 text-savron-silver/20 mx-auto mb-3" />
                    <p className="text-savron-silver text-sm uppercase tracking-wider">
                        No {filter} bookings
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(booking => {
                        const isExpanded = expandedId === booking.id;
                        const canCancel = booking.status === 'confirmed' && booking.date >= today;
                        return (
                            <div
                                key={booking.id}
                                className="bg-savron-grey border border-white/5 rounded-savron overflow-hidden transition-all"
                            >
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                                    className="w-full p-5 flex items-center justify-between text-left"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-savron-charcoal border border-white/10 rounded-full flex items-center justify-center flex-shrink-0">
                                            <User className="w-4 h-4 text-savron-silver" />
                                        </div>
                                        <div>
                                            <p className="text-white text-sm font-medium">{booking.service}</p>
                                            <p className="text-savron-silver/60 text-xs">
                                                {format(new Date(booking.date + 'T12:00:00'), 'EEE, MMM d')} · {booking.time}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={cn(
                                            "text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-sm border",
                                            booking.status === 'confirmed' ? "text-emerald-300 border-savron-green/35 bg-savron-green/15" :
                                            booking.status === 'completed' ? "text-green-400 border-green-500/20 bg-green-500/10" :
                                            booking.status === 'cancelled' ? "text-red-400 border-red-500/20 bg-red-500/10" :
                                            "text-yellow-400 border-yellow-500/20 bg-yellow-500/10"
                                        )}>
                                            {booking.status}
                                        </span>
                                        {isExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-savron-silver/40" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-savron-silver/40" />
                                        )}
                                    </div>
                                </button>

                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-0 border-t border-white/[0.04] space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-savron-silver/60">Barber</span>
                                            <span className="text-white">{booking.barber_name || '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-savron-silver/60">Duration</span>
                                            <span className="text-white">{booking.duration || '—'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-savron-silver/60">Price</span>
                                            <span className="text-white font-mono">{booking.price || '—'}</span>
                                        </div>
                                        {booking.notes && (
                                            <div className="pt-2 border-t border-white/[0.04]">
                                                <p className="text-savron-silver/40 text-xs uppercase tracking-widest mb-1">Notes</p>
                                                <p className="text-savron-silver text-xs">{booking.notes}</p>
                                            </div>
                                        )}
                                        {canCancel && (
                                            <div className="pt-3 border-t border-white/[0.04]">
                                                <button
                                                    onClick={() => handleCancel(booking)}
                                                    disabled={cancellingId === booking.id}
                                                    className="flex items-center gap-2 px-4 py-2 text-[11px] uppercase tracking-widest text-red-400 border border-red-500/20 rounded-savron hover:bg-red-500/10 transition-all disabled:opacity-50"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    {cancellingId === booking.id ? 'Cancelling…' : 'Cancel Appointment'}
                                                </button>
                                            </div>
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
