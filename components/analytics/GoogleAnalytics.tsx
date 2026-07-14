'use client';

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { analyticsAllowed } from '@/lib/cookie-consent';
import { COOKIE_CONSENT_CHANGED_EVENT } from '@/lib/cookie-consent-events';
import { GA_MEASUREMENT_ID, pageview } from '@/lib/gtag';

export default function GoogleAnalytics() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        setEnabled(analyticsAllowed());

        const syncConsent = () => setEnabled(analyticsAllowed());
        window.addEventListener(COOKIE_CONSENT_CHANGED_EVENT, syncConsent);
        return () => window.removeEventListener(COOKIE_CONSENT_CHANGED_EVENT, syncConsent);
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const query = searchParams.toString();
        const url = query ? `${pathname}?${query}` : pathname;
        pageview(url);
    }, [enabled, pathname, searchParams]);

    if (!enabled) return null;

    return (
        <>
            <Script
                src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
                strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
                {`
                    window.dataLayer = window.dataLayer || [];
                    function gtag(){dataLayer.push(arguments);}
                    gtag('js', new Date());
                    gtag('config', '${GA_MEASUREMENT_ID}');
                `}
            </Script>
        </>
    );
}
