// POST /api/requests/approve
// Admin-only — applies a pending barber_change_request to the appropriate target table.
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

    const { data: req } = await supabaseAdmin
        .from('barber_change_requests')
        .select('*')
        .eq('id', requestId)
        .single();

    if (!req) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    if (req.status !== 'pending') return NextResponse.json({ error: 'Request already resolved' }, { status: 409 });

    // Apply payload to target table
    let applyResult: { error: any } = { error: null };
    if (req.type === 'schedule') {
        applyResult = await supabaseAdmin
            .from('barbers')
            .update({ working_hours: req.payload })
            .eq('id', req.barber_id);
    } else if (req.type === 'service') {
        applyResult = await supabaseAdmin
            .from('barbers')
            .update({ services_offered: req.payload.services_offered })
            .eq('id', req.barber_id);
    } else if (req.type === 'price') {
        // Payload shape: { service_id: string, price_cents: number }
        applyResult = await supabaseAdmin
            .from('services')
            .update({ price_cents: req.payload.price_cents })
            .eq('id', req.payload.service_id);
    } else if (req.type === 'profile') {
        // Payload may include: bio, specialties, instagram_url
        const updates: any = {};
        if (req.payload.bio !== undefined) updates.bio = req.payload.bio;
        if (req.payload.specialties !== undefined) updates.specialties = req.payload.specialties;
        if (req.payload.instagram_url !== undefined) updates.instagram_url = req.payload.instagram_url;
        applyResult = await supabaseAdmin
            .from('barbers')
            .update(updates)
            .eq('id', req.barber_id);
    }

    if (applyResult.error) {
        return NextResponse.json({ error: 'Failed to apply change', detail: applyResult.error.message }, { status: 500 });
    }

    const { error: updateErr } = await supabaseAdmin
        .from('barber_change_requests')
        .update({
            status: 'approved',
            admin_note: adminNote || null,
            resolved_at: new Date().toISOString(),
        })
        .eq('id', requestId);

    if (updateErr) {
        return NextResponse.json({ error: 'Applied but failed to mark approved', detail: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
