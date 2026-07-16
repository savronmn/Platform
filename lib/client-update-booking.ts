export type UpdateBookingPayload = {
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

export type UpdateBookingResult =
    | { ok: true; booking: Record<string, unknown> }
    | { ok: false; conflict: boolean; message: string };

export async function updateBookingRequest(payload: UpdateBookingPayload): Promise<UpdateBookingResult> {
    const res = await fetch('/api/bookings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({})) as { booking?: Record<string, unknown>; error?: string };

    if (res.status === 409) {
        return {
            ok: false,
            conflict: true,
            message: data.error ?? 'That slot is already booked. Please choose a different time.',
        };
    }

    if (!res.ok || !data.booking) {
        return {
            ok: false,
            conflict: false,
            message: data.error ?? 'Could not save appointment changes.',
        };
    }

    return { ok: true, booking: data.booking };
}
