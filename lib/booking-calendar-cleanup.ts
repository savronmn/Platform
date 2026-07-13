// Delete booking events from barber + Savron shop Google Calendars.
// Barber calendar holds the client-facing appointment invite when connected.
// Shop calendar holds the invite when barber calendar is unavailable.

import { createClient } from '@supabase/supabase-js';
import {
    deleteCalendarEvent,
    findEventsByBookingId,
    findMatchingCalendarEvents,
    getValidAccessToken,
    listAccountCalendarIds,
    type CalendarToken,
} from '@/lib/google-calendar';
import { getShopCalendarId, getShopCalendarTokens } from '@/lib/shop-calendar';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface BookingCalendarTarget {
    id: string;
    google_event_id: string | null;
    shop_google_event_id?: string | null;
    barber_id: string | null;
    date: string;
    time: string;
    client_name: string | null;
    client_email: string | null;
    service: string;
}

export interface CalendarCleanupResult {
    deleted: number;
    failed: number;
    calendarsChecked: string[];
}

async function deleteTargets(
    accessToken: string,
    targets: Array<{ calendarId: string; eventId: string }>,
    sendUpdates: 'all' | 'none' = 'none',
): Promise<{ deleted: number; failed: number }> {
    const unique = Array.from(
        new Map(targets.map(t => [`${t.calendarId}:${t.eventId}`, t])).values(),
    );
    if (unique.length === 0) return { deleted: 0, failed: 0 };

    const results = await Promise.allSettled(
        unique.map(async target => {
            await deleteCalendarEvent(accessToken, target.calendarId, target.eventId, sendUpdates);
        }),
    );

    const failed = results.filter(r => r.status === 'rejected').length;
    return { deleted: unique.length - failed, failed };
}

async function collectBarberTargets(
    barberId: string,
    booking: BookingCalendarTarget,
    fallbackDate?: string,
    fallbackTime?: string,
): Promise<{
    targets: Array<{ calendarId: string; eventId: string }>;
    calendarIds: string[];
    accessToken: string | null;
}> {
    const supabase = getAdmin();
    const { data: barber } = await supabase
        .from('barbers')
        .select('google_calendar_id, google_calendar_tokens')
        .eq('id', barberId)
        .single();

    if (!barber?.google_calendar_tokens || !barber.google_calendar_id) {
        return { targets: [], calendarIds: [], accessToken: null };
    }

    const accessToken = await getValidAccessToken(barber.google_calendar_tokens as CalendarToken);

    // Fast path: stored event id avoids scanning every connected calendar.
    if (booking.google_event_id) {
        return {
            targets: [{ calendarId: barber.google_calendar_id, eventId: booking.google_event_id }],
            calendarIds: [barber.google_calendar_id],
            accessToken,
        };
    }

    const calendarIds = await listAccountCalendarIds(accessToken);
    const idsToSearch = calendarIds.length > 0 ? calendarIds : [barber.google_calendar_id];

    const targets: Array<{ calendarId: string; eventId: string }> = [];
    const seen = new Set<string>();

    const addTarget = (calendarId: string, eventId: string) => {
        const key = `${calendarId}:${eventId}`;
        if (seen.has(key)) return;
        seen.add(key);
        targets.push({ calendarId, eventId });
    };

    const byBookingId = await findEventsByBookingId(accessToken, idsToSearch, booking.id);
    byBookingId.forEach(t => addTarget(t.calendarId, t.eventId));

    const matchBooking = {
        date: fallbackDate ?? booking.date,
        time: fallbackTime ?? booking.time,
        client_name: booking.client_name,
        client_email: booking.client_email,
        service: booking.service,
    };
    const knownIds = new Set(targets.map(t => t.eventId));
    const fallbackMatches = await findMatchingCalendarEvents(
        accessToken,
        idsToSearch,
        matchBooking,
        knownIds,
    );
    fallbackMatches.forEach(t => addTarget(t.calendarId, t.eventId));

    return { targets, calendarIds: idsToSearch, accessToken };
}

