"use client";

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase';
import StatCard from '@/components/crm/StatCard';
import StatDetailModal, { buildStatDetailData, type StatKey, type StatDetailData } from '@/components/crm/StatDetailModal';
import { Users, Calendar, DollarSign, Clock, ArrowRight, TrendingUp, Scissors, UserCheck, ClipboardList, Layers, ScanLine, Inbox, UserPlus, PhoneCall } from 'lucide-react';
import type { Booking, Client, Barber, Applicant } from '@/lib/types';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const QRScannerModal = dynamic(() => import('@/components/qr/QRScannerModal'), { ssr: false });
const WalkInModal = dynamic(() => import('@/components/crm/WalkInModal'), { ssr: false });

const EMPTY_DETAIL_DATA: StatDetailData = {
    todaySchedule: [],
    upcomingSchedule: [],
    dueClients: [],
    allClients: [],
    activeBarbers: [],
    pendingApplicants: [],
    recentCancellations: [],
    serviceBreakdown: [],
    revenueByMonth: [],
};

export default function AdminDashboard() {
    const supabase = createClient();
    const [seeding, setSeeding] = useState(false);
    const [stats, setStats] = useState({
        clients: 0,
        weeklyBookings: 0,
        todayBookings: 0,
        dueClients: 0,
        todayRevenue: 0,
        todayCompleted: 0,
        pendingApplicants: 0,
        activeBarbers: 0,
        totalRevenue: 0,
        avgTicket: 0,
        topService: '—',
        totalBookings: 0,
        totalAppointments: 0,
        recentCancellations: 0,
    });
    const [todaySchedule, setTodaySchedule] = useState<Booking[]>([]);
    const [upcomingSchedule, setUpcomingSchedule] = useState<Booking[]>([]);
    const [detailData, setDetailData] = useState<StatDetailData>(EMPTY_DETAIL_DATA);
    const [dueCutoff, setDueCutoff] = useState('');
    const [activeStat, setActiveStat] = useState<StatKey | null>(null);
    const [loading, setLoading] = useState(true);
    const [showScanner, setShowScanner] = useState(false);
    const [showWalkIn, setShowWalkIn] = useState(false);
    const [debugError, setDebugError] = useState<string | null>(null);

    async function fetchData() {
        try {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
            const sixWeeksAgo = new Date();
            sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
            const cutoff = format(sixWeeksAgo, 'yyyy-MM-dd');
            setDueCutoff(cutoff);

            const [clientsRes, todayBookingsRes, upcomingRes, applicantsRes, barbersRes, allBookingsRes, cancelledRes] = await Promise.all([
                supabase.from('clients').select('*'),
                supabase.from('bookings').select('*').eq('date', todayStr).order('time', { ascending: true }),
                supabase.from('bookings').select('*').gt('date', todayStr).eq('status', 'confirmed').order('date', { ascending: true }).order('time', { ascending: true }).limit(50),
                supabase.from('applicants').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
                supabase.from('barbers').select('*'),
                supabase.from('bookings').select('*').order('created_at', { ascending: false }),
                supabase.from('bookings').select('*').in('status', ['cancelled', 'no_show']).gte('date', thirtyDaysAgo).order('date', { ascending: false }).order('time', { ascending: false }).limit(50),
            ]);

            if (clientsRes.error) throw new Error(`Clients: ${clientsRes.error.message}`);
            if (todayBookingsRes.error) throw new Error(`Today Bookings: ${todayBookingsRes.error.message}`);
            if (barbersRes.error) throw new Error(`Barbers: ${barbersRes.error.message}`);
            if (allBookingsRes.error) throw new Error(`All Bookings: ${allBookingsRes.error.message}`);

            const allClients: Client[] = clientsRes.data ?? [];
            const todayAll: Booking[] = todayBookingsRes.data ?? [];
            const upcoming: Booking[] = upcomingRes.data ?? [];
            const allBarbers: Barber[] = barbersRes.data ?? [];
            const allBookings: Booking[] = allBookingsRes.data ?? [];
            const recentCancelled: Booking[] = cancelledRes.data ?? [];
            const pendingApplicants: Applicant[] = applicantsRes.data ?? [];

            const todayActive = todayAll.filter(b => ['confirmed', 'completed'].includes(b.status));
            const todayCompleted = todayAll.filter(b => b.status === 'completed');

            const todayRevenue = todayActive.reduce((sum, b) => {
                const priceStr = String(b.price || '$0');
                const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
                return sum + (isNaN(price) ? 0 : price);
            }, 0);

            const weeklyBookings = upcoming.length;

            const dueClientsCount = allClients.filter(c =>
                !c.last_booking_date || c.last_booking_date < cutoff
            ).length;

            const activeBarbersCount = allBarbers.filter(b => b.active).length;

            const activeBookings = allBookings.filter(b =>
                b.status === 'confirmed' || b.status === 'completed'
            );

            const totalRevenue = activeBookings.reduce((sum, b) => {
                const priceStr = String(b.price || '$0');
                const price = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
                return sum + (isNaN(price) ? 0 : price);
            }, 0);

            const avgTicket = activeBookings.length > 0 ? totalRevenue / activeBookings.length : 0;

            const serviceCounts: Record<string, number> = {};
            activeBookings.forEach(b => {
                if (b.service) serviceCounts[b.service] = (serviceCounts[b.service] || 0) + 1;
            });
            let topService = '—';
            let maxCount = 0;
            for (const [service, count] of Object.entries(serviceCounts)) {
                if (count > maxCount) {
                    maxCount = count;
                    topService = service;
                }
            }

            setStats({
                clients: allClients.length,
                weeklyBookings,
                todayBookings: todayActive.length,
                dueClients: dueClientsCount,
                todayRevenue,
                todayCompleted: todayCompleted.length,
                pendingApplicants: pendingApplicants.length,
                activeBarbers: activeBarbersCount,
                totalRevenue,
                avgTicket,
                topService,
                totalBookings: allBookings.length,
                totalAppointments: activeBookings.length,
                recentCancellations: recentCancelled.length,
            });

            setTodaySchedule(todayActive);
            setUpcomingSchedule(upcoming);
            setDetailData(buildStatDetailData(
                allClients,
                todayActive,
                upcoming,
                allBookings,
                allBarbers,
                pendingApplicants,
                recentCancelled,
                cutoff,
            ));
            setDebugError(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to fetch data';
            console.error("Dashboard Fetch Error:", err);
            setDebugError(message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

    const openStat = (key: StatKey) => setActiveStat(key);

    const statCards = useMemo(() => [
        {
            key: 'todayAppointments' as StatKey,
            label: "Today's Appointments",
            value: stats.todayBookings,
            icon: <Calendar className="w-4 h-4" />,
            sub: `${stats.todayCompleted} completed · ${stats.todayBookings - stats.todayCompleted} confirmed`,
        },
        {
            key: 'todayRevenue' as StatKey,
            label: "Today's Revenue",
            value: `$${stats.todayRevenue.toFixed(0)}`,
            icon: <DollarSign className="w-4 h-4" />,
            sub: 'confirmed + completed today',
        },
        {
            key: 'pipeline' as StatKey,
            label: 'Pipeline (Upcoming)',
            value: stats.weeklyBookings,
            icon: <TrendingUp className="w-4 h-4" />,
            sub: 'confirmed future bookings',
        },
        {
            key: 'recentCancellations' as StatKey,
            label: 'Recent Cancellations',
            value: stats.recentCancellations,
            icon: <PhoneCall className="w-4 h-4" />,
            sub: 'last 30 days — call to reschedule',
            alert: stats.recentCancellations > 0,
        },
        {
            key: 'totalRevenue' as StatKey,
            label: 'All-Time Revenue',
            value: `$${stats.totalRevenue.toLocaleString()}`,
            icon: <DollarSign className="w-4 h-4" />,
            sub: 'confirmed + completed',
        },
        {
            key: 'totalAppointments' as StatKey,
            label: 'Total Appointments',
            value: stats.totalAppointments,
            icon: <Calendar className="w-4 h-4" />,
            sub: 'all bookings made through web',
        },
        {
            key: 'avgTicket' as StatKey,
            label: 'Avg Ticket Value',
            value: `$${stats.avgTicket.toFixed(2)}`,
            icon: <TrendingUp className="w-4 h-4" />,
            sub: 'per active booking',
        },
        {
            key: 'topService' as StatKey,
            label: 'Popular Service',
            value: stats.topService,
            icon: <Scissors className="w-4 h-4" />,
            sub: 'most booked all-time',
            className: 'truncate',
        },
        {
            key: 'totalClients' as StatKey,
            label: 'Total Clients',
            value: stats.clients,
            icon: <Users className="w-4 h-4" />,
            sub: 'in CRM',
        },
        {
            key: 'dueForVisit' as StatKey,
            label: 'Due for Visit',
            value: stats.dueClients,
            icon: <Clock className="w-4 h-4" />,
            sub: '6+ weeks since last visit',
            alert: stats.dueClients > 0,
        },
        {
            key: 'barbersActive' as StatKey,
            label: 'Barbers Active',
            value: stats.activeBarbers,
            icon: <Scissors className="w-4 h-4" />,
            sub: 'tap to view team',
        },
        {
            key: 'pendingApplicants' as StatKey,
            label: 'Pending Applications',
            value: stats.pendingApplicants,
            icon: <ClipboardList className="w-4 h-4" />,
            sub: 'tap to review applicants',
            alert: stats.pendingApplicants > 0,
        },
    ], [stats]);

    const handleSeed = async () => {
        setSeeding(true);
        try {
            const res = await fetch('/api/seed', { method: 'POST' });
            if (res.ok) {
                await fetchData();
            } else {
                alert('Seeding failed');
            }
        } catch (e) {
            console.error(e);
            alert('Seeding failed');
        } finally {
            setSeeding(false);
        }
    };

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
        <div className="admin-page">
            {/* Header */}
            <div className="admin-header">
                <div>
                    <p className="admin-kicker">Overview</p>
                    <h1 className="admin-title">Dashboard</h1>
                    <p className="admin-subtitle">{todayStr}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={() => setShowWalkIn(true)}
                        className="flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest bg-white/[0.05] text-savron-silver border border-white/[0.08] rounded-savron hover:text-white hover:border-white/20 transition-all"
                    >
                        <UserPlus className="w-3.5 h-3.5" /> Walk-in
                    </button>
                    <button
                        onClick={() => setShowScanner(true)}
                        className="flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest bg-savron-green text-white border border-savron-green-light/20 rounded-savron hover:bg-savron-green-light transition-all glow-blue"
                    >
                        <ScanLine className="w-3.5 h-3.5" /> Scan ePass
                    </button>
                    <Link href="/admin/bookings" className="flex items-center gap-2 px-5 py-3 text-xs uppercase tracking-widest bg-white/[0.05] text-savron-silver border border-white/[0.08] rounded-savron hover:text-white hover:border-white/20 transition-all">
                        <Calendar className="w-3.5 h-3.5" /> View Calendar
                    </Link>
                </div>
            </div>

            <QRScannerModal open={showScanner} onClose={() => setShowScanner(false)} />
            <WalkInModal open={showWalkIn} onClose={() => setShowWalkIn(false)} onBooked={fetchData} />
            <StatDetailModal
                statKey={activeStat}
                data={detailData}
                cutoff={dueCutoff}
                onClose={() => setActiveStat(null)}
            />

            {/* Empty State / Demo Data Seeder Banner */}
            {stats.clients === 0 && stats.totalBookings === 0 && (
                <div className="card-savron border-savron-green-light/30 bg-savron-green/10 text-center space-y-4">
                    <h3 className="font-heading text-lg text-accent-blue uppercase tracking-widest">Database Empty</h3>
                    <p className="text-savron-silver text-sm max-w-md mx-auto">
                        Your SAVRON CRM is currently empty. Click the button below to automatically populate the database with mock barbers, clients, and appointments to preview the dashboard.
                    </p>
                    <button
                        onClick={handleSeed}
                        disabled={seeding}
                        className="px-6 py-2.5 bg-savron-green text-white border border-savron-green-light/20 font-heading text-xs uppercase tracking-widest rounded-savron hover:bg-savron-green-light transition-all disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                    >
                        {seeding ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Seeding...
                            </>
                        ) : (
                            'Seed Database with Demo Data'
                        )}
                    </button>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
                {statCards.map(card => (
                    <StatCard
                        key={card.key}
                        label={card.label}
                        value={card.value}
                        icon={card.icon}
                        sub={card.sub}
                        alert={card.alert}
                        className={card.className}
                        onClick={() => openStat(card.key)}
                    />
                ))}
            </div>

            {/* Today's Schedule */}
            <div className="card-savron relative overflow-hidden">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="font-heading text-lg uppercase tracking-widest text-white">Today&apos;s Schedule</h2>
                        <p className="text-savron-silver/75 text-[11px] uppercase tracking-widest mt-0.5">{stats.todayBookings} appointment{stats.todayBookings !== 1 ? 's' : ''}</p>
                    </div>
                    <Link href="/admin/bookings" className="text-xs uppercase tracking-widest text-accent-blue hover:text-savron-cream flex items-center gap-1 transition-colors">
                        Full View <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>

                {todaySchedule.length === 0 ? (
                    <div className="py-10 text-center">
                        <Calendar className="w-8 h-8 text-savron-silver/20 mx-auto mb-3" />
                        <p className="text-savron-silver/50 text-sm uppercase tracking-wider">No appointments scheduled today</p>
                        <Link href="/admin/bookings" className="mt-3 inline-block text-xs text-accent-blue hover:text-savron-cream uppercase tracking-widest hover:underline">Add walk-in →</Link>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {todaySchedule.map((b) => (
                            <div key={b.id} className="flex items-center justify-between py-4 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.025] transition-colors rounded-lg px-3 -mx-3">
                                <div className="flex items-center gap-4">
                                    <div className="w-20 shrink-0 text-right">
                                        <span className="font-mono text-sm text-accent-blue block">{b.time}</span>
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

            {/* Upcoming */}
            {upcomingSchedule.length > 0 && (
                <div className="card-savron relative overflow-hidden">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="font-heading text-lg uppercase tracking-widest text-white">Upcoming Bookings</h2>
                        <Link href="/admin/bookings" className="text-xs uppercase tracking-widest text-accent-blue hover:text-savron-cream flex items-center gap-1 transition-colors">
                            Calendar <ArrowRight className="w-3 h-3" />
                        </Link>
                    </div>
                    <div className="space-y-2">
                        {upcomingSchedule.slice(0, 8).map((b) => {
                            let dateLabel = b.date;
                            try { dateLabel = format(new Date(b.date + 'T12:00:00'), 'EEE, MMM d'); } catch {}
                            return (
                                <div key={b.id} className="flex items-center justify-between py-4 border-b border-white/[0.06] last:border-0 hover:bg-white/[0.025] transition-colors rounded-lg px-3 -mx-3">
                                    <div className="flex items-center gap-4">
                                        <div className="w-28 shrink-0">
                                            <span className="font-mono text-sm text-white block">{b.time}</span>
                                            <span className="text-[11px] uppercase tracking-widest text-savron-silver/75 block">{dateLabel}</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                {[
                    { label: 'Bookings',   href: '/admin/bookings',   icon: Calendar,      desc: 'Calendar & walk-ins', badge: 0 },
                    { label: 'Clients',    href: '/admin/clients',    icon: Users,         desc: 'CRM & campaigns',     badge: 0 },
                    { label: 'Membership', href: '/admin/membership', icon: UserCheck,     desc: 'E-pass & visits',     badge: 0 },
                    { label: 'Barbers',    href: '/admin/barbers',    icon: Scissors,      desc: 'Team management',     badge: 0 },
                    { label: 'Host View',  href: '/host',             icon: TrendingUp,    desc: 'Display screen',      badge: 0 },
                    { label: 'Services',   href: '/admin/services',   icon: Layers,        desc: 'Menu management',     badge: 0 },
                    { label: 'Hiring',     href: '/admin/applicants', icon: ClipboardList, desc: 'Recruiting pipeline', badge: stats.pendingApplicants },
                    { label: 'Requests',   href: '/admin/requests',   icon: Inbox,         desc: 'Barber requests',     badge: 0 },
                ].map(item => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="card-savron hover:border-savron-green/20 hover:bg-white/[0.04] transition-all group p-5 md:p-6 text-center space-y-3 relative"
                    >
                        {item.badge > 0 && (
                            <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-amber-500 text-[9px] text-white flex items-center justify-center font-bold">
                                {item.badge}
                            </span>
                        )}
                        <item.icon className="w-5 h-5 text-savron-silver group-hover:text-accent-blue transition-colors mx-auto" />
                        <p className="text-white text-xs uppercase tracking-widest font-heading">{item.label}</p>
                        <p className="text-savron-silver/75 text-[11px] uppercase tracking-widest">{item.desc}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
