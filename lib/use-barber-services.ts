import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { mapBarberServiceRows, type BarberServiceOffering } from '@/lib/barber-services';

/** Client hook: loads a barber's service menu with per-barber price and duration. */
export function useBarberServices(barberId: string | null | undefined): {
    services: BarberServiceOffering[];
    loading: boolean;
    error: string | null;
    refetch: () => void;
} {
    const [services, setServices] = useState<BarberServiceOffering[]>([]);
    const [loading, setLoading] = useState(Boolean(barberId));
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!barberId) {
            setServices([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setError(null);

        createClient()
            .from('barber_service')
            .select(`
                barber_id,
                service_id,
                price_cents,
                duration_minutes,
                services ( id, name, color, description, active, sort_order )
            `)
            .eq('barber_id', barberId)
            .then(({ data, error: fetchErr }) => {
                if (cancelled) return;
                if (fetchErr) {
                    setError(fetchErr.message);
                    setServices([]);
                } else {
                    const rows = (data ?? []) as unknown as Parameters<typeof mapBarberServiceRows>[0];
                    const mapped = mapBarberServiceRows(rows);
                    mapped.sort((a, b) => {
                        const aOrder = (data?.find((r) => r.service_id === a.serviceId) as { services?: { sort_order?: number } })?.services?.sort_order ?? 999;
                        const bOrder = (data?.find((r) => r.service_id === b.serviceId) as { services?: { sort_order?: number } })?.services?.sort_order ?? 999;
                        return aOrder - bOrder;
                    });
                    setServices(mapped);
                }
                setLoading(false);
            });

        return () => { cancelled = true; };
    }, [barberId, tick]);

    return {
        services,
        loading,
        error,
        refetch: () => setTick((t) => t + 1),
    };
}
