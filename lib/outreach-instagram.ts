import { runApifyActorSync } from '@/lib/apify-client';
import { extractEmailsFromText, extractInstagramHandle, parseInstagramFromBio, pickBestEmail } from '@/lib/outreach-lead-classifier';

const INSTAGRAM_ACTOR = process.env.APIFY_INSTAGRAM_ACTOR_ID || 'apify~instagram-profile-scraper';
const BATCH_SIZE = 25;

interface InstagramExternalLink {
    url?: string;
    title?: string;
}

interface InstagramProfileRow {
    username?: string;
    fullName?: string;
    biography?: string;
    businessEmail?: string;
    email?: string;
    publicEmail?: string;
    externalUrl?: string;
    externalUrls?: InstagramExternalLink[];
    followersCount?: number;
}

export interface InstagramEnrichment {
    username: string;
    fullName?: string;
    email?: string;
    phone?: string;
    biography?: string;
    followersCount?: number;
    externalUrl?: string;
}

function collectProfileEmails(row: InstagramProfileRow): string[] {
    const bio = row.biography ?? '';
    const fromBio = parseInstagramFromBio(bio);
    const linkText = (row.externalUrls ?? [])
        .map(link => link.url ?? '')
        .join(' ');

    return [
        row.businessEmail,
        row.email,
        row.publicEmail,
        fromBio.email,
        ...extractEmailsFromText(bio),
        ...extractEmailsFromText(linkText),
    ].filter(Boolean) as string[];
}

async function scrapeInstagramBatch(usernames: string[]): Promise<InstagramProfileRow[]> {
    if (usernames.length === 0) return [];

    return runApifyActorSync<InstagramProfileRow>(INSTAGRAM_ACTOR, {
        usernames,
    }, { timeoutSec: 120 });
}

export async function enrichInstagramProfiles(handles: string[], limit = 100): Promise<Map<string, InstagramEnrichment>> {
    const usernames = Array.from(new Set(handles.map(h => extractInstagramHandle(h)).filter(Boolean) as string[])).slice(0, limit);
    if (usernames.length === 0) return new Map();

    if (!process.env.APIFY_API_TOKEN) return new Map();

    const result = new Map<string, InstagramEnrichment>();

    try {
        for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
            const batch = usernames.slice(i, i + BATCH_SIZE);
            const rows = await scrapeInstagramBatch(batch);

            for (const row of rows) {
                if (!row.username) continue;
                const bio = row.biography ?? '';
                const fromBio = parseInstagramFromBio(bio);
                const email = pickBestEmail(row.fullName, ...collectProfileEmails(row));

                result.set(row.username.toLowerCase(), {
                    username: row.username,
                    fullName: row.fullName,
                    email: email || undefined,
                    phone: fromBio.phone,
                    biography: bio,
                    followersCount: row.followersCount,
                    externalUrl: row.externalUrl ?? row.externalUrls?.[0]?.url,
                });
            }
        }
        return result;
    } catch (err) {
        console.error('[outreach-instagram] profile scrape failed:', err);
        return result;
    }
}
