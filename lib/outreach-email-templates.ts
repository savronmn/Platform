// Cold outreach email templates — editable per campaign with merge tags.

import { escapeHtml } from '@/lib/utils';

const LOGO_URL = 'https://savronmn.com/logo.png';

export type OutreachTemplateId = 'chair_rental' | 'custom';

export interface OutreachMergeVars {
    firstName: string;
    name: string;
    businessName: string;
}

export interface OutreachEmailContent {
    templateId: OutreachTemplateId;
    campaignName?: string;
    subject: string;
    kicker?: string;
    headline: string;
    intro?: string;
    bodyParagraphs: string[];
    bulletPoints?: string[];
    closingParagraph?: string;
    ctaText?: string;
    ctaHref?: string;
    signature?: string;
}

export const OUTREACH_MERGE_TAG_HINT = '{{firstName}}, {{name}}, {{businessName}}';

export const DEFAULT_CHAIR_RENTAL_CONTENT: OutreachEmailContent = {
    templateId: 'chair_rental',
    subject: 'Chair rental opportunity at SAVRON — Minneapolis',
    kicker: 'Partnership Opportunity',
    headline: 'Hey {{firstName}}, grow with SAVRON.',
    intro: "We're reaching out because we think your work at {{businessName}} would be a great fit for SAVRON Barbershop & Lounge in Minneapolis.",
    bodyParagraphs: [
        'We offer a flexible chair rental model — you keep your clients, set your schedule, and operate inside a premium lounge environment with built-in booking, marketing support, and a strong client base.',
    ],
    bulletPoints: [
        'Premium chair in a high-traffic lounge',
        'Online booking & client management',
        'Flexible weekly rental — no long-term lock-in',
        'Collaborative barber community',
    ],
    closingParagraph: "If you're open to a quick conversation, just reply to this email. We'd love to show you the space and walk through the model.",
    ctaText: "Let's Connect",
    ctaHref: 'mailto:savronmn@gmail.com?subject=Chair%20Rental%20Inquiry',
    signature: '— The SAVRON Team',
};

export const DEFAULT_CUSTOM_CONTENT: OutreachEmailContent = {
    templateId: 'custom',
    subject: 'A message from SAVRON',
    kicker: 'Outreach',
    headline: 'Hey {{firstName}},',
    bodyParagraphs: ['Write your message here…'],
    signature: '— The SAVRON Team',
};

export function getDefaultContent(templateId: OutreachTemplateId): OutreachEmailContent {
    const base = templateId === 'chair_rental' ? DEFAULT_CHAIR_RENTAL_CONTENT : DEFAULT_CUSTOM_CONTENT;
    return JSON.parse(JSON.stringify(base)) as OutreachEmailContent;
}

export function mergeVarsFromProspect(name: string, businessName?: string): OutreachMergeVars {
    return {
        firstName: name?.split(' ')[0] || 'there',
        name: name || 'there',
        businessName: businessName || 'your shop',
    };
}

/** Replace {{tags}} and escape all user-authored text for safe HTML output. */
export function applyMergeTags(text: string, vars: OutreachMergeVars): string {
    const parts = text.split(/(\{\{\w+\}\})/g);
    return parts.map(part => {
        const tagMatch = part.match(/^\{\{(\w+)\}\}$/);
        if (tagMatch) {
            const key = tagMatch[1] as keyof OutreachMergeVars;
            const val = vars[key];
            return val != null ? escapeHtml(val) : escapeHtml(part);
        }
        return escapeHtml(part);
    }).join('');
}

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

function paragraphHtml(text: string, vars: OutreachMergeVars): string {
    return `<p style="margin:0 0 16px;color:rgba(255,255,255,0.5);font-size:14px;line-height:1.7;">${applyMergeTags(text, vars)}</p>`;
}

export function renderOutreachEmail(
    content: OutreachEmailContent,
    vars: OutreachMergeVars,
): { subject: string; html: string } {
    const subject = applyMergeTags(content.subject, vars);
    const kicker = content.kicker
        ? `<p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:3px;text-transform:uppercase;">${applyMergeTags(content.kicker, vars)}</p>`
        : '';
    const headline = `<h1 style="margin:0 0 20px;color:#fff;font-size:24px;letter-spacing:2px;text-transform:uppercase;">${applyMergeTags(content.headline, vars)}</h1>`;
    const intro = content.intro ? paragraphHtml(content.intro, vars) : '';
    const body = content.bodyParagraphs.filter(Boolean).map(p => paragraphHtml(p, vars)).join('');

    let bullets = '';
    if (content.bulletPoints?.length) {
        const items = content.bulletPoints
            .filter(Boolean)
            .map(b => `${applyMergeTags(b, vars)}<br/>`)
            .join('');
        bullets = `
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;border:1px solid rgba(255,255,255,0.08);margin-bottom:24px;">
                <tr>
                    <td style="padding:20px 24px;">
                        <p style="margin:0 0 8px;color:#1A6A8A;font-size:11px;letter-spacing:2px;text-transform:uppercase;">What's included</p>
                        <p style="margin:0;color:rgba(255,255,255,0.5);font-size:13px;line-height:1.8;">✓ ${items}</p>
                    </td>
                </tr>
            </table>`;
    }

    const closing = content.closingParagraph ? paragraphHtml(content.closingParagraph, vars) : '';

    let cta = '';
    if (content.ctaText) {
        const href = content.ctaHref || 'mailto:savronmn@gmail.com';
        cta = `
            <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                    <td style="background:#125470;padding:14px 28px;">
                        <a href="${escapeHtml(href)}" style="color:#fff;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">${applyMergeTags(content.ctaText, vars)}</a>
                    </td>
                </tr>
            </table>`;
    }

    const signature = content.signature
        ? `<p style="margin:0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">${applyMergeTags(content.signature, vars)}</p>`
        : '';

    return {
        subject,
        html: wrapTemplate(`${kicker}${headline}${intro}${body}${bullets}${closing}${cta}${signature}`),
    };
}

/** @deprecated Use renderOutreachEmail with OutreachEmailContent */
export type OutreachTemplate = OutreachTemplateId;

export function getChairRentalTemplate(prospectName: string, businessName?: string) {
    return renderOutreachEmail(DEFAULT_CHAIR_RENTAL_CONTENT, mergeVarsFromProspect(prospectName, businessName));
}

export function getOutreachCustomTemplate(prospectName: string, subject: string, message: string, businessName?: string) {
    return renderOutreachEmail({
        ...DEFAULT_CUSTOM_CONTENT,
        subject,
        bodyParagraphs: message.split('\n').filter(Boolean),
    }, mergeVarsFromProspect(prospectName, businessName));
}
