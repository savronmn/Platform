import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/staff-auth';
import { RESEND_BOOKING_FROM, RESEND_BOOKING_FROM_NAME } from '@/lib/shop';

const CAMPAIGN_FROM = process.env.RESEND_FROM_EMAIL
    ? `${RESEND_BOOKING_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`
    : `${RESEND_BOOKING_FROM_NAME} <${RESEND_BOOKING_FROM}>`;

async function sendViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: CAMPAIGN_FROM,
            reply_to: RESEND_BOOKING_FROM,
            to: [to],
            subject,
            html,
        }),
    });

    if (res.ok) return { ok: true };
    return { ok: false, error: await res.text() };
}

export async function POST(req: NextRequest) {
    try {
        const staff = await requireStaff();
        if (!staff.ok) {
            return NextResponse.json({ error: staff.error }, { status: staff.status });
        }

        if (!process.env.RESEND_API_KEY) {
            return NextResponse.json({ error: 'Email service not configured — add RESEND_API_KEY in Vercel' }, { status: 503 });
        }

        const { subject, htmlContent, recipients } = await req.json();

        if (!subject?.trim() || !htmlContent?.trim() || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return NextResponse.json({ error: 'Subject, content, and at least one recipient are required' }, { status: 400 });
        }

        const normalized = recipients
            .map((r: { email: string; name?: string }) => ({
                email: r.email?.trim().toLowerCase(),
                name: r.name?.trim() || undefined,
            }))
            .filter((r: { email: string }) => Boolean(r.email));

        const uniqueByEmail = new Map<string, { email: string; name?: string }>();
        for (const recipient of normalized) {
            uniqueByEmail.set(recipient.email, recipient);
        }
        const toSend = Array.from(uniqueByEmail.values());

        if (toSend.length === 0) {
            return NextResponse.json({ error: 'No valid recipient emails' }, { status: 400 });
        }

        let sent = 0;
        let failed = 0;
        const errors: string[] = [];

        for (let i = 0; i < toSend.length; i += 10) {
            const batch = toSend.slice(i, i + 10);

            await Promise.all(batch.map(async (recipient) => {
                try {
                    const result = await sendViaResend(recipient.email, subject.trim(), htmlContent);
                    if (result.ok) {
                        sent++;
                    } else {
                        failed++;
                        errors.push(`${recipient.email}: ${result.error}`);
                    }
                } catch (err) {
                    failed++;
                    errors.push(`${recipient.email}: ${String(err)}`);
                }
            }));

            if (i + 10 < toSend.length) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        if (sent === 0) {
            return NextResponse.json({
                error: 'Failed to send campaign',
                details: errors.slice(0, 3),
            }, { status: 502 });
        }

        return NextResponse.json({
            success: true,
            sent,
            failed,
            total: toSend.length,
            errors: errors.slice(0, 5),
        });
    } catch (err) {
        console.error('[email/brevo]', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
