"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

/** Legacy /barber dashboard — redirects to per-barber calendar portal. */
export default function BarberDashboardRedirect() {
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        async function redirect() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/barber/login');
                return;
            }

            const { data: barber } = await supabase
                .from('barbers')
                .select('slug')
                .eq('auth_id', user.id)
                .maybeSingle();

            if (barber?.slug) {
                router.replace(`/barber/${barber.slug}/calendar`);
            }
        }
        redirect();
    }, [router]);

    return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
    );
}
