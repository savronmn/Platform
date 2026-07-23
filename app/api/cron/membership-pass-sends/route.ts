// GET|POST /api/cron/membership-pass-sends
// Processes scheduled bulk ePass sends from membership_pass_send_queue.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMembershipPassesBulk } from '@/lib/send-membership-pass';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

function verifyCronSecret(req: NextRequest): boolean {
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const headerSecret = req.headers.get('x-cron-secret');
    const secret = bearer ?? headerSecret;
    return !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
}

async function processQueue() {
    if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: jobs, error } = await supabase
        .from('membership_pass_send_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(5);

    if (error) {
        console.error('[cron/membership-pass-sends] load failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!jobs?.length) {
        return NextResponse.json({ processed: 0, message: 'No pending pass sends' });
    }

    const results = [];

    for (const job of jobs) {
        await supabase
            .from('membership_pass_send_queue')
            .update({ status: 'processing' })
            .eq('id', job.id)
            .eq('status', 'pending');

        try {
            const sendResult = await sendMembershipPassesBulk(job.subscriber_emails ?? [], {
                subject: job.subject,
                message: job.message ?? undefined,
            });

            await supabase
                .from('membership_pass_send_queue')
                .update({
                    status: 'completed',
                    sent_count: sendResult.sent,
                    failed_count: sendResult.failed,
                    skipped_count: sendResult.skipped,
                    errors: sendResult.errors,
                    processed_at: new Date().toISOString(),
                })
                .eq('id', job.id);

            results.push({ id: job.id, ...sendResult });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await supabase
                .from('membership_pass_send_queue')
                .update({
                    status: 'failed',
                    errors: [message],
                    processed_at: new Date().toISOString(),
                })
                .eq('id', job.id);

            results.push({ id: job.id, error: message });
        }
    }

    return NextResponse.json({ processed: results.length, results });
}

export async function GET(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return processQueue();
}

export async function POST(req: NextRequest) {
    if (!verifyCronSecret(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return processQueue();
}
