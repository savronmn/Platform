import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidAccessToken, getChangedEvents } from '@/lib/google-calendar';
import { cancelBooking } from '@/lib/cancel-booking';

export async function POST(req: NextRequest) {
    const channelId = req.headers.get('x-goog-channel-id');
    const resourceState = req.headers.get('x-goog-resource-state');

    if (!channelId) {
        return NextResponse.json({ error: 'Missing channel ID' }, { status: 400 });
    }

    // Google sends a 'sync' state initially when the watch is created
    if (resourceState === 'sync') {
        return NextResponse.json({ received: true });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: barber } = await supabase
        .from('barbers')
        .select('*')
        .eq('google_channel_id', channelId)
        .single();

    if (!barber) {
        console.error(`[calendar/webhook] Unknown channel ID: ${channelId} — sync channel may have expired`);
        return NextResponse.json({ error: 'Barber not found for channel' }, { status: 404 });
    }

    if (!barber.google_sync_token) {
        console.error(`[calendar/webhook] Barber ${barber.name} (${barber.id}) has no sync token — calendar deletions will not sync`);
        return NextResponse.json({
            error: 'Missing sync token',
            barberId: barber.id,
            barberName: barber.name,
            syncUnhealthy: true,
        }, { status: 503 });
    }

    try {
        const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
        const { events, nextSyncToken } = await getChangedEvents(
            accessToken,
            barber.google_calendar_id,
            barber.google_sync_token,
        );

        let cancelledCount = 0;
        for (const event of events) {
            if (event.status === 'cancelled') {
                const { data: booking } = await supabase
                    .from('bookings')
                    .select('id, status')
                    .eq('google_event_id', event.id)
                    .maybeSingle();

                if (booking && booking.status !== 'cancelled') {
                    // GCal event already deleted — skip calendar delete, send cancellation email
                    const result = await cancelBooking(booking.id, { skipCalendar: true });
                    if (result.success) cancelledCount++;
                }
            }
        }

        await supabase
            .from('barbers')
            .update({ google_sync_token: nextSyncToken })
            .eq('id', barber.id);

        return NextResponse.json({
            success: true,
            eventsProcessed: events.length,
            bookingsCancelled: cancelledCount,
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[calendar/webhook] Processing error:', message);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
