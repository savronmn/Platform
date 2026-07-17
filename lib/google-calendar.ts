// Google Calendar API helpers — server-side only
// Uses OAuth 2.0 with stored refresh tokens

import { chicagoDayBoundsIso, toChicagoIsoString } from '@/lib/chicago-time';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

export interface CalendarToken {
    access_token: string;
    refresh_token: string;
    expiry_date: number; // ms timestamp
}

// Refresh an expired access token
export async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('Failed to refresh token: ' + JSON.stringify(data));
    return { accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 };
}

/** Returns a valid access token, refreshing and returning updated token metadata when needed. */
export async function resolveAccessToken(token: CalendarToken): Promise<{ accessToken: string; token: CalendarToken }> {
    const isExpired = Date.now() >= token.expiry_date - 60_000;
    if (!isExpired) {
        return { accessToken: token.access_token, token };
    }
    const { accessToken, expiresIn } = await refreshAccessToken(token.refresh_token);
    return {
        accessToken,
        token: {
            ...token,
            access_token: accessToken,
            expiry_date: Date.now() + expiresIn * 1000,
        },
    };
}

// Build the OAuth authorization URL for a barber
export function buildAuthUrl(state: string, options: { includeLoginScopes?: boolean } = {}): string {
    const scopes = [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
    ];
    if (options.includeLoginScopes) {
        scopes.push(
            'openid',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
        );
    }

    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        response_type: 'code',
        scope: scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = await res.json() as { email?: string };
    return data.email?.toLowerCase().trim() ?? null;
}

// Exchange auth code for tokens
export async function exchangeCodeForTokens(code: string): Promise<CalendarToken> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID!,
            client_secret: process.env.GOOGLE_CLIENT_SECRET!,
            redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
            grant_type: 'authorization_code',
        }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('Token exchange failed: ' + JSON.stringify(data));
    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expiry_date: Date.now() + data.expires_in * 1000,
    };
}

// Get a valid access token (auto-refresh if needed)
export async function getValidAccessToken(token: CalendarToken): Promise<string> {
    const { accessToken } = await resolveAccessToken(token);
    return accessToken;
}

export type CalendarSendUpdates = 'all' | 'externalOnly' | 'none';

// Create an event on a Google Calendar
export async function createCalendarEvent(
    accessToken: string,
    calendarId: string,
    event: {
        summary: string;
        description?: string;
        location?: string;
        startIso: string;  // "2026-04-01T10:00:00-05:00"
        endIso: string;
        attendeeEmails?: string[];
        bookingId?: string;
        organizerEmail?: string;
        organizerDisplayName?: string;
    },
    sendUpdates: CalendarSendUpdates = 'none',
): Promise<string> {
    const body: Record<string, unknown> = {
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startIso, timeZone: 'America/Chicago' },
        end: { dateTime: event.endIso, timeZone: 'America/Chicago' },
        transparency: 'opaque',
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 60 },
            ],
        },
    };
    if (event.location) {
        body.location = event.location;
    }
    if (event.bookingId) {
        body.extendedProperties = { private: { savronBookingId: event.bookingId } };
    }
    if (event.organizerEmail) {
        body.organizer = {
            email: event.organizerEmail,
            ...(event.organizerDisplayName ? { displayName: event.organizerDisplayName } : {}),
        };
    }
    if (event.attendeeEmails !== undefined) {
        body.attendees = event.attendeeEmails.map(email => ({ email }));
    }
    body.guestsCanModify = false;
    body.guestsCanInviteOthers = false;
    body.guestsCanSeeOtherGuests = true;

    const res = await fetch(
        `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=${sendUpdates}`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }
    );
    const data = await res.json();
    if (!data.id) throw new Error('Failed to create calendar event: ' + JSON.stringify(data));
    return data.id; // Google event ID — store in booking for later updates/deletes
}

// Update an existing event on a Google Calendar
export async function updateCalendarEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: {
        summary: string;
        description?: string;
        location?: string;
        startIso: string;
        endIso: string;
        attendeeEmails?: string[];
        bookingId?: string;
        organizerEmail?: string;
        organizerDisplayName?: string;
    },
    sendUpdates: CalendarSendUpdates = 'none',
): Promise<string> {
    const body: Record<string, unknown> = {
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startIso, timeZone: 'America/Chicago' },
        end: { dateTime: event.endIso, timeZone: 'America/Chicago' },
        transparency: 'opaque',
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'email', minutes: 24 * 60 },
                { method: 'popup', minutes: 60 },
            ],
        },
    };
    if (event.location) {
        body.location = event.location;
    }
    if (event.bookingId) {
        body.extendedProperties = { private: { savronBookingId: event.bookingId } };
    }
    if (event.organizerEmail) {
        body.organizer = {
            email: event.organizerEmail,
            ...(event.organizerDisplayName ? { displayName: event.organizerDisplayName } : {}),
        };
    }
    if (event.attendeeEmails !== undefined) {
        body.attendees = event.attendeeEmails.map(email => ({ email }));
    }
    body.guestsCanModify = false;
    body.guestsCanInviteOthers = false;
    body.guestsCanSeeOtherGuests = true;

    const res = await fetch(
        `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=${sendUpdates}`,
        {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        }
    );
    const data = await res.json();
    if (!data.id) throw new Error('Failed to update calendar event: ' + JSON.stringify(data));
    return data.id;
}

