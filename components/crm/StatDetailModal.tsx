"use client";

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Mail, Star, AlertCircle } from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Booking, Client, Barber, Applicant } from '@/lib/types';
import Link from 'next/link';

export type StatKey =
    | 'todayAppointments'
    | 'todayRevenue'
    | 'pipeline'
    | 'totalRevenue'
    | 'totalAppointments'
    | 'avgTicket'
    | 'topService'
    | 'totalClients'
    | 'dueForVisit'
    | 'barbersActive'
    | 'pendingApplicants'
    | 'recentCancellations';

export interface StatDetailData {
    todaySchedule: Booking[];
    upcomingSchedule: Booking[];
    dueClients: Client[];
    allClients: Client[];
    activeBarbers: Barber[];
    pendingApplicants: Applicant[];
    recentCancellations: Booking[];
    serviceBreakdown: { service: string; count: number; revenue: number }[];
    revenueByMonth: { month: string; revenue: number; count: number }[];
}

const STAT_TITLES: Record<StatKey, { title: string; subtitle: string }> = {
    todayAppointments: { title: "Today's Appointments", subtitle: 'Scheduled for today — confirmed and completed' },
    todayRevenue: { title: "Today's Revenue", subtitle: 'Breakdown of today\'s booked services' },
    pipeline: { title: 'Pipeline (Upcoming)', subtitle: 'Confirmed future bookings — call to confirm or upsell' },
    totalRevenue: { title: 'All-Time Revenue', subtitle: 'Revenue by month from confirmed + completed bookings' },
    totalAppointments: { title: 'Total Appointments', subtitle: 'All active bookings made through the web' },
    avgTicket: { title: 'Avg Ticket Value', subtitle: 'Revenue breakdown by service' },
    topService: { title: 'Popular Services', subtitle: 'Most booked services ranked' },
    totalClients: { title: 'Total Clients', subtitle: 'Everyone in your CRM' },
    dueForVisit: { title: 'Due for Visit', subtitle: 'Clients 6+ weeks since last visit — high-priority callbacks' },
    barbersActive: { title: 'Active Barbers', subtitle: 'Team members currently taking bookings' },
    pendingApplicants: { title: 'Pending Applications', subtitle: 'Barber applicants awaiting review' },
    recentCancellations: { title: 'Recent Cancellations', subtitle: 'Cancelled or no-show in the last 30 days — reschedule opportunities' },
};

function parsePrice(price: string | null | undefined): number {
    const priceStr = String(price || '$0');
    const parsed = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
}

function formatDateLabel(dateStr: string): string {
    try {
        return format(parseISO(dateStr), 'EEE, MMM d');
    } catch {
        return dateStr;
    }
}

function timeAgo(dateStr: string): string {
    try {
        return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
    } catch {
        return '—';
    }
}

function getClientForBooking(booking: Booking, clients: Client[]): Client | undefined {
    if (booking.client_id) {
        return clients.find(c => c.id === booking.client_id);
    }
    if (booking.client_email) {
        return clients.find(c => c.email?.toLowerCase() === booking.client_email?.toLowerCase());
    }
    return undefined;
}

function QualificationBadge({ client, booking }: { client?: Client; booking?: Booking }) {
    const badges: { label: string; className: string }[] = [];

    if (client?.membership_status === 'vip') {
        badges.push({ label: 'VIP', className: 'bg-amber-500/15 text-amber-400 border-amber-500/25' });
    } else if (client?.membership_status === 'inner_circle') {
        badges.push({ label: 'Inner Circle', className: 'bg-purple-500/15 text-purple-400 border-purple-500/25' });
    }

    if (client && client.visit_count >= 5) {
        badges.push({ label: `${client.visit_count} visits`, className: 'bg-savron-green/15 text-accent-blue border-savron-green/25' });
    } else if (client && client.visit_count >= 2) {
        badges.push({ label: 'Returning', className: 'bg-blue-500/15 text-blue-400 border-blue-500/25' });
    } else if (!client || client.visit_count === 0) {
        badges.push({ label: 'New lead', className: 'bg-white/5 text-savron-silver border-white/10' });
    }

    if (booking?.status === 'no_show') {
        badges.push({ label: 'No-show', className: 'bg-orange-500/15 text-orange-400 border-orange-500/25' });
    }

    if (booking?.client_phone) {
        badges.push({ label: 'Has phone', className: 'bg-savron-green/10 text-savron-green border-savron-green/20' });
    }

    if (badges.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1.5 mt-2">
            {badges.map(b => (
                <span key={b.label} className={cn('text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border', b.className)}>
                    {b.label}
                </span>
            ))}
        </div>
    );
}

