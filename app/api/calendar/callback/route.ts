// GET /api/calendar/callback
// Handles the Google OAuth redirect after a barber authorizes calendar access.
// `state` param = barber's UUID

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getValidAccessToken, getInitialSyncToken, watchCalendar, fetchGoogleUserEmail } from '@/lib/google-calendar';
import { createClient } from '@supabase/supabase-js';
import { saveShopWebhookState } from '@/lib/shop-calendar';
import { SHOP_GOOGLE_CALENDAR_ID } from '@/lib/shop';
import { establishBarberSession, emailsMatch } from '@/lib/barber-google-auth';

function parseOAuthState(stateVal: string): { barberId: string; redirectPath: string; login: boolean } {
    const parts = stateVal.split('|');
    return {
        barberId: parts[0] ?? '',
        redirectPath: parts[1] || '/barber',
        login: parts[2] === 'login',
    };
}

function loginRedirectFromCalendarPath(path: string): string {
    const match = path.match(/^\/barber\/([^/]+)\/calendar/);
    if (match) return `/barber/${match[1]}/login`;
    return path;
}

function errorRedirect(request: NextRequest, login: boolean, calendarPath: string, code: string) {
    const path = login ? loginRedirectFromCalendarPath(calendarPath) : calendarPath;
    return NextResponse.redirect(new URL(`${path}?cal_error=${code}`, request.url));
}

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const stateVal = searchParams.get('state') || '';
    const { barberId, redirectPath, login } = parseOAuthState(stateVal);
    const error = searchParams.get('error');

    const targetRedirect = redirectPath || '/barber';

    if (error || !code || !barberId) {
        return errorRedirect(request, login, targetRedirect, error ?? 'missing_params');
    }

    try {
        const tokens = await exchangeCodeForTokens(code);

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Savron shop calendar (savronmn@gmail.com) — used for cleanup + optional shop events
        if (barberId === 'shop') {
            const shopCalendarId = process.env.SAVRON_GOOGLE_CALENDAR_ID || SHOP_GOOGLE_CALENDAR_ID;
            await supabase.from('system_config').upsert([
                { key: 'savron_google_calendar_tokens', value: tokens },
                { key: 'savron_google_calendar_id', value: shopCalendarId },
            ]);

            try {
                const accessToken = await getValidAccessToken(tokens);
                const channelId = crypto.randomUUID();
                const appUrl = process.env.NEXT_PUBLIC_APP_URL
                    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://savronmn.com');
                const [syncToken, watchRes] = await Promise.all([
                    getInitialSyncToken(accessToken, shopCalendarId),
                    watchCalendar(accessToken, shopCalendarId, channelId, `${appUrl}/api/calendar/webhook-shop`),
                ]);
                await saveShopWebhookState({
                    channel_id: channelId,
                    resource_id: watchRes.resourceId,
                    sync_token: syncToken,
                });
            } catch (watchErr) {
                console.error('Failed to setup shop Google Calendar watch:', watchErr);
            }

            return NextResponse.redirect(
                new URL(`${targetRedirect}?cal_connected=shop`, request.url)
            );
        }

        const { data: barber } = await supabase
            .from('barbers')
            .select('id, email, auth_id, slug')
            .eq('id', barberId)
            .maybeSingle();

        if (!barber) {
            return errorRedirect(request, login, targetRedirect, 'barber_not_found');
        }

        if (login) {
            const accessToken = await getValidAccessToken(tokens);
            const googleEmail = await fetchGoogleUserEmail(accessToken);
            if (!googleEmail) {
                return errorRedirect(request, login, targetRedirect, 'google_email_unavailable');
            }
            if (!emailsMatch(googleEmail, barber.email)) {
                return errorRedirect(request, login, targetRedirect, 'email_mismatch');
            }
            if (!barber.auth_id) {
                return errorRedirect(request, login, targetRedirect, 'account_not_linked');
            }
        }

        // Initialize webhook watch for real-time calendar un-booking
        let syncToken = null;
        let channelId = null;
        let resourceId = null;

        try {
            const accessToken = await getValidAccessToken(tokens);
            // 1. Get initial sync token (so we only listen for future changes)
            syncToken = await getInitialSyncToken(accessToken, 'primary');
            
            // 2. Subscribe webhook
            channelId = crypto.randomUUID();
            const appUrl = process.env.NEXT_PUBLIC_APP_URL
                ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://savron.com');
            const watchRes = await watchCalendar(accessToken, 'primary', channelId, `${appUrl}/api/calendar/webhook`);
            resourceId = watchRes.resourceId;
        } catch (watchErr) {
            console.error('Failed to setup Google Calendar watch:', watchErr);
            // We proceed anyway so the barber isn't completely blocked if the webhook fails to register
        }

        await supabase
            .from('barbers')
            .update({
                google_calendar_tokens: tokens,
                google_calendar_id: 'primary',
                google_sync_token: syncToken,
                google_channel_id: channelId,
                google_resource_id: resourceId,
            })
            .eq('id', barberId);

        if (login && barber.email) {
            const sessionResult = await establishBarberSession(barber.email);
            if (!sessionResult.ok) {
                console.error('[calendar/callback] Barber session failed:', sessionResult.error);
                return errorRedirect(request, login, targetRedirect, 'login_failed');
            }
        }

        return NextResponse.redirect(
            new URL(`${targetRedirect}?cal_connected=1${login ? '&google_login=1' : ''}`, request.url)
        );
    } catch (err) {
        console.error('Calendar OAuth error:', err);
        return errorRedirect(request, login, targetRedirect, 'token_exchange_failed');
    }
}
