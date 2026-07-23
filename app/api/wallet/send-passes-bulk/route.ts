// POST /api/wallet/send-passes-bulk
// Staff-only bulk ePass send from Communications page.
// Body: { subscriberEmails: string[], subject?: string, message?: string, sendAt?: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/staff-auth';
import { sendMembershipPassesBulk } from '@/lib/send-membership-pass';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function POST(request: NextRequest) {
    const staff = await requireStaff();
    if (!staff.ok) {
        return NextResponse.json({ error: staff.error }, { status: staff.status });
    }

    if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const body = await request.json().catch(() => ({})) as {
        subscriberEmails?: string[];
        subject?: string;
        message?: string;
        sendAt?: string;
    };

    const subscriberEmails = body.subscriberEmails ?? [];
    if (subscriberEmails.length === 0) {
        return NextResponse.json({ error: 'No ePass subscribers selected' }, { status: 400 });
    }

    const subject = body.subject?.trim() || 'SAVRON — Your Membership Pass';
    const message = body.message?.trim() || '';
    const sendAtRaw = body.sendAt?.trim();

    if (sendAtRaw) {
        const sendAt = new Date(sendAtRaw);
        if (Number.isNaN(sendAt.getTime())) {
            return NextResponse.json({ error: 'Invalid sendAt datetime' }, { status: 400 });
        }

        const minLeadMs = 60_000;
        if (sendAt.getTime() < Date.now() + minLeadMs) {
            return NextResponse.json(
                { error: 'Scheduled time must be at least 1 minute in the future' },
                { status: 400 },
            );
        }

        const supabase = getSupabaseAdmin();
        const normalizedEmails = Array.from(new Set(
            subscriberEmails.map(e => e.trim().toLowerCase()).filter(Boolean),
        ));

        const { data, error } = await supabase
            .from('membership_pass_send_queue')
            .insert({
                created_by: staff.user.id,
                created_by_email: staff.user.email ?? null,
                subject,
                message: message || null,
                subscriber_emails: normalizedEmails,
                scheduled_at: sendAt.toISOString(),
                status: 'pending',
            })
            .select('id, scheduled_at')
            .single();

        if (error) {
            console.error('[wallet/send-passes-bulk] queue insert failed:', error);
            return NextResponse.json({ error: 'Failed to schedule pass send' }, { status: 500 });
        }

        return NextResponse.json({
            scheduled: true,
            queueId: data.id,
            scheduledAt: data.scheduled_at,
            recipientCount: normalizedEmails.length,
            message: `Scheduled ePass send for ${normalizedEmails.length} member${normalizedEmails.length !== 1 ? 's' : ''}.`,
        });
    }

    try {
        const result = await sendMembershipPassesBulk(subscriberEmails, { subject, message });
        return NextResponse.json({
            scheduled: false,
            ...result,
            total: subscriberEmails.length,
            message: `Sent ${result.sent} pass${result.sent !== 1 ? 'es' : ''}${result.failed ? `, ${result.failed} failed` : ''}${result.skipped ? `, ${result.skipped} skipped` : ''}.`,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Bulk pass send failed';
        console.error('[wallet/send-passes-bulk]', err);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
