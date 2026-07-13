"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { StatDetailView, STAT_TITLES, type StatKey } from '@/components/crm/StatDetailModal';
import { fetchAdminDashboardData } from '@/lib/admin-dashboard-data';
import { statKeyFromSlug } from '@/lib/admin-stat-routes';
import type { StatDetailData } from '@/components/crm/StatDetailModal';

const EMPTY_DETAIL_DATA: StatDetailData = {
    todaySchedule: [],
    upcomingSchedule: [],
    dueClients: [],
    allClients: [],
    activeBarbers: [],
    pendingApplicants: [],
    recentCancellations: [],
    allBookings: [],
    activeBookings: [],
    serviceBreakdown: [],
    revenueByMonth: [],
    avgTicketStats: { avg: 0, min: 0, max: 0, total: 0, count: 0 },
    barberWorkloads: [],
    pipelineValue: 0,
    pipelineDateRange: null,
};

export default function AdminStatDetailPage() {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    const slug = params.statKey as string;
    const statKey = statKeyFromSlug(slug);

    const [detailData, setDetailData] = useState<StatDetailData>(EMPTY_DETAIL_DATA);
    const [dueCutoff, setDueCutoff] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!statKey) {
            router.replace('/admin');
            return;
        }

        let cancelled = false;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const data = await fetchAdminDashboardData(supabase);
                if (cancelled) return;
                setDetailData(data.detailData);
                setDueCutoff(data.dueCutoff);
            } catch (err: unknown) {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : 'Failed to load stat details';
                setError(message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void load();
        return () => {
            cancelled = true;
        };
    }, [statKey, router, supabase]);

    if (!statKey) return null;

    const { title, subtitle } = STAT_TITLES[statKey as StatKey];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="w-6 h-6 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="admin-page">
                <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-xl space-y-4">
                    <h2 className="text-red-400 font-bold uppercase tracking-widest">Failed to load details</h2>
                    <p className="text-white text-sm font-mono">{error}</p>
                    <Link
                        href="/admin"
                        className="inline-flex items-center gap-2 px-4 py-2 border border-white/10 text-savron-silver hover:text-white rounded-lg uppercase tracking-widest text-xs transition-all"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <div className="admin-header">
                <div className="flex items-start gap-3 min-w-0">
                    <Link
                        href="/admin"
                        className="admin-icon-btn border border-white/10 text-savron-silver hover:text-white hover:border-white/25 transition-all shrink-0 mt-1"
                        aria-label="Back to dashboard"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="min-w-0">
                        <p className="admin-kicker">Dashboard insight</p>
                        <h1 className="admin-title">{title}</h1>
                        <p className="admin-subtitle">{subtitle}</p>
                    </div>
                </div>
            </div>

            <div className="card-savron">
                <StatDetailView statKey={statKey} data={detailData} cutoff={dueCutoff} />
            </div>
        </div>
    );
}
