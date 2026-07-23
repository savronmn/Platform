// GET|POST /api/cron/membership-pass-sends
// Processes scheduled bulk ePass sends from membership_pass_send_queue.

import { NextRequest, NextResponse } from 'next/server';
import { processMembershipPassSendQueue } from '@/lib/process-membership-pass-send-queue';

function verifyCronSecret(req: NextRequest): boolean {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const headerSecret = req.headers.get('x-cron-secret');
    const secret = bearer ?? headerSecret;
    return !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await processMembershipPassSendQueue();
        return NextResponse.json(result);
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Queue processing failed';
        console.error('[cron/membership-pass-sends]', err);
        return NextResponse.json({ error: message }, { status: message.includes('not configured') ? 503 : 500 });
    }
}

export async function POST(req: NextRequest) {
    return GET(req);
}
