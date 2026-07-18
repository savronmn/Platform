import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { OutreachProspect } from '@/lib/outreach-prospects';
import { SEED_PROSPECTS } from '@/lib/outreach-prospects';

interface OutreachProspectRow {
    id: string;
    external_id: string;
    name: string;
    email: string | null;
    business_name: string;
    area: string;
    phone: string | null;
    instagram: string | null;
    website: string | null;
    google_maps_url: string | null;
    years_experience: number | null;
    price_min_cents: number | null;
    price_max_cents: number | null;
    rating: number | null;
    review_count: number | null;
    reputation_score: number | null;
    barber_id: string | null;
    is_savron_barber: boolean;
    enriched_at: string | null;
    source: string;
}

interface OutreachSendRow {
    id: string;
    sent_by: string | null;
    sent_by_email: string | null;
    template: string;
    subject: string | null;
    prospect_count: number;
    sent_count: number;
    failed_count: number;
    prospect_ids: string[];
    errors: string[] | null;
    created_at: string;
}

function rowToProspect(row: OutreachProspectRow): OutreachProspect {
    return {
        id: row.external_id,
        name: row.name,
        email: row.email ?? '',
        businessName: row.business_name,
        area: row.area as OutreachProspect['area'],
        phone: row.phone ?? undefined,
        instagram: row.instagram ?? undefined,
        website: row.website ?? undefined,
        googleMapsUrl: row.google_maps_url ?? undefined,
        yearsExperience: row.years_experience,
        priceMinCents: row.price_min_cents,
        priceMaxCents: row.price_max_cents,
        rating: row.rating != null ? Number(row.rating) : null,
        reviewCount: row.review_count,
        reputationScore: row.reputation_score != null ? Number(row.reputation_score) : null,
        isSavronBarber: row.is_savron_barber,
        barberId: row.barber_id,
        enrichedAt: row.enriched_at,
        source: row.source as OutreachProspect['source'],
    };
}

function prospectToRow(prospect: OutreachProspect): Omit<OutreachProspectRow, 'id'> & { external_id: string } {
    return {
        external_id: prospect.id,
        name: prospect.name,
        email: prospect.email || null,
        business_name: prospect.businessName,
        area: prospect.area,
        phone: prospect.phone ?? null,
        instagram: prospect.instagram ?? null,
        website: prospect.website ?? null,
        google_maps_url: prospect.googleMapsUrl ?? null,
        years_experience: prospect.yearsExperience ?? null,
        price_min_cents: prospect.priceMinCents ?? null,
        price_max_cents: prospect.priceMaxCents ?? null,
        rating: prospect.rating ?? null,
        review_count: prospect.reviewCount ?? null,
        reputation_score: prospect.reputationScore ?? null,
        barber_id: prospect.barberId ?? null,
        is_savron_barber: prospect.isSavronBarber ?? false,
        enriched_at: prospect.enrichedAt ?? null,
        source: prospect.source,
    };
}

async function tableReady(): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('outreach_prospects').select('id').limit(1);
    return !error;
}

export async function ensureSeedProspects(): Promise<OutreachProspect[]> {
    if (!(await tableReady())) {
        return SEED_PROSPECTS;
    }

    const supabase = getSupabaseAdmin();
    const { count } = await supabase
        .from('outreach_prospects')
        .select('id', { count: 'exact', head: true });

    if ((count ?? 0) > 0) {
        return listProspects();
    }

    const rows = SEED_PROSPECTS.map(prospectToRow);
    const { error } = await supabase.from('outreach_prospects').upsert(rows, { onConflict: 'external_id' });
    if (error) {
        console.error('[outreach-store] seed upsert failed:', error.message);
        return SEED_PROSPECTS;
    }

    return listProspects();
}

