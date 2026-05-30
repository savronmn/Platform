import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleAuth } from 'google-auth-library';

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
        credentials: { client_email: SERVICE_ACCOUNT_EMAIL, private_key: GOOGLE_PRIVATE_KEY },
        scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });
    const client = await auth.getClient();
    await client.request({
        url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
        method: 'PUT',
        data: {
            id: objectId,
            classId: CLASS_ID,
            state: 'ACTIVE',
            barcode: { type: 'QR_CODE', value: email },
            accountName: name,
            accountId: email,
            loyaltyPoints: { label: 'Visits', balance: { string: visitCount.toString() } },
        },
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { qrValue } = body as { qrValue: string };

        if (!qrValue || typeof qrValue !== 'string') {
            return NextResponse.json({ error: 'qrValue required' }, { status: 400 });
        }

        const email = qrValue.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json({ error: 'Invalid QR code — not a valid ePass' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const { data: subscriber, error: fetchErr } = await supabase
            .from('email_subscribers')
            .select('*')
            .eq('email', email)
            .eq('active', true)
            .single();

        if (fetchErr || !subscriber) {
            return NextResponse.json({ error: 'Pass not found', scanned: email }, { status: 404 });
        }

        const newCount = subscriber.visit_count + 1;

        const { error: updateErr } = await supabase
            .from('email_subscribers')
            .update({ visit_count: newCount, last_visit_at: new Date().toISOString() })
            .eq('id', subscriber.id);

        if (updateErr) {
            return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 });
        }

        if (subscriber.google_pass_object_id) {
            updateGoogleWalletPass(
                subscriber.google_pass_object_id,
                subscriber.name,
                subscriber.email,
                newCount
            ).catch(err => console.error('Google Wallet update failed (non-fatal):', err));
        }

        return NextResponse.json({
            success: true,
            subscriber: {
                id: subscriber.id,
                name: subscriber.name,
                email: subscriber.email,
                visit_count: newCount,
                last_visit_at: new Date().toISOString(),
            },
        });
    } catch (err) {
        console.error('scan-checkin failed:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
