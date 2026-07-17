import { NextResponse } from 'next/server';
import { fetchAdminDashboardSummary } from '@/lib/admin-dashboard-data';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdminPanelSession } from '@/lib/staff-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const auth = await requireAdminPanelSession();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
        const summary = await fetchAdminDashboardSummary(getSupabaseAdmin());
        return NextResponse.json(summary);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard';
        console.error('Admin dashboard API error:', err);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
