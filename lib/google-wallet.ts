import { GoogleAuth } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import {
    getShopGoogleWalletModules,
    getShopMerchantLocations,
    getSiteUrl,
    getWalletLogoUrl,
    SHOP_NAME,
} from '@/lib/shop';

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, '\n');
const CLASS_ID = process.env.GOOGLE_WALLET_CLASS_ID;

let classSynced = false;

export function isGoogleWalletConfigured(): boolean {
    return !!(ISSUER_ID && SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY && CLASS_ID);
}

function assertConfigured() {
    if (!isGoogleWalletConfigured()) {
        throw new Error('Google Wallet is not configured');
    }
}

function warnIfClassIdMisconfigured() {
    if (CLASS_ID && ISSUER_ID && !CLASS_ID.startsWith(`${ISSUER_ID}.`)) {
        console.warn(
            `[GWallet] GOOGLE_WALLET_CLASS_ID should start with "${ISSUER_ID}." (got "${CLASS_ID}")`,
        );
    }
}

function getProgramLogoUri(): string {
    return getWalletLogoUrl();
}

function buildProgramLogo() {
    return {
        sourceUri: { uri: getProgramLogoUri() },
        contentDescription: {
            defaultValue: { language: 'en-US', value: 'SAVRON' },
        },
    };
}

/** Domains approved for Add to Google Wallet JWT links. */
function getWalletOrigins(): string[] {
    const siteUrl = getSiteUrl().replace(/\/$/, '');
    const origins = new Set<string>([siteUrl]);

    try {
        const host = new URL(siteUrl).hostname;
        origins.add(`https://${host}`);
        if (host.startsWith('www.')) {
            origins.add(`https://${host.slice(4)}`);
        } else {
            origins.add(`https://www.${host}`);
        }
    } catch {
        origins.add('https://savronmn.com');
        origins.add('https://www.savronmn.com');
    }

    return Array.from(origins);
}

async function getWalletClient() {
    assertConfigured();
    warnIfClassIdMisconfigured();

    try {
        const auth = new GoogleAuth({
            credentials: {
                client_email: SERVICE_ACCOUNT_EMAIL!,
                private_key: GOOGLE_PRIVATE_KEY!,
            },
            scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
        });

        return await auth.getClient();
    } catch (err) {
        logGoogleWalletError('Auth getClient', err);
        throw err;
    }
}

function logGoogleWalletError(context: string, err: unknown) {
    const anyErr = err as any;
    console.error(
        `[GWallet] ${context} failed`,
        JSON.stringify(anyErr?.response?.data ?? anyErr?.message ?? anyErr),
    );
}

function buildGoogleClassPayload() {
    return {
        id: CLASS_ID,
        issuerName: SHOP_NAME,
        reviewStatus: 'UNDER_REVIEW',
        programName: 'SAVRON Members Club',
        programLogo: buildProgramLogo(),
        merchantLocations: getShopMerchantLocations(),
        ...getShopGoogleWalletModules(),
    };
}

/** Object fields only — keep JWT/API payloads valid for loyaltyObject. */
function buildGooglePassObjectPayload(
    objectId: string,
    name: string,
    email: string,
    visitCount: number,
) {
    assertConfigured();
    const { textModulesData, linksModuleData, merchantLocations } = {
        merchantLocations: getShopMerchantLocations(),
        ...getShopGoogleWalletModules(),
    };

    return {
        id: objectId,
        classId: CLASS_ID,
        state: 'ACTIVE',
        barcode: { type: 'QR_CODE', value: email },
        accountName: name,
        accountId: email,
        loyaltyPoints: {
            label: 'Visits',
            balance: { int: visitCount },
        },
        merchantLocations,
        textModulesData,
        linksModuleData,
    };
}

export function buildGooglePassObject(
    objectId: string,
    name: string,
    email: string,
    visitCount: number,
) {
    return buildGooglePassObjectPayload(objectId, name, email, visitCount);
}

