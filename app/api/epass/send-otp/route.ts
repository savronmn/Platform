import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

function generateCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: NextRequest) {
    const { email } = await req.json();
    if (!email || typeof email !== 'string') {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseAdmin();

    // Check subscriber exists
    const { data: subscriber } = await supabase
        .from('email_subscribers')
        .select('name, email')
        .eq('email', normalizedEmail)
        .single();

    if (!subscriber) {
        return NextResponse.json({ error: 'No ePass found for this email. Ask a SAVRON staff member to add you.' }, { status: 404 });
    }

    // Delete any existing unused OTPs for this email
    await supabase.from('epass_otps').delete().eq('email', normalizedEmail);

    const code = generateCode();

    // Store new OTP
    const { error: insertErr } = await supabase.from('epass_otps').insert({
        email: normalizedEmail,
        code,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (insertErr) {
        return NextResponse.json({ error: 'Failed to generate code' }, { status: 500 });
    }

    // Send email via Resend
    const resend = new Resend(process.env.RESEND_API_KEY!);
    const firstName = subscriber.name?.split(' ')[0] || 'Member';

    type ResendAttachment = { filename: string; content: string; content_type: string; content_id?: string };
    const attachments: ResendAttachment[] = [];

    let qrBuffer: Buffer | null = null;
    try {
        const QRCode = (await import('qrcode')).default;
        qrBuffer = await QRCode.toBuffer(normalizedEmail, {
            width: 300,
            margin: 2,
            color: { dark: '#FFFFFF', light: '#0E0E0E' },
        });
        attachments.push({
            filename: 'qrcode.png',
            content: qrBuffer.toString('base64'),
            content_type: 'image/png',
            content_id: 'savron_qrcode',
        });
    } catch (err) {
        console.error('QR code generation failed (non-fatal):', err);
    }

    const { error: emailErr } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'noreply@savronmn.com',
        to: normalizedEmail,
        subject: `Your SAVRON ePass code: ${code}`,
        attachments: attachments as any,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0e0e;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#1a1a1a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;overflow:hidden;">

        <tr><td style="padding:32px 32px 0;text-align:center;">
          <p style="margin:0;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;color:rgba(255,255,255,0.3);">SAVRON Barbershop &amp; Lounge</p>
          <p style="margin:16px 0 0;font-size:14px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.9);">Members ePass</p>
        </td></tr>

        <tr><td style="padding:32px;text-align:center;">
          <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:13px;">Hey ${firstName}, here's your login code</p>

          <div style="margin:24px 0;background:#0e0e0e;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:28px 0;">
            <p style="margin:0;font-size:48px;font-weight:700;letter-spacing:0.15em;color:#ffffff;font-family:'Courier New',monospace;">${code}</p>
            <p style="margin:12px 0 0;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;color:rgba(255,255,255,0.25);">Expires in 10 minutes</p>
          </div>

          ${qrBuffer ? `
          <div style="margin:24px 0;background:#0e0e0e;border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:20px 24px;text-align:center;">
            <p style="margin:0 0 16px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Or Scan Check-in QR Code</p>
            <img src="cid:savron_qrcode" alt="QR Code" width="180" height="180" style="display:block;margin:0 auto;max-width:180px;border:1px solid rgba(255,255,255,0.1);" />
            <p style="margin:12px 0 0;color:rgba(255,255,255,0.3);font-size:10px;letter-spacing:1px;">Scan this at the shop counter to record your visit directly.</p>
          </div>
          ` : ''}

          <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);line-height:1.6;">
            Enter this code on the SAVRON ePass page to view your QR code.<br>
            If you didn't request this, ignore this email.
          </p>
        </td></tr>

        <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);text-align:center;">
          <p style="margin:0;font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:0.15em;text-transform:uppercase;">savronmn.com</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    if (emailErr) {
        console.error('Resend error:', emailErr);
        return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
