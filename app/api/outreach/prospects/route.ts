// GET  /api/outreach/prospects — list stored prospects (seed + Apify imports)
// POST /api/outreach/prospects — import barber prospects from Apify (admin only)

import { NextResponse } from 'next/server';
import { runBarberOutreachScan } from '@/lib/outreach-enrichment';
import { ensureSeedProspects, listProspects, upsertProspects } from '@/lib/outreach-store';
import { requireAdmin } from '@/lib/staff-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
    const admin = await requireAdmin();
    if (!admin.ok) {
        return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const prospects = await ensureSeedProspects();

    return NextResponse.json({
        prospects,
        apifyConfigured: Boolean(process.env.APIFY_API_TOKEN),
    });
}

export async function POST() {
    const admin = await requireAdmin();
    if (!admin.ok) {
        return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    try {
        const scan = await runBarberOutreachScan({ enrichWebsites: true });
        const result = await upsertProspects(scan.prospects);
        const prospects = await listProspects();

        return NextResponse.json({
            ...result,
            discovered: scan.discovered,
            matched: scan.matched,
            prospects,
            message: `Imported ${result.imported} prospects (${result.withEmail} with email, ${scan.matched} matched).`,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Apify import failed';
        console.error('[outreach/prospects]', err);
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
