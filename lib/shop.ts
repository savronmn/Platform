export const SHOP_NAME = 'SAVRON Barbershop & Lounge';

export const SHOP_ADDRESS = '250 N Third Avenue, Minneapolis, MN 55401';

/** Display name on booking/calendar branding (not a person's name). */
export const SHOP_CALENDAR_DISPLAY_NAME = 'SAVRON';

/** Resend display address for booking confirmation emails (not the calendar organizer). */
export const RESEND_BOOKING_FROM = 'bookings@savronmn.com';

/** From-name on Resend booking emails (not a person's name). */
export const RESEND_BOOKING_FROM_NAME = SHOP_CALENDAR_DISPLAY_NAME;

/** Google Calendar account — organizer entity on client .ics (SENT-BY bookings@). */
export const SHOP_CALENDAR_EMAIL = 'savronmn@gmail.com';

/** SAVRON shop Google Calendar — one invite per appointment (client + barber attendees). */
export const SHOP_GOOGLE_CALENDAR_ID =
    '647974e05fc3f7623a296d4bf0a07a875fbabbf1c93155fc80f16000841ba73b@group.calendar.google.com';

/** Public contact / reply-to style address (not used as calendar organizer). */
export const SHOP_CONTACT_EMAIL = 'info@savronmn.com';

/** North Loop shop coordinates for Google Wallet merchantLocations */
export const SHOP_LATITUDE = 44.98205;
export const SHOP_LONGITUDE = -93.27635;

export const SHOP_MAPS_URL =
    'https://maps.google.com/?q=250+N+Third+Avenue,+Minneapolis,+MN+55401';

export const SHOP_SOCIAL_LINKS = {
    facebook: 'https://www.facebook.com/profile.php?id=61589236641226',
    instagram: 'https://www.instagram.com/savron_mn/',
    tiktok: 'https://www.tiktok.com/@savronmn',
} as const;

export const SHOP_SOCIAL_LINK_LIST = [
    { id: 'instagram', label: 'Instagram', href: SHOP_SOCIAL_LINKS.instagram },
    { id: 'facebook', label: 'Facebook', href: SHOP_SOCIAL_LINKS.facebook },
    { id: 'tiktok', label: 'TikTok', href: SHOP_SOCIAL_LINKS.tiktok },
] as const;

export function getSiteUrl(): string {
    return process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://savronmn.com';
}

/** Dark SAVRON mark used on wallet passes (Google programLogo + Apple pass assets). */
export function getWalletLogoUrl(): string {
    return process.env.GOOGLE_WALLET_LOGO_URL || `${getSiteUrl()}/icon.png`;
}

export const SHOP_EPASS_URL = getSiteUrl() + '/epass';

export function getShopMerchantLocations() {
    return [{ latitude: SHOP_LATITUDE, longitude: SHOP_LONGITUDE }];
}

export function getShopGoogleWalletModules() {
    return {
        textModulesData: [
            {
                id: 'shop_location',
                header: 'Visit Us',
                body: `${SHOP_NAME}\n${SHOP_ADDRESS}`,
            },
        ],
        linksModuleData: {
            uris: [
                {
                    id: 'directions',
                    uri: SHOP_MAPS_URL,
                    description: 'Get Directions',
                },
                {
                    id: 'live_pass',
                    uri: SHOP_EPASS_URL,
                    description: 'View Live Pass',
                },
            ],
        },
        appLinkData: {
            webAppLinkInfo: {
                appTarget: {
                    targetUri: {
                        uri: SHOP_EPASS_URL,
                        description: 'View Live Pass',
                    },
                },
            },
        },
    };
}
