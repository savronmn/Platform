import { SERVICES } from '@/lib/services-data';
import { SHOP_ADDRESS, SHOP_CONTACT_EMAIL, SHOP_NAME } from '@/lib/shop';
import { toIsoString } from '@/lib/google-calendar';

export interface BookingCalendarInput {
    id: string;
    date: string;
    time: string;
    service: string;
    client_name: string | null;
    client_phone: string | null;
    client_email: string | null;
    price: string | null;
    duration?: string | null;
}

export interface BookingCalendarPayload {
    clientSummary: string;
    staffSummary: string;
    clientDescription: string;
    staffDescription: string;
    location: string;
    startIso: string;
    endIso: string;
    durationMin: number;
}

function computeEndIso(date: string, time: string, durationMin: number): string {
    const [timePart, meridiem] = time.split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    const endMinutes = hours * 60 + minutes + durationMin;
    const endH = Math.floor(endMinutes / 60) % 24;
    const endM = endMinutes % 60;
    const endMeridiem = endH >= 12 ? 'PM' : 'AM';
    const endH12 = endH > 12 ? endH - 12 : endH || 12;
    const endTimeStr = `${endH12}:${String(endM).padStart(2, '0')} ${endMeridiem}`;
    return toIsoString(date, endTimeStr);
}

/** Client-facing appointment title — shows in Google Calendar like a booked appointment. */
export function buildClientAppointmentSummary(
    service: string,
    barberName: string | null,
): string {
    const withBarber = barberName ? ` with ${barberName}` : '';
    return `${service}${withBarber} · ${SHOP_NAME}`;
}

/** Staff-facing title for internal calendar views. */
export function buildStaffAppointmentSummary(
    clientName: string | null,
    service: string,
): string {
    return `✂️ ${clientName ?? 'Client'} — ${service}`;
}

export function buildBookingCalendarPayload(
    booking: BookingCalendarInput,
    barberName: string | null,
): BookingCalendarPayload {
    const service = SERVICES.find(s => s.name === booking.service);
    const durationMatch = booking.duration?.match(/\d+/);
    const durationMin = service?.durationMin
        ?? (durationMatch ? parseInt(durationMatch[0], 10) : 45);

    const startIso = toIsoString(booking.date, booking.time);
    const endIso = computeEndIso(booking.date, booking.time, durationMin);
    const location = `${SHOP_NAME}, ${SHOP_ADDRESS}`;

    const clientSummary = buildClientAppointmentSummary(booking.service, barberName);
    const staffSummary = buildStaffAppointmentSummary(booking.client_name, booking.service);

    const clientDescription = [
        `Your appointment at ${SHOP_NAME}`,
        SHOP_ADDRESS,
        '',
        `Service: ${booking.service}`,
        barberName ? `Barber: ${barberName}` : '',
        `When: ${booking.date} at ${booking.time}`,
        `Duration: ${durationMin} min`,
        booking.price ? `Price: ${booking.price}` : '',
        '',
        'Tap Yes on this invite to confirm your appointment.',
        'Tap No to cancel — declining frees your time slot automatically.',
        '',
        `Questions? ${SHOP_CONTACT_EMAIL}`,
    ].filter(Boolean).join('\n');

    const staffDescription = [
        `Service: ${booking.service}`,
        `Duration: ${durationMin} min`,
        booking.client_name ? `Client: ${booking.client_name}` : '',
        booking.client_phone ? `Phone: ${booking.client_phone}` : '',
        booking.client_email ? `Email: ${booking.client_email}` : '',
        booking.price ? `Price: ${booking.price}` : '',
        '',
        'Client receives this as a Google Calendar appointment invite.',
        'If they tap No, the booking cancels automatically in SAVRON.',
    ].filter(Boolean).join('\n');

    return {
        clientSummary,
        staffSummary,
        clientDescription,
        staffDescription,
        location,
        startIso,
        endIso,
        durationMin,
    };
}
