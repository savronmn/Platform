// POST /api/calendar/sync
// Called after a booking is confirmed to push the event to Google Calendar.
// Also called on booking cancellation (action: "delete") or edit (action: "update").
// Body: { bookingId: string, action: "create" | "delete" | "update", previousBarberId?: string, previousDate?: string, previousTime?: string }
//
// Invite model:
// - Shop calendar connected → booking-page invite from savronmn@gmail.com (client + barber attendees)
// - Fallback → silent busy block on barber OAuth calendar (google_event_id)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isShopCalendarConnected } from '@/lib/shop-calendar';
import {
    bookingCalendarFullySynced,
    buildCalendarSyncResponse,
    loadBookingForSync,
    removeBookingFromCalendars,
    syncBookingCalendars,
    upsertClientCrm,
} from '@/lib/sync-booking-calendars';
import { requireStaff } from '@/lib/staff-auth';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
    const { bookingId, action, previousBarberId, previousDate, previousTime } = await request.json() as {
        bookingId: string;
        action: 'create' | 'delete' | 'update';
        previousBarberId?: string;
        previousDate?: string;
        previousTime?: string;
    };

    if (!bookingId || !action) {
        return NextResponse.json({ error: 'Missing bookingId or action' }, { status: 400 });
    }

    if (action === 'update' || action === 'delete') {
        const staff = await requireStaff();
        if (!staff.ok) {
            return NextResponse.json({ error: staff.error }, { status: staff.status });
        }
    }

    const loaded = await loadBookingForSync(bookingId);
    if (!loaded) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const { booking } = loaded;
    const barber = booking.barbers;
    const shopConnected = await isShopCalendarConnected();

    if (action === 'create') {
        const staff = await requireStaff();
        if (!staff.ok) {
            const createdAt = booking.created_at ? new Date(booking.created_at).getTime() : 0;
            const ageMs = Date.now() - createdAt;
            if (!Number.isFinite(createdAt) || ageMs < 0 || ageMs > 10 * 60_000) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }
    }

    if (action === 'delete') {
        await removeBookingFromCalendars(booking, { barberId: booking.barber_id ?? undefined });
        await getAdmin().from('bookings').update({
            google_event_id: null,
            shop_google_event_id: null,
        }).eq('id', bookingId);
        return NextResponse.json({ success: true });
    }

    if (action === 'update') {
        const barberChanged = previousBarberId && previousBarberId !== booking.barber_id;

        if (barberChanged) {
            await removeBookingFromCalendars(booking, {
                barberId: previousBarberId,
                fallbackDate: previousDate,
                fallbackTime: previousTime,
            });
            await getAdmin().from('bookings').update({
                google_event_id: null,
                shop_google_event_id: null,
            }).eq('id', bookingId);
            booking.google_event_id = null;
            booking.shop_google_event_id = null;
        }

        const syncResult = await syncBookingCalendars(booking, barber, {
            shopConnected,
            forceBarber: true,
        });

        return NextResponse.json(buildCalendarSyncResponse(syncResult, { updated: true }));
    }

    // action === 'create'
    if (bookingCalendarFullySynced(booking, barber, shopConnected)) {
        return NextResponse.json({
            success: true,
            skipped: true,
            reason: 'already_synced',
            shopEventId: booking.shop_google_event_id,
            barberEventId: booking.google_event_id,
            fullySynced: true,
        });
    }

    const syncResult = await syncBookingCalendars(booking, barber, {
        shopConnected,
        forceBarber: true,
    });

    if (syncResult.shopEventId || syncResult.barberEventId) {
        await upsertClientCrm(booking);
    }

    return NextResponse.json(buildCalendarSyncResponse(syncResult, {
        created: !!(syncResult.shopEventId || syncResult.barberEventId),
    }));
}
