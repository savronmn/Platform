import { createClient } from '@supabase/supabase-js';
import { isShopCalendarConnected } from '@/lib/shop-calendar';

const getAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

/** True when the client receives appointment updates via Google Calendar (barber or shop). */
export async function bookingUsesGoogleCalendarInvite(bookingId: string): Promise<boolean> {
    const { data: booking } = await getAdmin()
        .from('bookings')
        .select('barbers(google_calendar_tokens, google_calendar_id)')
        .eq('id', bookingId)
        .single();

    const barber = Array.isArray(booking?.barbers) ? booking.barbers[0] : booking?.barbers;
    if (barber?.google_calendar_tokens && barber?.google_calendar_id) {
        return true;
    }

    return isShopCalendarConnected();
}
