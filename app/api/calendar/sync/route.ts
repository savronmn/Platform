// POST /api/calendar/sync
// Called after a booking is confirmed to push the event to the barber's Google Calendar.
// Also called on booking cancellation (action: "delete").
// Body: { bookingId: string, action: "create" | "delete" }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    getValidAccessToken,
    createCalendarEvent,
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

export async function POST(request: NextRequest) {
    const { bookingId, action } = await request.json() as {
        bookingId: string;
        action: 'create' | 'delete';
    };

    if (!bookingId || !action) {
        return NextResponse.json({ error: 'Missing bookingId or action' }, { status: 400 });
    }

    const supabaseAdmin = getAdmin();

    // Fetch booking + barber info
    const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('*, barbers(name, email, google_calendar_id, google_calendar_tokens)')
        .eq('id', bookingId)
        .single();

    if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const barber = booking.barbers as {
        name: string;
        email: string | null;
        google_calendar_id: string | null;
        google_calendar_tokens: CalendarToken | null;
    } | null;

    if (!barber?.google_calendar_tokens || !barber.google_calendar_id) {
        // Barber hasn't connected Google Calendar — skip silently
        return NextResponse.json({ skipped: true, reason: 'no_calendar_connected' });
    }

    const accessToken = await getValidAccessToken(barber.google_calendar_tokens);

    if (action === 'delete') {
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

    // Build event times from booking.date + booking.time + duration
    const service = SERVICES.find(s => s.name === booking.service);
    const durationMin = service?.durationMin ?? 45;

    const startIso = toIsoString(booking.date, booking.time);

    // Calculate end time
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

    // Build attendees list: client + barbershop + barber email (if different from calendar owner)
    const attendees: string[] = [];
    if (booking.client_email) attendees.push(booking.client_email);
    attendees.push('info@savronmn.com'); // Barbershop / receptionist
    if (barber?.email) attendees.push(barber.email);

    const eventId = await createCalendarEvent(accessToken, barber.google_calendar_id, {
        summary,
        description,
        startIso,
        endIso,
        attendeeEmails: attendees,
    });

    // Store the Google event ID in the booking for future updates/deletes
    await getAdmin().from('bookings').update({ google_event_id: eventId }).eq('id', bookingId);

    // Sync client to clients table
    if (booking.client_name) {
        // Try to find existing client by email or phone
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