function ContactRow({ phone, email }: { phone?: string | null; email?: string | null }) {
    if (!phone && !email) return <p className="text-savron-silver/40 text-xs italic">No contact info</p>;

    return (
        <div className="flex flex-wrap gap-3 mt-1.5">
            {phone && (
                <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-xs text-accent-blue hover:text-savron-cream transition-colors">
                    <Phone className="w-3 h-3" /> {phone}
                </a>
            )}
            {email && (
                <a href={`mailto:${email}`} className="flex items-center gap-1.5 text-xs text-savron-silver hover:text-white transition-colors">
                    <Mail className="w-3 h-3" /> {email}
                </a>
            )}
        </div>
    );
}

function DetailRow({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('py-4 border-b border-white/[0.06] last:border-0', className)}>
            {children}
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="py-12 text-center">
            <p className="text-savron-silver/50 text-sm uppercase tracking-wider">{message}</p>
        </div>
    );
}

function BookingDetailItem({ booking, clients, showQualification = true }: { booking: Booking; clients: Client[]; showQualification?: boolean }) {
    const client = getClientForBooking(booking, clients);
    const daysSinceBooked = booking.created_at ? differenceInDays(new Date(), parseISO(booking.created_at)) : null;

    return (
        <DetailRow>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium">{booking.client_name || 'Walk-in'}</p>
                    <p className="text-savron-silver text-xs mt-0.5">
                        {booking.service} · {booking.barber_name || 'Any barber'}
                    </p>
                    <ContactRow phone={booking.client_phone} email={booking.client_email} />
                    {showQualification && <QualificationBadge client={client} booking={booking} />}
                </div>
                <div className="text-right shrink-0">
                    <p className="font-mono text-sm text-accent-blue">{booking.time}</p>
                    <p className="text-[11px] text-savron-silver/70 uppercase tracking-wider">{formatDateLabel(booking.date)}</p>
                    {booking.price && <p className="text-savron-silver font-mono text-sm mt-1">{booking.price}</p>}
                    <span className={cn(
                        'inline-block mt-1.5 text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border',
                        booking.status === 'confirmed' && 'bg-savron-green/10 text-accent-blue border-savron-green/20',
                        booking.status === 'completed' && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                        booking.status === 'cancelled' && 'bg-red-500/10 text-red-400 border-red-500/20',
                        booking.status === 'no_show' && 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                    )}>
                        {booking.status.replace('_', ' ')}
                    </span>
                </div>
            </div>
            {(booking.created_at || client?.last_booking_date) && (
                <div className="flex flex-wrap gap-4 mt-2 text-[10px] uppercase tracking-widest text-savron-silver/50">
                    {booking.created_at && <span>Booked {timeAgo(booking.created_at)}</span>}
                    {client?.last_booking_date && <span>Last visit {formatDateLabel(client.last_booking_date)}</span>}
                    {daysSinceBooked !== null && daysSinceBooked <= 7 && (
                        <span className="text-savron-green">Recent interest</span>
                    )}
                </div>
            )}
        </DetailRow>
    );
}

