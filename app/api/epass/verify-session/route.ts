import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function POST(req: NextRequest) {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: subscriber } = await supabase
        .from('email_subscribers')
        .select('name, email, visit_count, last_visit_at, issued_at')
        .eq('email', email.trim().toLowerCase())
        .single();

    if (!subscriber) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ subscriber });
}
