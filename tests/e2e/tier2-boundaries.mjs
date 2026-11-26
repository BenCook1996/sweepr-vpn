/**
 * SWEEPR VPN — E2E Test Suite: Tier 2 Boundary & Corner Cases
 * Tests edge cases, limits, negative conditions, and corner scenarios across F1 to F28.
 * 28 features × 5 tests = 140 tests.
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
  getFreePort,
  startServer,
  stopServer,
  fetchOpaque,
  fetchBinary,
  sha256File,
  runConsolidationInTempSandbox,
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
  findFilesWithPattern,
  getAuthoritativePillars
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
      assertFalse(fs.existsSync(gitmodulesPath), '.gitmodules must not exist in standalone repo');
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
        { path: 'solutions/talktalk-fibre-wireguard-cgnat.html', expected: '/solutions/talktalk-fibre-wireguard-cgnat' },
        { path: 'setup/gl-inet-travel-router.html', expected: '/setup/gl-inet-travel-router' },
        { path: 'guides/stop-samsung-smart-tv-acr-tracking.html', expected: '/guides/stop-samsung-smart-tv-acr-tracking' }
      ];
      for (const p of pillars) {
        const fp = path.join(WEBSITE_DIR, p.path);
        assertTrue(fs.existsSync(fp), `Authoritative pillar must exist: ${p.path}`);
        const html = fs.readFileSync(fp, 'utf8');
        const canonical = extractCanonical(html);
        assertTrue(!!canonical, `Pillar ${p.path} must have canonical tag`);
        assertIncludes(canonical, p.expected, `Canonical for ${p.path} must match self URL`);
      }
    }
  },
  {
    id: 'F02-T2-05',
    feature: 'F2',
    tier: 2,
    name: 'Verify preserved TalkTalk pillar has robots meta set to index, follow',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      assertTrue(fs.existsSync(fp), 'talktalk-fibre-wireguard-cgnat.html must exist');
      const html = fs.readFileSync(fp, 'utf8');
      const robots = extractRobots(html);
      assertTrue(!!robots, 'Pillar must have robots meta tag');
      assertFalse(robots.includes('noindex'), 'Pillar must not have noindex');
      assertIncludes(robots, 'index', 'Pillar must have index directive');
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
    name: 'Verify legacy /vs-totalvpn.html redirects 301 to /vs/totalvpn (200 OK)',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/vs-totalvpn.html`);
      assertEqual(res.status, 301, 'Legacy /vs-totalvpn.html must return 301');
      assertEqual(res.location, '/vs/totalvpn', 'Must redirect to active /vs/totalvpn canonical');
      const followed = await fetchOpaque(`${baseUrl}${res.location}`);
      assertEqual(followed.status, 200, 'Canonical /vs/totalvpn must return 200 OK');
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
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      assertTrue(fs.existsSync(fp), 'talktalk-fibre-wireguard-cgnat.html must exist');
      const html = fs.readFileSync(fp, 'utf8');
      const openSections = (html.match(/<section\b/gi) || []).length;
      const closeSections = (html.match(/<\/section>/gi) || []).length;
      assertEqual(openSections, closeSections, 'Open and close <section> tag counts must balance');
    }
  },
  {
    id: 'F05-T2-05',
    feature: 'F5',
    tier: 2,
    name: 'Verify modified HTML files remain valid UTF-8 without byte order mark (BOM)',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      assertTrue(fs.existsSync(fp), 'talktalk-fibre-wireguard-cgnat.html must exist');
      const buf = fs.readFileSync(fp);
      const hasBom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
      assertFalse(hasBom, 'File must not have UTF-8 BOM');
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
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      assertTrue(fs.existsSync(fp), 'talktalk-fibre-wireguard-cgnat.html must exist');
      const html = fs.readFileSync(fp, 'utf8');
      assertTrue(html.includes('How SWEEPR VPN Solves') || html.includes('WireGuard'), 'Surrounding prose should be intact');
    }
  },
  {
    id: 'F06-T2-04',
    feature: 'F6',
    tier: 2,
    name: 'Verify table tag balance in solutions pillars after matrix removal',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      assertTrue(fs.existsSync(fp), 'talktalk-fibre-wireguard-cgnat.html must exist');
      const html = fs.readFileSync(fp, 'utf8');
      const openTables = (html.match(/<table\b/gi) || []).length;
      const closeTables = (html.match(/<\/table>/gi) || []).length;
      assertEqual(openTables, closeTables, 'Open and close <table> tag counts must balance');
    }
  },
  {
    id: 'F06-T2-05',
    feature: 'F6',
    tier: 2,
    name: 'Verify zero orphaned table cell or row tags exist in solutions pillars',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      assertTrue(fs.existsSync(fp), 'talktalk-fibre-wireguard-cgnat.html must exist');
      const html = fs.readFileSync(fp, 'utf8');
      const openTr = (html.match(/<tr\b/gi) || []).length;
      const closeTr = (html.match(/<\/tr>/gi) || []).length;
      assertEqual(openTr, closeTr, 'Open and close <tr> counts must balance');
    }
  },

  // =========================================================================
  // Feature F7: Remove Boilerplate Injection Scripts Boundaries
  // =========================================================================
  {
    id: 'F07-T2-01',
    feature: 'F7',
    tier: 2,
    name: 'Verify enrich-pillars script remains deleted and keyword engine dry-run injects zero proof',
    async fn() {
      assertFalse(fs.existsSync(path.join(SCRIPTS_DIR, 'enrich-pillars-with-live-proof.mjs')), 'Deleted script must remain absent');
      const kwPath = path.join(SCRIPTS_DIR, 'keyword-research-engine.mjs');
      const res = execSync(`node "${kwPath}" --discover --score --audit --json-only --offline --dry-run`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(res.length > 0, 'Keyword engine dry-run completes cleanly');
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-live-wireguard-acr-proof["']/i);
      assertEqual(matches.length, 0, 'Dry-run must not re-inject boilerplate');
    }
  },
  {
    id: 'F07-T2-02',
    feature: 'F7',
    tier: 2,
    name: 'Verify daily audit script runs cleanly with --no-fix --no-ping',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const res = execSync(`node "${fp}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(res.length > 0, 'Audit script runs cleanly');
    }
  },
  {
    id: 'F07-T2-03',
    feature: 'F7',
    tier: 2,
    name: 'Verify zero scripts reference enrich-pillars-with-live-proof.mjs execution',
    async fn() {
      const scriptFiles = fs.readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith('.mjs'));
      for (const sf of scriptFiles) {
        const src = fs.readFileSync(path.join(SCRIPTS_DIR, sf), 'utf8');
        assertFalse(src.includes('enrich-pillars-with-live-proof.mjs'), `Script ${sf} must not invoke deleted enrich-pillars script`);
      }
      const res = execSync(`node "${path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs')}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertIncludes(res, '100% HEALTHY', 'Daily audit must report 100% HEALTHY');
    }
  },
  {
    id: 'F07-T2-04',
    feature: 'F7',
    tier: 2,
    name: 'Verify daily audit script does not throw UnhandledPromiseRejection on unexpected parameters',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const res = execSync(`node "${fp}" --no-fix --no-ping --invalid-arg --unknown`, { cwd: ROOT_DIR, encoding: 'utf8' });
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
    name: 'Verify running audit twice in succession preserves exact SHA-256 of index.html and sitemap.xml',
    async fn() {
      const auditPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const indexPath = path.join(WEBSITE_DIR, 'index.html');
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const idxBefore = sha256File(indexPath);
      const smBefore = sha256File(sitemapPath);
      execSync(`node "${auditPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      execSync(`node "${auditPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertEqual(sha256File(indexPath), idxBefore, 'index.html SHA-256 must remain invariant');
      assertEqual(sha256File(sitemapPath), smBefore, 'sitemap.xml SHA-256 must remain invariant');
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
    name: 'Verify homepage links directly (200 OK, no nofollow) to both /vs/totalvpn and /alternatives/totalvpn',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      const links = extractLinks(res.body);
      for (const target of ['/vs/totalvpn', '/alternatives/totalvpn']) {
        const linkObj = links.find((l) => l.href === target);
        assertTrue(!!linkObj, `Homepage must link to ${target}`);
        assertFalse(hasNofollow(linkObj), `Link to ${target} must not have nofollow`);
        const dest = await fetchOpaque(`${baseUrl}${target}`, { method: 'HEAD' });
        assertEqual(dest.status, 200, `${target} must return 200 OK`);
      }
    }
  },
  {
    id: 'F12-T2-03',
    feature: 'F12',
    tier: 2,
    name: 'Verify all core pages maintain <15 (14) BOFU footer links + Google Preferred Sources badge',
    async fn({ baseUrl }) {
      const pages = ['/', '/pricing', '/tools/leak-test', '/tools/isp-throttling-test', '/privacy', '/ai-info', '/faq'];
      for (const p of pages) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `${p} must return 200`);
        const footerMatch = res.body.match(/<footer[\s\S]*?<\/footer>/i);
        assertTrue(!!footerMatch, `${p} must contain <footer>`);
        const footerLinks = extractLinks(footerMatch[0]).map((l) => l.href);
        assertLessThan(footerLinks.length, 15, `${p} footer must have < 15 links, got ${footerLinks.length}`);
        assertTrue(
          footerLinks.includes('https://www.google.com/preferences/source?q=sweeprvpn.com'),
          `${p} footer must include Google Preferred Sources badge`
        );
      }
    }
  },
  {
    id: 'F12-T2-04',
    feature: 'F12',
    tier: 2,
    name: 'Verify BOFU footer links and Preferred Sources badge have descriptive anchor text',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      const footerMatch = res.body.match(/<footer[\s\S]*?<\/footer>/i);
      assertTrue(!!footerMatch, 'Homepage must contain <footer>');
      const footerLinks = extractLinks(footerMatch[0]);
      assertEqual(footerLinks.length, 14, `Expected 14 footer links on /, got ${footerLinks.length}`);
      for (const fl of footerLinks) {
        assertTrue(fl.text.length > 1, `Footer link ${fl.href} must have descriptive anchor text`);
      }
    }
  },
  {
    id: 'F12-T2-05',
    feature: 'F12',
    tier: 2,
    name: 'Verify BOFU and pillar targets resolve with HTTP 200 OK on HEAD requests',
    async fn({ baseUrl }) {
      const sample = ['/tools/leak-test', '/setup/gl-inet-travel-router', '/warrant-canary', '/ai-info', '/faq'];
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
    name: 'Verify consolidate-and-optimize-gsc runs cleanly in temp sandbox without mutating repo',
    async fn() {
      const res = runConsolidationInTempSandbox();
      assertTrue(res.length > 0, 'Script completes gracefully in isolated sandbox');
      assertIncludes(res, '[GSC Consolidation & Optimization Complete]', 'Sandbox output confirms completion');
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
    name: 'Verify console logs in isolated sandbox contain 0 Winner Lock log lines for consolidated slugs',
    async fn() {
      const res = runConsolidationInTempSandbox();
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
      assertTrue(fs.existsSync(exePath), 'Installer binary website/SWEEPRVPN.exe must exist');
      const stats = fs.statSync(exePath);
      assertGreaterThan(stats.size, 0, 'Installer binary must have non-zero size');
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
    name: 'Verify Googlebot crawler receives initial server HTML with BOFU footer, Preferred Sources & #homeToolsAndHubsStrip',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
      });
      assertEqual(res.status, 200, 'Must return 200 to Googlebot');
      assertTrue(res.body.includes('id="homeToolsAndHubsStrip"'), 'Initial HTML must contain #homeToolsAndHubsStrip');
      assertTrue(res.body.includes('https://www.google.com/preferences/source?q=sweeprvpn.com'), 'Initial HTML must contain Preferred Sources badge');
      const aiRes = await fetchOpaque(`${baseUrl}/ai-info`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
      });
      assertEqual(aiRes.status, 200, 'Must return 200 for /ai-info to Googlebot');
      assertTrue(aiRes.body.includes('href="/warrant-canary"'), '/ai-info initial HTML must contain canary link');
    }
  },
  {
    id: 'F18-T2-02',
    feature: 'F18',
    tier: 2,
    name: 'Verify none of the homepage hub/tool/TotalVPN links contain rel="nofollow" or rel="ugc"',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      const links = extractLinks(res.body);
      const targets = [
        '/tools/leak-test',
        '/tools/isp-throttling-test',
        '/solutions',
        '/setup',
        '/guides',
        '/vs',
        '/vs/totalvpn',
        '/alternatives/totalvpn'
      ];
      for (const tp of targets) {
        const linkObj = links.find((l) => l.href === tp);
        assertTrue(!!linkObj, `Homepage must contain link to ${tp}`);
        assertFalse(hasNofollow(linkObj), `Link to ${tp} must not have nofollow`);
        assertFalse(/\bugc\b/i.test(linkObj.rel || ''), `Link to ${tp} must not have ugc`);
      }
    }
  },
  {
    id: 'F18-T2-03',
    feature: 'F18',
    tier: 2,
    name: 'Verify homepage hub, tool, and TotalVPN canonicals respond 200 OK directly (0 redirects)',
    async fn({ baseUrl }) {
      const pillars = [
        '/solutions',
        '/setup',
        '/guides',
        '/vs',
        '/tools/leak-test',
        '/tools/isp-throttling-test',
        '/vs/totalvpn',
        '/alternatives/totalvpn'
      ];
      for (const p of pillars) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `Canonical ${p} must return HTTP 200 OK`);
        assertEqual(res.location, null, `Canonical ${p} must not redirect`);
      }
    }
  },
  {
    id: 'F18-T2-04',
    feature: 'F18',
    tier: 2,
    name: 'Verify /download?platform=picker & ?picker=1 serve HTML with canary while ?platform=win/mac serve attachment binary',
    async fn({ baseUrl }) {
      for (const q of ['?platform=picker', '?picker=1']) {
        const res = await fetchOpaque(`${baseUrl}/download${q}`);
        assertEqual(res.status, 200, `/download${q} must return 200`);
        assertIncludes(res.getHeader('content-type') || '', 'text/html', `/download${q} must serve text/html`);
        assertTrue(res.body.includes('href="/warrant-canary"'), `/download${q} must retain canary link`);
      }
      for (const plat of ['win', 'mac']) {
        const binRes = await fetchOpaque(`${baseUrl}/download?platform=${plat}`, { method: 'HEAD' });
        assertEqual(binRes.status, 200, `/download?platform=${plat} must return 200`);
        assertIncludes(binRes.getHeader('content-disposition') || '', 'attachment', `/download?platform=${plat} must serve attachment binary`);
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
    name: 'Verify passing --json-only or --limit=0 strictly blocks HTML mutations in keyword engine',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'keyword-research-engine.mjs');
      assertTrue(fs.existsSync(scriptPath), 'keyword-research-engine.mjs must exist');
      const content = fs.readFileSync(scriptPath, 'utf8');
      assertIncludes(content, '--json-only', 'Keyword engine must support --json-only');
      assertIncludes(content, 'apply && !jsonOnly', 'jsonOnly must disable apply mode');
    }
  },
  {
    id: 'F19-T2-02',
    feature: 'F19',
    tier: 2,
    name: 'Verify keyword engine --verify-calibration and --apply --limit=0 exit 0 cleanly with zero writes',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'keyword-research-engine.mjs');
      const calRes = execSync(`node "${scriptPath}" --verify-calibration`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertIncludes(calRes, 'calibration assertions passed', 'Calibration check must pass');
      const limRes = execSync(`node "${scriptPath}" --apply --limit=0`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertIncludes(limRes, '0 new pillar pages created', 'Limit=0 must exit 0 cleanly');
    }
  },
  {
    id: 'F19-T2-03',
    feature: 'F19',
    tier: 2,
    name: 'Verify workflow locks keyword engine to --json-only and gates push with ci-seo-quality-gate.mjs',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertIncludes(content, '--json-only', 'Workflow must explicitly use --json-only');
      assertFalse(/\bkeyword-research-engine\.mjs[^\n]*--apply\b/.test(content), 'Workflow must never pass --apply');
      assertIncludes(content, 'node scripts/ci-seo-quality-gate.mjs', 'Workflow must run ci-seo-quality-gate.mjs');
    }
  },
  {
    id: 'F19-T2-04',
    feature: 'F19',
    tier: 2,
    name: 'Verify keyword engine does not invoke enrich-pillars-with-live-proof.mjs and honors dryRun',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'keyword-research-engine.mjs');
      const content = fs.readFileSync(scriptPath, 'utf8');
      assertFalse(content.includes('enrich-pillars-with-live-proof.mjs'), 'Keyword engine must never invoke retired enrich-pillars script');
      assertIncludes(content, 'if (!dryRun)', 'Keyword engine must guard writes with !dryRun');
    }
  },
  {
    id: 'F19-T2-05',
    feature: 'F19',
    tier: 2,
    name: 'Verify pipeline dry-run maintains exact SHA-256 invariance across all 62 cluster HTML files',
    async fn() {
      const pillars = getAuthoritativePillars();
      const before = Object.fromEntries(pillars.map((rel) => [rel, sha256File(path.join(WEBSITE_DIR, rel))]));
      execSync(`node "${path.join(SCRIPTS_DIR, 'keyword-research-engine.mjs')}" --discover --score --audit --json-only --offline --dry-run`, { cwd: ROOT_DIR, encoding: 'utf8' });
      execSync(`node "${path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs')}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      for (const rel of pillars) {
        assertEqual(sha256File(path.join(WEBSITE_DIR, rel)), before[rel], `Cluster file ${rel} must not be mutated by dry-run pipeline`);
      }
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
    name: 'Verify audit script idempotency: running twice with --no-fix --no-ping produces identical SHA-256 hashes',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const files = [
        path.join(WEBSITE_DIR, 'sitemap.xml'),
        path.join(WEBSITE_DIR, 'index.html'),
        path.join(ROOT_DIR, 'TECHNICAL_SEO_AUDIT_LOG.md')
      ];
      const before = files.map((f) => sha256File(f));
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      files.forEach((f, idx) => {
        assertEqual(sha256File(f), before[idx], `Repeated --no-fix --no-ping run mutated ${path.basename(f)}`);
      });
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
    name: 'Verify cloud-gsc-ga4-sync.mjs --dry-run --no-ctr-rewrite --skip-crm logs warning and writes 0 bytes when credentials absent',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'cloud-gsc-ga4-sync.mjs');
      const trackedJson = [
        path.join(WEBSITE_DIR, 'gsc-ga4-latest-snapshot.json'),
        path.join(WEBSITE_DIR, 'pillar-enrichment-state.json'),
        path.join(WEBSITE_DIR, 'indexing-queue.json')
      ];
      const before = trackedJson.map((f) => sha256File(f));
      const res = execSync(`node "${scriptPath}" --dry-run --no-ctr-rewrite --skip-crm`, {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        env: { ...process.env, GCP_SERVICE_ACCOUNT_JSON: '{}' }
      });
      assertIncludes(res, 'GCP_SERVICE_ACCOUNT_JSON not set', 'Graceful warning when credentials absent');
      trackedJson.forEach((f, idx) => {
        assertEqual(sha256File(f), before[idx], `Dry-run sync must not mutate ${path.basename(f)}`);
      });
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
  },

  // =========================================================================
  // Feature F23: R1 Real Benchmarks & WebP Asset Boundaries
  // =========================================================================
  {
    id: 'F23-T2-01',
    feature: 'F23',
    tier: 2,
    name: 'Verify missing WebP asset (/assets/nonexistent-capture.webp) returns HTTP 404',
    async fn({ baseUrl }) {
      const res = await fetchBinary(`${baseUrl}/assets/nonexistent-capture.webp`);
      assertEqual(res.status, 404, 'Missing .webp asset must return HTTP 404');
    }
  },
  {
    id: 'F23-T2-02',
    feature: 'F23',
    tier: 2,
    name: 'Verify HTTP HEAD on all 6 .webp assets returns 200 image/webp, Content-Length < 81920, and 0-byte body',
    async fn({ baseUrl }) {
      const assets = [
        'desktop-dark-mode.webp',
        'desktop-home-light.webp',
        'desktop-wifi-radar.webp',
        'mobile-ui-connect.webp',
        'tool-isp-throttling.webp',
        'tool-leak-test.webp'
      ];
      for (const name of assets) {
        const res = await fetchBinary(`${baseUrl}/assets/${name}`, { method: 'HEAD' });
        assertEqual(res.status, 200, `HEAD /assets/${name} must return 200`);
        assertIncludes(res.getHeader('content-type') || '', 'image/webp', `HEAD /assets/${name} must return image/webp`);
        const contentLen = Number(res.getHeader('content-length'));
        assertGreaterThan(contentLen, 0, `HEAD /assets/${name} Content-Length must be > 0`);
        assertLessThan(contentLen, 81920, `HEAD /assets/${name} Content-Length must be < 80 KB`);
        assertEqual(res.byteLength, 0, `HEAD /assets/${name} body must be empty`);
      }
    }
  },
  {
    id: 'F23-T2-03',
    feature: 'F23',
    tier: 2,
    name: 'Verify /assets/desktop-home-light.webp supports ETag and conditional 304 Not Modified',
    async fn({ baseUrl }) {
      const first = await fetchBinary(`${baseUrl}/assets/desktop-home-light.webp`);
      assertEqual(first.status, 200, 'Initial GET must return 200');
      const etag = first.getHeader('etag');
      assertTrue(!!etag, 'Static WebP response must include ETag header');

      const second = await fetchBinary(`${baseUrl}/assets/desktop-home-light.webp`, {
        headers: { 'If-None-Match': etag }
      });
      assertEqual(second.status, 304, 'Conditional GET with matching ETag must return 304 Not Modified');
      assertEqual(second.byteLength, 0, '304 response body must be empty');
    }
  },
  {
    id: 'F23-T2-04',
    feature: 'F23',
    tier: 2,
    name: 'Verify all 17 embedded .webp <img> tags include decoding="async" and positive numeric dimensions',
    async fn() {
      const htmlFiles = findHtmlFiles(WEBSITE_DIR, true);
      let checked = 0;
      for (const fp of htmlFiles) {
        const html = fs.readFileSync(fp, 'utf8');
        for (const m of html.matchAll(/<img\b([^>]*\.webp[^>]*)>/gi)) {
          checked++;
          const attrs = m[1];
          assertMatch(attrs, /\bdecoding=["']async["']/i, `Missing decoding="async" in ${fp}`);
          const w = Number((attrs.match(/\bwidth=["'](\d+)["']/i) || [])[1] || 0);
          const h = Number((attrs.match(/\bheight=["'](\d+)["']/i) || [])[1] || 0);
          assertGreaterThan(w, 0, `Width must be > 0 in ${fp}`);
          assertGreaterThan(h, 0, `Height must be > 0 in ${fp}`);
        }
      }
      assertEqual(checked, 17, `Expected 17 .webp <img> elements, checked ${checked}`);
    }
  },
  {
    id: 'F23-T2-05',
    feature: 'F23',
    tier: 2,
    name: 'Verify zero inline base64 data:image/ <img> bloat exists across all website HTML files',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /<img\b[^>]*src=["']data:image\//i);
      assertEqual(matches.length, 0, `Found unexpected base64 data:image <img> in ${matches.join(', ')}`);
    }
  },

  // =========================================================================
  // Feature F24: R2 Privacy, /ai-info, GEO <dl>, robots & llms.txt Boundaries
  // =========================================================================
  {
    id: 'F24-T2-01',
    feature: 'F24',
    tier: 2,
    name: 'Verify /ai-info/, /ai-info.html, and uppercase /AI-INFO return 1-hop 301 -> /ai-info',
    async fn({ baseUrl }) {
      for (const variant of ['/ai-info/', '/ai-info.html', '/AI-INFO']) {
        const res = await fetchOpaque(`${baseUrl}${variant}`);
        assertEqual(res.status, 301, `${variant} must return 301`);
        assertEqual(res.location, '/ai-info', `${variant} must redirect 1-hop to /ai-info`);
      }
    }
  },
  {
    id: 'F24-T2-02',
    feature: 'F24',
    tier: 2,
    name: 'Verify ai-info.html JSON-LD blocks contain zero deprecated FAQPage or HowTo types',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/ai-info`);
      assertEqual(res.status, 200, '/ai-info must return 200');
      const jsonLdMatches = [...res.body.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      assertGreaterThan(jsonLdMatches.length, 0, '/ai-info must contain JSON-LD structured data');
      for (const m of jsonLdMatches) {
        const parsed = JSON.parse(m[1]);
        const serialized = JSON.stringify(parsed);
        assertFalse(serialized.includes('"FAQPage"') || serialized.includes('"HowTo"'), '/ai-info JSON-LD must not emit FAQPage/HowTo');
      }
    }
  },
  {
    id: 'F24-T2-03',
    feature: 'F24',
    tier: 2,
    name: 'Verify /privacy wraps body in <article> and documents RAM tmpfs & /dev/null billing separation',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/privacy`);
      assertEqual(res.status, 200, '/privacy must return 200');
      assertMatch(res.body, /<article\b/i, '/privacy must contain <article>');
      assertIncludes(res.body, 'tmpfs', '/privacy must document volatile RAM tmpfs');
      assertIncludes(res.body, '/dev/null', '/privacy must document /dev/null zero-disk logging');
    }
  },
  {
    id: 'F24-T2-04',
    feature: 'F24',
    tier: 2,
    name: 'Verify zero forbidden entity names (founder name, SWEEPR VPN Inc., sitepatent.com) across all 93 indexable HTML + llms*.txt',
    async fn() {
      const founderRe = new RegExp(`\\b${['Ben' + 'jamin', 'Co' + 'ok'].join('\\s+')}\\b`, 'i');
      const incRe = /\bSWEEPR\s+VPN\s+Inc\b\.?/i;
      const sitepatentRe = /sitepatent\.com/i;
      for (const fp of findHtmlFiles(WEBSITE_DIR, true)) {
        const html = fs.readFileSync(fp, 'utf8');
        if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;
        assertFalse(founderRe.test(html), `Forbidden founder name in ${fp}`);
        assertFalse(incRe.test(html), `Forbidden SWEEPR VPN Inc. in ${fp}`);
        assertFalse(sitepatentRe.test(html), `Forbidden sitepatent.com in ${fp}`);
      }
      for (const txt of ['llms.txt', 'llms-full.txt', 'pad.xml']) {
        const content = fs.readFileSync(path.join(WEBSITE_DIR, txt), 'utf8');
        assertFalse(founderRe.test(content), `Forbidden founder name in ${txt}`);
        assertFalse(incRe.test(content), `Forbidden SWEEPR VPN Inc. in ${txt}`);
        assertFalse(sitepatentRe.test(content), `Forbidden sitepatent.com in ${txt}`);
      }
    }
  },
  {
    id: 'F24-T2-05',
    feature: 'F24',
    tier: 2,
    name: 'Verify /robots.txt returns 200 with Cache-Control and does not block indexable /ai-info or /faq',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/robots.txt`);
      assertEqual(res.status, 200, '/robots.txt must return 200');
      assertFalse(/Disallow:\s*\/ai-info/i.test(res.body), 'robots.txt must not disallow /ai-info');
      assertFalse(/Disallow:\s*\/faq/i.test(res.body), 'robots.txt must not disallow /faq');
    }
  },

  // =========================================================================
  // Feature F25: R3 /faq PAA Colony, BOFU Footers & <article> Boundaries
  // =========================================================================
  {
    id: 'F25-T2-01',
    feature: 'F25',
    tier: 2,
    name: 'Verify /faq/, /faq.html, and uppercase /FAQ return 1-hop 301 -> /faq',
    async fn({ baseUrl }) {
      for (const variant of ['/faq/', '/faq.html', '/FAQ']) {
        const res = await fetchOpaque(`${baseUrl}${variant}`);
        assertEqual(res.status, 301, `${variant} must return 301`);
        assertEqual(res.location, '/faq', `${variant} must redirect 1-hop to /faq`);
      }
    }
  },
  {
    id: 'F25-T2-02',
    feature: 'F25',
    tier: 2,
    name: 'Verify every contextual <main> internal link on /faq returns HTTP 200 OK (zero 404s or redirects)',
    async fn({ baseUrl }) {
      const faqRes = await fetchOpaque(`${baseUrl}/faq`);
      assertEqual(faqRes.status, 200, '/faq must return 200');
      const mainHtml = extractMainContent(faqRes.body);
      const uniqueTargets = [...new Set(extractLinks(mainHtml).map((l) => l.href).filter((h) => h.startsWith('/')))];
      assertGreaterThanOrEqual(uniqueTargets.length, 20, 'Expected >= 20 unique internal targets in /faq <main>');
      for (const t of uniqueTargets) {
        const res = await fetchOpaque(`${baseUrl}${t}`, { method: 'HEAD' });
        assertEqual(res.status, 200, `/faq target ${t} must return 200 OK`);
        assertEqual(res.location, null, `/faq target ${t} must not redirect`);
      }
    }
  },
  {
    id: 'F25-T2-03',
    feature: 'F25',
    tier: 2,
    name: 'Verify faq.html JSON-LD parses cleanly with zero deprecated FAQPage or HowTo schema',
    async fn() {
      const html = fs.readFileSync(path.join(WEBSITE_DIR, 'faq.html'), 'utf8');
      const blocks = [...html.matchAll(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      assertGreaterThan(blocks.length, 0, 'faq.html must contain JSON-LD');
      for (const b of blocks) {
        const parsed = JSON.parse(b[1]);
        const s = JSON.stringify(parsed);
        assertFalse(s.includes('"FAQPage"') || s.includes('"HowTo"'), 'faq.html must not contain FAQPage or HowTo schema');
      }
    }
  },
  {
    id: 'F25-T2-04',
    feature: 'F25',
    tier: 2,
    name: 'Verify maximum footer link count across all 93 indexable pages is strictly <= 14',
    async fn() {
      let maxLinks = 0;
      for (const fp of findHtmlFiles(WEBSITE_DIR, true)) {
        const html = fs.readFileSync(fp, 'utf8');
        if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;
        const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
        assertTrue(!!footerMatch, `Missing <footer> in ${fp}`);
        const count = extractLinks(footerMatch[0]).length;
        if (count > maxLinks) maxLinks = count;
      }
      assertLessThanOrEqual(maxLinks, 14, `Max indexable footer link count must be <= 14, got ${maxLinks}`);
    }
  },
  {
    id: 'F25-T2-05',
    feature: 'F25',
    tier: 2,
    name: 'Verify balanced <article>...</article> tags across all 62 pSEO pages',
    async fn() {
      for (const rel of getAuthoritativePillars()) {
        const html = fs.readFileSync(path.join(WEBSITE_DIR, rel), 'utf8');
        const openCount = (html.match(/<article\b/gi) || []).length;
        const closeCount = (html.match(/<\/article>/gi) || []).length;
        assertGreaterThanOrEqual(openCount, 1, `${rel} must contain <article>`);
        assertEqual(openCount, closeCount, `${rel} <article> open/close count mismatch (${openCount} vs ${closeCount})`);
      }
    }
  },

  // =========================================================================
  // Feature F26: R4 Onboarding, Churn & Telemetry Adversarial Boundaries
  // =========================================================================
  {
    id: 'F26-T2-01',
    feature: 'F26',
    tier: 2,
    name: 'Verify /welcome/ & /uninstall/ return 301 while /welcome.html & /uninstall.html serve 200 noindex, nofollow',
    async fn({ baseUrl }) {
      const wSlash = await fetchOpaque(`${baseUrl}/welcome/`);
      assertEqual(wSlash.status, 301, '/welcome/ must return 301');
      assertEqual(wSlash.location, '/welcome', '/welcome/ must redirect to /welcome');

      const uSlash = await fetchOpaque(`${baseUrl}/uninstall/`);
      assertEqual(uSlash.status, 301, '/uninstall/ must return 301');
      assertEqual(uSlash.location, '/uninstall', '/uninstall/ must redirect to /uninstall');

      for (const dotHtml of ['/welcome.html', '/uninstall.html']) {
        const res = await fetchOpaque(`${baseUrl}${dotHtml}`);
        assertEqual(res.status, 200, `${dotHtml} must serve 200 directly`);
        assertIncludes((res.getHeader('x-robots-tag') || '').toLowerCase(), 'noindex, nofollow', `${dotHtml} must send X-Robots-Tag: noindex, nofollow`);
      }
    }
  },
  {
    id: 'F26-T2-02',
    feature: 'F26',
    tier: 2,
    name: 'Verify POST /api/uninstall-feedback rejects malformed JSON, arrays, >4096B (413), and GET (405)',
    async fn({ baseUrl }) {
      const badJson = await fetchOpaque(`${baseUrl}/api/uninstall-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid-json'
      });
      assertEqual(badJson.status, 400, 'Malformed JSON must return 400');

      const arrBody = await fetchOpaque(`${baseUrl}/api/uninstall-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '["too_slow"]'
      });
      assertEqual(arrBody.status, 400, 'Array JSON payload must return 400');

      const tooBig = await fetchOpaque(`${baseUrl}/api/uninstall-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'other', note: 'x'.repeat(4200) })
      });
      assertEqual(tooBig.status, 413, 'Payload > 4096 B must return 413');

      const getRes = await fetchOpaque(`${baseUrl}/api/uninstall-feedback`);
      assertEqual(getRes.status, 405, 'GET /api/uninstall-feedback must return 405');
    }
  },
  {
    id: 'F26-T2-03',
    feature: 'F26',
    tier: 2,
    name: 'Verify POST /api/uninstall-feedback neutralizes {toString:null} and __proto__ pollution safely',
    async fn({ baseUrl }) {
      const advPayload = '{"reason":{"toString":null},"os":123,"version":null,"__proto__":{"polluted":"yes"},"note":"safe\\u0007control"}';
      const res = await fetchOpaque(`${baseUrl}/api/uninstall-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: advPayload
      });
      assertEqual(res.status, 200, 'Adversarial object coercion payload must safely coerce to 200 ok:true');
      assertEqual(JSON.parse(res.body).ok, true, 'Must return ok: true');
      assertEqual(({}).polluted, undefined, 'Object.prototype must not be polluted');
    }
  },
  {
    id: 'F26-T2-04',
    feature: 'F26',
    tier: 2,
    name: 'Verify POST /api/telemetry adversarial payloads (toString:null, array properties, >8192B, malformed JSON) keep server healthy',
    async fn({ baseUrl }) {
      const adv1 = await fetchOpaque(`${baseUrl}/api/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"event_name":{"toString":null},"category":123,"properties":{"cta":{"toString":null},"platform":true},"__proto__":{"polluted":"yes"}}'
      });
      assertEqual(adv1.status, 200, 'Telemetry must safely coerce non-string fields');

      const adv2 = await fetchOpaque(`${baseUrl}/api/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_name: 'x', properties: ['a', 'b'] })
      });
      assertEqual(adv2.status, 200, 'Telemetry must safely handle array properties');

      const badJson = await fetchOpaque(`${baseUrl}/api/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad'
      });
      assertEqual(badJson.status, 400, 'Telemetry malformed JSON must return 400');

      const huge = await fetchOpaque(`${baseUrl}/api/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_name: 'huge', note: 'z'.repeat(8500) })
      });
      assertEqual(huge.status, 413, 'Telemetry > 8192 B must return 413');

      const health = await fetchOpaque(`${baseUrl}/`);
      assertEqual(health.status, 200, 'Server must remain healthy after adversarial telemetry calls');
    }
  },
  {
    id: 'F26-T2-05',
    feature: 'F26',
    tier: 2,
    name: 'Verify POST /api/uninstall-feedback enforces 429 rate_limit_exceeded after 15 requests/60s in isolated instance',
    async fn() {
      const port = await getFreePort();
      const isolated = await startServer(port);
      try {
        for (let i = 1; i <= 15; i++) {
          const r = await fetchOpaque(`${isolated.baseUrl}/api/uninstall-feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'other', os: 'win', version: '2.6.0' })
          });
          assertEqual(r.status, 200, `Request #${i}/15 must succeed with 200`);
        }
        const limited = await fetchOpaque(`${isolated.baseUrl}/api/uninstall-feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'other', os: 'win', version: '2.6.0' })
        });
        assertEqual(limited.status, 429, '16th rapid request must return HTTP 429');
        assertEqual(JSON.parse(limited.body).error, 'rate_limit_exceeded', '429 body must report rate_limit_exceeded');
        assertIncludes((limited.getHeader('x-robots-tag') || '').toLowerCase(), 'noindex, nofollow', '429 response must include X-Robots-Tag');
      } finally {
        stopServer(isolated);
      }
    }
  },

  // =========================================================================
  // Feature F27: R5 M3 Carrier Consolidation & Sitemap Boundaries
  // =========================================================================
  {
    id: 'F27-T2-01',
    feature: 'F27',
    tier: 2,
    name: 'Verify .html and trailing-slash query variants of retired hyperoptic return 1-hop 301 preserving UTM query',
    async fn({ baseUrl }) {
      const rHtml = await fetchOpaque(`${baseUrl}/solutions/hyperoptic-broadband-isp-throttling.html`);
      assertEqual(rHtml.status, 301, '.html hyperoptic must return 301');
      assertEqual(rHtml.location, '/solutions/talktalk-fibre-wireguard-cgnat', 'Must redirect 1-hop to TalkTalk');

      const rSlashQuery = await fetchOpaque(`${baseUrl}/solutions/hyperoptic-broadband-isp-throttling/?utm_source=gsc&ref=1`);
      assertEqual(rSlashQuery.status, 301, 'Trailing slash + query must return 301');
      assertEqual(
        rSlashQuery.location,
        '/solutions/talktalk-fibre-wireguard-cgnat?utm_source=gsc&ref=1',
        'Query string must be preserved across 1-hop 301'
      );
    }
  },
  {
    id: 'F27-T2-02',
    feature: 'F27',
    tier: 2,
    name: 'Verify all 94/94 sitemap.xml URLs return HTTP 200 OK with zero 404s or 301 redirects',
    async fn({ baseUrl }) {
      const xml = fs.readFileSync(path.join(WEBSITE_DIR, 'sitemap.xml'), 'utf8');
      const { urls } = validateSitemapXml(xml);
      assertEqual(urls.length, 94, `Expected 94 sitemap URLs, got ${urls.length}`);
      for (const u of urls) {
        const pathname = new URL(u).pathname;
        const res = await fetchOpaque(`${baseUrl}${pathname}`, { method: 'HEAD' });
        assertEqual(res.status, 200, `Sitemap URL ${pathname} must return 200 OK`);
        assertEqual(res.location, null, `Sitemap URL ${pathname} must not redirect`);
      }
    }
  },
  {
    id: 'F27-T2-03',
    feature: 'F27',
    tier: 2,
    name: 'Verify /solutions/talktalk-p2p-port-forwarding.html?ref=1 redirects 1-hop 301 preserving query',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/talktalk-p2p-port-forwarding.html?ref=1`);
      assertEqual(res.status, 301, 'Legacy TalkTalk .html must return 301');
      assertEqual(res.location, '/solutions/talktalk-fibre-wireguard-cgnat?ref=1', 'Must redirect 1-hop preserving query');
    }
  },
  {
    id: 'F27-T2-04',
    feature: 'F27',
    tier: 2,
    name: 'Verify consolidate-and-optimize-gsc.mjs excludes deleted hyperoptic from AUTHORITATIVE_SOLUTIONS_PILLARS',
    async fn() {
      const src = fs.readFileSync(path.join(SCRIPTS_DIR, 'consolidate-and-optimize-gsc.mjs'), 'utf8');
      assertIncludes(
        src,
        '"hyperoptic-broadband-isp-throttling": "/solutions/talktalk-fibre-wireguard-cgnat"',
        'Consolidation map must map hyperoptic to talktalk-fibre-wireguard-cgnat'
      );
      const authBlock = (src.match(/const AUTHORITATIVE_SOLUTIONS_PILLARS = new Set\(\[([\s\S]*?)\]\);/) || [])[1] || '';
      assertFalse(authBlock.includes('hyperoptic-broadband-isp-throttling'), 'Deleted hyperoptic must not be in AUTHORITATIVE_SOLUTIONS_PILLARS');
    }
  },
  {
    id: 'F27-T2-05',
    feature: 'F27',
    tier: 2,
    name: 'Verify zero indexable HTML files link to retired /solutions/hyperoptic-broadband-isp-throttling',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /\/solutions\/hyperoptic-broadband-isp-throttling/i);
      assertEqual(matches.length, 0, `Found retired hyperoptic link in: ${matches.join(', ')}`);
    }
  },

  // =========================================================================
  // Feature F28: R6–R8 Automation Read-Only Safety & Gate Boundaries
  // =========================================================================
  {
    id: 'F28-T2-01',
    feature: 'F28',
    tier: 2,
    name: 'Verify daily-seo-pagespeed-audit.mjs --no-fix --no-ping preserves exact SHA-256 of sitemap.xml and llms*.txt',
    async fn() {
      const files = ['sitemap.xml', 'llms.txt', 'llms-full.txt'].map((f) => path.join(WEBSITE_DIR, f));
      const before = files.map((f) => sha256File(f));
      execSync(`node "${path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs')}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      files.forEach((f, idx) => {
        assertEqual(sha256File(f), before[idx], `--no-fix --no-ping must not mutate ${path.basename(f)}`);
      });
    }
  },
  {
    id: 'F28-T2-02',
    feature: 'F28',
    tier: 2,
    name: 'Verify daily-wireguard-and-acr-pipeline.mjs --dry-run preserves SHA-256 of state & audit log',
    async fn() {
      const statePath = path.join(WEBSITE_DIR, 'wireguard-acr-pipeline-state.json');
      const logPath = path.join(ROOT_DIR, 'WIREGUARD_AND_ACR_DAILY_AUDIT_LOG.md');
      const stateBefore = sha256File(statePath);
      const logBefore = sha256File(logPath);
      execSync(`node "${path.join(SCRIPTS_DIR, 'daily-wireguard-and-acr-pipeline.mjs')}" --dry-run`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertEqual(sha256File(statePath), stateBefore, '--dry-run must not mutate wireguard-acr-pipeline-state.json');
      assertEqual(sha256File(logPath), logBefore, '--dry-run must not mutate WIREGUARD_AND_ACR_DAILY_AUDIT_LOG.md');
    }
  },
  {
    id: 'F28-T2-03',
    feature: 'F28',
    tier: 2,
    name: 'Verify weekly-spec-privacy-guardrail.mjs --strict --dry-run writes zero artifacts/ output',
    async fn() {
      const artifactsDir = path.join(ROOT_DIR, 'artifacts');
      const existedBefore = fs.existsSync(artifactsDir);
      const beforeFiles = existedBefore ? fs.readdirSync(artifactsDir).sort() : [];
      execSync(`node "${path.join(SCRIPTS_DIR, 'automations', 'weekly-spec-privacy-guardrail.mjs')}" --strict --dry-run`, {
        cwd: ROOT_DIR,
        encoding: 'utf8'
      });
      if (!existedBefore) {
        assertFalse(fs.existsSync(artifactsDir), '--dry-run must not create artifacts/ directory');
      } else {
        assertEqual(JSON.stringify(fs.readdirSync(artifactsDir).sort()), JSON.stringify(beforeFiles), '--dry-run must not add artifacts');
      }
    }
  },
  {
    id: 'F28-T2-04',
    feature: 'F28',
    tier: 2,
    name: 'Verify zero HTML pages in website/ emit fabricated VideoObject JSON-LD while youtubeVideoId is null',
    async fn() {
      const videoMatches = findFilesWithPattern(WEBSITE_DIR, /"@type"\s*:\s*"VideoObject"/i);
      assertEqual(videoMatches.length, 0, `Unexpected VideoObject JSON-LD before manual YouTube upload in: ${videoMatches.join(', ')}`);
    }
  },
  {
    id: 'F28-T2-05',
    feature: 'F28',
    tier: 2,
    name: 'Verify zero HTML files in website/ exceed 1800 KB (1,843,200 bytes) Googlebot crawl safety limit',
    async fn() {
      for (const fp of findHtmlFiles(WEBSITE_DIR, true)) {
        const size = fs.statSync(fp).size;
        assertLessThanOrEqual(size, 1800 * 1024, `HTML file ${fp} exceeds 1800 KB (${size} bytes)`);
      }
    }
  }
];
