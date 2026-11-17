#!/usr/bin/env node
/**
 * SWEEPR VPN — CI SEO, Schema, Safe Browsing & International Architecture Quality Gate
 * Run in .github/workflows/vpn-daily-seo-pipeline.yml Step 6.5 (and locally before push).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VPN_ROOT = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(VPN_ROOT, 'website');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');

const ROUTE_TO_HTML = {
  '/': 'index.html',
  '/de': 'de/index.html',
  '/fr': 'fr/index.html',
  '/es': 'es/index.html',
  '/pricing': 'pricing.html',
  '/de/pricing': 'de/pricing.html',
  '/fr/pricing': 'fr/pricing.html',
  '/es/pricing': 'es/pricing.html',
  '/solutions': 'solutions.html',
  '/setup': 'setup.html',
  '/guides': 'guides.html',
  '/vs': 'vs.html',
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
  '/terms': 'terms.html'
};

const MOJIBAKE_RE =
  /\u00c3[\u0192\u00a2\u00b0\u00a9\u00bc\u00a4]|\u00c2[\u00a3\u00b7\u00a9\u00ae\u00bb]|\u00e2[\u201a\u20ac][\u00ac\u0093\u0094\u009c\u009d\u00a2\u201d\u201c]|\u00e2\u201a\u00ac|\u00f0\u0178|\u00ef\u00b8/;

function decodeHtmlEntities(str) {
  return String(str || '')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&bull;|&middot;/gi, '·')
    .replace(/&pound;/gi, '£')
    .replace(/&euro;/gi, '€')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

function collectNodeTypes(node, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (Array.isArray(node)) {
    for (const item of node) collectNodeTypes(item, found);
    return found;
  }
  const t = node['@type'];
  if (typeof t === 'string') found.push(t);
  else if (Array.isArray(t)) found.push(...t.filter((x) => typeof x === 'string'));
  if (Array.isArray(node['@graph'])) collectNodeTypes(node['@graph'], found);
  return found;
}

function resolveRouteFile(urlPath) {
  if (ROUTE_TO_HTML[urlPath]) return path.join(WEBSITE_DIR, ROUTE_TO_HTML[urlPath]);
  const clean = urlPath.replace(/^\/+/, '');
  if (!clean || clean === 'download') return null;
  const candidate = path.join(WEBSITE_DIR, `${clean}.html`);
  return fs.existsSync(candidate) ? candidate : null;
}

const errors = [];
const fail = (msg) => errors.push(msg);

// 1. Sitemap budget [50, 110] & reciprocal xmlns:xhtml hreflang validation
if (!fs.existsSync(SITEMAP_PATH)) {
  fail('Missing website/sitemap.xml');
}
const sitemapXml = fs.existsSync(SITEMAP_PATH) ? fs.readFileSync(SITEMAP_PATH, 'utf8') : '';
const hasXhtmlNs = sitemapXml.includes('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
if (!hasXhtmlNs) fail('sitemap.xml missing xmlns:xhtml="http://www.w3.org/1999/xhtml" namespace');

const urlBlocks = [...sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
const locs = urlBlocks
  .map((b) => (b.match(/<loc>([^<]+)<\/loc>/) || [])[1]?.trim())
  .filter(Boolean);

if (locs.length < 50 || locs.length > 110) {
  fail(`Sitemap URL count ${locs.length} outside [50, 110]`);
}

const hreflangGroups = new Map();
for (const block of urlBlocks) {
  const loc = (block.match(/<loc>([^<]+)<\/loc>/) || [])[1]?.trim();
  const alts = [...block.matchAll(/<xhtml:link\s+[^>]*hreflang="([^"]+)"\s+href="([^"]+)"[^>]*\/?>/gi)].map((m) => ({
    hreflang: m[1].trim(),
    href: m[2].trim()
  }));
  if (alts.length > 0 && loc) {
    const map = new Map(alts.map((a) => [a.hreflang, a.href]));
    if (!map.has('x-default')) fail(`Sitemap hreflang block for ${loc} missing x-default`);
    if (![...map.values()].includes(loc)) fail(`Sitemap hreflang block for ${loc} missing self-referencing alternate`);
    hreflangGroups.set(loc, map);
  }
}

for (const [loc, altMap] of hreflangGroups.entries()) {
  for (const [lang, targetHref] of altMap.entries()) {
    if (lang === 'x-default') continue;
    const peerMap = hreflangGroups.get(targetHref);
    if (!peerMap) {
      fail(`Reciprocal hreflang missing sitemap <url> block for ${targetHref} (linked from ${loc})`);
      continue;
    }
    if (![...peerMap.values()].includes(loc)) {
      fail(`Non-reciprocal hreflang: ${targetHref} does not link back to ${loc}`);
    }
  }
}

// 2. Zero zombie noindex files & < 30% 5-gram overlap across solutions/
const pillarDirs = ['solutions', 'setup', 'guides', 'vs'];
const stripHtml = (h) =>
  h
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<details[\s\S]*?<\/details>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const solShingles = [];
const pillarFiles = [];
for (const dir of pillarDirs) {
  const dirPath = path.join(WEBSITE_DIR, dir);
  if (!fs.existsSync(dirPath)) continue;
  for (const f of fs.readdirSync(dirPath).filter((x) => x.endsWith('.html')).sort()) {
    const abs = path.join(dirPath, f);
    const raw = fs.readFileSync(abs, 'utf8');
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(raw)) {
      fail(`Zombie noindex found in website/${dir}/${f}`);
    } else {
      pillarFiles.push({ rel: `${dir}/${f}`, abs, raw });
    }
    if (dir === 'solutions') {
      const words = stripHtml(raw).split(' ').filter(Boolean);
      const s = new Set();
      for (let i = 0; i <= words.length - 5; i++) s.add(words.slice(i, i + 5).join(' '));
      solShingles.push({ f, s });
    }
  }
}

let maxOverlap = 0;
for (let i = 0; i < solShingles.length; i++) {
  for (let j = i + 1; j < solShingles.length; j++) {
    let inter = 0;
    for (const g of solShingles[i].s) if (solShingles[j].s.has(g)) inter++;
    const sim = ((2 * inter) / (solShingles[i].s.size + solShingles[j].s.size || 1)) * 100;
    if (sim > maxOverlap) maxOverlap = sim;
    if (sim >= 30.0) {
      fail(`5-gram overlap ${sim.toFixed(2)}% >= 30% (${solShingles[i].f} vs ${solShingles[j].f})`);
    }
  }
}

// 3. Indexable page checks (JSON-LD parse + zero FAQPage/HowTo, decoded <title> <= 65, mojibake, hijackers)
const checkedFiles = new Map();
for (const loc of locs) {
  try {
    const u = new URL(loc);
    const abs = resolveRouteFile(u.pathname);
    if (!abs || !fs.existsSync(abs)) continue;
    const rel = path.relative(WEBSITE_DIR, abs).replace(/\\/g, '/');
    if (!checkedFiles.has(rel)) {
      checkedFiles.set(rel, { rel, abs, loc, html: fs.readFileSync(abs, 'utf8') });
    }
  } catch {}
}

let maxTitleLen = 0;
let jsonLdCount = 0;
for (const file of checkedFiles.values()) {
  const { rel, html } = file;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const decodedTitle = decodeHtmlEntities(titleMatch ? titleMatch[1] : '');
  if (!decodedTitle) {
    fail(`Missing <title> in website/${rel}`);
  } else {
    if (decodedTitle.length > maxTitleLen) maxTitleLen = decodedTitle.length;
    if (decodedTitle.length > 65) {
      fail(`Title exceeds 65 chars (${decodedTitle.length}): "${decodedTitle}" in website/${rel}`);
    }
  }

  for (const m of html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    jsonLdCount++;
    let parsed;
    try {
      parsed = JSON.parse(m[1]);
    } catch (err) {
      fail(`Invalid JSON-LD syntax in website/${rel}: ${err.message}`);
      continue;
    }
    const types = collectNodeTypes(parsed);
    if (types.includes('FAQPage') || types.includes('HowTo')) {
      fail(`Deprecated schema type (${types.filter((t) => t === 'FAQPage' || t === 'HowTo').join(', ')}) in website/${rel}`);
    }
  }

  if (MOJIBAKE_RE.test(html)) {
    fail(`UTF-8 mojibake sequence detected in website/${rel}`);
  }
  if (html.includes('sweepr-order-draft-redirect')) {
    fail(`Back-button hijacking script "sweepr-order-draft-redirect" found in website/${rel}`);
  }
  if (/<iframe[^>]*SWEEPRVPN\.apk/i.test(html)) {
    fail(`Hidden SWEEPRVPN.apk auto-download iframe found in website/${rel}`);
  }
}

// 4. Pillar Direct-Answer [40, 60] words & Benjamin Cook E-E-A-T byline
let minDirectWords = 999;
let maxDirectWords = 0;
for (const p of pillarFiles) {
  const daMatch = p.raw.match(/id=["']direct-answer["'][\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
  if (!daMatch) {
    fail(`Missing #direct-answer block on website/${p.rel}`);
  } else {
    const words = decodeHtmlEntities(daMatch[1].replace(/<[^>]+>/g, ' ')).split(/\s+/).filter(Boolean).length;
    if (words < minDirectWords) minDirectWords = words;
    if (words > maxDirectWords) maxDirectWords = words;
    if (words < 40 || words > 60) {
      fail(`#direct-answer word count ${words} outside [40, 60] on website/${p.rel}`);
    }
  }
  if (!/Benjamin Cook/i.test(p.raw)) {
    fail(`Missing Benjamin Cook E-E-A-T attribution on website/${p.rel}`);
  }
}

// 5. Server.mjs download safety, back-button hijack removal & UTF-8 integrity
const serverPath = path.join(WEBSITE_DIR, 'server.mjs');
const serverSrc = fs.existsSync(serverPath) ? fs.readFileSync(serverPath, 'utf8') : '';
if (MOJIBAKE_RE.test(serverSrc)) {
  fail('UTF-8 mojibake sequence detected in website/server.mjs');
}
if (serverSrc.includes('sweepr-order-draft-redirect')) {
  fail('Back-button hijacking marker "sweepr-order-draft-redirect" found in website/server.mjs');
}
if (/<iframe[^>]*src=["']\/download\/SWEEPRVPN\.apk/i.test(serverSrc)) {
  fail('Hidden SWEEPRVPN.apk auto-download <iframe> found in website/server.mjs');
}
if (!serverSrc.includes("q.get('direct') !== '1'")) {
  fail("Missing q.get('direct') !== '1' explicit download click gate in website/server.mjs");
}

if (errors.length > 0) {
  console.error(`\n❌ CI SEO Quality Gate FAILED (${errors.length} issue${errors.length === 1 ? '' : 's'}):`);
  for (const err of errors) console.error(`  - ${err}`);
  process.exit(1);
}

console.log(
  `✅ CI SEO Quality Gate PASSED: sitemap=${locs.length}/110, hreflang_groups=${hreflangGroups.size}, pillars=${pillarFiles.length}, json_ld=${jsonLdCount}, max_title=${maxTitleLen}/65, direct_answer_words=${minDirectWords}-${maxDirectWords}, max_solutions_overlap=${maxOverlap.toFixed(2)}%, mojibake=0, deprecated_schema=0`
);
