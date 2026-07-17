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

    let limit = 500;
    let includePast = true;
    let resyncFuture = true;
    try {
        const body = await request.json().catch(() => ({})) as {
            limit?: number;
            includePast?: boolean;
            resyncFuture?: boolean;
        };
        if (body.limit && Number.isFinite(body.limit)) {
            limit = Math.min(Math.max(1, body.limit), 500);
        }
        if (typeof body.includePast === 'boolean') {
            includePast = body.includePast;
        }
        if (typeof body.resyncFuture === 'boolean') {
            resyncFuture = body.resyncFuture;
        }
    } catch {
        // use defaults
    }

    const result = await repairMissingBarberBlocks({ limit, includePast, resyncFuture });
    return NextResponse.json({ success: true, ...result });
}
