import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildMembershipEmail } from '@/lib/email-templates';
import { syncWalletsAfterCheckin } from '@/lib/wallet-checkin';
import {
    ensureWalletAuthToken,
    generateApplePassBuffer,
    isAppleWalletConfigured,
} from '@/lib/apple-wallet';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

async function resendFullPass(subscriber: {
    id: string;
    pass_serial_number: string;
    name: string;
    email: string;
    visit_count: number;
    wallet_auth_token?: string | null;
}): Promise<void> {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const authToken = await ensureWalletAuthToken(subscriber.id, subscriber.wallet_auth_token);

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
        subject: 'SAVRON — Your Membership Pass',
        html: buildMembershipEmail(subscriber.name, downloadUrl),
        attachments: attachments as ResendAttachment[],
    });
}

export async function POST(req: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();
        const body = await req.json();
        const { subscriber_id, action } = body;

        if (!subscriber_id || !action) {
            return NextResponse.json({ error: 'subscriber_id and action required' }, { status: 400 });
        }

        const { data: subscriber, error: fetchError } = await supabase
            .from('email_subscribers')
            .select('*')
            .eq('id', subscriber_id)
            .single();

        if (fetchError || !subscriber) {
            return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 });
        }

        if (action === 'record_visit') {
            const newCount = subscriber.visit_count + 1;
            const lastVisitAt = new Date().toISOString();

            const { error: updateError } = await supabase
                .from('email_subscribers')
                .update({ visit_count: newCount, last_visit_at: lastVisitAt })
                .eq('id', subscriber_id);

            if (updateError) {
                return NextResponse.json({ error: 'Failed to update visit count' }, { status: 500 });
            }

            const walletSync = await syncWalletsAfterCheckin(subscriber, newCount, lastVisitAt);

            return NextResponse.json({
                success: true,
                visit_count: newCount,
                ...walletSync,
                google_wallet_object_id: subscriber.google_pass_object_id ?? null,
            });
        }

        if (action === 'remove_visit') {
            const newCount = Math.max(0, subscriber.visit_count - 1);

            const { error: updateError } = await supabase
                .from('email_subscribers')
                .update({ visit_count: newCount })
                .eq('id', subscriber_id);

            if (updateError) {
                return NextResponse.json({ error: 'Failed to update visit count' }, { status: 500 });
            }

            const walletSync = await syncWalletsAfterCheckin(
                subscriber,
                newCount,
                subscriber.last_visit_at ?? new Date().toISOString(),
            );

            return NextResponse.json({
                success: true,
                visit_count: newCount,
                ...walletSync,
                google_wallet_object_id: subscriber.google_pass_object_id ?? null,
            });
        }

        if (action === 'send_updated_pass') {
            try {
                await resendFullPass(subscriber);
            } catch (err) {
                console.error('Pass resend failed:', err);
                return NextResponse.json({ error: 'Failed to resend pass' }, { status: 500 });
            }

            return NextResponse.json({ success: true, message: 'Updated pass sent to ' + subscriber.email });
        }

        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    } catch (error) {
        console.error('record-visit route failed:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
