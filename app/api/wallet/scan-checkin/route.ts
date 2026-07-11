import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncWalletsAfterCheckin } from '@/lib/wallet-checkin';
import { requireStaff } from '@/lib/staff-auth';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

const SCAN_DEBOUNCE_MS = 30_000;

export async function POST(req: NextRequest) {
    try {
        const staff = await requireStaff();
        if (!staff.ok) {
            return NextResponse.json({ error: staff.error }, { status: staff.status });
        }

        const body = await req.json();
        const { qrValue } = body as { qrValue: string };

        if (!qrValue || typeof qrValue !== 'string') {
            return NextResponse.json({ error: 'qrValue required' }, { status: 400 });
        }

        const email = qrValue.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Invalid QR code — not a valid ePass' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const { data: subscriber, error: fetchErr } = await supabase
            .from('email_subscribers')
            .select('*')
            .eq('email', email)
            .eq('active', true)
            .single();

        if (fetchErr || !subscriber) {
            return NextResponse.json({ error: 'Pass not found', scanned: email }, { status: 404 });
        }

        // Debounce rapid double-scans so the member does not get inflated counts.
        if (subscriber.last_visit_at) {
            const last = new Date(subscriber.last_visit_at).getTime();
            if (Number.isFinite(last) && Date.now() - last < SCAN_DEBOUNCE_MS) {
                return NextResponse.json({
                    success: true,
                    debounced: true,
                    subscriber: {
                        id: subscriber.id,
                        name: subscriber.name,
                        email: subscriber.email,
                        visit_count: subscriber.visit_count,
                        last_visit_at: subscriber.last_visit_at,
                    },
                    google_wallet_object_id: subscriber.google_pass_object_id ?? null,
                });
            }
        }

        const { data: updated, error: updateErr } = await supabase
            .rpc('increment_subscriber_visit', { p_subscriber_id: subscriber.id });

        let newCount: number;
        let lastVisitAt: string;

        if (updateErr || !updated) {
            // Fallback if migration RPC is not applied yet.
            console.warn('[scan-checkin] RPC unavailable, using atomic-ish update:', updateErr?.message);
            newCount = (subscriber.visit_count ?? 0) + 1;
            lastVisitAt = new Date().toISOString();
            const { error: fallbackErr } = await supabase
                .from('email_subscribers')
                .update({ visit_count: newCount, last_visit_at: lastVisitAt })
                .eq('id', subscriber.id)
                .eq('visit_count', subscriber.visit_count);
            if (fallbackErr) {
                return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 });
            }
        } else {
            const row = Array.isArray(updated) ? updated[0] : updated;
            newCount = row.visit_count;
            lastVisitAt = row.last_visit_at;
        }

        const walletSync = await syncWalletsAfterCheckin(subscriber, newCount, lastVisitAt);

        return NextResponse.json({
            success: true,
            subscriber: {
                id: subscriber.id,
                name: subscriber.name,
                email: subscriber.email,
                visit_count: newCount,
                last_visit_at: lastVisitAt,
            },
            ...walletSync,
            google_wallet_object_id: subscriber.google_pass_object_id ?? null,
        });
    } catch (err) {
        console.error('scan-checkin failed:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
