import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isGoogleWalletConfigured, syncGoogleWalletPass } from '@/lib/google-wallet';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

/** Sync Google Wallet pass from current DB row (called when ePass opens). */
export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json();
        if (!email || typeof email !== 'string') {
            return NextResponse.json({ error: 'Email required' }, { status: 400 });
        }

        if (!isGoogleWalletConfigured()) {
            return NextResponse.json({ synced: false, reason: 'google_wallet_not_configured' });
        }

        const supabase = getSupabaseAdmin();
        const { data: subscriber } = await supabase
            .from('email_subscribers')
            .select('name, email, visit_count, google_pass_object_id, active')
            .eq('email', email.trim().toLowerCase())
            .eq('active', true)
            .maybeSingle();

        if (!subscriber) {
            return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
        }

        if (!subscriber.google_pass_object_id) {
            return NextResponse.json({ synced: false, reason: 'no_google_pass_object_id' });
        }

        const updated = await syncGoogleWalletPass(
            subscriber.google_pass_object_id,
            subscriber.name,
            subscriber.email,
            subscriber.visit_count,
        );

        return NextResponse.json({
            synced: updated,
            visit_count: subscriber.visit_count,
            google_wallet_updated: updated,
        });
    } catch (err) {
        console.error('sync-google failed:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
