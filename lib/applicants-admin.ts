import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { Applicant } from '@/lib/types';

export async function fetchAllApplicants(): Promise<{ applicants: Applicant[]; error: string | null }> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('applicants')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('fetchAllApplicants error:', error);
        return { applicants: [], error: error.message };
    }

    return { applicants: (data ?? []) as Applicant[], error: null };
}
