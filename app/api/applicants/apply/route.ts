import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { EMAIL_RE } from '@/lib/applicant-video';

type ApplicantPayload = {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    ig_handle?: string | null;
    experience?: string | null;
    license_status?: string | null;
    experience_summary?: string | null;
    video_url?: string | null;
};

function parsePayload(req: NextRequest, body: ApplicantPayload | null) {
    const name = body?.name?.trim() ?? '';
    const email = body?.email?.trim().toLowerCase() ?? '';
    const phone = body?.phone?.trim() ?? '';
    const ig_handle = body?.ig_handle?.trim() || null;
    const experience = body?.experience?.trim() ?? '';
    const license_status = body?.license_status?.trim() ?? '';
    const experience_summary = body?.experience_summary?.trim() ?? '';
    const video_url = body?.video_url?.trim() || null;

    return { name, email, phone, ig_handle, experience, license_status, experience_summary, video_url };
}

function validatePayload(payload: ReturnType<typeof parsePayload>) {
    const { name, email, phone, experience, license_status, experience_summary } = payload;

    if (!name) {
        return 'Please enter your full name.';
    }
    if (!email || !EMAIL_RE.test(email)) {
        return 'Please enter a valid email.';
    }
    if (!phone) {
        return 'Please enter your phone number.';
    }
    if (!experience) {
        return 'Please select your years of experience.';
    }
    if (!license_status) {
        return 'Please select your license status.';
    }
    if (!experience_summary) {
        return 'Please tell us about your experience.';
    }

    return null;
}

export async function POST(req: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();
        const contentType = req.headers.get('content-type') ?? '';
        let payload: ReturnType<typeof parsePayload>;

        if (contentType.includes('application/json')) {
            const body = await req.json().catch(() => null) as ApplicantPayload | null;
            payload = parsePayload(req, body);
        } else {
            const formData = await req.formData();
            payload = parsePayload(req, {
                name: formData.get('name') as string | null,
                email: formData.get('email') as string | null,
                phone: formData.get('phone') as string | null,
                ig_handle: formData.get('ig_handle') as string | null,
                experience: formData.get('experience') as string | null,
                license_status: formData.get('license_status') as string | null,
                experience_summary: formData.get('experience_summary') as string | null,
                video_url: formData.get('video_url') as string | null,
            });
        }

        const validationError = validatePayload(payload);
        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        const { data: existing } = await supabase
            .from('applicants')
            .select('id')
            .eq('email', payload.email)
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { error: 'An application with this email already exists.' },
                { status: 409 },
            );
        }

        const { error: insertError } = await supabase.from('applicants').insert({
            name: payload.name,
            email: payload.email,
            phone: payload.phone,
            ig_handle: payload.ig_handle,
            experience: payload.experience,
            license_status: payload.license_status,
            experience_summary: payload.experience_summary,
            video_url: payload.video_url,
            status: 'pending',
        });

        if (insertError) {
            console.error('Applicant insert error:', insertError);
            if (insertError.code === '23505') {
                return NextResponse.json(
                    { error: 'An application with this email already exists.' },
                    { status: 409 },
                );
            }
            return NextResponse.json(
                { error: 'Failed to save your application. Please try again.' },
                { status: 500 },
            );
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('Applicant apply API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
