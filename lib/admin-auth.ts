import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase-server';

/** Verify the caller is an authenticated admin (cookie session or Bearer token). */
export async function assertAdminRequest(authHeader: string | null): Promise<boolean> {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        const { data: role } = await admin
            .from('user_roles')
            .select('role')
            .eq('auth_id', user.id)
            .maybeSingle();
        if (role?.role === 'admin') return true;
    }

    if (!authHeader?.startsWith('Bearer ')) return false;
    const token = authHeader.slice(7);

    const bearerClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: { user: bearerUser } } = await bearerClient.auth.getUser();
    if (!bearerUser) return false;

    const { data: role } = await bearerClient
        .from('user_roles')
        .select('role')
        .eq('auth_id', bearerUser.id)
        .maybeSingle();

    return role?.role === 'admin';
}
