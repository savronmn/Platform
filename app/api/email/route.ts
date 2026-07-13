import { NextRequest, NextResponse } from 'next/server';
import { bookingUsesGoogleCalendarInvite } from '@/lib/booking-calendar-invite';
import { sendBookingConfirmationEmail } from '@/lib/send-booking-email';

export async function POST(request: NextRequest) {
  const { bookingId } = await request.json() as { bookingId?: string };

  if (!bookingId) {
    return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
  }

  if (await bookingUsesGoogleCalendarInvite(bookingId)) {
    return NextResponse.json({
      skipped: true,
      reason: 'google_calendar_invite',
      message: 'Client receives a Google Calendar appointment invitation from their barber or SAVRON',
    });
  }

  const result = await sendBookingConfirmationEmail(bookingId);
  if (result.skipped) {
    return NextResponse.json({ skipped: true, reason: result.reason });
  }
  if (!result.success) {
    return NextResponse.json({ error: 'Email failed', detail: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
