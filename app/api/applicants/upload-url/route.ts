import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
    buildApplicantVideoPath,
    ensureApplicantVideosBucket,
    getApplicantVideoPublicUrl,
    MAX_VIDEO_BYTES,
    VIDEO_BUCKET,
} from '@/lib/applicant-video';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => null);
        const filename = (body?.filename as string | undefined)?.trim();

        if (!filename) {
            return NextResponse.json({ error: 'Video filename is required.' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        try {
            await ensureApplicantVideosBucket(supabase);
        } catch (err) {
            console.error('Applicant video bucket setup failed:', err);
            return NextResponse.json(
                { error: 'Video storage is not configured yet. Submit without a video or try again shortly.' },
                { status: 500 },
            );
        }

        const path = buildApplicantVideoPath(filename);
        const { data, error } = await supabase.storage
            .from(VIDEO_BUCKET)
            .createSignedUploadUrl(path);

        if (error || !data) {
            console.error('Signed upload URL error:', error?.message);
            return NextResponse.json(
                { error: 'Could not prepare video upload. Submit without a video or try again.' },
                { status: 500 },
            );
        }

        return NextResponse.json({
            path,
            signedUrl: data.signedUrl,
            token: data.token,
            maxBytes: MAX_VIDEO_BYTES,
            publicUrl: getApplicantVideoPublicUrl(supabase, path),
        });
    } catch (err) {
        console.error('Applicant upload-url API error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
