import { createClient } from '@supabase/supabase-js';

export interface EpassVisitPayload {
    visit_count: number;
    last_visit_at: string | null;
}

function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
}

/** Push a live visit update to any open /epass session for this member. */
export async function broadcastEpassVisitUpdate(
    email: string,
    payload: EpassVisitPayload,
): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = getSupabaseAdmin();
    const channelName = `epass:${normalizedEmail}`;
    const channel = supabase.channel(channelName);

    try {
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Broadcast subscribe timeout')), 5000);
            channel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    clearTimeout(timeout);
                    resolve();
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    clearTimeout(timeout);
                    reject(new Error(`Broadcast channel ${status}`));
                }
            });
        });

        await channel.send({
            type: 'broadcast',
            event: 'visit_update',
            payload: {
                email: normalizedEmail,
                ...payload,
            },
        });
    } catch (err) {
        console.warn('[ePass] Broadcast failed (non-fatal):', err);
    } finally {
        await supabase.removeChannel(channel);
    }
}
