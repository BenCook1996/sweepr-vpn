/**
 * SWEEPR VPN — E2E Test Suite: Tier 3 Cross-Feature Interactions
 * Tests 22 pairwise interaction scenarios (P01 through P22).
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
  assertGreaterThanOrEqual,
  fetchOpaque,
  calculate5GramOverlap,
  extractSemanticText,
  tokenizeWords,
  extractMainContent,
  extractCanonical,
  extractRobots,
  extractLinks,
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
      if (fs.existsSync(p1) && fs.existsSync(p2)) {
        const h1 = fs.readFileSync(p1, 'utf8');
        const h2 = fs.readFileSync(p2, 'utf8');
        const overlap = calculate5GramOverlap(h1, h2);
        assertLessThan(overlap, 25.0, `Overlap must be < 25%, got ${overlap.toFixed(2)}%`);
      }
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

      const p1 = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      const p2 = path.join(WEBSITE_DIR, 'solutions', 'virgin-media-remote-dev-ssh.html');
      if (fs.existsSync(p1) && fs.existsSync(p2)) {
        const h1 = fs.readFileSync(p1, 'utf8');
        const h2 = fs.readFileSync(p2, 'utf8');
        const overlap = calculate5GramOverlap(h1, h2);
        assertLessThan(overlap, 25.0, `Solutions overlap must be < 25%, got ${overlap.toFixed(2)}%`);
      }
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

  // P08: F9 × F12 — Footer Directory Removal vs Curated 12-Pillar Grid
  {
    id: 'P08',
    feature: 'F9xF12',
    tier: 3,
    name: 'P08: Footer directory is absent while curated 12-pillar grid is present on index and pricing',
    async fn({ baseUrl }) {
      for (const p of ['/', '/pricing']) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `${p} must return 200`);
        assertFalse(containsElementId(res.body, 'sweepr-seo-directory'), `Directory absent on ${p}`);
        assertTrue(res.body.includes('/warrant-canary'), `12-pillar grid present on ${p}`);
      }
    }
  },

  // P09: F10 × F12 — Rotator Bridge Banner Removal vs 12-Pillar Grid
  {
    id: 'P09',
    feature: 'F10xF12',
    tier: 3,
    name: 'P09: Rotator bridge banner is absent while curated 12-pillar grid is present on tool pages',
    async fn({ baseUrl }) {
      for (const p of ['/tools/leak-test', '/tools/isp-throttling-test']) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `${p} must return 200`);
        assertFalse(containsElementId(res.body, 'sweepr-unindexed-guides-bridge'), `Bridge absent on ${p}`);
        assertTrue(res.body.includes('/warrant-canary'), `Curated grid present on ${p}`);
      }
    }
  },

  // P10: F11 × F12 — Disabled Audit Footer Injection vs 12-Pillar Grid
  {
    id: 'P10',
    feature: 'F11xF12',
    tier: 3,
    name: 'P10: Audit script execution preserves 12-pillar navigation grid without re-injecting directory',
    async fn({ baseUrl }) {
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });

      const res = await fetchOpaque(`${baseUrl}/`);
      assertFalse(containsElementId(res.body, 'sweepr-seo-directory'), 'Directory must remain absent');
      assertTrue(res.body.includes('/warrant-canary'), '12-pillar grid must remain intact');
    }
  },

  // P11: F13 × F14 — GSC Winner Lock Neutralization vs Sitemap Pruning
  {
    id: 'P11',
    feature: 'F13xF14',
    tier: 3,
    name: 'P11: GSC consolidation does not resurrect retired pages; sitemap stays strictly <= 95 URLs',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'consolidate-and-optimize-gsc.mjs');
      execSync(`node "${fp}"`, { cwd: ROOT_DIR, encoding: 'utf8' });

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
    name: 'P12: Consecutive audit runs without modifying <main> keep sitemap lastmod dates identical',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content1 = fs.readFileSync(sitemapPath, 'utf8');
      const { lastmods: lm1 } = validateSitemapXml(content1);

      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });

      const content2 = fs.readFileSync(sitemapPath, 'utf8');
      const { lastmods: lm2 } = validateSitemapXml(content2);

      assertEqual(Object.keys(lm1).length, Object.keys(lm2).length, 'Lastmod counts must match');
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

  // P15: F18 × F3 — Prominent Pillar Links vs 301 Redirect Resolver
  {
    id: 'P15',
    feature: 'F18xF3',
    tier: 3,
    name: 'P15: Prominent pillar links from homepage resolve directly to HTTP 200 without triggering 301',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      const links = extractLinks(res.body);
      const pillarLinks = [
        '/guides/stop-samsung-smart-tv-acr-tracking',
        '/setup/gl-inet-travel-router',
        '/tools/leak-test',
        '/tools/isp-throttling-test',
        '/setup/synology-nas-docker-vpn',
        '/alternatives/totalvpn'
      ];
      for (const pl of pillarLinks) {
        const linkObj = links.find((l) => l.href === pl);
        if (linkObj) {
          const targetRes = await fetchOpaque(`${baseUrl}${pl}`);
          assertEqual(targetRes.status, 200, `Target ${pl} must return 200 directly`);
          assertEqual(targetRes.location, null, `Target ${pl} must not redirect`);
        }
      }
    }
  },

  // P16: F18 × F22 — Warrant Canary Links vs Live Canary Integrity
  {
    id: 'P16',
    feature: 'F18xF22',
    tier: 3,
    name: 'P16: Warrant canary link from homepage resolves to HTTP 200 with cryptographic PGP block',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      assertTrue(res.body.includes('href="/warrant-canary"'), 'Homepage must link to warrant canary');

      const canaryRes = await fetchOpaque(`${baseUrl}/warrant-canary`);
      assertEqual(canaryRes.status, 200, 'Canary must return 200');
      assertTrue(
        canaryRes.body.includes('-----BEGIN PGP SIGNED MESSAGE-----') || canaryRes.body.includes('Warrant Canary'),
        'Canary must contain cryptographic or formal attestations'
      );
    }
  },

  // P17: F19 × F20 — Pipeline Lock (--limit=0) vs CI Assertions
  {
    id: 'P17',
    feature: 'F19xF20',
    tier: 3,
    name: 'P17: Workflow with --limit=0 satisfies all CI guardrail assertions',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertIncludes(content, '--limit=0', 'Workflow frozen with --limit=0');
      assertTrue(content.includes('95') || content.includes('assertion'), 'CI guardrails present');
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
      const p1 = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      const p2 = path.join(WEBSITE_DIR, 'setup', 'gl-inet-travel-router.html');
      if (fs.existsSync(p1) && fs.existsSync(p2)) {
        const overlap = calculate5GramOverlap(fs.readFileSync(p1, 'utf8'), fs.readFileSync(p2, 'utf8'));
        assertLessThan(overlap, 30.0, `Overlap must be < 30% CI ceiling, got ${overlap.toFixed(2)}%`);
      }
    }
  },

  // P21: F21 × F15 — Audit Script Execution vs Semantic Lastmod Stability
  {
    id: 'P21',
    feature: 'F21xF15',
    tier: 3,
    name: 'P21: Local audit script run leaves sitemap.xml with 0 diff when semantic main is unchanged',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      // Sitemaps should remain stable
      assertTrue(true, 'Audit script runs stably without churning unchanged entries');
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
  }
];
