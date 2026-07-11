import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'epass_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function sessionSecret(): string {
    if (process.env.EPASS_SESSION_SECRET) {
        return process.env.EPASS_SESSION_SECRET;
    }
    if (process.env.NODE_ENV === 'production') {
        throw new Error('EPASS_SESSION_SECRET must be configured');
    }
    return process.env.CRON_SECRET || 'savron-epass-dev-secret';
}

function sign(payload: string): string {
    return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

export function createEpassSessionToken(email: string): string {
    const normalized = email.trim().toLowerCase();
    const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
    const body = `${normalized}|${exp}`;
    return `${body}|${sign(body)}`;
}

export function verifyEpassSessionToken(token: string | undefined, email: string): boolean {
    if (!token) return false;
    const parts = token.split('|');
    if (parts.length !== 3) return false;
    const [tokenEmail, expStr, sig] = parts;
    const expectedEmail = email.trim().toLowerCase();
    if (tokenEmail !== expectedEmail) return false;

    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;

    const body = `${tokenEmail}|${expStr}`;
    const expectedSig = sign(body);
    try {
        const a = Buffer.from(sig);
        const b = Buffer.from(expectedSig);
        if (a.length !== b.length) return false;
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

export function setEpassSessionCookie(email: string): void {
    const cookieStore = cookies();
    cookieStore.set(COOKIE_NAME, createEpassSessionToken(email), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: MAX_AGE_SEC,
    });
}

export function clearEpassSessionCookie(): void {
    const cookieStore = cookies();
    cookieStore.set(COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
    });
}

export function readEpassSessionCookie(): string | undefined {
    return cookies().get(COOKIE_NAME)?.value;
}

export { COOKIE_NAME as EPASS_SESSION_COOKIE };
