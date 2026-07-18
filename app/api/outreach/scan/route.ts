// POST /api/outreach/scan — discover & enrich barber prospects via Apify
// Body: { minYearsExperience?, minPriceDollars?, maxPriceDollars?, minRating?, area?, includeSavronBarbers?, enrichWebsites? }

import { NextRequest, NextResponse } from 'next/server';
import { runBarberOutreachScan } from '@/lib/outreach-enrichment';
import type { OutreachArea, OutreachScanParams } from '@/lib/outreach-prospects';
import { listProspects, syncSavronBarbersToProspects, upsertProspects } from '@/lib/outreach-store';
import { requireAdmin } from '@/lib/staff-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
    const admin = await requireAdmin();
    if (!admin.ok) {
        return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const body = await request.json().catch(() => ({})) as OutreachScanParams;

    const params: OutreachScanParams = {
        minYearsExperience: body.minYearsExperience != null ? Number(body.minYearsExperience) : undefined,
        minPriceDollars: body.minPriceDollars != null ? Number(body.minPriceDollars) : undefined,
        maxPriceDollars: body.maxPriceDollars != null ? Number(body.maxPriceDollars) : undefined,
        minRating: body.minRating != null ? Number(body.minRating) : undefined,
        area: (body.area as OutreachArea) || 'all',
        includeSavronBarbers: body.includeSavronBarbers !== false,
        enrichWebsites: body.enrichWebsites !== false,
    };

    try {
        let savronSynced = 0;
        if (params.includeSavronBarbers) {
            savronSynced = await syncSavronBarbersToProspects();
        }

        const scan = await runBarberOutreachScan(params);
        const saveResult = await upsertProspects(scan.prospects);
        const prospects = await listProspects();

        return NextResponse.json({
            discovered: scan.discovered,
            enriched: scan.enriched,
            matched: scan.matched,
            imported: saveResult.imported,
            withEmail: saveResult.withEmail,
            savronSynced,
            prospects,
            message: `Scan complete: ${scan.matched} barbers matched your filters (${scan.discovered} discovered, ${scan.enriched} enriched).`,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Barber scan failed';
        console.error('[outreach/scan]', err);
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