function CancellationDetailItem({ booking, clients }: { booking: Booking; clients: Client[] }) {
    const client = getClientForBooking(booking, clients);
    const daysSinceAppt = differenceInDays(new Date(), parseISO(booking.date));
    const isFuture = daysSinceAppt < 0;

    return (
        <DetailRow className="hover:bg-white/[0.02] -mx-4 px-4 rounded-lg transition-colors">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{booking.client_name || 'Unknown'}</p>
                        {client?.membership_status === 'vip' && <Star className="w-3 h-3 text-amber-400" />}
                    </div>
                    <p className="text-savron-silver text-xs mt-0.5">
                        {booking.service} · {booking.barber_name} · {booking.price}
                    </p>
                    <ContactRow phone={booking.client_phone} email={booking.client_email} />
                    <QualificationBadge client={client} booking={booking} />
                </div>
                <div className="text-right shrink-0">
                    <p className={cn(
                        'text-[10px] uppercase tracking-widest font-medium',
                        booking.status === 'no_show' ? 'text-orange-400' : 'text-red-400'
                    )}>
                        {booking.status === 'no_show' ? 'No-show' : 'Cancelled'}
                    </p>
                    <p className="font-mono text-sm text-white mt-1">{booking.time}</p>
                    <p className="text-[11px] text-savron-silver/70">{formatDateLabel(booking.date)}</p>
                </div>
            </div>
            <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-savron-silver/60 flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3" /> Follow-up intel
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs text-savron-silver">
                    <span>
                        {isFuture ? 'Was scheduled' : 'Appointment was'} {isFuture ? 'for' : ''} {Math.abs(daysSinceAppt)} day{Math.abs(daysSinceAppt) !== 1 ? 's' : ''} {isFuture ? 'from now' : 'ago'}
                    </span>
                    {booking.created_at && <span>Booked {timeAgo(booking.created_at)}</span>}
                    {client && <span>{client.visit_count} prior visit{client.visit_count !== 1 ? 's' : ''}</span>}
                    {client?.membership_status && client.membership_status !== 'standard' && (
                        <span className="capitalize">{client.membership_status.replace('_', ' ')} member</span>
                    )}
                </div>
                {booking.client_phone && (
                    <a
                        href={`tel:${booking.client_phone}`}
                        className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-widest bg-savron-green/20 text-accent-blue border border-savron-green/30 rounded-savron hover:bg-savron-green/30 transition-colors"
                    >
                        <Phone className="w-3 h-3" /> Call to reschedule
                    </a>
                )}
            </div>
        </DetailRow>
    );
}

function ClientDetailItem({ client, showDaysOverdue = false, cutoff }: { client: Client; showDaysOverdue?: boolean; cutoff?: string }) {
    const daysOverdue = client.last_booking_date && cutoff
        ? differenceInDays(parseISO(cutoff), parseISO(client.last_booking_date))
        : client.last_booking_date
            ? differenceInDays(new Date(), parseISO(client.last_booking_date))
            : null;

    return (
        <DetailRow>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium">{client.name}</p>
                    <ContactRow phone={client.phone} email={client.email} />
                    <QualificationBadge client={client} />
                </div>
                <div className="text-right shrink-0">
                    <p className="text-sm text-white font-mono">{client.visit_count} visits</p>
                    {client.last_booking_date ? (
                        <p className="text-[11px] text-savron-silver/70 mt-0.5">Last: {formatDateLabel(client.last_booking_date)}</p>
                    ) : (
                        <p className="text-[11px] text-red-400/70 mt-0.5">Never visited</p>
                    )}
                    {showDaysOverdue && daysOverdue !== null && daysOverdue > 0 && (
                        <p className="text-[10px] text-amber-400 uppercase tracking-widest mt-1">{daysOverdue}+ days overdue</p>
                    )}
                </div>
            </div>
            {client.phone && showDaysOverdue && (
                <a
                    href={`tel:${client.phone}`}
                    className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-widest bg-savron-green/20 text-accent-blue border border-savron-green/30 rounded-savron hover:bg-savron-green/30 transition-colors"
                >
                    <Phone className="w-3 h-3" /> Call back
                </a>
            )}
        </DetailRow>
    );
}

