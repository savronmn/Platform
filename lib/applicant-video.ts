import type { SupabaseClient } from '@supabase/supabase-js';

export const VIDEO_BUCKET = 'applicant-videos';
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function ensureApplicantVideosBucket(supabase: SupabaseClient) {
    const { data: bucket } = await supabase.storage.getBucket(VIDEO_BUCKET);
    if (bucket) return;

    const { error } = await supabase.storage.createBucket(VIDEO_BUCKET, {
        public: true,
        fileSizeLimit: '100MB',
    });

    if (!error || error.message.toLowerCase().includes('already exists')) {
        return;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
        const res = await fetch(`${url}/storage/v1/bucket`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ id: VIDEO_BUCKET, name: VIDEO_BUCKET, public: true }),
        });

        if (res.ok || res.status === 409) {
            return;
        }
    }

    throw new Error(error.message);
}

export function sanitizeVideoFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function buildApplicantVideoPath(filename: string): string {
    return `${Date.now()}_${sanitizeVideoFilename(filename)}`;
}

export function getApplicantVideoPublicUrl(supabase: SupabaseClient, path: string): string {
    const { data } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
    return data.publicUrl;
}
