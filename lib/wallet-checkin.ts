import { createClient } from '@supabase/supabase-js';
import {
    buildGoogleObjectId,
    createGooglePassObject,
    isGoogleWalletConfigured,
    updateGoogleWalletPass,
} from '@/lib/google-wallet';
import { broadcastEpassVisitUpdate } from '@/lib/epass-broadcast';
import { notifyWalletPassesUpdated } from '@/lib/apple-wallet';

interface SubscriberRow {
    id: string;
    name: string;
    email: string;
    visit_count: number;
    pass_serial_number: string;
    google_pass_object_id?: string | null;
}

export interface WalletSyncResult {
    google_wallet_updated: boolean;
    apple_devices_notified: number;
    apple_devices_registered: number;
    pass_updated_at: string;
    wallet_sync_errors?: string[];
}

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

async function fetchSubscriberForSync(subscriberId: string): Promise<SubscriberRow | null> {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
        .from('email_subscribers')
        .select('id, name, email, visit_count, pass_serial_number, google_pass_object_id')
        .eq('id', subscriberId)
        .eq('active', true)
        .maybeSingle();

    return data;
}

/** Create a Google Wallet object when signup missed storing google_pass_object_id. */
async function ensureGooglePassObjectId(
    subscriber: SubscriberRow,
    visitCount: number,
): Promise<string | null> {
    if (subscriber.google_pass_object_id) {
        return subscriber.google_pass_object_id;
    }
    if (!isGoogleWalletConfigured()) return null;

    const objectId = buildGoogleObjectId();
    if (!objectId) return null;

    const created = await createGooglePassObject(
        objectId,
        subscriber.name,
        subscriber.email,
        visitCount,
    );
    if (!created) return null;

    const supabase = getSupabaseAdmin();
    await supabase
        .from('email_subscribers')
        .update({ google_pass_object_id: objectId })
        .eq('id', subscriber.id);

    return objectId;
}

/** After a visit is recorded (or retried), sync Google Wallet, Apple Wallet, and the /epass web view. */
export async function syncWalletsAfterCheckin(
    subscriber: SubscriberRow,
    newCount: number,
    lastVisitAt: string,
): Promise<WalletSyncResult> {
    const syncErrors: string[] = [];
    const fresh = await fetchSubscriberForSync(subscriber.id);
    const row = fresh ?? subscriber;
    const visitCount = fresh?.visit_count ?? newCount;

    let google_wallet_updated = false;
    try {
        const googleObjectId = await ensureGooglePassObjectId(row, visitCount);
        if (googleObjectId) {
            google_wallet_updated = await updateGoogleWalletPass(
                googleObjectId,
                row.name,
                row.email,
                visitCount,
            );
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[wallet-checkin] Google Wallet sync failed (non-fatal):', msg);
        syncErrors.push(`google: ${msg}`);
    }

    let pass_updated_at = new Date().toISOString();
    let apple_devices_notified = 0;
    let apple_devices_registered = 0;
    try {
        const appleResult = await notifyWalletPassesUpdated(
            row.id,
            row.pass_serial_number,
        );
        pass_updated_at = appleResult.pass_updated_at;
        apple_devices_notified = appleResult.apple_devices_notified;
        apple_devices_registered = appleResult.apple_devices_registered;
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[wallet-checkin] Apple Wallet sync failed (non-fatal):', msg);
        syncErrors.push(`apple: ${msg}`);
    }

    try {
        await broadcastEpassVisitUpdate(row.email, {
            visit_count: visitCount,
            last_visit_at: lastVisitAt,
        });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[wallet-checkin] ePass broadcast failed (non-fatal):', msg);
        syncErrors.push(`epass: ${msg}`);
    }

    return {
        google_wallet_updated,
        apple_devices_notified,
        apple_devices_registered,
        pass_updated_at,
        ...(syncErrors.length ? { wallet_sync_errors: syncErrors } : {}),
    };
}
