"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
    hasCookieConsent,
    readCookieConsent,
    writeCookieConsent,
    type CookieConsentChoice,
} from '@/lib/cookie-consent';

const actionButtonClass = cn(
    'flex-1 sm:flex-none px-4 py-2.5 rounded-savron border text-xs uppercase tracking-widest transition-all',
    'border-white/15 text-white hover:bg-white/5',
);

export default function CookieConsentBanner() {
    const [visible, setVisible] = useState(false);
    const [showPreferences, setShowPreferences] = useState(false);
    const [analyticsEnabled, setAnalyticsEnabled] = useState(false);

    useEffect(() => {
        if (!hasCookieConsent()) setVisible(true);
        else setAnalyticsEnabled(readCookieConsent()?.analytics ?? false);
    }, []);

    const saveChoice = (choice: CookieConsentChoice) => {
        const allowAnalytics =
            choice === 'all' && (showPreferences ? analyticsEnabled : true);
        writeCookieConsent(choice, allowAnalytics);
        setVisible(false);
        setShowPreferences(false);
    };

    if (!visible) return null;

    return (
        <div
            role="dialog"
            aria-labelledby="cookie-consent-title"
            aria-describedby="cookie-consent-description"
            className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-6 pointer-events-none"
        >
            <div className="mx-auto max-w-3xl pointer-events-auto rounded-savron border border-white/10 bg-savron-grey/95 backdrop-blur-md shadow-2xl shadow-black/40">
                <div className="p-5 sm:p-6 space-y-4">
                    <div className="space-y-2">
                        <p id="cookie-consent-title" className="font-heading text-sm uppercase tracking-widest text-white">
                            Cookie & Privacy Notice
                        </p>
                        <p id="cookie-consent-description" className="text-sm leading-relaxed text-savron-silver/80">
                            SAVRON uses essential cookies and similar technologies for secure login, appointment booking,
                            membership passes, and site functionality. We do not sell your personal information.
                            Under Minnesota law, you may access, correct, delete, or opt out of targeted advertising.
                            {' '}
                            <Link href="/privacy" className="text-savron-blue-light hover:text-white underline underline-offset-2">
                                Privacy Policy
                            </Link>
                            .
                        </p>
                    </div>

                    {showPreferences && (
                        <div className="rounded-savron border border-white/10 bg-savron-black/40 p-4 space-y-3">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-white text-sm font-medium">Essential cookies</p>
                                    <p className="text-savron-silver/60 text-xs mt-1">
                                        Required for authentication, bookings, and security. Always active.
                                    </p>
                                </div>
                                <span className="text-[10px] uppercase tracking-widest text-savron-silver/50 shrink-0">
                                    Always on
                                </span>
                            </div>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-white text-sm font-medium">Analytics cookies</p>
                                    <p className="text-savron-silver/60 text-xs mt-1">
                                        Optional usage analytics to improve the site. Not used for targeted advertising.
                                    </p>
                                </div>
                                <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={analyticsEnabled}
                                        onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                                        className="h-4 w-4 rounded border-white/20 bg-white/5 accent-savron-green"
                                    />
                                    <span className="text-[10px] uppercase tracking-widest text-savron-silver/70">
                                        Allow
                                    </span>
                                </label>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                        <button
                            type="button"
                            onClick={() => setShowPreferences(prev => !prev)}
                            className="text-[10px] uppercase tracking-widest text-savron-silver/70 hover:text-white transition-colors text-left"
                        >
                            {showPreferences ? 'Hide preferences' : 'Cookie preferences'}
                        </button>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => saveChoice('essential')}
                                className={actionButtonClass}
                            >
                                Essential only
                            </button>
                            <button
                                type="button"
                                onClick={() => saveChoice('all')}
                                className={actionButtonClass}
                            >
                                Accept
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
