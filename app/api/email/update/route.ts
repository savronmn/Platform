import { NextRequest, NextResponse } from 'next/server';
import { bookingUsesGoogleCalendarInvite } from '@/lib/booking-calendar-invite';
import { sendBookingUpdateEmail } from '@/lib/send-booking-email';
import { requireStaff } from '@/lib/staff-auth';

export async function POST(request: NextRequest) {
    const staff = await requireStaff();
    if (!staff.ok) {
        return NextResponse.json({ error: staff.error }, { status: staff.status });
    }

    const { bookingId } = await request.json() as { bookingId?: string };

    if (!bookingId) {
        return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    if (await bookingUsesGoogleCalendarInvite(bookingId)) {
        return NextResponse.json({
            skipped: true,
            reason: 'google_calendar_invite',
            message: 'Client receives an updated Google Calendar invitation from their barber or SAVRON',
        });
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
