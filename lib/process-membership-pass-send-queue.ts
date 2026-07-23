import { createClient } from '@supabase/supabase-js';
import { sendMembershipPassesBulk } from '@/lib/send-membership-pass';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export type MembershipPassQueueResult = {
    processed: number;
    results: Array<Record<string, unknown>>;
    message?: string;
};

/** Process pending scheduled ePass sends whose scheduled_at has passed. */
export async function processMembershipPassSendQueue(limit = 25): Promise<MembershipPassQueueResult> {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('Email service not configured');
    }

    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();

    const { data: jobs, error } = await supabase
        .from('membership_pass_send_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(limit);

    if (error) {
        throw new Error(error.message);
    }

    if (!jobs?.length) {
        return { processed: 0, results: [], message: 'No pending pass sends' };
    }

    const results: Array<Record<string, unknown>> = [];

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

    return { processed: results.length, results };
}
