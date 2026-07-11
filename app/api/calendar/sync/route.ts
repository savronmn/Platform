// POST /api/calendar/sync
// Called after a booking is confirmed to push the event to the barber's Google Calendar.
// Also called on booking cancellation (action: "delete") or edit (action: "update").
// Body: { bookingId: string, action: "create" | "delete" | "update", previousBarberId?: string, previousDate?: string, previousTime?: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    getValidAccessToken,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    listAccountCalendarIds,
    findMatchingCalendarEvents,
    toIsoString,
    type CalendarToken,
} from '@/lib/google-calendar';
import { SERVICES } from '@/lib/services-data';

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
    ].filter(Boolean).join('\n');

    return { summary, description, startIso, endIso, durationMin };
}

function buildAttendees(_booking: { client_email: string | null }, _barber: BarberCalendarInfo | null): string[] {
    // Invites are sent only via Savron email (bookings@savronmn.com). GCal event is barber-side busy block only.
    return [];
}

async function deleteEventFromBarber(
    supabaseAdmin: ReturnType<typeof getAdmin>,
    barberId: string,
    booking: {
        id: string;
        google_event_id: string | null;
        date: string;
        time: string;
        client_name: string | null;
        client_email: string | null;
        service: string;
    },
    fallbackDate?: string,
    fallbackTime?: string,
): Promise<void> {
    const { data: oldBarber } = await supabaseAdmin
        .from('barbers')
        .select('google_calendar_id, google_calendar_tokens')
        .eq('id', barberId)
        .single();

    if (!oldBarber?.google_calendar_tokens || !oldBarber.google_calendar_id) return;

    const accessToken = await getValidAccessToken(oldBarber.google_calendar_tokens as CalendarToken);
    const calendarIds = await listAccountCalendarIds(accessToken);
    const idsToSearch = calendarIds.length > 0 ? calendarIds : [oldBarber.google_calendar_id];

    const targets: Array<{ calendarId: string; eventId: string }> = [];
    const knownEventIds = new Set<string>();
    if (booking.google_event_id) {
        knownEventIds.add(booking.google_event_id);
        for (const calendarId of idsToSearch) {
            targets.push({ calendarId, eventId: booking.google_event_id });
        }
    }

    const matchBooking = {
        date: fallbackDate ?? booking.date,
        time: fallbackTime ?? booking.time,
        client_name: booking.client_name,
        client_email: booking.client_email,
        service: booking.service,
    };

    const fallbackMatches = await findMatchingCalendarEvents(
        accessToken,
        idsToSearch,
        matchBooking,
        knownEventIds,
    );
    targets.push(...fallbackMatches);

    const uniqueTargets = Array.from(
        new Map(targets.map(target => [`${target.calendarId}:${target.eventId}`, target])).values(),
    );

    await Promise.all(uniqueTargets.map(target =>
        deleteCalendarEvent(accessToken, target.calendarId, target.eventId),
    ));
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

    const supabaseAdmin = getAdmin();

    const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('*, barbers(name, email, google_calendar_id, google_calendar_tokens)')
        .eq('id', bookingId)
        .single();

    if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const barber = booking.barbers as BarberCalendarInfo | null;

    if (action === 'delete') {
        if (!barber?.google_calendar_tokens || !barber.google_calendar_id) {
            return NextResponse.json({ skipped: true, reason: 'no_calendar_connected' });
        }

        const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
        const calendarIds = await listAccountCalendarIds(accessToken);
        const idsToSearch = calendarIds.length > 0
            ? calendarIds
            : [barber.google_calendar_id];

        const targets: Array<{ calendarId: string; eventId: string }> = [];
        const knownEventIds = new Set<string>();
        if (booking.google_event_id) {
            knownEventIds.add(booking.google_event_id);
            for (const calendarId of idsToSearch) {
                targets.push({ calendarId, eventId: booking.google_event_id });
            }
        }

        const fallbackMatches = await findMatchingCalendarEvents(
            accessToken,
            idsToSearch,
            {
                date: booking.date,
                time: booking.time,
                client_name: booking.client_name,
                client_email: booking.client_email,
                service: booking.service,
            },
            knownEventIds,
        );
        targets.push(...fallbackMatches);

        const uniqueTargets = Array.from(
            new Map(targets.map(target => [`${target.calendarId}:${target.eventId}`, target])).values(),
        );

        if (uniqueTargets.length === 0) {
            return NextResponse.json({ skipped: true, reason: 'no_matching_events' });
        }

        await Promise.all(uniqueTargets.map(target =>
            deleteCalendarEvent(accessToken, target.calendarId, target.eventId),
        ));
        await getAdmin().from('bookings').update({ google_event_id: null }).eq('id', bookingId);
        return NextResponse.json({ success: true, deleted: uniqueTargets.length });
    }

    if (action === 'update') {
        const barberChanged = previousBarberId && previousBarberId !== booking.barber_id;

        if (barberChanged) {
            await deleteEventFromBarber(
                supabaseAdmin,
                previousBarberId,
                booking,
                previousDate,
                previousTime,
            );
            await supabaseAdmin.from('bookings').update({ google_event_id: null }).eq('id', bookingId);
            booking.google_event_id = null;
        }

        if (!barber?.google_calendar_tokens || !barber.google_calendar_id) {
            return NextResponse.json({ skipped: true, reason: 'no_calendar_connected' });
        }

        const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
        const { summary, description, startIso, endIso } = buildEventPayload(booking);
        const attendees = buildAttendees(booking, barber);

        if (booking.google_event_id && !barberChanged) {
            const eventId = await updateCalendarEvent(
                accessToken,
                barber.google_calendar_id,
                booking.google_event_id,
                { summary, description, startIso, endIso, attendeeEmails: attendees },
            );
            return NextResponse.json({ success: true, eventId, updated: true });
        }

        const eventId = await createCalendarEvent(accessToken, barber.google_calendar_id, {
            summary,
            description,
            startIso,
            endIso,
            attendeeEmails: attendees,
        });
        await supabaseAdmin.from('bookings').update({ google_event_id: eventId }).eq('id', bookingId);
        return NextResponse.json({ success: true, eventId, created: true });
    }

    // action === 'create'
    if (!barber?.google_calendar_tokens || !barber.google_calendar_id) {
        return NextResponse.json({ skipped: true, reason: 'no_calendar_connected' });
    }

    const accessToken = await getValidAccessToken(barber.google_calendar_tokens);
    const { summary, description, startIso, endIso } = buildEventPayload(booking);
    const attendees = buildAttendees(booking, barber);

    const eventId = await createCalendarEvent(accessToken, barber.google_calendar_id, {
        summary,
        description,
        startIso,
        endIso,
        attendeeEmails: attendees,
    });

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

    return NextResponse.json({ success: true, eventId });
}
