"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { CreditCard, Calendar, Star, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Client, Booking } from '@/lib/types';
import Link from 'next/link';

const tierConfig = {
    standard: { label: 'Standard', color: 'text-savron-silver', border: 'border-savron-silver/30', bg: 'bg-savron-silver/10', next: 'Inner Circle', visitsNeeded: 10 },
    inner_circle: { label: 'Inner Circle', color: 'text-blue-400', border: 'border-blue-400/30', bg: 'bg-blue-400/10', next: 'VIP', visitsNeeded: 25 },
    vip: { label: 'VIP', color: 'text-yellow-400', border: 'border-yellow-400/30', bg: 'bg-yellow-400/10', next: null, visitsNeeded: 0 },
};

export default function MembershipDashboard() {
    const supabase = createClient();
    const [client, setClient] = useState<Client | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: clientData } = await supabase
                .from('clients')
                .select('*')
                .eq('auth_id', user.id)
                .single();

            if (clientData) {
                setClient(clientData);

                const { data: bookingsData } = await supabase
                    .from('bookings')
                    .select('*')
                    .eq('client_email', clientData.email)
                    .order('date', { ascending: false });

                if (bookingsData) setBookings(bookingsData);
            }
            setLoading(false);
        }
        load();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    if (!client) {
        return (
            <div className="text-center py-20 space-y-4">
                <h1 className="font-heading text-2xl uppercase tracking-widest text-white">Profile Not Found</h1>
                <p className="text-savron-silver text-sm">Your account isn&apos;t linked to a client profile.</p>
            </div>
        );
    }

    const tier = tierConfig[client.membership_status];
    const today = new Date().toISOString().split('T')[0];
    const upcomingBookings = bookings.filter(b => b.date >= today && b.status === 'confirmed');
    const pastBookings = bookings.filter(b => b.date < today || b.status === 'completed');

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Welcome, {client.name.split(' ')[0]}</h1>
                <p className="text-savron-silver text-sm mt-1">SAVRON Members Club</p>
            </div>

            {/* Membership Card */}
            <div className={cn("border rounded-savron p-8 relative overflow-hidden", tier.border, tier.bg)}>
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Star className={cn("w-5 h-5", tier.color)} />
                            <span className={cn("font-heading uppercase tracking-widest text-lg", tier.color)}>{tier.label}</span>
                        </div>
                        <p className="text-white text-sm">{client.name}</p>
                        <p className="text-savron-silver text-xs">{client.email}</p>
                    </div>
                    <div className="space-y-1 text-left md:text-right">
                        <p className="text-white text-4xl font-heading">{client.visit_count}</p>
                        <p className="text-savron-silver text-xs uppercase tracking-widest">Total Visits</p>
                        {tier.next && (
                            <p className="text-xs text-savron-silver/60">
                                {tier.visitsNeeded - client.visit_count} more to reach {tier.next}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="bg-savron-grey border border-white/5 rounded-savron p-3 sm:p-5">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-savron-blue-light shrink-0" />
                        <span className="text-savron-silver text-[10px] sm:text-xs uppercase tracking-widest truncate">Upcoming</span>
                    </div>
                    <p className="text-white text-xl sm:text-2xl font-heading">{upcomingBookings.length}</p>
                </div>
                <div className="bg-savron-grey border border-white/5 rounded-savron p-3 sm:p-5">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400 shrink-0" />
                        <span className="text-savron-silver text-[10px] sm:text-xs uppercase tracking-widest truncate">Visits</span>
                    </div>
                    <p className="text-white text-xl sm:text-2xl font-heading">{pastBookings.length}</p>
                </div>
                <div className="bg-savron-grey border border-white/5 rounded-savron p-3 sm:p-5">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                        <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400 shrink-0" />
                        <span className="text-savron-silver text-[10px] sm:text-xs uppercase tracking-widest truncate">Tier</span>
                    </div>
                    <p className={cn("text-xl sm:text-2xl font-heading truncate", tier.color)}>{tier.label}</p>
                </div>
            </div>

            {/* Upcoming Appointments */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-heading text-xl uppercase tracking-widest text-white">Upcoming</h2>
                    <Link href="/booking" className="text-savron-blue-light hover:text-savron-blue-light text-xs uppercase tracking-widest hover:underline">Book New</Link>
                </div>
                {upcomingBookings.length === 0 ? (
                    <div className="text-center py-12 bg-savron-grey border border-white/5 rounded-savron">
                        <p className="text-savron-silver text-sm uppercase tracking-wider">No upcoming appointments</p>
                        <Link href="/booking" className="text-savron-blue-light hover:text-savron-blue-light text-xs uppercase tracking-widest mt-2 inline-block hover:underline">Book Now</Link>
                    </div>
                ) : (
                    upcomingBookings.map(b => (
                        <div key={b.id} className="bg-savron-grey border border-white/5 rounded-savron p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-savron-green/10 border border-savron-green/20 rounded-full flex items-center justify-center">
                                    <Calendar className="w-4 h-4 text-savron-blue-light" />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">{b.service}</p>
                                    <p className="text-savron-silver text-xs">{b.barber_name} · {b.date} · {b.time}</p>
                                </div>
                            </div>
                            {b.price && <span className="text-savron-silver font-mono text-sm">{b.price}</span>}
                        </div>
                    ))
                )}
            </div>

            {/* Recent History */}
            {pastBookings.length > 0 && (
                <div className="space-y-4">
                    <h2 className="font-heading text-xl uppercase tracking-widest text-white">Recent History</h2>
                    {pastBookings.slice(0, 5).map(b => (
                        <div key={b.id} className="bg-savron-grey border border-white/5 rounded-savron p-5 flex items-center justify-between opacity-60">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-savron-charcoal border border-white/10 rounded-full flex items-center justify-center">
                                    <User className="w-4 h-4 text-savron-silver" />
                                </div>
                                <div>
                                    <p className="text-white font-medium text-sm">{b.service}</p>
                                    <p className="text-savron-silver text-xs">{b.barber_name} · {b.date}</p>
                                </div>
                            </div>
                            <span className={cn("text-xs uppercase tracking-wider", b.status === 'completed' ? 'text-green-400' : 'text-savron-silver')}>{b.status}</span>
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}
