import { NextRequest, NextResponse } from 'next/server';
import { buildMembershipEmail } from '@/lib/email-templates';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import {
    buildGoogleObjectId,
    buildGoogleSaveUrl,
    createGooglePassObject,
    isGoogleWalletConfigured,
} from '@/lib/google-wallet';
import {
    generateApplePassBuffer,
    generateWalletAuthToken,
    isAppleWalletConfigured,
} from '@/lib/apple-wallet';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function POST(req: NextRequest) {
    try {
        const resendApiKey = process.env.RESEND_API_KEY;
        if (!resendApiKey) {
            return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
        }
        const resend = new Resend(resendApiKey);

        const body = await req.json();
        const { name, email, phone } = body;
        if (!name?.trim() || !email?.trim()) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // Check if already subscribed
        const { data: existing } = await supabase
            .from('email_subscribers')
            .select('id, email')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: 'This email is already on the list.' }, { status: 409 });
        }

        const serialNumber = uuidv4();
        const googleObjectId = isGoogleWalletConfigured() ? buildGoogleObjectId() : null;
        const walletAuthToken = generateWalletAuthToken();

        // Save subscriber first
        const { data: insertedSubscriber, error: dbError } = await supabase.from('email_subscribers').insert({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone?.trim() || null,
            pass_serial_number: serialNumber,
            google_pass_object_id: null,
            wallet_auth_token: walletAuthToken,
            visit_count: 0,
        }).select('id').single();

        if (dbError) {
            console.error('DB insert failed:', JSON.stringify(dbError, null, 2));
            return NextResponse.json({
                error: 'Failed to save subscriber',
                debug: {
                    message: dbError.message,
                    code: dbError.code,
                    details: dbError.details,
                    hint: dbError.hint,
                },
            }, { status: 500 });
        }

        // Create Google Wallet pass object + generate Apple pass IN PARALLEL for speed
        let googleSaveUrl: string | null = null;

        const subscriberPayload = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
            visit_count: 0,
            pass_serial_number: serialNumber,
        };

        const [applePassBuffer, googleObjectCreated] = await Promise.all([
            isAppleWalletConfigured()
                ? Promise.resolve(generateApplePassBuffer(subscriberPayload, walletAuthToken))
                : Promise.resolve(null),
            googleObjectId
                ? createGooglePassObject(googleObjectId, name.trim(), email.toLowerCase().trim(), 0)
                : Promise.resolve(false),
        ]);

        // Only store/reference the object if Google actually created it.
        if (googleObjectId && googleObjectCreated && insertedSubscriber?.id) {
            try {
                await supabase
                    .from('email_subscribers')
                    .update({ google_pass_object_id: googleObjectId })
                    .eq('id', insertedSubscriber.id);
                googleSaveUrl = buildGoogleSaveUrl(
                    googleObjectId,
                    name.trim(),
                    email.toLowerCase().trim(),
                    0,
                );
            } catch (err) {
                console.error('[GWallet] JWT sign failed:', err);
            }
        }

        console.log('[wallet/send-email] Apple pass generated:', !!applePassBuffer, applePassBuffer ? applePassBuffer.length + ' bytes' : 'null');
        console.log('[wallet/send-email] Google save URL generated:', !!googleSaveUrl);

        // Only attach the pkpass — no logo inline (use public URL instead, avoids CID rendering bugs)
        type ResendAttachment = { filename: string; content: string; content_type: string };
        const attachments: ResendAttachment[] = [];

        if (applePassBuffer) {
            attachments.push({
                filename: `${name.trim().replace(/\s+/g, '_')}_savron_pass.pkpass`,
                content: applePassBuffer.toString('base64'),
                content_type: 'application/vnd.apple.pkpass',
            });
        }

        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://savronmn.com';
        const downloadUrl = `${baseUrl}/api/wallet/download-pass?serial=${serialNumber}`;

        const emailResult = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'noreply@savronmn.com',
            to: email.trim(),
            subject: 'SAVRON — Your Membership Pass',
            html: buildMembershipEmail(name.trim(), downloadUrl, googleSaveUrl),
            attachments: attachments as any,
        });
        console.log('[wallet/send-email] Email sent, id:', (emailResult as any)?.data?.id);

        return NextResponse.json({ success: true, message: 'Membership pass sent!' });

    } catch (error) {
        console.error('send-email route failed:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}

