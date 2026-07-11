// POST /api/calendar/sync
// Called after a booking is confirmed to push the event to the barber's Google Calendar.
// Also called on booking cancellation (action: "delete") or edit (action: "update").
// Body: { bookingId: string, action: "create" | "delete" | "update", previousBarberId?: string, previousDate?: string, previousTime?: string }
//
// Invite model:
// - Savron shop calendar (savronmn@gmail.com) = Google invite to client + barber
// - Barber personal calendar = silent busy block only when shop calendar is unavailable

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
import { isShopCalendarConnected, upsertShopInviteEvent } from '@/lib/shop-calendar';
import { requireStaff } from '@/lib/staff-auth';
import { SERVICES } from '@/lib/services-data';
import { SHOP_CALENDAR_DISPLAY_NAME, SHOP_CALENDAR_EMAIL, SHOP_NAME } from '@/lib/shop';

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
        'You will receive a Google Calendar invitation from SAVRON (savronmn@gmail.com).',
        'Tap Yes to confirm, or No to cancel — declining frees the slot automatically.',
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
    barberEmail: string | null,
) {
    const { description, startIso, endIso } = buildEventPayload(booking);
    const clientSummary = booking.client_name
        ? `${booking.service} — ${booking.client_name} @ ${SHOP_NAME}`
        : `${booking.service} — ${SHOP_NAME}`;
    const shopDescription = [
        description,
        '',
        `Organizer: ${SHOP_CALENDAR_EMAIL} (${SHOP_CALENDAR_DISPLAY_NAME})`,
    ].join('\n');
    const shopEventId = await upsertShopInviteEvent({
        bookingId: booking.id,
        shopEventId: booking.shop_google_event_id,
        summary: clientSummary,
        description: shopDescription,
        startIso,
        endIso,
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

async function syncBarberCalendar(
    booking: {
        id: string;
        google_event_id: string | null;
        barber_id: string | null;
        date: string;
        time: string;
        client_name: string | null;
        client_phone: string | null;
        client_email: string | null;
        service: string;
        price: string | null;
    },
    barber: BarberCalendarInfo,
    options: { barberChanged?: boolean } = {},
): Promise<{ eventId: string | null; created?: boolean; updated?: boolean; error?: string }> {
    if (!barber.google_calendar_tokens || !barber.google_calendar_id) {
        return { eventId: null };
    }

    try {
        const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
        const { summary, description, startIso, endIso } = buildEventPayload(booking);

        if (booking.google_event_id && !options.barberChanged) {
            const eventId = await updateCalendarEvent(
                accessToken,
                barber.google_calendar_id,
                booking.google_event_id,
                { summary, description, startIso, endIso, attendeeEmails: [], bookingId: booking.id },
                'none',
            );
            return { eventId, updated: true };
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
        await getAdmin().from('bookings').update({ google_event_id: eventId }).eq('id', booking.id);
        return { eventId, created: true };
    } catch (error) {
        console.error('[calendar/sync] barber calendar failed:', error);
        return { eventId: booking.google_event_id, error: String(error) };
    }
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
    const barberEmail = barber?.email ?? null;
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

        let shopEventId: string | null = null;
        try {
            shopEventId = await syncShopInvite(booking, barberEmail);
        } catch (error) {
            console.error('[calendar/sync] shop calendar failed:', error);
        }

        if (shopConnected) {
            return NextResponse.json({
                success: !!shopEventId,
                shopEventId,
                inviteModel: 'google_calendar',
                skipped: !shopEventId ? true : undefined,
                reason: !shopEventId ? 'shop_calendar_failed' : undefined,
            });
        }

        if (!barber?.google_calendar_tokens || !barber.google_calendar_id) {
            return NextResponse.json({
                success: !!shopEventId,
                shopEventId,
                skipped: !shopEventId ? true : undefined,
                reason: !shopEventId ? 'no_calendar_connected' : undefined,
            });
        }

        const barberResult = await syncBarberCalendar(booking, barber, { barberChanged: !!barberChanged });
        return NextResponse.json({
            success: true,
            eventId: barberResult.eventId,
            shopEventId,
            updated: barberResult.updated,
            created: barberResult.created,
            warning: barberResult.error,
        });
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

    let shopEventId: string | null = booking.shop_google_event_id ?? null;
    if (!shopEventId) {
        try {
            shopEventId = await syncShopInvite(booking, barberEmail);
        } catch (error) {
            console.error('[calendar/sync] shop calendar failed:', error);
        }
    }

    if (shopConnected) {
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

        return NextResponse.json({
            success: !!shopEventId,
            shopEventId,
            inviteModel: 'google_calendar',
            skipped: !shopEventId ? true : undefined,
            reason: !shopEventId ? 'shop_calendar_failed' : undefined,
        });
    }

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

    const barberResult = await syncBarberCalendar(booking, barber);

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

    return NextResponse.json({
        success: true,
        eventId: barberResult.eventId,
        shopEventId,
        created: barberResult.created,
        updated: barberResult.updated,
        warning: barberResult.error,
    });
}
