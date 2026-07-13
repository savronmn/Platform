import { createClient } from '@supabase/supabase-js';
import {
    createCalendarEvent,
    updateCalendarEvent,
    getValidAccessToken,
    type CalendarToken,
} from '@/lib/google-calendar';
import { SHOP_CALENDAR_DISPLAY_NAME, SHOP_CALENDAR_EMAIL } from '@/lib/shop';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function parseShopTokensFromEnv(): CalendarToken | null {
    const raw = process.env.SAVRON_GOOGLE_CALENDAR_TOKENS;
    if (!raw) return null;
    try {
        return JSON.parse(raw) as CalendarToken;
    } catch {
        console.error('[shop-calendar] Invalid SAVRON_GOOGLE_CALENDAR_TOKENS JSON');
        return null;
    }
}

export async function getShopCalendarTokens(): Promise<CalendarToken | null> {
    const fromEnv = parseShopTokensFromEnv();
    if (fromEnv) return fromEnv;

    const supabase = getAdmin();
    const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'savron_google_calendar_tokens')
        .maybeSingle();

    if (!data?.value) return null;
    return data.value as CalendarToken;
}

export async function getShopCalendarId(): Promise<string> {
    const supabase = getAdmin();
    const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'savron_google_calendar_id')
        .maybeSingle();

    if (data?.value && typeof data.value === 'string') return data.value;
    return process.env.SAVRON_GOOGLE_CALENDAR_ID || SHOP_CALENDAR_EMAIL;
}

export async function isShopCalendarConnected(): Promise<boolean> {
    const tokens = await getShopCalendarTokens();
    return !!tokens;
}

export interface ShopWebhookState {
    channel_id: string;
    resource_id: string;
    sync_token: string;
}

const SHOP_WEBHOOK_KEY = 'savron_google_calendar_webhook';

export async function getShopWebhookState(): Promise<ShopWebhookState | null> {
    const supabase = getAdmin();
    const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', SHOP_WEBHOOK_KEY)
        .maybeSingle();

    if (!data?.value || typeof data.value !== 'object') return null;
    const value = data.value as Partial<ShopWebhookState>;
    if (!value.channel_id || !value.resource_id || !value.sync_token) return null;
    return value as ShopWebhookState;
}

export async function saveShopWebhookState(state: ShopWebhookState): Promise<void> {
    const supabase = getAdmin();
    await supabase.from('system_config').upsert({
        key: SHOP_WEBHOOK_KEY,
        value: state,
        updated_at: new Date().toISOString(),
    });
}

/** Persist a new sync token only if no other webhook handler advanced it first. */
export async function saveShopSyncTokenIfUnchanged(
    channelId: string,
    resourceId: string,
    previousSyncToken: string,
    nextSyncToken: string,
): Promise<boolean> {
    const current = await getShopWebhookState();
    if (!current || current.channel_id !== channelId || current.sync_token !== previousSyncToken) {
        return false;
    }
    await saveShopWebhookState({
        channel_id: channelId,
        resource_id: resourceId,
        sync_token: nextSyncToken,
    });
    return true;
}

/** Create/update the shop Google Calendar invite — client + barber attendees, emails from savronmn@gmail.com. */
export async function upsertShopInviteEvent(params: {
    bookingId: string;
    shopEventId?: string | null;
    summary: string;
    description: string;
    location: string;
    startIso: string;
    endIso: string;
    clientEmail: string | null;
    barberEmail?: string | null;
}): Promise<string | null> {
    const tokens = await getShopCalendarTokens();
    if (!tokens) return null;

    const accessToken = await getValidAccessToken(tokens);
    const calendarId = await getShopCalendarId();

    const shopEmail = SHOP_CALENDAR_EMAIL.toLowerCase();
    const attendeeEmails = Array.from(new Set(
        [params.clientEmail, params.barberEmail]
            .filter((email): email is string => !!email && email.toLowerCase() !== shopEmail),
    ));

    // Google Calendar invite is the client + barber confirmation channel.
    const sendUpdates = attendeeEmails.length > 0 ? 'all' as const : 'none' as const;

    const organizer = {
        organizerEmail: SHOP_CALENDAR_EMAIL,
        organizerDisplayName: SHOP_CALENDAR_DISPLAY_NAME,
    };

    if (params.shopEventId) {
        try {
            return await updateCalendarEvent(
                accessToken,
                calendarId,
                params.shopEventId,
                {
                    summary: params.summary,
                    description: params.description,
                    location: params.location,
                    startIso: params.startIso,
                    endIso: params.endIso,
                    attendeeEmails,
                    bookingId: params.bookingId,
                    ...organizer,
                },
                sendUpdates,
            );
        } catch (err) {
            console.warn('[shop-calendar] Update failed; creating new invite event:', err);
        }
    }

    return createCalendarEvent(
        accessToken,
        calendarId,
        {
            summary: params.summary,
            description: params.description,
            location: params.location,
            startIso: params.startIso,
            endIso: params.endIso,
            attendeeEmails,
            bookingId: params.bookingId,
            ...organizer,
        },
        sendUpdates,
    );
}
