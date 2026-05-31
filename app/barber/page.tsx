"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Calendar, Clock, User, CheckCircle, AlertTriangle, Copy, Check, Link2, Link2Off } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Barber, Booking } from '@/lib/types';

export default function BarberDashboard() {
    const supabase = createClient();
    const [calConnected, setCalConnected] = useState(false);
    const [calError, setCalError] = useState<string | null>(null);
    const [barber, setBarber] = useState<Barber | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'today' | 'upcoming' | 'past'>('today');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        setCalConnected(params.get('cal_connected') === '1');
        setCalError(params.get('cal_error'));
    }, []);

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get barber record
            const { data: barberData } = await supabase
                .from('barbers')
                .select('*')
                .eq('auth_id', user.id)
                .single();

            if (barberData) {
                setBarber(barberData);

                // Get all bookings for this barber
                const { data: bookingsData } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('barber_id', barberData.id)
                    .order('date', { ascending: true })
                    .order('time', { ascending: true });

                if (bookingsData) setBookings(bookingsData);
            }
            setLoading(false);
        }
        load();
    }, []);

    const today = new Date().toISOString().split('T')[0];

    const filteredBookings = bookings.filter(b => {
        if (filter === 'today') return b.date === today;
        if (filter === 'upcoming') return b.date >= today && b.status === 'confirmed';
        return b.date < today;
    });

    const todayCount = bookings.filter(b => b.date === today).length;
    const completedCount = bookings.filter(b => b.status === 'completed').length;
    const noShowCount = bookings.filter(b => b.status === 'no_show').length;
    const upcomingCount = bookings.filter(b => b.date >= today && b.status === 'confirmed').length;

    const handleStatusUpdate = async (id: string, status: string) => {
        await supabase.from('bookings').update({ status }).eq('id', id);
        setBookings(prev => prev.map(b => b.id === id ? { ...b, status: status as Booking['status'] } : b));
        if (status === 'cancelled' || status === 'no_show') {
            fetch('/api/calendar/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: id, action: 'delete' }),
            }).catch(err => console.error('Failed to sync calendar deletion:', err));
        }
    };

    const copyBookingLink = () => {
        if (!barber) return;
        navigator.clipboard.writeText(`${window.location.origin}/book/${barber.slug}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Welcome, {barber.name.split(' ')[0]}</h1>
                    <p className="text-savron-silver text-sm mt-1">{barber.role}</p>
                </div>
                <button
                    onClick={copyBookingLink}
                    className="flex items-center gap-2 px-4 py-2 bg-savron-green text-white border border-savron-green-light/20 rounded-savron text-xs uppercase tracking-widest hover:bg-savron-green-light transition-all"
                >
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? 'Copied!' : 'Copy Booking Link'}
                </button>
            </div>

            {/* Google Calendar Connect */}
            {(calConnected || calError || !barber.google_calendar_id) && (
                <div className={cn(
                    "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-savron",
                    calConnected ? "bg-savron-green/20 border-savron-green-light/35" :
                    calError ? "bg-red-500/10 border-red-500/30" :
                    "bg-savron-grey border-white/10"
                )}>
                    <div className="flex items-center gap-3">
                        {calConnected ? (
                            <Link2 className="w-4 h-4 text-emerald-400" />
                        ) : calError ? (
                            <Link2Off className="w-4 h-4 text-red-400" />
                        ) : (
                            <Link2Off className="w-4 h-4 text-savron-silver" />
                        )}
                        <div>
                            <p className={cn("text-xs uppercase tracking-widest font-medium",
                                calConnected ? "text-emerald-400" : calError ? "text-red-400" : "text-savron-silver"
                            )}>
                                {calConnected ? "Google Calendar Connected" : calError ? "Connection Failed — Try Again" : "Google Calendar Not Connected"}
                            </p>
                            <p className="text-savron-silver/50 text-[11px] mt-0.5">
                                {calConnected ? "Bookings will sync automatically." : "Connect to sync bookings to your personal calendar."}
                            </p>
                        </div>
                    </div>
                    {!calConnected && (
                        <a
                            href={`/api/calendar/connect?barberId=${barber.id}`}
                            className="px-3 py-2 bg-white/5 border border-white/10 text-white text-xs uppercase tracking-widest rounded-savron hover:bg-white/10 transition-all"
                        >
                            Connect
                        </a>
                    )}
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Today", value: todayCount, icon: Calendar, color: "text-blue-400" },
                    { label: "Upcoming", value: upcomingCount, icon: Clock, color: "text-emerald-400" },
                    { label: "Completed", value: completedCount, icon: CheckCircle, color: "text-green-400" },
                    { label: "No Shows", value: noShowCount, icon: AlertTriangle, color: "text-yellow-400" },
                ].map(stat => (
                    <div key={stat.label} className="bg-savron-grey border border-white/5 rounded-savron p-5">
                        <div className="flex items-center gap-2 mb-2">
                            <stat.icon className={cn("w-4 h-4", stat.color)} />
                            <span className="text-savron-silver text-xs uppercase tracking-widest">{stat.label}</span>
                        </div>
                        <p className="text-white text-3xl font-heading">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
                {(['today', 'upcoming', 'past'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "px-4 py-2 rounded-savron text-xs uppercase tracking-widest transition-all border",
                            filter === f ? "bg-savron-green border border-savron-green-light/20 text-white" : "text-savron-silver border-white/5 hover:text-white"
                        )}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {/* Bookings List */}
            <div className="space-y-3">
                {filteredBookings.length === 0 ? (
                    <div className="text-center py-16 bg-savron-grey border border-white/5 rounded-savron">
                        <p className="text-savron-silver text-sm uppercase tracking-wider">No {filter} appointments</p>
                    </div>
                ) : (
                    filteredBookings.map(booking => (
                        <div key={booking.id} className="bg-savron-grey border border-white/5 rounded-savron p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-savron-charcoal border border-white/10 rounded-full flex items-center justify-center">
                                    <User className="w-4 h-4 text-savron-silver" />
                                </div>
                                <div>
                                    <p className="text-white font-medium">{booking.client_name || 'Walk-in'}</p>
                                    <p className="text-savron-silver text-xs">{booking.service} · {booking.time} · {booking.date}</p>
                                    {booking.client_phone && <p className="text-savron-silver/50 text-xs">{booking.client_phone}</p>}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {booking.price && <span className="text-savron-silver font-mono text-sm mr-2">{booking.price}</span>}

                                {booking.status === 'confirmed' && (
                                    <>
                                        <button onClick={() => handleStatusUpdate(booking.id, 'completed')} className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/20 rounded-savron text-xs uppercase tracking-wider hover:bg-green-500/20 transition-all">
                                            Complete
                                        </button>
                                        <button onClick={() => handleStatusUpdate(booking.id, 'no_show')} className="px-3 py-1 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-savron text-xs uppercase tracking-wider hover:bg-yellow-500/20 transition-all">
                                            No Show
                                        </button>
                                    </>
                                )}

                                {booking.status === 'completed' && (
                                    <span className="badge-approved">Completed</span>
                                )}
                                {booking.status === 'no_show' && (
                                    <span className="badge-pending">No Show</span>
                                )}
                                {booking.status === 'cancelled' && (
                                    <span className="badge-rejected">Cancelled</span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </motion.div>
    );
}
