import {
    bookingCancelTokenExpiry,
    createBookingCancelToken,
} from '@/lib/booking-cancel-token';
import { getSiteUrl } from '@/lib/shop';

interface BookingCancelLinkInput {
    id: string;
    date: string;
    time: string;
    duration: string | null;
}

export function buildBookingCancelUrl(booking: BookingCancelLinkInput): string {
    const exp = bookingCancelTokenExpiry(booking.date, booking.time, booking.duration);
    const token = createBookingCancelToken(booking.id, exp);
    return `${getSiteUrl()}/booking/cancel?token=${encodeURIComponent(token)}`;
}

/** Client-only HTML block for confirmation/update emails. */
export function bookingCancelEmailBlock(cancelUrl: string): string {
    return `<!-- CLIENT_CANCEL -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border:1px solid rgba(255,120,120,0.3);margin-bottom:24px;">
              <tr>
                <td style="padding:18px 20px;text-align:center;">
                  <p style="margin:0 0 12px;color:rgba(255,180,180,0.9);font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700;">Need to cancel?</p>
                  <a href="${cancelUrl}" style="display:inline-block;background:#3d1515;border:1px solid rgba(255,120,120,0.35);color:#ffb4b4;text-decoration:none;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;padding:14px 32px;">
                    Cancel Appointment
                  </a>
                  <p style="margin:12px 0 0;color:rgba(255,255,255,0.45);font-size:11px;line-height:1.6;">
                    Opens a secure link to cancel online and free your time slot.
                  </p>
                </td>
              </tr>
            </table>
            <!-- /CLIENT_CANCEL -->`;
}

export const CLIENT_CANCEL_EMAIL_MARKER = /<!-- CLIENT_CANCEL -->[\s\S]*?<!-- \/CLIENT_CANCEL -->/;
