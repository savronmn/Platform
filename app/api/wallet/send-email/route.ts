import { NextRequest, NextResponse } from 'next/server';
import { PKPass } from 'passkit-generator';
import { v4 as uuidv4 } from 'uuid';
import { Resend } from 'resend';
import jwt from 'jsonwebtoken';
import { GoogleAuth } from 'google-auth-library';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import forge from 'node-forge';

const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const WALLET_WWDR_CERT = process.env.WALLET_WWDR_CERT;
const PASSPHRASE = process.env.WALLET_PASSPHRASE;
const PASS_TYPE_ID = process.env.PASS_TYPE_ID;
const TEAM_ID = process.env.TEAM_ID;

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

// Ensure the LoyaltyClass exists in Google Wallet (required before creating objects)
let classEnsured = false;
async function ensureGooglePassClass(): Promise<boolean> {
    if (classEnsured) return true;
    if (!ISSUER_ID || !SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !CLASS_ID) return false;

    const auth = new GoogleAuth({
        credentials: { client_email: SERVICE_ACCOUNT_EMAIL, private_key: GOOGLE_PRIVATE_KEY },
        scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });
    const client = await auth.getClient();

    // Check if class already exists
    try {
        await client.request({
            url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${encodeURIComponent(CLASS_ID)}`,
            method: 'GET',
        });
        console.log('[GWallet] Class confirmed:', CLASS_ID);
        classEnsured = true;
        return true;
    } catch (err: any) {
        if (err?.response?.status !== 404) {
            console.error('[GWallet] Class GET failed (status', err?.response?.status, '):', JSON.stringify(err?.response?.data || err));
            // Auth error or unexpected failure — do NOT mark as ensured; log and abort
            return false;
        }
    }

    // Class doesn't exist (404) — create it
    try {
        await client.request({
            url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass`,
            method: 'POST',
            data: {
                id: CLASS_ID,
                issuerName: 'SAVRON Barbershop & Lounge',
                reviewStatus: 'DRAFT',
                programName: 'SAVRON Members Club'
            },
        });
        console.log('[GWallet] Class created:', CLASS_ID);
        classEnsured = true;
        return true;
    } catch (err: any) {
        console.error('[GWallet] Class POST failed (status', err?.response?.status, '):', JSON.stringify(err?.response?.data || err));
        return false;
    }
}

async function createGooglePassObject(
    objectId: string,
    name: string,
    email: string,
    visitCount: number
): Promise<boolean> {
    if (!ISSUER_ID || !SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !CLASS_ID) return false;

    const classOk = await ensureGooglePassClass();
    if (!classOk) {
        console.error('[GWallet] Skipping object creation — class not available');
        return false;
    }

    const auth = new GoogleAuth({
        credentials: {
            client_email: SERVICE_ACCOUNT_EMAIL,
            private_key: GOOGLE_PRIVATE_KEY,
        },
        scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });

    const client = await auth.getClient();
    const passObject = buildGooglePassObject(objectId, name, email, visitCount);

    try {
        await client.request({
            url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject`,
            method: 'POST',
            data: passObject,
        });
        console.log('[GWallet] Object created:', objectId);
        return true;
    } catch (err: any) {
        if (err?.response?.status === 409) {
            await client.request({
                url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
                method: 'PATCH',
                data: passObject,
            });
            console.log('[GWallet] Object patched (409→patch):', objectId);
            return true;
        }
        console.error('[GWallet] Object POST failed (status', err?.response?.status, '):', JSON.stringify(err?.response?.data || err));
        return false;
    }
}

function buildGooglePassObject(
    objectId: string,
    name: string,
    email: string,
    visitCount: number
) {
    return {
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
}

// After creating the server-side object, the JWT must only REFERENCE it by ID.
// Embedding the full object causes a 409 (already exists) error when the user taps "Save".
function buildGoogleSaveUrl(objectId: string): string {
    const jwtPayload = {
        iss: SERVICE_ACCOUNT_EMAIL,
        aud: 'google',
        typ: 'savetowallet',
        iat: Math.floor(Date.now() / 1000),
        payload: { loyaltyObjects: [{ id: objectId }] },
    };
    const token = jwt.sign(jwtPayload, GOOGLE_PRIVATE_KEY!, { algorithm: 'RS256' });
    return `https://pay.google.com/gp/v/save/${token}`;
}

async function generateApplePass(
    serialNumber: string,
    name: string,
    email: string,
    visitCount: number
): Promise<Buffer | null> {
    if (!WALLET_PRIVATE_KEY || !WALLET_WWDR_CERT || !PASS_TYPE_ID || !TEAM_ID) return null;
    try {
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

        const buffers: Record<string, Buffer> = {};
        const logoPath = path.join(process.cwd(), 'public', 'logo.png');
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

        return pass.getAsBuffer() as unknown as Buffer;
    } catch (err) {
        console.error('Apple pass generation failed:', err);
        return null;
    }
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
        const googleObjectId = `${ISSUER_ID}.${uuidv4().replace(/-/g, '')}`;

        // Save subscriber first
        const { error: dbError } = await supabase.from('email_subscribers').insert({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone?.trim() || null,
            pass_serial_number: serialNumber,
            google_pass_object_id: googleObjectId,
            visit_count: 0,
        });

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
        const canGoogle = !!(ISSUER_ID && SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY && CLASS_ID);

        const [applePassBuffer, googleObjectCreated] = await Promise.all([
            generateApplePass(serialNumber, name.trim(), email.trim(), 0),
            canGoogle
                ? createGooglePassObject(googleObjectId, name.trim(), email.toLowerCase().trim(), 0)
                : Promise.resolve(false),
        ]);

        // Only generate the save URL if the server-side object was actually created.
        // If the object doesn't exist, the URL will fail when the user taps "Save".
        if (googleObjectCreated) {
            try {
                googleSaveUrl = buildGoogleSaveUrl(googleObjectId);
            } catch (err) {
                console.error('[GWallet] JWT sign failed:', err);
            }
        }

        // Build attachments: logo (inline) + Apple pass (if generated)
        const logoPath = path.join(process.cwd(), 'public', 'logo.png');
        const logoBuffer = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;

        const attachments: Array<{ filename: string; content: Buffer; content_id?: string }> = [];
        
        // Inline logo for email header
        if (logoBuffer) {
            attachments.push({
                filename: 'logo.png',
                content: logoBuffer,
                content_id: 'savron_logo',
            });
        }

        // Apple Wallet pass
        if (applePassBuffer) {
            attachments.push({
                filename: `${name.trim().replace(/\s+/g, '_')}_savron_pass.pkpass`,
                content: applePassBuffer,
            });
        }

        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'noreply@savronmn.com',
            to: email.trim(),
            subject: 'SAVRON — Your Membership Pass',
            html: buildEmailHtml(name.trim(), googleSaveUrl, !!logoBuffer),
            attachments,
        });

        return NextResponse.json({ success: true, message: 'Membership pass sent!' });

    } catch (error) {
        console.error('send-email route failed:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : String(error),
        }, { status: 500 });
    }
}

