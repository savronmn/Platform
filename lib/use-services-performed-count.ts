'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import {
    chicagoTodayYmd,
    countPerformedServices,
    formatServicesPerformedCount,
    servicesPerformedTotal,
    SERVICES_PERFORMED_BASE,
    SHOP_OPEN_DATE,
    type ServicesPerformedBooking,
} from '@/lib/services-performed';

const BOOKING_SELECT = 'date, time, duration, status';

/** Live homepage stat: 7,000 baseline + past non-cancelled bookings since shop opened. */
export function useServicesPerformedCount(): {
    total: number;
    display: string;
    loading: boolean;
} {
    const [total, setTotal] = useState(SERVICES_PERFORMED_BASE);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        const supabase = createClient();
        const today = chicagoTodayYmd();
        const { data, error } = await supabase
            .from('bookings')
            .select(BOOKING_SELECT)
            .gte('date', SHOP_OPEN_DATE)
            .lte('date', today)
            .in('status', ['confirmed', 'completed']);

        if (!error && data) {
            setTotal(servicesPerformedTotal(countPerformedServices(data as ServicesPerformedBooking[])));
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

        const tick = setInterval(() => { load(); }, 60_000);

        return () => {
            clearInterval(tick);
            supabase.removeChannel(channel);
        };
    }, [load]);

    return {
        total,
        display: formatServicesPerformedCount(total),
        loading,
    };
}
