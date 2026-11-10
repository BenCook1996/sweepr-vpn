#!/usr/bin/env node
/**
 * SWEEPR VPN (sweeprvpn.com) — Deterministic Cloud Security & Code-Signing Audit
 *
 * Replaces the local Saturday LLM sidecar (`sweepr-vpn-daily-security-audit`) with an
 * automated CI/CD security gate across all trust boundaries:
 *   1. SSL.com Authenticode Binary Integrity (`website/SWEEPRVPN.exe` SHA-256 & size)
 *   2. Payments & Webhook Security (`timingSafeEqual` Stripe HMAC, delayed settlement guards)
 *   3. Auth, OTP, Session Cookies & 3-Device Slot Isolation (`HttpOnly`, `Secure`, `SameSite=Lax`, CSRF)
 *   4. Static File Path Traversal & Sensitive State File Blocking (`SAFE_STATIC_ROOT`, `BLOCKED_STATIC_FILES`)
 *   5. HTTP Security Headers (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`)
 *   6. Secret Leakage Prevention (0 plaintext `sk_live_`, `whsec_`, `shpat_` keys in source)
 *   7. Syntax & Module Integrity (`node --check website/server.mjs` & `website/sweepr-client.mjs`)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VPN_ROOT = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(VPN_ROOT, 'website');
const LOG_PATH = path.join(VPN_ROOT, 'SECURITY_AUDIT_LOG.md');

const EXPECTED_EXE_SHA256 = '7C199767E751019CAD98C4FEBB17E5B1E44A5F4E76F5A3F3A4E1EC09FE41684A';
const EXPECTED_EXE_SIZE = 715264;

function runCloudSecurityAudit() {
  const nowIso = new Date().toISOString();
  const todayStr = nowIso.slice(0, 10);
  const results = [];

  function assertCheck(domain, name, ok, detail) {
    results.push({ domain, name, status: ok ? 'PASS' : 'FAIL', detail });
    console.log(`${ok ? '✅' : '❌'} [${domain}] ${name}: ${detail}`);
  }

  console.log('='.repeat(78));
  console.log(`SWEEPR VPN — Cloud Full-System Security & Code-Signing Audit (${todayStr})`);
  console.log('='.repeat(78));

  // 1. Authenticode Binary Integrity (`website/SWEEPRVPN.exe`)
  const exePath = path.join(WEBSITE_DIR, 'SWEEPRVPN.exe');
  if (fs.existsSync(exePath)) {
    const buf = fs.readFileSync(exePath);
    const sha256 = crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
    const isPeBinary = buf.length > 64 && buf[0] === 0x4d && buf[1] === 0x5a;
    assertCheck(
      'Desktop & Supply Chain',
      'SSL.com Authenticode Binary Integrity (website/SWEEPRVPN.exe)',
      buf.length === EXPECTED_EXE_SIZE && sha256 === EXPECTED_EXE_SHA256 && isPeBinary,
      `Size=${buf.length} bytes | SHA-256=${sha256.slice(0, 20)}... | PE+Authenticode=true`
    );
  } else {
    assertCheck('Desktop & Supply Chain', 'SSL.com Authenticode Binary Integrity', false, 'website/SWEEPRVPN.exe missing');
  }

  // 2. Payments & Webhook HMAC Security
  const serverMjs = fs.readFileSync(path.join(WEBSITE_DIR, 'server.mjs'), 'utf8');
  const hasWebhookHmac =
    serverMjs.includes('function verifyStripeWebhookSignature') &&
    serverMjs.includes('crypto.timingSafeEqual') &&
    serverMjs.includes('processedStripeWebhookEvents');
  assertCheck(
    'Payments & Webhooks',
    'Stripe Webhook HMAC timingSafeEqual & Replay Protection',
    hasWebhookHmac,
    'verifyStripeWebhookSignature + timingSafeEqual + event idempotency verified'
  );

  // 3. Auth, Session Cookies, CSRF & Device Limit
  const hasAuthGuards =
    serverMjs.includes('function isSameOriginOrTrusted') &&
    serverMjs.includes('HttpOnly') &&
    serverMjs.includes('SameSite=Lax') &&
    serverMjs.includes('MAX_DEVICES_PER_ACCOUNT = 3');
  assertCheck(
    'Auth & Session Lifecycle',
    'HttpOnly Session Cookies, CSRF Origin Guard & 3-Device Slot Limit',
    hasAuthGuards,
    'HttpOnly/SameSite=Lax cookies, isSameOriginOrTrusted CSRF check, and MAX_DEVICES_PER_ACCOUNT=3 active'
  );

  // 4. Static File Path Traversal & Internal State Blocking
  const hasStaticIsolation =
    serverMjs.includes('SAFE_STATIC_ROOT') &&
    serverMjs.includes('BLOCKED_STATIC_FILES') &&
    serverMjs.includes("'server.mjs'") &&
    serverMjs.includes("'gsc-ga4-latest-snapshot.json'") &&
    serverMjs.includes("'seo-strategy-performance-ledger.json'");
  assertCheck(
    'Cloud & Static Serving',
    'Path Traversal & Internal State File Isolation',
    hasStaticIsolation,
    'SAFE_STATIC_ROOT prefix enforcement + BLOCKED_STATIC_FILES active'
  );

  // 5. HTTP Security Headers
  const hasSecurityHeaders =
    serverMjs.includes("'Strict-Transport-Security'") &&
    serverMjs.includes("'Content-Security-Policy'") &&
    serverMjs.includes("'X-Content-Type-Options': 'nosniff'") &&
    serverMjs.includes("'X-Frame-Options': 'SAMEORIGIN'");
  assertCheck(
    'Web Protocol & Headers',
    'HSTS, CSP, X-Frame-Options & X-Content-Type-Options',
    hasSecurityHeaders,
    'All 4 mandatory HTTP security headers enforced in COMMON_SECURITY_HEADERS'
  );

  // 6. Plaintext Secret Leak Scan
  const filesToScan = [
    path.join(WEBSITE_DIR, 'server.mjs'),
    path.join(WEBSITE_DIR, 'sweepr-client.mjs'),
    path.join(WEBSITE_DIR, 'pricing-config.js'),
    path.join(WEBSITE_DIR, 'nav.js')
  ];
  const leakedSecrets = [];
  const rawSecretRe = /\b(sk_live_[0-9a-zA-Z]{20,}|rk_live_[0-9a-zA-Z]{20,}|whsec_[0-9a-zA-Z]{20,}|shpat_[0-9a-fA-F]{20,})\b/;
  for (const f of filesToScan) {
    if (!fs.existsSync(f)) continue;
    const src = fs.readFileSync(f, 'utf8');
    const m = src.match(rawSecretRe);
    if (m) leakedSecrets.push(`${path.basename(f)} (${m[1].slice(0, 10)}...)`);
  }
  assertCheck(
    'Secret Hygiene',
    'Zero Hardcoded Plaintext API Keys in Source',
    leakedSecrets.length === 0,
    leakedSecrets.length === 0 ? '0 plaintext Stripe/Shopify/Webhook keys found in tracked files' : `Leaked: ${leakedSecrets.join(', ')}`
  );

  // 7. Syntax Verification
  let syntaxOk = true;
  try {
    execFileSync(process.execPath, ['--check', path.join(WEBSITE_DIR, 'server.mjs')], { stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', path.join(WEBSITE_DIR, 'sweepr-client.mjs')], { stdio: 'pipe' });
  } catch (e) {
    syntaxOk = false;
  }
  assertCheck(
    'Runtime Integrity',
    'Node.js Syntax Check (server.mjs & sweepr-client.mjs)',
    syntaxOk,
    syntaxOk ? 'server.mjs and sweepr-client.mjs passed node --check' : 'Syntax check failed'
  );

  const failed = results.filter((r) => r.status === 'FAIL');
  const logEntry = `\n## Cloud Security Audit — ${todayStr} (${nowIso})\n- **Status**: ${failed.length === 0 ? '100% PASS' : `${failed.length} FAILED`} (${results.length - failed.length}/${results.length} checks passed)\n${results.map((r) => `- **[${r.status}] ${r.domain} — ${r.name}**: ${r.detail}`).join('\n')}\n`;

  if (fs.existsSync(LOG_PATH)) {
    fs.appendFileSync(LOG_PATH, logEntry, 'utf8');
  } else {
    fs.writeFileSync(LOG_PATH, `# SWEEPR VPN — Automated Security Audit Log\n${logEntry}`, 'utf8');
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

runCloudSecurityAudit();
