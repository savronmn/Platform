// Client-side helper — fires shop calendar sync after a booking is inserted.
// savronmn@gmail.com sends the Google Calendar invite to client + barber when shop is connected.

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
    const calendarRes = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, action: 'create' }),
    }).catch((err) => {
        console.error('[post-booking] calendar sync network error:', err);
        return undefined;
    });
    await logSideEffectFailure('calendar sync', calendarRes);

    let usedShopInvite = false;
    if (calendarRes?.ok) {
        const data = await calendarRes.json().catch(() => ({}));
        usedShopInvite = (data.inviteModel === 'shop_calendar' || data.inviteModel === 'shop_booking_page') && !!data.success;
    }

    if (!usedShopInvite) {
        const emailRes = await fetch('/api/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId }),
        }).catch((err) => {
            console.error('[post-booking] confirmation email network error:', err);
            return undefined;
        });
        await logSideEffectFailure('confirmation email', emailRes);
    }
}

/** Fire calendar sync after a booking is edited. */
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

    let usedShopInvite = false;
    if (calendarRes?.ok) {
        const data = await calendarRes.json().catch(() => ({}));
        usedShopInvite = (data.inviteModel === 'shop_calendar' || data.inviteModel === 'shop_booking_page') && !!data.success;
    }

    if (!usedShopInvite) {
        const emailRes = await fetch('/api/email/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId }),
        }).catch((err) => {
            console.error('[post-edit] update email network error:', err);
            return undefined;
        });
        await logSideEffectFailure('update email', emailRes);
    }
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
