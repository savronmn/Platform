// POST /api/outreach/purge-shops — remove barbershop leads, keep individual barbers

import { NextResponse } from 'next/server';
import { listProspects, purgeBarbershops } from '@/lib/outreach-store';
import { requireAdmin } from '@/lib/staff-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
    const admin = await requireAdmin();
    if (!admin.ok) {
        return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    try {
        const removed = await purgeBarbershops();
        const prospects = await listProspects({ individualsOnly: true });

        return NextResponse.json({
            removed,
            prospects,
            message: removed > 0
                ? `Removed ${removed} barbershop lead${removed !== 1 ? 's' : ''}. ${prospects.length} individual barber${prospects.length !== 1 ? 's' : ''} remain.`
                : 'No barbershop leads to remove.',
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Purge failed';
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
