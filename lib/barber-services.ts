import { createClient } from '@supabase/supabase-js';

export type BarberServiceRow = {
    barber_id: string;
    service_id: string;
    price_cents: number;
    duration_minutes: number;
    services?: {
        id: string;
        name: string;
        color: string | null;
        description: string | null;
        active: boolean;
    };
};

export type BarberServiceOffering = {
    serviceId: string;
    name: string;
    priceCents: number;
    durationMinutes: number;
    price: string;
    duration: string;
    color?: string | null;
    description?: string | null;
};

function formatPrice(cents: number): string {
    return `$${Math.round(cents / 100)}`;
}

function formatDuration(mins: number): string {
    return `${mins} min`;
}

export function mapBarberServiceRows(rows: BarberServiceRow[]): BarberServiceOffering[] {
    return rows
        .map((row) => {
            const service = Array.isArray(row.services) ? row.services[0] : row.services;
            return { row, service };
        })
        .filter(({ service }) => service?.active !== false)
        .map(({ row, service }) => ({
            serviceId: row.service_id,
            name: service!.name,
            priceCents: row.price_cents,
            durationMinutes: row.duration_minutes,
            price: formatPrice(row.price_cents),
            duration: formatDuration(row.duration_minutes),
            color: service?.color,
            description: service?.description ?? undefined,
        }));
}

const admin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** Server-side fetch of a barber's service menu with per-barber pricing. */
export async function getBarberServices(barberId: string): Promise<BarberServiceOffering[]> {
    const { data, error } = await admin()
        .from('barber_service')
        .select(`
            barber_id,
            service_id,
            price_cents,
            duration_minutes,
            services ( id, name, color, description, active )
        `)
        .eq('barber_id', barberId);

    if (error) throw error;
    if (!data?.length) return [];

    return mapBarberServiceRows(data as unknown as BarberServiceRow[]);
}

export type BarberServiceInput = {
    serviceId: string;
    priceCents: number;
    durationMinutes: number;
};

/** Admin: replace a barber's offered services and sync services_offered names. */
export async function saveBarberServices(
    barberId: string,
    offerings: BarberServiceInput[],
): Promise<{ serviceNames: string[] }> {
    const supabase = admin();

    const { data: serviceRows } = await supabase
        .from('services')
        .select('id, name')
        .in('id', offerings.map((o) => o.serviceId));

    const nameById = new Map((serviceRows ?? []).map((s) => [s.id, s.name]));
    const serviceNames = offerings
        .map((o) => nameById.get(o.serviceId))
        .filter((name): name is string => Boolean(name));

    await supabase.from('barber_service').delete().eq('barber_id', barberId);

    if (offerings.length > 0) {
        const { error: insertErr } = await supabase.from('barber_service').insert(
            offerings.map((o) => ({
                barber_id: barberId,
                service_id: o.serviceId,
                price_cents: o.priceCents,
                duration_minutes: o.durationMinutes,
                updated_at: new Date().toISOString(),
            })),
        );
        if (insertErr) throw insertErr;
    }

    await supabase
        .from('barbers')
        .update({ services_offered: serviceNames.length > 0 ? serviceNames : null })
        .eq('id', barberId);

    return { serviceNames };
}

/** Apply a barber's approved price/duration change for one service. */
export async function applyBarberServicePricing(
    barberId: string,
    serviceId: string,
    updates: { price_cents?: number; duration_minutes?: number },
): Promise<void> {
    const supabase = admin();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.price_cents !== undefined) payload.price_cents = updates.price_cents;
    if (updates.duration_minutes !== undefined) payload.duration_minutes = updates.duration_minutes;

    const { data: existing } = await supabase
        .from('barber_service')
        .select('barber_id')
        .eq('barber_id', barberId)
        .eq('service_id', serviceId)
        .maybeSingle();

    if (existing) {
        const { error } = await supabase
            .from('barber_service')
            .update(payload)
            .eq('barber_id', barberId)
            .eq('service_id', serviceId);
        if (error) throw error;
        return;
    }

    const { data: service } = await supabase
        .from('services')
        .select('price_cents, duration_minutes, name')
        .eq('id', serviceId)
        .single();

    if (!service) throw new Error('Service not found');

    const { error } = await supabase.from('barber_service').insert({
        barber_id: barberId,
        service_id: serviceId,
        price_cents: updates.price_cents ?? service.price_cents,
        duration_minutes: updates.duration_minutes ?? service.duration_minutes,
        updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    const { data: barber } = await supabase
        .from('barbers')
        .select('services_offered')
        .eq('id', barberId)
        .single();

    const current = barber?.services_offered ?? [];
    if (!current.includes(service.name)) {
        await supabase
            .from('barbers')
            .update({ services_offered: [...current, service.name] })
            .eq('id', barberId);
    }
}
