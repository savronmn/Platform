// Google Calendar API helpers — server-side only
// Uses OAuth 2.0 with stored refresh tokens

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

export interface CalendarToken {
    access_token: string;
    refresh_token: string;
    expiry_date: number; // ms timestamp
}

// Refresh an expired access token
export async function refreshAccessToken(refreshToken: string): Promise<string> {
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
    return data.access_token;
}

// Build the OAuth authorization URL for a barber
export function buildAuthUrl(state: string): string {
    const params = new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
        response_type: 'code',
        scope: [
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/calendar.readonly',
        ].join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
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
    const isExpired = Date.now() >= token.expiry_date - 60_000; // 1 min buffer
    if (isExpired) return refreshAccessToken(token.refresh_token);
    return token.access_token;
}

export type CalendarSendUpdates = 'all' | 'externalOnly' | 'none';

// Create an event on a Google Calendar
export async function createCalendarEvent(
    accessToken: string,
    calendarId: string,
    event: {
        summary: string;
        description?: string;
        startIso: string;  // "2026-04-01T10:00:00-05:00"
        endIso: string;
        attendeeEmails?: string[];
        bookingId?: string;
    },
    sendUpdates: CalendarSendUpdates = 'none',
): Promise<string> {
    const body: Record<string, unknown> = {
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startIso, timeZone: 'America/Chicago' },
        end: { dateTime: event.endIso, timeZone: 'America/Chicago' },
    };
    if (event.bookingId) {
        body.extendedProperties = { private: { savronBookingId: event.bookingId } };
    }
    if (event.attendeeEmails && event.attendeeEmails.length > 0) {
        body.attendees = event.attendeeEmails.map(email => ({ email }));
    }
    body.guestsCanModify = false;
    body.guestsCanInviteOthers = false;
    // Allow clients to propose a new time via Google Calendar RSVP UI.
    body.guestsCanSeeOtherGuests = false;

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
        startIso: string;
        endIso: string;
        attendeeEmails?: string[];
        bookingId?: string;
    },
    sendUpdates: CalendarSendUpdates = 'none',
): Promise<string> {
    const body: Record<string, unknown> = {
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startIso, timeZone: 'America/Chicago' },
        end: { dateTime: event.endIso, timeZone: 'America/Chicago' },
    };
    if (event.bookingId) {
        body.extendedProperties = { private: { savronBookingId: event.bookingId } };
    }
    if (event.attendeeEmails && event.attendeeEmails.length > 0) {
        body.attendees = event.attendeeEmails.map(email => ({ email }));
    }
    body.guestsCanModify = false;
    body.guestsCanInviteOthers = false;
    body.guestsCanSeeOtherGuests = false;

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
        next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.items ?? []) as Array<{ id?: string }>)
        .map(calendar => calendar.id)
        .filter((id): id is string => Boolean(id));
}

async function listCalendarEventsForDay(
    accessToken: string,
    calendarId: string,
    date: string,
): Promise<CalendarListEvent[]> {
    const timeMin = `${date}T00:00:00-05:00`;
    const timeMax = `${date}T23:59:59-05:00`;
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
    const [timePart, meridiem] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    // Central Time offset: -05:00 (CST) / -06:00 (CDT) — using fixed CST for simplicity
    return `${date}T${hh}:${mm}:00-05:00`;
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

    const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 0 },
    });

    if (!res.ok) {
        const err = await res.text();
        console.error('Failed to fetch calendar events for busy:', err);
        throw new Error('Failed to fetch calendar events for busy');
    }

    const data = await res.json();
    return ((data.items ?? []) as Array<{ id?: string; status?: string; start?: { dateTime?: string }; end?: { dateTime?: string } }>)
        .filter(e => e.status !== 'cancelled' && e.start?.dateTime)
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
): Promise<{ id?: string; status?: string; sequence?: number; attendees?: Array<{ email?: string; responseStatus?: string; organizer?: boolean }> }> {
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
