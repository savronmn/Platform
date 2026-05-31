import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAuth } from 'google-auth-library';
import { PKPass } from 'passkit-generator';
import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import { buildMembershipEmail } from '@/lib/email-templates';

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, '\n');
const CLASS_ID = process.env.GOOGLE_WALLET_CLASS_ID;

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

async function updateGoogleWalletPass(
    objectId: string,
    name: string,
    email: string,
    visitCount: number
): Promise<void> {
    if (!ISSUER_ID || !SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !CLASS_ID) return;

    const auth = new GoogleAuth({
        credentials: {
            client_email: SERVICE_ACCOUNT_EMAIL,
            private_key: GOOGLE_PRIVATE_KEY,
        },
        scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });

    const client = await auth.getClient();
    const passObject = {
        id: objectId,
        classId: CLASS_ID,
        state: 'ACTIVE',
        barcode: { type: 'QR_CODE', value: email },
        accountName: name,
        accountId: email,
        loyaltyPoints: {
            label: 'Visits',
            balance: { string: visitCount.toString() }
        }
    };

    await client.request({
        url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
        method: 'PUT',
        data: passObject,
    });
}

async function resendFullPass(
    serialNumber: string,
    name: string,
    email: string,
    visitCount: number
): Promise<void> {
    const resend = new Resend(process.env.RESEND_API_KEY!);

    // Generate updated Apple Wallet pass
    let applePassBuffer: Buffer | null = null;
    try {
        const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
        const WALLET_WWDR_CERT   = process.env.WALLET_WWDR_CERT;
        const PASSPHRASE         = process.env.WALLET_PASSPHRASE;
        const PASS_TYPE_ID       = process.env.PASS_TYPE_ID;
        const TEAM_ID            = process.env.TEAM_ID;

        if (WALLET_PRIVATE_KEY && WALLET_WWDR_CERT && PASS_TYPE_ID && TEAM_ID) {
            const p12Buffer = Buffer.from(WALLET_PRIVATE_KEY, 'base64');
            const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(p12Buffer.toString('binary')), false, PASSPHRASE);

            const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
            const keyBag  = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
            if (!certBag || !keyBag) throw new Error('P12 missing cert or key');

            const certPem = forge.pki.certificateToPem(certBag.cert!);
            const keyPem  = forge.pki.privateKeyToPem(keyBag.key!);

            const wwdrRaw = Buffer.from(WALLET_WWDR_CERT, 'base64');
            const wwdrPem = wwdrRaw.toString('utf-8').includes('-----BEGIN')
                ? wwdrRaw.toString('utf-8')
                : forge.pki.certificateToPem(forge.pki.certificateFromAsn1(forge.asn1.fromDer(wwdrRaw.toString('binary'))));

            const logoPath = path.join(process.cwd(), 'public', 'logo.png');
            const buffers: Record<string, Buffer> = {};
            if (fs.existsSync(logoPath)) {
                const logoBuffer = fs.readFileSync(logoPath);
                buffers['logo.png'] = logoBuffer;
                buffers['icon.png'] = logoBuffer;
            }

            const pass = new PKPass(buffers, { wwdr: wwdrPem, signerCert: certPem, signerKey: keyPem, signerKeyPassphrase: PASSPHRASE || 'dummy' }, {
                description: 'SAVRON Membership',
                organizationName: 'SAVRON',
                passTypeIdentifier: PASS_TYPE_ID,
                teamIdentifier: TEAM_ID,
                serialNumber,
                backgroundColor: 'rgb(20, 20, 18)',
                labelColor: 'rgb(140, 136, 128)',
                foregroundColor: 'rgb(232, 228, 220)',
                logoText: 'SAVRON',
                userInfo: { email },
            });
            pass.type = 'storeCard';
            pass.primaryFields.push({ key: 'tier', label: 'MEMBER', value: 'SAVRON MEMBER' });
            pass.secondaryFields.push({ key: 'name', label: 'NAME', value: name });
            pass.auxiliaryFields.push(
                { key: 'visits', label: 'VISITS', value: visitCount.toString() },
                { key: 'email', label: 'EMAIL', value: email, textAlignment: 'PKTextAlignmentRight' }
            );
            pass.setBarcodes({ message: email, format: 'PKBarcodeFormatQR', messageEncoding: 'iso-8859-1', altText: email });
            applePassBuffer = pass.getAsBuffer() as unknown as Buffer;
        }
    } catch (err) {
        console.error('Apple pass generation failed (non-fatal):', err);
    }

    type ResendAttachment = { filename: string; content: string; content_type: string };
    const attachments: ResendAttachment[] = [];
    if (applePassBuffer) {
        attachments.push({
            filename: `${name.replace(/\s+/g, '_')}_savron_pass.pkpass`,
            content: applePassBuffer.toString('base64'),
            content_type: 'application/vnd.apple.pkpass',
        });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://savronmn.com';
    const downloadUrl = `${baseUrl}/api/wallet/download-pass?serial=${serialNumber}`;

    await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@savronmn.com',
        to: email,
        subject: 'SAVRON — Your Membership Pass',
        html: buildMembershipEmail(name, downloadUrl),
        attachments: attachments as any,
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

            const { error: updateError } = await supabase
                .from('email_subscribers')
                .update({
                    visit_count: newCount,
                    last_visit_at: new Date().toISOString(),
                })
                .eq('id', subscriber_id);

            if (updateError) {
                return NextResponse.json({ error: 'Failed to update visit count' }, { status: 500 });
            }

            // Update Google Wallet pass live on device
            if (subscriber.google_pass_object_id) {
                try {
                    await updateGoogleWalletPass(
                        subscriber.google_pass_object_id,
                        subscriber.name,
                        subscriber.email,
                        newCount
                    );
                } catch (err) {
                    console.error('Google Wallet update failed (non-fatal):', err);
                }
            }

            return NextResponse.json({ success: true, visit_count: newCount });
        }

        if (action === 'remove_visit') {
            const newCount = Math.max(0, subscriber.visit_count - 1);

            const { error: updateError } = await supabase
                .from('email_subscribers')
                .update({
                    visit_count: newCount,
                })
                .eq('id', subscriber_id);

            if (updateError) {
                return NextResponse.json({ error: 'Failed to update visit count' }, { status: 500 });
            }

            // Update Google Wallet pass live on device
            if (subscriber.google_pass_object_id) {
                try {
                    await updateGoogleWalletPass(
                        subscriber.google_pass_object_id,
                        subscriber.name,
                        subscriber.email,
                        newCount
                    );
                } catch (err) {
                    console.error('Google Wallet update failed (non-fatal):', err);
                }
            }

            return NextResponse.json({ success: true, visit_count: newCount });
        }

        if (action === 'send_updated_pass') {
            try {
                await resendFullPass(
                    subscriber.pass_serial_number,
                    subscriber.name,
                    subscriber.email,
                    subscriber.visit_count
                );
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
