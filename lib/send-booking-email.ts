import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { buildBookingIcs } from '@/lib/booking-ics';
import {
    bookingCancelEmailBlock,
    buildBookingCancelUrl,
    CLIENT_CANCEL_EMAIL_MARKER,
} from '@/lib/booking-cancel-link';
import {
    RESEND_BOOKING_FROM,
    RESEND_BOOKING_FROM_NAME,
    SHOP_ADDRESS,
    SHOP_CALENDAR_DISPLAY_NAME,
    SHOP_CALENDAR_EMAIL,
    SHOP_NAME,
} from '@/lib/shop';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface SendBookingEmailResult {
    success: boolean;
    skipped?: boolean;
    reason?: string;
    error?: string;
}

async function sendResendEmail(payload: {
    to: string;
    subject: string;
    html: string;
    icsContent?: string;
    icsMethod?: 'PUBLISH' | 'CANCEL';
}): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
        throw new Error('Email service not configured');
    }

    const body: Record<string, unknown> = {
        from: `${RESEND_BOOKING_FROM_NAME} <${RESEND_BOOKING_FROM}>`,
        reply_to: RESEND_BOOKING_FROM,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
    };

    if (payload.icsContent) {
        body.attachments = [{
            filename: payload.icsMethod === 'CANCEL' ? 'appointment-cancel.ics' : 'appointment.ics',
            content: Buffer.from(payload.icsContent).toString('base64'),
            contentType: `text/calendar; charset=utf-8; method=${payload.icsMethod ?? 'PUBLISH'}`,
        }];
    }

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        throw new Error(await res.text());
    }
}

async function loadBooking(bookingId: string) {
    const { data: booking } = await getAdmin()
        .from('bookings')
        .select('*, barbers(name, email)')
        .eq('id', bookingId)
        .single();
    return booking;
}

function formatBookingDate(date: string): string {
    try {
        return format(new Date(date), 'EEEE, MMMM d, yyyy');
    } catch {
        return date;
    }
}

export async function sendBookingConfirmationEmail(bookingId: string): Promise<SendBookingEmailResult> {
    const booking = await loadBooking(bookingId);
    if (!booking) return { success: false, error: 'Booking not found' };
    if (!booking.client_email) return { success: true, skipped: true, reason: 'no_email' };

    const barber = booking.barbers as { name: string; email: string | null } | null;
    const barberName = barber?.name ?? booking.barber_name ?? 'Your barber';
    const barberEmail = barber?.email ?? null;
    const dateFormatted = formatBookingDate(booking.date);
    const cancelUrl = buildBookingCancelUrl(booking);
    const clientCancelBlock = bookingCancelEmailBlock(cancelUrl);

    const calendarNote = `<p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;">
              This confirmation is from <strong style="color:#fff;">${RESEND_BOOKING_FROM}</strong> (${SHOP_CALENDAR_DISPLAY_NAME}).
              Your appointment is held on the shop calendar under
              <strong style="color:#fff;">${SHOP_CALENDAR_EMAIL}</strong>.
              Open the attached <strong style="color:#fff;">appointment.ics</strong> to add it to your personal calendar.
            </p>`;

    const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#121212;border:1px solid rgba(255,255,255,0.08);">
        <tr>
          <td style="background:#125470;padding:28px 32px;text-align:center;">
            <img src="https://savronmn.com/logo.png" alt="SAVRON" width="160" style="display:block;margin:0 auto 8px;max-width:160px;height:auto;" />
            <p style="margin:0;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;">Barbershop &amp; Lounge · Minneapolis</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Booking Confirmed</p>
            <h1 style="margin:0 0 28px;color:#fff;font-size:26px;letter-spacing:2px;text-transform:uppercase;">You're all set, ${booking.client_name?.split(' ')[0] ?? 'friend'}.</h1>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;border:1px solid rgba(255,255,255,0.08);margin-bottom:20px;">
              <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Service</span><br><span style="color:#fff;font-size:15px;">${booking.service}</span></td></tr>
              <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Barber</span><br><span style="color:#fff;font-size:15px;">${barberName}</span></td></tr>
              <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Date</span><br><span style="color:#fff;font-size:15px;">${dateFormatted}</span></td></tr>
              <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Time</span><br><span style="color:#fff;font-size:15px;">${booking.time}</span></td></tr>
              ${booking.price ? `<tr><td style="padding:14px 20px;${booking.notes ? 'border-bottom:1px solid rgba(255,255,255,0.05);' : ''}"><span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Total</span><br><span style="color:#1A6A8A;font-size:18px;font-weight:700;">${booking.price}</span></td></tr>` : ''}
              ${booking.notes ? `<tr><td style="padding:14px 20px;"><span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Note for your barber</span><br><span style="color:rgba(255,255,255,0.85);font-size:14px;line-height:1.6;font-style:italic;">"${String(booking.notes).replace(/</g, '&lt;')}"</span></td></tr>` : ''}
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#125470;margin-bottom:28px;">
              <tr><td style="padding:18px 20px;">
                <p style="margin:0 0 4px;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;">Location</p>
                <p style="margin:0;color:#fff;font-size:14px;font-weight:600;">SAVRON Barbershop &amp; Lounge</p>
                <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;"><a href="https://maps.google.com/?q=250+N+Third+Avenue,+Minneapolis,+MN+55401" style="color:rgba(255,255,255,0.75);text-decoration:none;">${SHOP_ADDRESS}</a></p>
              </td></tr>
            </table>
            ${clientCancelBlock}
            ${calendarNote}
            <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;">We&rsquo;ll see you soon.</p>
          </td>
        </tr>
        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);">
          <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;">SAVRON · <a href="https://savronmn.com" style="color:rgba(255,255,255,0.3);">savronmn.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    const icsString = buildBookingIcs(booking, barberName, { method: 'PUBLISH', sequence: 0 });

    try {
        await sendResendEmail({
            to: booking.client_email,
            subject: `Your appointment is confirmed — ${booking.time}, ${dateFormatted}`,
            html: htmlBody,
            icsContent: icsString,
            icsMethod: 'PUBLISH',
        });

        if (barberEmail) {
            const barberHtml = htmlBody
                .replace(CLIENT_CANCEL_EMAIL_MARKER, '')
                .replace("You're all set,", 'New booking — ')
                .replace(booking.client_name?.split(' ')[0] ?? 'friend', booking.client_name || 'Walk-in');

            await sendResendEmail({
                to: barberEmail,
                subject: `New booking: ${booking.client_name || 'Walk-in'} — ${booking.time}, ${dateFormatted}`,
                html: barberHtml,
                icsContent: icsString,
                icsMethod: 'PUBLISH',
            });
        }

        return { success: true };
    } catch (error) {
        console.error('[send-booking-email] confirmation failed:', error);
        return { success: false, error: String(error) };
    }
}

