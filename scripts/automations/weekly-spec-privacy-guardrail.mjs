#!/usr/bin/env node
/**
 * Safe Automation #2 (Read-Only Sentinel):
 * Weekly Technical, Spec-Alignment, Zero-Hypocrisy Privacy & 2 MB Guardrail
 *
 * Schedule: Every Wednesday 07:00 Europe/London
 * Output  : artifacts/weekly-spec-privacy-guardrail.md (unless --dry-run)
 * Safety  : Strictly READ-ONLY on website/, scripts/, and git. Never edits files or commits.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractPruned410PathsFromServer } from '../lib/indexnow-410.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VPN_ROOT = path.resolve(__dirname, '..', '..');
const WEBSITE_DIR = path.join(VPN_ROOT, 'website');
const SERVER_PATH = path.join(WEBSITE_DIR, 'server.mjs');
const ROBOTS_PATH = path.join(WEBSITE_DIR, 'robots.txt');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');

const MAX_HTML_BYTES = 1800 * 1024;
const MAX_INLINE_SVG_BYTES = 5 * 1024;
const NOINDEX_RE = /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i;
const SITEPATENT_RE = /sitepatent\.com/i;
const INC_ENTITY_RE = /\bSWEEPR\s+VPN\s+Inc\b\.?/i;
const FOUNDER_NAME_RE = new RegExp(`\\b${['Ben' + 'jamin', 'Co' + 'ok'].join('\\s+')}\\b`, 'i');
const UNCONSENTED_PIXEL_RE = /(?:connect\.facebook\.net|bat\.bing\.com|ads\.reddit\.com|mc\.yandex\.ru|pixel\.wp\.com)/i;

const ROUTE_TO_HTML = {
  '/': 'index.html',
  '/de': 'de-index.html',
  '/fr': 'fr-index.html',
  '/es': 'es-index.html',
  '/pricing': 'pricing.html',
  '/de/pricing': 'de-pricing.html',
  '/fr/pricing': 'fr-pricing.html',
  '/es/pricing': 'es-pricing.html',
  '/solutions': 'solutions.html',
  '/setup': 'setup.html',
  '/guides': 'guides.html',
  '/vs': 'vs.html',
  '/vs/totalvpn': 'vs/totalvpn.html',
  '/tools/leak-test': 'leak-test.html',
  '/de/tools/leak-test': 'de-leak-test.html',
  '/fr/tools/leak-test': 'fr-leak-test.html',
  '/es/tools/leak-test': 'es-leak-test.html',
  '/pt-br/tools/leak-test': 'pt-br-leak-test.html',
  '/sv/tools/leak-test': 'sv-leak-test.html',
  '/tools/isp-throttling-test': 'isp-throttling-test.html',
  '/tools/vpn-renewal-price-checker': 'vpn-renewal-price-checker.html',
  '/tools/smart-tv-tracking-check': 'smart-tv-tracking-check.html',
  '/tools/whats-on-my-wifi': 'whats-on-my-wifi.html',
  '/public-wifi': 'public-wifi.html',
  '/alternatives/totalvpn': 'alternatives-totalvpn.html',
  '/support': 'support.html',
  '/refund': 'refund.html',
  '/privacy': 'privacy.html',
  '/warrant-canary': 'warrant-canary.html',
  '/terms': 'terms.html',
  '/ai-info': 'ai-info.html',
  '/faq': 'faq.html'
};

function resolveSitemapRelHtml(urlPath) {
  const norm = urlPath === '/' ? '/' : urlPath.replace(/\/+$/, '');
  if (norm === '/download') return null; // Dynamic SSR hub in server.mjs
  if (ROUTE_TO_HTML[norm]) return ROUTE_TO_HTML[norm];
  const clean = norm.replace(/^\/+/, '');
  return clean ? `${clean}.html` : null;
}

function parseCliArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const strict = argv.includes('--strict');
  const liveCurl = argv.includes('--live-curl');
  let outDir = path.join(VPN_ROOT, 'artifacts');
  const outIdx = argv.indexOf('--out-dir');
  if (outIdx >= 0 && argv[outIdx + 1]) {
    outDir = path.resolve(VPN_ROOT, argv[outIdx + 1]);
  } else {
    const eqArg = argv.find((a) => a.startsWith('--out-dir='));
    if (eqArg) outDir = path.resolve(VPN_ROOT, eqArg.slice('--out-dir='.length));
  }
  return { dryRun, strict, liveCurl, outDir };
}

function walkHtml(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(abs, out);
    else if (entry.isFile() && entry.name.endsWith('.html')) {
      const rel = path.relative(WEBSITE_DIR, abs).replace(/\\/g, '/');
      out.push({ rel, abs, sizeBytes: fs.statSync(abs).size, raw: fs.readFileSync(abs, 'utf8') });
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

async function main() {
  const { dryRun, strict, liveCurl, outDir } = parseCliArgs(process.argv.slice(2));
  const nowIso = new Date().toISOString();

  const htmlFiles = walkHtml(WEBSITE_DIR);
  const indexableFiles = htmlFiles.filter((f) => !NOINDEX_RE.test(f.raw));

  const checks = [];
  const addCheck = (name, status, detail) => checks.push({ name, status, detail });

  // 1. HTML Size <= 1800 KB, 0 Base64 <img>, 0 inline <svg> > 5 KB
  let maxBytes = 0;
  let maxFile = '';
  const oversizedHtml = [];
  const base64ImgFiles = [];
  const largeSvgHits = [];

  for (const f of htmlFiles) {
    if (f.sizeBytes > maxBytes) {
      maxBytes = f.sizeBytes;
      maxFile = f.rel;
    }
    if (f.sizeBytes > MAX_HTML_BYTES) oversizedHtml.push(`${f.rel} (${(f.sizeBytes / 1024).toFixed(1)} KB)`);
    if (/<img\b[^>]*src=["']data:image\//i.test(f.raw)) base64ImgFiles.push(f.rel);
    for (const m of f.raw.matchAll(/<svg\b[\s\S]*?<\/svg>/gi)) {
      const svgBytes = Buffer.byteLength(m[0], 'utf8');
      if (svgBytes > MAX_INLINE_SVG_BYTES) largeSvgHits.push(`${f.rel} (${(svgBytes / 1024).toFixed(1)} KB)`);
    }
  }
  addCheck(
    '2 MB Googlebot Crawl Buffer (<= 1800 KB)',
    oversizedHtml.length === 0 ? 'PASS' : 'FAIL',
    `Max raw HTML: ${maxFile} (${(maxBytes / 1024).toFixed(1)} KB / 1800 KB); oversized=${oversizedHtml.length}`
  );
  addCheck(
    'Zero Base64 <img> & Zero >5 KB Inline <svg>',
    base64ImgFiles.length === 0 && largeSvgHits.length === 0 ? 'PASS' : 'FAIL',
    `Base64 <img>=${base64ImgFiles.length}; inline <svg> >5KB=${largeSvgHits.length}`
  );

  // 2. Entity hygiene & unconsented pixels across indexable HTML + pad.xml + llms*.txt
  const entityHits = [];
  const pixelHits = [];
  const specDriftHints = [];
  for (const f of indexableFiles) {
    if (SITEPATENT_RE.test(f.raw)) entityHits.push(`${f.rel}:sitepatent.com`);
    if (INC_ENTITY_RE.test(f.raw)) entityHits.push(`${f.rel}:SWEEPR VPN Inc.`);
    if (FOUNDER_NAME_RE.test(f.raw)) entityHits.push(`${f.rel}:founder-name`);
    if (UNCONSENTED_PIXEL_RE.test(f.raw)) pixelHits.push(f.rel);
    if (/\b(?:5|10)\s+simultaneous\s+(?:vpn\s+)?devices\b/i.test(f.raw)) {
      specDriftHints.push(`${f.rel}:5/10-simultaneous-devices`);
    }
    if (/\b(?:download|live)\s+(?:on\s+the\s+)?ios\s+app\s+store\b/i.test(f.raw) && !/pre-?launch|not\s+yet\s+live|pending/i.test(f.raw)) {
      specDriftHints.push(`${f.rel}:ios-app-store-live-claim`);
    }
  }
  for (const extraRel of ['pad.xml', 'llms.txt', 'llms-full.txt']) {
    const abs = path.join(WEBSITE_DIR, extraRel);
    if (!fs.existsSync(abs)) continue;
    const raw = fs.readFileSync(abs, 'utf8');
    if (SITEPATENT_RE.test(raw)) entityHits.push(`${extraRel}:sitepatent.com`);
    if (INC_ENTITY_RE.test(raw)) entityHits.push(`${extraRel}:SWEEPR VPN Inc.`);
    if (FOUNDER_NAME_RE.test(raw)) entityHits.push(`${extraRel}:founder-name`);
  }
  addCheck(
    'Entity & Tracker Hygiene (Zero sitepatent / Inc. / Founder Name / Pixels)',
    entityHits.length === 0 && pixelHits.length === 0 ? 'PASS' : 'FAIL',
    `Entity hits=${entityHits.length}${entityHits.length ? ` (${entityHits.slice(0, 4).join(', ')})` : ''}; unconsented pixels=${pixelHits.length}`
  );
  addCheck(
    'Source-of-Truth Spec Parity (3 Devices, Pre-Launch iOS)',
    specDriftHints.length === 0 ? 'PASS' : 'WARN',
    specDriftHints.length === 0 ? '0 unshipped 5/10-device or live iOS App Store claims detected' : `Review: ${specDriftHints.slice(0, 5).join(', ')}`
  );

  // 3. Static #mobileNavDrawer links before <main>
  const missingNavDrawer = [];
  for (const f of indexableFiles) {
    const hasNav = /<nav\b/i.test(f.raw);
    const drawerIdx = f.raw.search(/id=["']mobileNavDrawer["']/i);
    const mainIdx = f.raw.search(/<main\b/i);
    const drawerAfterMain = mainIdx >= 0 && drawerIdx > mainIdx;
    const slice = drawerIdx >= 0 && !drawerAfterMain
      ? f.raw.slice(drawerIdx, mainIdx >= 0 ? mainIdx : drawerIdx + 6000)
      : '';
    if (!hasNav || drawerAfterMain || !slice || !/<a\s+[^>]*href=["'][^"']+["']/i.test(slice)) {
      missingNavDrawer.push(f.rel);
    }
  }
  addCheck(
    'Static Mobile Nav Links (#mobileNavDrawer before <main>)',
    missingNavDrawer.length === 0 ? 'PASS' : 'FAIL',
    `${indexableFiles.length - missingNavDrawer.length}/${indexableFiles.length} indexable HTML pages verified`
  );

  // 4. Security Headers & CSP in website/server.mjs
  const serverSrc = fs.existsSync(SERVER_PATH) ? fs.readFileSync(SERVER_PATH, 'utf8') : '';
  const requiredHeaders = ['Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy'];
  const missingHeaders = requiredHeaders.filter((h) => !serverSrc.includes(h));
  const cspMatch = serverSrc.match(/['"]Content-Security-Policy['"]\s*:\s*(["'])([^\r\n]*?)\1/);
  const cspVal = cspMatch ? cspMatch[2] : '';
  const unsafeCsp = !cspVal || cspVal.includes("'unsafe-eval'") || cspVal.includes('cdn.tailwindcss.com');
  addCheck(
    'Security Headers & Strict CSP (server.mjs)',
    missingHeaders.length === 0 && !unsafeCsp ? 'PASS' : 'FAIL',
    `Missing headers=${missingHeaders.length}; unsafe-eval/tailwind-cdn=${unsafeCsp}`
  );

  // 5. robots.txt AI Bots (OAI-SearchBot, Claude-SearchBot, PerplexityBot)
  const robotsTxt = fs.existsSync(ROBOTS_PATH) ? fs.readFileSync(ROBOTS_PATH, 'utf8') : '';
  const requiredBots = ['OAI-SearchBot', 'Claude-SearchBot', 'PerplexityBot'];
  const missingBots = requiredBots.filter((b) => !robotsTxt.includes(`User-agent: ${b}`));
  const botsStatus = missingBots.length === 0 ? 'PASS' : strict ? 'FAIL' : 'PENDING_M2';
  addCheck(
    'robots.txt AI Search Allowances (OAI-SearchBot, Claude-SearchBot, PerplexityBot)',
    botsStatus,
    missingBots.length === 0
      ? 'All 3 priority AI search crawlers permitted'
      : `Missing in robots.txt: ${missingBots.join(', ')} (${strict ? 'strict failure' : 'pending M2 robots.txt update'})`
  );

  // 6. sitemap.xml contains 0 PRUNED_410_PATHS or noindex URLs
  const sitemapXml = fs.existsSync(SITEMAP_PATH) ? fs.readFileSync(SITEMAP_PATH, 'utf8') : '';
  const pruned410Set = new Set(extractPruned410PathsFromServer(SERVER_PATH));
  const sitemapLocs = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  const htmlByRel = new Map(htmlFiles.map((f) => [f.rel, f]));
  const badSitemapUrls = [];
  for (const loc of sitemapLocs) {
    try {
      const p = new URL(loc).pathname;
      if (pruned410Set.has(p)) badSitemapUrls.push(`${p} (410)`);
      const mappedRel = resolveSitemapRelHtml(p);
      if (mappedRel) {
        const mappedHtml = htmlByRel.get(mappedRel);
        if (mappedHtml && NOINDEX_RE.test(mappedHtml.raw)) {
          badSitemapUrls.push(`${p} (noindex:${mappedRel})`);
        }
      }
    } catch {}
  }
  addCheck(
    'sitemap.xml Hygiene (Zero 410 / noindex URLs)',
    badSitemapUrls.length === 0 ? 'PASS' : 'FAIL',
    `${sitemapLocs.length} sitemap URLs checked; 410/noindex collisions=${badSitemapUrls.length}${badSitemapUrls.length ? ` (${badSitemapUrls.slice(0, 4).join(', ')})` : ''}`
  );

  // 7. Run scripts/ci-seo-quality-gate.mjs (read-only)
  let ciGateStatus = 'PASS';
  let ciGateOutput = '';
  try {
    ciGateOutput = execFileSync(process.execPath, [path.join(VPN_ROOT, 'scripts', 'ci-seo-quality-gate.mjs')], {
      cwd: VPN_ROOT,
      encoding: 'utf8'
    }).trim();
  } catch (err) {
    ciGateStatus = 'FAIL';
    ciGateOutput = (err.stdout || err.stderr || err.message || '').toString().trim();
  }
  addCheck('CI SEO Quality Gate (scripts/ci-seo-quality-gate.mjs)', ciGateStatus, ciGateOutput.split('\n').pop() || ciGateStatus);

  // 8. Optional Live Header Probe (--live-curl)
  if (liveCurl) {
    try {
      const res = await fetch('https://sweeprvpn.com/', { method: 'HEAD', signal: AbortSignal.timeout(8000) });
      addCheck(
        'Live Storefront HTTP Headers (https://sweeprvpn.com/)',
        res.ok ? 'PASS' : 'WARN',
        `HTTP ${res.status} | HSTS=${Boolean(res.headers.get('strict-transport-security'))} | CSP=${Boolean(res.headers.get('content-security-policy'))}`
      );
    } catch (err) {
      addCheck('Live Storefront HTTP Headers (https://sweeprvpn.com/)', 'WARN', `Offline/unreachable: ${err.message}`);
    }
  }

  const failCount = checks.filter((c) => c.status === 'FAIL').length;
  const warnCount = checks.filter((c) => c.status === 'WARN' || c.status === 'PENDING_M2').length;

  const lines = [
    '# Weekly Technical, Spec-Alignment, Privacy & 2 MB Guardrail Report',
    '',
    `- **Generated At**: \`${nowIso}\` (Schedule: Every Wednesday 07:00 Europe/London)`,
    `- **Mode**: READ-ONLY SENTINEL (${dryRun ? '`--dry-run` (0 files written)' : 'artifact report only; zero production edits'})`,
    `- **Summary**: **${checks.length - failCount - warnCount} PASS** | **${warnCount} WARN / PENDING_M2** | **${failCount} FAIL**`,
    '',
    '## Guardrail Scorecard',
    '',
    '| Check | Status | Details |',
    '|---|---|---|',
    ...checks.map((c) => `| ${c.name} | **${c.status}** | ${c.detail} |`),
    '',
    '## `ci-seo-quality-gate.mjs` Output',
    '',
    '```text',
    ciGateOutput,
    '```',
    ''
  ];

  const md = lines.join('\n');
  if (dryRun) {
    console.log(md);
    console.log(`\n[DRY-RUN] weekly-spec-privacy-guardrail completed with 0 disk writes (failCount=${failCount}).`);
  } else {
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'weekly-spec-privacy-guardrail.md');
    fs.writeFileSync(outPath, md, 'utf8');
    console.log(`✅ Wrote read-only guardrail report to ${path.relative(VPN_ROOT, outPath)}`);
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[weekly-spec-privacy-guardrail Error]', err);
  process.exit(1);
});
