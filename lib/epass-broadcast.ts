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

async function sendBroadcastOnce(
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

        const sendStatus = await channel.send({
            type: 'broadcast',
            event: 'visit_update',
            payload: {
                email: normalizedEmail,
                ...payload,
            },
        });

        if (sendStatus !== 'ok') {
            throw new Error(`Broadcast send status: ${sendStatus}`);
        }
    } finally {
        await supabase.removeChannel(channel);
    }
}

/** Push a live visit update to any open /epass session for this member. */
export async function broadcastEpassVisitUpdate(
    email: string,
    payload: EpassVisitPayload,
): Promise<void> {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            await sendBroadcastOnce(email, payload);
            return;
        } catch (err) {
            if (attempt === 2) {
                console.warn('[ePass] Broadcast failed after retries (non-fatal):', err);
            }
        }
    }
}
