// GET /api/calendar/events?dateStart=YYYY-MM-DD&dateEnd=YYYY-MM-DD
// Returns Google Calendar events for all connected barbers in the given date range.
// Used by the host view to show external appointments alongside platform bookings.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidAccessToken, type CalendarToken } from '@/lib/google-calendar';

const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

async function listEvents(accessToken: string, calendarId: string, timeMin: string, timeMax: string) {
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
    const data = await res.json();
    return (data.items ?? []) as any[];
}

function isoToTimeSlot(iso: string): string {
    // Return the exact event time — no rounding.
    // Parse h/m from ISO string to avoid server UTC timezone shifts.
    // e.g. "2026-06-08T10:00:00-05:00" → "10:00 AM"
    const match = iso.match(/T(\d{2}):(\d{2})/);
    if (!match) return '9:00 AM';
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    if (iso.endsWith('Z')) h = (h - 5 + 24) % 24; // UTC → CDT
    const meridiem = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${meridiem}`;
}

/** Extract a clean client name from GCal event data.
 *  Priority:
 *  1. Non-email displayName from attendees (exclude savronmn & info@savronmn)
 *  2. Name parsed from summary patterns: "✂️ {Name} — {service}", "{service} ({Name})", etc.
 *  3. Raw summary if it looks like a name (no special chars, short enough)
 *  4. null
 */
function extractClientName(e: any): string | null {
    const SYSTEM_EMAILS = ['info@savronmn.com', 'savronmn@gmail.com', 'aah8903@gmail.com'];

    // 1. Look for a real attendee (non-system, non-email-only)
    const attendees: any[] = e.attendees ?? [];
    for (const a of attendees) {
        const email = (a.email ?? '').toLowerCase();
        if (SYSTEM_EMAILS.includes(email)) continue;
        if (a.displayName && !a.displayName.includes('@')) return a.displayName;
        // Has a non-system email but no display name — skip (we'll parse from summary)
    }

    // 2. Parse name from known summary patterns
    const summary: string = (e.summary ?? '').trim();

    // Pattern: "✂️ Name — Service" or "✂️ Name - Service"
    const scissorsMatch = summary.match(/^✂️?\s*(.+?)\s*[—–-]\s*.+/);
    if (scissorsMatch) {
        const name = scissorsMatch[1].trim();
        if (name && !name.includes('@')) return name;
    }

    // Pattern: "Service (Name)" or "SERVICE (Name)"
    const parenMatch = summary.match(/\(([^)]+)\)\s*$/);
    if (parenMatch) {
        const name = parenMatch[1].trim();
        if (name && !name.includes('@')) return name;
    }

    // Pattern: "Name — Service" (no scissors)
    const dashMatch = summary.match(/^([A-Z][a-z]+(?: [A-Z][a-z]+)+)\s*[—–-]/);
    if (dashMatch) {
        const name = dashMatch[1].trim();
        if (name && !name.includes('@')) return name;
    }

    // 3. If summary looks like just a name (1-3 words, titlecase, no special chars)
    if (/^[A-Z][a-z]+(?: [A-Z][a-z]+){0,2}$/.test(summary)) {
        return summary;
    }

    return null;
}

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl;
    const dateStart = searchParams.get('dateStart');
    const dateEnd = searchParams.get('dateEnd');

    if (!dateStart || !dateEnd) {
        return NextResponse.json({ error: 'dateStart and dateEnd required' }, { status: 400 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: barbers } = await supabase
        .from('barbers')
        .select('id, name, google_calendar_id, google_calendar_tokens')
        .not('google_calendar_tokens', 'is', null)
        .not('google_calendar_id', 'is', null)
        .eq('active', true);

    if (!barbers?.length) return NextResponse.json([]);

    const timeMin = `${dateStart}T00:00:00-05:00`;
    const timeMax = `${dateEnd}T23:59:59-05:00`;

    const settled = await Promise.allSettled(
        barbers.map(async (barber) => {
            const tokens = barber.google_calendar_tokens as CalendarToken;
            const accessToken = await getValidAccessToken(tokens);
            const events = await listEvents(accessToken, barber.google_calendar_id, timeMin, timeMax);

            const mapped = events
                .filter((e) => e.status !== 'cancelled' && e.start?.dateTime)
                .map((e) => {
                    const clientName = extractClientName(e);
                    return {
                        id: e.id as string,
                        barberId: barber.id as string,
                        barberName: barber.name as string,
                        summary: (e.summary as string) || 'Appointment',
                        // clientName is the clean extracted name; attendee kept for backward compat
                        clientName,
                        attendee: clientName,
                        start: e.start.dateTime as string,
                        end: (e.end?.dateTime ?? e.start.dateTime) as string,
                        date: (e.start.dateTime as string).slice(0, 10),
                        time: isoToTimeSlot(e.start.dateTime as string),
                        // htmlLink is the canonical Google Calendar URL to view/edit this event
                        htmlLink: (e.htmlLink as string | undefined) ?? null,
                        source: 'google' as const,
                    };
                });

            // Dedup pass 1: keep one event per barber+date+time.
            // Among duplicates at the same time, prefer the one with a real client name.
            const slotMap = new Map<string, typeof mapped[number]>();
            for (const ev of mapped) {
                const slotKey = `${ev.barberId}|${ev.date}|${ev.time}`;
                const existing = slotMap.get(slotKey);
                if (!existing) { slotMap.set(slotKey, ev); continue; }
                // Prefer whichever has a real client name
                if (ev.clientName && !existing.clientName) slotMap.set(slotKey, ev);
            }

            const pass1 = Array.from(slotMap.values());

            // Dedup pass 2: if same client name appears at same date+time (across barbers),
            // keep only the first. This handles duplicate calendars reading the same event.
            return pass1;
        })
    );

    const allEvents = settled
        .filter((r): r is PromiseFulfilledResult<any[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);

    // Global dedup by name+date+time — catches the same appointment showing from
    // multiple connected calendars (e.g. personal + appointment calendar both connected).
    const globalSeen = new Map<string, typeof allEvents[number]>();
    for (const ev of allEvents) {
        const normalName = (ev.clientName ?? ev.summary).toLowerCase().trim().replace(/\s+/g, ' ');
        const globalKey = `${normalName}|${ev.date}|${ev.time}`;
        if (!globalSeen.has(globalKey)) {
            globalSeen.set(globalKey, ev);
        } else {
            // Keep whichever has the better name
            const existing = globalSeen.get(globalKey)!;
            if (ev.clientName && !existing.clientName) globalSeen.set(globalKey, ev);
        }
    }

    return NextResponse.json(Array.from(globalSeen.values()));
}
