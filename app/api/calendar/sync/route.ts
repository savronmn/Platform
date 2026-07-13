// POST /api/calendar/sync
// Called after a booking is confirmed to push the event to Google Calendar.
// Also called on booking cancellation (action: "delete") or edit (action: "update").
// Body: { bookingId: string, action: "create" | "delete" | "update", previousBarberId?: string, previousDate?: string, previousTime?: string }
//
// Invite model (priority):
// 1. Barber calendar connected → appointment on barber's calendar, client invited (Albe-style)
// 2. Shop calendar only → invite from savronmn@gmail.com with client + barber as attendees
// 3. Neither → no Google invite (Resend + ICS fallback if email route is called)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    getValidAccessToken,
    createCalendarEvent,
    updateCalendarEvent,
    type CalendarToken,
} from '@/lib/google-calendar';
import { deleteAllBookingCalendarEvents } from '@/lib/booking-calendar-cleanup';
import { buildBookingCalendarPayload } from '@/lib/booking-calendar-payload';
import { isShopCalendarConnected, upsertShopInviteEvent } from '@/lib/shop-calendar';
import { requireStaff } from '@/lib/staff-auth';
import { SHOP_CALENDAR_DISPLAY_NAME, SHOP_CALENDAR_EMAIL } from '@/lib/shop';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type BarberCalendarInfo = {
    name: string;
    email: string | null;
    google_calendar_id: string | null;
    google_calendar_tokens: CalendarToken | null;
};

async function removeBookingFromCalendars(
    booking: {
        id: string;
        google_event_id: string | null;
        shop_google_event_id?: string | null;
        barber_id: string | null;
        date: string;
        time: string;
        client_name: string | null;
        client_email: string | null;
        service: string;
    },
    options: { barberId?: string; fallbackDate?: string; fallbackTime?: string } = {},
) {
    await deleteAllBookingCalendarEvents(booking, options);
}

