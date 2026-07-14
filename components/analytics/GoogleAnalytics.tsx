'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { analyticsAllowed } from '@/lib/cookie-consent';
import { COOKIE_CONSENT_CHANGED_EVENT } from '@/lib/cookie-consent-events';
import { pageview, setAnalyticsConsent, syncAnalyticsConsentFromStorage } from '@/lib/gtag';

export default function GoogleAnalytics() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [gtagReady, setGtagReady] = useState(false);
    const [consentGranted, setConsentGranted] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const waitForGtag = () => {
            if (typeof window.gtag !== 'function') return false;

            if (!cancelled) {
                const granted = analyticsAllowed();
                setGtagReady(true);
                setConsentGranted(granted);
                syncAnalyticsConsentFromStorage();
            }

            return true;
        };

        if (waitForGtag()) return;

        const interval = window.setInterval(() => {
            if (waitForGtag()) window.clearInterval(interval);
        }, 50);

        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, []);

    useEffect(() => {
        if (!gtagReady) return;

        const onConsentChange = () => {
            const nextGranted = analyticsAllowed();
            setConsentGranted(nextGranted);
            setAnalyticsConsent(nextGranted);

            if (nextGranted) {
                const query = searchParams.toString();
                const url = query ? `${pathname}?${query}` : pathname;
                pageview(url);
            }
        };

        window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, onConsentChange);
        return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, onConsentChange);
    }, [gtagReady, pathname, searchParams]);

    useEffect(() => {
        if (!gtagReady || !consentGranted) return;

        const query = searchParams.toString();
        const url = query ? `${pathname}?${query}` : pathname;
        pageview(url);
    }, [gtagReady, consentGranted, pathname, searchParams]);

    return null;
}
