import { GA_MEASUREMENT_ID } from '@/lib/ga-measurement-id';

export { GA_MEASUREMENT_ID } from '@/lib/ga-measurement-id';

declare global {
    interface Window {
        dataLayer?: unknown[];
        gtag?: (...args: unknown[]) => void;
    }
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
