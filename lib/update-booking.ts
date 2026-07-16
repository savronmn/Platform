import { createClient } from '@supabase/supabase-js';
import { assertBarberSlotAvailable, SlotUnavailableError } from '@/lib/booking-availability';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type UpdateBookingInput = {
    bookingId: string;
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
    notes?: string | null;
};

export async function updateBooking(input: UpdateBookingInput): Promise<{ booking: Record<string, unknown> }> {
    const supabaseAdmin = getAdmin();

    const { data: existing } = await supabaseAdmin
        .from('bookings')
        .select('id, status')
        .eq('id', input.bookingId)
        .single();

    if (!existing) {
        throw new Error('Booking not found');
    }

    if (existing.status === 'confirmed' || existing.status === 'completed') {
        await assertBarberSlotAvailable(
            input.barber_id,
            input.date,
            input.time,
            input.duration,
            { excludeBookingId: input.bookingId },
        );
    }

    const { data, error } = await supabaseAdmin
        .from('bookings')
        .update({
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
            notes: input.notes?.trim() || null,
        })
        .eq('id', input.bookingId)
        .select('*')
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new SlotUnavailableError();
        }
        throw error;
    }

    if (!data) {
        throw new Error('Booking update returned no row');
    }

    return { booking: data };
}
