// POST /api/calendar/sync
// Called after a booking is confirmed to push the event to the barber's Google Calendar.
// Also called on booking cancellation (action: "delete") or edit (action: "update").
// Body: { bookingId: string, action: "create" | "delete" | "update", previousBarberId?: string, previousDate?: string, previousTime?: string }
//
// Invite model:
// - Savron shop calendar = silent internal mirror (no client attendee, no Google email)
// - Barber calendar = silent busy block (no attendees, no Google invite email)
// - Client gets one Resend email with PUBLISH .ics (organizer savronmn@gmail.com / SAVRON)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    getValidAccessToken,
    createCalendarEvent,
    updateCalendarEvent,
    toIsoString,
    type CalendarToken,
} from '@/lib/google-calendar';
import { deleteAllBookingCalendarEvents } from '@/lib/booking-calendar-cleanup';
import { upsertShopInviteEvent } from '@/lib/shop-calendar';
import { requireStaff } from '@/lib/staff-auth';
import { SERVICES } from '@/lib/services-data';
import { SHOP_NAME } from '@/lib/shop';

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

function buildEventPayload(booking: {
    date: string;
    time: string;
    service: string;
    client_name: string | null;
    client_phone: string | null;
    client_email: string | null;
    price: string | null;
}) {
    const service = SERVICES.find(s => s.name === booking.service);
    const durationMin = service?.durationMin ?? 45;

    const startIso = toIsoString(booking.date, booking.time);

    const [timePart, meridiem] = booking.time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    const endMinutes = hours * 60 + minutes + durationMin;
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    const endMeridiem = endH >= 12 ? 'PM' : 'AM';
    const endH12 = endH > 12 ? endH - 12 : endH || 12;
    const endTimeStr = `${endH12}:${String(endM).padStart(2, '0')} ${endMeridiem}`;
    const endIso = toIsoString(booking.date, endTimeStr);

    const summary = `✂️ ${booking.client_name ?? 'Client'} — ${booking.service}`;
    const description = [
        `Service: ${booking.service}`,
        `Duration: ${durationMin} min`,
        booking.client_phone ? `Phone: ${booking.client_phone}` : '',
        booking.client_email ? `Email: ${booking.client_email}` : '',
        `Price: ${booking.price ?? ''}`,
        '',
        'Client confirmation is sent by email with a calendar attachment.',
        'Use the Cancel Appointment link in that email to free the slot.',
    ].filter(Boolean).join('\n');

    return { summary, description, startIso, endIso, durationMin };
}

async function removeBookingFromCalendars(
    booking: {
        id: string;
        google_event_id: string | null;
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
    },
) {
    const { summary, description, startIso, endIso } = buildEventPayload(booking);
    const clientSummary = `${booking.service} — ${SHOP_NAME}`;
    const shopEventId = await upsertShopInviteEvent({
        bookingId: booking.id,
        shopEventId: booking.shop_google_event_id,
        summary: clientSummary,
        description,
        startIso,
        endIso,
        clientEmail: booking.client_email,
    });

    if (shopEventId) {
        await getAdmin()
            .from('bookings')
            .update({ shop_google_event_id: shopEventId })
            .eq('id', booking.id);
    }

    return shopEventId;
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

    // Public book flow may create once shortly after insert; edits/deletes require staff.
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
            // Unauthenticated create only allowed within 10 minutes of booking insert
            // (public BookingFlow immediately after insert).
            if (!Number.isFinite(createdAt) || ageMs < 0 || ageMs > 10 * 60_000) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }
    }

    const barber = booking.barbers as BarberCalendarInfo | null;

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

        const shopEventId = await syncShopInvite(booking);

        if (!barber?.google_calendar_tokens || !barber.google_calendar_id) {
            return NextResponse.json({
                success: !!shopEventId,
                shopEventId,
                skipped: !shopEventId ? true : undefined,
                reason: !shopEventId ? 'no_calendar_connected' : undefined,
            });
        }

        const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
        const { summary, description, startIso, endIso } = buildEventPayload(booking);

        if (booking.google_event_id && !barberChanged) {
            const eventId = await updateCalendarEvent(
                accessToken,
                barber.google_calendar_id,
                booking.google_event_id,
                { summary, description, startIso, endIso, attendeeEmails: [], bookingId: booking.id },
                'none',
            );
            return NextResponse.json({ success: true, eventId, shopEventId, updated: true });
        }

        const eventId = await createCalendarEvent(
            accessToken,
            barber.google_calendar_id,
            {
                summary,
                description,
                startIso,
                endIso,
                attendeeEmails: [],
                bookingId: booking.id,
            },
            'none',
        );
        await supabaseAdmin.from('bookings').update({ google_event_id: eventId }).eq('id', bookingId);
        return NextResponse.json({ success: true, eventId, shopEventId, created: true });
    }

    // action === 'create'
    // Idempotent when both calendars are already linked (prevents abuse with known booking IDs).
    if (booking.google_event_id && booking.shop_google_event_id) {
        return NextResponse.json({
            success: true,
            skipped: true,
            reason: 'already_synced',
            eventId: booking.google_event_id,
            shopEventId: booking.shop_google_event_id,
        });
    }

    const shopEventId = booking.shop_google_event_id
        ?? await syncShopInvite(booking);

    if (!barber?.google_calendar_tokens || !barber.google_calendar_id) {
        return NextResponse.json({
            success: !!shopEventId,
            shopEventId,
            skipped: !shopEventId ? true : undefined,
            reason: !shopEventId ? 'no_calendar_connected' : undefined,
        });
    }

    if (booking.google_event_id) {
        return NextResponse.json({
            success: true,
            eventId: booking.google_event_id,
            shopEventId,
        });
    }

    const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
    const { summary, description, startIso, endIso } = buildEventPayload(booking);

    const eventId = await createCalendarEvent(
        accessToken,
        barber.google_calendar_id,
        {
            summary,
            description,
            startIso,
            endIso,
            attendeeEmails: [],
            bookingId: booking.id,
        },
        'none',
    );

    await getAdmin().from('bookings').update({ google_event_id: eventId }).eq('id', bookingId);

    if (booking.client_name) {
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

    return NextResponse.json({ success: true, eventId, shopEventId });
}
