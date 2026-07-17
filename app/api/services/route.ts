// /api/services — admin-only CRUD using service role key (bypasses RLS)
// GET    → list all services ordered by sort_order
// POST   → create service
// PUT    → update service (id in body)
// DELETE → delete service (id in body)
// PATCH  → reorder (body: { ids: string[] } — ordered list of IDs)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function adminClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function GET() {
    const { data, error } = await adminClient()
        .from('services')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { name, duration_minutes, price_cents, color, description } = body;
    if (!name?.trim() || !duration_minutes || price_cents == null) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    // Append to end of sort order
    const { data: last } = await adminClient()
        .from('services')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();
    const sort_order = (last?.sort_order ?? 0) + 1;

    const { data, error } = await adminClient()
        .from('services')
        .insert({ name: name.trim(), duration_minutes, price_cents, color: color ?? 'blue', description: description?.trim() || null, active: true, sort_order })
        .select()
        .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function PUT(req: NextRequest) {
    const body = await req.json();
    const {
        id,
        name,
        duration_minutes,
        price_cents,
        color,
        description,
        shop_calendar_id,
        google_booking_page_url,
        booking_page_slug,
    } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const updates: Record<string, unknown> = {};
    if (name !== undefined)             updates.name = name.trim();
    if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes;
    if (price_cents !== undefined)      updates.price_cents = price_cents;
    if (color !== undefined)            updates.color = color;
    if (description !== undefined)      updates.description = description?.trim() || null;
    if (shop_calendar_id !== undefined) {
        updates.shop_calendar_id = typeof shop_calendar_id === 'string' && shop_calendar_id.trim()
            ? shop_calendar_id.trim()
            : null;
    }
    if (google_booking_page_url !== undefined) {
        updates.google_booking_page_url = typeof google_booking_page_url === 'string' && google_booking_page_url.trim()
            ? google_booking_page_url.trim()
            : null;
    }
    if (booking_page_slug !== undefined) {
        updates.booking_page_slug = typeof booking_page_slug === 'string' && booking_page_slug.trim()
            ? booking_page_slug.trim()
            : null;
    }

    const { data, error } = await adminClient()
        .from('services')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const { error } = await adminClient().from('services').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
    // Reorder: receive ordered array of IDs, assign sort_order 1…N
    const { ids } = await req.json() as { ids: string[] };
    if (!Array.isArray(ids)) return NextResponse.json({ error: 'ids must be an array' }, { status: 400 });

    const updates = ids.map((id, i) =>
        adminClient().from('services').update({ sort_order: i + 1 }).eq('id', id)
    );
    await Promise.all(updates);
    return NextResponse.json({ success: true });
}
