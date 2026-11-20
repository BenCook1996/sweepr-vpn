import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const ICON_DIR = path.join(ROOT, 'apps', 'mobile-ios', 'Assets.xcassets', 'AppIcon.appiconset');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => resolve(addr.port));
    });
  });
}

function readPngHeader(buf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(buf.subarray(0, 8).equals(sig), 'PNG magic bytes invalid');
  assert.equal(buf.subarray(12, 16).toString('ascii'), 'IHDR', 'Missing IHDR chunk');
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25]
  };
}

function assertXmlTagsBalanced(filePath, requiredSubstrings = []) {
  const xml = fs.readFileSync(filePath, 'utf8');
  for (const sub of requiredSubstrings) {
    assert.ok(xml.includes(sub), `${path.basename(filePath)} missing required entry: ${sub}`);
  }
  const dictOpen = (xml.match(/<dict>/g) || []).length;
  const dictClose = (xml.match(/<\/dict>/g) || []).length;
  const arrOpen = (xml.match(/<array>/g) || []).length;
  const arrClose = (xml.match(/<\/array>/g) || []).length;
  assert.equal(dictOpen, dictClose, `${filePath} has mismatched <dict> tags (${dictOpen} vs ${dictClose})`);
  assert.equal(arrOpen, arrClose, `${filePath} has mismatched <array> tags (${arrOpen} vs ${arrClose})`);
}

function verifyEd25519TokenWithSwiftHex(token, pubHex) {
  const parts = String(token || '').split('.');
  assert.equal(parts.length, 3, 'Expected 3-part JWT');
  const rawPub = Buffer.from(pubHex, 'hex');
  assert.equal(rawPub.length, 32, 'Ed25519 public key must be 32 bytes');
  // ASN.1 SPKI header for Ed25519 public key: 30 2a 30 05 06 03 2b 65 70 03 21 00
  const spkiDer = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawPub]);
  const pubKey = crypto.createPublicKey({ key: spkiDer, format: 'der', type: 'spki' });
  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
  const sig = Buffer.from(parts[2], 'base64url');
  const valid = crypto.verify(null, signingInput, pubKey, sig);
  assert.equal(valid, true, 'Server-signed Ed25519 token did not verify against Swift pubKeyHex');
}

