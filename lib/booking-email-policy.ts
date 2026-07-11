/**
 * When the Savron shop Google Calendar sends an invite (savronmn@gmail.com),
 * the client already received one email from SAVRON. Skip Resend to the client
 * to avoid duplicates — barber/staff notifications via Resend still go out.
 */
export function shouldSkipClientResendEmail(options: {
    shopInviteSent?: boolean;
    shopGoogleEventId?: string | null;
}): boolean {
    return !!(options.shopInviteSent || options.shopGoogleEventId);
}
