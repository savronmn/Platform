import { runApifyActorSync } from '@/lib/apify-client';
import { extractInstagramHandle, parseInstagramFromBio, pickBestEmail } from '@/lib/outreach-lead-classifier';

const INSTAGRAM_ACTOR = process.env.APIFY_INSTAGRAM_ACTOR_ID || 'apify~instagram-profile-scraper';

interface InstagramProfileRow {
    username?: string;
    fullName?: string;
    biography?: string;
    businessEmail?: string;
    email?: string;
    publicEmail?: string;
    externalUrl?: string;
    followersCount?: number;
}

export interface InstagramEnrichment {
    username: string;
    fullName?: string;
    email?: string;
    phone?: string;
    biography?: string;
    followersCount?: number;
}

export async function enrichInstagramProfiles(handles: string[]): Promise<Map<string, InstagramEnrichment>> {
    const usernames = Array.from(new Set(handles.map(h => extractInstagramHandle(h)).filter(Boolean) as string[])).slice(0, 20);
    if (usernames.length === 0) return new Map();

    if (!process.env.APIFY_API_TOKEN) return new Map();

    try {
        const rows = await runApifyActorSync<InstagramProfileRow>(INSTAGRAM_ACTOR, {
            usernames,
        }, { timeoutSec: 120 });

        const result = new Map<string, InstagramEnrichment>();
        for (const row of rows) {
            if (!row.username) continue;
            const bio = row.biography ?? '';
            const fromBio = parseInstagramFromBio(bio);
            const email = pickBestEmail(row.businessEmail, row.email, row.publicEmail, fromBio.email);

            result.set(row.username.toLowerCase(), {
                username: row.username,
                fullName: row.fullName,
                email: email || undefined,
                phone: fromBio.phone,
                biography: bio,
                followersCount: row.followersCount,
            });
        }
        return result;
    } catch (err) {
        console.warn('[outreach-instagram] profile scrape skipped:', err);
        return new Map();
    }
}
