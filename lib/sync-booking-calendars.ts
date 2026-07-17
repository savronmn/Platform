import { createClient } from '@supabase/supabase-js';
import { type CalendarToken } from '@/lib/google-calendar';
import { deleteAllBookingCalendarEvents } from '@/lib/booking-calendar-cleanup';
import { buildBookingCalendarPayload } from '@/lib/booking-calendar-payload';
import { getServiceDurationCatalog } from '@/lib/booking-duration';
import { isShopCalendarConnected, upsertShopInviteEvent } from '@/lib/shop-calendar';
import { resolveShopBookingPage } from '@/lib/shop-booking-pages';
import { barberCalendarReady, upsertBarberCalendarBlock } from '@/lib/barber-calendar-sync';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type BarberCalendarInfo = {
    id: string;
    name: string;
    email: string | null;
    google_calendar_id: string | null;
    google_calendar_tokens: CalendarToken | null;
};

export type BookingForSync = {
    id: string;
    google_event_id: string | null;
    shop_google_event_id?: string | null;
    barber_id: string | null;
    client_email: string | null;
    client_name: string | null;
    client_phone: string | null;
    service: string;
    date: string;
    time: string;
    price: string | null;
    duration?: string | null;
    created_at?: string;
};

export type CalendarSyncResult = {
    shopEventId: string | null;
    barberEventId: string | null;
    shopError?: string;
    barberError?: string;
    barberBlockRequired: boolean;
    barberBlockSkippedForShopInvite: boolean;
    fullySynced: boolean;
};

export async function loadBookingForSync(bookingId: string): Promise<{
    booking: BookingForSync & { barbers: BarberCalendarInfo | null };
} | null> {
    const { data: booking } = await getAdmin()
        .from('bookings')
        .select('*, barbers(id, name, email, google_calendar_id, google_calendar_tokens)')
        .eq('id', bookingId)
        .single();

    if (!booking) return null;
    return { booking: booking as BookingForSync & { barbers: BarberCalendarInfo | null } };
}

export async function removeBookingFromCalendars(
    booking: BookingForSync,
    options: { barberId?: string; fallbackDate?: string; fallbackTime?: string } = {},
) {
    await deleteAllBookingCalendarEvents(booking, options);
}

async function syncShopInvite(
    booking: BookingForSync,
    barber: BarberCalendarInfo | null,
    sendInviteNotifications: boolean,
    options: { includeBarberOnInvite?: boolean } = {},
): Promise<string | null> {
    const catalog = await getServiceDurationCatalog();
    const payload = buildBookingCalendarPayload(booking, barber?.name ?? null, catalog);
    const bookingPage = await resolveShopBookingPage(booking.service);

    const barberOnConnectedCalendar = !!(barber && barberCalendarReady(barber));
    const includeBarberOnInvite = options.includeBarberOnInvite ?? !barberOnConnectedCalendar;

    const { eventId } = await upsertShopInviteEvent({
        bookingId: booking.id,
        service: booking.service,
        barberId: booking.barber_id,
        shopEventId: booking.shop_google_event_id,
        summary: bookingPage.inviteTitle,
        description: payload.clientDescription,
        location: payload.location,
        startIso: payload.startIso,
        endIso: payload.endIso,
        clientEmail: booking.client_email,
        barberEmail: includeBarberOnInvite ? (barber?.email ?? null) : null,
        barberName: includeBarberOnInvite ? (barber?.name ?? null) : null,
        sendUpdates: sendInviteNotifications ? 'all' : 'none',
    });

    if (eventId) {
        await getAdmin()
            .from('bookings')
            .update({ shop_google_event_id: eventId })
            .eq('id', booking.id);
        booking.shop_google_event_id = eventId;
    }

    return eventId;
}

async function syncBarberBlock(
    booking: BookingForSync,
    barber: BarberCalendarInfo,
): Promise<{ barberEventId: string | null; error?: string }> {
    if (!barberCalendarReady(barber)) {
        return { barberEventId: null };
    }

    try {
        const barberEventId = await upsertBarberCalendarBlock(
            booking,
            { ...barber, id: barber.id },
            { existingEventId: booking.google_event_id },
        );
        booking.google_event_id = barberEventId;
        return { barberEventId };
    } catch (error) {
        console.error('[calendar/sync] barber calendar block failed:', error);
        return { barberEventId: null, error: String(error) };
    }
}

