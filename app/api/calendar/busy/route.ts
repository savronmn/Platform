import { NextRequest, NextResponse } from 'next/server';
import {
    getBarberAvailability,
    GoogleCalendarUnavailableError,
} from '@/lib/booking-availability';

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const barberId = searchParams.get('barberId');
    const date = searchParams.get('date');
    const excludeBookingId = searchParams.get('excludeBookingId') ?? undefined;

    if (!barberId || !date) {
        return NextResponse.json({ error: 'Missing barberId or date' }, { status: 400 });
    }

    try {
        const { busy, workingHours, googleCalendarConnected } = await getBarberAvailability(
            barberId,
            date,
            { excludeBookingId },
        );
        return NextResponse.json({ busy, workingHours, googleCalendarConnected });
    } catch (err) {
        if (err instanceof GoogleCalendarUnavailableError) {
            return NextResponse.json(
                { error: err.message, code: 'google_calendar_unavailable' },
                { status: 503 },
            );
        }
        const message = err instanceof Error ? err.message : 'Availability check failed';
        if (message === 'Barber not found') {
            return NextResponse.json({ error: message }, { status: 404 });
        }
        console.error('[calendar/busy] availability error:', err);
        return NextResponse.json({ error: 'Availability check failed' }, { status: 500 });
    }
}
