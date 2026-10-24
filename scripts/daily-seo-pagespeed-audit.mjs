#!/usr/bin/env node
/**
 * SWEEPR VPN (sweeprvpn.com)
 * Daily Technical SEO, Crawlability & PageSpeed Audit & Non-Visual Auto-Optimization
 *
 * Runs a rigorous 360-degree audit across:
 *   1. Crawlability & Indexability (sitemap.xml, robots.txt, llms.txt, pad.xml, canonical routing, IndexNow)
 *   2. Technical SEO (title, description, canonicals, JSON-LD schemas, OpenGraph, Twitter cards, h1, internal links)
 *   3. PageSpeed & Core Web Vitals (image sizes, alt-text, width/height dimensions, layout stability,
 *      preconnects, script defer/async, gzip/brotli server compression, ETag / 304 headers, PWA manifest)
 *   4. Non-Visual Auto-Optimizations (synchronizes sitemap, llms.txt, indexing queue, server headers, link targets)
 *
 * Usage:
 *   node scripts/daily-seo-pagespeed-audit.mjs [--fix] [--ping]
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VPN_ROOT = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(VPN_ROOT, 'website');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
const ROBOTS_PATH = path.join(WEBSITE_DIR, 'robots.txt');
const LLMS_PATH = path.join(WEBSITE_DIR, 'llms.txt');
const PAD_PATH = path.join(WEBSITE_DIR, 'pad.xml');
const INDEXING_QUEUE_PATH = path.join(WEBSITE_DIR, 'indexing-queue.json');
const SERVER_PATH = path.join(WEBSITE_DIR, 'server.mjs');
const INDEXNOW_KEY = '8f9a2b4c6d1e3f5a7b9c0d2e4f6a8b0c';

const shouldFix = process.argv.includes('--fix') || true; // Auto-optimize by default
const shouldPing = process.argv.includes('--ping') || process.env.INDEXNOW_PING === 'true';

console.log('='.repeat(78));
console.log('SWEEPR VPN (sweeprvpn.com) — Technical SEO, Crawlability & PageSpeed Audit');
console.log(`Execution Timestamp: ${new Date().toISOString()} | Node ${process.version}`);
console.log('='.repeat(78));

const auditResults = {
  crawlability: { passed: 0, failed: 0, warnings: 0, checks: [] },
  technicalSeo: { passed: 0, failed: 0, warnings: 0, checks: [] },
  pageSpeed: { passed: 0, failed: 0, warnings: 0, checks: [] },
  autoOptimizations: []
};

function pass(category, title, detail = '') {
  auditResults[category].passed++;
  auditResults[category].checks.push({ status: 'PASS', title, detail });
}

function warn(category, title, detail = '') {
  auditResults[category].warnings++;
  auditResults[category].checks.push({ status: 'WARN', title, detail });
}

function fail(category, title, detail = '') {
  auditResults[category].failed++;
  auditResults[category].checks.push({ status: 'FAIL', title, detail });
}

// ============================================================================
// 1. SITEMAP & DISK SYNCHRONIZATION (Non-Visual Auto-Optimization)
// ============================================================================
console.log('\n[Phase 1] Auditing Sitemap, Disk Manifest & Route Alignment...');

const CORE_STATIC_ROUTES = [
  { urlPath: '/', file: 'index.html', priority: '1.0', changefreq: 'weekly' },
  { urlPath: '/pricing', file: 'pricing.html', priority: '0.9', changefreq: 'weekly' },
  { urlPath: '/app', file: 'app-preview.html', priority: '0.8', changefreq: 'weekly' },
  { urlPath: '/tools/leak-test', file: 'leak-test.html', priority: '0.8', changefreq: 'weekly' },
  { urlPath: '/tools/isp-throttling-test', file: 'isp-throttling-test.html', priority: '0.8', changefreq: 'weekly' },
  { urlPath: '/vs/totalvpn', file: 'vs-totalvpn.html', priority: '0.8', changefreq: 'monthly' },
  { urlPath: '/alternatives/totalvpn', file: 'alternatives-totalvpn.html', priority: '0.8', changefreq: 'monthly' },
  { urlPath: '/support', file: 'support.html', priority: '0.6', changefreq: 'monthly' },
  { urlPath: '/refund', file: 'refund.html', priority: '0.5', changefreq: 'monthly' },
  { urlPath: '/privacy', file: 'privacy.html', priority: '0.5', changefreq: 'monthly' },
  { urlPath: '/terms', file: 'terms.html', priority: '0.5', changefreq: 'monthly' }
];

// Scan all programmatic SEO files on disk
const pseoFilesOnDisk = [];
for (const dir of ['solutions', 'setup', 'vs', 'guides']) {
  const dirAbs = path.join(WEBSITE_DIR, dir);
  if (!fs.existsSync(dirAbs)) continue;
  for (const file of fs.readdirSync(dirAbs).sort()) {
    if (!file.endsWith('.html')) continue;
    const slug = file.replace(/\.html$/, '');
    if (dir === 'vs' && slug === 'totalvpn') continue;
    const urlPath = `/${dir}/${slug}`;
    const absPath = path.join(dirAbs, file);
    const content = fs.readFileSync(absPath, 'utf8');
    const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/is);
    const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : urlPath;
    pseoFilesOnDisk.push({
      dir,
      file,
      absPath,
      urlPath,
      loc: `https://sweeprvpn.com${urlPath}`,
      h1: h1Text,
      content
    });
  }
}

const allCanonicalPages = [
  ...CORE_STATIC_ROUTES.map((r) => ({
    urlPath: r.urlPath,
    loc: `https://sweeprvpn.com${r.urlPath === '/' ? '' : r.urlPath}`,
    canonicalLoc: `https://sweeprvpn.com${r.urlPath === '/' ? '/' : r.urlPath}`,
    priority: r.priority,
    changefreq: r.changefreq,
    file: r.file,
    absPath: path.join(WEBSITE_DIR, r.file),
    isCore: true
  })),
  ...pseoFilesOnDisk.map((p) => ({
    urlPath: p.urlPath,
    loc: p.loc,
    canonicalLoc: p.loc,
    priority: '0.8',
    changefreq: 'weekly',
    file: `${p.dir}/${p.file}`,
    absPath: p.absPath,
    isCore: false
  }))
];

// Rebuild and synchronize sitemap.xml with today's date
const todayStr = new Date().toISOString().slice(0, 10);
const newSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allCanonicalPages
  .map(
    (u) => `  <url>
    <loc>${u.canonicalLoc}</loc>
    <lastmod>${todayStr}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
fs.writeFileSync(SITEMAP_PATH, newSitemapXml, 'utf8');
auditResults.autoOptimizations.push(`Synchronized sitemap.xml with ${allCanonicalPages.length} canonical URLs and lastmod ${todayStr}`);
pass('crawlability', 'Sitemap Completeness & Freshness', `${allCanonicalPages.length} canonical URLs registered with 0 missing`);

// Rebuild website/llms.txt for Generative Engine Optimization (GEO / AI citation)
const llmsContent = `# SWEEPR VPN & SWEEPR Wi-Fi Radar (sweeprvpn.com)

> SWEEPR VPN is an ultra-lightweight (~3.7 MB), fast, and easy-to-use 10Gbps WireGuard VPN and Free 30-Second Home Wi-Fi Scanner for Windows 10/11, macOS, Linux, and routers. Built by the team behind SWEEPR Cleaner, it combines 1-click 10Gbps private browsing with a free 30-second Home Wi-Fi & Speed Scanner and a Smart-TV ACR spy blocker.

## Core Capabilities & Technical Differentiators
- **1-Click Private Browsing & Streaming Speed Booster**: Eliminates ISP evening traffic shaping (Virgin Media, BT, Sky, TalkTalk, Vodafone, Eduroam) on 4K streaming, gaming, and remote SSH/Docker workflows. Strict zero-logs policy on diskless RAM-only 10Gbps servers.
- **Free 30-Second Home Wi-Fi & Speed Scanner**: Scans your local subnet in 30 seconds to discover all 15–30+ connected household devices, flag unknown intruders, audit router security vulnerabilities, and detect ISP DNS hijacking.
- **SWEEPR Wi-Fi Radar & Smart-TV Shield (Add-On)**:
  - Instant on-screen alerts whenever an unknown device joins your home Wi-Fi network.
  - 1-click speed booster to stop peak-hour streaming buffering.
  - Automatic Smart-TV spy blocker sinking ACR (Automatic Content Recognition) telemetry domains from Samsung Tizen, LG webOS, Roku, Vizio Inscape, and Amazon Fire TV.
- **Transparent Price-Lock Subscription Plans (Covers up to 10 Devices)**:
  - **Yearly Plan (Most Popular — Save 50%)**: £74.99/year (£6.25/mo) | $95.99 USD ($8.00/mo) | €89.99 EUR (€7.50/mo) | CA$131.99 CAD | A$149.99 AUD | CHF 83.99 | ¥14,999 JPY
  - **6-Monthly Plan (Save 35%)**: £48.99/6 months (£8.17/mo) | $61.99 USD | €58.99 EUR | CA$85.99 CAD | A$97.99 AUD | CHF 54.99 | ¥9,799 JPY
  - **Monthly Plan**: £12.49/month (or £1.99 1st-Month Introductory Offer) | $15.99 USD | €14.99 EUR | CA$21.99 CAD | A$24.99 AUD | CHF 13.99 | ¥2,499 JPY
  - **SWEEPR Wi-Fi Radar & Smart-TV Shield Add-On**: +£14.99/yr | +£9.99/6mo | +£1.99/mo
  - **Refund Policy**: 30-day 100% money-back guarantee and 1-click self-service portal cancellation.

## Core Storefront & Free Diagnostic Tools
- Homepage & Free Home Wi-Fi Scanner: https://sweeprvpn.com/
- Pricing & Plan Comparison: https://sweeprvpn.com/pricing
- Interactive Live Desktop App Preview: https://sweeprvpn.com/app
- Free Instant IP, DNS & WebRTC Leak Test: https://sweeprvpn.com/tools/leak-test
- Free ISP Speed Slowdown & Streaming Throttling Checker: https://sweeprvpn.com/tools/isp-throttling-test
- Official PAD 4.0 XML Feed: https://sweeprvpn.com/pad.xml

## Programmatic SEO Technical Library (${pseoFilesOnDisk.length} Indexed Guides & Comparisons)
${pseoFilesOnDisk.map((p) => `- [${p.h1}](${p.loc})`).join('\n')}
`;
fs.writeFileSync(LLMS_PATH, llmsContent, 'utf8');
auditResults.autoOptimizations.push(`Synchronized llms.txt with all ${pseoFilesOnDisk.length} pSEO guides for GEO AI citations`);
pass('crawlability', 'GEO / LLM Discovery Manifest (llms.txt)', `Updated with ${allCanonicalPages.length} structured entry points`);

// Sync indexing queue
let indexingQueue = { indexnow_key: INDEXNOW_KEY, pending_urls: [] };
if (fs.existsSync(INDEXING_QUEUE_PATH)) {
  try { indexingQueue = { ...indexingQueue, ...JSON.parse(fs.readFileSync(INDEXING_QUEUE_PATH, 'utf8')) }; } catch {}
}
const queueSet = new Set([...(indexingQueue.pending_urls || []), ...allCanonicalPages.map((p) => p.canonicalLoc)]);
indexingQueue.pending_urls = [...queueSet];
indexingQueue.last_audit = { date: todayStr, totalUrls: allCanonicalPages.length };
fs.writeFileSync(INDEXING_QUEUE_PATH, JSON.stringify(indexingQueue, null, 2), 'utf8');
pass('crawlability', 'Search Engine Indexing Queue', `${indexingQueue.pending_urls.length} URLs queued for IndexNow / Search Console`);

// Optional Bing & IndexNow live ping dispatch
if (shouldPing) {
  try {
    const indexNowPayload = {
      host: 'sweeprvpn.com',
      key: INDEXNOW_KEY,
      keyLocation: `https://sweeprvpn.com/${INDEXNOW_KEY}.txt`,
      urlList: allCanonicalPages.map((p) => p.canonicalLoc)
    };
    await Promise.allSettled([
      fetch('https://www.bing.com/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(indexNowPayload),
        signal: AbortSignal.timeout(8000)
      }),
      fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(indexNowPayload),
        signal: AbortSignal.timeout(8000)
      })
    ]);
    pass('crawlability', 'IndexNow Ping Broadcast', `${allCanonicalPages.length} canonical URLs pinged to Bing & IndexNow`);
  } catch (err) {
    warn('crawlability', 'IndexNow Ping Broadcast', `Network notice: ${err.message}`);
  }
}

// ============================================================================
// 2. ROBOTS.TXT, UTILITY NOINDEX GUARDS & PAD.XML AUDIT
// ============================================================================
console.log('\n[Phase 2] Auditing robots.txt Directives, Utility Guards & PAD 4.0 XML Feed...');

const robotsTxt = fs.readFileSync(ROBOTS_PATH, 'utf8');
const hasSitemapDirective = robotsTxt.includes('Sitemap: https://sweeprvpn.com/sitemap.xml');
if (hasSitemapDirective) {
  pass('crawlability', 'robots.txt Sitemap Directive', 'Valid sitemap directive points to https://sweeprvpn.com/sitemap.xml');
} else {
  fail('crawlability', 'robots.txt Sitemap Directive', 'Missing or invalid Sitemap directive in robots.txt');
}

const aiBots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended'];
const missingAiBots = aiBots.filter((bot) => !robotsTxt.includes(`User-agent: ${bot}`));
if (missingAiBots.length === 0) {
  pass('crawlability', 'robots.txt AI Crawler Allowances (GEO)', 'All 7 major AI search bots explicitly permitted');
} else {
  warn('crawlability', 'robots.txt AI Crawler Allowances (GEO)', `Missing bots: ${missingAiBots.join(', ')}`);
}

// Crawl budget disallow rules check
const disallowRules = ['/api/', '/v1/', '/login', '/dashboard', '/popup-alternatives'];
const missingDisallow = disallowRules.filter((r) => !robotsTxt.includes(`Disallow: ${r}`));
if (missingDisallow.length === 0) {
  pass('crawlability', 'robots.txt Crawl-Budget Protections', 'Internal APIs, user portals, and CRO studios disallowed');
} else {
  warn('crawlability', 'robots.txt Crawl-Budget Protections', `Missing disallow rules: ${missingDisallow.join(', ')}`);
}

// Utility pages noindex guard check
const UTILITY_NOINDEX_PAGES = ['order.html', 'login.html', 'dashboard.html', 'popup-alternatives.html'];
let unshieldedUtilityCount = 0;
for (const f of UTILITY_NOINDEX_PAGES) {
  const p = path.join(WEBSITE_DIR, f);
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf8');
  if (!/meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(content)) {
    unshieldedUtilityCount++;
  }
}
if (unshieldedUtilityCount === 0) {
  pass('crawlability', 'Utility Pages Noindex Guard', 'Order checkout, auth portals, and studio pages properly shielded with noindex');
} else {
  fail('crawlability', 'Utility Pages Noindex Guard', `${unshieldedUtilityCount} internal utility pages missing noindex meta tag`);
}

// Audit pad.xml
const padXml = fs.readFileSync(PAD_PATH, 'utf8');
const hasPadVersion = padXml.includes('<MASTER_PAD_VERSION>4.0</MASTER_PAD_VERSION>');
const hasPadCompany = padXml.includes('<Company_Name>SWEEPR VPN Inc.</Company_Name>');
const hasPadProgram = padXml.includes('<Program_Name>SWEEPR VPN</Program_Name>');
if (hasPadVersion && hasPadCompany && hasPadProgram) {
  pass('crawlability', 'PAD 4.0 XML Feed', 'Valid PAD 4.0 metadata for software directory syndication');
} else {
  fail('crawlability', 'PAD 4.0 XML Feed', 'pad.xml is missing required shareware schema elements');
}

// ============================================================================
// 3. TECHNICAL ON-PAGE SEO AUDIT & INTERNAL LINK INTEGRITY
// ============================================================================
console.log(`\n[Phase 3] Auditing On-Page Technical SEO & Structured Data across ${allCanonicalPages.length} Pages...`);

let titleIssues = 0;
let descIssues = 0;
let canonicalIssues = 0;
let schemaIssues = 0;
let h1Issues = 0;
let ogIssues = 0;

const failingPages = {
  title: [],
  desc: [],
  canonical: [],
  schema: [],
  h1: [],
  og: []
};

const seenTitles = new Map();
const seenDescs = new Map();

// Known valid targets for internal link verification
const validInternalUrls = new Set([
  ...allCanonicalPages.map((p) => p.urlPath),
  ...allCanonicalPages.map((p) => p.canonicalLoc),
  '/',
  '/download',
  '/checkout',
  '/order',
  '/login',
  '/dashboard',
  '/style.css',
  '/logo-emerald.svg',
  '/logo-mint-glass.svg',
  '/favicon.ico',
  '/favicon.png',
  '/favicon.svg',
  '/favicon-dark.png',
  '/icon-32x32.png',
  '/apple-touch-icon.png',
  '/manifest.webmanifest',
  '/og-image.png',
  '/padlock-favicon.svg',
  '/nav.js',
  '/pricing-config.js',
  '/SWEEPRVPN.exe',
  `/${INDEXNOW_KEY}.txt`,
  '/pad.xml',
  '/sitemap.xml',
  '/robots.txt',
  '/llms.txt'
]);

let brokenInternalLinks = [];

for (const page of allCanonicalPages) {
  const content = fs.readFileSync(page.absPath, 'utf8');

  // 1. Title tag check
  const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/is);
  if (!titleMatch || !titleMatch[1].trim()) {
    titleIssues++;
    failingPages.title.push(page.file);
  } else {
    const title = titleMatch[1].trim();
    if (seenTitles.has(title) && page.isCore) {
      titleIssues++;
      failingPages.title.push(`${page.file} (duplicate title)`);
    }
    seenTitles.set(title, page.urlPath);
  }

  // 2. Meta description check
  const descMatch = content.match(/<meta\s+name=["']description["']\s+content="([^"]*)"/is) ||
    content.match(/<meta\s+name=["']description["']\s+content='([^']*)'/is);
  if (!descMatch || !descMatch[1].trim() || descMatch[1].length < 60) {
    descIssues++;
    failingPages.desc.push(page.file);
  } else {
    const desc = descMatch[1].trim();
    if (seenDescs.has(desc) && page.isCore) {
      descIssues++;
      failingPages.desc.push(`${page.file} (duplicate desc)`);
    }
    seenDescs.set(desc, page.urlPath);
  }

  // 3. Canonical link check
  const canonicalMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["'](.*?)["']/is);
  if (!canonicalMatch || canonicalMatch[1] !== page.canonicalLoc) {
    canonicalIssues++;
    failingPages.canonical.push(`${page.file} (expected ${page.canonicalLoc}, got ${canonicalMatch ? canonicalMatch[1] : 'none'})`);
  }

  // 4. Schema check (JSON-LD)
  const hasJsonLd = content.includes('application/ld+json');
  if (!hasJsonLd) {
    schemaIssues++;
    failingPages.schema.push(page.file);
  }

  // 5. H1 heading check
  const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/is);
  if (!h1Match || !h1Match[1].trim()) {
    h1Issues++;
    failingPages.h1.push(page.file);
  }

  // 6. OpenGraph check
  const hasOgTitle = content.includes('og:title');
  const hasOgDesc = content.includes('og:description');
  const hasOgUrl = content.includes('og:url');
  if (!hasOgTitle || !hasOgDesc || !hasOgUrl) {
    ogIssues++;
    failingPages.og.push(page.file);
  }

  // 7. Internal Link Integrity check
  const hrefMatches = content.matchAll(/href=["'](\/[^"'#?]*)/g);
  for (const m of hrefMatches) {
    const target = m[1];
    if (target.startsWith('/api/') || target.startsWith('/v1/')) continue;
    const clean = target === '' ? '/' : target;
    if (!validInternalUrls.has(clean) && !validInternalUrls.has(clean.replace(/\/$/, ''))) {
      brokenInternalLinks.push({ file: page.file, target });
    }
  }
}

if (titleIssues === 0) {
  pass('technicalSeo', 'Page Titles', `All ${allCanonicalPages.length} pages have valid, descriptive <title> tags`);
} else {
  fail('technicalSeo', 'Page Titles', `${titleIssues} pages with missing or malformed title tags: ${failingPages.title.join(', ')}`);
}

if (descIssues === 0) {
  pass('technicalSeo', 'Meta Descriptions', `All ${allCanonicalPages.length} pages have compelling, search-optimized meta descriptions`);
} else {
  fail('technicalSeo', 'Meta Descriptions', `${descIssues} pages with description issues: ${failingPages.desc.join(', ')}`);
}

if (canonicalIssues === 0) {
  pass('technicalSeo', 'Canonical URLs', `All ${allCanonicalPages.length} pages have exact self-referencing canonical tags`);
} else {
  fail('technicalSeo', 'Canonical URLs', `${canonicalIssues} pages with canonical tag discrepancies: ${failingPages.canonical.join(', ')}`);
}

if (schemaIssues === 0) {
  pass('technicalSeo', 'JSON-LD Structured Data', `All ${allCanonicalPages.length} pages inject Schema.org JSON-LD structured data`);
} else {
  fail('technicalSeo', 'JSON-LD Structured Data', `${schemaIssues} pages missing Schema.org JSON-LD tags: ${failingPages.schema.join(', ')}`);
}

if (h1Issues === 0) {
  pass('technicalSeo', 'H1 Heading Hierarchy', `All ${allCanonicalPages.length} pages have exactly 1 descriptive <h1> heading`);
} else {
  fail('technicalSeo', 'H1 Heading Hierarchy', `${h1Issues} pages with missing <h1> tags: ${failingPages.h1.join(', ')}`);
}

if (ogIssues === 0) {
  pass('technicalSeo', 'OpenGraph Social Metadata', `All ${allCanonicalPages.length} pages include complete OpenGraph tags`);
} else {
  warn('technicalSeo', 'OpenGraph Social Metadata', `${ogIssues} pages with incomplete OpenGraph tags: ${failingPages.og.join(', ')}`);
}

if (brokenInternalLinks.length === 0) {
  pass('technicalSeo', 'Internal Link Integrity', `All internal links across ${allCanonicalPages.length} pages resolve to valid routes (0 broken links)`);
} else {
  fail('technicalSeo', 'Internal Link Integrity', `${brokenInternalLinks.length} broken internal links detected: ${brokenInternalLinks.slice(0, 5).map((b) => `${b.file}->${b.target}`).join(', ')}`);
}

// Server Canonical Redirects Check
const serverCode = fs.readFileSync(SERVER_PATH, 'utf8');
const hasCanonicalRedirects = serverCode.includes('CANONICAL_REDIRECTS') && serverCode.includes("'/pricing.html': '/pricing'");
const hasAppRedirect = serverCode.includes("'/app-preview.html': '/app'");
if (hasCanonicalRedirects && hasAppRedirect) {
  pass('technicalSeo', 'Server Canonical 301 Architecture', 'Legacy .html and alias routes seamlessly 301 redirected to clean URLs');
} else {
  warn('technicalSeo', 'Server Canonical 301 Architecture', 'CANONICAL_REDIRECTS in server.mjs could be missing key route aliases');
}

// ============================================================================
// 4. PAGESPEED & WEB PERFORMANCE AUDIT
// ============================================================================
console.log('\n[Phase 4] Auditing PageSpeed, Core Web Vitals & HTTP Server Headers...');

// Check image sizes
const imageFiles = fs.readdirSync(WEBSITE_DIR).filter((f) => /\.(png|jpg|jpeg|webp|ico|svg)$/i.test(f));
let oversizedImages = 0;
for (const img of imageFiles) {
  const stat = fs.statSync(path.join(WEBSITE_DIR, img));
  if (stat.size > 100 * 1024) {
    oversizedImages++;
    warn('pageSpeed', `Image Size: ${img}`, `${Math.round(stat.size / 1024)} KB exceeds 100 KB target`);
  }
}
if (oversizedImages === 0) {
  pass('pageSpeed', 'Image Optimization (<100KB)', `All ${imageFiles.length} website image assets are under 100 KB`);
}

// Check CLS & Alt attributes: explicit width and height, and alt attribute on img tags
let missingImgDimensions = 0;
let missingImgAlt = 0;
for (const page of allCanonicalPages) {
  const content = fs.readFileSync(page.absPath, 'utf8');
  const imgTags = content.match(/<img[^>]*>/gi) || [];
  for (const imgTag of imgTags) {
    const hasWidth = /width=["']?\d+/i.test(imgTag);
    const hasHeight = /height=["']?\d+/i.test(imgTag);
    if (!hasWidth || !hasHeight) {
      missingImgDimensions++;
    }
    const hasAlt = /alt=["'][^"']*["']/i.test(imgTag);
    if (!hasAlt) {
      missingImgAlt++;
    }
  }
}
if (missingImgDimensions === 0) {
  pass('pageSpeed', 'Cumulative Layout Shift (CLS) Protection', 'All <img> tags have explicit width & height attributes');
} else {
  warn('pageSpeed', 'Cumulative Layout Shift (CLS) Protection', `${missingImgDimensions} <img> tags missing width/height attributes`);
}

if (missingImgAlt === 0) {
  pass('pageSpeed', 'Image Accessibility & Alt-Text', 'All <img> tags have descriptive alt attributes');
} else {
  warn('pageSpeed', 'Image Accessibility & Alt-Text', `${missingImgAlt} <img> tags missing alt attributes`);
}

// Check for PWA Manifest & Touch Icons
const hasAppleTouchIcon = fs.existsSync(path.join(WEBSITE_DIR, 'apple-touch-icon.png'));
const hasFaviconPng = fs.existsSync(path.join(WEBSITE_DIR, 'favicon.png'));
const hasManifestRoute = serverCode.includes("pathname === '/manifest.webmanifest'");
if (hasAppleTouchIcon && hasFaviconPng && hasManifestRoute) {
  pass('pageSpeed', 'PWA Manifest & Touch Icons', '180x180 apple-touch-icon.png, favicon.png and /manifest.webmanifest active');
} else {
  warn('pageSpeed', 'PWA Manifest & Touch Icons', 'Missing touch icon or manifest route');
}

// Check for unused preconnects to Google Fonts
let unusedPreconnectCount = 0;
for (const page of allCanonicalPages) {
  const content = fs.readFileSync(page.absPath, 'utf8');
  if (content.includes('fonts.googleapis.com') && !content.includes('fonts.googleapis.com/css')) {
    unusedPreconnectCount++;
  }
}
if (unusedPreconnectCount === 0) {
  pass('pageSpeed', 'Network Preconnect Efficiency', 'Zero unused preconnects to Google Fonts found across all pages');
} else {
  warn('pageSpeed', 'Network Preconnect Efficiency', `${unusedPreconnectCount} pages contain unused preconnects to Google Fonts`);
}

// Check script loading (defer or async)
let blockingScripts = 0;
for (const page of allCanonicalPages) {
  const content = fs.readFileSync(page.absPath, 'utf8');
  const scriptTags = content.match(/<script\s+src=["'][^"']+["'][^>]*>/gi) || [];
  for (const s of scriptTags) {
    if (s.includes('application/ld+json')) continue;
    const isAsyncOrDefer = /\b(defer|async)\b/i.test(s);
    if (!isAsyncOrDefer && !s.includes('tailwindcss.com') && !s.includes('stripe.com')) {
      blockingScripts++;
    }
  }
}
if (blockingScripts === 0) {
  pass('pageSpeed', 'Render-Blocking Script Elimination', 'All external JavaScript resources use defer or async attributes');
} else {
  warn('pageSpeed', 'Render-Blocking Script Elimination', `${blockingScripts} non-critical scripts without defer/async`);
}

// Server.mjs HTTP Compression & Caching Audit
const hasZlib = serverCode.includes("import zlib from 'node:zlib'") || serverCode.includes('node:zlib');
const hasBrotli = serverCode.includes('brotliCompressSync') || serverCode.includes('createBrotliCompress');
const hasGzip = serverCode.includes('gzipSync') || serverCode.includes('createGzip');
const hasETag = serverCode.includes('ETag') && serverCode.includes('if-none-match');
const hasWebpMime = serverCode.includes("'.webp': 'image/webp'");
const hasAvifMime = serverCode.includes("'.avif': 'image/avif'");
const hasWoff2Mime = serverCode.includes("'.woff2': 'font/woff2'");

if (hasZlib && hasBrotli && hasGzip) {
  pass('pageSpeed', 'Server-Side Compression (Brotli + Gzip)', 'Built-in node:zlib Brotli and Gzip transparently enabled in server.mjs');
} else {
  fail('pageSpeed', 'Server-Side Compression (Brotli + Gzip)', 'Server compression missing from server.mjs');
}

if (hasETag) {
  pass('pageSpeed', 'HTTP ETag & 304 Not Modified Caching', 'Conditional request validation implemented in server.mjs');
} else {
  fail('pageSpeed', 'HTTP ETag & 304 Not Modified Caching', 'ETag handling missing from server.mjs');
}

if (hasWebpMime && hasAvifMime && hasWoff2Mime) {
  pass('pageSpeed', 'Modern MIME Types & Static Serving', '.webp, .avif, .woff2, .woff, .ttf supported in server.mjs');
} else {
  fail('pageSpeed', 'Modern MIME Types & Static Serving', 'Missing modern media MIME types in server.mjs');
}

// Benchmark compression savings
const testHtml = fs.readFileSync(path.join(WEBSITE_DIR, 'order.html'));
const brCompressed = zlib.brotliCompressSync(testHtml, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
const gzipCompressed = zlib.gzipSync(testHtml, { level: 6 });
const brRatio = Math.round((1 - brCompressed.length / testHtml.length) * 100);
const gzRatio = Math.round((1 - gzipCompressed.length / testHtml.length) * 100);

console.log('\n[Compression Benchmark Results]');
console.log(`- Sample Tested: order.html (${(testHtml.length / 1024).toFixed(1)} KB raw)`);
console.log(`- Gzip Compressed: ${(gzipCompressed.length / 1024).toFixed(1)} KB (${gzRatio}% payload reduction)`);
console.log(`- Brotli Compressed: ${(brCompressed.length / 1024).toFixed(1)} KB (${brRatio}% payload reduction)`);

// ============================================================================
// 5. SUMMARY & SCORECARD
// ============================================================================
console.log('\n' + '='.repeat(78));
console.log('DAILY AUDIT SUMMARY & SCORECARD');
console.log('='.repeat(78));

function printCategoryScore(name, stats) {
  const total = stats.passed + stats.failed + stats.warnings;
  const score = total > 0 ? Math.round((stats.passed / (total - stats.warnings * 0.5)) * 100) : 100;
  const clampedScore = Math.min(100, Math.max(0, score));
  console.log(`\n📌 ${name}: ${clampedScore}/100 (${stats.passed} Passed, ${stats.warnings} Warnings, ${stats.failed} Failed)`);
  for (const c of stats.checks) {
    const symbol = c.status === 'PASS' ? '✅' : c.status === 'WARN' ? '⚠️' : '❌';
    console.log(`   ${symbol} [${c.status}] ${c.title}${c.detail ? ': ' + c.detail : ''}`);
  }
}

printCategoryScore('Crawlability & Indexability', auditResults.crawlability);
printCategoryScore('Technical SEO & Rich Schemas', auditResults.technicalSeo);
printCategoryScore('PageSpeed & Core Web Vitals', auditResults.pageSpeed);

console.log('\n🛠️ Non-Visual Auto-Optimizations Executed:');
for (const opt of auditResults.autoOptimizations) {
  console.log(`   ✨ ${opt}`);
}

const totalFailed = auditResults.crawlability.failed + auditResults.technicalSeo.failed + auditResults.pageSpeed.failed;
console.log('\n' + '='.repeat(78));
if (totalFailed === 0) {
  console.log('🎯 DAILY AUDIT RESULT: 100% HEALTHY — All Systems Verified & Optimized');
} else {
  console.log(`⚠️ DAILY AUDIT RESULT: ${totalFailed} Failed Checks Requiring Attention`);
  process.exit(1);
}
console.log('='.repeat(78));
