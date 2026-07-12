import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase-server';
import type { Barber } from '@/lib/types';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function getBarberBySlug(slug: string): Promise<Barber | null> {
    const { data } = await getAdmin()
        .from('barbers')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
    return data as Barber | null;
}

/** Server-side: logged-in user must own the barber profile for this slug. */
export async function requireOwnBarberBySlug(slug: string): Promise<
    { ok: true; barber: Barber; userId: string } |
    { ok: false; status: number; error: string }
> {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false, status: 401, error: 'Unauthorized' };
    }

    const barber = await getBarberBySlug(slug);
    if (!barber) {
        return { ok: false, status: 404, error: 'Barber not found' };
    }

    if (barber.auth_id !== user.id) {
        return { ok: false, status: 403, error: 'This account is not linked to this barber profile' };
    }

    return { ok: true, barber, userId: user.id };
}
