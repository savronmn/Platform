// POST /api/email/outreach
// Sends cold outreach emails to selected barber prospects via Resend.
// Body: { prospectIds: string[], template: 'chair_rental' | 'custom', subject?: string, message?: string }
//
// Uses the same Resend REST API pattern as /api/email/campaign.
// From: info@savronmn.com · Reply-To: savronmn@gmail.com

import { NextRequest, NextResponse } from 'next/server';
import { getProspectsByIds } from '@/lib/outreach-prospects';
import { getChairRentalTemplate, getOutreachCustomTemplate, type OutreachTemplate } from '@/lib/outreach-email-templates';
import { requireStaff } from '@/lib/staff-auth';

const OUTREACH_FROM = 'SAVRON <info@savronmn.com>';
const OUTREACH_REPLY_TO = 'savronmn@gmail.com';

export async function POST(request: NextRequest) {
    const staff = await requireStaff();
    if (!staff.ok) {
        return NextResponse.json({ error: staff.error }, { status: staff.status });
    }

    if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const { prospectIds, template, subject, message } = await request.json() as {
        prospectIds: string[];
        template: OutreachTemplate;
        subject?: string;
        message?: string;
    };

    if (!prospectIds || prospectIds.length === 0) {
        return NextResponse.json({ error: 'No prospects selected' }, { status: 400 });
    }

    const prospects = getProspectsByIds(prospectIds);
    const withEmail = prospects.filter(p => p.email);

    if (withEmail.length === 0) {
        return NextResponse.json({ error: 'No prospects have email addresses' }, { status: 400 });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < withEmail.length; i += 10) {
        const batch = withEmail.slice(i, i + 10);

        await Promise.all(batch.map(async (prospect) => {
            let emailData: { subject: string; html: string };

            switch (template) {
                case 'custom':
                    emailData = getOutreachCustomTemplate(
                        prospect.name,
                        subject || 'A message from SAVRON',
                        message || '',
                    );
                    break;
                case 'chair_rental':
                default:
                    emailData = getChairRentalTemplate(prospect.name, prospect.businessName);
            }

            try {
                const res = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        from: OUTREACH_FROM,
                        reply_to: OUTREACH_REPLY_TO,
                        to: [prospect.email],
                        subject: emailData.subject,
                        html: emailData.html,
                    }),
                });

                if (res.ok) {
                    sent++;
                } else {
                    const err = await res.text();
                    failed++;
                    errors.push(`${prospect.email}: ${err}`);
                }
            } catch (err) {
                failed++;
                errors.push(`${prospect.email}: ${String(err)}`);
            }
        }));

        if (i + 10 < withEmail.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return NextResponse.json({ sent, failed, total: withEmail.length, errors: errors.slice(0, 5) });
}
