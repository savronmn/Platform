import { createClient } from '@supabase/supabase-js';
import {
    createCalendarEvent,
    updateCalendarEvent,
    getValidAccessToken,
    type CalendarAttendee,
    type CalendarSendUpdates,
    type CalendarToken,
} from '@/lib/google-calendar';
import { SHOP_CALENDAR_DISPLAY_NAME, SHOP_CALENDAR_EMAIL, SHOP_GOOGLE_CALENDAR_ID } from '@/lib/shop';
import { resolveShopBookingPage } from '@/lib/shop-booking-pages';

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
    const supabase = getAdmin();
    const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'savron_google_calendar_tokens')
        .maybeSingle();

    if (data?.value) return data.value as CalendarToken;

    return parseShopTokensFromEnv();
}

export async function getShopCalendarId(): Promise<string> {
    const supabase = getAdmin();
    const { data } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'savron_google_calendar_id')
        .maybeSingle();

    if (data?.value && typeof data.value === 'string') return data.value;
    return process.env.SAVRON_GOOGLE_CALENDAR_ID || SHOP_GOOGLE_CALENDAR_ID;
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

function buildShopInviteAttendees(params: {
    clientEmail: string | null;
    barberEmail: string | null;
    barberName: string | null;
}): CalendarAttendee[] {
    const shopEmail = SHOP_CALENDAR_EMAIL.toLowerCase();
    const attendees: CalendarAttendee[] = [];

    if (params.clientEmail && params.clientEmail.toLowerCase() !== shopEmail) {
        attendees.push({
            email: params.clientEmail,
            responseStatus: 'needsAction',
        });
    }

    if (params.barberEmail && params.barberEmail.toLowerCase() !== shopEmail) {
        attendees.push({
            email: params.barberEmail,
            displayName: params.barberName ?? undefined,
            responseStatus: 'accepted',
        });
    }

    return attendees;
}

/**
 * Create/update a shop booking-page calendar invite from savronmn@gmail.com.
 * Client + barber both receive the same Google Calendar invite (organizer: SAVRON shop).
 */
export async function upsertShopInviteEvent(params: {
    bookingId: string;
    service: string;
    barberId: string | null;
    shopEventId?: string | null;
    summary: string;
    description: string;
    location: string;
    startIso: string;
    endIso: string;
    clientEmail: string | null;
    barberEmail?: string | null;
    barberName?: string | null;
    /** Default 'none' — only set 'all' when sending a brand-new client invite. */
    sendUpdates?: CalendarSendUpdates;
}): Promise<{ eventId: string | null; calendarId: string | null; bookingPageSlug: string | null }> {
    const tokens = await getShopCalendarTokens();
    if (!tokens) return { eventId: null, calendarId: null, bookingPageSlug: null };

    const accessToken = await getValidAccessToken(tokens);
    const bookingPage = await resolveShopBookingPage(params.service);
    const calendarId = bookingPage.calendarId;

    const attendees = buildShopInviteAttendees({
        clientEmail: params.clientEmail,
        barberEmail: params.barberEmail ?? null,
        barberName: params.barberName ?? null,
    });

    const sendUpdates: CalendarSendUpdates = params.sendUpdates ?? 'none';

    const organizer = {
        organizerEmail: SHOP_CALENDAR_EMAIL,
        organizerDisplayName: SHOP_CALENDAR_DISPLAY_NAME,
    };

    const privateExtendedProperties: Record<string, string> = {
        savronBookingPageSlug: bookingPage.slug,
        savronService: bookingPage.serviceName,
    };
    if (params.barberId) {
        privateExtendedProperties.savronBarberId = params.barberId;
    }

    const eventInput = {
        summary: params.summary,
        description: params.description,
        location: params.location,
        startIso: params.startIso,
        endIso: params.endIso,
        attendees,
        bookingId: params.bookingId,
        privateExtendedProperties,
        ...organizer,
    };

    let eventId: string;
    if (params.shopEventId) {
        try {
            eventId = await updateCalendarEvent(
                accessToken,
                calendarId,
                params.shopEventId,
                eventInput,
                sendUpdates,
            );
        } catch (err) {
            console.warn('[shop-calendar] Update failed; creating new booking-page invite:', err);
            eventId = await createCalendarEvent(
                accessToken,
                calendarId,
                eventInput,
                sendUpdates,
            );
        }
    } else {
        eventId = await createCalendarEvent(
            accessToken,
            calendarId,
            eventInput,
            sendUpdates,
        );
    }

    return { eventId, calendarId, bookingPageSlug: bookingPage.slug };
}
