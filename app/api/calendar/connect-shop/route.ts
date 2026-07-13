// GET /api/calendar/connect-shop?redirect=/admin
// Connect savronmn@gmail.com shop calendar — fallback invites when a barber calendar is not connected.

import { NextRequest, NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/google-calendar';

export async function GET(request: NextRequest) {
    const redirect = request.nextUrl.searchParams.get('redirect') || '/admin';
    const state = `shop|${redirect}`;
    return NextResponse.redirect(buildAuthUrl(state));
}
