import { PKPass } from 'passkit-generator';
import fs from 'fs';
import path from 'path';
import http2 from 'http2';
import forge from 'node-forge';
import { createClient } from '@supabase/supabase-js';

const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const WALLET_WWDR_CERT = process.env.WALLET_WWDR_CERT;
const PASSPHRASE = process.env.WALLET_PASSPHRASE;
const PASS_TYPE_ID = process.env.PASS_TYPE_ID;
const TEAM_ID = process.env.TEAM_ID;

export interface ApplePassSubscriber {
    name: string;
    email: string;
    visit_count: number;
    pass_serial_number: string;
    wallet_auth_token?: string | null;
    pass_updated_at?: string | null;
}

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

export function isAppleWalletConfigured(): boolean {
    return !!(WALLET_PRIVATE_KEY && WALLET_WWDR_CERT && PASS_TYPE_ID && TEAM_ID);
}

export function getWalletWebServiceBaseUrl(): string | null {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (!baseUrl) return null;
    return `${baseUrl.replace(/\/$/, '')}/api/wallet/apple/`;
}

function loadSignerMaterials(): {
    wwdrPem: string;
    certPem: string;
    keyPem: string;
    p12Buffer: Buffer;
} | null {
    if (!isAppleWalletConfigured()) return null;

    try {
        const p12Buffer = Buffer.from(WALLET_PRIVATE_KEY!, 'base64');
        const p12 = forge.pkcs12.pkcs12FromAsn1(
            forge.asn1.fromDer(p12Buffer.toString('binary')),
            false,
            PASSPHRASE,
        );

        const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
        const keyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
        if (!certBag || !keyBag) return null;

        const certPem = forge.pki.certificateToPem(certBag.cert!);
        const keyPem = forge.pki.privateKeyToPem(keyBag.key!);

        const wwdrRaw = Buffer.from(WALLET_WWDR_CERT!, 'base64');
        const wwdrPem = wwdrRaw.toString('utf-8').includes('-----BEGIN')
            ? wwdrRaw.toString('utf-8')
            : forge.pki.certificateToPem(
                forge.pki.certificateFromAsn1(forge.asn1.fromDer(wwdrRaw.toString('binary'))),
            );

        return { wwdrPem, certPem, keyPem, p12Buffer };
    } catch (err) {
        console.error('[Apple Wallet] Failed to load signer materials:', err);
        return null;
    }
}

export function generateWalletAuthToken(): string {
    return forge.util.bytesToHex(forge.random.getBytesSync(32));
}

export async function ensureWalletAuthToken(subscriberId: string, existing?: string | null): Promise<string> {
    if (existing) return existing;

    const token = generateWalletAuthToken();
    const supabase = getSupabaseAdmin();
    await supabase
        .from('email_subscribers')
        .update({ wallet_auth_token: token })
        .eq('id', subscriberId);

    return token;
}

export async function touchPassUpdatedAt(subscriberId: string): Promise<string> {
    const updatedAt = new Date().toISOString();
    const supabase = getSupabaseAdmin();
    await supabase
        .from('email_subscribers')
        .update({ pass_updated_at: updatedAt })
        .eq('id', subscriberId);
    return updatedAt;
}

export function generateApplePassBuffer(
    subscriber: ApplePassSubscriber,
    authToken?: string | null,
): Buffer | null {
    const materials = loadSignerMaterials();
    if (!materials) return null;

    try {
        const buffers: Record<string, Buffer> = {};
        const logoPath = path.join(process.cwd(), 'public', 'logo.png');
        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath);
            buffers['logo.png'] = logoBuffer;
            buffers['icon.png'] = logoBuffer;
        }

        const passProps: Record<string, string> = {
            description: 'SAVRON Membership',
            organizationName: 'SAVRON',
            passTypeIdentifier: PASS_TYPE_ID!,
            teamIdentifier: TEAM_ID!,
            serialNumber: subscriber.pass_serial_number,
            backgroundColor: 'rgb(20, 20, 18)',
            labelColor: 'rgb(140, 136, 128)',
            foregroundColor: 'rgb(232, 228, 220)',
            logoText: 'SAVRON',
        };

        const webServiceUrl = getWalletWebServiceBaseUrl();
        if (webServiceUrl && authToken) {
            passProps.webServiceURL = webServiceUrl;
            passProps.authenticationToken = authToken;
        }

        const pass = new PKPass(
            buffers,
            {
                wwdr: materials.wwdrPem,
                signerCert: materials.certPem,
                signerKey: materials.keyPem,
                signerKeyPassphrase: PASSPHRASE || 'dummy',
            },
            passProps,
        );

        pass.type = 'storeCard';
        pass.primaryFields.push({ key: 'tier', label: 'MEMBER', value: 'SAVRON MEMBER' });
        pass.secondaryFields.push({ key: 'name', label: 'NAME', value: subscriber.name });
        pass.auxiliaryFields.push(
            { key: 'visits', label: 'VISITS', value: subscriber.visit_count.toString() },
            { key: 'email', label: 'EMAIL', value: subscriber.email, textAlignment: 'PKTextAlignmentRight' },
        );
        pass.setBarcodes({
            message: subscriber.email,
            format: 'PKBarcodeFormatQR',
            messageEncoding: 'iso-8859-1',
            altText: subscriber.email,
        });

        return pass.getAsBuffer() as unknown as Buffer;
    } catch (err) {
        console.error('[Apple Wallet] Pass generation failed:', err);
        return null;
    }
}

function sendApnsPassUpdate(pushToken: string, p12Buffer: Buffer): Promise<boolean> {
    return new Promise((resolve) => {
        const host = process.env.APNS_USE_SANDBOX === 'true'
            ? 'https://api.sandbox.push.apple.com'
            : 'https://api.push.apple.com';

        const client = http2.connect(host, {
            pfx: p12Buffer,
            passphrase: PASSPHRASE,
        });

        client.on('error', (err) => {
            console.warn('[Apple Wallet] APNs connection error:', err);
            client.close();
            resolve(false);
        });

        const req = client.request({
            ':method': 'POST',
            ':path': `/3/device/${pushToken}`,
            'apns-topic': PASS_TYPE_ID!,
            'apns-push-type': 'background',
            'content-type': 'application/json',
        });

        req.on('response', (headers) => {
            const status = headers[':status'];
            resolve(status === 200);
        });

        req.on('error', (err) => {
            console.warn('[Apple Wallet] APNs request error:', err);
            resolve(false);
        });

        req.end('{}');
        req.on('close', () => client.close());
    });
}

/** Notify registered Apple Wallet devices to pull the latest pass. */
export async function pushApplePassUpdates(serialNumber: string): Promise<number> {
    if (!isAppleWalletConfigured()) return 0;

    const materials = loadSignerMaterials();
    if (!materials) return 0;

    const supabase = getSupabaseAdmin();
    const { data: registrations } = await supabase
        .from('wallet_pass_registrations')
        .select('push_token')
        .eq('serial_number', serialNumber);

    if (!registrations?.length) return 0;

    let pushed = 0;
    for (const reg of registrations) {
        const ok = await sendApnsPassUpdate(reg.push_token, materials.p12Buffer);
        if (ok) pushed++;
    }

    return pushed;
}

export async function notifyWalletPassesUpdated(
    subscriberId: string,
    serialNumber: string,
): Promise<{ pass_updated_at: string; apple_devices_notified: number }> {
    const pass_updated_at = await touchPassUpdatedAt(subscriberId);
    const apple_devices_notified = await pushApplePassUpdates(serialNumber);
    return { pass_updated_at, apple_devices_notified };
}
