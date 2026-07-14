import { analyticsAllowed } from '@/lib/cookie-consent';

export const GA_MEASUREMENT_ID =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-HL5DCE0PK8';

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
}

export function setAnalyticsConsent(granted: boolean) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('consent', 'update', {
        analytics_storage: granted ? 'granted' : 'denied',
    });
}

export function syncAnalyticsConsentFromStorage() {
    setAnalyticsConsent(analyticsAllowed());
}

export function pageview(url: string) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('config', GA_MEASUREMENT_ID, {
        page_path: url,
    });
}

export function gtagEvent(
    action: string,
    params?: Record<string, string | number | boolean>,
) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', action, params);
}
