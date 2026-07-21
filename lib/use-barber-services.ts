import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { mapBarberServiceRows, type BarberServiceOffering } from '@/lib/barber-services';

/** Client hook: loads a barber's service menu with live updates when pricing changes. */
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

    const loadServices = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);

        const supabase = createClient();
        const { data, error: fetchErr } = await supabase
            .from('barber_service')
            .select(`
                barber_id,
                service_id,
                price_cents,
                duration_minutes,
                services ( id, name, color, description, active, sort_order )
            `)
            .eq('barber_id', id);

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
    }, []);

    useEffect(() => {
        if (!barberId) {
            setServices([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        loadServices(barberId).then(() => {
            if (cancelled) return;
        });

        const supabase = createClient();
        const channel = supabase
            .channel(`barber-services-${barberId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'barber_service',
                    filter: `barber_id=eq.${barberId}`,
                },
                () => {
                    if (!cancelled) loadServices(barberId);
                },
            )
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [barberId, tick, loadServices]);

    return {
        services,
        loading,
        error,
        refetch: () => setTick((t) => t + 1),
    };
}
