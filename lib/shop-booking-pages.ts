import { createClient } from '@supabase/supabase-js';
import { getValidAccessToken } from '@/lib/google-calendar';
import { getShopCalendarId, getShopCalendarTokens } from '@/lib/shop-calendar';
import { SHOP_NAME } from '@/lib/shop';

const GOOGLE_CALENDAR_BASE = 'https://www.googleapis.com/calendar/v3';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export type ShopBookingPage = {
    serviceId: string;
    serviceName: string;
    durationMinutes: number;
    slug: string;
    calendarId: string;
    inviteTitle: string;
};

function slugifyServiceName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) || 'service';
}

/** Resolve the primary service name from a compound booking string ("Signature Cut, Eyebrows"). */
export function primaryServiceName(service: string): string {
    const first = service.split(',')[0]?.trim();
    return first || service.trim();
}

export async function resolveShopBookingPage(service: string): Promise<ShopBookingPage> {
    const name = primaryServiceName(service);
    const admin = getAdmin();

    const { data: row } = await admin
        .from('services')
        .select('id, name, duration_minutes, shop_calendar_id, booking_page_slug')
        .eq('name', name)
        .eq('active', true)
        .maybeSingle();

    const defaultCalendarId = await getShopCalendarId();
    if (!row) {
        return {
            serviceId: '',
            serviceName: name,
            durationMinutes: 45,
            slug: slugifyServiceName(name),
            calendarId: defaultCalendarId,
            inviteTitle: `${name} · ${SHOP_NAME}`,
        };
    }

    const slug = row.booking_page_slug ?? slugifyServiceName(row.name);
    return {
        serviceId: row.id,
        serviceName: row.name,
        durationMinutes: row.duration_minutes,
        slug,
        calendarId: row.shop_calendar_id ?? defaultCalendarId,
        inviteTitle: `${row.name} · ${SHOP_NAME}`,
    };
}

/** List all active services with their shop booking page calendar mapping. */
export async function listShopBookingPages(): Promise<ShopBookingPage[]> {
    const admin = getAdmin();
    const defaultCalendarId = await getShopCalendarId();

    const { data: services } = await admin
        .from('services')
        .select('id, name, duration_minutes, shop_calendar_id, booking_page_slug')
        .eq('active', true)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    return (services ?? []).map(row => {
        const slug = row.booking_page_slug ?? slugifyServiceName(row.name);
        return {
            serviceId: row.id,
            serviceName: row.name,
            durationMinutes: row.duration_minutes,
            slug,
            calendarId: row.shop_calendar_id ?? defaultCalendarId,
            inviteTitle: `${row.name} · ${SHOP_NAME}`,
        };
    });
}

export type ProvisionBookingPagesResult = {
    created: number;
    updated: number;
    pages: Array<{ serviceName: string; calendarId: string; slug: string }>;
    errors: string[];
};

/** Create one secondary calendar per active service on savronmn@gmail.com (shop OAuth). */
export async function provisionShopBookingPageCalendars(): Promise<ProvisionBookingPagesResult> {
    const tokens = await getShopCalendarTokens();
    if (!tokens) {
        throw new Error('Shop Google Calendar is not connected. Connect savronmn@gmail.com first.');
    }

    const accessToken = await getValidAccessToken(tokens);
    const admin = getAdmin();
    const { data: services } = await admin
        .from('services')
        .select('id, name, shop_calendar_id, booking_page_slug')
        .eq('active', true)
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

    let created = 0;
    let updated = 0;
    const pages: ProvisionBookingPagesResult['pages'] = [];
    const errors: string[] = [];

    for (const service of services ?? []) {
        const slug = service.booking_page_slug ?? slugifyServiceName(service.name);
        let calendarId = service.shop_calendar_id;

        try {
            if (!calendarId) {
                calendarId = await createShopSecondaryCalendar(
                    accessToken,
                    `SAVRON · ${service.name}`,
                    `Booking page calendar for ${service.name} appointments at ${SHOP_NAME}.`,
                );
                created += 1;
            }

            await admin
                .from('services')
                .update({
                    shop_calendar_id: calendarId,
                    booking_page_slug: slug,
                })
                .eq('id', service.id);

            updated += 1;
            pages.push({ serviceName: service.name, calendarId, slug });
        } catch (err) {
            errors.push(`${service.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    return { created, updated, pages, errors };
}

async function createShopSecondaryCalendar(
    accessToken: string,
    summary: string,
    description: string,
): Promise<string> {
    const res = await fetch(`${GOOGLE_CALENDAR_BASE}/calendars`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            summary,
            description,
            timeZone: 'America/Chicago',
        }),
    });

    const data = await res.json();
    if (!data.id) {
        throw new Error(`Failed to create calendar: ${JSON.stringify(data)}`);
    }
    return data.id as string;
}

/** Calendar IDs for all shop booking pages — used when reading busy time from the shop account. */
export async function listShopBookingPageCalendarIds(): Promise<string[]> {
    const pages = await listShopBookingPages();
    const defaultId = await getShopCalendarId();
    const ids = new Set<string>([defaultId]);
    for (const page of pages) {
        if (page.calendarId) ids.add(page.calendarId);
    }
    return Array.from(ids);
}
