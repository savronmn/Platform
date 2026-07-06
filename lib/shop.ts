export const SHOP_NAME = 'SAVRON Barbershop & Lounge';

export const SHOP_ADDRESS = '250 N Third Avenue, Minneapolis, MN 55401';

/** North Loop shop coordinates for Google Wallet merchantLocations */
export const SHOP_LATITUDE = 44.98205;
export const SHOP_LONGITUDE = -93.27635;

export const SHOP_MAPS_URL =
    'https://maps.google.com/?q=250+N+Third+Avenue,+Minneapolis,+MN+55401';

export const SHOP_EPASS_URL =
    (process.env.NEXT_PUBLIC_SITE_URL || 'https://savronmn.com') + '/epass';

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
