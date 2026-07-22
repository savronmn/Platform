'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import {
    formatServicesPerformedCount,
    servicesPerformedTotal,
    SERVICES_PERFORMED_BASE,
    SHOP_OPEN_DATE,
} from '@/lib/services-performed';

/** Live homepage stat: 7,000 baseline + completed bookings since shop opened, updates via Supabase realtime. */
export function useServicesPerformedCount(): {
    total: number;
    display: string;
    loading: boolean;
} {
    const [total, setTotal] = useState(SERVICES_PERFORMED_BASE);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        const supabase = createClient();
        const { count, error } = await supabase
            .from('bookings')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed')
            .gte('date', SHOP_OPEN_DATE);

        if (!error && count != null) {
            setTotal(servicesPerformedTotal(count));
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

    return {
        total,
        display: formatServicesPerformedCount(total),
        loading,
    };
}
