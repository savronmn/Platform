import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildMembershipEmail } from '@/lib/email-templates';
import {
    ensureWalletAuthToken,
    generateApplePassBuffer,
    isAppleWalletConfigured,
} from '@/lib/apple-wallet';
import {
    buildGoogleObjectId,
    buildGoogleSaveUrl,
    createGooglePassObject,
    isGoogleWalletConfigured,
    updateGoogleWalletPass,
} from '@/lib/google-wallet';

export interface MembershipPassSubscriber {
    id: string;
    pass_serial_number: string;
    name: string;
    email: string;
    visit_count: number;
    wallet_auth_token?: string | null;
    google_pass_object_id?: string | null;
}

export interface SendMembershipPassOptions {
    subject?: string;
    message?: string;
}

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export async function sendMembershipPassEmail(
    subscriber: MembershipPassSubscriber,
    options: SendMembershipPassOptions = {},
): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
        throw new Error('Email service not configured');
    }

    const resend = new Resend(resendApiKey);
    const supabase = getSupabaseAdmin();
    const authToken = await ensureWalletAuthToken(subscriber.id, subscriber.wallet_auth_token);

    let googleObjectId = subscriber.google_pass_object_id ?? null;
    let googleSaveUrl: string | null = null;

    if (isGoogleWalletConfigured()) {
        if (!googleObjectId) {
            const newObjectId = buildGoogleObjectId();
            if (newObjectId) {
                const created = await createGooglePassObject(
                    newObjectId,
                    subscriber.name,
                    subscriber.email,
                    subscriber.visit_count,
                );
                if (created) {
                    googleObjectId = newObjectId;
                    await supabase
                        .from('email_subscribers')
                        .update({ google_pass_object_id: newObjectId })
                        .eq('id', subscriber.id);
                }
            }
        } else {
            await updateGoogleWalletPass(
                googleObjectId,
                subscriber.name,
                subscriber.email,
                subscriber.visit_count,
            );
        }

        if (googleObjectId) {
            try {
                googleSaveUrl = buildGoogleSaveUrl(
                    googleObjectId,
                    subscriber.name,
                    subscriber.email,
                    subscriber.visit_count,
                );
            } catch (err) {
                console.error('[send-membership-pass] Google JWT sign failed:', err);
            }
        }
    }

    const applePassBuffer = isAppleWalletConfigured()
        ? generateApplePassBuffer(subscriber, authToken)
        : null;

    type ResendAttachment = { filename: string; content: string; content_type: string };
    const attachments: ResendAttachment[] = [];
    if (applePassBuffer) {
        attachments.push({
            filename: `${subscriber.name.replace(/\s+/g, '_')}_savron_pass.pkpass`,
            content: applePassBuffer.toString('base64'),
            content_type: 'application/vnd.apple.pkpass',
        });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://savronmn.com';
    const downloadUrl = `${baseUrl}/api/wallet/download-pass?serial=${subscriber.pass_serial_number}`;

    await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@savronmn.com',
        to: subscriber.email,
        subject: options.subject?.trim() || 'SAVRON — Your Membership Pass',
        html: buildMembershipEmail(
            subscriber.name,
            downloadUrl,
            googleSaveUrl,
            options.message?.trim() || null,
        ),
        attachments: attachments as ResendAttachment[],
    });
}

export async function sendMembershipPassesBulk(
    subscriberEmails: string[],
    options: SendMembershipPassOptions = {},
): Promise<{ sent: number; failed: number; skipped: number; errors: string[] }> {
    const supabase = getSupabaseAdmin();
    const normalized = Array.from(new Set(
        subscriberEmails.map(e => e.trim().toLowerCase()).filter(Boolean),
    ));

    if (normalized.length === 0) {
        return { sent: 0, failed: 0, skipped: 0, errors: ['No recipient emails provided'] };
    }

    const { data: subscribers, error } = await supabase
        .from('email_subscribers')
        .select('id, pass_serial_number, name, email, visit_count, wallet_auth_token, google_pass_object_id')
        .in('email', normalized);

    if (error) {
        throw new Error(`Failed to load subscribers: ${error.message}`);
    }

    const byEmail = new Map(
        (subscribers ?? []).map(row => [row.email.toLowerCase(), row as MembershipPassSubscriber]),
    );

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const email of normalized) {
        const subscriber = byEmail.get(email);
        if (!subscriber?.pass_serial_number) {
            skipped++;
            errors.push(`${email}: not an ePass member (no pass on file)`);
            continue;
        }

        try {
            await sendMembershipPassEmail(subscriber, options);
            sent++;
        } catch (err) {
            failed++;
            errors.push(`${email}: ${err instanceof Error ? err.message : String(err)}`);
        }

        await new Promise(r => setTimeout(r, 200));
    }

    return { sent, failed, skipped, errors: errors.slice(0, 20) };
}