function renderContent(statKey: StatKey, data: StatDetailData, cutoff: string) {
    switch (statKey) {
        case 'todayAppointments':
            return data.todaySchedule.length === 0
                ? <EmptyState message="No appointments today" />
                : data.todaySchedule.map(b => <BookingDetailItem key={b.id} booking={b} clients={data.allClients} />);

        case 'todayRevenue':
            return data.todaySchedule.length === 0
                ? <EmptyState message="No revenue today" />
                : <>
                    {data.todaySchedule.map(b => <BookingDetailItem key={b.id} booking={b} clients={data.allClients} showQualification={false} />)}
                    <div className="pt-4 flex justify-between text-sm uppercase tracking-widest">
                        <span className="text-savron-silver">Total</span>
                        <span className="text-white font-mono">
                            ${data.todaySchedule.reduce((s, b) => s + parsePrice(b.price), 0).toFixed(0)}
                        </span>
                    </div>
                </>;

        case 'pipeline':
            return data.upcomingSchedule.length === 0
                ? <EmptyState message="No upcoming bookings" />
                : data.upcomingSchedule.map(b => <BookingDetailItem key={b.id} booking={b} clients={data.allClients} />);

        case 'totalRevenue':
            return data.revenueByMonth.length === 0
                ? <EmptyState message="No revenue data" />
                : data.revenueByMonth.map(m => (
                    <DetailRow key={m.month}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white text-sm">{m.month}</p>
                                <p className="text-savron-silver text-xs">{m.count} appointment{m.count !== 1 ? 's' : ''}</p>
                            </div>
                            <p className="text-white font-mono text-sm">${m.revenue.toLocaleString()}</p>
                        </div>
                    </DetailRow>
                ));

        case 'totalAppointments':
        case 'avgTicket':
        case 'topService':
            return data.serviceBreakdown.length === 0
                ? <EmptyState message="No appointment data" />
                : data.serviceBreakdown.map((s, i) => (
                    <DetailRow key={s.service}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="text-savron-silver/40 font-mono text-xs w-5">#{i + 1}</span>
                                <div>
                                    <p className="text-white text-sm">{s.service}</p>
                                    <p className="text-savron-silver text-xs">{s.count} booking{s.count !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <p className="text-accent-blue font-mono text-sm">${s.revenue.toLocaleString()}</p>
                        </div>
                    </DetailRow>
                ));

        case 'totalClients':
            return data.allClients.length === 0
                ? <EmptyState message="No clients yet" />
                : data.allClients.map(c => <ClientDetailItem key={c.id} client={c} />);

        case 'dueForVisit':
            return data.dueClients.length === 0
                ? <EmptyState message="All clients are up to date" />
                : data.dueClients.map(c => <ClientDetailItem key={c.id} client={c} showDaysOverdue cutoff={cutoff} />);

        case 'barbersActive':
            return data.activeBarbers.length === 0
                ? <EmptyState message="No active barbers" />
                : data.activeBarbers.map(b => (
                    <DetailRow key={b.id}>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-white text-sm font-medium">{b.name}</p>
                                <p className="text-savron-silver text-xs">{b.role}</p>
                                {b.specialties && b.specialties.length > 0 && (
                                    <p className="text-savron-silver/60 text-[10px] uppercase tracking-wider mt-1">
                                        {b.specialties.join(' · ')}
                                    </p>
                                )}
                            </div>
                            <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border bg-savron-green/10 text-accent-blue border-savron-green/20">
                                Active
                            </span>
                        </div>
                        <ContactRow phone={b.phone} email={b.email} />
                    </DetailRow>
                ));

        case 'pendingApplicants':
            return data.pendingApplicants.length === 0
                ? <EmptyState message="No pending applications" />
                : data.pendingApplicants.map(a => (
                    <DetailRow key={a.id}>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-white text-sm font-medium">{a.name}</p>
                                <p className="text-savron-silver text-xs mt-0.5">{a.experience} · {a.license_status}</p>
                                <ContactRow phone={a.phone} email={a.email} />
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-[10px] text-savron-silver/60 uppercase tracking-widest">Applied</p>
                                <p className="text-xs text-savron-silver">{timeAgo(a.created_at)}</p>
                            </div>
                        </div>
                        {a.experience_summary && (
                            <p className="text-savron-silver/70 text-xs mt-2 line-clamp-2">{a.experience_summary}</p>
                        )}
                    </DetailRow>
                ));

        case 'recentCancellations':
            return data.recentCancellations.length === 0
                ? <EmptyState message="No recent cancellations — great retention!" />
                : data.recentCancellations.map(b => (
                    <CancellationDetailItem key={b.id} booking={b} clients={data.allClients} />
                ));

        default:
            return null;
    }
}

interface StatDetailModalProps {
    statKey: StatKey | null;
    data: StatDetailData;
    cutoff: string;
    onClose: () => void;
}

export default function StatDetailModal({ statKey, data, cutoff, onClose }: StatDetailModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);
    const scrollLockRef = useRef(0);

    useEffect(() => {
        if (!statKey) return;

        scrollLockRef.current = window.scrollY;
        const { style } = document.body;
        style.overflow = 'hidden';
        style.position = 'fixed';
        style.top = `-${scrollLockRef.current}px`;
        style.left = '0';
        style.right = '0';
        style.width = '100%';

        requestAnimationFrame(() => {
            modalRef.current?.scrollIntoView({ block: 'center', inline: 'nearest' });
        });

        return () => {
            style.overflow = '';
            style.position = '';
            style.top = '';
            style.left = '';
            style.right = '';
            style.width = '';
            window.scrollTo(0, scrollLockRef.current);
        };
    }, [statKey]);

    if (!statKey) return null;

    const { title, subtitle } = STAT_TITLES[statKey];
    const linkHref = statKey === 'dueForVisit' || statKey === 'totalClients'
        ? '/admin/clients'
        : statKey === 'recentCancellations' || statKey === 'todayAppointments' || statKey === 'pipeline'
            ? '/admin/bookings'
            : statKey === 'pendingApplicants'
                ? '/admin/applicants'
                : statKey === 'barbersActive'
                    ? '/admin/barbers'
                    : null;

    const modal = (
        <AnimatePresence>
            {statKey && (
                <motion.div
                    className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain bg-black/80 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
                >
                    <div className="flex min-h-[100dvh] items-center justify-center p-4 sm:p-6">
                        <motion.div
                            ref={modalRef}
                            className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-lg max-h-[min(85dvh,calc(100dvh-2rem))] shadow-2xl flex flex-col overflow-hidden my-auto"
                            initial={{ scale: 0.95, opacity: 0, y: 8 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 8 }}
                            transition={{ duration: 0.15 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between p-5 border-b border-white/[0.06] shrink-0">
                                <div>
                                    <h2 className="font-heading text-lg uppercase tracking-widest text-white">{title}</h2>
                                    <p className="text-savron-silver/70 text-xs mt-1">{subtitle}</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-savron-silver hover:text-white transition-colors rounded-lg hover:bg-white/5"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="overflow-y-auto flex-1 px-5 min-h-0">
                                {renderContent(statKey, data, cutoff)}
                            </div>

                            {linkHref && (
                                <div className="p-4 border-t border-white/[0.06] shrink-0">
                                    <Link
                                        href={linkHref}
                                        className="block text-center text-xs uppercase tracking-widest text-accent-blue hover:text-savron-cream transition-colors"
                                    >
                                        Open full page →
                                    </Link>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    return createPortal(modal, document.body);
}

export function buildStatDetailData(
    allClients: Client[],
    todaySchedule: Booking[],
    upcomingSchedule: Booking[],
    allBookings: Booking[],
    allBarbers: Barber[],
    pendingApplicants: Applicant[],
    recentCancellations: Booking[],
    cutoff: string,
): StatDetailData {
    const activeBookings = allBookings.filter(b => b.status === 'confirmed' || b.status === 'completed');

    const serviceMap: Record<string, { count: number; revenue: number }> = {};
    activeBookings.forEach(b => {
        if (!b.service) return;
        if (!serviceMap[b.service]) serviceMap[b.service] = { count: 0, revenue: 0 };
        serviceMap[b.service].count++;
        serviceMap[b.service].revenue += parsePrice(b.price);
    });

    const serviceBreakdown = Object.entries(serviceMap)
        .map(([service, data]) => ({ service, ...data }))
        .sort((a, b) => b.count - a.count);

    const monthMap: Record<string, { revenue: number; count: number }> = {};
    activeBookings.forEach(b => {
        try {
            const month = format(parseISO(b.date), 'MMMM yyyy');
            if (!monthMap[month]) monthMap[month] = { revenue: 0, count: 0 };
            monthMap[month].revenue += parsePrice(b.price);
            monthMap[month].count++;
        } catch { /* skip invalid dates */ }
    });

    const revenueByMonth = Object.entries(monthMap)
        .map(([month, data]) => ({ month, ...data }))
        .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
        .slice(0, 12);

    const dueClients = allClients
        .filter(c => !c.last_booking_date || c.last_booking_date < cutoff)
        .sort((a, b) => {
            if (!a.last_booking_date) return -1;
            if (!b.last_booking_date) return 1;
            return a.last_booking_date.localeCompare(b.last_booking_date);
        });

    const activeBarbers = allBarbers.filter(b => b.active);

    return {
        todaySchedule,
        upcomingSchedule,
        dueClients,
        allClients,
        activeBarbers,
        pendingApplicants,
        recentCancellations,
        serviceBreakdown,
        revenueByMonth,
    };
}