async function waitForServerHealth(baseUrl, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Timed out waiting for ${baseUrl}/health`);
}

async function run() {
  console.log('1. Checking App Store & Mac App Store icons (Rule #18 / ITMS-90717)...');
  const contentsRaw = fs.readFileSync(path.join(ICON_DIR, 'Contents.json'), 'utf8');
  assert.notEqual(contentsRaw.charCodeAt(0), 0xfeff, 'Contents.json must not start with a UTF-8 BOM');
  const contentsJson = JSON.parse(contentsRaw);
  const pngFiles = fs.readdirSync(ICON_DIR).filter((f) => f.endsWith('.png'));
  assert.ok(pngFiles.length >= 21, `Expected iOS + macOS icon PNGs, found ${pngFiles.length}`);
  for (const file of pngFiles) {
    const hdr = readPngHeader(fs.readFileSync(path.join(ICON_DIR, file)));
    assert.equal(hdr.colorType, 2, `Icon ${file} must be opaque RGB (colorType 2), got ${hdr.colorType}`);
    assert.equal(hdr.bitDepth, 8, `Icon ${file} bitDepth must be 8`);
  }
  const hasMacIcons = contentsJson.images.some((img) => img.idiom === 'mac');
  const hasIosMarketing = contentsJson.images.some((img) => img.idiom === 'ios-marketing');
  assert.ok(hasMacIcons && hasIosMarketing, 'Contents.json must declare both ios-marketing and mac icons');
  for (const img of contentsJson.images) {
    assert.ok(fs.existsSync(path.join(ICON_DIR, img.filename)), `Contents.json references missing file ${img.filename}`);
  }
  console.log(`   PASS: ${pngFiles.length} PNG icons verified opaque RGB (colorType=2).`);

  console.log('2. Auditing native Swift multiplatform client & Apple manifests...');
  const swiftSrc = fs.readFileSync(path.join(ROOT, 'apps', 'mobile-ios', 'SweeprVpnApp.swift'), 'utf8');
  assert.ok(swiftSrc.includes('@main'), 'SweeprVpnApp.swift missing @main entry point');
  assert.ok(swiftSrc.includes('SweeprStoreKitManager'), 'SweeprVpnApp.swift missing StoreKit 2 manager');
  assert.ok(swiftSrc.includes('VpnConsentDisclosureSheet'), 'SweeprVpnApp.swift missing Guideline 5.4 VPN disclosure sheet');
  assert.ok(swiftSrc.includes('deleteAccountAndData'), 'SweeprVpnApp.swift missing in-app Delete Account');
  assert.ok(swiftSrc.includes('requestReview'), 'SweeprVpnApp.swift missing SKStoreReviewController requestReview');
  assert.ok(swiftSrc.includes('MenuBarExtra') && swiftSrc.includes('SMAppService'), 'SweeprVpnApp.swift missing macOS MenuBarExtra / SMAppService');

  const pubHexMatch = swiftSrc.match(/static let pubKeyHex = "([0-9a-f]{64})"/);
  assert.ok(pubHexMatch, 'SweeprVpnApp.swift missing 64-char Ed25519 pubKeyHex');
  const swiftPubKeyHex = pubHexMatch[1];

  const forbiddenSwiftPatterns = [
    /\bandroid\b/i,
    /google\s+play/i,
    /\btrial\b/i,
    /\bbeta\b/i,
    /\/order\b/i,
    /stripe\.com/i,
    /mobileconfig/i
  ];
  for (const re of forbiddenSwiftPatterns) {
    assert.ok(!re.test(swiftSrc), `SweeprVpnApp.swift must not contain forbidden App Review pattern: ${re}`);
  }

  assertXmlTagsBalanced(path.join(ROOT, 'apps', 'mobile-ios', 'Info.plist'), [
    'NSCameraUsageDescription',
    'NSLocalNetworkUsageDescription',
    'ITSAppUsesNonExemptEncryption'
  ]);
  assertXmlTagsBalanced(path.join(ROOT, 'apps', 'mobile-ios', 'TunnelExtension', 'Info.plist'), [
    'com.apple.networkextension.packet-tunnel'
  ]);
  assertXmlTagsBalanced(path.join(ROOT, 'apps', 'mobile-ios', 'PrivacyInfo.xcprivacy'), [
    '<false/>',
    'CA92.1'
  ]);
  assertXmlTagsBalanced(path.join(ROOT, 'apps', 'mobile-ios', 'TunnelExtension', 'PrivacyInfo.xcprivacy'), [
    'NSPrivacyTracking'
  ]);
  assertXmlTagsBalanced(path.join(ROOT, 'apps', 'mobile-ios', 'SweeprVPN.entitlements'), ['packet-tunnel-provider']);
  assertXmlTagsBalanced(path.join(ROOT, 'apps', 'mobile-ios', 'SweeprVPNMac.entitlements'), ['com.apple.security.app-sandbox', 'packet-tunnel-provider']);
  assertXmlTagsBalanced(path.join(ROOT, 'apps', 'mobile-ios', 'TunnelExtension', 'TunnelExtension.entitlements'), ['packet-tunnel-provider']);
  assertXmlTagsBalanced(path.join(ROOT, 'apps', 'mobile-ios', 'TunnelExtension', 'TunnelExtensionMac.entitlements'), ['com.apple.security.app-sandbox', 'packet-tunnel-provider', '$(TeamIdentifierPrefix)com.sweepr.vpn']);
  const shotDir = path.join(ROOT, 'apps', 'mobile-ios', 'fastlane', 'screenshots', 'en-GB');
  const expectedShots = [
    ['iphone-6.9', 1290, 2796],
    ['ipad-13', 2048, 2732],
    ['macos', 2880, 1800]
  ];
  let shotCount = 0;
  for (const [prefix, w, h] of expectedShots) {
    for (const screen of ['01-connected', '02-servers', '03-wifi-shield', '04-account']) {
      const f = path.join(shotDir, `${prefix}-${screen}.png`);
      assert.ok(fs.existsSync(f), `Missing App Store screenshot: ${f}`);
      const hdr = readPngHeader(fs.readFileSync(f));
      assert.equal(hdr.width, w, `${prefix}-${screen}.png width must be ${w}`);
      assert.equal(hdr.height, h, `${prefix}-${screen}.png height must be ${h}`);
      assert.equal(hdr.colorType, 2, `${prefix}-${screen}.png must be opaque RGB (colorType=2)`);
      assert.equal(hdr.bitDepth, 8, `${prefix}-${screen}.png bitDepth must be 8`);
      shotCount++;
    }
  }
  assert.equal(shotCount, 12, 'Expected 12 verified App Store screenshots');
  const storekitJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps', 'mobile-ios', 'SweeprVPN.storekit'), 'utf8'));
  const skProductIds = new Set(storekitJson.subscriptionGroups[0].subscriptions.map((s) => s.productID));
  for (const pid of ['com.sweepr.vpn.pro.annual', 'com.sweepr.vpn.pro.sixmonth', 'com.sweepr.vpn.pro.monthly', 'com.sweepr.vpn.addon.radar.annual']) {
    assert.ok(skProductIds.has(pid), `SweeprVPN.storekit missing product ${pid}`);
  }
  console.log('   PASS: Swift app, plists, privacy manifests, entitlements, and StoreKit config validated.');

  console.log('3. Auditing Website Support/Privacy & Desktop Tauri UI...');
  const supportHtml = fs.readFileSync(path.join(ROOT, 'website', 'support.html'), 'utf8');
  assert.ok(supportHtml.includes('mailto:support@sweeprvpn.com'), 'website/support.html missing visible support@sweeprvpn.com mailto link');
  const privacyHtml = fs.readFileSync(path.join(ROOT, 'website', 'privacy.html'), 'utf8');
  assert.ok(privacyHtml.includes('StoreKit 2') && privacyHtml.includes('Delete Account'), 'website/privacy.html missing Apple StoreKit / Delete Account disclosures');
  const desktopHtml = fs.readFileSync(path.join(ROOT, 'apps', 'desktop-tauri', 'ui', 'index.html'), 'utf8');
  assert.ok(desktopHtml.includes('1st-Month Intro Offer'), 'desktop UI missing renamed 1st-Month Intro Offer');
  assert.ok(!desktopHtml.includes('1st-Month Trial'), 'desktop UI still mentions 1st-Month Trial');
  assert.ok(!desktopHtml.includes('48.4 Mbps'), 'desktop UI still contains hardcoded fake throughput');
  assert.ok(!desktopHtml.includes("Neighbor's Unknown Android"), 'desktop UI still contains hardcoded fake device');
  assert.ok(desktopHtml.includes('executeAccountDeletion') && desktopHtml.includes('IS_APPLE_APP_STORE'), 'desktop UI missing in-app Delete Account or IS_APPLE_APP_STORE guard');
  console.log('   PASS: Website & Desktop Tauri UI compliance checks passed.');

  console.log('4. Starting live backend server for end-to-end API compliance checks...');
  const { publicKey: applePub, privateKey: applePriv } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const applePubPem = applePub.export({ type: 'spki', format: 'pem' });
  const { publicKey: wgPub } = crypto.generateKeyPairSync('x25519');
  const mockWgNodePubB64 = Buffer.from(wgPub.export({ format: 'jwk' }).x, 'base64url').toString('base64');

  function signTestStoreKitJws(payload) {
    const h = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
    const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.sign('sha256', Buffer.from(`${h}.${b}`, 'utf8'), { key: applePriv, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    return `${h}.${b}.${sig}`;
  }

  const tmpStateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweepr-appstore-e2e-'));
  const mockAgentServer = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, peers: 0, capacity: 100 }));
    }
    if (req.url === '/peers' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, public_key: mockWgNodePubB64, address: '10.64.0.9/32' }));
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
  });

  await new Promise((resolve) => mockAgentServer.listen(0, '127.0.0.1', resolve));
  const mockAgentPort = mockAgentServer.address().port;
  const serverPort = await getFreePort();
  const baseUrl = `http://127.0.0.1:${serverPort}`;
  const reviewKey = 'SWEEPR-VPN-TEST-REVW-2026';
  const reviewEmail = 'appreview@sweeprvpn.com';

  const mockNodes = [
    {
      code: 'UK-LON-01',
      country: 'United Kingdom',
      city: 'London',
      flag: 'GB',
      ip: '127.0.0.1',
      hostname: 'uk-lon-01.wg.sweeprvpn.com',
      port: 51820,
      agent_port: mockAgentPort,
      agent_tls: false,
      agent_secret: 'test_agent_secret_1234',
      public_key: mockWgNodePubB64
    }
  ];

  const child = spawn(process.execPath, [path.join(ROOT, 'website', 'server.mjs')], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(serverPort),
      PUBLIC_URL: baseUrl,
      SWEEPR_STATE_DIR: tmpStateDir,
      APP_REVIEW_DEMO_EMAIL: reviewEmail,
      APP_REVIEW_DEMO_KEY: reviewKey,
      APPLE_STOREKIT_TEST_PUBLIC_KEY_PEM: applePubPem,
      VPN_NODES: JSON.stringify(mockNodes),
      SWEEPR_CRM_URL: 'http://127.0.0.1:1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderrBuf = '';
  child.stderr.on('data', (d) => { stderrBuf += d.toString(); });

  try {
    await waitForServerHealth(baseUrl);

    // 4a. App Review demo key activation supports 5+ devices (custom max_devices: 25) & real Ed25519 verification
    let demoToken = '';
    for (let i = 1; i <= 5; i++) {
      const r = await fetch(`${baseUrl}/api/vpn/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: reviewKey,
          email: reviewEmail,
          device_id: `review-ios-dev-${i}`,
          device_name: `App Review iPhone ${i}`,
          os: 'ios'
        })
      });
      const d = await r.json();
      assert.equal(r.status, 200, `Demo key device ${i} failed: ${JSON.stringify(d)}`);
      assert.equal(d.ok, true);
      assert.equal(d.max_devices, 25);
      demoToken = d.license_token || d.token;
    }
    verifyEd25519TokenWithSwiftHex(demoToken, swiftPubKeyHex);
    console.log('   PASS: App Review demo account allows >3 concurrent devices & Ed25519 token verifies against Swift pubKeyHex.');

    // 4b. StoreKit 2 Sandbox & Production purchase verification + anti-theft ownership enforcement
    const futureExp = Date.now() + 365 * 86400000;
    const origTxId = `2000000${Date.now()}`;
    const sandboxJws = signTestStoreKitJws({
      bundleId: 'com.sweepr.vpn',
      productId: 'com.sweepr.vpn.pro.annual',
      originalTransactionId: origTxId,
      transactionId: origTxId,
      environment: 'Sandbox',
      purchaseDate: Date.now(),
      expiresDate: futureExp,
      storefront: 'GBR',
      currency: 'GBP'
    });
    const skRes = await fetch(`${baseUrl}/api/vpn/apple/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signed_transaction_info: sandboxJws,
        email: 'applebuyer@example.com',
        device_id: 'ios-buyer-1',
        device_name: 'iPhone 16 Pro',
        os: 'ios'
      })
    });
    const skJson = await skRes.json();
    assert.equal(skRes.status, 200, `StoreKit verify failed: ${JSON.stringify(skJson)}`);
    assert.equal(skJson.ok, true);
    assert.equal(skJson.apple_environment, 'Sandbox');
    verifyEd25519TokenWithSwiftHex(skJson.license_token, swiftPubKeyHex);

    // Forged JWS rejected
    const forgedRes = await fetch(`${baseUrl}/api/vpn/apple/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signed_transaction_info: `${sandboxJws.slice(0, -4)}AAAA` })
    });
    assert.equal(forgedRes.status, 401);

    // Cross-account claim of same originalTransactionId rejected with 409
    const stealRes = await fetch(`${baseUrl}/api/vpn/apple/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signed_transaction_info: sandboxJws, email: 'attacker@example.com', device_id: 'attacker-1' })
    });
    assert.equal(stealRes.status, 409);

    // 4c. App Store Server Notifications V2 webhook (DID_CHANGE_RENEWAL_STATUS & EXPIRED)
    const webhookJws = signTestStoreKitJws({
      notificationType: 'DID_CHANGE_RENEWAL_STATUS',
      subtype: 'AUTO_RENEW_DISABLED',
      data: {
        bundleId: 'com.sweepr.vpn',
        environment: 'Sandbox',
        originalTransactionId: origTxId
      }
    });
    const whRes = await fetch(`${baseUrl}/api/webhooks/apple`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signedPayload: webhookJws })
    });
    const whJson = await whRes.json();
    assert.equal(whRes.status, 200);
    assert.equal(whJson.ok, true);
    assert.equal(whJson.account_matched, true);

    // 4d. Connect API defaults & IPv6/NAT64 + ACR DNS Shield flags
    const wgPriv = crypto.generateKeyPairSync('x25519');
    const clientPubB64 = Buffer.from(wgPriv.publicKey.export({ format: 'jwk' }).x, 'base64url').toString('base64');
    const defConn = await (await fetch(`${baseUrl}/api/vpn/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activation_code: skJson.license_key, email: 'applebuyer@example.com', public_key: clientPubB64, server_code: 'UK-LON-01' })
    })).json();
    assert.equal(defConn.ok, true);
    assert.equal(defConn.dns, '10.64.0.1, 1.1.1.1');
    assert.equal(defConn.endpoint, '127.0.0.1:51820');

    const shieldConn = await (await fetch(`${baseUrl}/api/vpn/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activation_code: skJson.license_key,
        email: 'applebuyer@example.com',
        public_key: clientPubB64,
        server_code: 'UK-LON-01',
        acr_shield: true,
        ipv6_dns: true,
        prefer_hostname: true
      })
    })).json();
    assert.equal(shieldConn.ok, true);
    assert.equal(shieldConn.dns, '10.64.0.1, 1.1.1.2');
    assert.equal(shieldConn.endpoint, 'uk-lon-01.wg.sweeprvpn.com:51820');

    // 4e. StoreKit-authenticated permanent account deletion frees originalTransactionId
    const delRes = await fetch(`${baseUrl}/api/vpn/account/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signed_transaction_info: sandboxJws })
    });
    const delJson = await delRes.json();
    assert.equal(delRes.status, 200);
    assert.equal(delJson.ok, true);
    assert.equal(delJson.deleted, true);

    const postDelCheck = await fetch(`${baseUrl}/api/vpn/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: skJson.license_key, email: 'applebuyer@example.com', device_id: 'ios-buyer-1' })
    });
    assert.notEqual(postDelCheck.status, 200, 'Deleted account license key must no longer activate');
    console.log('   PASS: StoreKit 2 JWS verify, V2 webhook, DNS Shield/NAT64 hostname connect, and StoreKit-auth account deletion passed.');

    // 4f. Web routes & ?app=1 embed sanitization
    const iosAppHtml = await (await fetch(`${baseUrl}/ios-app`)).text();
    assert.ok(!/android|google play/i.test(iosAppHtml), '/ios-app must not mention Android or Google Play');

    const dlIosHtml = await (await fetch(`${baseUrl}/download?platform=picker`, { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' } })).text();
    assert.ok(!dlIosHtml.includes('SWEEPRVPN.apk') && !dlIosHtml.includes('Google Play Beta'), '/download?platform=picker with iOS UA must hide APK and Play Beta');

    const dlMacHtml = await (await fetch(`${baseUrl}/download?platform=picker`, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6)' } })).text();
    assert.ok(!dlMacHtml.includes('SWEEPRVPN.apk') && !dlMacHtml.includes('Google Play Beta'), '/download?platform=picker with macOS UA must hide APK and Play Beta');

    const privAppHtml = await (await fetch(`${baseUrl}/privacy.html?app=1`)).text();
    assert.ok(!privAppHtml.includes('googletagmanager.com') && !privAppHtml.includes('sweepr-order-draft-redirect'), '/privacy.html?app=1 must strip gtag and order redirect script');
    assert.ok(privAppHtml.includes('sweepr-app-embed-guard'), '/privacy.html?app=1 missing external CTA guard');
    console.log('   PASS: /ios-app, /download platform picker, and ?app=1 sanitization passed.');

    console.log('\nALL APP STORE COMPLIANCE CHECKS PASSED.');
  } finally {
    child.kill();
    mockAgentServer.close();
    fs.rmSync(tmpStateDir, { recursive: true, force: true });
    if (stderrBuf.trim()) {
      console.error('[server stderr]', stderrBuf.trim());
    }
  }
}

run().catch((err) => {
  console.error('COMPLIANCE VERIFICATION FAILED:', err);
  process.exit(1);
});
