"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import {
    barberPortalLoginUrl,
    barberPortalProfileUrl,
    barberPortalRequestsUrl,
    barberPortalShareUrl,
} from '@/lib/barber-portal-urls';

type PortalPage = 'profile' | 'requests' | 'share';

export function useBarberPortalRoute(page: PortalPage) {
    const params = useParams();
    const router = useRouter();
    const supabase = createClient();
    const slugFromPath = typeof params?.slug === 'string' ? params.slug : undefined;

    const loginUrl = slugFromPath ? barberPortalLoginUrl(slugFromPath) : '/barber/login';

    useEffect(() => {
        if (slugFromPath) return;

        async function redirectToSlugRoute() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: barber } = await supabase
                .from('barbers')
                .select('slug')
                .eq('auth_id', user.id)
                .maybeSingle();

            if (!barber?.slug) return;

            const target =
                page === 'profile' ? barberPortalProfileUrl(barber.slug)
                : page === 'requests' ? barberPortalRequestsUrl(barber.slug)
                : barberPortalShareUrl(barber.slug);

            router.replace(target);
        }

        redirectToSlugRoute();
    }, [page, router, slugFromPath, supabase]);

    return { slugFromPath, loginUrl };
}
