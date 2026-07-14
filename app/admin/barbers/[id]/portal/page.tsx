"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { adminBarberPortalUrl } from '@/lib/barber-portal-urls';

export default function AdminBarberPortalRedirectPage() {
    const params = useParams();
    const router = useRouter();
    const barberId = params.id as string;
    const supabase = createClient();

    useEffect(() => {
        async function redirect() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.replace('/admin/login');
                return;
            }

            const { data: barber } = await supabase
                .from('barbers')
                .select('id, slug')
                .eq('id', barberId)
                .single();

            if (!barber?.slug) {
                router.replace('/admin/barbers');
                return;
            }

            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            router.replace(adminBarberPortalUrl(barber.id, barber.slug, origin));
        }
        void redirect();
    }, [barberId, router, supabase]);

    return (
        <div className="flex items-center justify-center h-[60vh]">
            <div className="w-5 h-5 border-2 border-savron-green/30 border-t-savron-green rounded-full animate-spin" />
        </div>
    );
}
