import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    ensureWalletAuthToken,
    generateApplePassBuffer,
    isAppleWalletConfigured,
} from '@/lib/apple-wallet';

const PASS_TYPE_ID = process.env.PASS_TYPE_ID;

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

function getAuthToken(req: NextRequest): string | null {
    const header = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!header) return null;
    const match = header.match(/^ApplePass\s+(.+)$/i);
    return match?.[1]?.trim() ?? null;
}

async function getSubscriberBySerial(serialNumber: string) {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
        .from('email_subscribers')
        .select('id, name, email, visit_count, pass_serial_number, wallet_auth_token, pass_updated_at, active')
        .eq('pass_serial_number', serialNumber)
        .maybeSingle();
    return data;
}

function unauthorized() {
    return new NextResponse('Unauthorized', { status: 401 });
}

/** Apple PassKit Web Service — enables live Wallet pass updates after scan. */
export async function POST(
    req: NextRequest,
    { params }: { params: { path?: string[] } },
) {
    const segments = params.path ?? [];

    if (segments[0] === 'log') {
        return new NextResponse(null, { status: 200 });
    }

    // POST /v1/devices/{deviceId}/registrations/{passTypeId}/{serialNumber}
    if (
        segments[0] === 'devices'
        && segments[2] === 'registrations'
        && segments.length === 5
    ) {
        const [, deviceId, , passTypeId, serialNumber] = segments;
        if (!PASS_TYPE_ID || passTypeId !== PASS_TYPE_ID) {
            return new NextResponse('Invalid pass type', { status: 404 });
        }

        const subscriber = await getSubscriberBySerial(serialNumber);
        if (!subscriber?.active) return new NextResponse('Pass not found', { status: 404 });

        const authToken = getAuthToken(req);
        const expectedToken = subscriber.wallet_auth_token
            ?? await ensureWalletAuthToken(subscriber.id, subscriber.wallet_auth_token);

        if (!authToken || authToken !== expectedToken) return unauthorized();

        const body = await req.json().catch(() => ({}));
        const pushToken = body.pushToken as string | undefined;
        if (!pushToken) return new NextResponse('pushToken required', { status: 400 });

        const supabase = getSupabaseAdmin();
        const { data: existingRegistration } = await supabase
            .from('wallet_pass_registrations')
            .select('id')
            .eq('device_library_identifier', deviceId)
            .eq('pass_type_identifier', passTypeId)
            .eq('serial_number', serialNumber)
            .maybeSingle();

        const { error: upsertError } = await supabase.from('wallet_pass_registrations').upsert(
            {
                subscriber_id: subscriber.id,
                device_library_identifier: deviceId,
                push_token: pushToken,
                pass_type_identifier: passTypeId,
                serial_number: serialNumber,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'device_library_identifier,pass_type_identifier,serial_number' },
        );

        if (upsertError) {
            console.error('[Apple Wallet] Device registration failed:', upsertError.message);
            return new NextResponse('Registration failed', { status: 500 });
        }

        // 201 = new device registered, 200 = same device re-registered (PassKit spec).
        // Multiple phones per member each get their own device_library_identifier.
        return new NextResponse(null, { status: existingRegistration ? 200 : 201 });
    }

    return new NextResponse('Not found', { status: 404 });
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { path?: string[] } },
) {
    const segments = params.path ?? [];

    if (
        segments[0] === 'devices'
        && segments[2] === 'registrations'
        && segments.length === 5
    ) {
        const [, deviceId, , passTypeId, serialNumber] = segments;
        const subscriber = await getSubscriberBySerial(serialNumber);
        if (!subscriber) return new NextResponse(null, { status: 200 });

        const authToken = getAuthToken(req);
        if (!authToken || authToken !== subscriber.wallet_auth_token) return unauthorized();

        const supabase = getSupabaseAdmin();
        await supabase
            .from('wallet_pass_registrations')
            .delete()
            .eq('device_library_identifier', deviceId)
            .eq('pass_type_identifier', passTypeId)
            .eq('serial_number', serialNumber);

        return new NextResponse(null, { status: 200 });
    }

    return new NextResponse('Not found', { status: 404 });
}

