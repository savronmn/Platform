import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { assertAdminRequest } from '@/lib/admin-auth';

const PHOTO_BUCKET = 'barber-portfolios';

/** POST /api/barbers/upload-photo — barber uploads their own profile photo */
export async function POST(request: NextRequest) {
    const supabase = getSupabaseAdmin();
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const barberId = formData.get('barberId') as string | null;
    const authHeader = request.headers.get('authorization');

    if (!file?.size || !barberId) {
        return NextResponse.json({ error: 'Missing file or barberId' }, { status: 400 });
    }

    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { createClient } = await import('@supabase/supabase-js');
    const authClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: barber } = await supabase
        .from('barbers')
        .select('id, auth_id')
        .eq('id', barberId)
        .single();

    const isOwner = barber?.auth_id === user.id;
    const isAdmin = await assertAdminRequest(authHeader);
    if (!isOwner && !isAdmin) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${barberId}/profile/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, buffer, { contentType: file.type, upsert: true });

    if (uploadErr) {
        return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);

    await supabase.from('barbers').update({ image_url: publicUrl }).eq('id', barberId);

    return NextResponse.json({ success: true, imageUrl: publicUrl });
}