// Delete a calendar event (for cancellations)
export async function deleteCalendarEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    sendUpdates: CalendarSendUpdates = 'none',
): Promise<void> {
    const res = await fetch(
        `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?sendUpdates=${sendUpdates}`,
        {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` },
        }
    );
    // 404 = already deleted — treat as success
    if (!res.ok && res.status !== 404) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Failed to delete calendar event (${res.status}): ${detail}`);
    }
}

export interface CalendarListEvent {
    id?: string;
    status?: string;
    summary?: string;
    start?: { dateTime?: string };
    attendees?: Array<{ email?: string }>;
}

/** All calendar IDs the connected account can read/write. */
export async function listAccountCalendarIds(accessToken: string): Promise<string[]> {
    const url = new URL(`${GOOGLE_CALENDAR_BASE}/users/me/calendarList`);
    url.searchParams.set('minAccessRole', 'reader');
    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
    });
    if (!res.ok) {
        const err = await res.text().catch(() => '');
        throw new Error(`Failed to list Google calendars (${res.status}): ${err}`);
    }
    const data = await res.json();
    const ids = ((data.items ?? []) as Array<{ id?: string; primary?: boolean }>)
        .map(calendar => calendar.id)
        .filter((id): id is string => Boolean(id));
    // Always include primary — appointment bookings land here even if calendarList is partial.
    if (!ids.includes('primary')) {
        ids.unshift('primary');
    }
    return ids;
}

async function listCalendarEventsForDay(
    accessToken: string,
    calendarId: string,
    date: string,
): Promise<CalendarListEvent[]> {
    const { timeMin, timeMax } = chicagoDayBoundsIso(date);
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
    return (data.items ?? []) as CalendarListEvent[];
}

function isoDateTimeToMins(iso: string): number | null {
    const match = iso.match(/T(\d{2}):(\d{2})/);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (iso.endsWith('Z')) hours = (hours - 5 + 24) % 24;
    return hours * 60 + minutes;
}

function bookingTimeToMins(time: string): number {
    const [timePart, meridiem] = time.trim().split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
}

/** Match a Google event to a booking when google_event_id was never stored. */
export function eventMatchesBooking(
    event: CalendarListEvent,
    booking: {
        date: string;
        time: string;
        client_name: string | null;
        client_email: string | null;
        service: string;
    },
): boolean {
    if (!event.id || event.status === 'cancelled' || !event.start?.dateTime) return false;
    if (!event.start.dateTime.startsWith(booking.date)) return false;

    const eventMins = isoDateTimeToMins(event.start.dateTime);
    const bookingMins = bookingTimeToMins(booking.time);
    if (eventMins === null || eventMins !== bookingMins) return false;

    const summary = (event.summary ?? '').toLowerCase();
    const clientName = booking.client_name?.toLowerCase().trim();
    const clientEmail = booking.client_email?.toLowerCase().trim();
    const service = booking.service.toLowerCase();

    if (clientName && summary.includes(clientName)) return true;
    if (clientEmail && event.attendees?.some(attendee => attendee.email?.toLowerCase() === clientEmail)) {
        return true;
    }
    if (service && summary.includes(service)) return true;
    if (summary.includes('✂️') || summary.includes('savron')) return true;

    return false;
}

/** Find calendar events that correspond to a booking (fallback when google_event_id is missing). */
export async function findMatchingCalendarEvents(
    accessToken: string,
    calendarIds: string[],
    booking: {
        date: string;
        time: string;
        client_name: string | null;
        client_email: string | null;
        service: string;
    },
    excludeEventIds: Set<string> = new Set(),
): Promise<Array<{ calendarId: string; eventId: string }>> {
    const matches: Array<{ calendarId: string; eventId: string }> = [];
    const seen = new Set<string>();

    for (const calendarId of calendarIds) {
        const events = await listCalendarEventsForDay(accessToken, calendarId, booking.date);
        for (const event of events) {
            if (!event.id || excludeEventIds.has(event.id) || seen.has(event.id)) continue;
            if (!eventMatchesBooking(event, booking)) continue;
            seen.add(event.id);
            matches.push({ calendarId, eventId: event.id });
        }
    }

    return matches;
}

