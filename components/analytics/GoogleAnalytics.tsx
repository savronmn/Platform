'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { analyticsAllowed } from '@/lib/cookie-consent';
import { COOKIE_CONSENT_CHANGED_EVENT } from '@/lib/cookie-consent-events';
import {
    GA_MEASUREMENT_ID,
    pageview,
    setAnalyticsConsent,
    syncAnalyticsConsentFromStorage,
} from '@/lib/gtag';

export default function GoogleAnalytics() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [scriptsReady, setScriptsReady] = useState(false);
    const [consentGranted, setConsentGranted] = useState(false);

    useEffect(() => {
        if (!scriptsReady) return;

        const granted = analyticsAllowed();
        setConsentGranted(granted);
        syncAnalyticsConsentFromStorage();

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
    }, [scriptsReady, pathname, searchParams]);

    useEffect(() => {
        if (!scriptsReady || !consentGranted) return;

        const query = searchParams.toString();
        const url = query ? `${pathname}?${query}` : pathname;
        pageview(url);
    }, [scriptsReady, consentGranted, pathname, searchParams]);

    return (
        <>
            <Script id="google-analytics-consent" strategy="beforeInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('consent', 'default', {
                        analytics_storage: 'denied',
                        ad_storage: 'denied',
                        ad_user_data: 'denied',
                        ad_personalization: 'denied',
                        wait_for_update: 500
                    });
                `}
            </Script>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
                strategy="afterInteractive"
                onLoad={() => setScriptsReady(true)}
            />
            <Script
                id="google-analytics-init"
                strategy="afterInteractive"
                onReady={() => setScriptsReady(true)}
            >
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${GA_MEASUREMENT_ID}', {
                        send_page_view: true
                    });
                `}
            </Script>
        </>
    );
}
