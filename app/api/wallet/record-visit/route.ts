import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAuth } from 'google-auth-library';
import { PKPass } from 'passkit-generator';
import { Resend } from 'resend';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import forge from 'node-forge';

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

function buildGoogleSaveUrl(objectId: string): string | null {
    if (!SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY) return null;
    try {
        const jwtPayload = {
            iss: SERVICE_ACCOUNT_EMAIL,
            aud: 'google',
            typ: 'savetowallet',
            iat: Math.floor(Date.now() / 1000),
            payload: { loyaltyObjects: [{ id: objectId }] },
        };
        const token = jwt.sign(jwtPayload, GOOGLE_PRIVATE_KEY, { algorithm: 'RS256' });
        return `https://pay.google.com/gp/v/save/${token}`;
    } catch {
        return null;
    }
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
    googleObjectId: string | null,
    name: string,
    email: string,
    visitCount: number
): Promise<void> {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const firstName = name.split(' ')[0];

    // Google Wallet — just reference the existing server-side object by ID
    const googleSaveUrl = googleObjectId ? buildGoogleSaveUrl(googleObjectId) : null;

    // Apple Wallet — non-fatal; send without attachment if generation fails
    let applePassBuffer: Buffer | null = null;
    try {
        const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
        const WALLET_WWDR_CERT   = process.env.WALLET_WWDR_CERT;
        const PASSPHRASE         = process.env.WALLET_PASSPHRASE;
        const PASS_TYPE_ID       = process.env.PASS_TYPE_ID;
        const TEAM_ID            = process.env.TEAM_ID;

        if (WALLET_PRIVATE_KEY && WALLET_WWDR_CERT && PASS_TYPE_ID && TEAM_ID) {
            // Decode and parse P12 private key & certificate
            const p12Buffer = Buffer.from(WALLET_PRIVATE_KEY, 'base64');
            const p12Der = p12Buffer.toString('binary');
            const p12Asn1 = forge.asn1.fromDer(p12Der);
            const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, PASSPHRASE);

            const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
            const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

            const certBag = certBags[forge.pki.oids.certBag]?.[0];
            const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

            if (!certBag || !keyBag) {
                throw new Error('Certificates or private key missing in P12 container');
            }

            const certPem = forge.pki.certificateToPem(certBag.cert!);
            const keyPem = forge.pki.privateKeyToPem(keyBag.key!);

            // Decode and parse WWDR certificate from DER to PEM
            const wwdrCert = Buffer.from(WALLET_WWDR_CERT, 'base64');
            let wwdrPem = '';
            if (wwdrCert.toString('utf-8').includes('-----BEGIN CERTIFICATE-----')) {
                wwdrPem = wwdrCert.toString('utf-8');
            } else {
                const wwdrAsn1 = forge.asn1.fromDer(wwdrCert.toString('binary'));
                const wwdrObj = forge.pki.certificateFromAsn1(wwdrAsn1);
                wwdrPem = forge.pki.certificateToPem(wwdrObj);
            }

            const logoPath  = path.join(process.cwd(), 'public', 'logo.png');
            const buffers: Record<string, Buffer> = {};
            if (fs.existsSync(logoPath)) {
                const logoBuffer = fs.readFileSync(logoPath);
                buffers['logo.png'] = logoBuffer;
                buffers['icon.png'] = logoBuffer;
            }
            const pass = new PKPass(buffers, {
                wwdr: wwdrPem,
                signerCert: certPem,
                signerKey: keyPem,
                signerKeyPassphrase: PASSPHRASE || 'dummy',
            }, {
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
            applePassBuffer = pass.getAsBuffer() as unknown as Buffer;
        }
    } catch (err) {
        console.error('Apple pass generation failed (non-fatal):', err);
    }

    // Build attachments — Resend requires base64 string content with explicit content_type
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    const logoBuffer = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
    type ResendAttachment = { filename: string; content: string; content_type: string; content_id?: string };
    const attachments: ResendAttachment[] = [];
    if (logoBuffer) attachments.push({ filename: 'logo.png', content: logoBuffer.toString('base64'), content_type: 'image/png', content_id: 'savron_logo' });
    if (applePassBuffer) attachments.push({ filename: `${name.replace(/\s+/g, '_')}_savron_pass.pkpass`, content: applePassBuffer.toString('base64'), content_type: 'application/vnd.apple.pkpass' });

    const logoSrc = logoBuffer ? 'cid:savron_logo' : 'https://savronmn.com/logo.png';
    const googleBtn = googleSaveUrl
        ? `<a href="${googleSaveUrl}" style="display:block;text-align:center;background:#0D3B4F;color:#fff;padding:14px 28px;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">Save to Google Wallet &rarr;</a>`
        : '';

    await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@savronmn.com',
        to: email,
        subject: `SAVRON — Your Updated Membership Pass (${visitCount} visit${visitCount === 1 ? '' : 's'})`,
        attachments: attachments as any,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#121212;border:1px solid rgba(255,255,255,0.08);">
        <tr><td style="background:#0D3B4F;padding:28px 32px;text-align:center;">
          <img src="${logoSrc}" alt="SAVRON" width="140" style="display:block;margin:0 auto 8px;" />
          <p style="margin:0;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;">Barbershop &amp; Lounge · Minneapolis</p>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Pass Updated</p>
          <h1 style="margin:0 0 20px;color:#fff;font-size:24px;letter-spacing:2px;text-transform:uppercase;">${firstName}, your pass has been updated.</h1>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;border:1px solid rgba(255,255,255,0.08);margin-bottom:24px;">
            <tr><td style="padding:14px 20px;">
              <span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Total Visits</span><br>
              <span style="color:#1A6A8A;font-size:22px;font-weight:700;">${visitCount} visit${visitCount === 1 ? '' : 's'}</span>
            </td></tr>
          </table>
          ${googleSaveUrl ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;border:1px solid rgba(255,255,255,0.08);margin-bottom:12px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 12px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Google Wallet</p>
              ${googleBtn}
            </td></tr>
          </table>` : ''}
          ${applePassBuffer ? `
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;border:1px solid rgba(255,255,255,0.08);margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Apple Wallet</p>
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;">Open on iPhone and tap the <strong style="color:rgba(255,255,255,0.7);">.pkpass</strong> attachment to update your pass.</p>
            </td></tr>
          </table>` : ''}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;">SAVRON · Minneapolis, MN · <a href="https://savronmn.com" style="color:rgba(255,255,255,0.3);">savronmn.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
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
                    subscriber.google_pass_object_id ?? null,
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
