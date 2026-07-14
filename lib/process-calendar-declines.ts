import type { SupabaseClient } from '@supabase/supabase-js';
import { cancelBooking } from '@/lib/cancel-booking';
import {
    extractSavronBookingId,
    findBookingForCalendarEvent,
    shouldCancelBookingFromCalendarEvent,
    anyInviteeDeclined,
    type CalendarCancellationReason,
    type CalendarSyncEvent,
} from '@/lib/calendar-event-sync';
import { getValidAccessToken, getCalendarEvent, findEventsByBookingId, listAccountCalendarIds, type CalendarToken } from '@/lib/google-calendar';
import { getShopCalendarId, getShopCalendarTokens } from '@/lib/shop-calendar';

const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';
import {
    RESEND_BOOKING_FROM,
    SHOP_CALENDAR_EMAIL,
    SHOP_CONTACT_EMAIL,
} from '@/lib/shop';

const STAFF_NOTIFY_EMAIL = process.env.RESEND_FROM_EMAIL || RESEND_BOOKING_FROM;

async function listEvents(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string,
): Promise<CalendarSyncEvent[]> {
    const url = new URL(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');

    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as CalendarSyncEvent[];
}

export async function notifyStaffOfCalendarAction(params: {
    reason: CalendarCancellationReason;
    booking: {
        id: string;
        client_name: string | null;
        client_email: string | null;
        date: string;
        time: string;
    };
    barberName?: string | null;
}): Promise<void> {
    if (!process.env.RESEND_API_KEY) return;

    const reasonLabel =
        params.reason === 'invitee_declined' || params.reason === 'client_declined'
            ? 'declined the calendar invite'
            : params.reason === 'event_time_changed' ? 'changed the event time'
                : 'removed the calendar event';

    const subject = `SAVRON — Appointment cancelled via calendar (${params.booking.client_name ?? 'Client'})`;

    const html = `
      <p style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#222;">
        <strong>${params.booking.client_name ?? 'A client'}</strong>
        (${params.booking.client_email ?? 'no email'})
        ${reasonLabel} for their appointment.
      </p>
      <ul style="font-family:sans-serif;font-size:14px;line-height:1.7;color:#333;">
        <li><strong>Date:</strong> ${params.booking.date}</li>
        <li><strong>Time:</strong> ${params.booking.time}</li>
        ${params.barberName ? `<li><strong>Barber:</strong> ${params.barberName}</li>` : ''}
        <li><strong>Booking ID:</strong> ${params.booking.id}</li>
      </ul>
      <p style="font-family:sans-serif;font-size:13px;color:#666;">
        Google Calendar also emails the organizer when a guest declines.
        The booking has been cancelled in SAVRON so the slot is free again.
      </p>
    `;

    try {
        await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: STAFF_NOTIFY_EMAIL,
                to: [SHOP_CALENDAR_EMAIL, SHOP_CONTACT_EMAIL],
                subject,
                html,
            }),
        });
    } catch (err) {
        console.error('[calendar-declines] Staff notification failed:', err);
    }
}

/** Load full attendee response data — incremental sync payloads are often partial. */
export async function enrichEventsWithFullDetails(
    accessToken: string,
    calendarId: string,
    events: CalendarSyncEvent[],
    fallbackCalendarIds: string[] = [],
): Promise<CalendarSyncEvent[]> {
    const calendarIdsToTry = Array.from(new Set([
        calendarId,
        ...fallbackCalendarIds.filter(id => id && id !== calendarId),
    ]));

    return Promise.all(events.map(async (event) => {
        if (!event.id) return event;

        for (const candidateCalendarId of calendarIdsToTry) {
            try {
                const full = await getCalendarEvent(accessToken, candidateCalendarId, event.id);
                return { ...event, ...full } as CalendarSyncEvent;
            } catch {
                continue;
            }
        }

        const bookingId = extractSavronBookingId(event);
        if (bookingId) {
            const located = await findEventsByBookingId(accessToken, calendarIdsToTry, bookingId);
            for (const match of located) {
                try {
                    const full = await getCalendarEvent(accessToken, match.calendarId, match.eventId);
                    return { ...event, ...full, id: match.eventId } as CalendarSyncEvent;
                } catch {
                    continue;
                }
            }
        }

        console.error('[calendar-declines] Failed to enrich event attendees:', event.id);
        return event;
    }));
}

