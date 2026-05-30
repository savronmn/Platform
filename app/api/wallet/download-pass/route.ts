import { NextRequest, NextResponse } from 'next/server';
import { PKPass } from 'passkit-generator';
import { createClient } from '@supabase/supabase-js';
import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
const WALLET_WWDR_CERT = process.env.WALLET_WWDR_CERT;
const PASSPHRASE = process.env.WALLET_PASSPHRASE;
const PASS_TYPE_ID = process.env.PASS_TYPE_ID;
const TEAM_ID = process.env.TEAM_ID;

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

export async function GET(req: NextRequest) {
    const serial = req.nextUrl.searchParams.get('serial');
    if (!serial) {
        return new NextResponse('Missing serial', { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: subscriber } = await supabase
        .from('email_subscribers')
        .select('name, email, visit_count, pass_serial_number')
        .eq('pass_serial_number', serial)
        .single();

    if (!subscriber) {
        return new NextResponse('Pass not found', { status: 404 });
    }

    if (!WALLET_PRIVATE_KEY || !WALLET_WWDR_CERT || !PASS_TYPE_ID || !TEAM_ID) {
        return new NextResponse('Wallet not configured', { status: 503 });
    }

    try {
        const p12Buffer = Buffer.from(WALLET_PRIVATE_KEY, 'base64');
        const p12Asn1 = forge.asn1.fromDer(p12Buffer.toString('binary'));
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, PASSPHRASE);

        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
        const certBag = certBags[forge.pki.oids.certBag]?.[0];
        const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

        if (!certBag || !keyBag) throw new Error('Certs missing');

        const certPem = forge.pki.certificateToPem(certBag.cert!);
        const keyPem = forge.pki.privateKeyToPem(keyBag.key!);

        const wwdrBytes = Buffer.from(WALLET_WWDR_CERT, 'base64');
        let wwdrPem: string;
        if (wwdrBytes.toString('utf-8').includes('-----BEGIN CERTIFICATE-----')) {
            wwdrPem = wwdrBytes.toString('utf-8');
        } else {
            const wwdrAsn1 = forge.asn1.fromDer(wwdrBytes.toString('binary'));
            wwdrPem = forge.pki.certificateToPem(forge.pki.certificateFromAsn1(wwdrAsn1));
        }

        const buffers: Record<string, Buffer> = {};
        const logoPath = path.join(process.cwd(), 'public', 'logo.png');
        if (fs.existsSync(logoPath)) {
            const logo = fs.readFileSync(logoPath);
            buffers['logo.png'] = logo;
            buffers['icon.png'] = logo;
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
            serialNumber: subscriber.pass_serial_number,
            backgroundColor: 'rgb(20, 20, 18)',
            labelColor: 'rgb(140, 136, 128)',
            foregroundColor: 'rgb(232, 228, 220)',
            logoText: 'SAVRON',
            userInfo: { email: subscriber.email },
        });

        pass.type = 'storeCard';
        pass.primaryFields.push({ key: 'tier', label: 'MEMBER', value: 'SAVRON MEMBER' });
        pass.secondaryFields.push({ key: 'name', label: 'NAME', value: subscriber.name });
        pass.auxiliaryFields.push(
            { key: 'visits', label: 'VISITS', value: subscriber.visit_count.toString() },
            { key: 'email', label: 'EMAIL', value: subscriber.email, textAlignment: 'PKTextAlignmentRight' }
        );
        pass.setBarcodes({
            message: subscriber.email,
            format: 'PKBarcodeFormatQR',
            messageEncoding: 'iso-8859-1',
            altText: subscriber.email,
        });

        const passBuffer = pass.getAsBuffer() as unknown as Buffer;
        const safeName = subscriber.name.replace(/\s+/g, '_');

        return new NextResponse(passBuffer as unknown as BodyInit, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.apple.pkpass',
                'Content-Disposition': `attachment; filename="${safeName}_savron.pkpass"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err) {
        console.error('Pass generation failed:', err);
        return new NextResponse('Failed to generate pass', { status: 500 });
    }
}
