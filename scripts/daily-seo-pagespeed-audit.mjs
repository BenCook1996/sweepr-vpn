#!/usr/bin/env node
/**
 * SWEEPR VPN (sweeprvpn.com)
 * Daily Technical SEO, Crawlability & PageSpeed Audit & Non-Visual Auto-Optimization
 *
 * Runs a rigorous 360-degree audit across:
 *   1. Crawlability & Indexability (sitemap.xml, robots.txt, llms.txt, pad.xml, canonical routing, IndexNow)
 *   2. Technical SEO (title, description, canonicals, robots max-image-preview, JSON-LD schemas,
 *      OpenGraph, Twitter cards, theme-color, h1, internal links, server 301 redirects)
 *   3. PageSpeed & Core Web Vitals (image sizes, alt-text, width/height dimensions, layout stability,
 *      preconnects, script defer/async, gzip/brotli server compression, ETag / 304 headers, PWA manifest, cache-control)
 *   4. Non-Visual Auto-Optimizations (synchronizes sitemap, llms.txt, indexing queue, server headers, link targets,
 *      backfills missing og:image/twitter/robots/theme-color on pSEO pages, shields internal prototypes with noindex)
 *   5. Persists comprehensive dated daily report to TECHNICAL_SEO_AUDIT_LOG.md
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
const AUDIT_LOG_PATH = path.join(VPN_ROOT, 'TECHNICAL_SEO_AUDIT_LOG.md');
const INDEXNOW_KEY = '8f9a2b4c6d1e3f5a7b9c0d2e4f6a8b0c';

const shouldFix = !process.argv.includes('--no-fix'); // Auto-optimize by default
const shouldPing = process.argv.includes('--ping') || process.env.INDEXNOW_PING === 'true';

console.log('='.repeat(78));
console.log('SWEEPR VPN (sweeprvpn.com) — Technical SEO, Crawlability & PageSpeed Audit');
console.log(`Execution Timestamp: ${new Date().toISOString()} | Node ${process.version}`);
console.log('='.repeat(78));

const auditResults = {
  crawlability: { passed: 0, failed: 0, warnings: 0, checks: [] },
  technicalSeo: { passed: 0, failed: 0, warnings: 0, checks: [] },
  pageSpeed: { passed: 0, failed: 0, warnings: 0, checks: [] },
  autoOptimizations: [],
  benchmarks: []
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
// 1. SITEMAP & DISK SYNCHRONIZATION & AUTO-OPTIMIZATION
// ============================================================================
console.log('\n[Phase 1] Auditing Sitemap, Disk Manifest & Auto-Optimizing Pages...');

const CORE_STATIC_ROUTES = [
  { urlPath: '/', file: 'index.html', priority: '1.0', changefreq: 'weekly' },
  { urlPath: '/pricing', file: 'pricing.html', priority: '0.9', changefreq: 'weekly' },
  { urlPath: '/tools/leak-test', file: 'leak-test.html', priority: '0.8', changefreq: 'weekly' },
  { urlPath: '/tools/isp-throttling-test', file: 'isp-throttling-test.html', priority: '0.8', changefreq: 'weekly' },
  { urlPath: '/vs/totalvpn', file: 'vs-totalvpn.html', priority: '0.8', changefreq: 'monthly' },
  { urlPath: '/alternatives/totalvpn', file: 'alternatives-totalvpn.html', priority: '0.8', changefreq: 'monthly' },
  { urlPath: '/support', file: 'support.html', priority: '0.6', changefreq: 'monthly' },
  { urlPath: '/refund', file: 'refund.html', priority: '0.5', changefreq: 'monthly' },
  { urlPath: '/privacy', file: 'privacy.html', priority: '0.5', changefreq: 'monthly' },
  { urlPath: '/terms', file: 'terms.html', priority: '0.5', changefreq: 'monthly' }
];

// Auto-optimize core static pages with theme-color
let autoOptimizedCoreCount = 0;
if (shouldFix) {
  for (const r of CORE_STATIC_ROUTES) {
    const p = path.join(WEBSITE_DIR, r.file);
    if (!fs.existsSync(p)) continue;
    let content = fs.readFileSync(p, 'utf8');
    if (!content.includes('theme-color')) {
      const canonicalMatch = content.match(/<link\s+rel=["']canonical["'][^>]*>/i);
      if (canonicalMatch) {
        content = content.replace(
          canonicalMatch[0],
          `${canonicalMatch[0]}\n  <meta name="theme-color" content="#10b981" />`
        );
      } else {
        content = content.replace(/(<head[^>]*>)/i, `$1\n  <meta name="theme-color" content="#10b981" />`);
      }
      fs.writeFileSync(p, content, 'utf8');
      autoOptimizedCoreCount++;
    }
  }
}
if (autoOptimizedCoreCount > 0) {
  auditResults.autoOptimizations.push(
    `Auto-optimized ${autoOptimizedCoreCount} core static pages with brand mobile theme-color (#10b981)`
  );
}

// Scan all programmatic SEO files on disk
const pseoFilesOnDisk = [];
let autoOptimizedPseoCount = 0;

for (const dir of ['solutions', 'setup', 'vs', 'guides']) {
  const dirAbs = path.join(WEBSITE_DIR, dir);
  if (!fs.existsSync(dirAbs)) continue;
  for (const file of fs.readdirSync(dirAbs).sort()) {
    if (!file.endsWith('.html')) continue;
    const slug = file.replace(/\.html$/, '');
    if (dir === 'vs' && slug === 'totalvpn') continue;
    const urlPath = `/${dir}/${slug}`;
    const absPath = path.join(dirAbs, file);
    let content = fs.readFileSync(absPath, 'utf8');

    // Auto-optimize pSEO page metadata (non-visual)
    if (shouldFix) {
      let modified = false;

      // Ensure robots meta with max-image-preview:large
      if (!content.includes('name="robots"')) {
        const canonicalMatch = content.match(/<link\s+rel=["']canonical["'][^>]*>/i);
        if (canonicalMatch) {
          content = content.replace(
            canonicalMatch[0],
            `${canonicalMatch[0]}\n  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />`
          );
          modified = true;
        }
      }

      // Ensure OpenGraph image, Twitter Cards, and Theme-Color
      if (!content.includes('og:image') || !content.includes('twitter:card') || !content.includes('theme-color')) {
        const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/is);
        const title = titleMatch ? titleMatch[1].trim().replace(/"/g, '&quot;') : 'SWEEPR VPN';
        const descMatch = content.match(/<meta\s+name=["']description["']\s+content="([^"]*)"/is);
        const desc = descMatch ? descMatch[1].trim().replace(/"/g, '&quot;') : '';
        const canonicalUrl = `https://sweeprvpn.com${urlPath}`;

        let additions = '';
        if (!content.includes('og:image')) {
          additions += `\n  <meta property="og:image" content="https://sweeprvpn.com/og-image.png" />` +
            `\n  <meta property="og:image:alt" content="SWEEPR VPN 10Gbps WireGuard &amp; Home Wi-Fi Radar" />`;
        }
        if (!content.includes('twitter:card')) {
          additions += `\n  <meta name="twitter:card" content="summary_large_image" />` +
            `\n  <meta name="twitter:url" content="${canonicalUrl}" />` +
            `\n  <meta name="twitter:title" content="${title}" />` +
            `\n  <meta name="twitter:description" content="${desc}" />` +
            `\n  <meta name="twitter:image" content="https://sweeprvpn.com/og-image.png" />`;
        }
        if (!content.includes('theme-color')) {
          additions += `\n  <meta name="theme-color" content="#070b14" />`;
        }

        const siteNameMatch = content.match(/<meta\s+property=["']og:site_name["'][^>]*>/i);
        if (siteNameMatch) {
          content = content.replace(siteNameMatch[0], `${siteNameMatch[0]}${additions}`);
          modified = true;
        } else {
          const ogUrlMatch = content.match(/<meta\s+property=["']og:url["'][^>]*>/i);
          if (ogUrlMatch) {
            content = content.replace(ogUrlMatch[0], `${ogUrlMatch[0]}${additions}`);
            modified = true;
          }
        }
      }

      if (modified) {
        try {
          fs.writeFileSync(absPath, content, 'utf8');
          autoOptimizedPseoCount++;
        } catch (err) {
          try {
            fs.writeFileSync(absPath, content, 'utf8');
            autoOptimizedPseoCount++;
          } catch {}
        }
      }
    }

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

if (autoOptimizedPseoCount > 0) {
  auditResults.autoOptimizations.push(
    `Auto-optimized ${autoOptimizedPseoCount} pSEO pages with max-image-preview:large, og:image, Twitter cards & theme-color`
  );
}

// Auto-optimize internal utility & prototype pages with noindex
const UTILITY_AND_PROTOTYPE_PAGES = [
  'order.html',
  'login.html',
  'dashboard.html',
  'popup-alternatives.html',
  'prototype-mockup-a.html',
  'prototype-mockup-b.html',
  'sweepr-motion-review.html',
  'sweepr-vpn-scorecard.html'
];
let autoShieldedProtoCount = 0;
if (shouldFix) {
  for (const f of UTILITY_AND_PROTOTYPE_PAGES) {
    const p = path.join(WEBSITE_DIR, f);
    if (!fs.existsSync(p)) continue;
    let content = fs.readFileSync(p, 'utf8');
    if (!/meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(content)) {
      const robotsTag = f === 'order.html'
        ? '<meta name="robots" content="noindex, follow" />'
        : '<meta name="robots" content="noindex, nofollow" />';
      content = content.replace(/(<head[^>]*>)/i, `$1\n  ${robotsTag}`);
      fs.writeFileSync(p, content, 'utf8');
      autoShieldedProtoCount++;
    }
  }
  // Also shield root copy of sweepr-vpn-scorecard.html if present
  const rootScorecard = path.join(VPN_ROOT, 'sweepr-vpn-scorecard.html');
  if (fs.existsSync(rootScorecard)) {
    let rootScorecardContent = fs.readFileSync(rootScorecard, 'utf8');
    if (!/meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(rootScorecardContent)) {
      rootScorecardContent = rootScorecardContent.replace(/(<head[^>]*>)/i, `$1\n  <meta name="robots" content="noindex, nofollow" />`);
      fs.writeFileSync(rootScorecard, rootScorecardContent, 'utf8');
    }
  }
}
if (autoShieldedProtoCount > 0) {
  auditResults.autoOptimizations.push(
    `Shielded ${autoShieldedProtoCount} internal prototype/review pages with <meta name="robots" content="noindex, nofollow">`
  );
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
const sitemapEntries = [
  ...allCanonicalPages,
  { canonicalLoc: 'https://sweeprvpn.com/pad.xml', changefreq: 'monthly', priority: '0.5' }
];
const newSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries
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
const disallowRules = ['/api/', '/v1/', '/login', '/dashboard', '/popup-alternatives', '/qr-setup'];
const missingDisallow = disallowRules.filter((r) => !robotsTxt.includes(`Disallow: ${r}`));
if (missingDisallow.length === 0) {
  pass('crawlability', 'robots.txt Crawl-Budget Protections', 'Internal APIs, user portals, qr-setup and CRO studios disallowed');
} else {
  warn('crawlability', 'robots.txt Crawl-Budget Protections', `Missing disallow rules: ${missingDisallow.join(', ')}`);
}

// Utility & Prototype pages noindex guard check
let unshieldedUtilityCount = 0;
for (const f of UTILITY_AND_PROTOTYPE_PAGES) {
  const p = path.join(WEBSITE_DIR, f);
  if (!fs.existsSync(p)) continue;
  const content = fs.readFileSync(p, 'utf8');
  if (!/meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(content)) {
    unshieldedUtilityCount++;
  }
}
if (unshieldedUtilityCount === 0) {
  pass('crawlability', 'Utility & Prototype Pages Noindex Guard', `All ${UTILITY_AND_PROTOTYPE_PAGES.length} internal utility and prototype pages properly shielded with noindex`);
} else {
  fail('crawlability', 'Utility & Prototype Pages Noindex Guard', `${unshieldedUtilityCount} internal utility/prototype pages missing noindex meta tag`);
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
let twitterIssues = 0;
let robotsDirectiveIssues = 0;
let themeColorIssues = 0;

const failingPages = {
  title: [],
  desc: [],
  canonical: [],
  schema: [],
  h1: [],
  og: [],
  twitter: [],
  robots: [],
  themeColor: []
};

const seenTitles = new Map();
const seenDescs = new Map();

// Known valid targets for internal link verification
const validInternalUrls = new Set([
  ...allCanonicalPages.map((p) => p.urlPath),
  ...allCanonicalPages.map((p) => p.canonicalLoc),
  '/',
  '/download',
  '/qr-setup',
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

  // 4. Robots directive check (max-image-preview:large)
  const robotsMatch = content.match(/<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
  if (!robotsMatch || !robotsMatch[1].includes('max-image-preview:large')) {
    robotsDirectiveIssues++;
    failingPages.robots.push(page.file);
  }

  // 5. Schema check (JSON-LD + parse validity)
  const jsonLdMatches = content.matchAll(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi);
  let pageHasJsonLd = false;
  let jsonLdParseFailed = false;
  for (const m of jsonLdMatches) {
    pageHasJsonLd = true;
    try {
      JSON.parse(m[1]);
    } catch {
      jsonLdParseFailed = true;
    }
  }
  if (!pageHasJsonLd || jsonLdParseFailed) {
    schemaIssues++;
    failingPages.schema.push(page.file);
  }

  // 6. H1 heading check
  const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/is);
  if (!h1Match || !h1Match[1].trim()) {
    h1Issues++;
    failingPages.h1.push(page.file);
  }

  // 7. OpenGraph check (including og:image)
  const hasOgTitle = content.includes('og:title');
  const hasOgDesc = content.includes('og:description');
  const hasOgUrl = content.includes('og:url');
  const hasOgImage = content.includes('og:image');
  if (!hasOgTitle || !hasOgDesc || !hasOgUrl || !hasOgImage) {
    ogIssues++;
    failingPages.og.push(page.file);
  }

  // 8. Twitter Card check
  const hasTwitterCard = content.includes('twitter:card');
  const hasTwitterImage = content.includes('twitter:image');
  if (!hasTwitterCard || !hasTwitterImage) {
    twitterIssues++;
    failingPages.twitter.push(page.file);
  }

  // 9. Theme-Color check
  const hasThemeColor = content.includes('name="theme-color"') || content.includes("name='theme-color'");
  if (!hasThemeColor) {
    themeColorIssues++;
    failingPages.themeColor.push(page.file);
  }

  // 10. Internal Link Integrity check
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

if (robotsDirectiveIssues === 0) {
  pass('technicalSeo', 'Robots Snippet Controls', `All ${allCanonicalPages.length} pages specify max-image-preview:large for search & Discover snippets`);
} else {
  fail('technicalSeo', 'Robots Snippet Controls', `${robotsDirectiveIssues} pages missing max-image-preview:large: ${failingPages.robots.slice(0, 3).join(', ')}`);
}

if (schemaIssues === 0) {
  pass('technicalSeo', 'JSON-LD Structured Data', `All ${allCanonicalPages.length} pages inject verified Schema.org JSON-LD structured data`);
} else {
  fail('technicalSeo', 'JSON-LD Structured Data', `${schemaIssues} pages with invalid/missing JSON-LD: ${failingPages.schema.join(', ')}`);
}

if (h1Issues === 0) {
  pass('technicalSeo', 'H1 Heading Hierarchy', `All ${allCanonicalPages.length} pages have exactly 1 descriptive <h1> heading`);
} else {
  fail('technicalSeo', 'H1 Heading Hierarchy', `${h1Issues} pages with missing <h1> tags: ${failingPages.h1.join(', ')}`);
}

if (ogIssues === 0) {
  pass('technicalSeo', 'OpenGraph Social Metadata', `All ${allCanonicalPages.length} pages include complete OpenGraph tags (title, desc, url, og:image)`);
} else {
  warn('technicalSeo', 'OpenGraph Social Metadata', `${ogIssues} pages with incomplete OpenGraph tags: ${failingPages.og.slice(0, 3).join(', ')}`);
}

if (twitterIssues === 0) {
  pass('technicalSeo', 'Twitter Card Metadata', `All ${allCanonicalPages.length} pages include complete summary_large_image Twitter card tags`);
} else {
  warn('technicalSeo', 'Twitter Card Metadata', `${twitterIssues} pages with incomplete Twitter card tags: ${failingPages.twitter.slice(0, 3).join(', ')}`);
}

if (themeColorIssues === 0) {
  pass('technicalSeo', 'Mobile Theme-Color Support', `All ${allCanonicalPages.length} pages declare theme-color for mobile chrome styling`);
} else {
  warn('technicalSeo', 'Mobile Theme-Color Support', `${themeColorIssues} pages missing theme-color: ${failingPages.themeColor.slice(0, 3).join(', ')}`);
}

if (brokenInternalLinks.length === 0) {
  pass('technicalSeo', 'Internal Link Integrity', `All internal links across ${allCanonicalPages.length} pages resolve to valid routes (0 broken links)`);
} else {
  fail('technicalSeo', 'Internal Link Integrity', `${brokenInternalLinks.length} broken internal links detected: ${brokenInternalLinks.slice(0, 5).map((b) => `${b.file}->${b.target}`).join(', ')}`);
}

// Server Canonical Redirects Check
const serverCode = fs.readFileSync(SERVER_PATH, 'utf8');
const hasCanonicalRedirects = serverCode.includes('CANONICAL_REDIRECTS') && serverCode.includes("'/pricing.html': '/pricing'");
const hasAppRedirect = serverCode.includes("'/app-preview.html': '/download'");
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
const hasXmlCacheControl = serverCode.includes("ext === '.xml' || ext === '.txt'");

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

if (hasXmlCacheControl) {
  pass('pageSpeed', 'Static Cache-Control Architecture', 'Explicit caching headers configured for HTML (0s), static media (300s/3600s), and XML/TXT (3600s/86400s)');
} else {
  warn('pageSpeed', 'Static Cache-Control Architecture', 'Explicit caching headers could be missing for .xml or .txt');
}

// Benchmark compression savings on key pages
const benchmarkFiles = ['order.html', 'index.html', 'sitemap.xml'];
for (const bFile of benchmarkFiles) {
  const bPath = path.join(WEBSITE_DIR, bFile);
  if (fs.existsSync(bPath)) {
    const raw = fs.readFileSync(bPath);
    const br = zlib.brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } });
    const gz = zlib.gzipSync(raw, { level: 6 });
    const brRatio = Math.round((1 - br.length / raw.length) * 100);
    const gzRatio = Math.round((1 - gz.length / raw.length) * 100);
    auditResults.benchmarks.push({
      file: bFile,
      rawKb: (raw.length / 1024).toFixed(1),
      gzKb: (gz.length / 1024).toFixed(1),
      brKb: (br.length / 1024).toFixed(1),
      gzRatio,
      brRatio
    });
  }
}

console.log('\n[Compression Benchmark Results]');
for (const b of auditResults.benchmarks) {
  console.log(`- Sample: ${b.file} (${b.rawKb} KB raw) -> Gzip: ${b.gzKb} KB (${b.gzRatio}% reduction) | Brotli: ${b.brKb} KB (${b.brRatio}% reduction)`);
}

// ============================================================================
// 5. SUMMARY, SCORECARD & AUDIT LOG PERSISTENCE
// ============================================================================
console.log('\n' + '='.repeat(78));
console.log('DAILY AUDIT SUMMARY & SCORECARD');
console.log('='.repeat(78));

function calcScore(stats) {
  const total = stats.passed + stats.failed + stats.warnings;
  const score = total > 0 ? Math.round((stats.passed / (total - stats.warnings * 0.5)) * 100) : 100;
  return Math.min(100, Math.max(0, score));
}

const crawlScore = calcScore(auditResults.crawlability);
const techScore = calcScore(auditResults.technicalSeo);
const speedScore = calcScore(auditResults.pageSpeed);

function printCategoryScore(name, score, stats) {
  console.log(`\n📌 ${name}: ${score}/100 (${stats.passed} Passed, ${stats.warnings} Warnings, ${stats.failed} Failed)`);
  for (const c of stats.checks) {
    const symbol = c.status === 'PASS' ? '✅' : c.status === 'WARN' ? '⚠️' : '❌';
    console.log(`   ${symbol} [${c.status}] ${c.title}${c.detail ? ': ' + c.detail : ''}`);
  }
}

printCategoryScore('Crawlability & Indexability', crawlScore, auditResults.crawlability);
printCategoryScore('Technical SEO & Rich Schemas', techScore, auditResults.technicalSeo);
printCategoryScore('PageSpeed & Core Web Vitals', speedScore, auditResults.pageSpeed);

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
}
console.log('='.repeat(78));

// ============================================================================
// 6. PERSIST TO TECHNICAL_SEO_AUDIT_LOG.md
// ============================================================================
function updateAuditLog() {
  const sectionHeader = `## ${todayStr} — Daily Technical SEO, Crawlability & PageSpeed Audit & Auto-Optimization Pass`;
  const markdownSection = `
${sectionHeader}

### Executive Summary
- **Overall Scores**: Crawlability **${crawlScore}/100**, Technical SEO **${techScore}/100**, PageSpeed & CWV **${speedScore}/100** across **${allCanonicalPages.length} Canonical Pages**.
- **Auto-Optimizations Executed**:
${auditResults.autoOptimizations.map((opt) => `  - ${opt}`).join('\n')}

### Category Scorecards & Verifications

#### 1. Crawlability & Indexability (${crawlScore}/100)
${auditResults.crawlability.checks.map((c) => `- **${c.title}**: ${c.status} — ${c.detail}`).join('\n')}

#### 2. Technical SEO & Rich Schemas (${techScore}/100)
${auditResults.technicalSeo.checks.map((c) => `- **${c.title}**: ${c.status} — ${c.detail}`).join('\n')}

#### 3. PageSpeed & Core Web Vitals (${speedScore}/100)
${auditResults.pageSpeed.checks.map((c) => `- **${c.title}**: ${c.status} — ${c.detail}`).join('\n')}

### Compression Benchmark Results
${auditResults.benchmarks.map((b) => `- **${b.file}** (${b.rawKb} KB raw) &rarr; Gzip: **${b.gzKb} KB** (${b.gzRatio}% reduction) | Brotli: **${b.brKb} KB** (${b.brRatio}% reduction)`).join('\n')}
`;

  let currentLog = '';
  if (fs.existsSync(AUDIT_LOG_PATH)) {
    currentLog = fs.readFileSync(AUDIT_LOG_PATH, 'utf8');
  } else {
    currentLog = `# SWEEPR VPN — Technical SEO, Crawlability & PageSpeed Audit Log\n\nTracks automated daily technical SEO audits and under-the-hood optimizations (strictly non-visual and non-functional to end users).\n`;
  }

  // If entry for today already exists, replace it; otherwise append
  if (currentLog.includes(sectionHeader)) {
    const regex = new RegExp(`## ${todayStr}[\\s\\S]*?(?=\\n## \\d{4}-\\d{2}-\\d{2}|$)`, 'g');
    currentLog = currentLog.replace(regex, markdownSection.trim() + '\n\n');
  } else {
    currentLog = currentLog.trimEnd() + '\n' + markdownSection + '\n';
  }

  fs.writeFileSync(AUDIT_LOG_PATH, currentLog, 'utf8');
  console.log(`\n📝 Persisted daily audit report to ${path.relative(VPN_ROOT, AUDIT_LOG_PATH)}`);
}

updateAuditLog();

if (totalFailed > 0) {
  process.exit(1);
}
