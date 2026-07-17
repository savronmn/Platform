import { createServerSupabase } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface StaffUser {
    id: string;
    email?: string;
    isAdmin: boolean;
    isBarber: boolean;
}

/** Require an authenticated admin or barber for staff-only API routes. */
export async function requireStaff(): Promise<
    { ok: true; user: StaffUser } | { ok: false; status: 401 | 403; error: string }
> {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { ok: false, status: 401, error: 'Unauthorized' };
    }

    const supabaseAdmin = getAdmin();
    const [{ data: barberRecord }, { data: adminRole }] = await Promise.all([
        supabaseAdmin.from('barbers').select('id').eq('auth_id', user.id).maybeSingle(),
        supabaseAdmin.from('user_roles').select('role').eq('auth_id', user.id).eq('role', 'admin').maybeSingle(),
    ]);

    const isBarber = !!barberRecord;
    const isAdmin = !!adminRole;

    if (!isBarber && !isAdmin) {
        return { ok: false, status: 403, error: 'Staff access required' };
    }

    return {
        ok: true,
        user: { id: user.id, email: user.email, isAdmin, isBarber },
    };
}

/** Any authenticated admin-panel session (middleware already guards /admin routes). */
export async function requireAdminPanelSession(): Promise<
    { ok: true; user: { id: string; email?: string } } | { ok: false; status: 401; error: string }
> {
    const supabase = createServerSupabase();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
        return { ok: false, status: 401, error: 'Unauthorized' };
    }

    return { ok: true, user: { id: user.id, email: user.email } };
}
