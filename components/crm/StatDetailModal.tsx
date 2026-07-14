"use client";

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Phone, Mail, Star, AlertCircle, ChevronDown, Trash2, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays, parseISO, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Booking, Client, Barber, Applicant } from '@/lib/types';
import Link from 'next/link';
import DateRangeFilter, { type DateRange, bookingInRange } from '@/components/crm/DateRangeFilter';
import { statPageHref } from '@/lib/admin-stat-routes';
import { triggerCancelBooking } from '@/lib/confirm-booking';

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

export interface ServiceBreakdownItem {
    service: string;
    count: number;
    revenue: number;
    avgPrice: number;
    recentBookings: Booking[];
}

export interface RevenueByMonthItem {
    month: string;
    revenue: number;
    count: number;
    bookings: Booking[];
}

export interface AvgTicketStats {
    avg: number;
    min: number;
    max: number;
    total: number;
    count: number;
}

export interface BarberWorkload {
    barber: Barber;
    todayCount: number;
    upcomingCount: number;
    bookingCount: number;
    completedCount: number;
    totalRevenue: number;
}

export interface StatDetailData {
    todaySchedule: Booking[];
    upcomingSchedule: Booking[];
    dueClients: Client[];
    allClients: Client[];
    activeBarbers: Barber[];
    pendingApplicants: Applicant[];
    recentCancellations: Booking[];
    allBookings: Booking[];
    activeBookings: Booking[];
    serviceBreakdown: ServiceBreakdownItem[];
    revenueByMonth: RevenueByMonthItem[];
    avgTicketStats: AvgTicketStats;
    barberWorkloads: BarberWorkload[];
    pipelineValue: number;
    pipelineDateRange: { earliest: string; latest: string } | null;
}

const DATE_FILTER_STATS: StatKey[] = [
    'todayAppointments',
    'todayRevenue',
    'pipeline',
    'totalRevenue',
    'totalAppointments',
    'avgTicket',
    'topService',
    'recentCancellations',
    'barbersActive',
    'totalClients',
];

function todayDateStr() {
    return format(new Date(), 'yyyy-MM-dd');
}

function getDefaultDateRange(statKey: StatKey): DateRange {
    const today = todayDateStr();
    switch (statKey) {
        case 'todayAppointments':
        case 'todayRevenue':
            return { start: today, end: today };
        case 'pipeline':
            return { start: today, end: format(addDays(new Date(), 90), 'yyyy-MM-dd') };
        case 'recentCancellations':
            return { start: format(addDays(new Date(), -29), 'yyyy-MM-dd'), end: today };
        default:
            return { start: '', end: '' };
    }
}

function sortBookings(bookings: Booking[]) {
    return [...bookings].sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return (b.time || '').localeCompare(a.time || '');
    });
}

function filterActiveBookings(bookings: Booking[], range: DateRange) {
    return sortBookings(
        bookings.filter(b =>
            (b.status === 'confirmed' || b.status === 'completed') && bookingInRange(b.date, range)
        )
    );
}

function filterCancellations(bookings: Booking[], range: DateRange) {
    return sortBookings(
        bookings.filter(b =>
            (b.status === 'cancelled' || b.status === 'no_show') && bookingInRange(b.date, range)
        )
    );
}

function filterPipelineBookings(bookings: Booking[], range: DateRange) {
    const today = todayDateStr();
    return sortBookings(
        bookings.filter(b =>
            b.status === 'confirmed' &&
            b.date >= today &&
            bookingInRange(b.date, range)
        )
    ).reverse();
}

function computeAvgTicketStats(bookings: Booking[]): AvgTicketStats {
    const prices = bookings.map(b => parsePrice(b.price));
    const total = prices.reduce((sum, p) => sum + p, 0);
    return {
        avg: bookings.length > 0 ? total / bookings.length : 0,
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
        total,
        count: bookings.length,
    };
}

