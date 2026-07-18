/** Classify Apify/Google leads as individual barbers vs barbershop businesses. */

const SHOP_KEYWORDS = /\b(barbershop|barber shop|barber\s*shop|hair salon|beauty salon|salon|lounge|studio|cutz|kuts|cuts|factory|collective|team|& co|company|llc|inc|barbering|grooming|grooming lounge|haircut|hair cut|clippers|sharp cuts|fade factory|barber co|barbers)\b/i;

const PERSON_NAME_PATTERN = /^[A-Z][a-z]+(?:['\-\s][A-Z]?[a-z]+){0,3}$/;

export type ProspectType = 'individual' | 'shop';

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

export function extractEmailsFromText(text: string): string[] {
    const matches = text.match(EMAIL_REGEX) ?? [];
    return Array.from(new Set(matches.map(e => e.toLowerCase()))).filter(isValidReachableEmail);
}

export function isValidReachableEmail(email: string): boolean {
    if (!email.includes('@')) return false;
    const lower = email.toLowerCase();
    if (lower.endsWith('@example.com') || lower.includes('example-barber') || lower.includes('example.')) return false;
    if (lower.endsWith('.png') || lower.endsWith('.jpg')) return false;
    return true;
}

export function pickBestEmail(...candidates: (string | undefined | null)[]): string {
    for (const c of candidates) {
        if (c && isValidReachableEmail(c.trim().toLowerCase())) {
            return c.trim().toLowerCase();
        }
    }
    return '';
}

export function parseInstagramFromBio(bio: string): { email?: string; phone?: string } {
    const email = extractEmailsFromText(bio)[0];
    const phoneMatch = bio.match(/(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    return {
        email,
        phone: phoneMatch?.[0],
    };
}
