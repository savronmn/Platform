import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

export async function POST(req: NextRequest) {
    try {
        const supabase = getSupabaseAdmin();
        const formData = await req.formData();

        const name = (formData.get('name') as string | null)?.trim() ?? '';
        const email = (formData.get('email') as string | null)?.trim().toLowerCase() ?? '';
        const phone = (formData.get('phone') as string | null)?.trim() ?? '';
        const ig_handle = (formData.get('ig_handle') as string | null)?.trim() || null;
        const experience = (formData.get('experience') as string | null)?.trim() ?? '';
        const license_status = (formData.get('license_status') as string | null)?.trim() ?? '';
        const experience_summary = (formData.get('experience_summary') as string | null)?.trim() ?? '';
        const video = formData.get('video') as File | null;

        if (!name) {
            return NextResponse.json({ error: 'Please enter your full name.' }, { status: 400 });
        }
        if (!email || !EMAIL_RE.test(email)) {
            return NextResponse.json({ error: 'Please enter a valid email.' }, { status: 400 });
        }
        if (!phone) {
            return NextResponse.json({ error: 'Please enter your phone number.' }, { status: 400 });
        }
        if (!experience) {
            return NextResponse.json({ error: 'Please select your years of experience.' }, { status: 400 });
        }
        if (!license_status) {
            return NextResponse.json({ error: 'Please select your license status.' }, { status: 400 });
        }
        if (!experience_summary) {
            return NextResponse.json({ error: 'Please tell us about your experience.' }, { status: 400 });
        }

        const { data: existing } = await supabase
            .from('applicants')
            .select('id')
            .eq('email', email)
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { error: 'An application with this email already exists.' },
                { status: 409 },
            );
        }

        let video_url: string | null = null;
        if (video && video.size > 0) {
            if (video.size > MAX_VIDEO_BYTES) {
                return NextResponse.json(
                    { error: 'Video must be 100 MB or smaller.' },
                    { status: 400 },
                );
            }

            const safeName = video.name.replace(/[^a-zA-Z0-9._-]/g, '_');
            const fileName = `${Date.now()}_${safeName}`;
            const buffer = Buffer.from(await video.arrayBuffer());

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('applicant-videos')
                .upload(fileName, buffer, { contentType: video.type || 'video/mp4', upsert: false });

            if (uploadError) {
                console.error('Applicant video upload failed:', uploadError.message);
                return NextResponse.json(
                    { error: 'Failed to upload video. Please try again or submit without a video.' },
                    { status: 500 },
                );
            }

            if (uploadData) {
                const { data: { publicUrl } } = supabase.storage
                    .from('applicant-videos')
                    .getPublicUrl(fileName);
                video_url = publicUrl;
            }
        }

        const { error: insertError } = await supabase.from('applicants').insert({
            name,
            email,
            phone,
            ig_handle,
            experience,
            license_status,
            experience_summary,
            video_url,
            status: 'pending',
        });

        if (insertError) {
            console.error('Applicant insert error:', insertError);
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
