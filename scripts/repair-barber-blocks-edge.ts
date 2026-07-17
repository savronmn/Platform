/**
 * Standalone repair runner — use with production env vars:
 *   npx tsx scripts/repair-barber-blocks-edge.ts
 */
import { repairMissingBarberBlocks } from '../lib/sync-booking-calendars';

async function main() {
    const required = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
    ];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length) {
        console.error('Missing env:', missing.join(', '));
        process.exit(1);
    }

    console.log('[repair] Starting barber calendar block backfill…');
    const result = await repairMissingBarberBlocks({
        limit: 500,
        includePast: true,
        resyncFuture: true,
    });
    console.log(JSON.stringify(result, null, 2));
}

main().catch(err => {
    console.error('[repair] Failed:', err);
    process.exit(1);
});
