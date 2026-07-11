import { format } from 'date-fns';
import { isShopCalendarConnected } from '@/lib/shop-calendar';
import {
    RESEND_BOOKING_FROM,
    RESEND_BOOKING_FROM_NAME,
    SHOP_ADDRESS,
    SHOP_CALENDAR_DISPLAY_NAME,
    SHOP_CALENDAR_EMAIL,
    SHOP_NAME,
} from '@/lib/shop';

interface CancellationBooking {
    id: string;
    client_email: string | null;
    client_name: string | null;
    date: string;
    duration: string | null;
    service: string;
    time: string;
    barber_name: string | null;
    shop_google_event_id?: string | null;
    barbers: { name: string; email: string | null } | null;
}

export interface CancellationEmailResult {
    success: boolean;
    sent: number;
    failed: number;
    error?: string;
}

function icsEscape(value: string): string {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\r?\n/g, '\\n');
}

function buildCancelIcs(
    booking: CancellationBooking,
    barberName: string,
    barberEmail: string | null,
): string {
    const [timePart, meridiem] = (booking.time || '12:00 PM').split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const durationMatch = booking.duration?.match(/\d+/);
    const durationMin = durationMatch ? parseInt(durationMatch[0], 10) : 45;
    const startMs = new Date(
        `${booking.date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00-05:00`,
    ).getTime();
    const endMs = startMs + durationMin * 60_000;
    const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    const attendees: string[] = [];
    if (booking.client_email) {
        attendees.push(
            `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${icsEscape(booking.client_name || 'Guest')}:mailto:${booking.client_email}`,
        );
    }
    if (barberEmail) {
        attendees.push(
            `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${icsEscape(barberName)}:mailto:${barberEmail}`,
        );
    }

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SAVRON Barbershop & Lounge//Booking System//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:CANCEL',
        'BEGIN:VEVENT',
        `UID:booking-${booking.id}@savronmn.com`,
        'SEQUENCE:1',
        `DTSTAMP:${fmt(Date.now())}`,
        `DTSTART:${fmt(startMs)}`,
        `DTEND:${fmt(endMs)}`,
        `SUMMARY:CANCELLED — ${icsEscape(booking.service)}`,
        `LOCATION:${icsEscape(`${SHOP_NAME}, ${SHOP_ADDRESS}`)}`,
        `ORGANIZER;CN=${icsEscape(SHOP_CALENDAR_DISPLAY_NAME)}:mailto:${SHOP_CALENDAR_EMAIL}`,
        ...attendees,
        'STATUS:CANCELLED',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
}

export async function sendCancellationEmails(
    booking: CancellationBooking,
): Promise<CancellationEmailResult> {
    if (!process.env.RESEND_API_KEY) {
        return { success: false, sent: 0, failed: 0, error: 'Email service not configured' };
    }

    const barberName = booking.barbers?.name ?? booking.barber_name ?? 'Your barber';
    const barberEmail = booking.barbers?.email ?? null;
    const missingRecipients = [
        !booking.client_email ? 'client' : null,
        !barberEmail ? 'barber' : null,
    ].filter((recipient): recipient is string => Boolean(recipient));
    const recipients = Array.from(new Set(
        [booking.client_email, barberEmail].filter(
            (email): email is string => Boolean(email),
        ),
    ));

    const dateFormatted = (() => {
        try {
            return format(new Date(`${booking.date}T12:00:00`), 'EEEE, MMMM d, yyyy');
        } catch {
            return booking.date;
        }
    })();

    const shopConnected = await isShopCalendarConnected();
    const skipCalendarIcs = !!booking.shop_google_event_id;
    const ics = skipCalendarIcs ? null : buildCancelIcs(booking, barberName, barberEmail);

    const calendarNote = (skipCalendarIcs || shopConnected)
        ? `Your Google Calendar invitation from <strong style="color:#fff;">${SHOP_CALENDAR_EMAIL}</strong> has been cancelled automatically.`
        : 'Your calendar has been updated automatically.';

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#121212;border:1px solid rgba(255,255,255,0.08);">
      <tr><td style="background:#125470;padding:28px 32px;text-align:center;">
        <img src="https://savronmn.com/logo.png" alt="SAVRON" width="160" style="display:block;margin:0 auto 8px;max-width:160px;height:auto;" />
        <p style="margin:0;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;">Barbershop &amp; Lounge · Minneapolis</p>
      </td></tr>
      <tr><td style="padding:36px 32px;">
        <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Appointment Cancelled</p>
        <h1 style="margin:0 0 24px;color:#fff;font-size:22px;letter-spacing:1.5px;text-transform:uppercase;">Your appointment has been cancelled</h1>
        <p style="margin:0 0 16px;color:rgba(255,255,255,0.6);font-size:14px;line-height:1.7;">
          ${booking.service} with ${barberName} on ${dateFormatted} at ${booking.time} is no longer scheduled. ${calendarNote}
        </p>
        <p style="margin:0 0 28px;color:rgba(255,255,255,0.5);font-size:13px;line-height:1.7;">
          Walk-ins are welcome anytime. Or rebook online when you&rsquo;re ready.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>
          <td style="background:#125470;padding:14px 32px;">
            <a href="https://savronmn.com/booking" style="color:#fff;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">Book Again</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);">
        <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;letter-spacing:1px;">
          SAVRON Barbershop &amp; Lounge · ${SHOP_ADDRESS} · <a href="https://savronmn.com" style="color:rgba(255,255,255,0.3);">savronmn.com</a>
        </p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

    const results = await Promise.allSettled(recipients.map(async (to) => {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                from: `${RESEND_BOOKING_FROM_NAME} <${RESEND_BOOKING_FROM}>`,
                to: [to],
                subject: `Cancelled: ${booking.service} — ${dateFormatted}, ${booking.time}`,
                html,
                ...(ics ? {
                    attachments: [{
                        filename: 'appointment-cancel.ics',
                        content: Buffer.from(ics).toString('base64'),
                        contentType: 'text/calendar; charset=utf-8; method=CANCEL',
                    }],
                } : {}),
            }),
        });
        if (!response.ok) {
            throw new Error(`Resend returned ${response.status}`);
        }
    }));

    const failed = results.filter(result => result.status === 'rejected').length;
    const errors: string[] = [];
    if (failed) errors.push(`Failed to send ${failed} cancellation email(s)`);
    if (missingRecipients.length) {
        errors.push(`No email address is saved for the ${missingRecipients.join(' and ')}`);
    }
    return {
        success: failed === 0 && missingRecipients.length === 0,
        sent: results.length - failed,
        failed,
        error: errors.length ? errors.join('. ') : undefined,
    };
}
