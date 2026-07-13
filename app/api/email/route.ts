import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isShopCalendarConnected } from '@/lib/shop-calendar';
import { sendBookingConfirmationEmail } from '@/lib/send-booking-email';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function bookingUsesGoogleCalendarInvite(bookingId: string): Promise<boolean> {
    const { data: booking } = await getAdmin()
        .from('bookings')
        .select('barbers(google_calendar_tokens, google_calendar_id)')
        .eq('id', bookingId)
        .single();

    const barber = Array.isArray(booking?.barbers) ? booking.barbers[0] : booking?.barbers;
    if (barber?.google_calendar_tokens && barber?.google_calendar_id) {
        return true;
    }

    return isShopCalendarConnected();
}

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
