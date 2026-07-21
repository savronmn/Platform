import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { saveBarberServices, type BarberServiceInput } from '@/lib/barber-services';
import { assertAdminRequest } from '@/lib/admin-auth';

/** GET /api/barber-services?barberId= — public read of a barber's service menu */
export async function GET(request: NextRequest) {
    const barberId = request.nextUrl.searchParams.get('barberId');
    if (!barberId) {
        return NextResponse.json({ error: 'Missing barberId' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data, error } = await supabase
        .from('barber_service')
        .select(`
            barber_id,
            service_id,
            price_cents,
            duration_minutes,
            services ( id, name, color, description, active, sort_order )
        `)
        .eq('barber_id', barberId);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ services: data ?? [] });
}

/** PUT /api/barber-services — admin-only save of barber service offerings */
export async function PUT(request: NextRequest) {
    const isAdmin = await assertAdminRequest(request.headers.get('authorization'));
    if (!isAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
        barberId: string;
        offerings: BarberServiceInput[];
    };

    if (!body.barberId || !Array.isArray(body.offerings)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    try {
        const result = await saveBarberServices(body.barberId, body.offerings);
        return NextResponse.json({ success: true, ...result });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Save failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