export function bookingCalendarFullySynced(
    booking: BookingForSync,
    barber: BarberCalendarInfo | null,
    shopConnected: boolean,
): boolean {
    const barberNeedsBlock = !!(barber && barberCalendarReady(barber));
    const shopOk = !shopConnected || !!booking.shop_google_event_id;
    const barberOk = !barberNeedsBlock || !!booking.google_event_id;
    return shopOk && barberOk;
}

/** Shop invite goes to the client; barbers with connected calendars always get a native busy block on primary. */
export async function syncBookingCalendars(
    booking: BookingForSync,
    barber: BarberCalendarInfo | null,
    options: {
        shopConnected: boolean;
        forceBarber?: boolean;
        /** When false (default), repair/backfill/update syncs do not email attendees. */
        sendInviteNotifications?: boolean;
    } = { shopConnected: false },
): Promise<CalendarSyncResult> {
    let shopEventId = booking.shop_google_event_id ?? null;
    let barberEventId = booking.google_event_id ?? null;
    let shopError: string | undefined;
    let barberError: string | undefined;
    const barberBlockRequired = !!(barber && (options.forceBarber || barberCalendarReady(barber)));

    // Barber primary block first — Google Appointment Schedules (albestylesbarber.com) only
    // respect busy time on the barber's own calendar, not shop invites on savronmn@gmail.com.
    const shouldSyncBarberBlock = barber
        && (options.forceBarber || barberCalendarReady(barber));

    if (shouldSyncBarberBlock) {
        const barberResult = await syncBarberBlock(booking, barber);
        barberEventId = barberResult.barberEventId ?? barberEventId;
        barberError = barberResult.error;
        if (barberError) {
            console.error('[calendar/sync] barber block failed (continuing with shop invite):', barberError);
        }
    }

    if (options.shopConnected) {
        try {
            shopEventId = await syncShopInvite(
                booking,
                barber,
                options.sendInviteNotifications ?? false,
            );
        } catch (error) {
            shopError = String(error);
            console.error('[calendar/sync] shop calendar failed:', error);
        }
    }

    const fullySynced = bookingCalendarFullySynced(booking, barber, options.shopConnected);

    return {
        shopEventId,
        barberEventId,
        shopError,
        barberError,
        barberBlockRequired,
        barberBlockSkippedForShopInvite: false,
        fullySynced,
    };
}

export async function upsertClientCrm(booking: {
    client_name: string | null;
    client_email: string | null;
    client_phone: string | null;
    date: string;
    price: string | null;
}) {
    if (!booking.client_name) return;

    const supabaseAdmin = getAdmin();
    let query = supabaseAdmin.from('clients').select('id, total_visits, total_spent').eq('name', booking.client_name);
    if (booking.client_email) query = query.or(`email.eq.${booking.client_email}`);

    const { data: existingClients } = await query;
    const existing = existingClients?.[0];
    const priceNum = parseFloat(String(booking.price || '0').replace(/[^0-9.]/g, '')) || 0;

    if (existing) {
        await supabaseAdmin.from('clients').update({
            last_booking_date: booking.date,
            total_visits: (existing.total_visits || 0) + 1,
            total_spent: (existing.total_spent || 0) + priceNum,
            phone: booking.client_phone || undefined,
            email: booking.client_email || undefined,
        }).eq('id', existing.id);
    } else {
        await supabaseAdmin.from('clients').insert({
            name: booking.client_name,
            email: booking.client_email || null,
            phone: booking.client_phone || null,
            last_booking_date: booking.date,
            total_visits: 1,
            total_spent: priceNum,
        });
    }
}

export function buildCalendarSyncResponse(syncResult: CalendarSyncResult, extra: Record<string, unknown> = {}) {
    const hasAnyEvent = !!(syncResult.shopEventId || syncResult.barberEventId);
    const barberFailed = syncResult.barberBlockRequired && !syncResult.barberEventId;

    return {
        success: syncResult.fullySynced || hasAnyEvent,
        shopEventId: syncResult.shopEventId,
        barberEventId: syncResult.barberEventId,
        inviteModel: syncResult.shopEventId ? 'shop_booking_page' : syncResult.barberEventId ? 'barber_calendar' : undefined,
        warning: barberFailed
            ? (syncResult.barberError ?? 'Barber calendar block failed — slot may not be locked on their Google Calendar')
            : (syncResult.shopError ?? syncResult.barberError),
        barberBlockRequired: syncResult.barberBlockRequired,
        barberBlockSynced: !barberFailed,
        barberBlockSkippedForShopInvite: syncResult.barberBlockSkippedForShopInvite || undefined,
        fullySynced: syncResult.fullySynced,
        skipped: !hasAnyEvent ? true : undefined,
        reason: !hasAnyEvent ? 'no_calendar_connected' : undefined,
        ...extra,
    };
}

