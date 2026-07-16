import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { requireAdmin } from '@/lib/staff-auth';
import type { Applicant } from '@/lib/types';

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('applicants')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Admin applicants list error:', error);
        return NextResponse.json({ error: 'Failed to load applicants' }, { status: 500 });
    }

    return NextResponse.json({ applicants: data ?? [] });
}

export async function PATCH(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    const id = body?.id as string | undefined;
    const status = body?.status as Applicant['status'] | undefined;

    if (!id || !status) {
        return NextResponse.json({ error: 'Applicant id and status are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('applicants')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Admin applicant update error:', error);
        return NextResponse.json({ error: 'Failed to update applicant' }, { status: 500 });
    }

    return NextResponse.json({ applicant: data });
}

export async function DELETE(req: NextRequest) {
    const auth = await requireAdmin();
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => null);
    const id = body?.id as string | undefined;

    if (!id) {
        return NextResponse.json({ error: 'Applicant id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('applicants').delete().eq('id', id);

    if (error) {
        console.error('Admin applicant delete error:', error);
        return NextResponse.json({ error: 'Failed to delete applicant' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
