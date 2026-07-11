import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    ensureWalletAuthToken,
    generateApplePassBuffer,
    isAppleWalletConfigured,
} from '@/lib/apple-wallet';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function GET(req: NextRequest) {
    const serial = req.nextUrl.searchParams.get('serial');
    if (!serial) {
        return new NextResponse('Missing serial', { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: subscriber } = await supabase
        .from('email_subscribers')
        .select('id, name, email, visit_count, pass_serial_number, wallet_auth_token, pass_updated_at')
        .eq('pass_serial_number', serial)
        .single();

    if (!subscriber) {
        return new NextResponse('Pass not found', { status: 404 });
    }

    if (!isAppleWalletConfigured()) {
        return new NextResponse('Wallet not configured', { status: 503 });
    }

    const authToken = await ensureWalletAuthToken(subscriber.id, subscriber.wallet_auth_token);
    const passBuffer = generateApplePassBuffer(subscriber, authToken);
    if (!passBuffer) {
        return new NextResponse('Failed to generate pass', { status: 500 });
    }

    const safeName = subscriber.name.replace(/\s+/g, '_');
    const headers: Record<string, string> = {
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename="${safeName}_savron.pkpass"`,
        'Cache-Control': 'no-store',
    };
    if (subscriber.pass_updated_at) {
        headers['Last-Modified'] = new Date(subscriber.pass_updated_at).toUTCString();
    }

    return new NextResponse(passBuffer as unknown as BodyInit, { status: 200, headers });
}
