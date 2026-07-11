import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    getValidAccessToken,
    getChangedEvents,
    getInitialSyncToken,
    getCalendarEvent,
    watchCalendar,
} from '@/lib/google-calendar';
import {
    getShopCalendarId,
    getShopCalendarTokens,
    getShopWebhookState,
    saveShopWebhookState,
} from '@/lib/shop-calendar';
import { processCalendarEventChanges } from '@/lib/process-calendar-declines';
import type { CalendarSyncEvent } from '@/lib/calendar-event-sync';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function appUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://savronmn.com');
}

async function renewShopSync(): Promise<string> {
    const tokens = await getShopCalendarTokens();
    if (!tokens) throw new Error('Shop calendar not connected');

    const accessToken = await getValidAccessToken(tokens);
    const calendarId = await getShopCalendarId();
    const channelId = crypto.randomUUID();
    const [syncToken, watchRes] = await Promise.all([
        getInitialSyncToken(accessToken, calendarId),
        watchCalendar(accessToken, calendarId, channelId, `${appUrl()}/api/calendar/webhook-shop`),
    ]);

    await saveShopWebhookState({
        channel_id: channelId,
        resource_id: watchRes.resourceId,
        sync_token: syncToken,
    });

    return syncToken;
}

export async function POST(req: NextRequest) {
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceState = req.headers.get('x-goog-resource-state');

    if (!channelId) {
        return NextResponse.json({ error: 'Missing channel ID' }, { status: 400 });
    }

    if (resourceState === 'sync') {
        return NextResponse.json({ received: true });
    }

    const webhookState = await getShopWebhookState();
    if (!webhookState || webhookState.channel_id !== channelId) {
        console.error(`[calendar/webhook-shop] Unknown channel ID: ${channelId}`);
        return NextResponse.json({ error: 'Shop channel not found' }, { status: 404 });
    }

    const tokens = await getShopCalendarTokens();
    if (!tokens) {
        return NextResponse.json({ error: 'Shop calendar not connected' }, { status: 503 });
    }

    const supabase = getAdmin();

    try {
        const accessToken = await getValidAccessToken(tokens);
        const calendarId = await getShopCalendarId();
        let syncToken = webhookState.sync_token;
        let events: CalendarSyncEvent[] = [];
        let nextSyncToken = syncToken;

        try {
            const changed = await getChangedEvents(accessToken, calendarId, syncToken);
            events = changed.events as CalendarSyncEvent[];
            nextSyncToken = changed.nextSyncToken;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (!message.includes('Sync token expired')) {
                throw err;
            }

            console.warn('[calendar/webhook-shop] Sync token expired; renewing');
            syncToken = await renewShopSync();
            const changed = await getChangedEvents(accessToken, calendarId, syncToken);
            events = changed.events as CalendarSyncEvent[];
            nextSyncToken = changed.nextSyncToken;
        }

        const enrichedEvents: CalendarSyncEvent[] = [];
        for (const event of events) {
            if (!event.id) continue;
            if (!event.attendees?.length) {
                try {
                    const full = await getCalendarEvent(accessToken, calendarId, event.id);
                    enrichedEvents.push(full as CalendarSyncEvent);
                    continue;
                } catch (fetchErr) {
                    console.error('[calendar/webhook-shop] Failed to load event attendees:', fetchErr);
                }
            }
            enrichedEvents.push(event);
        }

        const result = await processCalendarEventChanges(
            supabase,
            null,
            'Savron Shop',
            enrichedEvents,
        );

        await saveShopWebhookState({
            ...webhookState,
            sync_token: nextSyncToken,
        });

        return NextResponse.json({
            success: true,
            eventsProcessed: enrichedEvents.length,
            bookingsCancelled: result.cancelled,
            reasons: result.reasons,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[calendar/webhook-shop] Processing error:', message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
