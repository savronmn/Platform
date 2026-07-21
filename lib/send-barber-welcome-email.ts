import { RESEND_BOOKING_FROM, RESEND_BOOKING_FROM_NAME, SHOP_NAME } from '@/lib/shop';
import {
    barberBookingPageUrl,
    barberPortalCalendarUrl,
    barberPortalLoginUrl,
} from '@/lib/barber-portal-urls';

export type BarberWelcomeEmailInput = {
    name: string;
    email: string;
    slug: string;
    origin?: string;
};

export async function sendBarberWelcomeEmail(
    input: BarberWelcomeEmailInput,
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
    if (!process.env.RESEND_API_KEY) {
        return { success: true, skipped: true };
    }

    const origin = input.origin?.replace(/\/$/, '') || 'https://savronmn.com';
    const loginUrl = barberPortalLoginUrl(input.slug, origin);
    const calendarUrl = barberPortalCalendarUrl(input.slug, origin);
    const bookingUrl = barberBookingPageUrl(input.slug, origin);

    const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#0a0a09;font-family:Arial,sans-serif;color:#e8e4dc;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <p style="font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:rgba(232,228,220,0.55);margin:0 0 16px;">${SHOP_NAME}</p>
    <h1 style="font-size:28px;font-weight:500;margin:0 0 16px;color:#e8e4dc;">Welcome to the team, ${input.name.split(' ')[0]}.</h1>
    <p style="font-size:15px;line-height:1.65;color:rgba(232,228,220,0.78);margin:0 0 24px;">
      Your SAVRON barber profile is now live. Clients can book with you, and you can manage your calendar from your portal.
    </p>
    <div style="background:#141413;border:1px solid rgba(232,228,220,0.08);border-radius:8px;padding:20px;margin-bottom:24px;">
      <p style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:rgba(232,228,220,0.5);margin:0 0 12px;">Quick links</p>
      <p style="margin:0 0 10px;font-size:14px;"><a href="${loginUrl}" style="color:#60a5fa;">Portal login</a></p>
      <p style="margin:0 0 10px;font-size:14px;"><a href="${calendarUrl}" style="color:#60a5fa;">Your calendar</a></p>
      <p style="margin:0;font-size:14px;"><a href="${bookingUrl}" style="color:#60a5fa;">Your public booking page</a></p>
    </div>
    <p style="font-size:13px;line-height:1.6;color:rgba(232,228,220,0.55);margin:0;">
      Need to update your services, prices, or schedule? Submit a change request from your portal — an admin will review and apply it.
    </p>
  </div>
</body>
</html>`;

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `${RESEND_BOOKING_FROM_NAME} <${RESEND_BOOKING_FROM}>`,
            reply_to: RESEND_BOOKING_FROM,
            to: [input.email],
            subject: `Welcome to ${SHOP_NAME} — your profile is live`,
            html,
        }),
    });

    if (!res.ok) {
        return { success: false, error: await res.text() };
    }

    return { success: true };
}
