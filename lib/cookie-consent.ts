import { dispatchCookieConsentChanged } from '@/lib/cookie-consent-events';

export const COOKIE_CONSENT_STORAGE_KEY = 'savron_cookie_consent';
export const COOKIE_CONSENT_VERSION = 1;

export type CookieConsentChoice = 'essential' | 'all';

export interface CookieConsentRecord {
    version: number;
    choice: CookieConsentChoice;
    analytics: boolean;
    updatedAt: string;
}

export function parseCookieConsent(raw: string | null): CookieConsentRecord | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as CookieConsentRecord;
        if (parsed.version !== COOKIE_CONSENT_VERSION) return null;
        if (parsed.choice !== 'essential' && parsed.choice !== 'all') return null;
        if (typeof parsed.analytics !== 'boolean') return null;
        return parsed;
    } catch {
        return null;
    }
}

export function readCookieConsent(): CookieConsentRecord | null {
    if (typeof window === 'undefined') return null;
    return parseCookieConsent(localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY));
}

export function writeCookieConsent(choice: CookieConsentChoice, analytics: boolean): CookieConsentRecord {
    const record: CookieConsentRecord = {
        version: COOKIE_CONSENT_VERSION,
        choice,
        analytics: choice === 'all' ? analytics : false,
        updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record));
    dispatchCookieConsentChanged();
    return record;
}

export function hasCookieConsent(): boolean {
    return readCookieConsent() !== null;
}

export function analyticsAllowed(): boolean {
    const consent = readCookieConsent();
    return consent?.choice === 'all' && consent.analytics === true;
}