async function resolveBookingForDecline(
    supabase: SupabaseClient,
    barberId: string | null,
    event: CalendarSyncEvent,
) {
    const embeddedBookingId = extractSavronBookingId(event);
    if (embeddedBookingId) {
        const { data: byEmbeddedId } = await supabase
            .from('bookings')
            .select('id, status, client_email, client_name, date, time')
            .eq('id', embeddedBookingId)
            .maybeSingle();
        if (byEmbeddedId) return byEmbeddedId;
    }

    return findBookingForCalendarEvent(supabase, barberId, event);
}

/** Process a batch of changed calendar events (webhook or sweep). */
export async function processCalendarEventChanges(
    supabase: SupabaseClient,
    barberId: string | null,
    barberName: string | null,
    events: CalendarSyncEvent[],
    seenEventIds: Set<string> = new Set(),
): Promise<{ cancelled: number; reasons: string[] }> {
    let cancelled = 0;
    const reasons: string[] = [];

    for (const event of events) {
        if (!event.id || seenEventIds.has(event.id)) continue;
        seenEventIds.add(event.id);

        if (!anyInviteeDeclined(event) && event.status !== 'cancelled') continue;

        const booking = await resolveBookingForDecline(supabase, barberId, event);
        if (!booking) {
            if (anyInviteeDeclined(event)) {
                console.warn(
                    '[calendar-declines] Decline detected but no booking match',
                    event.id,
                    extractSavronBookingId(event),
                );
            }
            continue;
        }

        const action = shouldCancelBookingFromCalendarEvent(event, booking);
        if (!action) continue;

        const sendDeclineConfirmation =
            action.reason === 'invitee_declined' || action.reason === 'client_declined';
        const result = await cancelBooking(booking.id, {
            skipCalendar: action.skipCalendar,
            forceEmail: sendDeclineConfirmation,
        });
        if (result.success && !result.alreadyCancelled) {
            cancelled += 1;
            reasons.push(action.reason);
            await notifyStaffOfCalendarAction({
                reason: action.reason,
                booking,
                barberName,
            });
        }
    }

    return { cancelled, reasons };
}

export async function processDeclinedCalendarEvents(
    supabase: SupabaseClient,
    dateStart: string,
    dateEnd: string,
): Promise<{ cancelled: number; reasons: string[] }> {
    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name, google_calendar_id, google_calendar_tokens')
        .not('google_calendar_tokens', 'is', null)
        .not('google_calendar_id', 'is', null)
        .eq('active', true);

    const timeMin = `${dateStart}T00:00:00-05:00`;
    const timeMax = `${dateEnd}T23:59:59-05:00`;
    let cancelled = 0;
    const reasons: string[] = [];
    const seenEventIds = new Set<string>();

    // 1) Barber calendars — primary client appointment invites (barber is organizer).
    for (const barber of barbers ?? []) {
        const tokens = barber.google_calendar_tokens as CalendarToken;
        const accessToken = await getValidAccessToken(tokens);
        const calendarIds = await listAccountCalendarIds(accessToken);
        const idsToFetch = calendarIds.length > 0 ? calendarIds : [barber.google_calendar_id as string];

        const events = (
            await Promise.all(idsToFetch.map(async calendarId => {
                const raw = await listEvents(accessToken, calendarId, timeMin, timeMax);
                return enrichEventsWithFullDetails(accessToken, calendarId, raw, idsToFetch);
            }))
        ).flat();

        const result = await processCalendarEventChanges(supabase, barber.id, barber.name, events, seenEventIds);
        cancelled += result.cancelled;
        reasons.push(...result.reasons);
    }

    // 2) Shop calendar — legacy invites when barber calendar was not connected.
    const shopTokens = await getShopCalendarTokens();
    if (shopTokens) {
        try {
            const accessToken = await getValidAccessToken(shopTokens);
            const shopCalendarId = await getShopCalendarId();
            const calendarIds = await listAccountCalendarIds(accessToken);
            const idsToFetch = calendarIds.length > 0
                ? Array.from(new Set([shopCalendarId, ...calendarIds]))
                : [shopCalendarId];

            const events = (
                await Promise.all(idsToFetch.map(async calendarId => {
                    const raw = await listEvents(accessToken, calendarId, timeMin, timeMax);
                    return enrichEventsWithFullDetails(accessToken, calendarId, raw, idsToFetch);
                }))
            ).flat();

            const shopResult = await processCalendarEventChanges(supabase, null, 'Savron Shop', events, seenEventIds);
            cancelled += shopResult.cancelled;
            reasons.push(...shopResult.reasons);
        } catch (err) {
            console.error('[calendar-declines] Shop calendar sweep failed:', err);
        }
    }

    return { cancelled, reasons };
}
