// Client-side helper — fires email + calendar sync after a booking is inserted.
// Called from BookingFlow and AsapBookingFlow after supabase.insert() succeeds.

async function logSideEffectFailure(label: string, res: Response | undefined): Promise<void> {
    if (!res) {
        console.error(`[post-booking] ${label} failed: no response`);
        return;
    }
    if (!res.ok) {
        const detail = await res.text().catch(() => res.statusText);
        console.error(`[post-booking] ${label} failed (${res.status}):`, detail);
    }
}

export async function triggerPostBooking(bookingId: string): Promise<void> {
    // Server sends Resend email inside calendar sync — one reliable server-side path.
    const calendarRes = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action: 'create' }),
    }).catch((err) => {
        console.error('[post-booking] calendar sync network error:', err);
        return undefined;
    });
    await logSideEffectFailure('calendar sync', calendarRes);
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
    const calendarRes = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            bookingId,
            action: 'update',
            previousBarberId: options.previousBarberId ?? undefined,
            previousDate: options.previousDate,
            previousTime: options.previousTime,
        }),
    }).catch((err) => {
        console.error('[post-edit] calendar sync network error:', err);
        return undefined;
    });
    await logSideEffectFailure('calendar update', calendarRes);
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
