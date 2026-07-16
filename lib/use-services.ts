import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { SERVICES, type ServiceItem } from '@/lib/services-data';

export type { ServiceItem };

type DbService = {
    name: string;
    duration_minutes: number;
    price_cents: number;
    color: string | null;
    description: string | null;
};

function mapDbServicesToItems(data: DbService[]): ServiceItem[] {
    return data.map((live, i) => ({
        id: i + 1,
        name: live.name,
        duration: `${live.duration_minutes} min`,
        durationMin: live.duration_minutes,
        price: `$${Math.round(live.price_cents / 100)}`,
        priceCents: live.price_cents,
        color: live.color ?? 'blue',
        description: live.description ?? undefined,
    }));
}

/** Active services from the DB (admin menu), falling back to the static catalog when empty. */
export function useServices(): ServiceItem[] {
    const [services, setServices] = useState<ServiceItem[]>([...SERVICES]);

    useEffect(() => {
        createClient()
            .from('services')
            .select('name, duration_minutes, price_cents, color, description')
            .eq('active', true)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('created_at')
            .then(({ data }) => {
                if (!data || data.length === 0) return;
                setServices(mapDbServicesToItems(data));
            });
    }, []);

    return services;
}
