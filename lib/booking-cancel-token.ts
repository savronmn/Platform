import { createHmac, timingSafeEqual } from 'crypto';

function cancelSecret(): string {
    if (process.env.BOOKING_CANCEL_SECRET) {
        return process.env.BOOKING_CANCEL_SECRET;
    }
    if (process.env.CRON_SECRET) {
        return process.env.CRON_SECRET;
    }
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return process.env.SUPABASE_SERVICE_ROLE_KEY;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('BOOKING_CANCEL_SECRET, CRON_SECRET, or SUPABASE_SERVICE_ROLE_KEY must be configured');
    }
    return 'savron-booking-cancel-dev-secret';
}

function sign(payload: string): string {
    return createHmac('sha256', cancelSecret()).update(payload).digest('base64url');
}

/** Token remains valid through the appointment end plus a short grace window. */
export function bookingCancelTokenExpiry(
    date: string,
    time: string,
    duration: string | null,
): number {
    const [timePart, meridiem] = (time || '12:00 PM').split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const durationMatch = duration?.match(/\d+/);
    const durationMin = durationMatch ? parseInt(durationMatch[0], 10) : 45;
    const startMs = new Date(
        `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-05:00`,
    ).getTime();
    const endMs = startMs + durationMin * 60_000;
    return Math.floor((endMs + 24 * 60 * 60 * 1000) / 1000);
}

export function createBookingCancelToken(
    bookingId: string,
    expiry: number,
): string {
    const body = `${bookingId}|${expiry}`;
    return `${body}|${sign(body)}`;
}

export function verifyBookingCancelToken(token: string | undefined): { bookingId: string } | null {
    if (!token) return null;
    const parts = token.split('|');
    if (parts.length !== 3) return null;

    const [bookingId, expStr, sig] = parts;
    if (!bookingId) return null;

    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;

    const body = `${bookingId}|${expStr}`;
    const expectedSig = sign(body);
    try {
        const a = Buffer.from(sig);
        const b = Buffer.from(expectedSig);
        if (a.length !== b.length) return null;
        if (!timingSafeEqual(a, b)) return null;
    } catch {
        return null;
    }

    return { bookingId };
}
