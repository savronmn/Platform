'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createServerSupabase } from '@/lib/supabase-server';
import type { Applicant } from '@/lib/types';

async function requireSession() {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/admin/login');
}

export async function updateApplicantStatusAction(id: string, status: Applicant['status']) {
    await requireSession();

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('applicants')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new Error('Failed to update application status.');
    }

    revalidatePath('/admin/applicants');
    revalidatePath('/admin/barbers');
    revalidatePath('/admin');
    return data as Applicant;
}

export async function deleteApplicantAction(id: string) {
    await requireSession();

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('applicants').delete().eq('id', id);

    if (error) {
        throw new Error('Failed to delete application.');
    }

    revalidatePath('/admin/applicants');
    revalidatePath('/admin/barbers');
    revalidatePath('/admin');
}

export async function deleteApplicantByEmailAction(email: string) {
    await requireSession();

    const supabase = getSupabaseAdmin();
    const normalized = email.trim().toLowerCase();
    const { data, error } = await supabase
        .from('applicants')
        .delete()
        .eq('email', normalized)
        .select('id');

    if (error) {
        throw new Error('Failed to remove application for that email.');
    }

    if (!data?.length) {
        throw new Error('No application found for that email.');
    }

    revalidatePath('/admin/applicants');
    revalidatePath('/admin/barbers');
    revalidatePath('/admin');
    return data.length;
}
