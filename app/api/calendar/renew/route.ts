// GET|POST /api/calendar/renew
// Re-registers Google Calendar webhook watches for all connected barbers.
// Google watches expire after 30 days — called by Vercel cron weekly.
// Auth: CRON_SECRET via Authorization Bearer header (Vercel) or x-cron-secret header.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    getValidAccessToken,
    watchCalendar,
    getInitialSyncToken,
    type CalendarToken,
} from '@/lib/google-calendar';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function verifyCronSecret(req: NextRequest): boolean {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const headerSecret = req.headers.get('x-cron-secret');
    const secret = bearer ?? headerSecret;
    return !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
}

async function handleRenew() {
    const supabase = getAdmin();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://savronmn.com');

    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name, google_calendar_id, google_calendar_tokens')
        .not('google_calendar_tokens', 'is', null)
        .not('google_calendar_id', 'is', null);

    if (!barbers?.length) {
        return NextResponse.json({ renewed: 0, message: 'No connected barbers' });
    }

    const results: { id: string; name: string; status: string }[] = [];

    for (const barber of barbers) {
        try {
            const tokens = barber.google_calendar_tokens as CalendarToken;
            const accessToken = await getValidAccessToken(tokens);

            const channelId = crypto.randomUUID();
            const [syncToken, watchRes] = await Promise.all([
                getInitialSyncToken(accessToken, barber.google_calendar_id),
                watchCalendar(accessToken, barber.google_calendar_id, channelId, `${appUrl}/api/calendar/webhook`),
            ]);

            await supabase.from('barbers').update({
                google_channel_id: channelId,
                google_resource_id: watchRes.resourceId,
                google_sync_token: syncToken,
            }).eq('id', barber.id);

            results.push({ id: barber.id, name: barber.name, status: 'renewed' });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            results.push({ id: barber.id, name: barber.name, status: `error: ${message}` });
        }
    }

    return NextResponse.json({ renewed: results.filter(r => r.status === 'renewed').length, results });
}

export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handleRenew();
}

export async function POST(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handleRenew();
}
