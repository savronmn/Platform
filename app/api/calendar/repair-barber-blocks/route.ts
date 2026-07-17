// POST|GET /api/calendar/repair-barber-blocks
// Backfills missing google_event_id blocks for connected barbers.
// Auth: staff session OR CRON_SECRET (Authorization Bearer / x-cron-secret).
// Calendar writes use sendUpdates=none — no invite emails are sent during repair.

import { NextRequest, NextResponse } from 'next/server';
import { repairMissingBarberBlocks } from '@/lib/sync-booking-calendars';
import { requireStaff } from '@/lib/staff-auth';

function verifyCronSecret(req: NextRequest): boolean {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const headerSecret = req.headers.get('x-cron-secret');
    const secret = bearer ?? headerSecret;
    return !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
}

async function handleRepair(request: NextRequest) {
    let limit = 500;
    let includePast = true;
    let resyncFuture = true;

    if (request.method === 'POST') {
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
    }

    const result = await repairMissingBarberBlocks({ limit, includePast, resyncFuture });
    return NextResponse.json({ success: true, ...result });
}

async function authorize(req: NextRequest) {
    if (verifyCronSecret(req)) return true;
    const staff = await requireStaff();
    return staff.ok;
}

export async function POST(request: NextRequest) {
    if (!(await authorize(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handleRepair(request);
}

export async function GET(request: NextRequest) {
    if (!(await authorize(request))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return handleRepair(request);
}
