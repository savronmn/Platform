// GET /api/calendar/connect?barberId=xxx
// Redirects the barber to Google OAuth with their ID as state param

import { NextRequest, NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/google-calendar';

export async function GET(request: NextRequest) {
    const barberId = request.nextUrl.searchParams.get('barberId');
    const redirect = request.nextUrl.searchParams.get('redirect') || '/barber';
    const login = request.nextUrl.searchParams.get('login') === '1';
    if (!barberId) {
        return NextResponse.json({ error: 'Missing barberId' }, { status: 400 });
    }
    const state = login ? `${barberId}|${redirect}|login` : `${barberId}|${redirect}`;
    const authUrl = buildAuthUrl(state, { includeLoginScopes: login });
    return NextResponse.redirect(authUrl);
}
