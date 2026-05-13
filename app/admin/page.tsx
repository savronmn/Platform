"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import StatCard from '@/components/crm/StatCard';
import { Users, Calendar, DollarSign, Clock, ArrowRight, TrendingUp, Scissors, UserCheck, ClipboardList, Layers } from 'lucide-react';
import type { Booking, Client } from '@/lib/types';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function AdminDashboard() {
    const supabase = createClient();
    const [stats, setStats] = useState({
        clients: 0,
        weeklyBookings: 0,
        todayBookings: 0,
        dueClients: 0,
        todayRevenue: 0,
        todayCompleted: 0,
        pendingApplicants: 0,
    });
    const [todaySchedule, setTodaySchedule] = useState<Booking[]>([]);
    const [upcomingSchedule, setUpcomingSchedule] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [debugError, setDebugError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const nextWeekStr = format(addDays(new Date(), 7), 'yyyy-MM-dd');
                const sixWeeksAgo = new Date();
                sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
                const cutoff = format(sixWeeksAgo, 'yyyy-MM-dd');

                const [clientsRes, todayBookingsRes, upcomingRes, applicantsRes] = await Promise.all([
                    supabase.from('clients').select('*'),
                    supabase.from('bookings').select('*').eq('date', todayStr).order('time', { ascending: true }),
                    supabase.from('bookings').select('*').gt('date', todayStr).lte('date', nextWeekStr).in('status', ['confirmed']).order('date', { ascending: true }).order('time', { ascending: true }).limit(20),
                    supabase.from('applicants').select('id').eq('status', 'pending'),
                ]);

                if (clientsRes.error) throw new Error(`Clients: ${clientsRes.error.message}`);
                if (todayBookingsRes.error) throw new Error(`Today Bookings: ${todayBookingsRes.error.message}`);

                const allClients: Client[] = clientsRes.data ?? [];
                const todayAll: Booking[] = todayBookingsRes.data ?? [];
                const upcoming: Booking[] = upcomingRes.data ?? [];

                const todayActive = todayAll.filter(b => ['confirmed', 'completed'].includes(b.status));
                const todayCompleted = todayAll.filter(b => b.status === 'completed');

                const todayRevenue = todayCompleted.reduce((sum, b) => {
                    const priceStr = String(b.price || '$0');
                    const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
                    return sum + (isNaN(price) ? 0 : price);
                }, 0);

                const weeklyBookings = upcoming.length;

                const dueClients = allClients.filter(c =>
                    !c.last_booking_date || c.last_booking_date < cutoff
                ).length;

                setStats({
                    clients: allClients.length,
                    weeklyBookings,
                    todayBookings: todayActive.length,
                    dueClients,
                    todayRevenue,
                    todayCompleted: todayCompleted.length,
                    pendingApplicants: applicantsRes.data?.length ?? 0,
                });

                setTodaySchedule(todayActive);
                setUpcomingSchedule(upcoming.slice(0, 8));
                setDebugError(null);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : 'Failed to fetch data';
                console.error("Dashboard Fetch Error:", err);
                setDebugError(message);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    const statusDot = (s: Booking['status']) =>
        s === 'confirmed' ? 'bg-savron-green animate-pulse' : s === 'completed' ? 'bg-blue-400' : 'bg-savron-silver/40';

    if (debugError) {
        return (
            <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-xl space-y-4">
                <h2 className="text-red-400 font-bold uppercase tracking-widest">Database Error</h2>
                <p className="text-white text-sm font-mono">{debugError}</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-red-500 text-white rounded-lg uppercase tracking-widest text-xs">Retry</button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    let todayStr = 'Today';
    try { todayStr = format(new Date(), 'EEEE, MMMM d'); } catch {}

    return (
        <div className="space-y-8 entry-fade">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="font-heading text-3xl uppercase tracking-widest text-white">Dashboard</h1>
                    <p className="text-savron-silver text-sm uppercase tracking-wider mt-1">{todayStr}</p>
                </div>
                <Link href="/admin/bookings" className="flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-widest bg-savron-green/10 text-savron-green border border-savron-green/20 rounded-savron hover:bg-savron-green/20 transition-all">
                    <Calendar className="w-3.5 h-3.5" /> View Calendar
                </Link>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                    label="Today's Appointments"
                    value={stats.todayBookings}
                    icon={<Calendar className="w-4 h-4" />}
                    sub={`${stats.todayCompleted} completed`}
                />
                <StatCard
                    label="Today's Revenue"
                    value={`$${stats.todayRevenue.toFixed(0)}`}
                    icon={<DollarSign className="w-4 h-4" />}
                    sub="completed services"
                />
                <StatCard
                    label="Pipeline (Next 7 Days)"
                    value={stats.weeklyBookings}
                    icon={<TrendingUp className="w-4 h-4" />}
                    sub="confirmed upcoming"
                />
                <StatCard
                    label="Total Clients"
                    value={stats.clients}
                    icon={<Users className="w-4 h-4" />}
                    sub="in CRM"
                />
                <StatCard
                    label="Due for Visit"
                    value={stats.dueClients}
                    icon={<Clock className="w-4 h-4" />}
                    sub="6+ weeks since last visit"
                    alert={stats.dueClients > 0}
                />
                <StatCard
                    label="Barbers Active"
                    value="—"
                    icon={<Scissors className="w-4 h-4" />}
                    sub={<Link href="/admin/barbers" className="text-savron-green hover:underline">Manage team</Link>}
                />
                <StatCard
                    label="Pending Applications"
                    value={stats.pendingApplicants}
                    icon={<ClipboardList className="w-4 h-4" />}
                    sub={<Link href="/admin/applicants" className="text-savron-green hover:underline">View pipeline</Link>}
                    alert={stats.pendingApplicants > 0}
                />
            </div>

            {/* Today's Schedule */}
            <div className="card-savron relative overflow-hidden">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="font-heading text-lg uppercase tracking-widest text-white">Today&apos;s Schedule</h2>
                        <p className="text-savron-silver/50 text-[10px] uppercase tracking-widest mt-0.5">{stats.todayBookings} appointment{stats.todayBookings !== 1 ? 's' : ''}</p>
                    </div>
                    <Link href="/admin/bookings" className="text-xs uppercase tracking-widest text-savron-green hover:text-white flex items-center gap-1 transition-colors">
                        Full View <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>

                {todaySchedule.length === 0 ? (
                    <div className="py-10 text-center">
                        <Calendar className="w-8 h-8 text-savron-silver/20 mx-auto mb-3" />
                        <p className="text-savron-silver/50 text-sm uppercase tracking-wider">No appointments scheduled today</p>
                        <Link href="/admin/bookings" className="mt-3 inline-block text-xs text-savron-green uppercase tracking-widest hover:underline">Add walk-in →</Link>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {todaySchedule.map((b) => (
                            <div key={b.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2">
                                <div className="flex items-center gap-4">
                                    <div className="w-20 shrink-0 text-right">
                                        <span className="font-mono text-sm text-savron-green block">{b.time}</span>
                                    </div>
                                    <div>
                                        <p className="text-white text-sm font-medium">{b.client_name || 'Walk-in'}</p>
                                        <p className="text-savron-silver text-xs">{b.service} · {b.barber_name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-savron-silver font-mono text-sm">{b.price}</span>
                                    <div className={cn("w-2 h-2 rounded-full", statusDot(b.status))} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Upcoming (next 7 days) */}
            {upcomingSchedule.length > 0 && (
                <div className="card-savron relative overflow-hidden">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="font-heading text-lg uppercase tracking-widest text-white">Upcoming This Week</h2>
                        <Link href="/admin/bookings" className="text-xs uppercase tracking-widest text-savron-green hover:text-white flex items-center gap-1 transition-colors">
                            Calendar <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="space-y-1">
                        {upcomingSchedule.map((b) => {
                            let dateLabel = b.date;
                            try { dateLabel = format(new Date(b.date + 'T12:00:00'), 'EEE, MMM d'); } catch {}
                            return (
                                <div key={b.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors rounded-lg px-2 -mx-2">
                                    <div className="flex items-center gap-4">
                                        <div className="w-28 shrink-0">
                                            <span className="font-mono text-sm text-white block">{b.time}</span>
                                            <span className="text-[10px] uppercase tracking-widest text-savron-silver/50 block">{dateLabel}</span>
                                        </div>
                                        <div>
                                            <p className="text-white text-sm font-medium">{b.client_name || 'Walk-in'}</p>
                                            <p className="text-savron-silver text-xs">{b.service} · {b.barber_name}</p>
                                        </div>
                                    </div>
                                    <span className="text-savron-silver font-mono text-sm">{b.price}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Bookings', href: '/admin/bookings', icon: Calendar, desc: 'Calendar & walk-ins' },
                    { label: 'Clients', href: '/admin/clients', icon: Users, desc: 'CRM & campaigns' },
                    { label: 'Membership', href: '/admin/membership', icon: UserCheck, desc: 'E-pass & visits' },
                    { label: 'Barbers', href: '/admin/barbers', icon: Scissors, desc: 'Team management' },
                    { label: 'Host View', href: '/host',             icon: TrendingUp,    desc: 'Display screen' },
                    { label: 'Services',  href: '/admin/services',   icon: Layers,        desc: 'Menu management' },
                    { label: 'Hiring',    href: '/admin/applicants', icon: ClipboardList, desc: 'Recruiting pipeline' },
                ].map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="card-savron hover:border-savron-green/20 hover:bg-white/[0.04] transition-all group p-4 text-center space-y-2"
                    >
                        <item.icon className="w-5 h-5 text-savron-silver group-hover:text-savron-green transition-colors mx-auto" />
                        <p className="text-white text-xs uppercase tracking-widest font-heading">{item.label}</p>
                        <p className="text-savron-silver/50 text-[10px] uppercase tracking-widest">{item.desc}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