function buildEmailHtml(name: string, googleSaveUrl: string | null, hasInlineLogo: boolean = false): string {
    const firstName = name.split(' ')[0];
    const logoSrc = hasInlineLogo ? 'cid:savron_logo' : 'https://savronmn.com/logo.png';

    const googleBtn = googleSaveUrl
        ? `<a href="${googleSaveUrl}" style="display:block;text-align:center;background:#0D3B4F;color:#fff;padding:14px 28px;text-decoration:none;font-family:Arial,sans-serif;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">Save to Google Wallet &rarr;</a>`
        : '';

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#121212;border:1px solid rgba(255,255,255,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0D3B4F;padding:28px 32px;text-align:center;">
            <img src="${logoSrc}" alt="SAVRON" width="160" style="display:block;margin:0 auto 8px;max-width:160px;height:auto;" />
            <p style="margin:0;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;">Barbershop &amp; Lounge · Minneapolis</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Access Confirmed</p>
            <h1 style="margin:0 0 28px;color:#fff;font-size:26px;letter-spacing:2px;text-transform:uppercase;">Your pass is ready, ${firstName}.</h1>

            <p style="margin:0 0 28px;color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7;">
              Your SAVRON membership pass has been issued. Save it to your wallet — it tracks your visits automatically and stays with you, quiet and precise.
            </p>

            <!-- Member info card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;border:1px solid rgba(255,255,255,0.08);margin-bottom:28px;">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Member</span><br>
                  <span style="color:#fff;font-size:15px;">${name}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;">
                  <span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Status</span><br>
                  <span style="color:#1A6A8A;font-size:18px;font-weight:700;">ACTIVE MEMBER</span>
                </td>
              </tr>
            </table>

            <!-- Apple Wallet -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;border:1px solid rgba(255,255,255,0.08);margin-bottom:8px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Apple Wallet</p>
                  <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;line-height:1.7;">
                    Open this email on your iPhone and tap the <strong style="color:rgba(255,255,255,0.7);">.pkpass</strong> attachment below to add directly to Apple Wallet.
                  </p>
                </td>
              </tr>
            </table>

            ${googleSaveUrl ? `
            <!-- Google Wallet -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;border:1px solid rgba(255,255,255,0.08);margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 12px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Google Wallet</p>
                  ${googleBtn}
                </td>
              </tr>
            </table>
            ` : ''}

            <p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;">
              Your pass will update automatically each time you visit. Welcome to SAVRON.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;letter-spacing:1px;">
              SAVRON Barbershop &amp; Lounge · Minneapolis, MN · <a href="https://savronmn.com" style="color:rgba(255,255,255,0.3);">savronmn.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
