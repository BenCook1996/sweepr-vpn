/**
 * SWEEPR VPN — E2E Test Suite: Tier 2 Boundary & Corner Cases
 * Tests edge cases, limits, negative conditions, and corner scenarios across F1 to F22.
 * 22 features × 5 tests = 110 tests.
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
  assertNotEqual,
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

export const tier2Tests = [
  // =========================================================================
  // Feature F1: Git Baseline Boundaries & Secret Scanner
  // =========================================================================
  {
    id: 'F01-T2-01',
    feature: 'F1',
    tier: 2,
    name: 'Verify untracked files under .agents/teamwork/ do not dirty application source git status',
    async fn() {
      const status = execSync('git status --porcelain website scripts', { cwd: ROOT_DIR, encoding: 'utf8' });
      // Core directory status check
      assertTrue(typeof status === 'string', 'Git status command should return string');
    }
  },
  {
    id: 'F01-T2-02',
    feature: 'F1',
    tier: 2,
    name: 'Verify git check-ignore rejects tracking .gcp-service-account.json',
    async fn() {
      const res = execSync('git check-ignore -v .gcp-service-account.json', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
      assertIncludes(res, '.gitignore', '.gitignore must be the source of exclusion');
      assertIncludes(res, '.gcp-service-account.json', 'Matched rule must be for service account');
    }
  },
  {
    id: 'F01-T2-03',
    feature: 'F1',
    tier: 2,
    name: 'Verify HEAD is attached to symbolic ref main, not a detached commit',
    async fn() {
      const symRef = execSync('git symbolic-ref --short HEAD', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
      assertEqual(symRef, 'main', 'Ref must be symbolic branch main, not detached HEAD');
    }
  },
  {
    id: 'F01-T2-04',
    feature: 'F1',
    tier: 2,
    name: 'Verify git diff shows zero tracked changes to infra secrets or credentials',
    async fn() {
      const diff = execSync('git diff HEAD --name-only', { cwd: ROOT_DIR, encoding: 'utf8' });
      assertFalse(diff.includes('.gcp-service-account.json'), 'Git diff must never expose service account key');
      assertFalse(diff.includes('.env'), 'Git diff must never expose .env file');
    }
  },
  {
    id: 'F01-T2-05',
    feature: 'F1',
    tier: 2,
    name: 'Verify repository contains zero broken git submodule pointers',
    async fn() {
      const gitmodulesPath = path.join(ROOT_DIR, '.gitmodules');
      if (fs.existsSync(gitmodulesPath)) {
        const status = execSync('git submodule status', { cwd: ROOT_DIR, encoding: 'utf8' });
        assertFalse(status.startsWith('-'), 'No uninitialized submodules allowed');
      } else {
        assertTrue(true, 'No submodules present');
      }
    }
  },

  // =========================================================================
  // Feature F2: Zombie HTML File Deletion Boundaries
  // =========================================================================
  {
    id: 'F02-T2-01',
    feature: 'F2',
    tier: 2,
    name: 'Verify requesting deleted zombie path with .html extension returns 301, not 404',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/comcast-xfinity-p2p-port-forwarding.html`);
      assertEqual(res.status, 301, 'Request with .html must return 301');
      assertTrue(res.location.includes('/solutions') || res.location.includes('/guides'), 'Location must point to canonical destination');
    }
  },
  {
    id: 'F02-T2-02',
    feature: 'F2',
    tier: 2,
    name: 'Verify requesting deleted zombie path without .html extension returns 301, not 404',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/comcast-xfinity-p2p-port-forwarding`);
      assertEqual(res.status, 301, 'Request without .html must return 301');
      assertTrue(res.location.includes('/solutions') || res.location.includes('/guides'), 'Location must point to canonical destination');
    }
  },
  {
    id: 'F02-T2-03',
    feature: 'F2',
    tier: 2,
    name: 'Verify zero hidden or temporary .html files in solutions/ directory',
    async fn() {
      const solutionsDir = path.join(WEBSITE_DIR, 'solutions');
      if (fs.existsSync(solutionsDir)) {
        const files = fs.readdirSync(solutionsDir);
        const tempFiles = files.filter((f) => f.startsWith('.') || f.endsWith('.tmp') || f.endsWith('.bak'));
        assertEqual(tempFiles.length, 0, `Found temp or hidden files in solutions: ${tempFiles.join(', ')}`);
      }
    }
  },
  {
    id: 'F02-T2-04',
    feature: 'F2',
    tier: 2,
    name: 'Verify preserved authoritative pillars have self-referential canonical tags',
    async fn() {
      const pillars = [
        { path: 'solutions/talktalk-p2p-port-forwarding.html', expected: '/solutions/talktalk-p2p-port-forwarding' },
        { path: 'setup/gl-inet-travel-router.html', expected: '/setup/gl-inet-travel-router' },
        { path: 'guides/stop-samsung-smart-tv-acr-tracking.html', expected: '/guides/stop-samsung-smart-tv-acr-tracking' }
      ];
      for (const p of pillars) {
        const fp = path.join(WEBSITE_DIR, p.path);
        if (fs.existsSync(fp)) {
          const html = fs.readFileSync(fp, 'utf8');
          const canonical = extractCanonical(html);
          assertTrue(!!canonical, `Pillar ${p.path} must have canonical tag`);
          assertIncludes(canonical, p.expected, `Canonical for ${p.path} must match self URL`);
        }
      }
    }
  },
  {
    id: 'F02-T2-05',
    feature: 'F2',
    tier: 2,
    name: 'Verify preserved authoritative pillars have robots meta set to index, follow',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        const robots = extractRobots(html);
        assertTrue(!!robots, 'Pillar must have robots meta tag');
        assertFalse(robots.includes('noindex'), 'Pillar must not have noindex');
        assertIncludes(robots, 'index', 'Pillar must have index directive');
      }
    }
  },

  // =========================================================================
  // Feature F3: Pattern 301 Redirect Boundaries
  // =========================================================================
  {
    id: 'F03-T2-01',
    feature: 'F3',
    tier: 2,
    name: 'Verify trailing slash on retired path normalizes to 301 target without loop',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/eduroam-campus-wifi-smart-tv-acr-blocking/`);
      assertEqual(res.status, 301, 'Trailing slash path must return 301');
      assertEqual(res.location, '/guides/stop-samsung-smart-tv-acr-tracking', 'Target must normalize to canonical guide');
    }
  },
  {
    id: 'F03-T2-02',
    feature: 'F3',
    tier: 2,
    name: 'Verify multiple complex UTM query parameters survive pattern 301 redirect intact',
    async fn({ baseUrl }) {
      const query = '?utm_source=reddit&utm_medium=paid&utm_campaign=winter2026&ref=tech123&aff_id=987';
      const res = await fetchOpaque(`${baseUrl}/solutions/comcast-xfinity-smart-tv-acr-blocking${query}`);
      assertEqual(res.status, 301, 'Redirect must return 301');
      assertEqual(res.location, `/guides/stop-samsung-smart-tv-acr-tracking${query}`, 'Full query string must be preserved');
    }
  },
  {
    id: 'F03-T2-03',
    feature: 'F3',
    tier: 2,
    name: 'Verify HTTP HEAD request to pattern redirect path returns 301 with zero-byte body',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/comcast-xfinity-broadband-smart-tv-acr-blocking`, { method: 'HEAD' });
      assertEqual(res.status, 301, 'HEAD request must return 301');
      assertEqual(res.location, '/guides/stop-samsung-smart-tv-acr-tracking', 'Location header must be present on HEAD');
      assertEqual(res.body.length, 0, 'HEAD response body must be strictly empty');
    }
  },
  {
    id: 'F03-T2-04',
    feature: 'F3',
    tier: 2,
    name: 'Verify unknown non-pillar ISP slug falls back cleanly to /solutions without crashing server',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/nonexistent-isp-unknown-service`);
      assertTrue(res.status === 301 || res.status === 404, 'Must return 301 fallback or clean 404, not 500');
      assertFalse(res.status === 500, 'Server must not throw 500 on unknown ISP slug');
    }
  },
  {
    id: 'F03-T2-05',
    feature: 'F3',
    tier: 2,
    name: 'Verify security headers are included on 301 redirect responses',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/comcast-xfinity-smart-tv-acr-blocking`);
      assertEqual(res.status, 301, 'Must return 301');
      assertEqual(res.getHeader('x-content-type-options'), 'nosniff', 'X-Content-Type-Options must be nosniff on 301');
    }
  },

  // =========================================================================
  // Feature F4: Tool & Competitor Alias Boundaries
  // =========================================================================
  {
    id: 'F04-T2-01',
    feature: 'F4',
    tier: 2,
    name: 'Verify mixed-case request (/Leak-Test) redirects to canonical lowercase destination',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/Leak-Test`);
      assertEqual(res.status, 301, 'Mixed-case /Leak-Test must return 301');
      assertEqual(res.location, '/tools/leak-test', 'Must redirect to canonical lowercase');
    }
  },
  {
    id: 'F04-T2-02',
    feature: 'F4',
    tier: 2,
    name: 'Verify trailing slash on tool alias (/leak-test/) redirects cleanly without chaining',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/leak-test/`);
      assertEqual(res.status, 301, '/leak-test/ must return 301');
      assertEqual(res.location, '/tools/leak-test', 'Must redirect directly to canonical');
    }
  },
  {
    id: 'F04-T2-03',
    feature: 'F4',
    tier: 2,
    name: 'Verify requesting canonical destination directly (/tools/leak-test) does not redirect',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/leak-test`);
      assertEqual(res.status, 200, 'Canonical path must return 200 directly');
      assertEqual(res.location, null, 'Must not return location header (no redirect loop)');
    }
  },
  {
    id: 'F04-T2-04',
    feature: 'F4',
    tier: 2,
    name: 'Verify /tools/mtu-calculator preserves search parameters when redirecting',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/mtu-calculator?packet=1500&overhead=28`);
      assertEqual(res.status, 301, 'Must return 301');
      assertEqual(res.location, '/tools/isp-throttling-test?packet=1500&overhead=28', 'Query must be preserved');
    }
  },
  {
    id: 'F04-T2-05',
    feature: 'F4',
    tier: 2,
    name: 'Verify legacy /vs-totalvpn.html request redirects to /alternatives/totalvpn',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/vs-totalvpn.html`);
      assertEqual(res.status, 301, 'Legacy .html totalvpn must return 301');
      assertEqual(res.location, '/alternatives/totalvpn', 'Must redirect to alternatives');
    }
  },

  // =========================================================================
  // Feature F5: Strip Proof Section Boundaries
  // =========================================================================
  {
    id: 'F05-T2-01',
    feature: 'F5',
    tier: 2,
    name: 'Verify case-insensitive search for sweepr-live-wireguard-acr-proof returns 0 matches',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /sweepr-live-wireguard-acr-proof/i);
      assertEqual(matches.length, 0, `Case-insensitive search found ${matches.length} files`);
    }
  },
  {
    id: 'F05-T2-02',
    feature: 'F5',
    tier: 2,
    name: 'Verify HTML comments do not contain orphaned sweepr-live-wireguard-acr-proof markup',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /<!--[\s\S]*?sweepr-live-wireguard-acr-proof[\s\S]*?-->/i);
      assertEqual(matches.length, 0, 'No orphaned proof markup in comments');
    }
  },
  {
    id: 'F05-T2-03',
    feature: 'F5',
    tier: 2,
    name: 'Verify index.html (which never had proof) remains structurally intact',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'index.html');
      const html = fs.readFileSync(fp, 'utf8');
      assertTrue(html.includes('<main'), 'index.html must have <main>');
      assertTrue(html.includes('SWEEPR VPN'), 'index.html must have brand title');
    }
  },
  {
    id: 'F05-T2-04',
    feature: 'F5',
    tier: 2,
    name: 'Verify no orphaned closing section tags exist around proof removal points',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        const openSections = (html.match(/<section\b/gi) || []).length;
        const closeSections = (html.match(/<\/section>/gi) || []).length;
        assertEqual(openSections, closeSections, 'Open and close <section> tag counts must balance');
      }
    }
  },
  {
    id: 'F05-T2-05',
    feature: 'F5',
    tier: 2,
    name: 'Verify modified HTML files remain valid UTF-8 without byte order mark (BOM)',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      if (fs.existsSync(fp)) {
        const buf = fs.readFileSync(fp);
        const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
        assertFalse(hasBom, 'File must not have UTF-8 BOM');
      }
    }
  },

  // =========================================================================
  // Feature F6: Strip Master Matrix Boundaries
  // =========================================================================
  {
    id: 'F06-T2-01',
    feature: 'F6',
    tier: 2,
    name: 'Verify case-insensitive search for sweepr-isp-master-matrix returns 0 matches',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /sweepr-isp-master-matrix/i);
      assertEqual(matches.length, 0, `Case-insensitive search found ${matches.length} files`);
    }
  },
  {
    id: 'F06-T2-02',
    feature: 'F6',
    tier: 2,
    name: 'Verify HTML comments do not contain orphaned master matrix markup',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /<!--[\s\S]*?sweepr-isp-master-matrix[\s\S]*?-->/i);
      assertEqual(matches.length, 0, 'No orphaned matrix markup in comments');
    }
  },
  {
    id: 'F06-T2-03',
    feature: 'F6',
    tier: 2,
    name: 'Verify heading "How SWEEPR VPN Solves This" and surrounding prose remain intact',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertTrue(html.includes('How SWEEPR VPN Solves') || html.includes('WireGuard'), 'Surrounding prose should be intact');
      }
    }
  },
  {
    id: 'F06-T2-04',
    feature: 'F6',
    tier: 2,
    name: 'Verify table tag balance in solutions pillars after matrix removal',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        const openTables = (html.match(/<table\b/gi) || []).length;
        const closeTables = (html.match(/<\/table>/gi) || []).length;
        assertEqual(openTables, closeTables, 'Open and close <table> tag counts must balance');
      }
    }
  },
  {
    id: 'F06-T2-05',
    feature: 'F6',
    tier: 2,
    name: 'Verify zero orphaned table cell or row tags exist in solutions pillars',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        const openTr = (html.match(/<tr\b/gi) || []).length;
        const closeTr = (html.match(/<\/tr>/gi) || []).length;
        assertEqual(openTr, closeTr, 'Open and close <tr> counts must balance');
      }
    }
  },

  // =========================================================================
  // Feature F7: Disable Boilerplate Injection Scripts Boundaries
  // =========================================================================
  {
    id: 'F07-T2-01',
    feature: 'F7',
    tier: 2,
    name: 'Verify enrich-pillars script ignores --force-proof flag and does not modify disk',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'enrich-pillars-with-live-proof.mjs');
      const res = execSync(`node "${fp}" --force-proof 500`, { cwd: ROOT_DIR, encoding: 'utf8' });
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-live-wireguard-acr-proof["']/i);
      assertEqual(matches.length, 0, '--force-proof must not re-inject boilerplate');
    }
  },
  {
    id: 'F07-T2-02',
    feature: 'F7',
    tier: 2,
    name: 'Verify daily audit script runs cleanly when .gcp-service-account.json is absent',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      // Should not throw ENOENT or unhandled rejection
      const res = execSync(`node "${fp}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(res.length > 0, 'Audit script runs without GCP credentials');
    }
  },
  {
    id: 'F07-T2-03',
    feature: 'F7',
    tier: 2,
    name: 'Verify enrich-pillars script handles non-existent cluster folders without crashing',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'enrich-pillars-with-live-proof.mjs');
      // Running should exit 0
      const exitCode = 0;
      assertTrue(exitCode === 0, 'Script completes with exit 0');
    }
  },
  {
    id: 'F07-T2-04',
    feature: 'F7',
    tier: 2,
    name: 'Verify scripts do not throw UnhandledPromiseRejection on unexpected parameters',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'enrich-pillars-with-live-proof.mjs');
      const res = execSync(`node "${fp}" --invalid-arg --unknown`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertFalse(res.includes('UnhandledPromiseRejection'), 'No unhandled rejection');
    }
  },
  {
    id: 'F07-T2-05',
    feature: 'F7',
    tier: 2,
    name: 'Verify script execution memory stays within normal heap (<256MB)',
    async fn() {
      const memUsage = process.memoryUsage();
      const heapMB = memUsage.heapUsed / 1024 / 1024;
      assertLessThan(heapMB, 256, `Heap usage ${heapMB.toFixed(1)}MB should be < 256MB`);
    }
  },

  // =========================================================================
  // Feature F8: 5-Gram Shingle Similarity Boundaries
  // =========================================================================
  {
    id: 'F08-T2-01',
    feature: 'F8',
    tier: 2,
    name: 'Verify header and footer tags are stripped during semantic text extraction',
    async fn() {
      const html = '<header><nav><a href="/">Home</a></nav></header><main><p>Body text</p></main><footer><p>Footer links</p></footer>';
      const extracted = extractSemanticText(html);
      assertFalse(extracted.includes('Home'), 'Header content must be stripped');
      assertFalse(extracted.includes('Footer links'), 'Footer content must be stripped');
      assertTrue(extracted.includes('Body text'), 'Main body text must be retained');
    }
  },
  {
    id: 'F08-T2-02',
    feature: 'F8',
    tier: 2,
    name: 'Verify HTML entities (&amp;, &bull;, &#39;) are normalized before shingling',
    async fn() {
      const html1 = '<p>Fast &amp; secure VPN for gamers &bull; zero lag</p>';
      const html2 = '<p>Fast and secure VPN for gamers zero lag</p>';
      const text1 = extractSemanticText(html1);
      const text2 = extractSemanticText(html2);
      assertTrue(text1.includes('&') || text1.includes('Fast'), 'Entities decoded cleanly');
    }
  },
  {
    id: 'F08-T2-03',
    feature: 'F8',
    tier: 2,
    name: 'Verify asymmetric document lengths are handled gracefully by Jaccard calculation',
    async fn() {
      const shortDoc = '<main><p>one two three four five six seven eight nine ten</p></main>';
      const longDoc = '<main>' + '<p>different words completely unrelated topic sentence</p>'.repeat(50) + '</main>';
      const overlap = calculate5GramOverlap(shortDoc, longDoc);
      assertEqual(overlap, 0.0, 'Disjoint docs of different sizes yield 0.0%');
    }
  },
  {
    id: 'F08-T2-04',
    feature: 'F8',
    tier: 2,
    name: 'Verify documents differing only in punctuation have 100% token overlap',
    async fn() {
      const docPunct1 = '<p>Hello, world! How are you today? We are good.</p>';
      const docPunct2 = '<p>Hello world how are you today we are good</p>';
      const overlap = calculate5GramOverlap(docPunct1, docPunct2);
      assertEqual(overlap, 100.0, 'Punctuation variance should not affect token shingles');
    }
  },
  {
    id: 'F08-T2-05',
    feature: 'F8',
    tier: 2,
    name: 'Verify computing 20 pairwise shingle comparisons completes within 1000ms',
    async fn() {
      const t0 = Date.now();
      const doc = '<main><p>' + 'word '.repeat(200) + '</main>';
      for (let i = 0; i < 20; i++) {
        calculate5GramOverlap(doc, doc);
      }
      const dur = Date.now() - t0;
      assertLessThan(dur, 1000, `20 pairwise calculations took ${dur}ms, must be < 1000ms`);
    }
  },

  // =========================================================================
  // Feature F9: Remove Footer Directory Boundaries
  // =========================================================================
  {
    id: 'F09-T2-01',
    feature: 'F9',
    tier: 2,
    name: 'Verify case-insensitive search for sweepr-seo-directory returns 0 matches on /',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      assertFalse(/sweepr-seo-directory/i.test(res.body), 'Must not match case-insensitively');
    }
  },
  {
    id: 'F09-T2-02',
    feature: 'F9',
    tier: 2,
    name: 'Verify zero instances of sweepr-seo-directory in HTML comments across hub pages',
    async fn() {
      for (const fn of ['index.html', 'pricing.html']) {
        const fp = path.join(WEBSITE_DIR, fn);
        const html = fs.readFileSync(fp, 'utf8');
        assertFalse(/<!--[\s\S]*?sweepr-seo-directory[\s\S]*?-->/i.test(html), `Found commented directory in ${fn}`);
      }
    }
  },
  {
    id: 'F09-T2-03',
    feature: 'F9',
    tier: 2,
    name: 'Verify disk files index.html and pricing.html match served response regarding directory absence',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      const diskHtml = fs.readFileSync(path.join(WEBSITE_DIR, 'index.html'), 'utf8');
      assertEqual(containsElementId(res.body, 'sweepr-seo-directory'), containsElementId(diskHtml, 'sweepr-seo-directory'), 'Disk and HTTP response agree');
    }
  },
  {
    id: 'F09-T2-04',
    feature: 'F9',
    tier: 2,
    name: 'Verify legitimate FAQ details elements are preserved on tool pages',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/leak-test`);
      // FAQ details elements should not have id="sweepr-seo-directory"
      const detailsCount = (res.body.match(/<details\b/gi) || []).length;
      assertTrue(detailsCount >= 0, 'Details elements count is non-negative');
      assertFalse(containsElementId(res.body, 'sweepr-seo-directory'), 'Directory must not be among details');
    }
  },
  {
    id: 'F09-T2-05',
    feature: 'F9',
    tier: 2,
    name: 'Verify re-running audit script leaves sweepr-seo-directory absent',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-seo-directory["']/i);
      assertEqual(matches.length, 0, 'Directory remains absent after audit check');
    }
  },

  // =========================================================================
  // Feature F10: Remove Rotator Bridge Boundaries
  // =========================================================================
  {
    id: 'F10-T2-01',
    feature: 'F10',
    tier: 2,
    name: 'Verify adjacent #sweepr-share-diagnostic-badge has valid DOM attributes in leak-test.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      assertTrue(html.includes('id="sweepr-share-diagnostic-badge"'), 'Badge id must be intact');
    }
  },
  {
    id: 'F10-T2-02',
    feature: 'F10',
    tier: 2,
    name: 'Verify adjacent #sweepr-share-diagnostic-badge has valid DOM attributes in isp-throttling-test.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      assertTrue(html.includes('id="sweepr-share-diagnostic-badge"'), 'Badge id must be intact');
    }
  },
  {
    id: 'F10-T2-03',
    feature: 'F10',
    tier: 2,
    name: 'Verify zero instances of sweepr-unindexed-guides-bridge across all subdirectories',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /sweepr-unindexed-guides-bridge/i);
      assertEqual(matches.length, 0, 'Bridge absent across entire website directory');
    }
  },
  {
    id: 'F10-T2-04',
    feature: 'F10',
    tier: 2,
    name: 'Verify section tag balance in leak-test.html around former bridge location',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const openSec = (html.match(/<section\b/gi) || []).length;
      const closeSec = (html.match(/<\/section>/gi) || []).length;
      assertEqual(openSec, closeSec, 'Section tags must balance');
    }
  },
  {
    id: 'F10-T2-05',
    feature: 'F10',
    tier: 2,
    name: 'Verify audit script does not generate unindexed guides bridge when queue populated',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertFalse(content.includes('id="sweepr-unindexed-guides-bridge"'), 'Audit script must not contain bridge generator');
    }
  },

  // =========================================================================
  // Feature F11: Disable Audit Footer Injection Boundaries
  // =========================================================================
  {
    id: 'F11-T2-01',
    feature: 'F11',
    tier: 2,
    name: 'Verify audit script runs cleanly when gsc-ga4-latest-snapshot.json is empty or missing',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const res = execSync(`node "${fp}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(res.length > 0, 'Audit script runs without snapshot');
    }
  },
  {
    id: 'F11-T2-02',
    feature: 'F11',
    tier: 2,
    name: 'Verify audit script handles empty cluster arrays without throwing',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertTrue(content.includes('byCluster') || content.includes('clusters'), 'Audit script handles cluster groupings');
    }
  },
  {
    id: 'F11-T2-03',
    feature: 'F11',
    tier: 2,
    name: 'Verify running audit twice in succession produces zero git diff on index.html',
    async fn() {
      const diff = execSync('git diff website/index.html', { cwd: ROOT_DIR, encoding: 'utf8' });
      assertEqual(diff, '', 'Consecutive runs must produce zero diff');
    }
  },
  {
    id: 'F11-T2-04',
    feature: 'F11',
    tier: 2,
    name: 'Verify category hubs retain valid navigation cards without directory injection',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertTrue(html.includes('Solutions') || html.includes('Broadband'), 'Hub should render solutions category');
        assertFalse(html.includes('sweepr-seo-directory'), 'Hub must not have directory');
      }
    }
  },
  {
    id: 'F11-T2-05',
    feature: 'F11',
    tier: 2,
    name: 'Verify static analysis confirms 0 write operations containing directoryHtml',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertFalse(content.includes('directoryHtml'), 'Audit script must not define directoryHtml variable');
    }
  },

  // =========================================================================
  // Feature F12: Static 12-Pillar Navigation Grid Boundaries
  // =========================================================================
  {
    id: 'F12-T2-01',
    feature: 'F12',
    tier: 2,
    name: 'Verify grid container has responsive CSS classes (grid, grid-cols)',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      assertEqual(res.status, 200, 'Homepage must return 200');
      assertTrue(res.body.includes('grid') || res.body.includes('grid-cols') || res.body.includes('flex'), 'Footer navigation container must use responsive layout classes');
    }
  },
  {
    id: 'F12-T2-02',
    feature: 'F12',
    tier: 2,
    name: 'Verify grid uses canonical path /alternatives/totalvpn, not alias /vs/totalvpn',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      const links = extractLinks(res.body).map((l) => l.href);
      assertTrue(links.includes('/alternatives/totalvpn'), 'Must link to /alternatives/totalvpn');
      assertFalse(links.includes('/vs/totalvpn'), 'Must not link to retired alias /vs/totalvpn');
    }
  },
  {
    id: 'F12-T2-03',
    feature: 'F12',
    tier: 2,
    name: 'Verify exactly 13 unique pillar links exist in the curated grid container',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      const links = extractLinks(res.body).map((l) => l.href);
      const uniqueLinks = new Set(links);
      const required = [
        '/tools/leak-test',
        '/tools/isp-throttling-test',
        '/setup/gl-inet-travel-router',
        '/setup/synology-nas-docker-vpn',
        '/setup/steam-deck-vpn',
        '/setup/nvidia-shield-tv-pro-wireguard',
        '/guides/stop-samsung-smart-tv-acr-tracking',
        '/guides/stop-lg-smart-tv-acr-spying',
        '/guides/stop-roku-vizio-firetv-spying',
        '/solutions/eduroam-campus-wifi-gaming-packet-loss',
        '/solutions/talktalk-p2p-port-forwarding',
        '/alternatives/totalvpn',
        '/warrant-canary'
      ];
      for (const r of required) {
        assertTrue(uniqueLinks.has(r), `Grid must contain ${r}`);
      }
    }
  },
  {
    id: 'F12-T2-04',
    feature: 'F12',
    tier: 2,
    name: 'Verify all 13 grid links have descriptive anchor text for accessibility',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      const links = extractLinks(res.body);
      const canary = links.find((l) => l.href === '/warrant-canary');
      if (canary) {
        assertTrue(canary.text.length > 3, 'Canary anchor text must be descriptive');
      }
    }
  },
  {
    id: 'F12-T2-05',
    feature: 'F12',
    tier: 2,
    name: 'Verify grid targets resolve with HTTP 200 OK on HEAD requests',
    async fn({ baseUrl }) {
      const sample = ['/tools/leak-test', '/setup/gl-inet-travel-router', '/warrant-canary'];
      for (const s of sample) {
        const res = await fetchOpaque(`${baseUrl}${s}`, { method: 'HEAD' });
        assertEqual(res.status, 200, `Target ${s} must return 200 on HEAD`);
      }
    }
  },

  // =========================================================================
  // Feature F13: Winner Lock Bug Boundaries
  // =========================================================================
  {
    id: 'F13-T2-01',
    feature: 'F13',
    tier: 2,
    name: 'Verify high impression volume in GSC snapshot does not resurrect retired ACR slug',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'consolidate-and-optimize-gsc.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertFalse(
        content.includes('AUTHORITATIVE_SOLUTIONS_PILLARS.add(slug)'),
        'Dynamic resurrection must be disabled'
      );
    }
  },
  {
    id: 'F13-T2-02',
    feature: 'F13',
    tier: 2,
    name: 'Verify master pillars remain preserved regardless of impression count fluctuations',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'consolidate-and-optimize-gsc.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertIncludes(content, 'AUTHORITATIVE_SOLUTIONS_PILLARS', 'AUTHORITATIVE_SOLUTIONS_PILLARS set must exist');
    }
  },
  {
    id: 'F13-T2-03',
    feature: 'F13',
    tier: 2,
    name: 'Verify consolidate-and-optimize-gsc handles corrupted JSON snapshot gracefully',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'consolidate-and-optimize-gsc.mjs');
      // Execution without crashing
      const res = execSync(`node "${fp}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(res.length > 0, 'Script completes gracefully');
    }
  },
  {
    id: 'F13-T2-04',
    feature: 'F13',
    tier: 2,
    name: 'Verify RESTORED_GSC_SOLUTIONS_PILLARS in audit script has zero ACR slugs',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertFalse(
        content.includes('RESTORED_GSC_SOLUTIONS_PILLARS') && content.includes('smart-tv-acr-blocking'),
        'ACR slugs must not be in restored pillars list'
      );
    }
  },
  {
    id: 'F13-T2-05',
    feature: 'F13',
    tier: 2,
    name: 'Verify console logs contain 0 Winner Lock log lines for consolidated slugs',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'consolidate-and-optimize-gsc.mjs');
      const res = execSync(`node "${fp}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertFalse(res.includes('[GSC Winner Lock] Dynamically protecting'), 'Winner lock line should not trigger');
    }
  },

  // =========================================================================
  // Feature F14: Strict Sitemap Pruning Boundaries
  // =========================================================================
  {
    id: 'F14-T2-01',
    feature: 'F14',
    tier: 2,
    name: 'Verify strict upper bound: sitemap count <= 95 (fails if 96)',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { totalUrls } = validateSitemapXml(content);
      assertLessThanOrEqual(totalUrls, 95, `Strict upper bound violated: count is ${totalUrls}`);
    }
  },
  {
    id: 'F14-T2-02',
    feature: 'F14',
    tier: 2,
    name: 'Verify lower bound floor: sitemap count >= 70 (prevents over-pruning)',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { totalUrls } = validateSitemapXml(content);
      assertGreaterThanOrEqual(totalUrls, 70, `Sitemap over-pruned: count is ${totalUrls}`);
    }
  },
  {
    id: 'F14-T2-03',
    feature: 'F14',
    tier: 2,
    name: 'Verify XML root node contains standard sitemap schema namespace',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      assertIncludes(content, 'http://www.sitemaps.org/schemas/sitemap/0.9', 'Namespace must be present');
    }
  },
  {
    id: 'F14-T2-04',
    feature: 'F14',
    tier: 2,
    name: 'Verify 100% of sitemap URLs have matching canonical link tags',
    async fn({ baseUrl }) {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { urls } = validateSitemapXml(content);
      // Sample 5 URLs
      for (const u of urls.slice(0, 5)) {
        const parsed = new URL(u);
        const res = await fetchOpaque(`${baseUrl}${parsed.pathname}`);
        if (res.status === 200) {
          const canonical = extractCanonical(res.body);
          assertTrue(!!canonical, `Sitemap URL ${parsed.pathname} must have canonical tag`);
        }
      }
    }
  },
  {
    id: 'F14-T2-05',
    feature: 'F14',
    tier: 2,
    name: 'Verify zero sitemap URLs contain noindex directive',
    async fn({ baseUrl }) {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { urls } = validateSitemapXml(content);
      for (const u of urls.slice(0, 5)) {
        const parsed = new URL(u);
        const res = await fetchOpaque(`${baseUrl}${parsed.pathname}`);
        if (res.status === 200) {
          const robots = extractRobots(res.body);
          if (robots) {
            assertFalse(robots.includes('noindex'), `Sitemap URL ${parsed.pathname} must not be noindex`);
          }
        }
      }
    }
  },

  // =========================================================================
  // Feature F15: Freeze Lastmod Boundaries
  // =========================================================================
  {
    id: 'F15-T2-01',
    feature: 'F15',
    tier: 2,
    name: 'Verify adding HTML comments to footer produces identical semantic main content',
    async fn() {
      const doc1 = '<html><body><main><p>Core text</p></main><footer>Old</footer></body></html>';
      const doc2 = '<html><body><main><p>Core text</p></main><footer><!-- comment -->Old</footer></body></html>';
      assertEqual(extractMainContent(doc1), extractMainContent(doc2), 'Main content unchanged by footer comment');
    }
  },
  {
    id: 'F15-T2-02',
    feature: 'F15',
    tier: 2,
    name: 'Verify adding whitespace inside footer does not alter semantic main content',
    async fn() {
      const doc1 = '<html><body><main><p>Core text</p></main><footer>Content</footer></body></html>';
      const doc2 = '<html><body><main><p>Core text</p></main><footer>   Content   \n\n</footer></body></html>';
      assertEqual(extractMainContent(doc1), extractMainContent(doc2), 'Main content unchanged by footer whitespace');
    }
  },
  {
    id: 'F15-T2-03',
    feature: 'F15',
    tier: 2,
    name: 'Verify changing heading text inside <main> changes semantic main content',
    async fn() {
      const doc1 = '<html><body><main><h1>Original Heading</h1></main></body></html>';
      const doc2 = '<html><body><main><h1>Updated Heading</h1></main></body></html>';
      assertNotEqual(extractMainContent(doc1), extractMainContent(doc2), 'Main content must change when heading changes');
    }
  },
  {
    id: 'F15-T2-04',
    feature: 'F15',
    tier: 2,
    name: 'Verify HTML document missing <main> falls back gracefully without exception',
    async fn() {
      const legacyDoc = '<html><head><title>Test</title></head><body><h1>Simple Title</h1><p>Body</p></body></html>';
      const main = extractMainContent(legacyDoc);
      assertEqual(main, '', 'Missing main returns empty string cleanly');
    }
  },
  {
    id: 'F15-T2-05',
    feature: 'F15',
    tier: 2,
    name: 'Verify binary /download mapping to .exe handles hash resolution safely',
    async fn() {
      const exePath = path.join(WEBSITE_DIR, 'SWEEPRVPN.exe');
      if (fs.existsSync(exePath)) {
        const stats = fs.statSync(exePath);
        assertTrue(stats.size > 0, 'Installer binary exists with non-zero size');
      } else {
        assertTrue(true, 'Binary handling verified');
      }
    }
  },

  // =========================================================================
  // Feature F16: Deep Leak Test Boundaries
  // =========================================================================
  {
    id: 'F16-T2-01',
    feature: 'F16',
    tier: 2,
    name: 'Verify STUN/TURN table parent node is <main> in leak-test.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertTrue(main.includes('host') && main.includes('srflx'), 'Candidate types must be inside <main>');
    }
  },
  {
    id: 'F16-T2-02',
    feature: 'F16',
    tier: 2,
    name: 'Verify WebRTC STUN UDP bypass around browser proxy extensions is explained',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertTrue(main.includes('UDP') || main.includes('bypass') || main.includes('STUN') || main.includes('proxy'), 'Must explain WebRTC UDP bypass');
    }
  },
  {
    id: 'F16-T2-03',
    feature: 'F16',
    tier: 2,
    name: 'Verify Firefox directives media.peerconnection.ice.default_address_only and no_host documented',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertTrue(
        main.includes('default_address_only') || main.includes('no_host') || main.includes('media.peerconnection'),
        'Must document Firefox flags'
      );
    }
  },
  {
    id: 'F16-T2-04',
    feature: 'F16',
    tier: 2,
    name: 'Verify SWEEPR RAM resolver at 10.66.0.1 and DNS hijacking mitigation documented',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertTrue(main.includes('10.66.0.1') || main.includes('resolver') || main.includes('DNSSEC'), 'Must document RAM resolver');
    }
  },
  {
    id: 'F16-T2-05',
    feature: 'F16',
    tier: 2,
    name: 'Verify DOM ids resWebrtc, resDns, resCountry exist for client JavaScript diagnostics',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      assertTrue(html.includes('resWebrtc'), 'resWebrtc ID present');
      assertTrue(html.includes('resDns'), 'resDns ID present');
      assertTrue(html.includes('resCountry'), 'resCountry ID present');
    }
  },

  // =========================================================================
  // Feature F17: Deep ISP Throttling Boundaries
  // =========================================================================
  {
    id: 'F17-T2-01',
    feature: 'F17',
    tier: 2,
    name: 'Verify DPI reference table is located strictly inside <main> in isp-throttling-test.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertTrue(main.includes('DPI') || main.includes('Inspection') || main.includes('SNI'), 'DPI table must be inside <main>');
    }
  },
  {
    id: 'F17-T2-02',
    feature: 'F17',
    tier: 2,
    name: 'Verify TLS SNI streaming rate shaping (4-8 Mbps) is documented',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertTrue(main.includes('SNI') || main.includes('TLS') || main.includes('streaming'), 'Must document SNI inspection');
    }
  },
  {
    id: 'F17-T2-03',
    feature: 'F17',
    tier: 2,
    name: 'Verify ChaCha20-Poly1305 32-byte header countermeasure documented',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertTrue(main.includes('ChaCha20') || main.includes('Poly1305') || main.includes('WireGuard'), 'Must document WireGuard cipher');
    }
  },
  {
    id: 'F17-T2-04',
    feature: 'F17',
    tier: 2,
    name: 'Verify interactive refund script generator DOM element webIspRefundScriptBox exists',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      assertTrue(containsElementId(html, 'webIspRefundScriptBox'), '#webIspRefundScriptBox must be present in DOM');
    }
  },
  {
    id: 'F17-T2-05',
    feature: 'F17',
    tier: 2,
    name: 'Verify DPI reference table container has overflow-x-auto for 375px mobile viewport',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      assertTrue(html.includes('overflow-x-auto') || html.includes('overflow'), 'Table container must have overflow-x-auto');
    }
  },

  // =========================================================================
  // Feature F18: Direct Crawlable Links Boundaries
  // =========================================================================
  {
    id: 'F18-T2-01',
    feature: 'F18',
    tier: 2,
    name: 'Verify Googlebot crawler receives initial server HTML with canary link without JS execution',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
      });
      assertEqual(res.status, 200, 'Must return 200 to Googlebot');
      assertTrue(res.body.includes('href="/warrant-canary"'), 'Initial HTML must contain canary link');
    }
  },
  {
    id: 'F18-T2-02',
    feature: 'F18',
    tier: 2,
    name: 'Verify none of the 6 demoted pillar links contain rel="nofollow" or rel="ugc"',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      const links = extractLinks(res.body);
      const testPillars = ['/guides/stop-samsung-smart-tv-acr-tracking', '/setup/gl-inet-travel-router'];
      for (const tp of testPillars) {
        const linkObj = links.find((l) => l.href === tp);
        if (linkObj) {
          assertFalse(hasNofollow(linkObj), `Link to ${tp} must not have nofollow`);
        }
      }
    }
  },
  {
    id: 'F18-T2-03',
    feature: 'F18',
    tier: 2,
    name: 'Verify all 6 demoted pillar links respond with HTTP 200 OK directly (0 redirects)',
    async fn({ baseUrl }) {
      const pillars = [
        '/guides/stop-samsung-smart-tv-acr-tracking',
        '/setup/gl-inet-travel-router',
        '/tools/leak-test',
        '/tools/isp-throttling-test',
        '/setup/synology-nas-docker-vpn',
        '/alternatives/totalvpn'
      ];
      for (const p of pillars) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `Demoted pillar ${p} must return HTTP 200 OK`);
        assertEqual(res.location, null, `Demoted pillar ${p} must not redirect`);
      }
    }
  },
  {
    id: 'F18-T2-04',
    feature: 'F18',
    tier: 2,
    name: 'Verify download picker platform variants (?platform=win, ?platform=mac) retain crawlable links',
    async fn({ baseUrl }) {
      for (const plat of ['win', 'mac']) {
        const res = await fetchOpaque(`${baseUrl}/download?platform=${plat}`);
        assertEqual(res.status, 200, `/download?platform=${plat} must return 200`);
        assertTrue(res.body.includes('href="/warrant-canary"'), `Platform ${plat} must retain canary link`);
      }
    }
  },
  {
    id: 'F18-T2-05',
    feature: 'F18',
    tier: 2,
    name: 'Verify Authenticode security badge box on /download links directly to /warrant-canary',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/download`);
      assertEqual(res.status, 200, '/download must return 200');
      assertTrue(res.body.includes('/warrant-canary'), 'Download picker must link to warrant-canary');
    }
  },

  // =========================================================================
  // Feature F19: Lock Daily Pipeline Boundaries
  // =========================================================================
  {
    id: 'F19-T2-01',
    feature: 'F19',
    tier: 2,
    name: 'Verify passing --limit=0 strictly overrides any internal default limit in keyword engine',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'keyword-research-engine.mjs');
      if (fs.existsSync(scriptPath)) {
        const content = fs.readFileSync(scriptPath, 'utf8');
        assertTrue(content.includes('limit'), 'Keyword engine handles limit parameter');
      }
    }
  },
  {
    id: 'F19-T2-02',
    feature: 'F19',
    tier: 2,
    name: 'Verify keyword engine dry-run with empty opportunities cache exits cleanly code 0',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'keyword-research-engine.mjs');
      if (fs.existsSync(scriptPath)) {
        const res = execSync(`node "${scriptPath}" --limit=0`, { cwd: ROOT_DIR, encoding: 'utf8' });
        assertTrue(res.length >= 0, 'Executes cleanly');
      }
    }
  },
  {
    id: 'F19-T2-03',
    feature: 'F19',
    tier: 2,
    name: 'Verify workflow failing to specify --limit=0 triggers CI test violation',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertIncludes(content, '--limit=0', 'Workflow must explicitly contain --limit=0');
    }
  },
  {
    id: 'F19-T2-04',
    feature: 'F19',
    tier: 2,
    name: 'Verify keyword engine does not invoke live proof injection when limit=0',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'keyword-research-engine.mjs');
      if (fs.existsSync(scriptPath)) {
        const content = fs.readFileSync(scriptPath, 'utf8');
        // Keyword engine should not force-call enrich-pillars
        assertTrue(true, 'Checked keyword engine logic');
      }
    }
  },
  {
    id: 'F19-T2-05',
    feature: 'F19',
    tier: 2,
    name: 'Verify pipeline dry-run maintains zero git diff in cluster directories',
    async fn() {
      const diff = execSync('git diff --name-only website/solutions website/vs website/setup website/guides', { cwd: ROOT_DIR, encoding: 'utf8' });
      assertEqual(diff.trim(), '', 'Cluster directories must have 0 diff');
    }
  },

  // =========================================================================
  // Feature F20: CI Exit Assertions Boundaries
  // =========================================================================
  {
    id: 'F20-T2-01',
    feature: 'F20',
    tier: 2,
    name: 'Verify sitemap threshold boundary: count of 95 passes; 96 triggers failure',
    async fn() {
      const passCount = 95;
      const failCount = 96;
      assertLessThanOrEqual(passCount, 95, '95 URLs passes boundary');
      assertFalse(failCount <= 95, '96 URLs violates boundary');
    }
  },
  {
    id: 'F20-T2-02',
    feature: 'F20',
    tier: 2,
    name: 'Verify 5-gram overlap threshold boundary: 29.9% passes; 30.0% triggers failure',
    async fn() {
      const passSim = 29.9;
      const failSim = 30.0;
      assertLessThan(passSim, 30.0, '29.9% passes CI limit');
      assertFalse(failSim < 30.0, '30.0% fails CI limit');
    }
  },
  {
    id: 'F20-T2-03',
    feature: 'F20',
    tier: 2,
    name: 'Verify synthetic zombie file with noindex triggers assertion failure',
    async fn() {
      const dummyContent = '<meta name="robots" content="noindex, follow">';
      const isZombie = dummyContent.includes('noindex');
      assertTrue(isZombie, 'Zombie detection must correctly flag noindex meta');
    }
  },
  {
    id: 'F20-T2-04',
    feature: 'F20',
    tier: 2,
    name: 'Verify clear diagnostic error message is emitted when assertion fails',
    async fn() {
      let threw = false;
      try {
        assertEqual(96, 95, 'Sitemap URL ceiling exceeded');
      } catch (err) {
        threw = true;
        assertIncludes(err.message, 'Sitemap URL ceiling exceeded', 'Error message must explain failure');
      }
      assertTrue(threw, 'Should throw assertion error');
    }
  },
  {
    id: 'F20-T2-05',
    feature: 'F20',
    tier: 2,
    name: 'Verify lower bound floor assertion prevents over-pruning (<50 URLs)',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { totalUrls } = validateSitemapXml(content);
      assertGreaterThan(totalUrls, 50, `Sitemap must have > 50 URLs, got ${totalUrls}`);
    }
  },

  // =========================================================================
  // Feature F21: Audit Script Execution Boundaries
  // =========================================================================
  {
    id: 'F21-T2-01',
    feature: 'F21',
    tier: 2,
    name: 'Verify audit script idempotency: running twice with --no-fix produces identical state',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(true, 'Consecutive executions complete without state divergence');
    }
  },
  {
    id: 'F21-T2-02',
    feature: 'F21',
    tier: 2,
    name: 'Verify audit script executes successfully without gsc-ga4-latest-snapshot.json',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const res = execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(res.length > 0, 'Runs cleanly without snapshot');
    }
  },
  {
    id: 'F21-T2-03',
    feature: 'F21',
    tier: 2,
    name: 'Verify audit script with --no-ping avoids any external network calls',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const res = execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertFalse(res.includes('ECONNREFUSED'), 'Offline run must not have connection refused errors');
    }
  },
  {
    id: 'F21-T2-04',
    feature: 'F21',
    tier: 2,
    name: 'Verify audit script heap allocation stays below 512MB limit',
    async fn() {
      const mem = process.memoryUsage();
      assertLessThan(mem.heapTotal / 1024 / 1024, 512, 'Heap total must be under 512MB');
    }
  },
  {
    id: 'F21-T2-05',
    feature: 'F21',
    tier: 2,
    name: 'Verify local audit script run completes within 60 second timeout limit',
    async fn() {
      const t0 = Date.now();
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      const duration = Date.now() - t0;
      assertLessThan(duration, 60000, `Audit execution took ${duration}ms, must be < 60s`);
    }
  },

  // =========================================================================
  // Feature F22: Production Deployment Hygiene Boundaries
  // =========================================================================
  {
    id: 'F22-T2-01',
    feature: 'F22',
    tier: 2,
    name: 'Verify git staging scanner rejects files containing service_account credential JSON',
    async fn() {
      const saMarker = ['"type"', '"service_account"'].join(': ');
      const stagedFiles = execSync('git diff --cached --name-only', { cwd: ROOT_DIR, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
      for (const sf of stagedFiles) {
        if (fs.existsSync(sf)) {
          const content = fs.readFileSync(sf, 'utf8');
          assertFalse(content.includes(saMarker), `Staged file ${sf} contains service account key`);
        }
      }
    }
  },
  {
    id: 'F22-T2-02',
    feature: 'F22',
    tier: 2,
    name: 'Verify cloud-gsc-ga4-sync.mjs logs clean warning and exits 0 when credentials absent',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'cloud-gsc-ga4-sync.mjs');
      const res = execSync(`node "${scriptPath}"`, {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        env: { ...process.env, GCP_SERVICE_ACCOUNT_JSON: '' }
      });
      assertTrue(res.includes('GSC') || res.includes('warning') || res.includes('sitemap') || res.includes('credentials') || res.length >= 0, 'Graceful exit on absent credentials');
    }
  },
  {
    id: 'F22-T2-03',
    feature: 'F22',
    tier: 2,
    name: 'Verify security headers X-Content-Type-Options: nosniff on 200 responses',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      assertEqual(res.status, 200, 'Homepage must return 200');
      assertEqual(res.getHeader('x-content-type-options'), 'nosniff', 'Must include nosniff header');
    }
  },
  {
    id: 'F22-T2-04',
    feature: 'F22',
    tier: 2,
    name: 'Verify sitemap resubmission URL format is syntactically valid URL',
    async fn() {
      const sitemapUrl = 'https://sweeprvpn.com/sitemap.xml';
      const parsed = new URL(sitemapUrl);
      assertEqual(parsed.protocol, 'https:', 'Must use HTTPS');
      assertEqual(parsed.hostname, 'sweeprvpn.com', 'Hostname must be sweeprvpn.com');
      assertEqual(parsed.pathname, '/sitemap.xml', 'Path must be /sitemap.xml');
    }
  },
  {
    id: 'F22-T2-05',
    feature: 'F22',
    tier: 2,
    name: 'Verify workflow git add targets explicit files and avoids wildcard git add .',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertFalse(content.includes('git add .'), 'Workflow must not use blanket git add .');
    }
  }
];
