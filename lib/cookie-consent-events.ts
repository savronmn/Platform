export const COOKIE_CONSENT_CHANGED_EVENT = 'savron:cookie-consent-changed';

export function dispatchCookieConsentChanged() {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT));
}
