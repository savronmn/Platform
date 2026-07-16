export type CreateBookingPayload = {
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

export type CreateBookingResult =
    | { ok: true; id: string }
    | { ok: false; conflict: boolean; message: string };

export async function createBookingRequest(payload: CreateBookingPayload): Promise<CreateBookingResult> {
    const res = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({})) as { id?: string; error?: string };

    if (res.status === 409) {
        return {
            ok: false,
            conflict: true,
            message: data.error ?? 'That appointment was just booked. Please choose another time.',
        };
    }

    if (!res.ok || !data.id) {
        return {
            ok: false,
            conflict: false,
            message: data.error ?? 'We could not create your appointment. Please try again.',
        };
    }

    return { ok: true, id: data.id };
}