function computeServiceBreakdown(bookings: Booking[]): ServiceBreakdownItem[] {
    const serviceMap: Record<string, { count: number; revenue: number; bookings: Booking[] }> = {};
    bookings.forEach(b => {
        if (!b.service) return;
        if (!serviceMap[b.service]) serviceMap[b.service] = { count: 0, revenue: 0, bookings: [] };
        serviceMap[b.service].count++;
        serviceMap[b.service].revenue += parsePrice(b.price);
        serviceMap[b.service].bookings.push(b);
    });

    return Object.entries(serviceMap)
        .map(([service, stats]) => ({
            service,
            count: stats.count,
            revenue: stats.revenue,
            avgPrice: stats.count > 0 ? stats.revenue / stats.count : 0,
            recentBookings: sortBookings(stats.bookings).slice(0, 5),
        }))
        .sort((a, b) => b.count - a.count);
}

function computeRevenueByMonth(bookings: Booking[]): RevenueByMonthItem[] {
    const monthMap: Record<string, { revenue: number; count: number; bookings: Booking[] }> = {};
    bookings.forEach(b => {
        try {
            const month = format(parseISO(b.date), 'MMMM yyyy');
            if (!monthMap[month]) monthMap[month] = { revenue: 0, count: 0, bookings: [] };
            monthMap[month].revenue += parsePrice(b.price);
            monthMap[month].count++;
            monthMap[month].bookings.push(b);
        } catch { /* skip invalid dates */ }
    });

    return Object.entries(monthMap)
        .map(([month, stats]) => ({
            month,
            revenue: stats.revenue,
            count: stats.count,
            bookings: sortBookings(stats.bookings),
        }))
        .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime());
}

function computeBarberWorkloads(
    barbers: Barber[],
    activeBookings: Booking[],
    todaySchedule: Booking[],
    upcomingSchedule: Booking[],
): BarberWorkload[] {
    return barbers.map(barber => {
        const barberBookings = activeBookings.filter(b =>
            b.barber_id === barber.id || b.barber_name === barber.name
        );
        return {
            barber,
            todayCount: todaySchedule.filter(b =>
                b.barber_id === barber.id || b.barber_name === barber.name
            ).length,
            upcomingCount: upcomingSchedule.filter(b =>
                b.barber_id === barber.id || b.barber_name === barber.name
            ).length,
            bookingCount: barberBookings.length,
            completedCount: barberBookings.filter(b => b.status === 'completed').length,
            totalRevenue: barberBookings.reduce((sum, b) => sum + parsePrice(b.price), 0),
        };
    });
}

function clientsWithBookingsInRange(clients: Client[], bookings: Booking[]): Client[] {
    const clientIds = new Set<string>();
    const clientEmails = new Set<string>();

    bookings.forEach(b => {
        if (b.client_id) clientIds.add(b.client_id);
        if (b.client_email) clientEmails.add(b.client_email.toLowerCase());
    });

    return clients.filter(c =>
        clientIds.has(c.id) ||
        (c.email && clientEmails.has(c.email.toLowerCase()))
    );
}

export const STAT_TITLES: Record<StatKey, { title: string; subtitle: string }> = {
    todayAppointments: { title: "Today's Appointments", subtitle: 'Who is coming in today, what they booked, and how much they paid' },
    todayRevenue: { title: "Today's Revenue", subtitle: 'Per-service earnings and each client\'s booking value today' },
    pipeline: { title: 'Pipeline (Upcoming)', subtitle: 'Future confirmed bookings — who, when, service, and expected revenue' },
    totalRevenue: { title: 'All-Time Revenue', subtitle: 'Monthly totals with individual bookings — client, service, date, and price' },
    totalAppointments: { title: 'Total Appointments', subtitle: 'Every confirmed and completed booking — who, when, service, and price' },
    avgTicket: { title: 'Avg Ticket Value', subtitle: 'Average spend per booking with per-service breakdown' },
    topService: { title: 'Popular Services', subtitle: 'Most booked services with recent clients and revenue' },
    totalClients: { title: 'Total Clients', subtitle: 'Everyone in your CRM with visit history and contact info' },
    dueForVisit: { title: 'Due for Visit', subtitle: 'Clients 6+ weeks since last visit — high-priority callbacks' },
    barbersActive: { title: 'Active Barbers', subtitle: 'Team workload — today\'s appointments, upcoming bookings, and revenue' },
    pendingApplicants: { title: 'Pending Applications', subtitle: 'Barber applicants awaiting review' },
    recentCancellations: { title: 'Recent Cancellations', subtitle: 'Cancelled or no-show in the last 30 days — who, when, and what they booked' },
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

function SummaryBanner({ items }: { items: { label: string; value: string }[] }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-4 border-b border-white/[0.06]">
            {items.map(item => (
                <div key={item.label} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/60">{item.label}</p>
                    <p className="text-white font-mono text-sm mt-1">{item.value}</p>
                </div>
            ))}
        </div>
    );
}

