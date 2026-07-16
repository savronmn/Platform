import { createClient } from '@supabase/supabase-js';
import { assertBarberSlotAvailable, SlotUnavailableError } from '@/lib/booking-availability';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type CreateBookingInput = {
    client_name?: string | null;
    client_email?: string | null;
    client_phone?: string | null;
    service: string;
    barber_id: string;
    barber_name: string;
    date: string;
    time: string;
    duration: string;
    price?: string | null;
    status?: 'confirmed' | 'completed';
    notes?: string | null;
};

export async function createBooking(input: CreateBookingInput): Promise<{ id: string }> {
    const status = input.status ?? 'confirmed';

    if (!input.barber_id || !input.date || !input.time || !input.service?.trim()) {
        throw new Error('Missing required booking fields');
    }

    if (status === 'confirmed' || status === 'completed') {
        await assertBarberSlotAvailable(
            input.barber_id,
            input.date,
            input.time,
            input.duration,
        );
    }

    const supabaseAdmin = getAdmin();
    const { data, error } = await supabaseAdmin
        .from('bookings')
        .insert({
            client_name: input.client_name?.trim() || null,
            client_email: input.client_email?.trim() || null,
            client_phone: input.client_phone?.trim() || null,
            service: input.service.trim(),
            barber_id: input.barber_id,
            barber_name: input.barber_name,
            date: input.date,
            time: input.time,
            duration: input.duration,
            price: input.price ?? null,
            status,
            notes: input.notes?.trim() || null,
        })
        .select('id')
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new SlotUnavailableError();
        }
        throw error;
    }

    if (!data?.id) {
        throw new Error('Booking insert returned no id');
    }

    return { id: data.id };
}
