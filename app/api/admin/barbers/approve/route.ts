import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { assertAdminRequest } from '@/lib/admin-auth';
import { sendBarberWelcomeEmail } from '@/lib/send-barber-welcome-email';

async function seedBarberServices(barberId: string) {
    const supabase = getSupabaseAdmin();

    const { count } = await supabase
        .from('barber_service')
        .select('*', { count: 'exact', head: true })
        .eq('barber_id', barberId);

    if (count && count > 0) return;

    const { data: services } = await supabase
        .from('services')
        .select('id, name, price_cents, duration_minutes')
        .eq('active', true);

    if (!services?.length) return;

    const { data: barber } = await supabase
        .from('barbers')
        .select('services_offered')
        .eq('id', barberId)
        .single();

    const offered = barber?.services_offered;
    const toInsert = services.filter((s) =>
        !offered?.length || offered.includes(s.name),
    );

    if (toInsert.length === 0) return;

    await supabase.from('barber_service').insert(
        toInsert.map((s) => ({
            barber_id: barberId,
            service_id: s.id,
            price_cents: s.price_cents,
            duration_minutes: s.duration_minutes,
            updated_at: new Date().toISOString(),
        })),
    );

    await supabase
        .from('barbers')
        .update({ services_offered: toInsert.map((s) => s.name) })
        .eq('id', barberId);
}

/** POST /api/admin/barbers/approve — activate barber, seed services, send welcome email */
export async function POST(request: NextRequest) {
    const isAdmin = await assertAdminRequest(request.headers.get('authorization'));
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { barberId, origin } = await request.json() as { barberId?: string; origin?: string };
    if (!barberId) {
        return NextResponse.json({ error: 'Missing barberId' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: barber, error: fetchErr } = await supabase
        .from('barbers')
        .select('id, name, email, slug, active')
        .eq('id', barberId)
        .single();

    if (fetchErr || !barber) {
        return NextResponse.json({ error: 'Barber not found' }, { status: 404 });
    }

    const wasInactive = !barber.active;

    const { error: updateErr } = await supabase
        .from('barbers')
        .update({ active: true })
        .eq('id', barberId);

    if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await seedBarberServices(barberId);

    let emailResult: { success: boolean; error?: string; skipped?: boolean } = { success: true, skipped: true };
    if (wasInactive && barber.email) {
        emailResult = await sendBarberWelcomeEmail({
            name: barber.name,
            email: barber.email,
            slug: barber.slug,
            origin,
        });
    }

    return NextResponse.json({
        success: true,
        barber: { ...barber, active: true },
        email: emailResult,
    });
}
