import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { syncWalletsAfterCheckin } from '@/lib/wallet-checkin';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function POST(req: NextRequest) {
    try {
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

        const newCount = subscriber.visit_count + 1;
        const lastVisitAt = new Date().toISOString();

        const { error: updateErr } = await supabase
            .from('email_subscribers')
            .update({ visit_count: newCount, last_visit_at: lastVisitAt })
            .eq('id', subscriber.id);

        if (updateErr) {
            return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 });
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
