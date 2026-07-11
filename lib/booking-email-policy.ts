/**
 * Shop Google Calendar (savronmn@gmail.com) owns the client calendar invite.
 * Resend (bookings@savronmn.com) sends the branded confirmation email — HTML only,
 * never a duplicate .ics when the shop invite was created.
 */
export function shopGoogleInviteActive(options: {
    shopInviteSent?: boolean;
    shopGoogleEventId?: string | null;
}): boolean {
    return !!(options.shopInviteSent || options.shopGoogleEventId);
}
