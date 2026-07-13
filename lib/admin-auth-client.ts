import type { SupabaseClient } from '@supabase/supabase-js';

/** Returns true when the signed-in user has the admin role. */
export async function isAdminUser(supabase: SupabaseClient): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: adminRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('auth_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

    return !!adminRole;
}
