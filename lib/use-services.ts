import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { SERVICES } from '@/lib/services-data';

export type ServiceItem = {
    id: number;
    name: string;
    duration: string;
    durationMin: number;
    price: string;
    priceCents: number;
    color: string;
    description?: string;
};

export function useServices(): ServiceItem[] {
    const [services, setServices] = useState<ServiceItem[]>([...SERVICES]);

    useEffect(() => {
        createClient()
            .from('services')
            .select('*')
            .eq('active', true)
            .order('created_at')
            .then(({ data }) => {
                if (data && data.length > 0) {
                    setServices(data.map((s, i) => ({
                        id: i + 1,
                        name: s.name,
                        duration: `${s.duration_minutes} min`,
                        durationMin: s.duration_minutes,
                        price: `$${Math.round(s.price_cents / 100)}`,
                        priceCents: s.price_cents,
                        color: s.color ?? 'emerald',
                        description: s.description ?? undefined,
                    })));
                }
            });
    }, []);

    return services;
}