/** Create class if missing, then patch required fields onto existing class. */
export async function ensureGooglePassClass(): Promise<boolean> {
    if (classSynced) return true;
    if (!isGoogleWalletConfigured()) return false;

    const client = await getWalletClient();
    const classPayload = buildGoogleClassPayload();

    try {
        await client.request({
            url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${encodeURIComponent(CLASS_ID!)}`,
            method: 'GET',
        });
        await client.request({
            url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${encodeURIComponent(CLASS_ID!)}`,
            method: 'PATCH',
            data: {
                programLogo: classPayload.programLogo,
                programName: classPayload.programName,
                issuerName: classPayload.issuerName,
                reviewStatus: classPayload.reviewStatus,
                merchantLocations: classPayload.merchantLocations,
                textModulesData: classPayload.textModulesData,
                linksModuleData: classPayload.linksModuleData,
                appLinkData: classPayload.appLinkData,
            },
        });
        classSynced = true;
        return true;
    } catch (err: any) {
        if (err?.response?.status !== 404) {
            logGoogleWalletError('Class GET/PATCH', err);
            return false;
        }
    }

    try {
        await client.request({
            url: 'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass',
            method: 'POST',
            data: classPayload,
        });
        classSynced = true;
        return true;
    } catch (err) {
        logGoogleWalletError('Class POST', err);
        return false;
    }
}

export async function createGooglePassObject(
    objectId: string,
    name: string,
    email: string,
    visitCount: number,
): Promise<boolean> {
    if (!isGoogleWalletConfigured()) return false;
    const classOk = await ensureGooglePassClass();
    if (!classOk) return false;

    let client;
    try {
        client = await getWalletClient();
    } catch {
        return false;
    }
    const passObject = buildGooglePassObjectPayload(objectId, name, email, visitCount);

    try {
        await client.request({
            url: 'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject',
            method: 'POST',
            data: passObject,
        });
        return true;
    } catch (err: any) {
        if (err?.response?.status === 409) {
            try {
                await client.request({
                    url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
                    method: 'PATCH',
                    data: passObject,
                });
                return true;
            } catch (patchErr) {
                logGoogleWalletError('Object PATCH after conflict', patchErr);
                return false;
            }
        }

        logGoogleWalletError('Object POST', err);
        return false;
    }
}

export async function updateGoogleWalletPass(
    objectId: string,
    name: string,
    email: string,
    visitCount: number,
): Promise<boolean> {
    if (!isGoogleWalletConfigured()) {
        console.warn('[GWallet] Update skipped — Google Wallet is not configured');
        return false;
    }

    await ensureGooglePassClass();

    let client;
    try {
        client = await getWalletClient();
    } catch {
        return false;
    }

    const passObject = buildGooglePassObjectPayload(objectId, name, email, visitCount);

    try {
        await client.request({
            url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
            method: 'PUT',
            data: {
                ...passObject,
                notifyPreference: 'notifyOnUpdate',
            },
        });
        return true;
    } catch (putErr) {
        logGoogleWalletError('Object PUT update', putErr);
        try {
            await client.request({
                url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
                method: 'PATCH',
                data: {
                    state: 'ACTIVE',
                    loyaltyPoints: passObject.loyaltyPoints,
                    merchantLocations: passObject.merchantLocations,
                    textModulesData: passObject.textModulesData,
                    linksModuleData: passObject.linksModuleData,
                    notifyPreference: 'notifyOnUpdate',
                },
            });
            return true;
        } catch (patchErr) {
            logGoogleWalletError('Object PATCH update fallback', patchErr);
            return false;
        }
    }
}

/**
 * Build an Add to Google Wallet link.
 * Embeds the full loyalty class + object in the JWT (Google's recommended jwtNew
 * pattern) so save works even if the REST object create had a transient failure.
 */
export function buildGoogleSaveUrl(
    objectId: string,
    name: string,
    email: string,
    visitCount: number,
): string {
    assertConfigured();

    const loyaltyClass = buildGoogleClassPayload();
    const loyaltyObject = buildGooglePassObjectPayload(objectId, name, email, visitCount);

    const jwtPayload = {
        iss: SERVICE_ACCOUNT_EMAIL,
        aud: 'google',
        typ: 'savetowallet',
        iat: Math.floor(Date.now() / 1000),
        origins: getWalletOrigins(),
        payload: {
            loyaltyClasses: [loyaltyClass],
            loyaltyObjects: [loyaltyObject],
        },
    };

    const token = jwt.sign(jwtPayload, GOOGLE_PRIVATE_KEY!, { algorithm: 'RS256' });
    return `https://pay.google.com/gp/v/save/${token}`;
}

export function buildGoogleObjectId(): string | null {
    if (!ISSUER_ID) return null;
    return `${ISSUER_ID}.${crypto.randomUUID().replace(/-/g, '')}`;
}

/** Push the latest DB visit count to an existing Google Wallet object. */
export async function syncGoogleWalletPass(
    objectId: string,
    name: string,
    email: string,
    visitCount: number,
): Promise<boolean> {
    return updateGoogleWalletPass(objectId, name, email, visitCount);
}
