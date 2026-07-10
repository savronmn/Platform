import type { SupabaseClient } from '@supabase/supabase-js';

interface BookingOwnership {
    client_id: string | null;
    client_email: string | null;
}

export interface BookingActor {
    isStaff: boolean;
    ownsBooking: boolean;
}

/** Resolve whether an authenticated user may cancel/manage a booking. */
export async function resolveBookingActor(
    supabaseAdmin: SupabaseClient,
    userId: string,
    userEmail: string | undefined,
    booking: BookingOwnership,
): Promise<BookingActor> {
    const [{ data: barberRecord }, { data: adminRole }, { data: clientRecord }] = await Promise.all([
        supabaseAdmin.from('barbers').select('id').eq('auth_id', userId).maybeSingle(),
        supabaseAdmin.from('user_roles').select('role').eq('auth_id', userId).eq('role', 'admin').maybeSingle(),
        supabaseAdmin.from('clients').select('id').eq('auth_id', userId).maybeSingle(),
    ]);

    const ownsByClientId = !!(clientRecord && booking.client_id === clientRecord.id);
    const normalizedUserEmail = userEmail?.toLowerCase();
    const normalizedBookingEmail = booking.client_email?.toLowerCase();
    const ownsByEmail = !!(
        normalizedUserEmail &&
        normalizedBookingEmail &&
        normalizedBookingEmail === normalizedUserEmail
    );
    const ownsBooking = ownsByClientId || ownsByEmail;

    // Host/admin users sign in without a clients row. Membership clients do have one.
    const isStaff = !!barberRecord || !!adminRole || (!clientRecord && !!userId);

    return { isStaff, ownsBooking };
}
