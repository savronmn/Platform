import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidAccessToken, getChangedEvents, getInitialSyncToken, getCalendarEvent, watchCalendar, type CalendarToken } from '@/lib/google-calendar';
import { processCalendarEventChanges } from '@/lib/process-calendar-declines';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function appUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL
        ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://savronmn.com');
}

async function renewBarberSync(
    supabase: ReturnType<typeof getAdmin>,
    barber: {
        id: string;
        google_calendar_id: string;
        google_calendar_tokens: CalendarToken;
    },
) {
    const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
    const channelId = crypto.randomUUID();
    const [syncToken, watchRes] = await Promise.all([
        getInitialSyncToken(accessToken, barber.google_calendar_id),
        watchCalendar(accessToken, barber.google_calendar_id, channelId, `${appUrl()}/api/calendar/webhook`),
    ]);

    await supabase.from('barbers').update({
        google_sync_token: syncToken,
        google_channel_id: channelId,
        google_resource_id: watchRes.resourceId,
    }).eq('id', barber.id);

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

    const supabase = getAdmin();

    const { data: barber } = await supabase
        .from('barbers')
        .select('id, name, google_calendar_id, google_calendar_tokens, google_sync_token')
        .eq('google_channel_id', channelId)
        .single();

    if (!barber) {
        console.error(`[calendar/webhook] Unknown channel ID: ${channelId}`);
        return NextResponse.json({ error: 'Barber not found for channel' }, { status: 404 });
    }

    if (!barber.google_sync_token || !barber.google_calendar_tokens || !barber.google_calendar_id) {
        console.error(`[calendar/webhook] Barber ${barber.name} (${barber.id}) has incomplete calendar sync`);
        return NextResponse.json({
            error: 'Missing sync token',
            barberId: barber.id,
            barberName: barber.name,
            syncUnhealthy: true,
        }, { status: 503 });
    }

    try {
        const accessToken = await getValidAccessToken(barber.google_calendar_tokens as CalendarToken);
        let syncToken = barber.google_sync_token;
        let events: Array<{ id?: string; status?: string; attendees?: Array<{ email?: string; responseStatus?: string; organizer?: boolean }> }> = [];
        let nextSyncToken = syncToken;

        try {
            const changed = await getChangedEvents(accessToken, barber.google_calendar_id, syncToken);
            events = changed.events;
            nextSyncToken = changed.nextSyncToken;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            if (!message.includes('Sync token expired')) {
                throw err;
            }

            console.warn(`[calendar/webhook] Sync token expired for ${barber.name}; renewing`);
            syncToken = await renewBarberSync(supabase, {
                id: barber.id,
                google_calendar_id: barber.google_calendar_id,
                google_calendar_tokens: barber.google_calendar_tokens as CalendarToken,
            });
            const changed = await getChangedEvents(accessToken, barber.google_calendar_id, syncToken);
            events = changed.events;
            nextSyncToken = changed.nextSyncToken;
        }

        let cancelledCount = 0;
        const reasons: string[] = [];

        const enrichedEvents = [];
        for (const event of events) {
            if (!event.id) continue;

            let eventData = event;
            if (!event.attendees?.length) {
                try {
                    eventData = await getCalendarEvent(accessToken, barber.google_calendar_id, event.id);
                } catch (fetchErr) {
                    console.error('[calendar/webhook] Failed to load event attendees:', fetchErr);
                }
            }
            enrichedEvents.push(eventData);
        }

        const result = await processCalendarEventChanges(
            supabase,
            barber.id,
            barber.name,
            enrichedEvents,
        );
        cancelledCount = result.cancelled;
        reasons.push(...result.reasons);

        await supabase
            .from('barbers')
            .update({ google_sync_token: nextSyncToken })
            .eq('id', barber.id);

        return NextResponse.json({
            success: true,
            eventsProcessed: events.length,
            bookingsCancelled: cancelledCount,
            reasons,
        });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[calendar/webhook] Processing error:', message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
