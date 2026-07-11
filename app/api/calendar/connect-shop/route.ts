// GET /api/calendar/connect-shop?redirect=/admin
// Connect savronmn@gmail.com shop calendar — this account sends booking invites (RSVP source of truth).

import { NextRequest, NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/google-calendar';

export async function GET(request: NextRequest) {
    const redirect = request.nextUrl.searchParams.get('redirect') || '/admin';
    const state = `shop|${redirect}`;
    return NextResponse.redirect(buildAuthUrl(state));
}
