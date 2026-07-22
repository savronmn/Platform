/** Classify Apify/Google leads as individual barbers vs barbershop businesses. */

const SHOP_KEYWORDS = /\b(barbershop|barber shop|barber\s*shop|hair salon|beauty salon|salon|lounge|studio|cutz|kuts|cuts|factory|collective|team|& co|company|llc|inc|barbering|grooming|grooming lounge|haircut|hair cut|clippers|sharp cuts|fade factory|barber co|barbers)\b/i;

const PERSON_NAME_PATTERN = /^[A-Z][a-z]+(?:['\-\s][A-Z]?[a-z]+){0,3}$/;

const GENERIC_LOCAL_PARTS = /^(info|contact|hello|support|admin|office|booking|book|appointments|appoint|noreply|no-reply|mail|sales|team|help|service|customerservice|reservations)$/i;

const PLATFORM_EMAIL_DOMAINS = /\b(booksy|squarespace|square|styleseat|vagaro|schedulicity|fresha|mindbody|setmore|acuity|wixpress|godaddy|weebly|wordpress|mailchimp|constantcontact)\b/i;

const PERSONAL_EMAIL_DOMAINS = /^(gmail|yahoo|outlook|hotmail|icloud|live|aol|protonmail|proton|me|mac)\./i;

export type ProspectType = 'individual' | 'shop';
export type EmailSource = 'maps' | 'website' | 'instagram' | 'reviews' | 'manual' | 'savron';

export function classifyProspectType(name: string, categoryName?: string): ProspectType {
    const haystack = `${name} ${categoryName ?? ''}`.trim();
    if (!haystack) return 'shop';

    const lower = haystack.toLowerCase();

    if (SHOP_KEYWORDS.test(lower)) return 'shop';

    if (/\b(barber|stylist|groomer)\b/i.test(lower) && looksLikePersonName(name.split(/\s*[-–|]\s*/)[0]?.trim() || name)) {
        return 'individual';
    }

    const primary = name.split(/\s*[-–|@]\s*/)[0]?.trim() || name;
    if (looksLikePersonName(primary) && !SHOP_KEYWORDS.test(primary)) {
        return 'individual';
    }

    if (primary.startsWith('@')) return 'individual';

    return 'shop';
}

function looksLikePersonName(value: string): boolean {
    const cleaned = value.replace(/^@/, '').trim();
    if (!cleaned || cleaned.length > 40) return false;
    if (SHOP_KEYWORDS.test(cleaned)) return false;
    if (/^\d/.test(cleaned)) return false;

    const words = cleaned.split(/\s+/);
    if (words.length >= 1 && words.length <= 4) {
        const first = words[0];
        if (/^[A-Z][a-z]{1,20}$/.test(first)) return true;
        if (PERSON_NAME_PATTERN.test(cleaned)) return true;
    }

    return false;
}

export function extractInstagramHandle(value?: string | null): string | null {
    if (!value?.trim()) return null;
    const v = value.trim();

    const urlMatch = v.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
    if (urlMatch) return urlMatch[1].replace(/\/$/, '');

    if (v.startsWith('@')) return v.slice(1).split('/')[0];

    if (/^[a-zA-Z0-9._]{2,30}$/.test(v) && !v.includes(' ')) return v;

    return null;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const MAILTO_REGEX = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

/** Decode common obfuscated email formats in page text. */
function deobfuscateEmailText(text: string): string {
    return text
        .replace(/\(\s*at\s*\)|\[\s*at\s*\]|\s+at\s+/gi, '@')
        .replace(/\(\s*dot\s*\)|\[\s*dot\s*\]|\s+dot\s+/gi, '.')
        .replace(/([a-z0-9._%+-]+)\s*@\s*([a-z0-9.-]+)\s*\.\s*([a-z]{2,})/gi, '$1@$2.$3');
}

export function extractEmailsFromText(text: string): string[] {
    const normalized = deobfuscateEmailText(text);
    const fromMailto = Array.from(normalized.matchAll(MAILTO_REGEX)).map(m => m[1]);
    const fromPlain = normalized.match(EMAIL_REGEX) ?? [];
    const all = [...fromMailto, ...fromPlain].map(e => e.toLowerCase().trim());
    return Array.from(new Set(all)).filter(isValidReachableEmail);
}

export function isValidReachableEmail(email: string): boolean {
    if (!email.includes('@')) return false;
    const lower = email.toLowerCase();
    if (lower.endsWith('@example.com') || lower.includes('example-barber') || lower.includes('example.')) return false;
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.webp')) return false;
    if (lower.includes('sentry.io') || lower.includes('wix.com') || lower.includes('schema.org')) return false;
    return true;
}

function scoreEmail(email: string, contextName?: string): number {
    const lower = email.toLowerCase();
    const [localPart, domain] = lower.split('@');
    if (!localPart || !domain) return -100;

    let score = 0;

    if (PERSONAL_EMAIL_DOMAINS.test(domain)) score += 12;
    if (GENERIC_LOCAL_PARTS.test(localPart)) score -= 8;
    if (PLATFORM_EMAIL_DOMAINS.test(domain)) score -= 12;
    if (localPart.includes('noreply') || localPart.includes('no-reply')) score -= 15;

    if (contextName) {
        const nameParts = contextName.toLowerCase().replace(/^@/, '').split(/\s+/).filter(p => p.length > 2);
        for (const part of nameParts) {
            if (localPart.includes(part)) score += 6;
        }
    }

    // Prefer shorter personal-looking addresses over long auto-generated ones
    if (localPart.length <= 20) score += 2;
    if (localPart.length > 30) score -= 4;

    return score;
}

export function pickBestEmail(contextName?: string, ...candidates: (string | undefined | null)[]): string {
    const valid = candidates
        .flatMap(c => (c ? [c.trim().toLowerCase()] : []))
        .filter(isValidReachableEmail);

    if (valid.length === 0) return '';

    const unique = Array.from(new Set(valid));
    unique.sort((a, b) => scoreEmail(b, contextName) - scoreEmail(a, contextName));
    return unique[0];
}

export function pickBestEmailWithSource(
    contextName: string | undefined,
    sources: Array<{ email: string | undefined | null; source?: EmailSource }>,
): { email: string; source?: EmailSource } {
    const ranked = sources
        .flatMap(({ email, source }) => {
            if (!email || !isValidReachableEmail(email)) return [];
            return [{ email: email.trim().toLowerCase(), source }];
        })
        .sort((a, b) => scoreEmail(b.email, contextName) - scoreEmail(a.email, contextName));

    if (ranked.length === 0) return { email: '' };
    return { email: ranked[0].email, source: ranked[0].source };
}

export function parseInstagramFromBio(bio: string): { email?: string; phone?: string } {
    const email = extractEmailsFromText(bio)[0];
    const phoneMatch = bio.match(/(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    return {
        email,
        phone: phoneMatch?.[0],
    };
}

/** Normalize URLs for matching crawled content back to prospect websites. */
export function normalizeWebsiteUrl(url: string): string {
    try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
        const path = parsed.pathname.replace(/\/$/, '') || '';
        return `${host}${path}`;
    } catch {
        return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '').toLowerCase();
    }
}

export function buildContactPageUrls(website: string): string[] {
    if (!website.startsWith('http')) return [];
    const base = website.replace(/\/$/, '');
    return Array.from(new Set([
        base,
        `${base}/contact`,
        `${base}/contact-us`,
        `${base}/about`,
        `${base}/book`,
        `${base}/booking`,
    ]));
}

export function qualityTier(prospect: { rating?: number | null; reviewCount?: number | null; reputationScore?: number | null }): 'great' | 'good' | 'unknown' {
    const rating = prospect.rating ?? 0;
    const reviews = prospect.reviewCount ?? 0;
    const rep = prospect.reputationScore ?? rating;

    if (rep >= 4.5 && reviews >= 10) return 'great';
    if (rating >= 4.0 && reviews >= 3) return 'good';
    if (rating >= 4.0) return 'good';
    return 'unknown';
}
