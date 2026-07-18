/** Shared Apify REST helpers for sync actor runs. */

export async function runApifyActorSync<T = unknown>(
    actorId: string,
    input: Record<string, unknown>,
    options?: { timeoutSec?: number },
): Promise<T[]> {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
        throw new Error('Apify is not configured. Set APIFY_API_TOKEN in environment variables.');
    }

    const timeout = options?.timeoutSec ?? 300;
    const response = await fetch(
        `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=${timeout}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        },
    );

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Apify actor ${actorId} failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const rows = await response.json();
    if (!Array.isArray(rows)) {
        throw new Error(`Apify actor ${actorId} returned unexpected data`);
    }

    return rows as T[];
}
