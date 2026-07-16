// POST /api/calendar/repair-barber-blocks
// Backfills missing google_event_id blocks for connected barbers (staff only).

import { NextRequest, NextResponse } from 'next/server';
import { repairMissingBarberBlocks } from '@/lib/sync-booking-calendars';
import { requireStaff } from '@/lib/staff-auth';

export async function POST(request: NextRequest) {
    const staff = await requireStaff();
    if (!staff.ok) {
        return NextResponse.json({ error: staff.error }, { status: staff.status });
    }

    let limit = 100;
    try {
        const body = await request.json().catch(() => ({})) as { limit?: number };
        if (body.limit && Number.isFinite(body.limit)) {
            limit = Math.min(Math.max(1, body.limit), 500);
        }
    } catch {
        // use default limit
    }

    const result = await repairMissingBarberBlocks({ limit });
    return NextResponse.json({ success: true, ...result });
}
