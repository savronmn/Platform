import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function POST(req: NextRequest) {
    const { email, code } = await req.json();
    if (!email || !code) {
        return NextResponse.json({ error: 'Email and code required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseAdmin();

    // Find matching, non-expired OTP
    const { data: otpRow } = await supabase
        .from('epass_otps')
        .select('id, code, expires_at')
        .eq('email', normalizedEmail)
        .eq('code', code.trim())
        .gt('expires_at', new Date().toISOString())
        .single();

    if (!otpRow) {
        return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    // Delete used OTP
    await supabase.from('epass_otps').delete().eq('id', otpRow.id);

    // Fetch subscriber
    const { data: subscriber } = await supabase
        .from('email_subscribers')
        .select('name, email, visit_count, last_visit_at, issued_at')
        .eq('email', normalizedEmail)
        .single();

    if (!subscriber) {
        return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, subscriber });
}
