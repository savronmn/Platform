import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { fetchAllApplicants } from '@/lib/applicants-admin';
import AdminApplicantsClient from './AdminApplicantsClient';

export const dynamic = 'force-dynamic';

export default async function AdminApplicantsPage() {
    const supabase = createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/admin/login');
    }

    const { applicants, error } = await fetchAllApplicants();

    return (
        <AdminApplicantsClient
            initialApplicants={applicants}
            initialLoadError={error ? 'Failed to load applications from the database.' : ''}
        />
    );
}
