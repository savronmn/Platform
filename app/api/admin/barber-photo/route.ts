import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { assertAdminRequest } from '@/lib/admin-auth';

const PHOTO_BUCKET = 'barber-portfolios';

/** POST /api/admin/barber-photo — upload barber profile photo (admin, service role) */
export async function POST(request: NextRequest) {
    const isAdmin = await assertAdminRequest(request.headers.get('authorization'));
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const barberId = formData.get('barberId') as string | null;
    const file = formData.get('file') as File | null;

    if (!barberId || !file?.size) {
        return NextResponse.json({ error: 'Missing barberId or file' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
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

    const { error: updateErr } = await supabase
        .from('barbers')
        .update({ image_url: publicUrl })
        .eq('id', barberId);

    if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, imageUrl: publicUrl });
}
