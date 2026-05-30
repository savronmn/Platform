#!/usr/bin/env node
/**
 * SAVRON Pass Certificate Setup Script
 * 
 * Run this after downloading your Production Pass Type Certificate from Apple Developer Portal.
 * 
 * Usage:
 *   node scripts/setup-prod-cert.js /path/to/YourCert.cer "your-passphrase"
 * 
 * What this does:
 *   1. Finds the matching private key from your macOS Keychain
 *   2. Creates a .p12 bundle (cert + key)
 *   3. Base64-encodes it for use in .env.local
 *   4. Prints the value to copy into WALLET_PRIVATE_KEY
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

const cerPath = process.argv[2];
const passphrase = process.argv[3];

if (!cerPath || !passphrase) {
  console.error('Usage: node scripts/setup-prod-cert.js /path/to/YourCert.cer "your-passphrase"');
  process.exit(1);
}

if (!fs.existsSync(cerPath)) {
  console.error('❌ File not found:', cerPath);
  process.exit(1);
}

console.log('🔧 Reading certificate:', cerPath);

// Parse the cert to get info
const cerBuf = fs.readFileSync(cerPath);
try {
  const asn1 = forge.asn1.fromDer(cerBuf.toString('binary'));
  const cert = forge.pki.certificateFromAsn1(asn1);
  console.log('CN:', cert.subject.getField('CN')?.value);
  console.log('NotAfter:', cert.validity.notAfter);
  
  let isProd = false;
  for (const ext of cert.extensions) {
    if (ext.id === '1.2.840.113635.100.6.1.16') {
      console.log('⚠️  WARNING: This is a DEVELOPMENT certificate (will not work on real devices)');
    }
    if (ext.id === '1.2.840.113635.100.6.1.15') {
      isProd = true;
      console.log('✅ This is a PRODUCTION certificate (works on all devices)');
    }
  }
  if (!isProd) {
    console.log('');
    console.log('  → To get a Production cert: developer.apple.com → Certificates → + → Pass Type ID Certificate');
    console.log('  → Select your Pass Type ID: pass.com.savron.membership');
  }
} catch (e) {
  console.error('❌ Could not parse cert:', e.message);
  process.exit(1);
}

// Create a temp .p12 using the system's security tool
const tmpP12 = path.join(__dirname, 'temp-output.p12');

console.log('\n🔧 Creating .p12 bundle (you may be prompted for your login keychain password)...');
console.log('   First, double-click the .cer file to install it in your keychain, then run this again.');
console.log('');

// Try to export via security command
const result = spawnSync('security', [
  'export',
  '-t', 'identities',
  '-f', 'pkcs12',
  '-k', '/Library/Keychains/login.keychain-db',
  '-P', passphrase,
  '-o', tmpP12
], { stdio: 'inherit' });

if (result.status !== 0 || !fs.existsSync(tmpP12)) {
  // Try default keychain
  const result2 = spawnSync('security', [
    'export',
    '-t', 'identities',
    '-f', 'pkcs12',
    '-P', passphrase,
    '-o', tmpP12
  ], { stdio: 'inherit' });
  
  if (result2.status !== 0 || !fs.existsSync(tmpP12)) {
    console.error('❌ Failed to export. Make sure the cert is installed in your Keychain first.');
    console.error('   Double-click the .cer file and it will be added to Keychain Access.');
    process.exit(1);
  }
}

const p12Buf = fs.readFileSync(tmpP12);
const b64 = p12Buf.toString('base64');
fs.unlinkSync(tmpP12); // clean up

console.log('\n✅ Done! Add this to your .env.local:\n');
console.log('WALLET_PRIVATE_KEY="' + b64 + '"');
console.log('WALLET_PASSPHRASE="' + passphrase + '"');
console.log('\n🎉 Your production Apple Wallet passes will now work on all iPhones!');
