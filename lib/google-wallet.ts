import { GoogleAuth } from 'google-auth-library';
import jwt from 'jsonwebtoken';

const ISSUER_ID = process.env.GOOGLE_WALLET_ISSUER_ID;
const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_WALLET_PRIVATE_KEY?.replace(/\\n/g, '\n');
const CLASS_ID = process.env.GOOGLE_WALLET_CLASS_ID;

let classEnsured = false;

export function isGoogleWalletConfigured(): boolean {
    return !!(ISSUER_ID && SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY && CLASS_ID);
}

function assertConfigured() {
    if (!isGoogleWalletConfigured()) {
        throw new Error('Google Wallet is not configured');
    }
}

async function getWalletClient() {
    assertConfigured();
    const auth = new GoogleAuth({
        credentials: {
            client_email: SERVICE_ACCOUNT_EMAIL!,
            private_key: GOOGLE_PRIVATE_KEY!,
        },
        scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
    });

    return auth.getClient();
}

function logGoogleWalletError(context: string, err: unknown) {
    const anyErr = err as any;
    console.error(
        `[GWallet] ${context} failed`,
        JSON.stringify(anyErr?.response?.data ?? anyErr?.message ?? anyErr),
    );
}

export function buildGooglePassObject(
    objectId: string,
    name: string,
    email: string,
    visitCount: number,
) {
    assertConfigured();
    return {
        id: objectId,
        classId: CLASS_ID,
        state: 'ACTIVE',
        barcode: { type: 'QR_CODE', value: email },
        accountName: name,
        accountId: email,
        loyaltyPoints: {
            label: 'Visits',
            balance: { string: visitCount.toString() },
        },
    };
}

export async function ensureGooglePassClass(): Promise<boolean> {
    if (classEnsured) return true;
    if (!isGoogleWalletConfigured()) return false;

    const client = await getWalletClient();

    try {
        await client.request({
            url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${encodeURIComponent(CLASS_ID!)}`,
            method: 'GET',
        });
        classEnsured = true;
        return true;
    } catch (err: any) {
        if (err?.response?.status !== 404) {
            logGoogleWalletError('Class GET', err);
            return false;
        }
    }

    try {
        await client.request({
            url: 'https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass',
            method: 'POST',
            data: {
                id: CLASS_ID,
                issuerName: 'SAVRON Barbershop & Lounge',
                reviewStatus: 'DRAFT',
                programName: 'SAVRON Members Club',
            },
        });
        classEnsured = true;
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

    const client = await getWalletClient();
    const passObject = buildGooglePassObject(objectId, name, email, visitCount);

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

    const client = await getWalletClient();

    try {
        await client.request({
            url: `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/${encodeURIComponent(objectId)}`,
            method: 'PATCH',
            data: {
                state: 'ACTIVE',
                barcode: { type: 'QR_CODE', value: email },
                accountName: name,
                accountId: email,
                loyaltyPoints: {
                    label: 'Visits',
                    balance: { string: visitCount.toString() },
                },
                notifyPreference: 'NOTIFY',
            },
        });
        return true;
    } catch (err) {
        logGoogleWalletError('Object PATCH update', err);
        return false;
    }
}

export function buildGoogleSaveUrl(objectId: string): string {
    assertConfigured();
    const jwtPayload = {
        iss: SERVICE_ACCOUNT_EMAIL,
        aud: 'google',
        typ: 'savetowallet',
        iat: Math.floor(Date.now() / 1000),
        payload: { loyaltyObjects: [{ id: objectId }] },
    };
    const token = jwt.sign(jwtPayload, GOOGLE_PRIVATE_KEY!, { algorithm: 'RS256' });
    return `https://pay.google.com/gp/v/save/${token}`;
}

export function buildGoogleObjectId(): string | null {
    if (!ISSUER_ID) return null;
    return `${ISSUER_ID}.${crypto.randomUUID().replace(/-/g, '')}`;
}
