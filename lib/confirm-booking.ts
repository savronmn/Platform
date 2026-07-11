// Client-side helper — fires email + calendar sync after a booking is inserted.
// Called from BookingFlow and AsapBookingFlow after supabase.insert() succeeds.

export async function triggerPostBooking(bookingId: string): Promise<void> {
    await Promise.allSettled([
        fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId }),
        }),
        fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId, action: 'create' }),
        }),
    ]);
    // allSettled — failures are silent so booking is never blocked
}

/** Fire email + calendar sync after a booking is edited. */
export async function triggerPostEditBooking(
    bookingId: string,
    options: {
        previousBarberId?: string | null;
        previousDate?: string;
        previousTime?: string;
    } = {},
): Promise<void> {
    await Promise.allSettled([
        fetch('/api/email/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId }),
        }),
        fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bookingId,
                action: 'update',
                previousBarberId: options.previousBarberId ?? undefined,
                previousDate: options.previousDate,
                previousTime: options.previousTime,
            }),
        }),
    ]);
}

/** Cancel a booking via the shared API (email + calendar delete). */
export async function triggerCancelBooking(
    bookingId: string,
    options: { hardDelete?: boolean } = {},
): Promise<{ success: boolean; error?: string; warning?: string }> {
    try {
        const res = await fetch('/api/bookings/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId, hardDelete: options.hardDelete }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error ?? 'Cancellation failed' };
        return { success: true, warning: data.warning };
    } catch {
        return { success: false, error: 'Network error' };
    }
}