export type RepairBarberBlocksOptions = {
    limit?: number;
    /** Include bookings up to 90 days in the past when backfilling missing google_event_id. */
    includePast?: boolean;
    /** Re-sync future bookings that already have google_event_id. */
    resyncFuture?: boolean;
};

export type RepairBarberBlocksResult = {
    scanned: number;
    repaired: number;
    resynced: number;
    failed: number;
    errors: string[];
};

/** Backfill missing barber calendar blocks and optionally re-sync future blocks for connected barbers. */
export async function repairMissingBarberBlocks(
    options: RepairBarberBlocksOptions = {},
): Promise<RepairBarberBlocksResult> {
    const limit = options.limit ?? 500;
    const includePast = options.includePast ?? true;
    const resyncFuture = options.resyncFuture ?? true;
    const today = new Date().toISOString().slice(0, 10);
    const pastCutoff = new Date();
    pastCutoff.setDate(pastCutoff.getDate() - 90);
    const repairFromDate = includePast ? pastCutoff.toISOString().slice(0, 10) : today;

    const { data: barbers } = await getAdmin()
        .from('barbers')
        .select('id, name, email, google_calendar_id, google_calendar_tokens')
        .not('google_calendar_tokens', 'is', null)
        .not('google_calendar_id', 'is', null);

    const connectedBarberIds = (barbers ?? [])
        .filter(barber => barberCalendarReady(barber as BarberCalendarInfo))
        .map(barber => barber.id);

    if (connectedBarberIds.length === 0) {
        return { scanned: 0, repaired: 0, resynced: 0, failed: 0, errors: [] };
    }

    const admin = getAdmin();
    const bookingStatusFilter = ['confirmed', 'completed', 'no_show'] as const;

    const { data: missingBlocks } = await admin
        .from('bookings')
        .select('id')
        .in('barber_id', connectedBarberIds)
        .in('status', bookingStatusFilter)
        .is('google_event_id', null)
        .gte('date', repairFromDate)
        .order('date', { ascending: true })
        .limit(limit);

    let resyncCandidates: { id: string }[] = [];
    if (resyncFuture) {
        const { data: existingBlocks } = await admin
            .from('bookings')
            .select('id')
            .in('barber_id', connectedBarberIds)
            .in('status', bookingStatusFilter)
            .not('google_event_id', 'is', null)
            .gte('date', today)
            .order('date', { ascending: true })
            .limit(limit);

        resyncCandidates = existingBlocks ?? [];
    }

    const shopConnected = await isShopCalendarConnected();
    let repaired = 0;
    let resynced = 0;
    let failed = 0;
    const errors: string[] = [];

    const processBooking = async (row: { id: string }, mode: 'repair' | 'resync') => {
        const loaded = await loadBookingForSync(row.id);
        if (!loaded) return;

        const { booking } = loaded;
        const barber = booking.barbers;
        if (!barber || !barberCalendarReady(barber)) return;

        const syncResult = await syncBookingCalendars(booking, barber, {
            shopConnected,
            forceBarber: true,
            sendInviteNotifications: false,
        });

        if (syncResult.barberEventId) {
            if (mode === 'repair') {
                repaired += 1;
            } else {
                resynced += 1;
            }
        } else {
            failed += 1;
            errors.push(`${booking.id}: ${syncResult.barberError ?? 'unknown error'}`);
        }
    };

    for (const row of missingBlocks ?? []) {
        await processBooking(row, 'repair');
    }

    for (const row of resyncCandidates) {
        await processBooking(row, 'resync');
    }

    return {
        scanned: (missingBlocks?.length ?? 0) + resyncCandidates.length,
        repaired,
        resynced,
        failed,
        errors,
    };
}
