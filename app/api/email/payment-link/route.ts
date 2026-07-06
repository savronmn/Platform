// POST /api/email/payment-link
// Sends a Stripe payment link to a client via Resend.
// Body: { email, clientName?, service?, amount?, paymentUrl }

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const { email, clientName, service, amount, paymentUrl } = await request.json() as {
        email?: string;
        clientName?: string;
        service?: string;
        amount?: string;
        paymentUrl?: string;
    };

    if (!email || !paymentUrl) {
        return NextResponse.json({ error: 'Missing email or paymentUrl' }, { status: 400 });
    }

    const firstName = clientName?.split(' ')[0] ?? 'friend';
    const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#121212;border:1px solid rgba(255,255,255,0.08);">
      <tr><td style="background:#125470;padding:28px 32px;text-align:center;">
        <img src="https://savronmn.com/logo.png" alt="SAVRON" width="160" style="display:block;margin:0 auto 8px;max-width:160px;height:auto;" />
        <p style="margin:0;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;">Barbershop &amp; Lounge · Minneapolis</p>
      </td></tr>
      <tr><td style="padding:36px 32px;">
        <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Payment Request</p>
        <h1 style="margin:0 0 24px;color:#fff;font-size:22px;letter-spacing:1.5px;text-transform:uppercase;">Hi ${firstName}, here&rsquo;s your payment link</h1>
        ${service ? `<p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:14px;">${service}</p>` : ''}
        ${amount ? `<p style="margin:0 0 24px;color:#1A6A8A;font-size:20px;font-weight:700;">${amount}</p>` : ''}
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>
          <td style="background:#125470;padding:14px 32px;">
            <a href="${paymentUrl}" style="color:#fff;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">Pay Now</a>
          </td>
        </tr></table>
        <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;">
          This secure link expires when the session closes. Questions? Reply to this email.
        </p>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);">
        <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;letter-spacing:1px;">
          SAVRON Barbershop &amp; Lounge · <a href="https://savronmn.com" style="color:rgba(255,255,255,0.3);">savronmn.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: 'SAVRON Barbershop & Lounge <bookings@savronmn.com>',
            to: [email],
            subject: `Payment link from SAVRON${amount ? ` — ${amount}` : ''}`,
            html: htmlBody,
        }),
    });

    if (!res.ok) {
        const detail = await res.text();
        console.error('Payment link email failed:', detail);
        return NextResponse.json({ error: 'Email failed', detail }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
