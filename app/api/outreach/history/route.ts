import { NextResponse } from 'next/server';
import { listOutreachSends } from '@/lib/outreach-store';
import { requireAdmin } from '@/lib/staff-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const admin = await requireAdmin();
    if (!admin.ok) {
        return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const sends = await listOutreachSends(25);
    return NextResponse.json({ sends });
}
