// POST /api/email/cancel
// Sends a cancellation ICS (METHOD:CANCEL, SEQUENCE:1) to client + barber + shop.
// Calendar clients with the original invite will detect the same UID and mark the event cancelled.
// Body: { bookingId: string }

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

const BARBERSHOP_EMAIL = 'info@savronmn.com';
const SHOP_ADDRESS = '250 N Third Avenue, Minneapolis, MN 55401';
const SHOP_NAME = 'SAVRON Barbershop & Lounge';

function icsEscape(s: string): string {
    return String(s || '')
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\r?\n/g, '\\n');
}

function buildCancelIcs(booking: any, barberName: string, barberEmail: string | null): string {
    const [timePart, meridiem] = (booking.time || '12:00 PM').split(' ');
    let [hours, minutes] = timePart.split(':').map(Number);
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const dateStr = booking.date || new Date().toISOString().split('T')[0];
    const durationMatch = booking.duration ? booking.duration.match(/\d+/) : null;
    const durationMin = durationMatch ? parseInt(durationMatch[0]) : 45;

    const startMs = new Date(`${dateStr}T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00-05:00`).getTime();
    const endMs = startMs + durationMin * 60000;

    const fmt = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const uid = `booking-${booking.id}@savronmn.com`;

    const attendees: string[] = [];
    if (booking.client_email) {
        attendees.push(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${icsEscape(booking.client_name || 'Guest')}:mailto:${booking.client_email}`);
    }
    if (barberEmail) {
        attendees.push(`ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${icsEscape(barberName)}:mailto:${barberEmail}`);
    }
    attendees.push(`ATTENDEE;CUTYPE=ROOM;ROLE=NON-PARTICIPANT;PARTSTAT=ACCEPTED;CN=${icsEscape(SHOP_NAME)}:mailto:${BARBERSHOP_EMAIL}`);

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SAVRON Barbershop & Lounge//Booking System//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:CANCEL',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        'SEQUENCE:1',
        `DTSTAMP:${fmt(Date.now())}`,
        `DTSTART:${fmt(startMs)}`,
        `DTEND:${fmt(endMs)}`,
        `SUMMARY:CANCELLED — ${icsEscape(booking.service)}`,
        `LOCATION:${icsEscape(`${SHOP_NAME}, ${SHOP_ADDRESS}`)}`,
        `ORGANIZER;CN=${icsEscape(SHOP_NAME)}:mailto:${BARBERSHOP_EMAIL}`,
        ...attendees,
        'STATUS:CANCELLED',
        'END:VEVENT',
        'END:VCALENDAR',
    ].join('\r\n');
}

export async function POST(request: NextRequest) {
    if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { bookingId } = await request.json() as { bookingId: string };

    if (!bookingId) {
        return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
    }

    const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('*, barbers(name, email)')
        .eq('id', bookingId)
        .single();

    if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const barber = booking.barbers as { name: string; email: string | null } | null;
    const barberName = barber?.name ?? booking.barber_name ?? 'Your barber';
    const barberEmail = barber?.email ?? null;

    const dateFormatted = (() => {
        try { return format(new Date(booking.date), 'EEEE, MMMM d, yyyy'); }
        catch { return booking.date; }
    })();

    const ics = buildCancelIcs(booking, barberName, barberEmail);
    const attachment = {
        filename: 'appointment-cancel.ics',
        content: Buffer.from(ics).toString('base64'),
        contentType: 'text/calendar; charset=utf-8; method=CANCEL',
    };

    const htmlBody = `<!DOCTYPE html>
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
          ${booking.service} with ${barberName} on ${dateFormatted} at ${booking.time} is no longer scheduled. Your calendar has been updated automatically.
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

    const headers = {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
    };

    const recipients: string[] = [];
    if (booking.client_email) recipients.push(booking.client_email);
    if (barberEmail) recipients.push(barberEmail);
    recipients.push(BARBERSHOP_EMAIL);

    const results = await Promise.allSettled(recipients.map((to) =>
        fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers,
            body: JSON.stringify({
                from: 'SAVRON Barbershop & Lounge <bookings@savronmn.com>',
                to: [to],
                subject: `Cancelled: ${booking.service} — ${dateFormatted}, ${booking.time}`,
                html: htmlBody,
                attachments: [attachment],
            }),
        })
    ));

    const failures = results.filter(r =>
        r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
    ).length;
    return NextResponse.json({ success: failures === 0, sent: results.length - failures, failed: failures });
}
