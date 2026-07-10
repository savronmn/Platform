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

// Create an event on the barber's Google Calendar
export async function createCalendarEvent(
    accessToken: string,
    calendarId: string,
    event: {
        summary: string;
        description?: string;
        startIso: string;  // "2026-04-01T10:00:00-05:00"
        endIso: string;
        attendeeEmails?: string[];
    }
): Promise<string> {
    const body: Record<string, unknown> = {
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startIso, timeZone: 'America/Chicago' },
        end: { dateTime: event.endIso, timeZone: 'America/Chicago' },
    };
    if (event.attendeeEmails && event.attendeeEmails.length > 0) {
        body.attendees = event.attendeeEmails.map(email => ({ email }));
    }

    const res = await fetch(
        `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?sendUpdates=all`,
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

// Delete a calendar event (for cancellations)
export async function deleteCalendarEvent(
    accessToken: string,
    calendarId: string,
    eventId: string
): Promise<void> {
    const res = await fetch(
        `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
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