function ServiceBreakdownTable({ items, showAvg = false }: { items: ServiceBreakdownItem[]; showAvg?: boolean }) {
    if (items.length === 0) return null;

    return (
        <div className="py-4 border-b border-white/[0.06]">
            <p className="text-[10px] uppercase tracking-widest text-savron-silver/60 mb-3">By service</p>
            <div className="space-y-2">
                {items.map((s, i) => (
                    <div key={s.service} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-savron-silver/40 font-mono text-xs w-5 shrink-0">#{i + 1}</span>
                            <span className="text-white truncate">{s.service}</span>
                            <span className="text-savron-silver text-xs shrink-0">×{s.count}</span>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                            <span className="text-accent-blue font-mono">${s.revenue.toLocaleString()}</span>
                            {showAvg && (
                                <span className="text-savron-silver/60 text-xs block">avg ${s.avgPrice.toFixed(0)}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MonthRevenueSection({ month, revenue, count, bookings, clients }: RevenueByMonthItem & { clients: Client[] }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <DetailRow>
            <button
                type="button"
                onClick={() => setExpanded(v => !v)}
                className="w-full text-left"
            >
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-white text-sm">{month}</p>
                        <p className="text-savron-silver text-xs">{count} appointment{count !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <p className="text-white font-mono text-sm">${revenue.toLocaleString()}</p>
                        <ChevronDown className={cn('w-4 h-4 text-savron-silver transition-transform', expanded && 'rotate-180')} />
                    </div>
                </div>
            </button>
            {expanded && (
                <div className="mt-3 space-y-0 border-t border-white/[0.06] pt-2">
                    {bookings.map(b => (
                        <BookingDetailItem key={b.id} booking={b} clients={clients} showQualification={false} compact />
                    ))}
                </div>
            )}
        </DetailRow>
    );
}

function ServiceDetailSection({ item, clients, rank }: { item: ServiceBreakdownItem; clients: Client[]; rank: number }) {
    const [expanded, setExpanded] = useState(rank === 0);

    return (
        <DetailRow>
            <button type="button" onClick={() => setExpanded(v => !v)} className="w-full text-left">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-savron-silver/40 font-mono text-xs w-5 shrink-0">#{rank + 1}</span>
                        <div className="min-w-0">
                            <p className="text-white text-sm">{item.service}</p>
                            <p className="text-savron-silver text-xs">
                                {item.count} booking{item.count !== 1 ? 's' : ''} · avg ${item.avgPrice.toFixed(0)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <p className="text-accent-blue font-mono text-sm">${item.revenue.toLocaleString()}</p>
                        <ChevronDown className={cn('w-4 h-4 text-savron-silver transition-transform', expanded && 'rotate-180')} />
                    </div>
                </div>
            </button>
            {expanded && item.recentBookings.length > 0 && (
                <div className="mt-3 space-y-0 border-t border-white/[0.06] pt-2">
                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/50 py-2">Recent bookings</p>
                    {item.recentBookings.map(b => (
                        <BookingDetailItem key={b.id} booking={b} clients={clients} showQualification={false} compact />
                    ))}
                </div>
            )}
        </DetailRow>
    );
}

function BookingDetailItem({ booking, clients, showQualification = true, compact = false }: { booking: Booking; clients: Client[]; showQualification?: boolean; compact?: boolean }) {
    const client = getClientForBooking(booking, clients);
    const daysSinceBooked = booking.created_at ? differenceInDays(new Date(), parseISO(booking.created_at)) : null;

    return (
        <DetailRow className={compact ? 'py-3' : undefined}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium">{booking.client_name || 'Walk-in'}</p>
                    <p className="text-savron-silver text-xs mt-0.5">
                        {booking.service} · {booking.barber_name || 'Any barber'}
                    </p>
                    {!compact && <ContactRow phone={booking.client_phone} email={booking.client_email} />}
                    {showQualification && !compact && <QualificationBadge client={client} booking={booking} />}
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
            {!compact && (booking.created_at || client?.last_booking_date) && (
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

function CancellationDetailItem({
    booking,
    clients,
    onDelete,
    deleting,
}: {
    booking: Booking;
    clients: Client[];
    onDelete?: (booking: Booking) => void;
    deleting?: boolean;
}) {
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-savron-silver">
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
                {onDelete && (
                    <button
                        type="button"
                        onClick={() => onDelete(booking)}
                        disabled={deleting}
                        className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-widest text-red-400 border border-red-500/25 rounded-savron hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                        {deleting ? (
                            <div className="w-3 h-3 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                        ) : (
                            <Trash2 className="w-3 h-3" />
                        )}
                        Delete report
                    </button>
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

function renderContent(
    statKey: StatKey,
    data: StatDetailData,
    cutoff: string,
    dateRange: DateRange,
    options?: {
        onDeleteCancellation?: (booking: Booking) => void;
        deletingCancellationId?: string | null;
        deleteCancellationError?: string | null;
    },
) {
    const today = todayDateStr();
    const filteredActive = filterActiveBookings(data.allBookings, dateRange);
    const filteredCancellations = filterCancellations(data.allBookings, dateRange);
    const filteredPipeline = filterPipelineBookings(data.allBookings, dateRange);
    const filteredToday = filterActiveBookings(
        data.allBookings,
        DATE_FILTER_STATS.includes(statKey) && (statKey === 'todayAppointments' || statKey === 'todayRevenue')
            ? dateRange
            : { start: today, end: today },
    );
    const serviceBreakdown = computeServiceBreakdown(filteredActive);
    const avgTicketStats = computeAvgTicketStats(filteredActive);
    const revenueByMonth = computeRevenueByMonth(filteredActive);
    const barberWorkloads = computeBarberWorkloads(
        data.activeBarbers,
        filteredActive,
        filteredToday,
        filteredPipeline,
    );
    const pipelineValue = filteredPipeline.reduce((sum, b) => sum + parsePrice(b.price), 0);
    const pipelineDateRange = filteredPipeline.length > 0
        ? { earliest: filteredPipeline[0].date, latest: filteredPipeline[filteredPipeline.length - 1].date }
        : null;
    const clientsInRange = clientsWithBookingsInRange(data.allClients, filteredActive);

    switch (statKey) {
        case 'todayAppointments': {
            return filteredActive.length === 0
                ? <EmptyState message="No appointments in this date range" />
                : <>
                    <SummaryBanner items={[
                        { label: 'Appointments', value: String(filteredActive.length) },
                        { label: 'Completed', value: String(filteredActive.filter(b => b.status === 'completed').length) },
                        { label: 'Confirmed', value: String(filteredActive.filter(b => b.status === 'confirmed').length) },
                    ]} />
                    {filteredActive.map(b => <BookingDetailItem key={b.id} booking={b} clients={data.allClients} />)}
                </>;
        }

        case 'todayRevenue': {
            const schedule = filteredActive;
            const serviceMap: Record<string, { count: number; revenue: number }> = {};
            schedule.forEach(b => {
                const service = b.service || 'Unknown';
                if (!serviceMap[service]) serviceMap[service] = { count: 0, revenue: 0 };
                serviceMap[service].count++;
                serviceMap[service].revenue += parsePrice(b.price);
            });
            const todayServices = Object.entries(serviceMap)
                .map(([service, stats]) => ({
                    service,
                    count: stats.count,
                    revenue: stats.revenue,
                    avgPrice: stats.count > 0 ? stats.revenue / stats.count : 0,
                    recentBookings: [],
                }))
                .sort((a, b) => b.revenue - a.revenue);
            const total = schedule.reduce((s, b) => s + parsePrice(b.price), 0);

            return schedule.length === 0
                ? <EmptyState message="No revenue in this date range" />
                : <>
                    <SummaryBanner items={[
                        { label: 'Total revenue', value: `$${total.toFixed(0)}` },
                        { label: 'Appointments', value: String(schedule.length) },
                        { label: 'Avg ticket', value: schedule.length > 0 ? `$${(total / schedule.length).toFixed(0)}` : '$0' },
                    ]} />
                    <ServiceBreakdownTable items={todayServices} />
                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/60 pt-4 pb-2">Each booking</p>
                    {schedule.map(b => <BookingDetailItem key={b.id} booking={b} clients={data.allClients} showQualification={false} />)}
                </>;
        }

        case 'pipeline':
            return filteredPipeline.length === 0
                ? <EmptyState message="No upcoming bookings in this date range" />
                : <>
                    <SummaryBanner items={[
                        { label: 'Upcoming', value: String(filteredPipeline.length) },
                        { label: 'Pipeline value', value: `$${pipelineValue.toLocaleString()}` },
                        {
                            label: 'Date range',
                            value: pipelineDateRange
                                ? `${formatDateLabel(pipelineDateRange.earliest)} – ${formatDateLabel(pipelineDateRange.latest)}`
                                : '—',
                        },
                    ]} />
                    {filteredPipeline.map(b => <BookingDetailItem key={b.id} booking={b} clients={data.allClients} />)}
                </>;

        case 'totalRevenue':
            return revenueByMonth.length === 0
                ? <EmptyState message="No revenue in this date range" />
                : <>
                    <SummaryBanner items={[
                        { label: 'Revenue', value: `$${avgTicketStats.total.toLocaleString()}` },
                        { label: 'Bookings', value: String(avgTicketStats.count) },
                        { label: 'Avg ticket', value: `$${avgTicketStats.avg.toFixed(0)}` },
                    ]} />
                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/60 pt-2 pb-1">Tap a month to see who booked and what they paid</p>
                    {revenueByMonth.map(m => (
                        <MonthRevenueSection key={m.month} {...m} clients={data.allClients} />
                    ))}
                </>;

        case 'totalAppointments':
            return filteredActive.length === 0
                ? <EmptyState message="No appointments in this date range" />
                : <>
                    <SummaryBanner items={[
                        { label: 'Appointments', value: String(filteredActive.length) },
                        { label: 'Completed', value: String(filteredActive.filter(b => b.status === 'completed').length) },
                        { label: 'Confirmed', value: String(filteredActive.filter(b => b.status === 'confirmed').length) },
                    ]} />
                    {filteredActive.map(b => <BookingDetailItem key={b.id} booking={b} clients={data.allClients} />)}
                </>;

        case 'avgTicket':
            return serviceBreakdown.length === 0
                ? <EmptyState message="No appointments in this date range" />
                : <>
                    <SummaryBanner items={[
                        { label: 'Average ticket', value: `$${avgTicketStats.avg.toFixed(2)}` },
                        { label: 'Highest', value: `$${avgTicketStats.max.toFixed(0)}` },
                        { label: 'Lowest', value: `$${avgTicketStats.min.toFixed(0)}` },
                    ]} />
                    <ServiceBreakdownTable items={serviceBreakdown} showAvg />
                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/60 pt-4 pb-2">Bookings in range</p>
                    {filteredActive.slice(0, 15).map(b => (
                        <BookingDetailItem key={b.id} booking={b} clients={data.allClients} showQualification={false} compact />
                    ))}
                </>;

        case 'topService':
            return serviceBreakdown.length === 0
                ? <EmptyState message="No appointments in this date range" />
                : <>
                    <SummaryBanner items={[
                        { label: 'Top service', value: serviceBreakdown[0]?.service || '—' },
                        { label: 'Bookings', value: String(serviceBreakdown[0]?.count || 0) },
                        { label: 'Revenue', value: `$${(serviceBreakdown[0]?.revenue || 0).toLocaleString()}` },
                    ]} />
                    <p className="text-[10px] uppercase tracking-widest text-savron-silver/60 pt-2 pb-1">Tap a service to see who booked it</p>
                    {serviceBreakdown.map((s, i) => (
                        <ServiceDetailSection key={s.service} item={s} clients={data.allClients} rank={i} />
                    ))}
                </>;

        case 'totalClients': {
            const showAllClients = !dateRange.start && !dateRange.end;
            const clientsToShow = showAllClients ? data.allClients : clientsInRange;
            return clientsToShow.length === 0
                ? <EmptyState message={showAllClients ? 'No clients yet' : 'No clients with appointments in this date range'} />
                : <>
                    <SummaryBanner items={[
                        { label: 'Clients', value: String(clientsToShow.length) },
                        { label: 'VIP members', value: String(clientsToShow.filter(c => c.membership_status === 'vip').length) },
                        { label: showAllClients ? 'Due for visit' : 'Bookings', value: showAllClients ? String(data.dueClients.length) : String(filteredActive.length) },
                    ]} />
                    {clientsToShow.map(c => <ClientDetailItem key={c.id} client={c} />)}
                </>;
        }

        case 'dueForVisit':
            return data.dueClients.length === 0
                ? <EmptyState message="All clients are up to date" />
                : <>
                    <SummaryBanner items={[
                        { label: 'Overdue clients', value: String(data.dueClients.length) },
                        { label: 'Never visited', value: String(data.dueClients.filter(c => !c.last_booking_date).length) },
                        { label: '6+ weeks out', value: String(data.dueClients.filter(c => c.last_booking_date).length) },
                    ]} />
                    {data.dueClients.map(c => <ClientDetailItem key={c.id} client={c} showDaysOverdue cutoff={cutoff} />)}
                </>;

        case 'barbersActive':
            return barberWorkloads.length === 0
                ? <EmptyState message="No active barbers" />
                : barberWorkloads.map(({ barber, todayCount, upcomingCount, bookingCount, totalRevenue }) => (
                    <DetailRow key={barber.id}>
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                                <p className="text-white text-sm font-medium">{barber.name}</p>
                                <p className="text-savron-silver text-xs">{barber.role}</p>
                                {barber.specialties && barber.specialties.length > 0 && (
                                    <p className="text-savron-silver/60 text-[10px] uppercase tracking-wider mt-1">
                                        {barber.specialties.join(' · ')}
                                    </p>
                                )}
                                <ContactRow phone={barber.phone} email={barber.email} />
                            </div>
                            <span className="text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-full border bg-savron-green/10 text-accent-blue border-savron-green/20 shrink-0">
                                Active
                            </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                            {[
                                { label: 'Today', value: String(todayCount) },
                                { label: 'Upcoming', value: String(upcomingCount) },
                                { label: 'Bookings', value: String(bookingCount) },
                                { label: 'Revenue', value: `$${totalRevenue.toLocaleString()}` },
                            ].map(stat => (
                                <div key={stat.label} className="p-2 rounded bg-white/[0.03] border border-white/[0.06] text-center">
                                    <p className="text-[9px] uppercase tracking-widest text-savron-silver/50">{stat.label}</p>
                                    <p className="text-white font-mono text-xs mt-0.5">{stat.value}</p>
                                </div>
                            ))}
                        </div>
                    </DetailRow>
                ));

        case 'pendingApplicants':
            return data.pendingApplicants.length === 0
                ? <EmptyState message="No pending applications" />
                : <>
                    <SummaryBanner items={[
                        { label: 'Pending', value: String(data.pendingApplicants.length) },
                        {
                            label: 'Licensed',
                            value: String(data.pendingApplicants.filter(a => a.license_status?.toLowerCase().includes('licensed')).length),
                        },
                        {
                            label: 'Most recent',
                            value: data.pendingApplicants[0] ? timeAgo(data.pendingApplicants[0].created_at) : '—',
                        },
                    ]} />
                    {data.pendingApplicants.map(a => (
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
                    ))}
                </>;

        case 'recentCancellations':
            return filteredCancellations.length === 0
                ? <EmptyState message="No cancellations in this date range" />
                : <>
                    {options?.deleteCancellationError && (
                        <div className="mb-4 p-3 border border-red-500/30 bg-red-500/10 rounded-savron text-red-400 text-xs flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            {options.deleteCancellationError}
                        </div>
                    )}
                    <SummaryBanner items={[
                        { label: 'Total', value: String(filteredCancellations.length) },
                        { label: 'Cancelled', value: String(filteredCancellations.filter(b => b.status === 'cancelled').length) },
                        { label: 'No-shows', value: String(filteredCancellations.filter(b => b.status === 'no_show').length) },
                    ]} />
                    {filteredCancellations.map(b => (
                        <CancellationDetailItem
                            key={b.id}
                            booking={b}
                            clients={data.allClients}
                            onDelete={options?.onDeleteCancellation}
                            deleting={options?.deletingCancellationId === b.id}
                        />
                    ))}
                </>;

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

export function StatDetailView({
    statKey,
    data,
    cutoff,
    showDateFilter = true,
    onDataChange,
}: {
    statKey: StatKey;
    data: StatDetailData;
    cutoff: string;
    showDateFilter?: boolean;
    onDataChange?: (next: StatDetailData) => void;
}) {
    const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange(statKey));
    const [deletingCancellationId, setDeletingCancellationId] = useState<string | null>(null);
    const [deleteCancellationError, setDeleteCancellationError] = useState<string | null>(null);

    useEffect(() => {
        setDateRange(getDefaultDateRange(statKey));
    }, [statKey]);

    async function handleDeleteCancellation(booking: Booking) {
        if (!confirm(`Delete this ${booking.status === 'no_show' ? 'no-show' : 'cancellation'} report for ${booking.client_name || 'this client'}? This permanently removes the booking record.`)) {
            return;
        }

        setDeletingCancellationId(booking.id);
        setDeleteCancellationError(null);

        const result = await triggerCancelBooking(booking.id, { hardDelete: true });
        if (!result.success) {
            setDeleteCancellationError(result.error ?? 'Could not delete report entry');
            setDeletingCancellationId(null);
            return;
        }

        const nextData: StatDetailData = {
            ...data,
            allBookings: data.allBookings.filter(b => b.id !== booking.id),
            recentCancellations: data.recentCancellations.filter(b => b.id !== booking.id),
        };
        onDataChange?.(nextData);
        setDeletingCancellationId(null);
    }

    return (
        <div className="space-y-4">
            {showDateFilter && DATE_FILTER_STATS.includes(statKey) && (
                <DateRangeFilter
                    start={dateRange.start}
                    end={dateRange.end}
                    onChange={setDateRange}
                />
            )}
            {renderContent(statKey, data, cutoff, dateRange, statKey === 'recentCancellations' ? {
                onDeleteCancellation: handleDeleteCancellation,
                deletingCancellationId,
                deleteCancellationError,
            } : undefined)}
        </div>
    );
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
    const linkHref = statPageHref(statKey);

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
                            className="bg-savron-grey border border-white/10 rounded-savron w-full max-w-xl max-h-[min(85dvh,calc(100dvh-2rem))] shadow-2xl flex flex-col overflow-hidden my-auto"
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
                                    className="admin-icon-btn text-savron-silver hover:text-white hover:bg-white/5"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="overflow-y-auto flex-1 px-5 min-h-0 py-4">
                                <StatDetailView statKey={statKey} data={data} cutoff={cutoff} />
                            </div>

                            <div className="p-4 border-t border-white/[0.06] shrink-0">
                                <Link
                                    href={linkHref}
                                    className="block text-center text-xs uppercase tracking-widest text-accent-blue hover:text-savron-cream transition-colors"
                                >
                                    Open full page →
                                </Link>
                            </div>
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
    const activeBookings = allBookings
        .filter(b => b.status === 'confirmed' || b.status === 'completed')
        .sort((a, b) => {
            const dateCompare = b.date.localeCompare(a.date);
            if (dateCompare !== 0) return dateCompare;
            return (b.time || '').localeCompare(a.time || '');
        });

    const prices = activeBookings.map(b => parsePrice(b.price));
    const totalRevenue = prices.reduce((sum, p) => sum + p, 0);
    const avgTicketStats: AvgTicketStats = {
        avg: activeBookings.length > 0 ? totalRevenue / activeBookings.length : 0,
        min: prices.length > 0 ? Math.min(...prices) : 0,
        max: prices.length > 0 ? Math.max(...prices) : 0,
        total: totalRevenue,
        count: activeBookings.length,
    };

    const serviceMap: Record<string, { count: number; revenue: number; bookings: Booking[] }> = {};
    activeBookings.forEach(b => {
        if (!b.service) return;
        if (!serviceMap[b.service]) serviceMap[b.service] = { count: 0, revenue: 0, bookings: [] };
        serviceMap[b.service].count++;
        serviceMap[b.service].revenue += parsePrice(b.price);
        serviceMap[b.service].bookings.push(b);
    });

    const serviceBreakdown: ServiceBreakdownItem[] = Object.entries(serviceMap)
        .map(([service, stats]) => ({
            service,
            count: stats.count,
            revenue: stats.revenue,
            avgPrice: stats.count > 0 ? stats.revenue / stats.count : 0,
            recentBookings: stats.bookings.slice(0, 5),
        }))
        .sort((a, b) => b.count - a.count);

    const monthMap: Record<string, { revenue: number; count: number; bookings: Booking[] }> = {};
    activeBookings.forEach(b => {
        try {
            const month = format(parseISO(b.date), 'MMMM yyyy');
            if (!monthMap[month]) monthMap[month] = { revenue: 0, count: 0, bookings: [] };
            monthMap[month].revenue += parsePrice(b.price);
            monthMap[month].count++;
            monthMap[month].bookings.push(b);
        } catch { /* skip invalid dates */ }
    });

    const revenueByMonth: RevenueByMonthItem[] = Object.entries(monthMap)
        .map(([month, stats]) => ({
            month,
            revenue: stats.revenue,
            count: stats.count,
            bookings: stats.bookings.sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date);
                if (dateCompare !== 0) return dateCompare;
                return (b.time || '').localeCompare(a.time || '');
            }),
        }))
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

    const barberWorkloads: BarberWorkload[] = activeBarbers.map(barber => {
        const barberBookings = activeBookings.filter(b =>
            b.barber_id === barber.id || b.barber_name === barber.name
        );
        return {
            barber,
            todayCount: todaySchedule.filter(b =>
                b.barber_id === barber.id || b.barber_name === barber.name
            ).length,
            upcomingCount: upcomingSchedule.filter(b =>
                b.barber_id === barber.id || b.barber_name === barber.name
            ).length,
            bookingCount: barberBookings.length,
            completedCount: barberBookings.filter(b => b.status === 'completed').length,
            totalRevenue: barberBookings.reduce((sum, b) => sum + parsePrice(b.price), 0),
        };
    });

    const pipelineValue = upcomingSchedule.reduce((sum, b) => sum + parsePrice(b.price), 0);
    const pipelineDateRange = upcomingSchedule.length > 0
        ? {
            earliest: upcomingSchedule[0].date,
            latest: upcomingSchedule[upcomingSchedule.length - 1].date,
        }
        : null;

    return {
        todaySchedule,
        upcomingSchedule,
        dueClients,
        allClients,
        activeBarbers,
        pendingApplicants,
        recentCancellations,
        allBookings,
        activeBookings,
        serviceBreakdown,
        revenueByMonth,
        avgTicketStats,
        barberWorkloads,
        pipelineValue,
        pipelineDateRange,
    };
}
