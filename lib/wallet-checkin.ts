import { updateGoogleWalletPass } from '@/lib/google-wallet';
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
    pass_updated_at: string;
}

/** After a visit is recorded, sync Google Wallet, Apple Wallet, and the /epass web view. */
export async function syncWalletsAfterCheckin(
    subscriber: SubscriberRow,
    newCount: number,
    lastVisitAt: string,
): Promise<WalletSyncResult> {
    let google_wallet_updated = false;

    if (subscriber.google_pass_object_id) {
        google_wallet_updated = await updateGoogleWalletPass(
            subscriber.google_pass_object_id,
            subscriber.name,
            subscriber.email,
            newCount,
        );
    }

    const { pass_updated_at, apple_devices_notified } = await notifyWalletPassesUpdated(
        subscriber.id,
        subscriber.pass_serial_number,
    );

    await broadcastEpassVisitUpdate(subscriber.email, {
        visit_count: newCount,
        last_visit_at: lastVisitAt,
    });

    return {
        google_wallet_updated,
        apple_devices_notified,
        pass_updated_at,
    };
}
