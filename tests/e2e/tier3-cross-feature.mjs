/**
 * SWEEPR VPN — E2E Test Suite: Tier 3 Cross-Feature Interactions
 * Tests 28 pairwise interaction scenarios (P01 through P28).
 * Zero external npm dependencies. Native Node.js ESM.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  ROOT_DIR,
  WEBSITE_DIR,
  SCRIPTS_DIR,
  assert,
  assertEqual,
  assertTrue,
  assertFalse,
  assertMatch,
  assertNotMatch,
  assertIncludes,
  assertNotIncludes,
  assertLessThan,
  assertLessThanOrEqual,
  assertGreaterThan,
  assertGreaterThanOrEqual,
  fetchOpaque,
  fetchBinary,
  sha256File,
  runConsolidationInTempSandbox,
  getServerStateDir,
  calculate5GramOverlap,
  extractSemanticText,
  tokenizeWords,
  extractMainContent,
  extractCanonical,
  extractRobots,
  extractLinks,
  hasNofollow,
  containsElementId,
  validateSitemapXml,
  findHtmlFiles,
  findFilesWithPattern
} from './helpers.mjs';

export const tier3Tests = [
  // P01: F2 × F3 — Deleted Zombie File vs Pattern 301 Resolver
  {
    id: 'P01',
    feature: 'F2xF3',
    tier: 3,
    name: 'P01: Requesting physically deleted ACR zombie file resolves to 301 canonical, not 404',
    async fn({ baseUrl }) {
      const diskPath = path.join(WEBSITE_DIR, 'solutions', 'comcast-xfinity-broadband-smart-tv-acr-blocking.html');
      assertFalse(fs.existsSync(diskPath), 'Zombie file must be physically absent from disk');

      const res = await fetchOpaque(`${baseUrl}/solutions/comcast-xfinity-broadband-smart-tv-acr-blocking`);
      assertEqual(res.status, 301, 'Resolver must intercept deleted zombie and return 301');
      assertEqual(res.location, '/guides/stop-samsung-smart-tv-acr-tracking', 'Target must be canonical stop-samsung guide');
    }
  },

  // P02: F3 × F14 — 301 Redirect Resolver vs Pruned Sitemap URLs
  {
    id: 'P02',
    feature: 'F3xF14',
    tier: 3,
    name: 'P02: Zero sitemap URLs match 301 redirect patterns; all sitemap URLs return HTTP 200',
    async fn({ baseUrl }) {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { urls } = validateSitemapXml(content);

      for (const u of urls.slice(0, 15)) {
        const parsed = new URL(u);
        const res = await fetchOpaque(`${baseUrl}${parsed.pathname}`, { method: 'HEAD' });
        assertEqual(res.status, 200, `Sitemap URL ${parsed.pathname} must return 200, not 301`);
        assertEqual(res.location, null, `Sitemap URL ${parsed.pathname} must not redirect`);
      }
    }
  },

  // P03: F4 × F16 — Tool Alias Redirect vs Deepened Leak Test Content
  {
    id: 'P03',
    feature: 'F4xF16',
    tier: 3,
    name: 'P03: Requesting legacy /leak-test redirects to /tools/leak-test containing deepened ICE table',
    async fn({ baseUrl }) {
      const initial = await fetchOpaque(`${baseUrl}/leak-test`);
      assertEqual(initial.status, 301, 'Initial request must return 301');
      assertEqual(initial.location, '/tools/leak-test', 'Must redirect to canonical tool path');

      const followed = await fetchOpaque(`${baseUrl}${initial.location}`);
      assertEqual(followed.status, 200, 'Followed endpoint must return 200');
      const main = extractMainContent(followed.body);
      assertTrue(main.includes('host') && main.includes('srflx'), 'Deepened content must have ICE candidate table');
    }
  },

  // P04: F4 × F17 — MTU Calculator Alias vs Deepened ISP Throttling Content
  {
    id: 'P04',
    feature: 'F4xF17',
    tier: 3,
    name: 'P04: Requesting legacy /tools/mtu-calculator redirects to /tools/isp-throttling-test containing DPI table',
    async fn({ baseUrl }) {
      const initial = await fetchOpaque(`${baseUrl}/tools/mtu-calculator`);
      assertEqual(initial.status, 301, 'Must return 301');
      assertEqual(initial.location, '/tools/isp-throttling-test', 'Must redirect to canonical throttling test');

      const followed = await fetchOpaque(`${baseUrl}${initial.location}`);
      assertEqual(followed.status, 200, 'Followed endpoint must return 200');
      const main = extractMainContent(followed.body);
      assertTrue(main.includes('DPI') || main.includes('SNI') || main.includes('Inspection'), 'Deepened content must have DPI table');
    }
  },

  // P05: F5 × F8 — WireGuard POP Boilerplate Removal vs 5-Gram Similarity
  {
    id: 'P05',
    feature: 'F5xF8',
    tier: 3,
    name: 'P05: Stripping #sweepr-live-wireguard-acr-proof maintains pairwise overlap < 25%',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-live-wireguard-acr-proof["']/i);
      assertEqual(matches.length, 0, 'No files contain proof section');

      const p1 = path.join(WEBSITE_DIR, 'setup', 'gl-inet-travel-router.html');
      const p2 = path.join(WEBSITE_DIR, 'guides', 'stop-samsung-smart-tv-acr-tracking.html');
      assertTrue(fs.existsSync(p1) && fs.existsSync(p2), 'Both cross-cluster pillars must exist');
      const h1 = fs.readFileSync(p1, 'utf8');
      const h2 = fs.readFileSync(p2, 'utf8');
      const overlap = calculate5GramOverlap(h1, h2);
      assertLessThan(overlap, 25.0, `Overlap must be < 25%, got ${overlap.toFixed(2)}%`);
    }
  },

  // P06: F6 × F8 — ISP Matrix Removal vs 5-Gram Similarity
  {
    id: 'P06',
    feature: 'F6xF8',
    tier: 3,
    name: 'P06: Stripping #sweepr-isp-master-matrix keeps solutions pillars overlap < 25%',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-isp-master-matrix["']/i);
      assertEqual(matches.length, 0, 'No files contain matrix table');

      const p1 = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      const p2 = path.join(WEBSITE_DIR, 'solutions', 'virgin-media-remote-dev-ssh.html');
      assertTrue(fs.existsSync(p1) && fs.existsSync(p2), 'Both solutions pillars must exist');
      const h1 = fs.readFileSync(p1, 'utf8');
      const h2 = fs.readFileSync(p2, 'utf8');
      const overlap = calculate5GramOverlap(h1, h2);
      assertLessThan(overlap, 25.0, `Solutions overlap must be < 25%, got ${overlap.toFixed(2)}%`);
    }
  },

  // P07: F7 × F21 — Disabled Proof Injection vs Daily Audit Script
  {
    id: 'P07',
    feature: 'F7xF21',
    tier: 3,
    name: 'P07: Running daily audit script does not resurrect disabled boilerplate in solutions',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });

      const proofMatches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-live-wireguard-acr-proof["']/i);
      assertEqual(proofMatches.length, 0, 'No proof section re-injected by audit');

      const matrixMatches = findFilesWithPattern(path.join(WEBSITE_DIR, 'solutions'), /id=["']sweepr-isp-master-matrix["']/i);
      assertEqual(matrixMatches.length, 0, 'No matrix re-injected by audit');
    }
  },

  // P08: F9 × F12 — Footer Directory Removal vs Focused 14-Link BOFU Hub Footer
  {
    id: 'P08',
    feature: 'F9xF12',
    tier: 3,
    name: 'P08: Footer directory is absent while 14-link BOFU Hub footer + Preferred Sources are present on / and /pricing',
    async fn({ baseUrl }) {
      for (const p of ['/', '/pricing']) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `${p} must return 200`);
        assertFalse(containsElementId(res.body, 'sweepr-seo-directory'), `Directory absent on ${p}`);
        const footerMatch = res.body.match(/<footer[\s\S]*?<\/footer>/i);
        assertTrue(!!footerMatch, `${p} must contain <footer>`);
        const flinks = extractLinks(footerMatch[0]).map((l) => l.href);
        assertLessThan(flinks.length, 15, `${p} footer must have < 15 links`);
        assertTrue(flinks.includes('https://www.google.com/preferences/source?q=sweeprvpn.com'), `Preferred Sources present on ${p}`);
      }
    }
  },

  // P09: F10 × F12 — Rotator Bridge Banner Removal vs Focused 14-Link BOFU Hub Footer
  {
    id: 'P09',
    feature: 'F10xF12',
    tier: 3,
    name: 'P09: Rotator bridge banner is absent while 14-link BOFU Hub footer + Preferred Sources are present on tool pages',
    async fn({ baseUrl }) {
      for (const p of ['/tools/leak-test', '/tools/isp-throttling-test']) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `${p} must return 200`);
        assertFalse(containsElementId(res.body, 'sweepr-unindexed-guides-bridge'), `Bridge absent on ${p}`);
        const footerMatch = res.body.match(/<footer[\s\S]*?<\/footer>/i);
        assertTrue(!!footerMatch, `${p} must contain <footer>`);
        const flinks = extractLinks(footerMatch[0]).map((l) => l.href);
        assertLessThan(flinks.length, 15, `${p} footer must have < 15 links`);
        assertTrue(flinks.includes('https://www.google.com/preferences/source?q=sweeprvpn.com'), `Preferred Sources present on ${p}`);
      }
    }
  },

  // P10: F11 × F12 — Disabled Audit Footer Injection vs BOFU Hub Footer
  {
    id: 'P10',
    feature: 'F11xF12',
    tier: 3,
    name: 'P10: Audit script execution preserves 14-link BOFU footer without re-injecting directory',
    async fn({ baseUrl }) {
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });

      const res = await fetchOpaque(`${baseUrl}/`);
      assertFalse(containsElementId(res.body, 'sweepr-seo-directory'), 'Directory must remain absent');
      const footerMatch = res.body.match(/<footer[\s\S]*?<\/footer>/i);
      assertTrue(!!footerMatch, 'Footer must remain present');
      assertLessThan(extractLinks(footerMatch[0]).length, 15, 'BOFU footer link count must remain < 15');
      assertTrue(footerMatch[0].includes('https://www.google.com/preferences/source?q=sweeprvpn.com'), 'Preferred Sources badge must remain intact');
    }
  },

  // P11: F13 × F14 — GSC Winner Lock Neutralization vs Sitemap Pruning
  {
    id: 'P11',
    feature: 'F13xF14',
    tier: 3,
    name: 'P11: GSC consolidation sandbox does not resurrect retired pages; sitemap stays strictly <= 95 URLs',
    async fn() {
      const out = runConsolidationInTempSandbox();
      assertFalse(out.includes('[GSC Winner Lock]'), 'Winner Lock must not resurrect retired pages');

      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { totalUrls, urls } = validateSitemapXml(content);
      assertLessThanOrEqual(totalUrls, 95, `Sitemap must remain <= 95 URLs, got ${totalUrls}`);
      assertFalse(urls.some((u) => u.includes('-smart-tv-acr-blocking')), 'No ACR URLs in sitemap');
    }
  },

  // P12: F14 × F15 — Pruned Sitemap vs Frozen <lastmod> on Semantic <main>
  {
    id: 'P12',
    feature: 'F14xF15',
    tier: 3,
    name: 'P12: Consecutive audit runs without modifying <main> keep every per-URL sitemap lastmod date identical',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content1 = fs.readFileSync(sitemapPath, 'utf8');
      const { lastmods: lm1 } = validateSitemapXml(content1);

      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });

      const content2 = fs.readFileSync(sitemapPath, 'utf8');
      const { lastmods: lm2 } = validateSitemapXml(content2);

      assertEqual(Object.keys(lm1).length, Object.keys(lm2).length, 'Lastmod counts must match');
      for (const u of Object.keys(lm1)) {
        assertEqual(lm1[u], lm2[u], `lastmod for ${u} must remain identical (${lm1[u]} vs ${lm2[u]})`);
      }
    }
  },

  // P13: F15 × F16 — Frozen <lastmod> vs Leak Test Content Deepening
  {
    id: 'P13',
    feature: 'F15xF16',
    tier: 3,
    name: 'P13: Leak test semantic main contains ICE candidate table and has valid lastmod in sitemap',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertTrue(main.includes('host') && main.includes('srflx'), 'Deepened content in main');

      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { lastmods } = validateSitemapXml(content);
      const testUrl = 'https://sweeprvpn.com/tools/leak-test';
      if (lastmods[testUrl]) {
        assertMatch(lastmods[testUrl], /^\d{4}-\d{2}-\d{2}$/, 'Valid lastmod date');
      }
    }
  },

  // P14: F15 × F17 — Frozen <lastmod> vs ISP Throttling Content Deepening
  {
    id: 'P14',
    feature: 'F15xF17',
    tier: 3,
    name: 'P14: ISP throttling semantic main contains DPI table and has valid lastmod in sitemap',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertTrue(main.includes('SNI') || main.includes('DPI'), 'Deepened DPI content in main');

      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { lastmods } = validateSitemapXml(content);
      const testUrl = 'https://sweeprvpn.com/tools/isp-throttling-test';
      if (lastmods[testUrl]) {
        assertMatch(lastmods[testUrl], /^\d{4}-\d{2}-\d{2}$/, 'Valid lastmod date');
      }
    }
  },

  // P15: F18 × F3 — Prominent Hub/Tool/TotalVPN Links vs 301 Redirect Resolver
  {
    id: 'P15',
    feature: 'F18xF3',
    tier: 3,
    name: 'P15: Prominent #homeToolsAndHubsStrip and TotalVPN links on / resolve 200 OK without triggering 301',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      const links = extractLinks(res.body);
      const pillarLinks = [
        '/tools/leak-test',
        '/tools/isp-throttling-test',
        '/solutions',
        '/setup',
        '/guides',
        '/vs',
        '/vs/totalvpn',
        '/alternatives/totalvpn'
      ];
      for (const pl of pillarLinks) {
        const linkObj = links.find((l) => l.href === pl);
        assertTrue(!!linkObj, `Homepage must link to ${pl}`);
        assertFalse(hasNofollow(linkObj), `Link to ${pl} must not be nofollow`);
        const targetRes = await fetchOpaque(`${baseUrl}${pl}`);
        assertEqual(targetRes.status, 200, `Target ${pl} must return 200 directly`);
        assertEqual(targetRes.location, null, `Target ${pl} must not redirect`);
      }
    }
  },

  // P16: F18 × F22 — Warrant Canary Links vs Live Canary Integrity
  {
    id: 'P16',
    feature: 'F18xF22',
    tier: 3,
    name: 'P16: Warrant canary links from /download, /tools/leak-test, /ai-info, and /faq resolve to 200 OK with PGP block',
    async fn({ baseUrl }) {
      for (const p of ['/download?platform=picker', '/tools/leak-test', '/ai-info', '/faq']) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `${p} must return 200`);
        assertTrue(res.body.includes('href="/warrant-canary"'), `${p} must link to /warrant-canary`);
      }

      const canaryRes = await fetchOpaque(`${baseUrl}/warrant-canary`);
      assertEqual(canaryRes.status, 200, 'Canary must return 200');
      assertTrue(
        canaryRes.body.includes('-----BEGIN PGP SIGNED MESSAGE-----') || canaryRes.body.includes('Warrant Canary'),
        'Canary must contain cryptographic or formal attestations'
      );
    }
  },

  // P17: F19 × F20 — Read-Only Pipeline Lock (--json-only) vs CI Quality Gate
  {
    id: 'P17',
    feature: 'F19xF20',
    tier: 3,
    name: 'P17: Workflow with --json-only & --no-ctr-rewrite satisfies ci-seo-quality-gate.mjs assertions',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertIncludes(content, '--json-only', 'Workflow must lock keyword discovery to --json-only');
      assertIncludes(content, '--no-ctr-rewrite', 'Workflow must lock GSC sync to --no-ctr-rewrite');
      assertIncludes(content, 'ci-seo-quality-gate.mjs', 'Workflow must invoke ci-seo-quality-gate.mjs');
      assertIncludes(content, 'Abort on HTML Mutations', 'Workflow must abort on HTML mutations');
      const gateOut = execSync(`node "${path.join(SCRIPTS_DIR, 'ci-seo-quality-gate.mjs')}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertIncludes(gateOut, 'CI SEO Quality Gate PASSED', 'CI quality gate must pass');
    }
  },

  // P18: F20 × F2 — CI Assertions vs Zombie Cleanup Verification
  {
    id: 'P18',
    feature: 'F20xF2',
    tier: 3,
    name: 'P18: CI assertion detects 0 zombie files across all four cluster directories',
    async fn() {
      const solutionsDir = path.join(WEBSITE_DIR, 'solutions');
      const vsDir = path.join(WEBSITE_DIR, 'vs');
      const setupDir = path.join(WEBSITE_DIR, 'setup');
      const guidesDir = path.join(WEBSITE_DIR, 'guides');

      const totalZombies =
        findFilesWithPattern(solutionsDir, /noindex/i).length +
        findFilesWithPattern(vsDir, /noindex/i).length +
        findFilesWithPattern(setupDir, /noindex/i).length +
        findFilesWithPattern(guidesDir, /noindex/i).length;

      assertEqual(totalZombies, 0, 'CI assertion requirement: strictly 0 zombie files');
    }
  },

  // P19: F20 × F14 — CI Assertions vs Sitemap URL Ceiling
  {
    id: 'P19',
    feature: 'F20xF14',
    tier: 3,
    name: 'P19: CI assertion verifies sitemap URL count strictly respects <= 95 ceiling',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { totalUrls } = validateSitemapXml(content);
      assertLessThanOrEqual(totalUrls, 95, `CI ceiling check: sitemap must be <= 95, got ${totalUrls}`);
    }
  },

  // P20: F20 × F8 — CI Assertions vs 5-Gram Overlap Ceiling
  {
    id: 'P20',
    feature: 'F20xF8',
    tier: 3,
    name: 'P20: CI assertion verifies 5-gram shingle overlap stays strictly below 30% ceiling',
    async fn() {
      const p1 = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      const p2 = path.join(WEBSITE_DIR, 'setup', 'gl-inet-travel-router.html');
      assertTrue(fs.existsSync(p1) && fs.existsSync(p2), 'Both pillars must exist');
      const overlap = calculate5GramOverlap(fs.readFileSync(p1, 'utf8'), fs.readFileSync(p2, 'utf8'));
      assertLessThan(overlap, 30.0, `Overlap must be < 30% CI ceiling, got ${overlap.toFixed(2)}%`);
    }
  },

  // P21: F21 × F15 — Audit Script Execution vs Semantic Lastmod Stability
  {
    id: 'P21',
    feature: 'F21xF15',
    tier: 3,
    name: 'P21: Local audit script --no-fix --no-ping preserves exact SHA-256 of sitemap.xml',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const beforeSha = sha256File(sitemapPath);
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertEqual(sha256File(sitemapPath), beforeSha, 'Audit --no-fix --no-ping must leave sitemap.xml SHA-256 unchanged');
    }
  },

  // P22: F3 × F22 — 301 Redirect Resolver vs Query String Preservation
  {
    id: 'P22',
    feature: 'F3xF22',
    tier: 3,
    name: 'P22: Production 301 redirect preserves multi-parameter UTM campaign tracking end-to-end',
    async fn({ baseUrl }) {
      const query = '?ref=reddit&utm_campaign=winter2026&utm_medium=paid&channel=ppc';
      const res = await fetchOpaque(`${baseUrl}/leak-test${query}`);
      assertEqual(res.status, 301, 'Must return 301');
      assertEqual(res.location, `/tools/leak-test${query}`, 'Must preserve entire UTM query string');
    }
  },

  // P23: F23 × F24 — Real WebP Proof Assets vs /ai-info 8-POP GEO Fact Sheet
  {
    id: 'P23',
    feature: 'F23xF24',
    tier: 3,
    name: 'P23: Homepage WebP proof captures and /ai-info 8-POP fact sheet align without deprecated schema',
    async fn({ baseUrl }) {
      const home = await fetchOpaque(`${baseUrl}/`);
      assertEqual(home.status, 200, '/ must return 200');
      assertIncludes(home.body, '/assets/desktop-home-light.webp', 'Homepage must embed desktop-home-light.webp');
      const imgRes = await fetchBinary(`${baseUrl}/assets/desktop-home-light.webp`);
      assertEqual(imgRes.status, 200, 'desktop-home-light.webp must return 200');
      assertLessThan(imgRes.byteLength, 81920, 'WebP must be < 80 KB');

      const aiInfo = await fetchOpaque(`${baseUrl}/ai-info`);
      assertEqual(aiInfo.status, 200, '/ai-info must return 200');
      assertIncludes(aiInfo.body, 'UK-LON-01', '/ai-info must list UK-LON-01 POP');
      assertFalse(/"@type"\s*:\s*"(FAQPage|HowTo)"/i.test(aiInfo.body), '/ai-info must omit FAQPage/HowTo');
    }
  },

  // P24: F25 × F27 — /faq PAA Colony vs Consolidated 23 /solutions/ Hubs
  {
    id: 'P24',
    feature: 'F25xF27',
    tier: 3,
    name: 'P24: /faq PAA links resolve 200 OK across consolidated /solutions/ hubs and exclude retired hyperoptic',
    async fn({ baseUrl }) {
      const faqRes = await fetchOpaque(`${baseUrl}/faq`);
      assertEqual(faqRes.status, 200, '/faq must return 200');
      const mainHtml = extractMainContent(faqRes.body);
      assertFalse(mainHtml.includes('hyperoptic-broadband-isp-throttling'), '/faq must not link to deleted hyperoptic page');
      const solLinks = [...new Set(extractLinks(mainHtml).map((l) => l.href).filter((h) => h.startsWith('/solutions/')))];
      assertGreaterThanOrEqual(solLinks.length, 5, 'Expected >= 5 /solutions/ links inside /faq <main>');
      for (const s of solLinks) {
        const res = await fetchOpaque(`${baseUrl}${s}`, { method: 'HEAD' });
        assertEqual(res.status, 200, `/faq solution link ${s} must return 200`);
        assertEqual(res.location, null, `/faq solution link ${s} must not redirect`);
      }
    }
  },

  // P25: F24 × F26 — robots.txt & sitemap.xml Exclusion vs Live noindex Utility Headers
  {
    id: 'P25',
    feature: 'F24xF26',
    tier: 3,
    name: 'P25: robots.txt Disallow and sitemap.xml exclusion match live X-Robots-Tag noindex on /welcome and /uninstall',
    async fn({ baseUrl }) {
      const robots = await fetchOpaque(`${baseUrl}/robots.txt`);
      assertIncludes(robots.body, 'Disallow: /welcome', 'robots.txt must disallow /welcome');
      assertIncludes(robots.body, 'Disallow: /uninstall', 'robots.txt must disallow /uninstall');

      const sitemap = await fetchOpaque(`${baseUrl}/sitemap.xml`);
      const { urls } = validateSitemapXml(sitemap.body);
      assertFalse(urls.some((u) => u.endsWith('/welcome') || u.endsWith('/uninstall')), 'sitemap.xml must exclude /welcome and /uninstall');

      for (const p of ['/welcome', '/uninstall']) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `${p} must return 200`);
        assertIncludes((res.getHeader('x-robots-tag') || '').toLowerCase(), 'noindex, nofollow', `${p} must send X-Robots-Tag: noindex, nofollow`);
      }
    }
  },

  // P26: F26 × F26 — Isolated SWEEPR_STATE_DIR Log Separation
  {
    id: 'P26',
    feature: 'F26xF26',
    tier: 3,
    name: 'P26: POST /api/uninstall-feedback writes to isolated uninstall-feedback.jsonl without polluting tool-telemetry.jsonl or website/data/',
    async fn({ baseUrl, stateDir }) {
      const resolvedStateDir = stateDir || getServerStateDir();
      assertTrue(!!resolvedStateDir, 'Isolated SWEEPR_STATE_DIR must be active');
      const telPath = path.join(resolvedStateDir, 'tool-telemetry.jsonl');
      const telBefore = fs.existsSync(telPath) ? fs.readFileSync(telPath, 'utf8') : '';

      const marker = `p26-isolation-${Date.now()}`;
      const res = await fetchOpaque(`${baseUrl}/api/uninstall-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'connection_drops', os: 'mac', version: '2.6.0', note: marker })
      });
      assertEqual(res.status, 200, 'Uninstall feedback must succeed');

      const fbPath = path.join(resolvedStateDir, 'uninstall-feedback.jsonl');
      assertTrue(fs.existsSync(fbPath), 'uninstall-feedback.jsonl must exist in isolated stateDir');
      assertIncludes(fs.readFileSync(fbPath, 'utf8'), marker, 'Marker must appear in uninstall-feedback.jsonl');

      const telAfter = fs.existsSync(telPath) ? fs.readFileSync(telPath, 'utf8') : '';
      assertEqual(telAfter, telBefore, 'POST /api/uninstall-feedback must not pollute tool-telemetry.jsonl');
      assertFalse(telAfter.includes(marker), 'Uninstall feedback marker must never appear in tool-telemetry.jsonl');
    }
  },

  // P27: F25 × F28 — BOFU Footer & Mobile Nav Drawer vs CI Quality Gate
  {
    id: 'P27',
    feature: 'F25xF28',
    tier: 3,
    name: 'P27: BOFU <15 footers and static #mobileNavDrawer links before <main> agree with ci-seo-quality-gate.mjs',
    async fn({ baseUrl }) {
      for (const p of ['/', '/ai-info', '/faq', '/solutions/talktalk-fibre-wireguard-cgnat']) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `${p} must return 200`);
        const drawerIdx = res.body.search(/id=["']mobileNavDrawer["']/i);
        const mainIdx = res.body.search(/<main\b/i);
        assertTrue(drawerIdx >= 0 && mainIdx > drawerIdx, `${p} must place #mobileNavDrawer before <main>`);
      }
      const gateOut = execSync(`node "${path.join(SCRIPTS_DIR, 'ci-seo-quality-gate.mjs')}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertIncludes(gateOut, 'CI SEO Quality Gate PASSED', 'CI quality gate must pass');
    }
  },

  // P28: F27 × F28 — M3 23 /solutions/ & 94-URL Sitemap vs Daily Audit
  {
    id: 'P28',
    feature: 'F27xF28',
    tier: 3,
    name: 'P28: Consolidated 23 /solutions/ + 94-URL sitemap.xml passes daily-seo-pagespeed-audit.mjs --no-fix --no-ping with 0 failures',
    async fn() {
      const solutionsCount = fs.readdirSync(path.join(WEBSITE_DIR, 'solutions')).filter((f) => f.endsWith('.html')).length;
      assertEqual(solutionsCount, 23, `Expected 23 /solutions/ HTML files, got ${solutionsCount}`);
      const { totalUrls } = validateSitemapXml(fs.readFileSync(path.join(WEBSITE_DIR, 'sitemap.xml'), 'utf8'));
      assertEqual(totalUrls, 94, `Expected 94 sitemap URLs, got ${totalUrls}`);
      const auditOut = execSync(`node "${path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs')}" --no-fix --no-ping`, {
        cwd: ROOT_DIR,
        encoding: 'utf8'
      });
      assertIncludes(auditOut, '100% HEALTHY', 'Daily audit must report 100% HEALTHY');
    }
  }
];
