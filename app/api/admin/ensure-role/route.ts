// POST /api/admin/ensure-role
// Ensures the logged-in admin user has an admin role row for staff actions.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase-server';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST() {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = getAdmin();
    const { data: existingBarber } = await supabaseAdmin
        .from('barbers')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle();

    if (existingBarber) {
        return NextResponse.json({ success: true, role: 'barber' });
    }

    const { data: clientRecord } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle();

    if (clientRecord) {
        return NextResponse.json({ success: true, role: 'client' });
    }

    const { error } = await supabaseAdmin
        .from('user_roles')
        .upsert({ auth_id: user.id, role: 'admin' }, { onConflict: 'auth_id' });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, role: 'admin' });
}