export async function sendBookingUpdateEmail(bookingId: string): Promise<SendBookingEmailResult> {
    const booking = await loadBooking(bookingId);
    if (!booking) return { success: false, error: 'Booking not found' };
    if (!booking.client_email) return { success: true, skipped: true, reason: 'no_email' };

    const barber = booking.barbers as { name: string; email: string | null } | null;
    const barberName = barber?.name ?? booking.barber_name ?? 'Your barber';
    const barberEmail = barber?.email ?? null;
    const dateFormatted = formatBookingDate(booking.date);
    const cancelUrl = buildBookingCancelUrl(booking);
    const clientCancelBlock = bookingCancelEmailBlock(cancelUrl);

    const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#121212;border:1px solid rgba(255,255,255,0.08);">
      <tr><td style="background:#125470;padding:28px 32px;text-align:center;">
        <img src="https://savronmn.com/logo.png" alt="SAVRON" width="160" style="display:block;margin:0 auto 8px;" />
      </td></tr>
      <tr><td style="padding:36px 32px;">
        <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Appointment Updated</p>
        <h1 style="margin:0 0 28px;color:#fff;font-size:26px;letter-spacing:2px;text-transform:uppercase;">Your appointment has been updated, ${booking.client_name?.split(' ')[0] ?? 'friend'}.</h1>
        <p style="margin:0 0 20px;color:rgba(255,255,255,0.55);font-size:12px;">From <strong style="color:#fff;">${RESEND_BOOKING_FROM}</strong> (${SHOP_CALENDAR_DISPLAY_NAME}). Updated calendar file attached.</p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;border:1px solid rgba(255,255,255,0.08);margin-bottom:20px;">
          <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Service</span><br><span style="color:#fff;font-size:15px;">${booking.service}</span></td></tr>
          <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Barber</span><br><span style="color:#fff;font-size:15px;">${barberName}</span></td></tr>
          <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);"><span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Date</span><br><span style="color:#fff;font-size:15px;">${dateFormatted}</span></td></tr>
          <tr><td style="padding:14px 20px;"><span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Time</span><br><span style="color:#fff;font-size:15px;">${booking.time}</span></td></tr>
        </table>
        ${clientCancelBlock}
        <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;">We&rsquo;ll see you soon.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

    const icsString = buildBookingIcs(booking, barberName, { method: 'PUBLISH', sequence: 2 });

    try {
        await sendResendEmail({
            to: booking.client_email,
            subject: `Your appointment has been updated — ${booking.time}, ${dateFormatted}`,
            html: htmlBody,
            icsContent: icsString,
            icsMethod: 'PUBLISH',
        });

        if (barberEmail) {
            const barberHtml = htmlBody
                .replace(CLIENT_CANCEL_EMAIL_MARKER, '')
                .replace('Your appointment has been updated,', 'Appointment updated —')
                .replace(booking.client_name?.split(' ')[0] ?? 'friend', booking.client_name || 'Walk-in');

            await sendResendEmail({
                to: barberEmail,
                subject: `Updated booking: ${booking.client_name || 'Walk-in'} — ${booking.time}, ${dateFormatted}`,
                html: barberHtml,
                icsContent: icsString,
                icsMethod: 'PUBLISH',
            });
        }

        return { success: true };
    } catch (error) {
        console.error('[send-booking-email] update failed:', error);
        return { success: false, error: String(error) };
    }
}
