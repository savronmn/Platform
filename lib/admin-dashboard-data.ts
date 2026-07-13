import type { SupabaseClient } from '@supabase/supabase-js';
import { format, subDays } from 'date-fns';
import { buildStatDetailData, type StatDetailData } from '@/components/crm/StatDetailModal';
import type { Applicant, Barber, Booking, Client } from '@/lib/types';

export interface AdminDashboardData {
    detailData: StatDetailData;
    dueCutoff: string;
    todaySchedule: Booking[];
    upcomingSchedule: Booking[];
}

export async function fetchAdminDashboardData(
    supabase: SupabaseClient,
): Promise<AdminDashboardData> {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    const cutoff = format(sixWeeksAgo, 'yyyy-MM-dd');

    const [
        clientsRes,
        todayBookingsRes,
        upcomingRes,
        applicantsRes,
        barbersRes,
        allBookingsRes,
        cancelledRes,
    ] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('bookings').select('*').eq('date', todayStr).order('time', { ascending: true }),
        supabase
            .from('bookings')
            .select('*')
            .gt('date', todayStr)
            .eq('status', 'confirmed')
            .order('date', { ascending: true })
            .order('time', { ascending: true })
            .limit(50),
        supabase.from('applicants').select('*').eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('barbers').select('*'),
        supabase.from('bookings').select('*').order('created_at', { ascending: false }),
        supabase
            .from('bookings')
            .select('*')
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

    const allClients: Client[] = clientsRes.data ?? [];
    const todayAll: Booking[] = todayBookingsRes.data ?? [];
    const upcoming: Booking[] = upcomingRes.data ?? [];
    const allBarbers: Barber[] = barbersRes.data ?? [];
    const allBookings: Booking[] = allBookingsRes.data ?? [];
    const recentCancelled: Booking[] = cancelledRes.data ?? [];
    const pendingApplicants: Applicant[] = applicantsRes.data ?? [];

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
