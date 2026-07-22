'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import {
    formatServicesPerformedCount,
    servicesPerformedTotal,
    SERVICES_PERFORMED_BASE,
} from '@/lib/services-performed';

/** Live homepage stat: 7,000 baseline + completed bookings, updates via Supabase realtime. */
export function useServicesPerformedCount(): { display: string; loading: boolean } {
    const [display, setDisplay] = useState(formatServicesPerformedCount(SERVICES_PERFORMED_BASE));
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        const supabase = createClient();
        const { count, error } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed');

        if (!error && count != null) {
            setDisplay(formatServicesPerformedCount(servicesPerformedTotal(count)));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        load();

        const supabase = createClient();
        const channel = supabase
            .channel('homepage-services-performed')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'bookings' },
                () => { load(); },
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [load]);

    return { display, loading };
}
