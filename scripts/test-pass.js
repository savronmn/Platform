const fs = require('fs');
const path = require('path');
const forge = require('/Users/sergiopineros/Desktop/SAVRON/WebApps/main/node_modules/node-forge');

// Manually parse env
const envPath = '/Users/sergiopineros/Desktop/SAVRON/WebApps/main/.env.local';
const env = {};
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const index = trimmed.indexOf('=');
        if (index === -1) return;
        const key = trimmed.slice(0, index).trim();
        let val = trimmed.slice(index + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        env[key] = val;
    });
    console.log("Parsed .env.local manually");
} else {
    console.error("Could not find .env.local");
}

const WALLET_PRIVATE_KEY = env.WALLET_PRIVATE_KEY;
const WALLET_WWDR_CERT = env.WALLET_WWDR_CERT;
const PASSPHRASE = env.WALLET_PASSPHRASE;
const PASS_TYPE_ID = env.PASS_TYPE_ID;
const TEAM_ID = env.TEAM_ID;

async function testP12Parsing() {
    try {
        const p12Buffer = Buffer.from(WALLET_PRIVATE_KEY, 'base64');
        console.log("P12 Buffer size:", p12Buffer.length);

        // Try parsing P12 using forge
        const p12Der = p12Buffer.toString('binary');
        const p12Asn1 = forge.asn1.fromDer(p12Der);
        const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, PASSPHRASE);
        
        console.log("P12 parsed successfully!");

        // Extract certificate
        const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
        const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

        console.log("Number of certBags:", certBags[forge.pki.oids.certBag]?.length);
        console.log("Number of keyBags:", keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.length);

        const certBag = certBags[forge.pki.oids.certBag][0];
        const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];

        const certPem = forge.pki.certificateToPem(certBag.cert);
        
        // Let's re-encrypt the private key with the passphrase, OR just use the decrypted key but tell passkit-generator a dummy passphrase!
        // Wait, passkit-generator does:
        // signerKey: forge.pki.decryptRsaPrivateKey(signerKey, signerKeyPassphrase)
        // If the key is already decrypted (PEM has "-----BEGIN RSA PRIVATE KEY-----"), forge's decryptRsaPrivateKey ignores the passphrase argument if it's not encrypted, or does it?
        // Let's check! If we pass a decrypted private key AND pass a non-empty passphrase (like "dummy" or the original passphrase), does decryptRsaPrivateKey succeed or fail?
        // Let's test both!
        
        const keyPem = forge.pki.privateKeyToPem(keyBag.key);

        console.log("Cert PEM snippet:\n", certPem.substring(0, 100));
        console.log("Key PEM snippet:\n", keyPem.substring(0, 100));

        // Test with PKPass
        const { PKPass } = require('/Users/sergiopineros/Desktop/SAVRON/WebApps/main/node_modules/passkit-generator');
        const wwdrCert = Buffer.from(WALLET_WWDR_CERT, 'base64');
        
        let wwdrPem = '';
        if (wwdrCert.toString('utf-8').includes('-----BEGIN CERTIFICATE-----')) {
            wwdrPem = wwdrCert.toString('utf-8');
        } else {
            const wwdrAsn1 = forge.asn1.fromDer(wwdrCert.toString('binary'));
            const wwdrObj = forge.pki.certificateFromAsn1(wwdrAsn1);
            wwdrPem = forge.pki.certificateToPem(wwdrObj);
        }

        const buffers = {};
        const logoPath = '/Users/sergiopineros/Desktop/SAVRON/WebApps/main/public/logo.png';
        if (fs.existsSync(logoPath)) {
            const logoBuffer = fs.readFileSync(logoPath);
            buffers['logo.png'] = logoBuffer;
            buffers['icon.png'] = logoBuffer;
        }

        console.log("Instantiating PKPass with dummy/original passphrase...");
        const pass = new PKPass(buffers, {
            wwdr: wwdrPem,
            signerCert: certPem,
            signerKey: keyPem,
            signerKeyPassphrase: PASSPHRASE || 'dummy',
        }, {
            description: 'SAVRON Membership',
            organizationName: 'SAVRON',
            passTypeIdentifier: PASS_TYPE_ID,
            teamIdentifier: TEAM_ID,
            serialNumber: 'test-1234',
            backgroundColor: 'rgb(20, 20, 18)',
            labelColor: 'rgb(140, 136, 128)',
            foregroundColor: 'rgb(232, 228, 220)',
            logoText: 'SAVRON',
            userInfo: { email: 'test@example.com' },
        });

        pass.type = 'storeCard';
        pass.primaryFields.push({ key: 'tier', label: 'MEMBER', value: 'SAVRON MEMBER' });
        
        const buf = pass.getAsBuffer();
        console.log("Successfully generated PKPass buffer! Size:", buf.length);

    } catch (e) {
        console.error("Test failed:", e);
    }
}

testP12Parsing();
