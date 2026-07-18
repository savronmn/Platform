// POST /api/email/outreach
// Sends cold outreach emails to selected barber prospects via Resend.
// Body: { prospectIds: string[], content: OutreachEmailContent, htmlSnapshot?: string, testToSelf?: boolean }

import { NextRequest, NextResponse } from 'next/server';
import {
    mergeVarsFromProspect,
    renderOutreachEmail,
    type OutreachEmailContent,
} from '@/lib/outreach-email-templates';
import { isValidReachableEmail } from '@/lib/outreach-lead-classifier';
import { getProspectsByIds, logOutreachSend } from '@/lib/outreach-store';
import { requireAdmin } from '@/lib/staff-auth';

const OUTREACH_FROM = process.env.RESEND_FROM_EMAIL
    ? `SAVRON <${process.env.RESEND_FROM_EMAIL}>`
    : 'SAVRON <bookings@savronmn.com>';
const OUTREACH_REPLY_TO = 'savronmn@gmail.com';

async function sendViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: OUTREACH_FROM,
            reply_to: OUTREACH_REPLY_TO,
            to: [to],
            subject,
            html,
        }),
    });

    if (res.ok) return { ok: true };
    return { ok: false, error: await res.text() };
}

export async function POST(request: NextRequest) {
    const admin = await requireAdmin();
    if (!admin.ok) {
        return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'Email service not configured — add RESEND_API_KEY in Vercel' }, { status: 503 });
    }

    const { prospectIds, content, htmlSnapshot, testToSelf } = await request.json() as {
        prospectIds: string[];
        content: OutreachEmailContent;
        htmlSnapshot?: string;
        testToSelf?: boolean;
    };

    if (!content?.subject?.trim() || !content?.headline?.trim()) {
        return NextResponse.json({ error: 'Subject and headline are required' }, { status: 400 });
    }

    if (!content.bodyParagraphs?.some(p => p.trim())) {
        return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    }

    const prospects = prospectIds?.length ? await getProspectsByIds(prospectIds) : [];
    const withEmail = prospects.filter(p => isValidReachableEmail(p.email));
    const sampleProspect = withEmail[0] ?? prospects[0] ?? {
        name: 'Marcus Johnson',
        businessName: 'Marcus Johnson',
        email: '',
    };

    const sampleVars = mergeVarsFromProspect(sampleProspect.name, sampleProspect.businessName);
    const snapshot = htmlSnapshot || renderOutreachEmail(content, sampleVars).html;

    if (testToSelf) {
        const adminEmail = admin.user.email;
        if (!adminEmail) {
            return NextResponse.json({ error: 'Your admin account has no email — cannot send test' }, { status: 400 });
        }

        const emailData = renderOutreachEmail(content, sampleVars);
        const result = await sendViaResend(adminEmail, `[TEST] ${emailData.subject}`, emailData.html);

        if (!result.ok) {
            return NextResponse.json({
                error: `Test email failed: ${result.error}`,
                testToSelf: true,
            }, { status: 502 });
        }

        await logOutreachSend({
            sentBy: admin.user.id,
            sentByEmail: admin.user.email,
            template: content.templateId,
            subject: `[TEST] ${content.subject.trim()}`,
            campaignName: content.campaignName ? `${content.campaignName} (test)` : 'Test send',
            emailContent: content,
            htmlSnapshot: snapshot,
            prospectIds: prospectIds ?? [],
            sent: 1,
            failed: 0,
            errors: [],
        });

        return NextResponse.json({
            testToSelf: true,
            sent: 1,
            failed: 0,
            total: 1,
            sentTo: adminEmail,
            message: `Test email sent to ${adminEmail}`,
            selectedCount: prospectIds?.length ?? 0,
            reachableEmailCount: withEmail.length,
        });
    }

    if (!prospectIds?.length) {
        return NextResponse.json({ error: 'No prospects selected' }, { status: 400 });
    }

    if (withEmail.length === 0) {
        const noEmailCount = prospects.length;
        return NextResponse.json({
            error: noEmailCount === 0
                ? 'No matching prospects found for the selected IDs'
                : `None of the ${noEmailCount} selected prospect${noEmailCount !== 1 ? 's have' : ' has'} a reachable email. Run a barber scan or use "Send test to me" to verify your template.`,
            selectedCount: prospectIds.length,
            reachableEmailCount: 0,
            withoutEmailCount: noEmailCount,
        }, { status: 400 });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < withEmail.length; i += 10) {
        const batch = withEmail.slice(i, i + 10);

        await Promise.all(batch.map(async (prospect) => {
            const vars = mergeVarsFromProspect(prospect.name, prospect.businessName);
            const emailData = renderOutreachEmail(content, vars);

            try {
                const result = await sendViaResend(prospect.email, emailData.subject, emailData.html);
                if (result.ok) {
                    sent++;
                } else {
                    failed++;
                    errors.push(`${prospect.email}: ${result.error}`);
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

    await logOutreachSend({
        sentBy: admin.user.id,
        sentByEmail: admin.user.email,
        template: content.templateId,
        subject: content.subject.trim(),
        campaignName: content.campaignName,
        emailContent: content,
        htmlSnapshot: snapshot,
        prospectIds,
        sent,
        failed,
        errors,
    });

    return NextResponse.json({
        sent,
        failed,
        total: withEmail.length,
        selectedCount: prospectIds.length,
        reachableEmailCount: withEmail.length,
        withoutEmailCount: prospects.length - withEmail.length,
        errors: errors.slice(0, 5),
    });
}
