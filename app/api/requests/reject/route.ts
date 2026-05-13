// POST /api/requests/reject
// Admin-only — marks request rejected without applying changes.
// Body: { requestId: string, adminNote?: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { requestId, adminNote } = await request.json() as { requestId: string; adminNote?: string };

    if (!requestId) {
        return NextResponse.json({ error: 'Missing requestId' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
        .from('barber_change_requests')
        .update({
            status: 'rejected',
            admin_note: adminNote || null,
            resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('status', 'pending');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
