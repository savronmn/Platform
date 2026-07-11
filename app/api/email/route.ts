import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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

// Escape ICS text per RFC 5545 (commas, semicolons, newlines)
function icsEscape(s: string): string {
    return String(s || '')
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\r?\n/g, '\\n');
}

// Fold long lines per RFC 5545 (75 octet limit)
function icsFold(line: string): string {
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

function getIcsString(
    booking: any,
    barberName: string,
    barberEmail: string | null,
    method: 'REQUEST' | 'CANCEL' = 'REQUEST'
): string {
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
    const startUtc = fmt(startMs);
    const endUtc = fmt(endMs);
    const nowUtc = fmt(Date.now());

    // Stable UID — same across REQUEST + CANCEL so calendar clients track this single appointment
    const uid = `booking-${booking.id}@savronmn.com`;
    const sequence = method === 'CANCEL' ? 1 : 0;
    const status = method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED';

    // Attendees — proper PARTSTAT so calendar clients render RSVP/Cancel buttons
    const attendees: string[] = [];
    if (booking.client_email) {
        attendees.push(
            `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${icsEscape(booking.client_name || 'Guest')}:mailto:${booking.client_email}`
        );
    }
    if (barberEmail) {
        attendees.push(
            `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE;CN=${icsEscape(barberName)}:mailto:${barberEmail}`
        );
    }

    const notes = booking.notes ? `\\n\\nNote from guest: ${icsEscape(booking.notes)}` : '';
    const description = `Your appointment for ${icsEscape(booking.service)} with ${icsEscape(barberName)} at ${icsEscape(SHOP_NAME)}.\\n${icsEscape(SHOP_ADDRESS)}${notes}`;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SAVRON Barbershop & Lounge//Booking System//EN',
        'CALSCALE:GREGORIAN',
        `METHOD:${method}`,
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `SEQUENCE:${sequence}`,
        `DTSTAMP:${nowUtc}`,
        `DTSTART:${startUtc}`,
        `DTEND:${endUtc}`,
        `SUMMARY:${icsEscape(`${booking.service} — ${SHOP_NAME}`)}`,
        `LOCATION:${icsEscape(`${SHOP_NAME}, ${SHOP_ADDRESS}`)}`,
        `DESCRIPTION:${description}`,
        `ORGANIZER;CN=${icsEscape(SHOP_CALENDAR_DISPLAY_NAME)}:mailto:${SHOP_CALENDAR_EMAIL}`,
        ...attendees,
        `STATUS:${status}`,
        'TRANSP:OPAQUE',
        'CLASS:PUBLIC',
        'X-MICROSOFT-CDO-BUSYSTATUS:BUSY',
        'X-MICROSOFT-CDO-IMPORTANCE:1',
        'X-APPLE-CALENDAR-COLOR:#125470',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Appointment reminder',
        'TRIGGER:-PT60M',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ];

    return lines.map(icsFold).join('\r\n');
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

  if (!booking || !booking.client_email) {
    return NextResponse.json({ skipped: true, reason: 'no_email' });
  }

  const barber = booking.barbers as { name: string; email: string | null } | null;
  const barberName = barber?.name ?? booking.barber_name ?? 'Your barber';
  const barberEmail = barber?.email ?? null;

  const dateFormatted = (() => {
    try { return format(new Date(booking.date), 'EEEE, MMMM d, yyyy'); }
    catch { return booking.date; }
  })();

  const shopConnected = await isShopCalendarConnected();
  const shopInviteActive = !!booking.shop_google_event_id;

  const calendarNote = (shopInviteActive || shopConnected)
    ? `<p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;">
              Your Google Calendar invitation comes from <strong style="color:#fff;">${SHOP_CALENDAR_EMAIL}</strong>.
              Use <em>Yes</em> or <em>No</em> on that invite. Tapping <em>No</em> cancels the appointment.
            </p>`
    : `<p style="margin:0 0 6px;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;">
              Need to cancel or reschedule? Reply to this email — your calendar invite includes RSVP options.
            </p>`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#050505;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#121212;border:1px solid rgba(255,255,255,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#125470;padding:28px 32px;text-align:center;">
            <img src="https://savronmn.com/logo.png" alt="SAVRON" width="160" style="display:block;margin:0 auto 8px;max-width:160px;height:auto;" />
            <p style="margin:0;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;">Barbershop &amp; Lounge · Minneapolis</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:3px;text-transform:uppercase;">Booking Confirmed</p>
            <h1 style="margin:0 0 28px;color:#fff;font-size:26px;letter-spacing:2px;text-transform:uppercase;">You're all set, ${booking.client_name?.split(' ')[0] ?? 'friend'}.</h1>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;border:1px solid rgba(255,255,255,0.08);margin-bottom:20px;">
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Service</span><br>
                  <span style="color:#fff;font-size:15px;">${booking.service}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Barber</span><br>
                  <span style="color:#fff;font-size:15px;">${barberName}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Date</span><br>
                  <span style="color:#fff;font-size:15px;">${dateFormatted}</span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.05);">
                  <span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Time</span><br>
                  <span style="color:#fff;font-size:15px;">${booking.time}</span>
                </td>
              </tr>
              ${booking.price ? `
              <tr>
                <td style="padding:14px 20px;${booking.notes ? 'border-bottom:1px solid rgba(255,255,255,0.05);' : ''}">
                  <span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Total</span><br>
                  <span style="color:#1A6A8A;font-size:18px;font-weight:700;">${booking.price}</span>
                </td>
              </tr>` : ''}
              ${booking.notes ? `
              <tr>
                <td style="padding:14px 20px;">
                  <span style="color:rgba(255,255,255,0.4);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Note for your barber</span><br>
                  <span style="color:rgba(255,255,255,0.85);font-size:14px;line-height:1.6;font-style:italic;">"${String(booking.notes).replace(/</g, '&lt;')}"</span>
                </td>
              </tr>` : ''}
            </table>

            <!-- Location block -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#125470;margin-bottom:28px;">
              <tr>
                <td style="padding:18px 20px;">
                  <p style="margin:0 0 4px;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;">Location</p>
                  <p style="margin:0;color:#fff;font-size:14px;font-weight:600;letter-spacing:0.5px;">SAVRON Barbershop &amp; Lounge</p>
                  <p style="margin:4px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
                    <a href="https://maps.google.com/?q=250+N+Third+Avenue,+Minneapolis,+MN+55401" style="color:rgba(255,255,255,0.75);text-decoration:none;">250 N Third Avenue, Minneapolis, MN 55401</a>
                  </p>
                </td>
              </tr>
            </table>

            ${calendarNote}
            <p style="margin:0;color:rgba(255,255,255,0.4);font-size:12px;line-height:1.6;">
              We&rsquo;ll see you soon.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid rgba(255,255,255,0.05);">
            <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;letter-spacing:1px;">
              SAVRON Barbershop &amp; Lounge · 250 N Third Ave, Minneapolis MN · <a href="https://savronmn.com" style="color:rgba(255,255,255,0.3);">savronmn.com</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  // When shop Google Calendar is connected, savronmn@gmail.com sends the real invite.
  // Resend email is HTML-only — never attach ICS with a different organizer (info@).
  const icsString = shopInviteActive ? null : getIcsString(booking, barberName, barberEmail, 'REQUEST');
  const icsAttachment = icsString
    ? {
        filename: 'appointment.ics',
        content: Buffer.from(icsString).toString('base64'),
        contentType: 'text/calendar; charset=utf-8; method=REQUEST',
      }
    : null;

  const emailPromises: Promise<Response>[] = [];
  
  const headers = {
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  };

  // Client confirmation (+ ICS only when shop Google invite is unavailable)
  emailPromises.push(
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        from: `${RESEND_BOOKING_FROM_NAME} <${RESEND_BOOKING_FROM}>`,
        to: [booking.client_email],
        subject: `Your appointment is confirmed — ${booking.time}, ${dateFormatted}`,
        html: htmlBody,
        ...(icsAttachment ? { attachments: [icsAttachment] } : {}),
      }),
    })
  );

  // Barber notification
  if (barberEmail) {
    const barberHtml = htmlBody
      .replace("You're all set,", `New booking — `)
      .replace(booking.client_name?.split(' ')[0] ?? 'friend', booking.client_name || 'Walk-in');

    emailPromises.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: `${RESEND_BOOKING_FROM_NAME} <${RESEND_BOOKING_FROM}>`,
          to: [barberEmail],
          subject: `New booking: ${booking.client_name || 'Walk-in'} — ${booking.time}, ${dateFormatted}`,
          html: barberHtml,
          ...(icsAttachment ? { attachments: [icsAttachment] } : {}),
        }),
      })
    );
  }

  // Send all emails in parallel
  const results = await Promise.allSettled(emailPromises);
  
  // Check at least the client email succeeded
  const clientResult = results[0];
  if (clientResult.status === 'rejected' || (clientResult.status === 'fulfilled' && !clientResult.value.ok)) {
    const err = clientResult.status === 'fulfilled' ? await clientResult.value.text() : clientResult.reason;
    console.error('Client email failed:', err);
    return NextResponse.json({ error: 'Email failed', detail: String(err) }, { status: 500 });
  }

  // Log any barber/shop failures but don't fail the response
  results.slice(1).forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`Email ${i + 2} failed:`, r.reason);
    }
  });

  return NextResponse.json({ success: true });
}
