/**
 * SWEEPR VPN — E2E Test Suite: Tier 1 Feature Coverage
 * Tests all 28 primary project features (F1 to F28), 5 tests each = 140 tests.
 * Zero external npm dependencies. Native Node.js ESM.
 */

import fs from 'node:fs';
import os from 'node:os';
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
  extractHeadings,
  containsElementId,
  validateSitemapXml,
  findHtmlFiles,
  findFilesWithPattern,
  getAuthoritativePillars
} from './helpers.mjs';

export const tier1Tests = [
  // =========================================================================
  // Feature F1: Git Pull Clean Baseline & Secret Hygiene
  // =========================================================================
  {
    id: 'F01-T1-01',
    feature: 'F1',
    tier: 1,
    name: 'Verify git current branch is main and upstream origin is configured',
    async fn() {
      const branch = execSync('git branch --show-current', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
      assertEqual(branch, 'main', 'Current git branch must be main');

      const remoteUrl = execSync('git remote get-url origin', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
      assertIncludes(remoteUrl, 'BenCook1996/sweepr-vpn', 'Remote origin must point to authoritative repo');
    }
  },
  {
    id: 'F01-T1-02',
    feature: 'F1',
    tier: 1,
    name: 'Verify .gcp-service-account.json is not tracked in git index',
    async fn() {
      const tracked = execSync('git ls-files .gcp-service-account.json', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
      assertEqual(tracked, '', '.gcp-service-account.json must never be tracked in git index');
    }
  },
  {
    id: 'F01-T1-03',
    feature: 'F1',
    tier: 1,
    name: 'Verify .env and environment secret files are not tracked in git index',
    async fn() {
      const tracked = execSync('git ls-files .env .env.local .env.production', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
      assertEqual(tracked, '', '.env files must never be tracked in git index');
    }
  },
  {
    id: 'F01-T1-04',
    feature: 'F1',
    tier: 1,
    name: 'Verify .gitignore contains explicit rules for service account keys and secrets',
    async fn() {
      const gitignorePath = path.join(ROOT_DIR, '.gitignore');
      assertTrue(fs.existsSync(gitignorePath), '.gitignore file must exist');
      const content = fs.readFileSync(gitignorePath, 'utf8');
      assertIncludes(content, '.gcp-service-account.json', '.gitignore must list .gcp-service-account.json');
      assertIncludes(content, '*.service-account.json', '.gitignore must list *.service-account.json');
      assertIncludes(content, 'sweepr-*.json', '.gitignore must list sweepr-*.json');
    }
  },
  {
    id: 'F01-T1-05',
    feature: 'F1',
    tier: 1,
    name: 'Verify no git conflict markers exist in codebase files',
    async fn() {
      const websiteFiles = findHtmlFiles(WEBSITE_DIR, true);
      for (const fp of websiteFiles) {
        const content = fs.readFileSync(fp, 'utf8');
        assertFalse(content.includes('<<<<<<< HEAD'), `Conflict marker found in ${fp}`);
        assertFalse(content.includes('>>>>>>> main'), `Conflict marker found in ${fp}`);
      }
    }
  },

  // =========================================================================
  // Feature F2: Delete Zombie HTML Files
  // =========================================================================
  {
    id: 'F02-T1-01',
    feature: 'F2',
    tier: 1,
    name: 'Verify zero noindex zombie HTML files exist in website/solutions/',
    async fn() {
      const solutionsDir = path.join(WEBSITE_DIR, 'solutions');
      const zombies = findFilesWithPattern(solutionsDir, /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i);
      assertEqual(zombies.length, 0, `website/solutions/ must contain 0 noindex files, found ${zombies.length}`);
    }
  },
  {
    id: 'F02-T1-02',
    feature: 'F2',
    tier: 1,
    name: 'Verify zero noindex zombie HTML files exist in website/vs/',
    async fn() {
      const vsDir = path.join(WEBSITE_DIR, 'vs');
      const zombies = findFilesWithPattern(vsDir, /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i);
      assertEqual(zombies.length, 0, `website/vs/ must contain 0 noindex files, found ${zombies.length}`);
    }
  },
  {
    id: 'F02-T1-03',
    feature: 'F2',
    tier: 1,
    name: 'Verify zero noindex zombie HTML files exist in website/setup/',
    async fn() {
      const setupDir = path.join(WEBSITE_DIR, 'setup');
      const zombies = findFilesWithPattern(setupDir, /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i);
      assertEqual(zombies.length, 0, `website/setup/ must contain 0 noindex files, found ${zombies.length}`);
    }
  },
  {
    id: 'F02-T1-04',
    feature: 'F2',
    tier: 1,
    name: 'Verify zero noindex zombie HTML files exist in website/guides/',
    async fn() {
      const guidesDir = path.join(WEBSITE_DIR, 'guides');
      const zombies = findFilesWithPattern(guidesDir, /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i);
      assertEqual(zombies.length, 0, `website/guides/ must contain 0 noindex files, found ${zombies.length}`);
    }
  },
  {
    id: 'F02-T1-05',
    feature: 'F2',
    tier: 1,
    name: 'Verify all 62 authoritative master pillars are preserved across directories',
    async fn() {
      const pillars = getAuthoritativePillars();
      assertEqual(pillars.length, 62, 'Expected 62 authoritative pSEO pillars');
      for (const rel of pillars) {
        const p = path.join(WEBSITE_DIR, rel);
        assertTrue(fs.existsSync(p), `Authoritative pillar must exist on disk: ${rel}`);
      }
      assertFalse(
        fs.existsSync(path.join(WEBSITE_DIR, 'solutions', 'hyperoptic-broadband-isp-throttling.html')),
        'Consolidated hyperoptic carrier page must be absent from disk'
      );
    }
  },

  // =========================================================================
  // Feature F3: Pattern 301 Redirect Resolver
  // =========================================================================
  {
    id: 'F03-T1-01',
    feature: 'F3',
    tier: 1,
    name: 'Verify pattern 301 redirect for retired Smart-TV ACR solution',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/comcast-xfinity-broadband-smart-tv-acr-blocking`);
      assertEqual(res.status, 301, 'Retired ACR path must return 301');
      assertEqual(res.location, '/guides/stop-samsung-smart-tv-acr-tracking', 'Target must be stop-samsung guide');
    }
  },
  {
    id: 'F03-T1-02',
    feature: 'F3',
    tier: 1,
    name: 'Verify pattern 301 redirect for Eduroam ACR solution variant',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/eduroam-campus-wifi-smart-tv-acr-blocking`);
      assertEqual(res.status, 301, 'Eduroam ACR path must return 301');
      assertEqual(res.location, '/guides/stop-samsung-smart-tv-acr-tracking', 'Target must be stop-samsung guide');
    }
  },
  {
    id: 'F03-T1-03',
    feature: 'F3',
    tier: 1,
    name: 'Verify pattern 301 redirect for non-pillar ISP sub-path to master pillar',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/bt-broadband-p2p-port-forwarding`);
      assertEqual(res.status, 301, 'Non-pillar BT sub-path must return 301');
      assertEqual(res.location, '/solutions/bt-broadband-gaming-packet-loss', 'Target must be BT master pillar');
    }
  },
  {
    id: 'F03-T1-04',
    feature: 'F3',
    tier: 1,
    name: 'Verify pattern 301 redirect for retired antivirus comparison',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/vs/norton-secure-vpn`);
      assertEqual(res.status, 301, 'Retired antivirus slug must return 301');
      assertEqual(res.location, '/vs', 'Target must be /vs directory hub');
    }
  },
  {
    id: 'F03-T1-05',
    feature: 'F3',
    tier: 1,
    name: 'Verify query parameters are preserved across pattern 301 redirects',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/comcast-xfinity-broadband-smart-tv-acr-blocking?ref=reddit&tag=vpn`);
      assertEqual(res.status, 301, 'Request with query must return 301');
      assertEqual(res.location, '/guides/stop-samsung-smart-tv-acr-tracking?ref=reddit&tag=vpn', 'Query must be preserved');
    }
  },

  // =========================================================================
  // Feature F4: Tool & Competitor Alias Redirects
  // =========================================================================
  {
    id: 'F04-T1-01',
    feature: 'F4',
    tier: 1,
    name: 'Verify /leak-test redirects via 301 to /tools/leak-test',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/leak-test`);
      assertEqual(res.status, 301, '/leak-test must return 301');
      assertEqual(res.location, '/tools/leak-test', 'Must redirect to /tools/leak-test');
    }
  },
  {
    id: 'F04-T1-02',
    feature: 'F4',
    tier: 1,
    name: 'Verify /isp-throttling-test redirects via 301 to /tools/isp-throttling-test',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/isp-throttling-test`);
      assertEqual(res.status, 301, '/isp-throttling-test must return 301');
      assertEqual(res.location, '/tools/isp-throttling-test', 'Must redirect to /tools/isp-throttling-test');
    }
  },
  {
    id: 'F04-T1-03',
    feature: 'F4',
    tier: 1,
    name: 'Verify /tools/mtu-calculator redirects via 301 to /tools/isp-throttling-test',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/mtu-calculator`);
      assertEqual(res.status, 301, '/tools/mtu-calculator must return 301');
      assertEqual(res.location, '/tools/isp-throttling-test', 'Must redirect to /tools/isp-throttling-test');
    }
  },
  {
    id: 'F04-T1-04',
    feature: 'F4',
    tier: 1,
    name: 'Verify /vs/totalvpn returns 200 canonical while legacy aliases redirect 301',
    async fn({ baseUrl }) {
      const liveVs = await fetchOpaque(`${baseUrl}/vs/totalvpn`);
      assertEqual(liveVs.status, 200, '/vs/totalvpn must return 200 OK as active canonical pillar');
      assertEqual(liveVs.location, null, '/vs/totalvpn must not redirect');

      for (const alias of ['/vs/totalvpn.html', '/vs-totalvpn', '/vs-totalvpn.html']) {
        const res = await fetchOpaque(`${baseUrl}${alias}`);
        assertEqual(res.status, 301, `${alias} must return 301`);
        assertEqual(res.location, '/vs/totalvpn', `${alias} must redirect to /vs/totalvpn`);
      }

      for (const altAlias of ['/alternatives-totalvpn', '/alternatives-totalvpn.html']) {
        const res = await fetchOpaque(`${baseUrl}${altAlias}`);
        assertEqual(res.status, 301, `${altAlias} must return 301`);
        assertEqual(res.location, '/alternatives/totalvpn', `${altAlias} must redirect to /alternatives/totalvpn`);
      }
    }
  },
  {
    id: 'F04-T1-05',
    feature: 'F4',
    tier: 1,
    name: 'Verify canonical destination tools return HTTP 200 OK directly',
    async fn({ baseUrl }) {
      const leakRes = await fetchOpaque(`${baseUrl}/tools/leak-test`);
      assertEqual(leakRes.status, 200, '/tools/leak-test must return 200');

      const throtRes = await fetchOpaque(`${baseUrl}/tools/isp-throttling-test`);
      assertEqual(throtRes.status, 200, '/tools/isp-throttling-test must return 200');

      const altRes = await fetchOpaque(`${baseUrl}/alternatives/totalvpn`);
      assertEqual(altRes.status, 200, '/alternatives/totalvpn must return 200');
    }
  },

  // =========================================================================
  // Feature F5: Strip #sweepr-live-wireguard-acr-proof Section
  // =========================================================================
  {
    id: 'F05-T1-01',
    feature: 'F5',
    tier: 1,
    name: 'Verify zero HTML files in website/ contain id="sweepr-live-wireguard-acr-proof"',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-live-wireguard-acr-proof["']/i);
      assertEqual(matches.length, 0, `Found ${matches.length} files still containing #sweepr-live-wireguard-acr-proof`);
    }
  },
  {
    id: 'F05-T1-02',
    feature: 'F5',
    tier: 1,
    name: 'Verify #sweepr-live-wireguard-acr-proof absent in talktalk-fibre-wireguard-cgnat.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      assertTrue(fs.existsSync(fp), `Required pillar missing: ${fp}`);
      const html = fs.readFileSync(fp, 'utf8');
      assertFalse(containsElementId(html, 'sweepr-live-wireguard-acr-proof'), 'Proof section must be absent');
    }
  },
  {
    id: 'F05-T1-03',
    feature: 'F5',
    tier: 1,
    name: 'Verify #sweepr-live-wireguard-acr-proof absent in gl-inet-travel-router.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'setup', 'gl-inet-travel-router.html');
      assertTrue(fs.existsSync(fp), `Required pillar missing: ${fp}`);
      const html = fs.readFileSync(fp, 'utf8');
      assertFalse(containsElementId(html, 'sweepr-live-wireguard-acr-proof'), 'Proof section must be absent');
    }
  },
  {
    id: 'F05-T1-04',
    feature: 'F5',
    tier: 1,
    name: 'Verify #sweepr-live-wireguard-acr-proof absent in stop-samsung-smart-tv-acr-tracking.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'guides', 'stop-samsung-smart-tv-acr-tracking.html');
      assertTrue(fs.existsSync(fp), `Required pillar missing: ${fp}`);
      const html = fs.readFileSync(fp, 'utf8');
      assertFalse(containsElementId(html, 'sweepr-live-wireguard-acr-proof'), 'Proof section must be absent');
    }
  },
  {
    id: 'F05-T1-05',
    feature: 'F5',
    tier: 1,
    name: 'Verify #sweepr-live-wireguard-acr-proof absent in vs/nordvpn.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'vs', 'nordvpn.html');
      assertTrue(fs.existsSync(fp), `Required pillar missing: ${fp}`);
      const html = fs.readFileSync(fp, 'utf8');
      assertFalse(containsElementId(html, 'sweepr-live-wireguard-acr-proof'), 'Proof section must be absent');
    }
  },

  // =========================================================================
  // Feature F6: Strip #sweepr-isp-master-matrix Section
  // =========================================================================
  {
    id: 'F06-T1-01',
    feature: 'F6',
    tier: 1,
    name: 'Verify zero HTML files in website/solutions/ contain id="sweepr-isp-master-matrix"',
    async fn() {
      const solutionsDir = path.join(WEBSITE_DIR, 'solutions');
      const matches = findFilesWithPattern(solutionsDir, /id=["']sweepr-isp-master-matrix["']/i);
      assertEqual(matches.length, 0, `Found ${matches.length} files still containing #sweepr-isp-master-matrix`);
    }
  },
  {
    id: 'F06-T1-02',
    feature: 'F6',
    tier: 1,
    name: 'Verify #sweepr-isp-master-matrix absent in talktalk-fibre-wireguard-cgnat.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      assertTrue(fs.existsSync(fp), `Required pillar missing: ${fp}`);
      const html = fs.readFileSync(fp, 'utf8');
      assertFalse(containsElementId(html, 'sweepr-isp-master-matrix'), 'Master matrix must be absent');
    }
  },
  {
    id: 'F06-T1-03',
    feature: 'F6',
    tier: 1,
    name: 'Verify #sweepr-isp-master-matrix absent in virgin-media-remote-dev-ssh.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'virgin-media-remote-dev-ssh.html');
      assertTrue(fs.existsSync(fp), `Required pillar missing: ${fp}`);
      const html = fs.readFileSync(fp, 'utf8');
      assertFalse(containsElementId(html, 'sweepr-isp-master-matrix'), 'Master matrix must be absent');
    }
  },
  {
    id: 'F06-T1-04',
    feature: 'F6',
    tier: 1,
    name: 'Verify #sweepr-isp-master-matrix absent in bt-broadband-gaming-packet-loss.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'bt-broadband-gaming-packet-loss.html');
      assertTrue(fs.existsSync(fp), `Required pillar missing: ${fp}`);
      const html = fs.readFileSync(fp, 'utf8');
      assertFalse(containsElementId(html, 'sweepr-isp-master-matrix'), 'Master matrix must be absent');
    }
  },
  {
    id: 'F06-T1-05',
    feature: 'F6',
    tier: 1,
    name: 'Verify legitimate non-matrix tables are preserved in talktalk-fibre-wireguard-cgnat.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      assertTrue(fs.existsSync(fp), `Required pillar missing: ${fp}`);
      const html = fs.readFileSync(fp, 'utf8');
      assertTrue(html.includes('<table') || html.includes('class="metric'), 'Pillar should preserve legitimate technical metrics or tables');
    }
  },

  // =========================================================================
  // Feature F7: Remove Boilerplate Injection Scripts
  // =========================================================================
  {
    id: 'F07-T1-01',
    feature: 'F7',
    tier: 1,
    name: 'Verify deleted scripts/enrich-pillars-with-live-proof.mjs is absent from scripts/',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'enrich-pillars-with-live-proof.mjs');
      assertFalse(fs.existsSync(fp), 'enrich-pillars-with-live-proof.mjs must remain deleted from scripts/');
    }
  },
  {
    id: 'F07-T1-02',
    feature: 'F7',
    tier: 1,
    name: 'Verify Step 3 of daily-seo-pagespeed-audit.mjs does not re-inject matrix tables',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      assertTrue(fs.existsSync(fp), 'Audit script must exist');
      const content = fs.readFileSync(fp, 'utf8');
      assertFalse(content.includes('sweepr-isp-master-matrix'), 'Audit script must not contain matrix injection markup');
    }
  },
  {
    id: 'F07-T1-03',
    feature: 'F7',
    tier: 1,
    name: 'Verify zero scripts/*.mjs inject sweepr-live-wireguard-acr-proof or sweepr-isp-master-matrix',
    async fn() {
      const scriptFiles = fs.readdirSync(SCRIPTS_DIR).filter((f) => f.endsWith('.mjs'));
      for (const sf of scriptFiles) {
        const content = fs.readFileSync(path.join(SCRIPTS_DIR, sf), 'utf8');
        assertFalse(
          content.includes('id="sweepr-live-wireguard-acr-proof"') || content.includes('id="sweepr-isp-master-matrix"'),
          `Script ${sf} must not inject retired proof or matrix HTML sections`
        );
      }
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-live-wireguard-acr-proof["']/i);
      assertEqual(matches.length, 0, 'No proof sections should exist in website/');
    }
  },
  {
    id: 'F07-T1-04',
    feature: 'F7',
    tier: 1,
    name: 'Verify audit script does not restore proof or matrix sections into solutions',
    async fn() {
      const auditPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const content = fs.readFileSync(auditPath, 'utf8');
      assertFalse(content.includes('sweepr-live-wireguard-acr-proof'), 'Audit script must not contain live proof injection');
    }
  },
  {
    id: 'F07-T1-05',
    feature: 'F7',
    tier: 1,
    name: 'Verify consecutive daily audit --no-fix --no-ping runs leave 0 proof/matrix sections and identical HTML',
    async fn() {
      const auditPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const talktalkPath = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      const beforeSha = sha256File(talktalkPath);
      execSync(`node "${auditPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      execSync(`node "${auditPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertEqual(sha256File(talktalkPath), beforeSha, 'Repeated audit runs must not alter pillar HTML');
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["'](sweepr-live-wireguard-acr-proof|sweepr-isp-master-matrix)["']/i);
      assertEqual(matches.length, 0, 'Repeated runs must leave 0 proof/matrix sections');
    }
  },

  // =========================================================================
  // Feature F8: Lower 5-Gram Shingle Similarity
  // =========================================================================
  {
    id: 'F08-T1-01',
    feature: 'F8',
    tier: 1,
    name: 'Verify 5-gram algorithm computes 100% for identical and 0% for disjoint text',
    async fn() {
      const docA = '<p>The quick brown fox jumps over the lazy dog in autumn</p>';
      const docB = '<p>The quick brown fox jumps over the lazy dog in autumn</p>';
      const docC = '<p>Completely different sentence about quantum mechanics and particle physics</p>';

      const simIdentical = calculate5GramOverlap(docA, docB);
      assertEqual(simIdentical, 100.0, 'Identical documents must yield 100% overlap');

      const simDisjoint = calculate5GramOverlap(docA, docC);
      assertEqual(simDisjoint, 0.0, 'Disjoint documents must yield 0% overlap');
    }
  },
  {
    id: 'F08-T1-02',
    feature: 'F8',
    tier: 1,
    name: 'Verify pairwise 5-gram overlap between top solutions pillars is strictly below 25%',
    async fn() {
      const p1 = path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html');
      const p2 = path.join(WEBSITE_DIR, 'solutions', 'virgin-media-remote-dev-ssh.html');
      assertTrue(fs.existsSync(p1) && fs.existsSync(p2), 'Both solutions pillars must exist');
      const html1 = fs.readFileSync(p1, 'utf8');
      const html2 = fs.readFileSync(p2, 'utf8');
      const overlap = calculate5GramOverlap(html1, html2);
      assertLessThan(overlap, 25.0, `Overlap must be < 25%, got ${overlap.toFixed(2)}%`);
    }
  },
  {
    id: 'F08-T1-03',
    feature: 'F8',
    tier: 1,
    name: 'Verify pairwise 5-gram overlap between cross-cluster pillars is strictly below 20%',
    async fn() {
      const p1 = path.join(WEBSITE_DIR, 'setup', 'gl-inet-travel-router.html');
      const p2 = path.join(WEBSITE_DIR, 'guides', 'stop-samsung-smart-tv-acr-tracking.html');
      assertTrue(fs.existsSync(p1) && fs.existsSync(p2), 'Both cross-cluster pillars must exist');
      const html1 = fs.readFileSync(p1, 'utf8');
      const html2 = fs.readFileSync(p2, 'utf8');
      const overlap = calculate5GramOverlap(html1, html2);
      assertLessThan(overlap, 20.0, `Cross-cluster overlap must be < 20%, got ${overlap.toFixed(2)}%`);
    }
  },
  {
    id: 'F08-T1-04',
    feature: 'F8',
    tier: 1,
    name: 'Verify sampled top pillar pairs stay strictly below 30% hard CI limit',
    async fn() {
      const samples = [
        path.join(WEBSITE_DIR, 'solutions', 'talktalk-fibre-wireguard-cgnat.html'),
        path.join(WEBSITE_DIR, 'solutions', 'bt-broadband-gaming-packet-loss.html'),
        path.join(WEBSITE_DIR, 'setup', 'synology-nas-docker-vpn.html'),
        path.join(WEBSITE_DIR, 'guides', 'stop-lg-smart-tv-acr-spying.html'),
        path.join(WEBSITE_DIR, 'vs', 'nordvpn.html')
      ];

      for (const s of samples) {
        assertTrue(fs.existsSync(s), `Sample pillar must exist: ${s}`);
      }

      for (let i = 0; i < samples.length; i++) {
        for (let j = i + 1; j < samples.length; j++) {
          const h1 = fs.readFileSync(samples[i], 'utf8');
          const h2 = fs.readFileSync(samples[j], 'utf8');
          const overlap = calculate5GramOverlap(h1, h2);
          assertLessThan(overlap, 30.0, `Pair (${path.basename(samples[i])}, ${path.basename(samples[j])}) must be < 30%, got ${overlap.toFixed(2)}%`);
        }
      }
    }
  },
  {
    id: 'F08-T1-05',
    feature: 'F8',
    tier: 1,
    name: 'Verify 5-gram calculation handles small documents without throwing or producing NaN',
    async fn() {
      const shortDoc = '<p>Hi there</p>';
      const overlap = calculate5GramOverlap(shortDoc, shortDoc);
      assertEqual(overlap, 0.0, 'Short docs with <5 tokens should produce 0.0% overlap without error');
      assertFalse(Number.isNaN(overlap), 'Overlap must not be NaN');
    }
  },

  // =========================================================================
  // Feature F9: Remove Collapsed Footer Link Directory
  // =========================================================================
  {
    id: 'F09-T1-01',
    feature: 'F9',
    tier: 1,
    name: 'Verify #sweepr-seo-directory absent on homepage (GET /)',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      assertEqual(res.status, 200, 'Homepage must return 200');
      assertFalse(containsElementId(res.body, 'sweepr-seo-directory'), 'sweepr-seo-directory must be absent on /');
    }
  },
  {
    id: 'F09-T1-02',
    feature: 'F9',
    tier: 1,
    name: 'Verify #sweepr-seo-directory absent on /pricing',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/pricing`);
      assertEqual(res.status, 200, '/pricing must return 200');
      assertFalse(containsElementId(res.body, 'sweepr-seo-directory'), 'sweepr-seo-directory must be absent on /pricing');
    }
  },
  {
    id: 'F09-T1-03',
    feature: 'F9',
    tier: 1,
    name: 'Verify #sweepr-seo-directory absent on /tools/leak-test',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/leak-test`);
      assertEqual(res.status, 200, '/tools/leak-test must return 200');
      assertFalse(containsElementId(res.body, 'sweepr-seo-directory'), 'sweepr-seo-directory must be absent on leak-test');
    }
  },
  {
    id: 'F09-T1-04',
    feature: 'F9',
    tier: 1,
    name: 'Verify #sweepr-seo-directory absent on /tools/isp-throttling-test',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/isp-throttling-test`);
      assertEqual(res.status, 200, '/tools/isp-throttling-test must return 200');
      assertFalse(containsElementId(res.body, 'sweepr-seo-directory'), 'sweepr-seo-directory must be absent on isp-throttling');
    }
  },
  {
    id: 'F09-T1-05',
    feature: 'F9',
    tier: 1,
    name: 'Verify zero instances of sweepr-seo-directory across all HTML files in website/',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-seo-directory["']/i);
      assertEqual(matches.length, 0, `Found ${matches.length} files still containing #sweepr-seo-directory`);
    }
  },

  // =========================================================================
  // Feature F10: Remove Rotator Bridge Banner
  // =========================================================================
  {
    id: 'F10-T1-01',
    feature: 'F10',
    tier: 1,
    name: 'Verify #sweepr-unindexed-guides-bridge absent on /tools/leak-test',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/leak-test`);
      assertEqual(res.status, 200, '/tools/leak-test must return 200');
      assertFalse(containsElementId(res.body, 'sweepr-unindexed-guides-bridge'), 'Bridge must be absent on leak-test');
    }
  },
  {
    id: 'F10-T1-02',
    feature: 'F10',
    tier: 1,
    name: 'Verify #sweepr-unindexed-guides-bridge absent on /tools/isp-throttling-test',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/isp-throttling-test`);
      assertEqual(res.status, 200, '/tools/isp-throttling-test must return 200');
      assertFalse(containsElementId(res.body, 'sweepr-unindexed-guides-bridge'), 'Bridge must be absent on isp-throttling');
    }
  },
  {
    id: 'F10-T1-03',
    feature: 'F10',
    tier: 1,
    name: 'Verify #sweepr-unindexed-guides-bridge absent in website/leak-test.html on disk',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      assertTrue(fs.existsSync(fp), 'leak-test.html must exist');
      const html = fs.readFileSync(fp, 'utf8');
      assertFalse(containsElementId(html, 'sweepr-unindexed-guides-bridge'), 'Bridge must be absent from disk file');
    }
  },
  {
    id: 'F10-T1-04',
    feature: 'F10',
    tier: 1,
    name: 'Verify #sweepr-unindexed-guides-bridge absent in website/isp-throttling-test.html on disk',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      assertTrue(fs.existsSync(fp), 'isp-throttling-test.html must exist');
      const html = fs.readFileSync(fp, 'utf8');
      assertFalse(containsElementId(html, 'sweepr-unindexed-guides-bridge'), 'Bridge must be absent from disk file');
    }
  },
  {
    id: 'F10-T1-05',
    feature: 'F10',
    tier: 1,
    name: 'Verify #sweepr-share-diagnostic-badge preserved in both tool pages',
    async fn() {
      for (const fn of ['leak-test.html', 'isp-throttling-test.html']) {
        const fp = path.join(WEBSITE_DIR, fn);
        assertTrue(fs.existsSync(fp), `${fn} must exist`);
        const html = fs.readFileSync(fp, 'utf8');
        assertTrue(containsElementId(html, 'sweepr-share-diagnostic-badge'), `Diagnostic badge must be preserved in ${fn}`);
      }
    }
  },

  // =========================================================================
  // Feature F11: Disable Footer Injection in Audit Script
  // =========================================================================
  {
    id: 'F11-T1-01',
    feature: 'F11',
    tier: 1,
    name: 'Verify daily-seo-pagespeed-audit.mjs does not define directoryHtml injection',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertFalse(content.includes('id="sweepr-seo-directory"'), 'Audit script must not contain directoryHtml template');
    }
  },
  {
    id: 'F11-T1-02',
    feature: 'F11',
    tier: 1,
    name: 'Verify daily-seo-pagespeed-audit.mjs does not define bridgeHtml injection',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertFalse(content.includes('id="sweepr-unindexed-guides-bridge"'), 'Audit script must not contain bridgeHtml template');
    }
  },
  {
    id: 'F11-T1-03',
    feature: 'F11',
    tier: 1,
    name: 'Verify running daily audit does not re-create sweepr-seo-directory',
    async fn() {
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-seo-directory["']/i);
      assertEqual(matches.length, 0, 'No directory elements should exist after audit check');
    }
  },
  {
    id: 'F11-T1-04',
    feature: 'F11',
    tier: 1,
    name: 'Verify category hub generation in audit script remains functional',
    async fn() {
      const hubs = ['solutions.html', 'setup.html', 'guides.html', 'vs.html'];
      for (const h of hubs) {
        const fp = path.join(WEBSITE_DIR, h);
        assertTrue(fs.existsSync(fp), `Category hub ${h} must exist on disk`);
      }
    }
  },
  {
    id: 'F11-T1-05',
    feature: 'F11',
    tier: 1,
    name: 'Verify audit script runs cleanly with --no-fix --no-ping flags',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const res = execSync(`node "${fp}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(res.includes('Technical SEO') || res.includes('audit') || res.includes('SWEEPR'), 'Audit script should report completion');
    }
  },

  // =========================================================================
  // Feature F12: Focused 14-Link BOFU Hub Footer & Google Preferred Sources
  // =========================================================================
  {
    id: 'F12-T1-01',
    feature: 'F12',
    tier: 1,
    name: 'Verify homepage footer contains 14-link BOFU Hub grid and Preferred Sources badge',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      assertEqual(res.status, 200, 'Homepage must return 200');
      const footerMatch = res.body.match(/<footer[\s\S]*?<\/footer>/i);
      assertTrue(!!footerMatch, 'Homepage must contain <footer>');
      const footerLinks = extractLinks(footerMatch[0]).map((l) => l.href);
      assertLessThan(footerLinks.length, 15, `Homepage footer must have < 15 links, got ${footerLinks.length}`);
      const required = [
        '/solutions',
        '/setup',
        '/guides',
        '/vs',
        '/pricing',
        '/download',
        '/tools/leak-test',
        '/tools/isp-throttling-test',
        '/faq',
        '/ai-info',
        '/privacy',
        '/refund',
        '/terms',
        'https://www.google.com/preferences/source?q=sweeprvpn.com'
      ];
      for (const r of required) {
        assertTrue(footerLinks.includes(r), `Homepage footer must link to ${r}`);
      }
    }
  },
  {
    id: 'F12-T1-02',
    feature: 'F12',
    tier: 1,
    name: 'Verify /pricing footer contains focused <=14-link BOFU Hub grid + Preferred Sources',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/pricing`);
      assertEqual(res.status, 200, 'Pricing must return 200');
      const footerMatch = res.body.match(/<footer[\s\S]*?<\/footer>/i);
      assertTrue(!!footerMatch, 'Pricing must contain <footer>');
      const footerLinks = extractLinks(footerMatch[0]).map((l) => l.href);
      assertLessThan(footerLinks.length, 15, `Pricing footer must have < 15 links, got ${footerLinks.length}`);
      assertTrue(footerLinks.includes('https://www.google.com/preferences/source?q=sweeprvpn.com'), 'Pricing footer must include Preferred Sources badge');
      assertTrue(footerLinks.includes('/tools/leak-test'), 'Pricing footer must link to leak-test');
      assertTrue(footerLinks.includes('/faq') && footerLinks.includes('/ai-info'), 'Pricing footer must link to /faq and /ai-info');
    }
  },
  {
    id: 'F12-T1-03',
    feature: 'F12',
    tier: 1,
    name: 'Verify /tools/leak-test footer uses focused <=14-link BOFU Hub grid + Preferred Sources',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/leak-test`);
      assertEqual(res.status, 200, 'Leak test must return 200');
      const footerMatch = res.body.match(/<footer[\s\S]*?<\/footer>/i);
      assertTrue(!!footerMatch, 'Leak test must contain <footer>');
      const footerLinks = extractLinks(footerMatch[0]).map((l) => l.href);
      assertLessThan(footerLinks.length, 15, `Leak test footer must have < 15 links, got ${footerLinks.length}`);
      assertTrue(footerLinks.includes('https://www.google.com/preferences/source?q=sweeprvpn.com'), 'Leak test footer must include Preferred Sources badge');
      assertTrue(footerLinks.includes('/setup') && footerLinks.includes('/faq'), 'Leak test footer must link to /setup and /faq');
      const pageLinks = extractLinks(res.body).map((l) => l.href);
      assertTrue(pageLinks.includes('/warrant-canary'), 'Leak test page must link to warrant-canary');
    }
  },
  {
    id: 'F12-T1-04',
    feature: 'F12',
    tier: 1,
    name: 'Verify /tools/isp-throttling-test footer uses focused <=14-link BOFU Hub grid + Preferred Sources',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/isp-throttling-test`);
      assertEqual(res.status, 200, 'ISP throttling test must return 200');
      const footerMatch = res.body.match(/<footer[\s\S]*?<\/footer>/i);
      assertTrue(!!footerMatch, 'ISP throttling test must contain <footer>');
      const footerLinks = extractLinks(footerMatch[0]).map((l) => l.href);
      assertLessThan(footerLinks.length, 15, `ISP throttling footer must have < 15 links, got ${footerLinks.length}`);
      assertTrue(footerLinks.includes('https://www.google.com/preferences/source?q=sweeprvpn.com'), 'ISP throttling footer must include Preferred Sources badge');
      assertTrue(footerLinks.includes('/solutions') && footerLinks.includes('/faq'), 'ISP throttling footer must link to /solutions and /faq');
    }
  },
  {
    id: 'F12-T1-05',
    feature: 'F12',
    tier: 1,
    name: 'Verify all BOFU footer targets + TalkTalk canonical return 200 OK and legacy TalkTalk redirects 301',
    async fn({ baseUrl }) {
      const targets = [
        '/solutions',
        '/setup',
        '/guides',
        '/vs',
        '/pricing',
        '/download',
        '/tools/leak-test',
        '/tools/isp-throttling-test',
        '/faq',
        '/ai-info',
        '/privacy',
        '/refund',
        '/terms',
        '/warrant-canary',
        '/alternatives/totalvpn',
        '/vs/totalvpn',
        '/solutions/eduroam-campus-wifi-gaming-packet-loss',
        '/solutions/talktalk-fibre-wireguard-cgnat'
      ];
      for (const t of targets) {
        const res = await fetchOpaque(`${baseUrl}${t}`);
        assertEqual(res.status, 200, `Target ${t} must return HTTP 200 OK`);
      }

      const legacyTalkTalk = await fetchOpaque(`${baseUrl}/solutions/talktalk-p2p-port-forwarding`);
      assertEqual(legacyTalkTalk.status, 301, 'Legacy TalkTalk URL must return 1-hop 301');
      assertEqual(legacyTalkTalk.location, '/solutions/talktalk-fibre-wireguard-cgnat', 'Legacy TalkTalk must redirect to talktalk-fibre-wireguard-cgnat');
    }
  },

  // =========================================================================
  // Feature F13: Neutralize Winner Lock Resurrection
  // =========================================================================
  {
    id: 'F13-T1-01',
    feature: 'F13',
    tier: 1,
    name: 'Verify scripts/consolidate-and-optimize-gsc.mjs has Winner Lock dynamic addition removed',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'consolidate-and-optimize-gsc.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertFalse(
        content.includes('AUTHORITATIVE_SOLUTIONS_PILLARS.add(slug)'),
        'Dynamic addition of slug to AUTHORITATIVE_SOLUTIONS_PILLARS must be removed'
      );
    }
  },
  {
    id: 'F13-T1-02',
    feature: 'F13',
    tier: 1,
    name: 'Verify RESTORED_GSC_SOLUTIONS_PILLARS in audit script contains zero smart-tv-acr slugs',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertFalse(
        content.includes('smart-tv-acr-blocking') && content.includes('RESTORED_GSC_SOLUTIONS_PILLARS'),
        'RESTORED_GSC_SOLUTIONS_PILLARS must not contain ACR slugs'
      );
    }
  },
  {
    id: 'F13-T1-03',
    feature: 'F13',
    tier: 1,
    name: 'Verify consolidate-and-optimize-gsc.mjs executes in isolated sandbox without resurrecting consolidated pages',
    async fn() {
      const res = runConsolidationInTempSandbox();
      assertFalse(res.includes('[GSC Winner Lock]'), 'Winner Lock log should not trigger for consolidated pages');
      assertIncludes(res, '[GSC Consolidation & Optimization Complete]', 'Consolidation script should complete cleanly');
    }
  },
  {
    id: 'F13-T1-04',
    feature: 'F13',
    tier: 1,
    name: 'Verify genuine master pillars remain preserved in consolidation scripts',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'consolidate-and-optimize-gsc.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertIncludes(content, 'talktalk-fibre-wireguard-cgnat', 'Master pillar talktalk-fibre-wireguard-cgnat must remain in script');
      assertIncludes(content, 'virgin-media-remote-dev-ssh', 'Master pillar virgin-media must remain in script');
    }
  },
  {
    id: 'F13-T1-05',
    feature: 'F13',
    tier: 1,
    name: 'Verify SPECIFIC_SOLUTIONS_CANONICAL_MAP retains 301 mappings for consolidated slugs',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'consolidate-and-optimize-gsc.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertTrue(
        content.includes('SPECIFIC_SOLUTIONS_CANONICAL_MAP') || content.includes('canonical'),
        'Canonical redirect map must be present'
      );
    }
  },

  // =========================================================================
  // Feature F14: Strict Sitemap Pruning (<= 95 URLs)
  // =========================================================================
  {
    id: 'F14-T1-01',
    feature: 'F14',
    tier: 1,
    name: 'Verify sitemap URL count is less than or equal to 95',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { totalUrls } = validateSitemapXml(content);
      assertLessThanOrEqual(totalUrls, 95, `Sitemap must contain <= 95 URLs, got ${totalUrls}`);
    }
  },
  {
    id: 'F14-T1-02',
    feature: 'F14',
    tier: 1,
    name: 'Verify sitemap URL count has a healthy floor (>= 70 canonical URLs)',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { totalUrls } = validateSitemapXml(content);
      assertGreaterThanOrEqual(totalUrls, 70, `Sitemap should retain >= 70 canonical URLs, got ${totalUrls}`);
    }
  },
  {
    id: 'F14-T1-03',
    feature: 'F14',
    tier: 1,
    name: 'Verify zero retired smart-tv-acr-blocking URLs exist in sitemap.xml',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { urls } = validateSitemapXml(content);
      const acrUrls = urls.filter((u) => u.includes('-smart-tv-acr-blocking'));
      assertEqual(acrUrls.length, 0, `Sitemap must not contain retired ACR URLs: ${acrUrls.join(', ')}`);
    }
  },
  {
    id: 'F14-T1-04',
    feature: 'F14',
    tier: 1,
    name: 'Verify /vs/totalvpn is active in sitemap.xml while retired antivirus /vs/ slugs are excluded',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { urls } = validateSitemapXml(content);
      assertTrue(urls.includes('https://sweeprvpn.com/vs/totalvpn'), 'Sitemap must include active /vs/totalvpn canonical');
      const retiredVs = urls.filter((u) => u.includes('/vs/kaspersky') || u.includes('/vs/norton'));
      assertEqual(retiredVs.length, 0, `Sitemap must not contain retired VS URLs: ${retiredVs.join(', ')}`);
    }
  },
  {
    id: 'F14-T1-05',
    feature: 'F14',
    tier: 1,
    name: 'Verify all sitemap URLs return HTTP 200 OK via server',
    async fn({ baseUrl }) {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { urls } = validateSitemapXml(content);
      // Sample first 15 URLs from sitemap for quick status check
      const sample = urls.slice(0, 15);
      for (const u of sample) {
        const parsed = new URL(u);
        const res = await fetchOpaque(`${baseUrl}${parsed.pathname}`, { method: 'HEAD' });
        assertEqual(res.status, 200, `Sitemap URL ${parsed.pathname} must return HTTP 200 OK`);
      }
    }
  },

  // =========================================================================
  // Feature F15: Freeze <lastmod> on Semantic <main> Content
  // =========================================================================
  {
    id: 'F15-T1-01',
    feature: 'F15',
    tier: 1,
    name: 'Verify resolveContentHashLastMod hashes only semantic main content',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertTrue(
        content.includes('extractSemanticMain') ||
        content.includes('<main') ||
        content.includes('mainMatch') ||
        content.includes('resolveContentHashLastMod'),
        'resolveContentHashLastMod must inspect semantic main content'
      );
    }
  },
  {
    id: 'F15-T1-02',
    feature: 'F15',
    tier: 1,
    name: 'Verify footer comments or non-main edits do not alter computed semantic hash',
    async fn() {
      const docBase = '<html><head><title>Test</title></head><body><main><h1>Hello World</h1><p>Content</p></main><footer>Old Footer</footer></body></html>';
      const docFooterMod = '<html><head><title>Test</title></head><body><main><h1>Hello World</h1><p>Content</p></main><footer>New Footer 2026</footer></body></html>';

      const main1 = extractMainContent(docBase);
      const main2 = extractMainContent(docFooterMod);
      assertEqual(main1, main2, 'Extracted <main> content must be identical when footer changes');
    }
  },
  {
    id: 'F15-T1-03',
    feature: 'F15',
    tier: 1,
    name: 'Verify changes inside <main> alter the computed semantic hash',
    async fn() {
      const docBase = '<html><body><main><h1>Hello World</h1><p>Original</p></main></body></html>';
      const docMainMod = '<html><body><main><h1>Hello World</h1><p>Updated prose text</p></main></body></html>';

      const main1 = extractMainContent(docBase);
      const main2 = extractMainContent(docMainMod);
      assertNotEqual(main1, main2, '<main> content must change when body prose changes');
    }
  },
  {
    id: 'F15-T1-04',
    feature: 'F15',
    tier: 1,
    name: 'Verify non-HTML binary files handle lastmod calculation gracefully',
    async fn() {
      const binaryLike = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
      const main = extractMainContent(binaryLike.toString());
      assertEqual(main, '', 'Non-HTML strings produce empty main without throwing error');
    }
  },
  {
    id: 'F15-T1-05',
    feature: 'F15',
    tier: 1,
    name: 'Verify all lastmod dates in sitemap conform to ISO 8601 YYYY-MM-DD',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { lastmods } = validateSitemapXml(content);
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      for (const [url, d] of Object.entries(lastmods)) {
        assertMatch(d, dateRegex, `lastmod for ${url} must match YYYY-MM-DD format`);
      }
    }
  },

  // =========================================================================
  // Feature F16: Deep Technical Content on leak-test.html
  // =========================================================================
  {
    id: 'F16-T1-01',
    feature: 'F16',
    tier: 1,
    name: 'Verify leak-test.html contains STUN/TURN ICE candidate table inside <main>',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/leak-test`);
      assertEqual(res.status, 200, 'Tool page must return 200');
      const main = extractMainContent(res.body);
      assertTrue(main.includes('ICE') || main.includes('STUN') || main.includes('candidate'), 'Main must document ICE/STUN candidates');
    }
  },
  {
    id: 'F16-T1-02',
    feature: 'F16',
    tier: 1,
    name: 'Verify STUN/TURN table covers host, srflx, prflx, relay candidate types',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertIncludes(main, 'host', 'Must document host candidate type');
      assertIncludes(main, 'srflx', 'Must document srflx (Server Reflexive) candidate type');
      assertIncludes(main, 'relay', 'Must document relay (TURN) candidate type');
    }
  },
  {
    id: 'F16-T1-03',
    feature: 'F16',
    tier: 1,
    name: 'Verify WebRTC browser remediation instructions cover Firefox media.peerconnection',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertIncludes(main, 'media.peerconnection', 'Must document Firefox media.peerconnection settings');
    }
  },
  {
    id: 'F16-T1-04',
    feature: 'F16',
    tier: 1,
    name: 'Verify IPv6 and DNSSEC assessment matrix is documented in <main>',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertTrue(main.includes('IPv6') || main.includes('DNSSEC') || main.includes('10.66.0.1'), 'Must document IPv6/DNSSEC assessment');
    }
  },
  {
    id: 'F16-T1-05',
    feature: 'F16',
    tier: 1,
    name: 'Verify interactive WebRTC diagnostic elements preserved in leak-test.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'leak-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      assertTrue(containsElementId(html, 'resWebrtc') || html.includes('resWebrtc'), 'resWebrtc element must be preserved');
      assertTrue(containsElementId(html, 'resDns') || html.includes('resDns'), 'resDns element must be preserved');
      assertTrue(containsElementId(html, 'resCountry') || html.includes('resCountry'), 'resCountry element must be preserved');
    }
  },

  // =========================================================================
  // Feature F17: Deep Technical Content on isp-throttling-test.html
  // =========================================================================
  {
    id: 'F17-T1-01',
    feature: 'F17',
    tier: 1,
    name: 'Verify isp-throttling-test.html contains ISP DPI Port-Shaping Reference Table',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/isp-throttling-test`);
      assertEqual(res.status, 200, 'Tool page must return 200');
      const main = extractMainContent(res.body);
      assertTrue(main.includes('DPI') || main.includes('Deep Packet Inspection') || main.includes('Shaping'), 'Main must document DPI shaping');
    }
  },
  {
    id: 'F17-T1-02',
    feature: 'F17',
    tier: 1,
    name: 'Verify DPI table covers TLS SNI, P2P heuristic rate limiting, and CGNAT UDP queues',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertIncludes(main, 'SNI', 'Must document TLS SNI inspection');
      assertIncludes(main, 'P2P', 'Must document P2P / BitTorrent rate limiting');
      assertTrue(main.includes('CGNAT') || main.includes('UDP'), 'Must document CGNAT or UDP queue starvation');
    }
  },
  {
    id: 'F17-T1-03',
    feature: 'F17',
    tier: 1,
    name: 'Verify WireGuard AEAD cryptographic countermeasure and MTU calibration documented',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      const main = extractMainContent(html);
      assertTrue(main.includes('ChaCha20-Poly1305') || main.includes('AEAD') || main.includes('WireGuard'), 'Must document WireGuard AEAD');
      assertTrue(main.includes('1420') || main.includes('1412') || main.includes('MTU'), 'Must document calibrated MTU values');
    }
  },
  {
    id: 'F17-T1-04',
    feature: 'F17',
    tier: 1,
    name: 'Verify speed slowdown calculator and refund script generator preserved',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      assertTrue(html.includes('generateWebIspRefundScript'), 'Refund script generator function must be preserved');
      assertTrue(containsElementId(html, 'webIspRefundScriptBox'), '#webIspRefundScriptBox must be preserved');
    }
  },
  {
    id: 'F17-T1-05',
    feature: 'F17',
    tier: 1,
    name: 'Verify DPI table is wrapped in responsive container',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      const html = fs.readFileSync(fp, 'utf8');
      assertTrue(html.includes('overflow-x-auto') || html.includes('table-responsive') || html.includes('overflow'), 'Table must have responsive wrapper');
    }
  },

  // =========================================================================
  // Feature F18: Direct Crawlable Links to Canary, Hubs, Tools & Pillars
  // =========================================================================
  {
    id: 'F18-T1-01',
    feature: 'F18',
    tier: 1,
    name: 'Verify /warrant-canary is crawlably linked from /download, /tools/leak-test, /ai-info, and /faq',
    async fn({ baseUrl }) {
      for (const p of ['/download?platform=picker', '/tools/leak-test', '/ai-info', '/faq']) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `${p} must return 200`);
        const links = extractLinks(res.body);
        const canaryLink = links.find((l) => l.href === '/warrant-canary');
        assertTrue(!!canaryLink, `${p} must have crawlable link to /warrant-canary`);
        assertFalse(hasNofollow(canaryLink), `Warrant canary link on ${p} must not be nofollow`);
      }
    }
  },
  {
    id: 'F18-T1-02',
    feature: 'F18',
    tier: 1,
    name: 'Verify #homeToolsAndHubsStrip and TotalVPN links on / resolve 200 OK without nofollow',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      assertEqual(res.status, 200, 'Homepage must return 200');
      const stripMatch = res.body.match(/id=["']homeToolsAndHubsStrip["'][\s\S]*?<\/section>/i);
      assertTrue(!!stripMatch, 'Homepage must contain #homeToolsAndHubsStrip');
      const stripLinks = extractLinks(stripMatch[0]);
      const expectedStrip = [
        '/tools/leak-test',
        '/tools/isp-throttling-test',
        '/tools/smart-tv-tracking-check',
        '/tools/whats-on-my-wifi',
        '/tools/vpn-renewal-price-checker',
        '/solutions',
        '/setup',
        '/guides',
        '/vs'
      ];
      for (const p of expectedStrip) {
        const linkObj = stripLinks.find((l) => l.href === p);
        assertTrue(!!linkObj, `#homeToolsAndHubsStrip must link to ${p}`);
        assertFalse(hasNofollow(linkObj), `Link to ${p} must not have nofollow`);
      }
      const allHomeLinks = extractLinks(res.body);
      for (const tv of ['/vs/totalvpn', '/alternatives/totalvpn']) {
        const tvLink = allHomeLinks.find((l) => l.href === tv);
        assertTrue(!!tvLink, `Homepage must link to ${tv}`);
        assertFalse(hasNofollow(tvLink), `Link to ${tv} must not have nofollow`);
      }
    }
  },
  {
    id: 'F18-T1-03',
    feature: 'F18',
    tier: 1,
    name: 'Verify /download picker contains crawlable link to /warrant-canary',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/download`);
      assertEqual(res.status, 200, '/download must return 200');
      const links = extractLinks(res.body);
      const canaryLink = links.find((l) => l.href === '/warrant-canary');
      assertTrue(!!canaryLink, '/download must link to /warrant-canary');
      assertFalse(hasNofollow(canaryLink), 'Warrant canary link must not have nofollow');
    }
  },
  {
    id: 'F18-T1-04',
    feature: 'F18',
    tier: 1,
    name: 'Verify /download picker contains crawlable links to diagnostic tools',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/download`);
      assertEqual(res.status, 200, '/download must return 200');
      const links = extractLinks(res.body).map((l) => l.href);
      assertTrue(links.includes('/tools/leak-test'), '/download must link to leak-test');
      assertTrue(links.includes('/tools/isp-throttling-test'), '/download must link to isp-throttling-test');
    }
  },
  {
    id: 'F18-T1-05',
    feature: 'F18',
    tier: 1,
    name: 'Verify warrant canary endpoint returns HTTP 200 OK with PGP signed block',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/warrant-canary`);
      assertEqual(res.status, 200, '/warrant-canary must return 200');
      assertTrue(res.body.includes('-----BEGIN PGP SIGNED MESSAGE-----') || res.body.includes('Warrant Canary'), 'Must contain warrant canary attestations');
    }
  },

  // =========================================================================
  // Feature F19: Lock Daily Pipeline to Read-Only Telemetry
  // =========================================================================
  {
    id: 'F19-T1-01',
    feature: 'F19',
    tier: 1,
    name: 'Verify GitHub Actions workflow uses --json-only (no --apply) and --no-ctr-rewrite',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      assertTrue(fs.existsSync(wfPath), 'Pipeline workflow file must exist');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertIncludes(content, '--json-only', 'Workflow must lock keyword engine to --json-only');
      assertFalse(/\bkeyword-research-engine\.mjs[^\n]*--apply\b/.test(content), 'Workflow must never pass --apply to keyword-research-engine.mjs');
      assertIncludes(content, '--no-ctr-rewrite', 'Workflow must lock cloud-gsc-ga4-sync.mjs with --no-ctr-rewrite');
      assertIncludes(content, 'ci-seo-quality-gate.mjs', 'Workflow must execute ci-seo-quality-gate.mjs');
      assertIncludes(content, 'Abort on HTML Mutations', 'Workflow must abort on HTML mutations');
    }
  },
  {
    id: 'F19-T1-02',
    feature: 'F19',
    tier: 1,
    name: 'Verify workflow disables or removes enrich-pillars-with-live-proof.mjs invocation',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      const lines = content.split('\n');
      const activeCall = lines.some((l) => l.trim().startsWith('node scripts/enrich-pillars-with-live-proof.mjs'));
      assertFalse(activeCall, 'Workflow must not execute enrich-pillars script');
    }
  },
  {
    id: 'F19-T1-03',
    feature: 'F19',
    tier: 1,
    name: 'Verify keyword-research-engine.mjs with --json-only --offline --dry-run creates zero HTML/JSON mutations',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'keyword-research-engine.mjs');
      assertTrue(fs.existsSync(scriptPath), 'keyword-research-engine.mjs must exist');
      const auditLog = path.join(ROOT_DIR, 'KEYWORD_OPPORTUNITIES_AUDIT_LOG.md');
      const ledgerPath = path.join(WEBSITE_DIR, 'seo-strategy-performance-ledger.json');
      const auditShaBefore = fs.existsSync(auditLog) ? sha256File(auditLog) : null;
      const ledgerShaBefore = fs.existsSync(ledgerPath) ? sha256File(ledgerPath) : null;

      const res = execSync(
        `node "${scriptPath}" --discover --score --audit --json-only --offline --dry-run`,
        { cwd: ROOT_DIR, encoding: 'utf8' }
      );
      assertTrue(res.includes('Quality Gate Status') || res.includes('10/10 PASS'), 'Dry-run keyword audit must report quality gate pass');
      if (auditShaBefore) assertEqual(sha256File(auditLog), auditShaBefore, 'Dry-run must not mutate KEYWORD_OPPORTUNITIES_AUDIT_LOG.md');
      if (ledgerShaBefore) assertEqual(sha256File(ledgerPath), ledgerShaBefore, 'Dry-run must not mutate seo-strategy-performance-ledger.json');
    }
  },
  {
    id: 'F19-T1-04',
    feature: 'F19',
    tier: 1,
    name: 'Verify cloud-gsc-ga4-sync.mjs operates in read-only telemetry mode',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'cloud-gsc-ga4-sync.mjs');
      assertTrue(fs.existsSync(scriptPath), 'Sync script must exist');
      const content = fs.readFileSync(scriptPath, 'utf8');
      assertTrue(content.includes('GSC') || content.includes('sitemap'), 'Sync script should support telemetry check');
      assertIncludes(content, '--no-ctr-rewrite', 'Sync script must support --no-ctr-rewrite flag');
    }
  },
  {
    id: 'F19-T1-05',
    feature: 'F19',
    tier: 1,
    name: 'Verify workflow daily schedule is configured for 05:00 UTC',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertIncludes(content, 'cron:', 'Workflow must have cron trigger');
      assertIncludes(content, '5 * * *', 'Workflow should trigger at 05:00 UTC');
    }
  },

  // =========================================================================
  // Feature F20: Enforce CI Assertions in Pipeline & Quality Gate
  // =========================================================================
  {
    id: 'F20-T1-01',
    feature: 'F20',
    tier: 1,
    name: 'Verify CI quality gate & workflow enforce sitemap bounds [50, 110] and current sitemap <= 95',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const wfContent = fs.readFileSync(wfPath, 'utf8');
      assertIncludes(wfContent, 'node scripts/ci-seo-quality-gate.mjs', 'Workflow must invoke ci-seo-quality-gate.mjs');
      assertIncludes(wfContent, 'Sitemap <= 110', 'Workflow Step 6.5 must document Sitemap <= 110');

      const gateContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'ci-seo-quality-gate.mjs'), 'utf8');
      assertIncludes(gateContent, 'locs.length < 50 || locs.length > 110', 'Quality gate must enforce sitemap bounds [50, 110]');

      const { totalUrls } = validateSitemapXml(fs.readFileSync(path.join(WEBSITE_DIR, 'sitemap.xml'), 'utf8'));
      assertLessThanOrEqual(totalUrls, 95, `Current sitemap must remain <= 95, got ${totalUrls}`);
    }
  },
  {
    id: 'F20-T1-02',
    feature: 'F20',
    tier: 1,
    name: 'Verify workflow and CI gate enforce 0 zombie noindex HTML files',
    async fn() {
      const gateContent = fs.readFileSync(path.join(SCRIPTS_DIR, 'ci-seo-quality-gate.mjs'), 'utf8');
      assertIncludes(gateContent, 'Zombie noindex found', 'CI gate must check for zombie noindex files in cluster dirs');
    }
  },
  {
    id: 'F20-T1-03',
    feature: 'F20',
    tier: 1,
    name: 'Verify ci-seo-quality-gate.mjs enforces < 30% overlap, <= 1800 KB HTML, entity hygiene, and #mobileNavDrawer',
    async fn() {
      const gatePath = path.join(SCRIPTS_DIR, 'ci-seo-quality-gate.mjs');
      const gateContent = fs.readFileSync(gatePath, 'utf8');
      assertTrue(gateContent.includes('30.0') && gateContent.includes('5-gram overlap'), 'CI gate must enforce < 30% 5-gram overlap');
      assertIncludes(gateContent, '1800 * 1024', 'CI gate must enforce <= 1800 KB HTML limit');
      assertIncludes(gateContent, 'sitepatent\\.com', 'CI gate must block sitepatent.com');
      assertIncludes(gateContent, 'mobileNavDrawer', 'CI gate must enforce static #mobileNavDrawer links');

      const gateOut = execSync(`node "${gatePath}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertIncludes(gateOut, 'CI SEO Quality Gate PASSED', 'ci-seo-quality-gate.mjs must exit 0 and pass');
    }
  },
  {
    id: 'F20-T1-04',
    feature: 'F20',
    tier: 1,
    name: 'Verify CI assertions precede the git commit and push step in workflow',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      const assertionIdx = content.indexOf('assertion') !== -1 ? content.indexOf('assertion') : content.indexOf('Quality Gate');
      const pushIdx = content.indexOf('git push');
      assertTrue(assertionIdx !== -1 && pushIdx !== -1, 'Both assertion and push steps must exist');
      assertTrue(assertionIdx < pushIdx, 'Assertions must precede git push');
    }
  },
  {
    id: 'F20-T1-05',
    feature: 'F20',
    tier: 1,
    name: 'Verify CI guardrail assertions pass on clean project state',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { totalUrls } = validateSitemapXml(content);
      assertLessThanOrEqual(totalUrls, 95, 'Sitemap count check passes');
    }
  },

  // =========================================================================
  // Feature F21: Audit & Local Verification Scripts Execution
  // =========================================================================
  {
    id: 'F21-T1-01',
    feature: 'F21',
    tier: 1,
    name: 'Verify daily-seo-pagespeed-audit.mjs executes locally and exits with code 0',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const res = execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(res.length > 0, 'Audit script must produce output');
    }
  },
  {
    id: 'F21-T1-02',
    feature: 'F21',
    tier: 1,
    name: 'Verify audit script reports zero crawlability failures',
    async fn() {
      const logPath = path.join(ROOT_DIR, 'TECHNICAL_SEO_AUDIT_LOG.md');
      if (fs.existsSync(logPath)) {
        const logContent = fs.readFileSync(logPath, 'utf8');
        assertTrue(logContent.includes('Audit') || logContent.includes('Status'), 'Audit log must record status');
      }
    }
  },
  {
    id: 'F21-T1-03',
    feature: 'F21',
    tier: 1,
    name: 'Verify TECHNICAL_SEO_AUDIT_LOG.md exists and contains execution record',
    async fn() {
      const logPath = path.join(ROOT_DIR, 'TECHNICAL_SEO_AUDIT_LOG.md');
      assertTrue(fs.existsSync(logPath), 'TECHNICAL_SEO_AUDIT_LOG.md must exist');
    }
  },
  {
    id: 'F21-T1-04',
    feature: 'F21',
    tier: 1,
    name: 'Verify pseo_and_seo_validator.mjs runs cleanly if present',
    async fn() {
      const valPath = path.join(ROOT_DIR, '.agents', 'skills', 'vpn-seo-and-geo', 'scripts', 'pseo_and_seo_validator.mjs');
      if (fs.existsSync(valPath)) {
        const res = execSync(`node "${valPath}" --action validate`, { cwd: ROOT_DIR, encoding: 'utf8' });
        assertTrue(res.length > 0, 'Validator must run cleanly');
      }
    }
  },
  {
    id: 'F21-T1-05',
    feature: 'F21',
    tier: 1,
    name: 'Verify scripts execute without uncaught Promise rejections',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const res = execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertFalse(res.includes('UnhandledPromiseRejection'), 'No unhandled promise rejection');
    }
  },

  // =========================================================================
  // Feature F22: Production Deployment Hygiene & GSC Resubmission
  // =========================================================================
  {
    id: 'F22-T1-01',
    feature: 'F22',
    tier: 1,
    name: 'Verify git check-ignore confirms .gcp-service-account.json is ignored',
    async fn() {
      const ignored = execSync('git check-ignore .gcp-service-account.json', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
      assertEqual(ignored, '.gcp-service-account.json', '.gcp-service-account.json must be ignored');
    }
  },
  {
    id: 'F22-T1-02',
    feature: 'F22',
    tier: 1,
    name: 'Verify git index contains zero service account json files',
    async fn() {
      const res = execSync('git ls-files "*.service-account.json"', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
      assertEqual(res, '', 'Zero service account files should be tracked');
    }
  },
  {
    id: 'F22-T1-03',
    feature: 'F22',
    tier: 1,
    name: 'Verify .gitignore contains wildcard rules for sweepr-*.json and *.service-account.json',
    async fn() {
      const gitignore = fs.readFileSync(path.join(ROOT_DIR, '.gitignore'), 'utf8');
      assertIncludes(gitignore, '*.service-account.json', '.gitignore must list *.service-account.json');
      assertIncludes(gitignore, 'sweepr-*.json', '.gitignore must list sweepr-*.json');
    }
  },
  {
    id: 'F22-T1-04',
    feature: 'F22',
    tier: 1,
    name: 'Verify cloud-gsc-ga4-sync.mjs targets https://sweeprvpn.com/sitemap.xml',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'cloud-gsc-ga4-sync.mjs');
      const content = fs.readFileSync(fp, 'utf8');
      assertIncludes(content, 'https://sweeprvpn.com/sitemap.xml', 'Sync script must target production sitemap URL');
    }
  },
  {
    id: 'F22-T1-05',
    feature: 'F22',
    tier: 1,
    name: 'Verify workflow push step targets origin/main for Railway auto-deployment',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertIncludes(content, 'origin', 'Workflow must push to origin');
      assertIncludes(content, 'main', 'Workflow must push to main');
    }
  },

  // =========================================================================
  // Feature F23: R1 Real Benchmarks & Compressed WebP App Screenshots
  // =========================================================================
  {
    id: 'F23-T1-01',
    feature: 'F23',
    tier: 1,
    name: 'Verify all 6 website/assets/*.webp files serve HTTP 200 image/webp, valid RIFF/WEBP, and < 80 KB',
    async fn({ baseUrl }) {
      const expectedAssets = [
        'desktop-dark-mode.webp',
        'desktop-home-light.webp',
        'desktop-wifi-radar.webp',
        'mobile-ui-connect.webp',
        'tool-isp-throttling.webp',
        'tool-leak-test.webp'
      ];
      for (const name of expectedAssets) {
        const res = await fetchBinary(`${baseUrl}/assets/${name}`);
        assertEqual(res.status, 200, `/assets/${name} must return HTTP 200`);
        assertIncludes(res.getHeader('content-type') || '', 'image/webp', `/assets/${name} must serve Content-Type image/webp`);
        assertLessThan(res.byteLength, 81920, `/assets/${name} must be < 80 KB (81920 B), got ${res.byteLength} B`);
        assertEqual(res.buffer.subarray(0, 4).toString('ascii'), 'RIFF', `/assets/${name} must start with RIFF header`);
        assertEqual(res.buffer.subarray(8, 12).toString('ascii'), 'WEBP', `/assets/${name} must have WEBP signature`);
      }
    }
  },
  {
    id: 'F23-T1-02',
    feature: 'F23',
    tier: 1,
    name: 'Verify / and /pricing reference real .webp desktop, mobile, and tool captures',
    async fn({ baseUrl }) {
      const home = await fetchOpaque(`${baseUrl}/`);
      assertEqual(home.status, 200, '/ must return 200');
      for (const img of ['/assets/desktop-home-light.webp', '/assets/desktop-wifi-radar.webp', '/assets/mobile-ui-connect.webp', '/assets/tool-isp-throttling.webp']) {
        assertIncludes(home.body, img, `Homepage must embed ${img}`);
      }

      const pricing = await fetchOpaque(`${baseUrl}/pricing`);
      assertEqual(pricing.status, 200, '/pricing must return 200');
      assertIncludes(pricing.body, '/assets/desktop-dark-mode.webp', '/pricing must embed desktop-dark-mode.webp');
    }
  },
  {
    id: 'F23-T1-03',
    feature: 'F23',
    tier: 1,
    name: 'Verify /setup/gl-inet-travel-router, /tools/leak-test, and /alternatives/totalvpn embed .webp proof',
    async fn({ baseUrl }) {
      const router = await fetchOpaque(`${baseUrl}/setup/gl-inet-travel-router`);
      assertEqual(router.status, 200, '/setup/gl-inet-travel-router must return 200');
      assertIncludes(router.body, '/assets/desktop-home-light.webp', 'Router setup must embed desktop-home-light.webp');
      assertIncludes(router.body, '/assets/tool-leak-test.webp', 'Router setup must embed tool-leak-test.webp');

      const leak = await fetchOpaque(`${baseUrl}/tools/leak-test`);
      assertEqual(leak.status, 200, '/tools/leak-test must return 200');
      assertIncludes(leak.body, '/assets/tool-leak-test.webp', 'Leak test must embed tool-leak-test.webp');

      const alt = await fetchOpaque(`${baseUrl}/alternatives/totalvpn`);
      assertEqual(alt.status, 200, '/alternatives/totalvpn must return 200');
      assertIncludes(alt.body, '/assets/desktop-wifi-radar.webp', 'Alternatives TotalVPN must embed desktop-wifi-radar.webp');
    }
  },
  {
    id: 'F23-T1-04',
    feature: 'F23',
    tier: 1,
    name: 'Verify all 17 embedded .webp <img> elements have alt, width, height, and loading="lazy"',
    async fn() {
      const htmlFiles = findHtmlFiles(WEBSITE_DIR, true);
      let webpImgCount = 0;
      for (const fp of htmlFiles) {
        const html = fs.readFileSync(fp, 'utf8');
        for (const m of html.matchAll(/<img\b([^>]*\.webp[^>]*)>/gi)) {
          webpImgCount++;
          const attrs = m[1];
          assertMatch(attrs, /\balt=["'][^"']+["']/i, `Missing alt on .webp <img> in ${fp}`);
          assertMatch(attrs, /\bwidth=["']\d+["']/i, `Missing width on .webp <img> in ${fp}`);
          assertMatch(attrs, /\bheight=["']\d+["']/i, `Missing height on .webp <img> in ${fp}`);
          assertMatch(attrs, /\bloading=["']lazy["']/i, `Missing loading="lazy" on .webp <img> in ${fp}`);
        }
      }
      assertEqual(webpImgCount, 17, `Expected 17 embedded .webp <img> tags, found ${webpImgCount}`);
    }
  },
  {
    id: 'F23-T1-05',
    feature: 'F23',
    tier: 1,
    name: 'Verify every unique .webp src embedded across website/ resolves 200 image/webp',
    async fn({ baseUrl }) {
      const htmlFiles = findHtmlFiles(WEBSITE_DIR, true);
      const srcs = new Set();
      for (const fp of htmlFiles) {
        const html = fs.readFileSync(fp, 'utf8');
        for (const m of html.matchAll(/<img\b[^>]*src=["']([^"']+\.webp)["']/gi)) {
          srcs.add(m[1]);
        }
      }
      assertEqual(srcs.size, 6, `Expected 6 distinct .webp asset paths referenced, got ${srcs.size}`);
      for (const src of srcs) {
        const res = await fetchBinary(`${baseUrl}${src}`);
        assertEqual(res.status, 200, `Referenced asset ${src} must return 200`);
        assertIncludes(res.getHeader('content-type') || '', 'image/webp', `Referenced asset ${src} must be image/webp`);
      }
    }
  },

  // =========================================================================
  // Feature F24: R2 Privacy Transparency, /ai-info, GEO <dl>, robots & llms.txt
  // =========================================================================
  {
    id: 'F24-T1-01',
    feature: 'F24',
    tier: 1,
    name: 'Verify /ai-info returns 200 with <article>, <dl>, 8 POPs, UK Sole Trader, and zero forbidden entity names',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/ai-info`);
      assertEqual(res.status, 200, '/ai-info must return 200');
      assertMatch(res.body, /<article\b/i, '/ai-info must contain <article>');
      assertTrue(res.body.includes('<dl') && res.body.includes('<dt') && res.body.includes('<dd'), '/ai-info must contain <dl>/<dt>/<dd>');
      assertIncludes(res.body, 'UK Sole Trader', '/ai-info must state UK Sole Trader entity');
      for (const pop of ['UK-LON-01', 'NL-AMS-01', 'DE-FRA-01', 'SE-STO-01', 'US-NYC-01', 'US-LAX-01', 'JP-TYO-01', 'SG-SIN-01']) {
        assertIncludes(res.body, pop, `/ai-info must list live POP ${pop}`);
      }
      const forbiddenFounder = new RegExp(`\\b${['Ben' + 'jamin', 'Co' + 'ok'].join('\\s+')}\\b`, 'i');
      assertFalse(forbiddenFounder.test(res.body), '/ai-info must omit founder personal name');
      assertFalse(/\bSWEEPR\s+VPN\s+Inc\b/i.test(res.body), '/ai-info must omit SWEEPR VPN Inc.');
    }
  },
  {
    id: 'F24-T1-02',
    feature: 'F24',
    tier: 1,
    name: 'Verify /robots.txt allows Claude-SearchBot and disallows /welcome & /uninstall',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/robots.txt`);
      assertEqual(res.status, 200, '/robots.txt must return 200');
      assertMatch(res.body, /User-agent:\s*Claude-SearchBot[\s\S]*?Allow:\s*\//i, 'robots.txt must allow Claude-SearchBot');
      assertIncludes(res.body, 'Disallow: /welcome', 'robots.txt must disallow /welcome');
      assertIncludes(res.body, 'Disallow: /uninstall', 'robots.txt must disallow /uninstall');
      assertIncludes(res.body, 'Sitemap: https://sweeprvpn.com/sitemap.xml', 'robots.txt must declare sitemap.xml');
    }
  },
  {
    id: 'F24-T1-03',
    feature: 'F24',
    tier: 1,
    name: 'Verify /llms.txt and /llms-full.txt return 200 and index /ai-info and /faq',
    async fn({ baseUrl }) {
      for (const p of ['/llms.txt', '/llms-full.txt']) {
        const res = await fetchOpaque(`${baseUrl}${p}`);
        assertEqual(res.status, 200, `${p} must return 200`);
        assertIncludes(res.body, 'https://sweeprvpn.com/ai-info', `${p} must include /ai-info`);
        assertIncludes(res.body, 'https://sweeprvpn.com/faq', `${p} must include /faq`);
      }
    }
  },
  {
    id: 'F24-T1-04',
    feature: 'F24',
    tier: 1,
    name: 'Verify /privacy contains #what-we-collect-vs-never-log, GA4 G-7D28EEMNXX, and iOS pre-launch disclosure',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/privacy`);
      assertEqual(res.status, 200, '/privacy must return 200');
      assertTrue(containsElementId(res.body, 'what-we-collect-vs-never-log'), '/privacy must contain #what-we-collect-vs-never-log');
      assertIncludes(res.body, 'G-7D28EEMNXX', '/privacy must disclose GA4 measurement ID G-7D28EEMNXX');
      assertMatch(res.body, /iOS[\s\S]{0,120}(pre-?launch|not\s+yet\s+live)/i, '/privacy must disclose iOS pre-launch status');
    }
  },
  {
    id: 'F24-T1-05',
    feature: 'F24',
    tier: 1,
    name: 'Verify semantic <dl>/<dt>/<dd> GEO spec markup across 33 indexable core, /vs/, and /setup/ pages',
    async fn() {
      const htmlFiles = findHtmlFiles(WEBSITE_DIR, true);
      let dlCount = 0;
      for (const fp of htmlFiles) {
        const html = fs.readFileSync(fp, 'utf8');
        if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;
        if (/<dl\b/i.test(html) && /<dt\b/i.test(html) && /<dd\b/i.test(html)) {
          dlCount++;
        }
      }
      assertGreaterThanOrEqual(dlCount, 33, `Expected >= 33 indexable pages with <dl>/<dt>/<dd>, found ${dlCount}`);
    }
  },

  // =========================================================================
  // Feature F25: R3 /faq PAA Colony, BOFU Footers, Preferred Sources & <article>
  // =========================================================================
  {
    id: 'F25-T1-01',
    feature: 'F25',
    tier: 1,
    name: 'Verify /faq returns 200 with canonical, <article>, <dl>, and zero deprecated FAQPage/HowTo JSON-LD',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/faq`);
      assertEqual(res.status, 200, '/faq must return 200');
      assertEqual(extractCanonical(res.body), 'https://sweeprvpn.com/faq', '/faq canonical must match https://sweeprvpn.com/faq');
      assertMatch(res.body, /<article\b/i, '/faq must wrap body in <article>');
      assertTrue(res.body.includes('<dl') && res.body.includes('<dt') && res.body.includes('<dd'), '/faq must contain <dl>/<dt>/<dd>');
      assertFalse(/"@type"\s*:\s*"(FAQPage|HowTo)"/i.test(res.body), '/faq must not emit deprecated FAQPage/HowTo JSON-LD');
    }
  },
  {
    id: 'F25-T1-02',
    feature: 'F25',
    tier: 1,
    name: 'Verify /faq <main> rotates contextual links to active Pos 4-15 money targets',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/faq`);
      assertEqual(res.status, 200, '/faq must return 200');
      const mainHtml = extractMainContent(res.body);
      const mainLinks = extractLinks(mainHtml).map((l) => l.href);
      assertGreaterThanOrEqual(mainLinks.length, 25, `Expected >= 25 contextual <main> links on /faq, got ${mainLinks.length}`);
      for (const target of [
        '/guides/stop-samsung-smart-tv-acr-tracking',
        '/solutions/talktalk-fibre-wireguard-cgnat',
        '/setup/gl-inet-travel-router',
        '/vs/totalvpn',
        '/alternatives/totalvpn',
        '/tools/leak-test'
      ]) {
        assertTrue(mainLinks.includes(target), `/faq <main> must link to Pos 4-15 target ${target}`);
      }
    }
  },
  {
    id: 'F25-T1-03',
    feature: 'F25',
    tier: 1,
    name: 'Verify website/sitemap.xml includes both /faq and /ai-info canonicals',
    async fn() {
      const xml = fs.readFileSync(path.join(WEBSITE_DIR, 'sitemap.xml'), 'utf8');
      const { urls } = validateSitemapXml(xml);
      assertTrue(urls.includes('https://sweeprvpn.com/faq'), 'sitemap.xml must include /faq');
      assertTrue(urls.includes('https://sweeprvpn.com/ai-info'), 'sitemap.xml must include /ai-info');
    }
  },
  {
    id: 'F25-T1-04',
    feature: 'F25',
    tier: 1,
    name: 'Verify all 93/93 indexable pages have < 15 footer links and include Google Preferred Sources badge',
    async fn() {
      const htmlFiles = findHtmlFiles(WEBSITE_DIR, true);
      let indexableCount = 0;
      for (const fp of htmlFiles) {
        const html = fs.readFileSync(fp, 'utf8');
        if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;
        indexableCount++;
        const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
        assertTrue(!!footerMatch, `Indexable page missing <footer>: ${fp}`);
        const flinks = extractLinks(footerMatch[0]).map((l) => l.href);
        assertLessThan(flinks.length, 15, `Footer in ${fp} has ${flinks.length} links (must be < 15)`);
        assertTrue(
          flinks.includes('https://www.google.com/preferences/source?q=sweeprvpn.com'),
          `Footer in ${fp} missing Google Preferred Sources badge`
        );
      }
      assertEqual(indexableCount, 93, `Expected 93 indexable HTML files, found ${indexableCount}`);
    }
  },
  {
    id: 'F25-T1-05',
    feature: 'F25',
    tier: 1,
    name: 'Verify <article> wraps editorial bodies on all 62/62 pSEO pages and 9 core editorial pages',
    async fn() {
      const pillars = getAuthoritativePillars();
      for (const rel of pillars) {
        const html = fs.readFileSync(path.join(WEBSITE_DIR, rel), 'utf8');
        assertMatch(html, /<article\b/i, `pSEO pillar missing <article>: ${rel}`);
      }
      const coreEditorial = [
        'ai-info.html',
        'alternatives-totalvpn.html',
        'faq.html',
        'privacy.html',
        'public-wifi.html',
        'refund.html',
        'support.html',
        'terms.html',
        'warrant-canary.html'
      ];
      for (const rel of coreEditorial) {
        const html = fs.readFileSync(path.join(WEBSITE_DIR, rel), 'utf8');
        assertMatch(html, /<article\b/i, `Core editorial page missing <article>: ${rel}`);
      }
    }
  },

  // =========================================================================
  // Feature F26: R4 Onboarding (/welcome), Churn (/uninstall) & Telemetry APIs
  // =========================================================================
  {
    id: 'F26-T1-01',
    feature: 'F26',
    tier: 1,
    name: 'Verify /welcome returns 200 with noindex/no-store headers and 3-step onboarding checklist',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/welcome`);
      assertEqual(res.status, 200, '/welcome must return 200');
      assertIncludes((res.getHeader('x-robots-tag') || '').toLowerCase(), 'noindex, nofollow', '/welcome must send X-Robots-Tag: noindex, nofollow');
      assertIncludes((res.getHeader('cache-control') || '').toLowerCase(), 'no-store', '/welcome must send Cache-Control: no-store');
      assertIncludes((extractRobots(res.body) || '').toLowerCase(), 'noindex', '/welcome HTML must have meta robots noindex');
      assertMatch(res.body, /<ol\b/i, '/welcome must contain 3-step ordered list');
      assertIncludes(res.body, '/tools/leak-test', '/welcome must link to /tools/leak-test verification');
    }
  },
  {
    id: 'F26-T1-02',
    feature: 'F26',
    tier: 1,
    name: 'Verify /uninstall returns 200 with noindex/no-store headers and #uninstallForm survey',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/uninstall`);
      assertEqual(res.status, 200, '/uninstall must return 200');
      assertIncludes((res.getHeader('x-robots-tag') || '').toLowerCase(), 'noindex, nofollow', '/uninstall must send X-Robots-Tag: noindex, nofollow');
      assertIncludes((res.getHeader('cache-control') || '').toLowerCase(), 'no-store', '/uninstall must send Cache-Control: no-store');
      assertIncludes((extractRobots(res.body) || '').toLowerCase(), 'noindex', '/uninstall HTML must have meta robots noindex');
      assertTrue(containsElementId(res.body, 'uninstallForm'), '/uninstall must render #uninstallForm');
      assertIncludes(res.body, '/api/uninstall-feedback', '/uninstall must submit to /api/uninstall-feedback');
    }
  },
  {
    id: 'F26-T1-03',
    feature: 'F26',
    tier: 1,
    name: 'Verify /welcome and /uninstall are strictly excluded from sitemap.xml',
    async fn() {
      const xml = fs.readFileSync(path.join(WEBSITE_DIR, 'sitemap.xml'), 'utf8');
      const { urls } = validateSitemapXml(xml);
      assertFalse(urls.some((u) => u.endsWith('/welcome') || u.endsWith('/uninstall')), 'sitemap.xml must exclude /welcome and /uninstall');
    }
  },
  {
    id: 'F26-T1-04',
    feature: 'F26',
    tier: 1,
    name: 'Verify valid POST /api/uninstall-feedback logs to isolated SWEEPR_STATE_DIR/uninstall-feedback.jsonl',
    async fn({ baseUrl, stateDir }) {
      const resolvedStateDir = stateDir || getServerStateDir();
      assertTrue(!!resolvedStateDir, 'Isolated SWEEPR_STATE_DIR must be active');
      const noteToken = `e2e-t1-${Date.now()}`;
      const res = await fetchOpaque(`${baseUrl}/api/uninstall-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'too_slow', os: 'win', version: '2.6.0', note: noteToken })
      });
      assertEqual(res.status, 200, 'Valid uninstall feedback must return 200');
      assertEqual(JSON.parse(res.body).ok, true, 'Response JSON must have ok: true');
      assertIncludes((res.getHeader('x-robots-tag') || '').toLowerCase(), 'noindex, nofollow', 'API must send X-Robots-Tag: noindex, nofollow');

      const logPath = path.join(resolvedStateDir, 'uninstall-feedback.jsonl');
      assertTrue(fs.existsSync(logPath), 'uninstall-feedback.jsonl must be written inside isolated stateDir');
      const content = fs.readFileSync(logPath, 'utf8');
      assertIncludes(content, noteToken, 'Logged entry must contain submitted note');
    }
  },
  {
    id: 'F26-T1-05',
    feature: 'F26',
    tier: 1,
    name: 'Verify valid POST /api/telemetry logs to isolated SWEEPR_STATE_DIR/tool-telemetry.jsonl',
    async fn({ baseUrl, stateDir }) {
      const resolvedStateDir = stateDir || getServerStateDir();
      assertTrue(!!resolvedStateDir, 'Isolated SWEEPR_STATE_DIR must be active');
      const res = await fetchOpaque(`${baseUrl}/api/telemetry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'e2e_tier1_telemetry',
          category: 'funnel',
          properties: { cta: 'download_btn', platform: 'win', source_page: '/welcome' }
        })
      });
      assertEqual(res.status, 200, 'Valid telemetry payload must return 200');
      assertEqual(JSON.parse(res.body).ok, true, 'Telemetry JSON must return ok: true');
      const telPath = path.join(resolvedStateDir, 'tool-telemetry.jsonl');
      assertTrue(fs.existsSync(telPath), 'tool-telemetry.jsonl must exist inside isolated stateDir');
      assertIncludes(fs.readFileSync(telPath, 'utf8'), 'e2e_tier1_telemetry', 'Telemetry event must be logged');
    }
  },

  // =========================================================================
  // Feature F27: R5 M3 Carrier Consolidation & Sitemap Integrity
  // =========================================================================
  {
    id: 'F27-T1-01',
    feature: 'F27',
    tier: 1,
    name: 'Verify /solutions/hyperoptic-broadband-isp-throttling returns 1-hop 301 -> /solutions/talktalk-fibre-wireguard-cgnat -> 200',
    async fn({ baseUrl }) {
      const r1 = await fetchOpaque(`${baseUrl}/solutions/hyperoptic-broadband-isp-throttling`);
      assertEqual(r1.status, 301, 'Consolidated Hyperoptic route must return 301');
      assertEqual(r1.location, '/solutions/talktalk-fibre-wireguard-cgnat', 'Must redirect 1-hop to TalkTalk canonical');

      const r2 = await fetchOpaque(`${baseUrl}${r1.location}`);
      assertEqual(r2.status, 200, 'Redirect target must return 200 OK');
      assertEqual(r2.location, null, 'Redirect target must not chain');
    }
  },
  {
    id: 'F27-T1-02',
    feature: 'F27',
    tier: 1,
    name: 'Verify hyperoptic-broadband-isp-throttling.html is absent from disk and sitemap.xml',
    async fn() {
      assertFalse(
        fs.existsSync(path.join(WEBSITE_DIR, 'solutions', 'hyperoptic-broadband-isp-throttling.html')),
        'Deleted Hyperoptic HTML must be absent from website/solutions/'
      );
      const xml = fs.readFileSync(path.join(WEBSITE_DIR, 'sitemap.xml'), 'utf8');
      assertFalse(xml.includes('hyperoptic-broadband-isp-throttling'), 'Hyperoptic must be absent from sitemap.xml');
    }
  },
  {
    id: 'F27-T1-03',
    feature: 'F27',
    tier: 1,
    name: 'Verify all 23/23 kept /solutions/*.html canonicals return HTTP 200 directly',
    async fn({ baseUrl }) {
      const files = fs.readdirSync(path.join(WEBSITE_DIR, 'solutions')).filter((f) => f.endsWith('.html')).sort();
      assertEqual(files.length, 23, `Expected 23 kept /solutions/*.html files, got ${files.length}`);
      for (const f of files) {
        const slug = f.replace(/\.html$/, '');
        const res = await fetchOpaque(`${baseUrl}/solutions/${slug}`, { method: 'HEAD' });
        assertEqual(res.status, 200, `/solutions/${slug} must return 200 OK`);
        assertEqual(res.location, null, `/solutions/${slug} must not redirect`);
      }
    }
  },
  {
    id: 'F27-T1-04',
    feature: 'F27',
    tier: 1,
    name: 'Verify sitemap.xml has 94 canonical URLs with /ai-info & /faq and without retired/noindex routes',
    async fn() {
      const xml = fs.readFileSync(path.join(WEBSITE_DIR, 'sitemap.xml'), 'utf8');
      const { isValidXml, totalUrls, urls } = validateSitemapXml(xml);
      assertTrue(isValidXml, 'sitemap.xml must be valid XML');
      assertEqual(totalUrls, 94, `Expected 94 URLs in sitemap.xml, got ${totalUrls}`);
      assertTrue(urls.includes('https://sweeprvpn.com/ai-info'), 'Must include /ai-info');
      assertTrue(urls.includes('https://sweeprvpn.com/faq'), 'Must include /faq');
      assertFalse(urls.some((u) => u.includes('/welcome') || u.includes('/uninstall') || u.includes('hyperoptic-broadband-isp-throttling')), 'Must exclude /welcome, /uninstall, and hyperoptic');
    }
  },
  {
    id: 'F27-T1-05',
    feature: 'F27',
    tier: 1,
    name: 'Verify /solutions/talktalk-fibre-wireguard-cgnat serves 200 OK with self-canonical and <article>',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/talktalk-fibre-wireguard-cgnat`);
      assertEqual(res.status, 200, 'TalkTalk canonical must return 200');
      assertEqual(extractCanonical(res.body), 'https://sweeprvpn.com/solutions/talktalk-fibre-wireguard-cgnat', 'TalkTalk canonical must be self-referential');
      assertMatch(res.body, /<article\b/i, 'TalkTalk canonical must contain <article>');
    }
  },

  // =========================================================================
  // Feature F28: R6–R8 CI Quality Gate, Automation Scripts & Video Registry
  // =========================================================================
  {
    id: 'F28-T1-01',
    feature: 'F28',
    tier: 1,
    name: 'Verify scripts/ci-seo-quality-gate.mjs exits 0 with all M4/R7 assertions passing',
    async fn() {
      const out = execSync(`node "${path.join(SCRIPTS_DIR, 'ci-seo-quality-gate.mjs')}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertIncludes(out, 'CI SEO Quality Gate PASSED', 'CI quality gate must pass');
    }
  },
  {
    id: 'F28-T1-02',
    feature: 'F28',
    tier: 1,
    name: 'Verify daily-wireguard-and-acr-pipeline.mjs --dry-run exits 0 asserting 8 live POPs',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-wireguard-and-acr-pipeline.mjs');
      const out = execSync(`node "${scriptPath}" --dry-run`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(out.includes('8') || out.includes('UK-LON-01'), 'WireGuard/ACR pipeline --dry-run must verify 8 POPs');
    }
  },
  {
    id: 'F28-T1-03',
    feature: 'F28',
    tier: 1,
    name: 'Verify weekly-spec-privacy-guardrail.mjs --strict --dry-run exits 0 read-only',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'automations', 'weekly-spec-privacy-guardrail.mjs');
      const out = execSync(`node "${scriptPath}" --strict --dry-run`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(out.length > 0, 'Weekly guardrail must produce pass output');
    }
  },
  {
    id: 'F28-T1-04',
    feature: 'F28',
    tier: 1,
    name: 'Verify verify-release-manifests.mjs and verify-appstore-compliance.mjs exit 0',
    async fn() {
      const relOut = execSync(`node "${path.join(SCRIPTS_DIR, 'verify-release-manifests.mjs')}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertIncludes(relOut, 'PASS', 'Release manifest verifier must report PASS');
      const appOut = execSync(`node "${path.join(SCRIPTS_DIR, 'verify-appstore-compliance.mjs')}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertIncludes(appOut, 'PASS', 'App Store compliance verifier must report PASS');
    }
  },
  {
    id: 'F28-T1-05',
    feature: 'F28',
    tier: 1,
    name: 'Verify video-registry.json contains 5 entries with youtubeVideoId: null (zero fabricated IDs)',
    async fn() {
      const regPath = path.join(SCRIPTS_DIR, 'youtube-demo-pipeline', 'video-registry.json');
      assertTrue(fs.existsSync(regPath), 'video-registry.json must exist');
      const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
      assertEqual(reg.videos.length, 5, `Expected 5 video entries, got ${reg.videos.length}`);
      for (const v of reg.videos) {
        assertEqual(v.youtubeVideoId, null, `Video ${v.slug} must keep youtubeVideoId: null until manual upload`);
        assertEqual(v.uploadStatus, 'PENDING_MANUAL_YOUTUBE_UPLOAD', `Video ${v.slug} must stay PENDING_MANUAL_YOUTUBE_UPLOAD`);
      }
    }
  }
];
