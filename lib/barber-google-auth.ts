import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
);

function getServerSupabaseForCookies() {
    const cookieStore = cookies();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key =
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    return createServerClient(url, key, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    cookieStore.set(name, value, options);
                });
            },
        },
    });
}

/** Create a Supabase browser session for a barber after Google verified their email. */
export async function establishBarberSession(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const admin = getAdmin();
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email,
    });

    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
        return { ok: false, error: linkError?.message ?? 'Could not create login session' };
    }

    const supabase = getServerSupabaseForCookies();
    const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'email',
    });

    if (verifyError) {
        return { ok: false, error: verifyError.message };
    }

    return { ok: true };
}

export function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false;
    return a.toLowerCase().trim() === b.toLowerCase().trim();
}
