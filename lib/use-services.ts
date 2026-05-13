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
            .order('id')
            .then(({ data }) => {
                if (data && data.length > 0) {
                    setServices(data.map(s => ({
                        id: s.id,
                        name: s.name,
                        duration: `${s.duration_min} min`,
                        durationMin: s.duration_min,
                        price: `$${Math.round(s.price_cents / 100)}`,
                        priceCents: s.price_cents,
                        color: s.color,
                        description: s.description ?? undefined,
                    })));
                }
            });
    }, []);

    return services;
}