export async function GET(
    req: NextRequest,
    { params }: { params: { path?: string[] } },
) {
    const segments = params.path ?? [];

    // GET /v1/passes/{passTypeId}/{serialNumber}
    if (segments[0] === 'passes' && segments.length === 3) {
        const [, passTypeId, serialNumber] = segments;
        if (!PASS_TYPE_ID || passTypeId !== PASS_TYPE_ID) {
            return new NextResponse('Invalid pass type', { status: 404 });
        }

        const subscriber = await getSubscriberBySerial(serialNumber);
        if (!subscriber?.active) return new NextResponse('Pass not found', { status: 404 });

        const authToken = getAuthToken(req);
        const expectedToken = subscriber.wallet_auth_token
            ?? await ensureWalletAuthToken(subscriber.id, subscriber.wallet_auth_token);
        if (!authToken || authToken !== expectedToken) return unauthorized();

        const ifModifiedSince = req.headers.get('if-modified-since');
        if (
            ifModifiedSince
            && subscriber.pass_updated_at
            && new Date(ifModifiedSince) >= new Date(subscriber.pass_updated_at)
        ) {
            return new NextResponse(null, { status: 304 });
        }

        if (!isAppleWalletConfigured()) {
            return new NextResponse('Wallet not configured', { status: 503 });
        }

        const passBuffer = generateApplePassBuffer(subscriber, expectedToken);
        if (!passBuffer) return new NextResponse('Failed to generate pass', { status: 500 });

        const headers: Record<string, string> = {
            'Content-Type': 'application/vnd.apple.pkpass',
            'Cache-Control': 'no-store',
        };
        if (subscriber.pass_updated_at) {
            headers['Last-Modified'] = new Date(subscriber.pass_updated_at).toUTCString();
        }

        return new NextResponse(passBuffer as unknown as BodyInit, { status: 200, headers });
    }

    // GET /v1/devices/{deviceId}/registrations/{passTypeId}?passesUpdatedSince={tag}
    if (
        segments[0] === 'devices'
        && segments[2] === 'registrations'
        && segments.length === 4
    ) {
        const [, deviceId, , passTypeId] = segments;
        const passesUpdatedSince = req.nextUrl.searchParams.get('passesUpdatedSince');

        const supabase = getSupabaseAdmin();
        const { data: registrations } = await supabase
            .from('wallet_pass_registrations')
            .select('serial_number, subscriber_id')
            .eq('device_library_identifier', deviceId)
            .eq('pass_type_identifier', passTypeId);

        if (!registrations?.length) {
            return new NextResponse(null, { status: 204 });
        }

        const serialNumbers: string[] = [];
        let latestUpdated = 0;

        for (const reg of registrations) {
            const { data: subscriber } = await supabase
                .from('email_subscribers')
                .select('pass_serial_number, pass_updated_at, active')
                .eq('id', reg.subscriber_id)
                .maybeSingle();

            if (!subscriber?.active) continue;

            const updatedAt = subscriber.pass_updated_at
                ? new Date(subscriber.pass_updated_at).getTime()
                : 0;
            latestUpdated = Math.max(latestUpdated, updatedAt);

            if (!passesUpdatedSince || updatedAt > new Date(passesUpdatedSince).getTime()) {
                serialNumbers.push(subscriber.pass_serial_number);
            }
        }

        if (serialNumbers.length === 0) {
            return new NextResponse(null, { status: 204 });
        }

        return NextResponse.json({
            lastUpdated: new Date(latestUpdated || Date.now()).toISOString(),
            serialNumbers,
        });
    }

    return new NextResponse('Not found', { status: 404 });
}