export async function listProspects(): Promise<OutreachProspect[]> {
    if (!(await tableReady())) {
        return SEED_PROSPECTS;
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('outreach_prospects')
        .select('*')
        .order('reputation_score', { ascending: false, nullsFirst: false })
        .order('business_name', { ascending: true });

    if (error || !data?.length) {
        return SEED_PROSPECTS;
    }

    return (data as OutreachProspectRow[]).map(rowToProspect);
}

export async function getProspectsByIds(ids: string[]): Promise<OutreachProspect[]> {
    if (ids.length === 0) return [];

    if (!(await tableReady())) {
        const idSet = new Set(ids);
        return SEED_PROSPECTS.filter(p => idSet.has(p.id));
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('outreach_prospects')
        .select('*')
        .in('external_id', ids);

    if (error || !data?.length) {
        const idSet = new Set(ids);
        return SEED_PROSPECTS.filter(p => idSet.has(p.id));
    }

    return (data as OutreachProspectRow[]).map(rowToProspect);
}

export async function upsertProspects(prospects: OutreachProspect[]): Promise<{ imported: number; withEmail: number }> {
    if (!(await tableReady())) {
        throw new Error('Outreach tables are not ready. Apply the latest Supabase migration first.');
    }

    if (prospects.length === 0) {
        return { imported: 0, withEmail: 0 };
    }

    const supabase = getSupabaseAdmin();
    const rows = prospects.map(p => ({
        ...prospectToRow(p),
        updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from('outreach_prospects').upsert(rows, { onConflict: 'external_id' });

    if (error) {
        throw new Error(`Failed to save prospects: ${error.message}`);
    }

    return {
        imported: prospects.length,
        withEmail: prospects.filter(p => p.email).length,
    };
}

/** @deprecated Use upsertProspects */
export const upsertApifyProspects = upsertProspects;

export async function syncSavronBarbersToProspects(): Promise<number> {
    if (!(await tableReady())) return 0;

    const supabase = getSupabaseAdmin();
    const { data: barbers, error } = await supabase
        .from('barbers')
        .select('id, name, email, phone, instagram_url, bio, slug, active')
        .eq('active', true);

    if (error || !barbers?.length) return 0;

    const rows = barbers.map(b => ({
        external_id: `barber-${b.id}`,
        name: b.name,
        email: b.email,
        business_name: b.name,
        area: 'downtown' as const,
        phone: b.phone,
        instagram: b.instagram_url,
        website: b.instagram_url?.includes('http') ? b.instagram_url : null,
        barber_id: b.id,
        is_savron_barber: true,
        source: 'savron',
        years_experience: b.bio ? parseBioYears(b.bio) : null,
        updated_at: new Date().toISOString(),
    }));

    const { error: upsertErr } = await supabase
        .from('outreach_prospects')
        .upsert(rows, { onConflict: 'external_id' });

    if (upsertErr) {
        console.error('[outreach-store] savron barber sync failed:', upsertErr.message);
        return 0;
    }

    return rows.length;
}

function parseBioYears(bio: string): number | null {
    const match = bio.match(/(\d{1,2})\+?\s*years?/i);
    return match ? parseInt(match[1], 10) : null;
}

export interface OutreachSendLog {
    id: string;
    sentByEmail: string | null;
    template: string;
    subject: string | null;
    prospectCount: number;
    sentCount: number;
    failedCount: number;
    createdAt: string;
}

export async function logOutreachSend(input: {
    sentBy: string;
    sentByEmail?: string;
    template: string;
    subject?: string;
    prospectIds: string[];
    sent: number;
    failed: number;
    errors: string[];
}): Promise<void> {
    if (!(await tableReady())) return;

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('outreach_sends').insert({
        sent_by: input.sentBy,
        sent_by_email: input.sentByEmail ?? null,
        template: input.template,
        subject: input.subject ?? null,
        prospect_count: input.prospectIds.length,
        sent_count: input.sent,
        failed_count: input.failed,
        prospect_ids: input.prospectIds,
        errors: input.errors.slice(0, 10),
    });

    if (error) {
        console.error('[outreach-store] failed to log send:', error.message);
    }
}

export async function listOutreachSends(limit = 20): Promise<OutreachSendLog[]> {
    if (!(await tableReady())) return [];

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('outreach_sends')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error || !data) return [];

    return (data as OutreachSendRow[]).map(row => ({
        id: row.id,
        sentByEmail: row.sent_by_email,
        template: row.template,
        subject: row.subject,
        prospectCount: row.prospect_count,
        sentCount: row.sent_count,
        failedCount: row.failed_count,
        createdAt: row.created_at,
    }));
}