/** Find events tagged with savronBookingId across calendars (survives date/barber changes). */
export async function findEventsByBookingId(
    accessToken: string,
    calendarIds: string[],
    bookingId: string,
): Promise<Array<{ calendarId: string; eventId: string }>> {
    const matches: Array<{ calendarId: string; eventId: string }> = [];
    const seen = new Set<string>();

    for (const calendarId of calendarIds) {
        const url = new URL(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
        url.searchParams.set('privateExtendedProperty', `savronBookingId=${bookingId}`);
        url.searchParams.set('maxResults', '20');

        const res = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` },
            next: { revalidate: 0 },
        });
        if (!res.ok) continue;

        const data = await res.json();
        for (const event of (data.items ?? []) as Array<{ id?: string; status?: string }>) {
            if (!event.id || event.status === 'cancelled' || seen.has(event.id)) continue;
            seen.add(event.id);
            matches.push({ calendarId, eventId: event.id });
        }
    }

    return matches;
}

// Parse a time string like "10:00 AM" + date "2026-04-01" into an ISO string (CT)
export function toIsoString(date: string, time: string): string {
    return toChicagoIsoString(date, time);
}

// Get busy slots from actual calendar events (exact start/end — no Google buffer padding).
export async function getEventBusySlots(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string,
): Promise<{ id?: string; start: string; end: string }[]> {
    const url = new URL(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('maxResults', '250');
    url.searchParams.set('showDeleted', 'false');

    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
    });

    if (!res.ok) {
        const err = await res.text();
        console.error('Failed to fetch calendar events for busy:', err);
        throw new Error(`Failed to fetch calendar events for busy (${res.status})`);
    }

    const data = await res.json();
    return ((data.items ?? []) as Array<{
        id?: string;
        status?: string;
        transparency?: string;
        start?: { dateTime?: string };
        end?: { dateTime?: string };
    }>)
        .filter(e =>
            e.status !== 'cancelled'
            && e.start?.dateTime
            && e.transparency !== 'transparent',
        )
        .map(e => ({
            id: e.id,
            start: e.start!.dateTime!,
            end: (e.end?.dateTime ?? e.start!.dateTime!) as string,
        }));
}

/** @deprecated Use getEventBusySlots — freeBusy includes Google Calendar buffer time between appointments. */
export async function getBusySlots(
    accessToken: string,
    calendarId: string,
    timeMin: string,
    timeMax: string,
): Promise<{ start: string; end: string }[]> {
    return getEventBusySlots(accessToken, calendarId, timeMin, timeMax);
}

// Watch a calendar for changes (webhooks)
export async function watchCalendar(
    accessToken: string,
    calendarId: string,
    channelId: string,
    webhookUrl: string
): Promise<{ resourceId: string }> {
    const res = await fetch(`${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/watch`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            id: channelId,
            type: 'web_hook',
            address: webhookUrl,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error('Failed to watch calendar: ' + err);
    }
    const data = await res.json();
    return { resourceId: data.resourceId };
}

// Get the initial sync token (only for events from now on to save bandwidth)
export async function getInitialSyncToken(
    accessToken: string,
    calendarId: string
): Promise<string> {
    let syncToken = '';
    let pageToken = '';
    const nowISO = new Date().toISOString(); 
    do {
        const url = `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?maxResults=2500&timeMin=${encodeURIComponent(nowISO)}${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json();
        if (data.nextSyncToken) syncToken = data.nextSyncToken;
        pageToken = data.nextPageToken || '';
    } while (pageToken);
    return syncToken;
}

// Fetch only what changed since the last sync
export async function getChangedEvents(
    accessToken: string,
    calendarId: string,
    syncToken: string
): Promise<{ events: any[]; nextSyncToken: string }> {
    let pageToken = '';
    let events: any[] = [];
    let nextSyncToken = syncToken;
    do {
        const url = `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?syncToken=${syncToken}${pageToken ? `&pageToken=${pageToken}` : ''}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const data = await res.json();
        
        if (data.error && data.error.code === 410) {
            throw new Error('Sync token expired');
        }

        if (data.items) {
           events = events.concat(data.items);
        }
        if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
        pageToken = data.nextPageToken || '';
    } while (pageToken);
    
    return { events, nextSyncToken };
}

export async function getCalendarEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
): Promise<{
    id?: string;
    status?: string;
    sequence?: number;
    attendees?: Array<{ email?: string; responseStatus?: string; organizer?: boolean; displayName?: string }>;
    extendedProperties?: { private?: { savronBookingId?: string } };
    summary?: string;
    start?: { dateTime?: string };
}> {
    const res = await fetch(
        `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Failed to fetch calendar event (${res.status}): ${detail}`);
    }
    return res.json();
}
