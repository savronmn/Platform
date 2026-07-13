import {
    SHOP_ADDRESS,
    SHOP_CALENDAR_DISPLAY_NAME,
    SHOP_CALENDAR_EMAIL,
    SHOP_NAME,
} from '@/lib/shop';
import { buildClientAppointmentSummary } from '@/lib/booking-calendar-payload';

export function icsEscape(value: string): string {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\r?\n/g, '\\n');
}

export function icsFold(line: string): string {
    if (line.length <= 73) return line;
    const out: string[] = [];
    let i = 0;
    while (i < line.length) {
        const chunk = line.slice(i, i + (i === 0 ? 73 : 72));
        out.push((i === 0 ? '' : ' ') + chunk);
        i += chunk.length;
    }
    return out.join('\r\n');
}

/** Client-facing ICS: SAVRON invites from savronmn@gmail.com (shop calendar owner). */
export function getBookingIcsOrganizerLine(): string {
    return `ORGANIZER;CN=${icsEscape(SHOP_CALENDAR_DISPLAY_NAME)}:mailto:${SHOP_CALENDAR_EMAIL}`;
}

interface BookingIcsInput {
    id: string;
    time: string;
    date: string;
    duration: string | null;
    service: string;
    client_name: string | null;
    notes: string | null;
}

export function buildBookingIcs(
    booking: BookingIcsInput,
    barberName: string,
    options: { method?: 'PUBLISH' | 'REQUEST' | 'CANCEL'; sequence?: number } = {},
): string {
    const method = options.method ?? 'PUBLISH';
    const sequence = options.sequence ?? (method === 'CANCEL' ? 1 : 0);

    const [timePart, meridiem] = (booking.time || '12:00 PM').split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const dateStr = booking.date || new Date().toISOString().split('T')[0];
    const durationMatch = booking.duration ? booking.duration.match(/\d+/) : null;
    const durationMin = durationMatch ? parseInt(durationMatch[0], 10) : 45;

    const startMs = new Date(
        `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-05:00`,
    ).getTime();
    const endMs = startMs + durationMin * 60_000;
    const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const notes = booking.notes ? `\\n\\nNote from guest: ${icsEscape(booking.notes)}` : '';
    const description = `Your appointment for ${icsEscape(booking.service)} with ${icsEscape(barberName)} at ${icsEscape(SHOP_NAME)}.\\n${icsEscape(SHOP_ADDRESS)}${notes}`;
    const status = method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED';
    const summary = method === 'CANCEL'
        ? `CANCELLED — ${icsEscape(booking.service)}`
        : icsEscape(buildClientAppointmentSummary(booking.service, barberName));

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SAVRON Barbershop & Lounge//Booking System//EN',
        'CALSCALE:GREGORIAN',
        `METHOD:${method}`,
        'BEGIN:VEVENT',
        `UID:booking-${booking.id}@savronmn.com`,
        `SEQUENCE:${sequence}`,
        `DTSTAMP:${fmt(Date.now())}`,
        `DTSTART:${fmt(startMs)}`,
        `DTEND:${fmt(endMs)}`,
        `SUMMARY:${summary}`,
        `LOCATION:${icsEscape(`${SHOP_NAME}, ${SHOP_ADDRESS}`)}`,
        `DESCRIPTION:${description}`,
        getBookingIcsOrganizerLine(),
        `STATUS:${status}`,
        'TRANSP:OPAQUE',
        'CLASS:PUBLIC',
        'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
        'X-MICROSOFT-CDO-IMPORTANCE:1',
        'X-APPLE-CALENDAR-COLOR:#125470',
    ];

    if (method !== 'CANCEL') {
        lines.push(
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            'DESCRIPTION:Appointment reminder',
            'TRIGGER:-PT60M',
            'END:VALARM',
        );
    }

    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.map(icsFold).join('\r\n');
}
