import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/staff-auth';

export interface ResendEmailSummary {
    id: string;
    to: string[];
    from: string;
    subject: string | null;
    created_at: string;
    last_event: string | null;
}

function normalizeResendEmail(raw: Record<string, unknown>): ResendEmailSummary {
    return {
        id: String(raw.id ?? ''),
        to: Array.isArray(raw.to) ? raw.to.map(String) : [],
        from: String(raw.from ?? ''),
        subject: raw.subject != null ? String(raw.subject) : null,
        created_at: String(raw.created_at ?? ''),
        last_event: raw.last_event != null ? String(raw.last_event) : null,
    };
}

export async function GET(req: NextRequest) {
    const staff = await requireStaff();
    if (!staff.ok) {
        return NextResponse.json({ error: staff.error }, { status: staff.status });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Resend API key not configured' }, { status: 503 });
    }

    const { searchParams } = req.nextUrl;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '25', 10) || 25, 1), 100);
    const after = searchParams.get('after');
    const before = searchParams.get('before');

    const url = new URL('https://api.resend.com/emails');
    url.searchParams.set('limit', String(limit));
    if (after) url.searchParams.set('after', after);
    if (before) url.searchParams.set('before', before);

    try {
        const response = await fetch(url.toString(), {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
            },
            next: { revalidate: 0 },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
            const message = typeof payload?.message === 'string'
                ? payload.message
                : 'Failed to fetch email history from Resend';
            return NextResponse.json({ error: message }, { status: response.status });
        }

        const emails = Array.isArray(payload?.data)
            ? payload.data.map((item: Record<string, unknown>) => normalizeResendEmail(item))
            : [];

        return NextResponse.json({
            emails,
            hasMore: Boolean(payload?.has_more),
        });
    } catch (error) {
        console.error('[email/history]', error);
        return NextResponse.json({ error: 'Failed to load email history' }, { status: 500 });
    }
}
