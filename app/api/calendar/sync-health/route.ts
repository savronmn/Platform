// GET /api/calendar/sync-health
// Returns barbers whose Google Calendar webhook sync channel is missing or expired.

import { NextResponse } from 'next/server';
import { getBarbersWithUnhealthySync } from '@/lib/cancel-booking';

export const dynamic = 'force-dynamic';

export async function GET() {
    const unhealthy = await getBarbersWithUnhealthySync();
    return NextResponse.json({ unhealthy, count: unhealthy.length });
}
