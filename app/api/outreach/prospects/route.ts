// GET /api/outreach/prospects
// Returns barber prospects for the outreach control panel.
// Currently serves seed data — wire Apify/Apollo imports here in the future.

import { NextResponse } from 'next/server';
import { getAllProspects } from '@/lib/outreach-prospects';
import { requireStaff } from '@/lib/staff-auth';

export async function GET() {
    const staff = await requireStaff();
    if (!staff.ok) {
        return NextResponse.json({ error: staff.error }, { status: staff.status });
    }

    return NextResponse.json({ prospects: getAllProspects() });
}
