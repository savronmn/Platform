import type { SupabaseClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';
import { buildStatDetailData, type StatDetailData } from '@/components/crm/StatDetailModal';
import type { Applicant, Barber, Booking, Client } from '@/lib/types';

/** Columns needed for schedule lists and stat drill-down rows (excludes heavy calendar fields). */
export const BOOKING_LIST_COLUMNS =
    'id, client_id, client_name, client_email, client_phone, service, barber_id, barber_name, date, time, duration, price, status, notes, client_photo_url, created_at';

/** Minimal columns for revenue / service aggregate stats. */
const BOOKING_STATS_COLUMNS = 'price, status, service';

const CLIENT_LIST_COLUMNS =
    'id, auth_id, name, email, phone, notes, preferences, membership_status, visit_count, last_booking_date, created_at';

const BARBER_LIST_COLUMNS =
    'id, auth_id, name, slug, role, bio, specialties, image_url, phone, email, instagram_url, license_number, services_offered, working_hours, portfolio_images, booking_links, active, created_at';

export interface AdminDashboardStats {
    clients: number;
    weeklyBookings: number;
    todayBookings: number;
    dueClients: number;
    todayRevenue: number;
    todayCompleted: number;
    pendingApplicants: number;
    activeBarbers: number;
    totalRevenue: number;
    avgTicket: number;
    topService: string;
    totalBookings: number;
    totalAppointments: number;
    recentCancellations: number;
}

export interface AdminDashboardSummary {
    stats: AdminDashboardStats;
    todaySchedule: Booking[];
    upcomingSchedule: Booking[];
}

export interface AdminDashboardData {
    detailData: StatDetailData;
    dueCutoff: string;
    todaySchedule: Booking[];
    upcomingSchedule: Booking[];
}

function parseBookingPrice(price: string | null | undefined): number {
    const parsed = parseFloat(String(price || '$0').replace(/[^0-9.]/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed;
}

function sumPrices(bookings: Pick<Booking, 'price'>[]): number {
    return bookings.reduce((sum, booking) => sum + parseBookingPrice(booking.price), 0);
}

function topServiceFromBookings(bookings: Pick<Booking, 'service'>[]): string {
    const serviceCounts: Record<string, number> = {};
    for (const booking of bookings) {
        if (!booking.service) continue;
        serviceCounts[booking.service] = (serviceCounts[booking.service] || 0) + 1;
    }

    let topService = '—';
    let maxCount = 0;
    for (const [service, count] of Object.entries(serviceCounts)) {
        if (count > maxCount) {
            maxCount = count;
            topService = service;
        }
    }
    return topService;
}

function dueCutoffDate(): string {
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    return format(sixWeeksAgo, 'yyyy-MM-dd');
}

function buildDashboardStats(input: {
    clientCount: number;
    dueClientCount: number;
    todayActive: Booking[];
    upcoming: Booking[];
    activeBarbersCount: number;
    pendingApplicantsCount: number;
    totalBookingsCount: number;
    activeBookings: Pick<Booking, 'price' | 'status' | 'service'>[];
    recentCancellationsCount: number;
}): AdminDashboardStats {
    const todayCompleted = input.todayActive.filter(b => b.status === 'completed');
    const todayRevenue = sumPrices(input.todayActive);
    const totalRevenue = sumPrices(input.activeBookings);
    const totalAppointments = input.activeBookings.length;

    return {
        clients: input.clientCount,
        weeklyBookings: input.upcoming.length,
        todayBookings: input.todayActive.length,
        dueClients: input.dueClientCount,
        todayRevenue,
        todayCompleted: todayCompleted.length,
        pendingApplicants: input.pendingApplicantsCount,
        activeBarbers: input.activeBarbersCount,
        totalRevenue,
        avgTicket: totalAppointments > 0 ? totalRevenue / totalAppointments : 0,
        topService: topServiceFromBookings(input.activeBookings),
        totalBookings: input.totalBookingsCount,
        totalAppointments,
        recentCancellations: input.recentCancellationsCount,
    };
}

/** Fast path for the main dashboard — counts + slim aggregates instead of full-table scans. */
export async function fetchAdminDashboardSummary(
    supabase: SupabaseClient,
): Promise<AdminDashboardSummary> {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const cutoff = dueCutoffDate();

    const [
        clientCountRes,
        dueClientCountRes,
        todayBookingsRes,
        upcomingRes,
        pendingApplicantsRes,
        activeBarbersRes,
        totalBookingsRes,
        activeBookingsRes,
        recentCancelledRes,
    ] = await Promise.all([
        supabase.from('clients').select('*', { count: 'exact', head: true }),
        supabase
            .from('clients')
            .select('*', { count: 'exact', head: true })
            .or(`last_booking_date.is.null,last_booking_date.lt.${cutoff}`),
        supabase
            .from('bookings')
            .select(BOOKING_LIST_COLUMNS)
            .eq('date', todayStr)
            .order('time', { ascending: true }),
        supabase
            .from('bookings')
            .select(BOOKING_LIST_COLUMNS)
            .gt('date', todayStr)
            .eq('status', 'confirmed')
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(50),
        supabase.from('applicants').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('barbers').select('*', { count: 'exact', head: true }).eq('active', true),
        supabase.from('bookings').select('*', { count: 'exact', head: true }),
        supabase
            .from('bookings')
            .select(BOOKING_STATS_COLUMNS)
            .in('status', ['confirmed', 'completed']),
        supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .in('status', ['cancelled', 'no_show'])
            .gte('date', thirtyDaysAgo),
    ]);

    if (clientCountRes.error) throw new Error(`Clients: ${clientCountRes.error.message}`);
    if (todayBookingsRes.error) throw new Error(`Today Bookings: ${todayBookingsRes.error.message}`);
    if (totalBookingsRes.error) throw new Error(`Bookings count: ${totalBookingsRes.error.message}`);
    if (activeBookingsRes.error) throw new Error(`Active bookings: ${activeBookingsRes.error.message}`);

    const todayAll = (todayBookingsRes.data ?? []) as Booking[];
    const todayActive = todayAll.filter(b => ['confirmed', 'completed'].includes(b.status));
    const upcoming = (upcomingRes.data ?? []) as Booking[];

    return {
        stats: buildDashboardStats({
            clientCount: clientCountRes.count ?? 0,
            dueClientCount: dueClientCountRes.count ?? 0,
            todayActive,
            upcoming,
            activeBarbersCount: activeBarbersRes.count ?? 0,
            pendingApplicantsCount: pendingApplicantsRes.count ?? 0,
            totalBookingsCount: totalBookingsRes.count ?? 0,
            activeBookings: activeBookingsRes.data ?? [],
            recentCancellationsCount: recentCancelledRes.count ?? 0,
        }),
        todaySchedule: todayActive,
        upcomingSchedule: upcoming,
    };
}

/** Full dataset for stat drill-down pages — still avoids calendar token payloads. */
export async function fetchAdminDashboardData(
    supabase: SupabaseClient,
): Promise<AdminDashboardData> {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const cutoff = dueCutoffDate();

    const [
        clientsRes,
        todayBookingsRes,
        upcomingRes,
        applicantsRes,
        barbersRes,
        allBookingsRes,
        cancelledRes,
    ] = await Promise.all([
        supabase.from('clients').select(CLIENT_LIST_COLUMNS),
        supabase
            .from('bookings')
            .select(BOOKING_LIST_COLUMNS)
            .eq('date', todayStr)
            .order('time', { ascending: true }),
        supabase
            .from('bookings')
            .select(BOOKING_LIST_COLUMNS)
            .gt('date', todayStr)
            .eq('status', 'confirmed')
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(50),
        supabase.from('applicants').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('barbers').select(BARBER_LIST_COLUMNS),
        supabase
            .from('bookings')
            .select(BOOKING_LIST_COLUMNS)
            .order('created_at', { ascending: false }),
        supabase
            .from('bookings')
            .select(BOOKING_LIST_COLUMNS)
            .in('status', ['cancelled', 'no_show'])
            .gte('date', thirtyDaysAgo)
            .order('date', { ascending: false })
            .order('time', { ascending: false })
            .limit(50),
    ]);

    if (clientsRes.error) throw new Error(`Clients: ${clientsRes.error.message}`);
    if (todayBookingsRes.error) throw new Error(`Today Bookings: ${todayBookingsRes.error.message}`);
    if (barbersRes.error) throw new Error(`Barbers: ${barbersRes.error.message}`);
    if (allBookingsRes.error) throw new Error(`All Bookings: ${allBookingsRes.error.message}`);

    const allClients = (clientsRes.data ?? []) as Client[];
    const todayAll = (todayBookingsRes.data ?? []) as Booking[];
    const upcoming = (upcomingRes.data ?? []) as Booking[];
    const allBarbers = (barbersRes.data ?? []) as Barber[];
    const allBookings = (allBookingsRes.data ?? []) as Booking[];
    const recentCancelled = (cancelledRes.data ?? []) as Booking[];
    const pendingApplicants = (applicantsRes.data ?? []) as Applicant[];

    const todayActive = todayAll.filter(b => ['confirmed', 'completed'].includes(b.status));

    return {
        dueCutoff: cutoff,
        todaySchedule: todayActive,
        upcomingSchedule: upcoming,
        detailData: buildStatDetailData(
            allClients,
            todayActive,
            upcoming,
            allBookings,
            allBarbers,
            pendingApplicants,
            recentCancelled,
            cutoff,
        ),
    };
}
