// Cold outreach email templates for barber chair rental prospecting.
// Matches the SAVRON CRM email style (lib/email-templates.ts).

import { escapeHtml } from '@/lib/utils';

const LOGO_URL = 'https://savronmn.com/logo.png';

function wrapTemplate(innerHtml: string): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#121212;border:1px solid rgba(255,255,255,0.08);">
        <tr>
          <td style="background:#125470;padding:28px 32px;text-align:center;">
            <img src="${LOGO_URL}" alt="SAVRON" width="160" style="display:block;margin:0 auto 8px;max-width:160px;height:auto;" />
            <p style="margin:0;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;">Barbershop &amp; Lounge · Minneapolis</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            ${innerHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;letter-spacing:1px;">
              SAVRON Barbershop &amp; Lounge · Minneapolis, MN · <a href="https://savronmn.com" style="color:rgba(255,255,255,0.3);">savronmn.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type OutreachTemplate = 'chair_rental' | 'custom';

export function getChairRentalTemplate(prospectName: string, businessName?: string): { subject: string; html: string } {
    const firstName = escapeHtml(prospectName?.split(' ')[0] || 'there');
    const shopRef = businessName ? ` at ${escapeHtml(businessName)}` : '';

    return {
        subject: 'Chair rental opportunity at SAVRON — Minneapolis',
        html: wrapTemplate(`
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Partnership Opportunity</p>
            <h1 style="margin:0 0 20px;color:#fff;font-size:24px;letter-spacing:2px;text-transform:uppercase;">Hey ${firstName}, grow with SAVRON.</h1>
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7;">
                We're reaching out because we think your work${shopRef} would be a great fit for SAVRON Barbershop &amp; Lounge in Minneapolis.
            </p>
            <p style="margin:0 0 20px;color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7;">
                We offer a flexible <strong style="color:#1A6A8A;">chair rental model</strong> — you keep your clients, set your schedule, and operate inside a premium lounge environment with built-in booking, marketing support, and a strong client base.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;border:1px solid rgba(255,255,255,0.08);margin-bottom:24px;">
                <tr>
                    <td style="padding:20px 24px;">
                        <p style="margin:0 0 8px;color:#1A6A8A;font-size:11px;letter-spacing:2px;text-transform:uppercase;">What's included</p>
                        <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;line-height:1.8;">
                            ✓ Premium chair in a high-traffic lounge<br/>
                            ✓ Online booking &amp; client management<br/>
                            ✓ Flexible weekly rental — no long-term lock-in<br/>
                            ✓ Collaborative barber community
                        </p>
                    </td>
                </tr>
            </table>
            <p style="margin:0 0 24px;color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7;">
                If you're open to a quick conversation, just reply to this email. We'd love to show you the space and walk through the model.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                    <td style="background:#125470;padding:14px 28px;">
                        <a href="mailto:savronmn@gmail.com?subject=Chair%20Rental%20Inquiry" style="color:#fff;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">Let's Connect</a>
                    </td>
                </tr>
            </table>
            <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">
                — The SAVRON Team
            </p>
        `),
    };
}

export function getOutreachCustomTemplate(
    prospectName: string,
    subject: string,
    message: string,
): { subject: string; html: string } {
    const firstName = escapeHtml(prospectName?.split(' ')[0] || 'there');
    const paragraphs = message
        .split('\n')
        .filter(Boolean)
        .map(p => `<p style="margin:0 0 16px;color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7;">${escapeHtml(p)}</p>`)
        .join('');

    return {
        subject: subject || 'A message from SAVRON',
        html: wrapTemplate(`
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Outreach</p>
            <h1 style="margin:0 0 20px;color:#fff;font-size:24px;letter-spacing:2px;text-transform:uppercase;">Hey ${firstName},</h1>
            ${paragraphs}
            <p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">
                — The SAVRON Team
            </p>
        `),
    };
}
