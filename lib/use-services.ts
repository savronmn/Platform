import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { SERVICES, type ServiceItem } from '@/lib/services-data';

export type { ServiceItem };

/** Always returns all catalog services, enriched with live DB pricing when available. */
export function useServices(): ServiceItem[] {
    const [services, setServices] = useState<ServiceItem[]>([...SERVICES]);

    useEffect(() => {
        createClient()
            .from('services')
            .select('*')
            .eq('active', true)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('created_at')
            .then(({ data }) => {
                if (!data || data.length === 0) return;

                const byName = new Map(data.map((s) => [s.name.toLowerCase(), s]));
                setServices(
                    SERVICES.map((catalog, i) => {
                        const live = byName.get(catalog.name.toLowerCase());
                        if (!live) return { ...catalog, id: i + 1 };
                        return {
                            id: i + 1,
                            name: live.name,
                            duration: `${live.duration_minutes} min`,
                            durationMin: live.duration_minutes,
                            price: `$${Math.round(live.price_cents / 100)}`,
                            priceCents: live.price_cents,
                            color: live.color ?? catalog.color,
                            description: live.description ?? catalog.description,
                        };
                    }),
                );
            });
    }, []);

    return services;
}
