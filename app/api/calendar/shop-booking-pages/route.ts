// GET  /api/calendar/shop-booking-pages — list service booking pages on shop calendar
// POST /api/calendar/shop-booking-pages — provision one Google Calendar per active service (staff)

import { NextRequest, NextResponse } from 'next/server';
import { isShopCalendarConnected } from '@/lib/shop-calendar';
import { listShopBookingPages, provisionShopBookingPageCalendars } from '@/lib/shop-booking-pages';
import { requireStaff } from '@/lib/staff-auth';

export async function GET() {
    const staff = await requireStaff();
    if (!staff.ok) {
        return NextResponse.json({ error: staff.error }, { status: staff.status });
    }

    const connected = await isShopCalendarConnected();
    const pages = await listShopBookingPages();

    return NextResponse.json({
        connected,
        organizer: 'savronmn@gmail.com',
        pages: pages.map(page => ({
            serviceName: page.serviceName,
            slug: page.slug,
            calendarId: page.calendarId,
            inviteTitle: page.inviteTitle,
            durationMinutes: page.durationMinutes,
            hasDedicatedCalendar: page.calendarId.includes('@group.calendar.google.com'),
        })),
    });
}

export async function POST(request: NextRequest) {
    const staff = await requireStaff();
    if (!staff.ok) {
        return NextResponse.json({ error: staff.error }, { status: staff.status });
    }

    const connected = await isShopCalendarConnected();
    if (!connected) {
        return NextResponse.json(
            {
                error: 'Shop Google Calendar is not connected. Open /api/calendar/connect-shop while logged into savronmn@gmail.com.',
            },
            { status: 503 },
        );
    }

    try {
        const result = await provisionShopBookingPageCalendars();
        return NextResponse.json({
            success: result.errors.length === 0,
            ...result,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to provision booking pages';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