async function collectShopTargets(
    booking: BookingCalendarTarget,
    fallbackDate?: string,
    fallbackTime?: string,
): Promise<{
    targets: Array<{ calendarId: string; eventId: string }>;
    calendarIds: string[];
    accessToken: string | null;
}> {
    const tokens = await getShopCalendarTokens();
    if (!tokens) return { targets: [], calendarIds: [], accessToken: null };

    const accessToken = await getValidAccessToken(tokens);
    const primaryId = await getShopCalendarId();

    // Fast path: stored shop event id avoids scanning every connected calendar.
    if (booking.shop_google_event_id) {
        return {
            targets: [{ calendarId: primaryId, eventId: booking.shop_google_event_id }],
            calendarIds: [primaryId],
            accessToken,
        };
    }

    const calendarIds = await listAccountCalendarIds(accessToken);
    const idsToSearch = calendarIds.length > 0
        ? Array.from(new Set([primaryId, ...calendarIds]))
        : [primaryId];

    const targets: Array<{ calendarId: string; eventId: string }> = [];
    const seen = new Set<string>();

    const addTarget = (calendarId: string, eventId: string) => {
        const key = `${calendarId}:${eventId}`;
        if (seen.has(key)) return;
        seen.add(key);
        targets.push({ calendarId, eventId });
    };

    const byBookingId = await findEventsByBookingId(accessToken, idsToSearch, booking.id);
    byBookingId.forEach(t => addTarget(t.calendarId, t.eventId));

    const matchBooking = {
        date: fallbackDate ?? booking.date,
        time: fallbackTime ?? booking.time,
        client_name: booking.client_name,
        client_email: booking.client_email,
        service: booking.service,
    };
    const knownIds = new Set(targets.map(t => t.eventId));
    const fallbackMatches = await findMatchingCalendarEvents(
        accessToken,
        idsToSearch,
        matchBooking,
        knownIds,
    );
    fallbackMatches.forEach(t => addTarget(t.calendarId, t.eventId));

    return { targets, calendarIds: idsToSearch, accessToken };
}

async function cleanupBarberCalendarEvents(
    barberId: string,
    booking: BookingCalendarTarget,
    fallbackDate?: string,
    fallbackTime?: string,
): Promise<CalendarCleanupResult> {
    const { targets, calendarIds, accessToken } = await collectBarberTargets(
        barberId,
        booking,
        fallbackDate,
        fallbackTime,
    );

    if (!accessToken || targets.length === 0) {
        return { deleted: 0, failed: 0, calendarsChecked: [] };
    }

    const result = await deleteTargets(accessToken, targets, 'all');
    return {
        deleted: result.deleted,
        failed: result.failed,
        calendarsChecked: calendarIds.map(id => `barber:${id}`),
    };
}

async function cleanupShopCalendarEvents(
    booking: BookingCalendarTarget,
    fallbackDate?: string,
    fallbackTime?: string,
): Promise<CalendarCleanupResult> {
    const { targets, calendarIds, accessToken } = await collectShopTargets(
        booking,
        fallbackDate,
        fallbackTime,
    );

    if (!accessToken || targets.length === 0) {
        return { deleted: 0, failed: 0, calendarsChecked: [] };
    }

    // Notify attendees that the Google invite was cancelled.
    const result = await deleteTargets(accessToken, targets, 'all');
    return {
        deleted: result.deleted,
        failed: result.failed,
        calendarsChecked: calendarIds.map(id => `shop:${id}`),
    };
}

/** Remove all Google Calendar blocks for a booking from barber + Savron shop calendars. */
export async function deleteAllBookingCalendarEvents(
    booking: BookingCalendarTarget,
    options: {
        barberId?: string | null;
        fallbackDate?: string;
        fallbackTime?: string;
    } = {},
): Promise<CalendarCleanupResult> {
    const barberId = options.barberId ?? booking.barber_id;
    const fallbackDate = options.fallbackDate;
    const fallbackTime = options.fallbackTime;

    const cleanupTasks: Array<Promise<CalendarCleanupResult>> = [];
    if (barberId) {
        cleanupTasks.push(cleanupBarberCalendarEvents(barberId, booking, fallbackDate, fallbackTime));
    }
    cleanupTasks.push(cleanupShopCalendarEvents(booking, fallbackDate, fallbackTime));

    const results = await Promise.all(cleanupTasks);
    return results.reduce<CalendarCleanupResult>(
        (acc, result) => ({
            deleted: acc.deleted + result.deleted,
            failed: acc.failed + result.failed,
            calendarsChecked: [...acc.calendarsChecked, ...result.calendarsChecked],
        }),
        { deleted: 0, failed: 0, calendarsChecked: [] },
    );
}
