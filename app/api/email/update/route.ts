import { NextRequest, NextResponse } from 'next/server';
import { sendBookingUpdateEmail } from '@/lib/send-booking-email';

export async function POST(request: NextRequest) {
    const { bookingId } = await request.json() as { bookingId?: string };

    if (!bookingId) {
        return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    const result = await sendBookingUpdateEmail(bookingId);
    if (result.skipped) {
        return NextResponse.json({ skipped: true, reason: result.reason });
    }
    if (!result.success) {
        return NextResponse.json({ error: 'Email failed', detail: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
