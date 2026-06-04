// GET /api/calendar/callback
// Handles the Google OAuth redirect after a barber authorizes calendar access.
// `state` param = barber's UUID

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getValidAccessToken, getInitialSyncToken, watchCalendar } from '@/lib/google-calendar';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get('code');
    const stateVal = searchParams.get('state') || '';
    const [barberId, redirectPath] = stateVal.includes('|') ? stateVal.split('|') : [stateVal, '/barber'];
    const error = searchParams.get('error');

    const targetRedirect = redirectPath || '/barber';

    if (error || !code || !barberId) {
        return NextResponse.redirect(
            new URL(`${targetRedirect}?cal_error=${error ?? 'missing_params'}`, request.url)
        );
    }

    try {
        const tokens = await exchangeCodeForTokens(code);

        // Store tokens in barbers table (server-side admin client — bypasses RLS)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

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

        return NextResponse.redirect(
            new URL(`${targetRedirect}?cal_connected=1`, request.url)
        );
    } catch (err) {
        console.error('Calendar OAuth error:', err);
        return NextResponse.redirect(
            new URL(`${targetRedirect}?cal_error=token_exchange_failed`, request.url)
        );
    }
}
