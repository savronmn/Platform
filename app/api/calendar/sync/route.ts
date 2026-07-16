// POST /api/calendar/sync
// Called after a booking is confirmed to push the event to Google Calendar.
// Also called on booking cancellation (action: "delete") or edit (action: "update").
// Body: { bookingId: string, action: "create" | "delete" | "update", previousBarberId?: string, previousDate?: string, previousTime?: string }
//
// Invite model:
// - Shop calendar connected → client invite from savronmn@gmail.com (shop_google_event_id)
// - Barber calendar connected → silent busy block on the barber's calendar (google_event_id)
// Both can run together so barbers like Albe stay blocked on their personal Google Calendar.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { type CalendarToken } from '@/lib/google-calendar';
import { deleteAllBookingCalendarEvents } from '@/lib/booking-calendar-cleanup';
import { buildBookingCalendarPayload } from '@/lib/booking-calendar-payload';
import { isShopCalendarConnected, upsertShopInviteEvent } from '@/lib/shop-calendar';
import { barberCalendarReady, upsertBarberCalendarBlock } from '@/lib/barber-calendar-sync';
import { requireStaff } from '@/lib/staff-auth';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type BarberCalendarInfo = {
    name: string;
    email: string | null;
    google_calendar_id: string | null;
    google_calendar_tokens: CalendarToken | null;
};

type BookingForSync = {
    id: string;
    google_event_id: string | null;
    shop_google_event_id?: string | null;
    barber_id: string | null;
    client_email: string | null;
    client_name: string | null;
    client_phone: string | null;
    service: string;
    date: string;
    time: string;
    price: string | null;
    duration?: string | null;
    created_at?: string;
};

async function removeBookingFromCalendars(
    booking: BookingForSync,
    options: { barberId?: string; fallbackDate?: string; fallbackTime?: string } = {},
) {
    await deleteAllBookingCalendarEvents(booking, options);
}

async function syncShopInvite(
    booking: BookingForSync,
    barberName: string | null,
    barberEmail: string | null,
): Promise<string | null> {
    const payload = buildBookingCalendarPayload(booking, barberName);

    const shopEventId = await upsertShopInviteEvent({
        bookingId: booking.id,
        shopEventId: booking.shop_google_event_id,
        summary: payload.clientSummary,
        description: payload.clientDescription,
        location: payload.location,
        startIso: payload.startIso,
        endIso: payload.endIso,
        clientEmail: booking.client_email,
        barberEmail,
    });

    if (shopEventId) {
        await getAdmin()
            .from('bookings')
            .update({ shop_google_event_id: shopEventId })
            .eq('id', booking.id);
        booking.shop_google_event_id = shopEventId;
    }

    return shopEventId;
}

async function syncBarberBlock(
    booking: BookingForSync,
    barber: BarberCalendarInfo,
): Promise<{ barberEventId: string | null; error?: string }> {
    if (!barberCalendarReady(barber)) {
        return { barberEventId: null };
    }

    try {
        const barberEventId = await upsertBarberCalendarBlock(
            booking,
            barber,
            { existingEventId: booking.google_event_id },
        );
        booking.google_event_id = barberEventId;
        return { barberEventId };
    } catch (error) {
        console.error('[calendar/sync] barber calendar block failed:', error);
        return { barberEventId: null, error: String(error) };
    }
}

async function upsertClientCrm(booking: {
    client_name: string | null;
    client_email: string | null;
    client_phone: string | null;
    date: string;
    price: string | null;
}) {
    if (!booking.client_name) return;

    const supabaseAdmin = getAdmin();
    let query = supabaseAdmin.from('clients').select('id, total_visits, total_spent').eq('name', booking.client_name);
    if (booking.client_email) query = query.or(`email.eq.${booking.client_email}`);

    const { data: existingClients } = await query;
    const existing = existingClients?.[0];
    const priceNum = parseFloat(String(booking.price || '0').replace(/[^0-9.]/g, '')) || 0;

    if (existing) {
        await supabaseAdmin.from('clients').update({
            last_booking_date: booking.date,
            total_visits: (existing.total_visits || 0) + 1,
            total_spent: (existing.total_spent || 0) + priceNum,
            phone: booking.client_phone || undefined,
            email: booking.client_email || undefined,
        }).eq('id', existing.id);
    } else {
        await supabaseAdmin.from('clients').insert({
            name: booking.client_name,
            email: booking.client_email || null,
            phone: booking.client_phone || null,
            last_booking_date: booking.date,
            total_visits: 1,
            total_spent: priceNum,
        });
    }
}

async function syncBookingCalendars(
    booking: BookingForSync,
    barber: BarberCalendarInfo | null,
    options: { shopConnected: boolean; forceBarber?: boolean } ,
): Promise<{
    shopEventId: string | null;
    barberEventId: string | null;
    shopError?: string;
    barberError?: string;
}> {
    let shopEventId = booking.shop_google_event_id ?? null;
    let barberEventId = booking.google_event_id ?? null;
    let shopError: string | undefined;
    let barberError: string | undefined;

    if (options.shopConnected) {
        try {
            shopEventId = await syncShopInvite(
                booking,
                barber?.name ?? null,
                barber?.email ?? null,
            );
        } catch (error) {
            shopError = String(error);
            console.error('[calendar/sync] shop calendar failed:', error);
        }
    }

    if (barber && (options.forceBarber || barberCalendarReady(barber))) {
        const barberResult = await syncBarberBlock(booking, barber);
        barberEventId = barberResult.barberEventId ?? barberEventId;
        barberError = barberResult.error;
    }

    return { shopEventId, barberEventId, shopError, barberError };
}

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

    const supabaseAdmin = getAdmin();

    const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('*, barbers(name, email, google_calendar_id, google_calendar_tokens)')
        .eq('id', bookingId)
        .single();

    if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

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

    const barber = booking.barbers as BarberCalendarInfo | null;
    const shopConnected = await isShopCalendarConnected();

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
            await supabaseAdmin.from('bookings').update({
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

        const success = !!(syncResult.shopEventId || syncResult.barberEventId);
        return NextResponse.json({
            success,
            shopEventId: syncResult.shopEventId,
            barberEventId: syncResult.barberEventId,
            inviteModel: syncResult.shopEventId ? 'shop_calendar' : syncResult.barberEventId ? 'barber_calendar' : undefined,
            warning: syncResult.shopError ?? syncResult.barberError,
            skipped: !success ? true : undefined,
            reason: !success ? 'no_calendar_connected' : undefined,
            updated: true,
        });
    }

    // action === 'create'
    if (shopConnected && booking.shop_google_event_id && booking.google_event_id) {
        return NextResponse.json({
            success: true,
            skipped: true,
            reason: 'already_synced',
            shopEventId: booking.shop_google_event_id,
            barberEventId: booking.google_event_id,
            inviteModel: 'shop_calendar',
        });
    }

    const syncResult = await syncBookingCalendars(booking, barber, {
        shopConnected,
        forceBarber: true,
    });

    if (syncResult.shopEventId || syncResult.barberEventId) {
        await upsertClientCrm(booking);
    }

    const success = !!(syncResult.shopEventId || syncResult.barberEventId);

    return NextResponse.json({
        success,
        shopEventId: syncResult.shopEventId,
        barberEventId: syncResult.barberEventId,
        inviteModel: syncResult.shopEventId ? 'shop_calendar' : syncResult.barberEventId ? 'barber_calendar' : undefined,
        created: success,
        warning: syncResult.shopError ?? syncResult.barberError,
        skipped: !success ? true : undefined,
        reason: !success ? 'no_calendar_connected' : undefined,
    });
}
