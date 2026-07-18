import { NextResponse } from 'next/server';
import { getOutreachSendById, listOutreachSends } from '@/lib/outreach-store';
import { requireAdmin } from '@/lib/staff-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const admin = await requireAdmin();
    if (!admin.ok) {
        return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
        const send = await getOutreachSendById(id);
        if (!send) {
            return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        }
        return NextResponse.json({ send });
    }

    const sends = await listOutreachSends(50);
    return NextResponse.json({ sends });
}
