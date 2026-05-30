// Run with: node scripts/test-pass.js
// Must be run from the project root with .env.local loaded
// Usage: node -r dotenv/config scripts/test-pass.js dotenv_config_path=.env.local

const forge = require('node-forge');
const { PKPass } = require('passkit-generator');
const fs = require('fs');
const path = require('path');

async function testPass() {
  const WALLET_PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY;
  const WALLET_WWDR_CERT = process.env.WALLET_WWDR_CERT;
  const PASSPHRASE = process.env.WALLET_PASSPHRASE;
  const PASS_TYPE_ID = process.env.PASS_TYPE_ID;
  const TEAM_ID = process.env.TEAM_ID;

  console.log('--- ENV CHECK ---');
  console.log('WALLET_PRIVATE_KEY:', WALLET_PRIVATE_KEY ? `✅ (${WALLET_PRIVATE_KEY.length} chars)` : '❌ MISSING');
  console.log('WALLET_WWDR_CERT:', WALLET_WWDR_CERT ? `✅ (${WALLET_WWDR_CERT.length} chars)` : '❌ MISSING');
  console.log('WALLET_PASSPHRASE:', PASSPHRASE ? `✅ "${PASSPHRASE}"` : '❌ MISSING');
  console.log('PASS_TYPE_ID:', PASS_TYPE_ID || '❌ MISSING');
  console.log('TEAM_ID:', TEAM_ID || '❌ MISSING');
  console.log('');

  if (!WALLET_PRIVATE_KEY || !WALLET_WWDR_CERT || !PASS_TYPE_ID || !TEAM_ID) {
    console.error('❌ Missing env vars, cannot proceed');
    return;
  }

  // Step 1: Parse P12
  console.log('--- STEP 1: Parse P12 ---');
  let certPem, keyPem;
  try {
    const p12Buffer = Buffer.from(WALLET_PRIVATE_KEY, 'base64');
    const p12Der = p12Buffer.toString('binary');
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, PASSPHRASE);

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });

    const certBag = certBags[forge.pki.oids.certBag]?.[0];
    const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

    if (!certBag || !keyBag) throw new Error('Missing cert or key bag');

    const cert = certBag.cert;
    console.log('✅ Cert CN:', cert.subject.getField('CN')?.value);
    console.log('✅ Cert notAfter:', cert.validity.notAfter);
    console.log('✅ Cert OU:', cert.subject.getField('OU')?.value);

    certPem = forge.pki.certificateToPem(certBag.cert);
    keyPem = forge.pki.privateKeyToPem(keyBag.key);
    console.log('✅ certPem length:', certPem.length);
    console.log('✅ keyPem length:', keyPem.length);
  } catch (e) {
    console.error('❌ P12 parse failed:', e.message);
    return;
  }

  // Step 2: Parse WWDR
  console.log('\n--- STEP 2: Parse WWDR ---');
  let wwdrPem;
  try {
    const wwdrCert = Buffer.from(WALLET_WWDR_CERT, 'base64');
    if (wwdrCert.toString('utf-8').includes('-----BEGIN CERTIFICATE-----')) {
      wwdrPem = wwdrCert.toString('utf-8');
      console.log('✅ WWDR already PEM');
    } else {
      const wwdrAsn1 = forge.asn1.fromDer(wwdrCert.toString('binary'));
      const wwdrObj = forge.pki.certificateFromAsn1(wwdrAsn1);
      console.log('✅ WWDR CN:', wwdrObj.subject.getField('CN')?.value);
      console.log('✅ WWDR notAfter:', wwdrObj.validity.notAfter);
      wwdrPem = forge.pki.certificateToPem(wwdrObj);
    }
    console.log('✅ wwdrPem length:', wwdrPem.length);
  } catch (e) {
    console.error('❌ WWDR parse failed:', e.message);
    return;
  }

  // Step 3: Build PKPass
  console.log('\n--- STEP 3: Build PKPass ---');
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    const buffers = {};
    if (fs.existsSync(logoPath)) {
      const logoBuffer = fs.readFileSync(logoPath);
      buffers['logo.png'] = logoBuffer;
      buffers['icon.png'] = logoBuffer;
      console.log('✅ Logo found:', logoPath);
    } else {
      console.warn('⚠️ No logo.png found at', logoPath);
    }

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
      serialNumber: 'test-' + Date.now(),
      backgroundColor: 'rgb(20, 20, 18)',
      labelColor: 'rgb(140, 136, 128)',
      foregroundColor: 'rgb(232, 228, 220)',
      logoText: 'SAVRON',
    });

    pass.type = 'storeCard';
    pass.primaryFields.push({ key: 'tier', label: 'MEMBER', value: 'SAVRON MEMBER' });
    pass.secondaryFields.push({ key: 'name', label: 'NAME', value: 'Test User' });
    pass.auxiliaryFields.push(
      { key: 'visits', label: 'VISITS', value: '0' },
      { key: 'email', label: 'EMAIL', value: 'test@example.com', textAlignment: 'PKTextAlignmentRight' }
    );

    const buf = pass.getAsBuffer();
    const outPath = path.join(process.cwd(), 'scripts', 'test-output.pkpass');
    fs.writeFileSync(outPath, buf);
    console.log('✅ Pass generated!', outPath, '(', buf.length, 'bytes)');
    console.log('\n📱 Open test-output.pkpass on your iPhone to test.');
  } catch (e) {
    console.error('❌ PKPass generation failed:', e.message);
    console.error(e.stack);
  }
}

testPass();
