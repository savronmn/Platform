// POST /api/outreach/scan — discover & enrich barber prospects via Apify
// Body: { minYearsExperience?, minPriceDollars?, maxPriceDollars?, minRating?, area?, includeSavronBarbers?, enrichWebsites? }

import { NextRequest, NextResponse } from 'next/server';
import { runBarberOutreachScan } from '@/lib/outreach-enrichment';
import type { OutreachArea, OutreachScanParams } from '@/lib/outreach-prospects';
import { listProspects, syncSavronBarbersToProspects, upsertProspects, purgeBarbershops } from '@/lib/outreach-store';
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
        individualsOnly: body.individualsOnly !== false,
        purgeShops: body.purgeShops === true,
    };

    try {
        let savronSynced = 0;
        if (params.includeSavronBarbers) {
            savronSynced = await syncSavronBarbersToProspects();
        }

        const scan = await runBarberOutreachScan(params);
        const saveResult = await upsertProspects(scan.prospects);

        let purged = 0;
        if (params.purgeShops) {
            purged = await purgeBarbershops();
        }

        const prospects = await listProspects({ individualsOnly: true });

        return NextResponse.json({
            discovered: scan.discovered,
            enriched: scan.enriched,
            matched: scan.matched,
            withEmail: scan.withEmail,
            shopsSkipped: scan.shopsSkipped,
            imported: saveResult.imported,
            savedWithEmail: saveResult.withEmail,
            purged,
            savronSynced,
            prospects,
            message: `Scan complete: ${scan.discovered} barbers found, ${scan.withEmail} with email (${scan.matched} match filters, ${scan.shopsSkipped} shops skipped).`,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Barber scan failed';
        console.error('[outreach/scan]', err);
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