async function syncShopInvite(
    booking: {
        id: string;
        shop_google_event_id?: string | null;
        client_email: string | null;
        client_name: string | null;
        client_phone: string | null;
        service: string;
        date: string;
        time: string;
        price: string | null;
        duration?: string | null;
    },
    barberName: string | null,
    barberEmail: string | null,
) {
    const payload = buildBookingCalendarPayload(booking, barberName);
    const shopDescription = [
        payload.staffDescription,
        '',
        `Organizer: ${SHOP_CALENDAR_EMAIL} (${SHOP_CALENDAR_DISPLAY_NAME})`,
    ].join('\n');

    const shopEventId = await upsertShopInviteEvent({
        bookingId: booking.id,
        shopEventId: booking.shop_google_event_id,
        summary: payload.clientSummary,
        description: shopDescription,
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
    }

    return shopEventId;
}

/** Barber-owned Google Calendar appointment — client receives invite from the barber's account. */
async function syncBarberAppointmentInvite(
    booking: {
        id: string;
        google_event_id: string | null;
        client_email: string | null;
        client_name: string | null;
        client_phone: string | null;
        service: string;
        date: string;
        time: string;
        price: string | null;
        duration?: string | null;
    },
    barber: BarberCalendarInfo,
    options: { barberChanged?: boolean } = {},
): Promise<{ eventId: string | null; created?: boolean; updated?: boolean; error?: string }> {
    if (!barber.google_calendar_tokens || !barber.google_calendar_id) {
        return { eventId: null };
    }

    try {
        const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
        const payload = buildBookingCalendarPayload(booking, barber.name);
        const attendeeEmails = booking.client_email ? [booking.client_email] : [];
        const sendUpdates = attendeeEmails.length > 0 ? 'all' as const : 'none' as const;

        const eventFields = {
            summary: payload.clientSummary,
            description: payload.clientDescription,
            location: payload.location,
            startIso: payload.startIso,
            endIso: payload.endIso,
            attendeeEmails,
            bookingId: booking.id,
        };

        if (booking.google_event_id && !options.barberChanged) {
            const eventId = await updateCalendarEvent(
                accessToken,
                barber.google_calendar_id,
                booking.google_event_id,
                eventFields,
                sendUpdates,
            );
            return { eventId, updated: true };
        }

        const eventId = await createCalendarEvent(
            accessToken,
            barber.google_calendar_id,
            eventFields,
            sendUpdates,
        );
        await getAdmin().from('bookings').update({ google_event_id: eventId }).eq('id', booking.id);
        return { eventId, created: true };
    } catch (error) {
        console.error('[calendar/sync] barber appointment invite failed:', error);
        return { eventId: booking.google_event_id, error: String(error) };
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

function barberCalendarReady(barber: BarberCalendarInfo | null): barber is BarberCalendarInfo {
    return !!(barber?.google_calendar_tokens && barber.google_calendar_id);
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
    const barberEmail = barber?.email ?? null;
    const shopConnected = await isShopCalendarConnected();
    const barberReady = barberCalendarReady(barber);

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

        if (barberReady) {
            const barberResult = await syncBarberAppointmentInvite(booking, barber, { barberChanged: !!barberChanged });
            return NextResponse.json({
                success: !!barberResult.eventId,
                eventId: barberResult.eventId,
                inviteModel: 'barber_appointment',
                updated: barberResult.updated,
                created: barberResult.created,
                warning: barberResult.error,
            });
        }

        if (shopConnected) {
            let shopEventId: string | null = null;
            try {
                shopEventId = await syncShopInvite(booking, barber?.name ?? null, barberEmail);
            } catch (error) {
                console.error('[calendar/sync] shop calendar failed:', error);
            }
            return NextResponse.json({
                success: !!shopEventId,
                shopEventId,
                inviteModel: 'shop_calendar',
                skipped: !shopEventId ? true : undefined,
                reason: !shopEventId ? 'shop_calendar_failed' : undefined,
            });
        }

        return NextResponse.json({
            success: false,
            skipped: true,
            reason: 'no_calendar_connected',
        });
    }

    // action === 'create'
    if (barberReady && booking.google_event_id) {
        return NextResponse.json({
            success: true,
            skipped: true,
            reason: 'already_synced',
            eventId: booking.google_event_id,
            inviteModel: 'barber_appointment',
        });
    }

    if (!barberReady && booking.shop_google_event_id) {
        return NextResponse.json({
            success: true,
            skipped: true,
            reason: 'already_synced',
            shopEventId: booking.shop_google_event_id,
            inviteModel: 'shop_calendar',
        });
    }

    if (barberReady) {
        const barberResult = await syncBarberAppointmentInvite(booking, barber);
        await upsertClientCrm(booking);

        return NextResponse.json({
            success: !!barberResult.eventId,
            eventId: barberResult.eventId,
            inviteModel: 'barber_appointment',
            created: barberResult.created,
            warning: barberResult.error,
            skipped: !barberResult.eventId ? true : undefined,
            reason: !barberResult.eventId ? 'barber_calendar_failed' : undefined,
        });
    }

    if (shopConnected) {
        let shopEventId: string | null = booking.shop_google_event_id ?? null;
        if (!shopEventId) {
            try {
                shopEventId = await syncShopInvite(booking, barber?.name ?? null, barberEmail);
            } catch (error) {
                console.error('[calendar/sync] shop calendar failed:', error);
            }
        }

        await upsertClientCrm(booking);

        return NextResponse.json({
            success: !!shopEventId,
            shopEventId,
            inviteModel: 'shop_calendar',
            skipped: !shopEventId ? true : undefined,
            reason: !shopEventId ? 'shop_calendar_failed' : undefined,
        });
    }

    return NextResponse.json({
        success: false,
        skipped: true,
        reason: 'no_calendar_connected',
    });
}
