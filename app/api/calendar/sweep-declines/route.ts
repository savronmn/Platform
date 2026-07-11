// GET|POST /api/calendar/sweep-declines
// Polls Google Calendar for client declines / propose-new-time and cancels matching bookings.
// Runs on a Vercel cron so admin/host views stay accurate even when nobody opens the host calendar.
// Auth: CRON_SECRET via Authorization Bearer header (Vercel) or x-cron-secret header.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { addDays, format, subDays } from 'date-fns';
import { processDeclinedCalendarEvents } from '@/lib/process-calendar-declines';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function verifyCronSecret(req: NextRequest): boolean {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const headerSecret = req.headers.get('x-cron-secret');
    const secret = bearer ?? headerSecret;
    return !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
}

async function handleSweep() {
    const today = new Date();
    const dateStart = format(subDays(today, 7), 'yyyy-MM-dd');
    const dateEnd = format(addDays(today, 30), 'yyyy-MM-dd');

    const result = await processDeclinedCalendarEvents(getAdmin(), dateStart, dateEnd);
    return NextResponse.json({ dateStart, dateEnd, ...result });
}

export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handleSweep();
}

export async function POST(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handleSweep();
}
