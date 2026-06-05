// POST /api/calendar/share
// Grants savronmn@gmail.com "writer" (editor) access to every connected barber's
// Google Calendar using the Calendar ACL API.
// Call this once from the admin panel — idempotent (will update if rule already exists).

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getValidAccessToken, type CalendarToken } from '@/lib/google-calendar';

const SHARE_EMAIL = 'savronmn@gmail.com';
const GCAL_BASE   = 'https://www.googleapis.com/calendar/v3';

async function upsertAclRule(accessToken: string, calendarId: string) {
    // First try INSERT; if rule already exists this will fail gracefully
    const url = `${GCAL_BASE}/calendars/${encodeURIComponent(calendarId)}/acl`;

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            role: 'writer',
            scope: { type: 'user', value: SHARE_EMAIL },
        }),
    });

    const data = await res.json();

    // 409 = rule already exists — not an error, just update role to writer
    if (res.status === 409 && data.id) {
        const patchRes = await fetch(`${url}/${encodeURIComponent(data.id)}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ role: 'writer' }),
        });
        return await patchRes.json();
    }

    return data;
}

export async function POST() {
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

    if (!barbers?.length) {
        return NextResponse.json({
            message: 'No barbers with connected Google Calendars found.',
            results: [],
        });
    }

    const results = await Promise.allSettled(
        barbers.map(async (barber) => {
            const tokens = barber.google_calendar_tokens as CalendarToken;
            const accessToken = await getValidAccessToken(tokens);
            const result = await upsertAclRule(accessToken, barber.google_calendar_id);
            return { barber: barber.name, calendarId: barber.google_calendar_id, result };
        })
    );

    const summary = results.map((r, i) => ({
        barber: barbers[i].name,
        status: r.status,
        detail: r.status === 'fulfilled' ? r.value.result : (r as PromiseRejectedResult).reason?.message,
    }));

    return NextResponse.json({
        message: `Attempted to grant ${SHARE_EMAIL} writer access to ${barbers.length} calendar(s).`,
        results: summary,
    });
}
