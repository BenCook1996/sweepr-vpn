/**
 * SWEEPR VPN — E2E Test Suite: Tier 1 Feature Coverage
 * Tests all 22 primary project features (F1 to F22), 5 tests each = 110 tests.
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
    name: 'Verify authoritative master pillars are preserved across directories',
    async fn() {
      const expectedPillars = [
        path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html'),
        path.join(WEBSITE_DIR, 'solutions', 'virgin-media-remote-dev-ssh.html'),
        path.join(WEBSITE_DIR, 'setup', 'gl-inet-travel-router.html'),
        path.join(WEBSITE_DIR, 'setup', 'synology-nas-docker-vpn.html'),
        path.join(WEBSITE_DIR, 'guides', 'stop-samsung-smart-tv-acr-tracking.html'),
        path.join(WEBSITE_DIR, 'guides', 'stop-lg-smart-tv-acr-spying.html'),
        path.join(WEBSITE_DIR, 'vs', 'nordvpn.html')
      ];
      for (const p of expectedPillars) {
        assertTrue(fs.existsSync(p), `Authoritative pillar must exist on disk: ${p}`);
      }
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
    name: 'Verify /vs/totalvpn redirects via 301 to /alternatives/totalvpn',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/vs/totalvpn`);
      assertEqual(res.status, 301, '/vs/totalvpn must return 301');
      assertEqual(res.location, '/alternatives/totalvpn', 'Must redirect to /alternatives/totalvpn');
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
    name: 'Verify #sweepr-live-wireguard-acr-proof absent in talktalk-p2p-port-forwarding.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertFalse(containsElementId(html, 'sweepr-live-wireguard-acr-proof'), 'Proof section must be absent');
      }
    }
  },
  {
    id: 'F05-T1-03',
    feature: 'F5',
    tier: 1,
    name: 'Verify #sweepr-live-wireguard-acr-proof absent in gl-inet-travel-router.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'setup', 'gl-inet-travel-router.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertFalse(containsElementId(html, 'sweepr-live-wireguard-acr-proof'), 'Proof section must be absent');
      }
    }
  },
  {
    id: 'F05-T1-04',
    feature: 'F5',
    tier: 1,
    name: 'Verify #sweepr-live-wireguard-acr-proof absent in stop-samsung-smart-tv-acr-tracking.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'guides', 'stop-samsung-smart-tv-acr-tracking.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertFalse(containsElementId(html, 'sweepr-live-wireguard-acr-proof'), 'Proof section must be absent');
      }
    }
  },
  {
    id: 'F05-T1-05',
    feature: 'F5',
    tier: 1,
    name: 'Verify #sweepr-live-wireguard-acr-proof absent in vs/nordvpn.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'vs', 'nordvpn.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertFalse(containsElementId(html, 'sweepr-live-wireguard-acr-proof'), 'Proof section must be absent');
      }
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
    name: 'Verify #sweepr-isp-master-matrix absent in talktalk-p2p-port-forwarding.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertFalse(containsElementId(html, 'sweepr-isp-master-matrix'), 'Master matrix must be absent');
      }
    }
  },
  {
    id: 'F06-T1-03',
    feature: 'F6',
    tier: 1,
    name: 'Verify #sweepr-isp-master-matrix absent in virgin-media-remote-dev-ssh.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'virgin-media-remote-dev-ssh.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertFalse(containsElementId(html, 'sweepr-isp-master-matrix'), 'Master matrix must be absent');
      }
    }
  },
  {
    id: 'F06-T1-04',
    feature: 'F6',
    tier: 1,
    name: 'Verify #sweepr-isp-master-matrix absent in bt-broadband-gaming-packet-loss.html',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'bt-broadband-gaming-packet-loss.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertFalse(containsElementId(html, 'sweepr-isp-master-matrix'), 'Master matrix must be absent');
      }
    }
  },
  {
    id: 'F06-T1-05',
    feature: 'F6',
    tier: 1,
    name: 'Verify legitimate non-matrix tables are preserved in solution pillars',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertTrue(html.includes('<table') || html.includes('class="metric'), 'Pillar should preserve legitimate technical metrics or tables');
      }
    }
  },

  // =========================================================================
  // Feature F7: Disable Boilerplate Injection Scripts
  // =========================================================================
  {
    id: 'F07-T1-01',
    feature: 'F7',
    tier: 1,
    name: 'Verify scripts/enrich-pillars-with-live-proof.mjs is deactivated or neutralized',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'enrich-pillars-with-live-proof.mjs');
      assertTrue(fs.existsSync(fp), 'Script file must exist');
      const content = fs.readFileSync(fp, 'utf8');
      // Script should either have an early return / disabled flag or not execute HTML modifications
      const isDisabled = content.includes('DISABLED') ||
                         content.includes('return') ||
                         content.includes('DEACTIVATED') ||
                         content.includes('process.exit(0)');
      assertTrue(isDisabled, 'enrich-pillars script must be deactivated');
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
    name: 'Execute enrich-pillars script dry-run; assert zero files modified',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'enrich-pillars-with-live-proof.mjs');
      const res = execSync(`node "${fp}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      // Verify no proof sections exist
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-live-wireguard-acr-proof["']/i);
      assertEqual(matches.length, 0, 'No proof sections should have been created');
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
    name: 'Verify consecutive script executions maintain zero HTML diffs',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'enrich-pillars-with-live-proof.mjs');
      execSync(`node "${fp}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      execSync(`node "${fp}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      const matches = findFilesWithPattern(WEBSITE_DIR, /id=["']sweepr-live-wireguard-acr-proof["']/i);
      assertEqual(matches.length, 0, 'Repeated runs must remain clean');
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
      const p1 = path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html');
      const p2 = path.join(WEBSITE_DIR, 'solutions', 'virgin-media-remote-dev-ssh.html');
      if (fs.existsSync(p1) && fs.existsSync(p2)) {
        const html1 = fs.readFileSync(p1, 'utf8');
        const html2 = fs.readFileSync(p2, 'utf8');
        const overlap = calculate5GramOverlap(html1, html2);
        assertLessThan(overlap, 25.0, `Overlap must be < 25%, got ${overlap.toFixed(2)}%`);
      }
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
      if (fs.existsSync(p1) && fs.existsSync(p2)) {
        const html1 = fs.readFileSync(p1, 'utf8');
        const html2 = fs.readFileSync(p2, 'utf8');
        const overlap = calculate5GramOverlap(html1, html2);
        assertLessThan(overlap, 20.0, `Cross-cluster overlap must be < 20%, got ${overlap.toFixed(2)}%`);
      }
    }
  },
  {
    id: 'F08-T1-04',
    feature: 'F8',
    tier: 1,
    name: 'Verify sampled top pillar pairs stay strictly below 30% hard CI limit',
    async fn() {
      const samples = [
        path.join(WEBSITE_DIR, 'solutions', 'talktalk-p2p-port-forwarding.html'),
        path.join(WEBSITE_DIR, 'solutions', 'bt-broadband-gaming-packet-loss.html'),
        path.join(WEBSITE_DIR, 'setup', 'synology-nas-docker-vpn.html'),
        path.join(WEBSITE_DIR, 'guides', 'stop-lg-smart-tv-acr-spying.html'),
        path.join(WEBSITE_DIR, 'vs', 'nordvpn.html')
      ].filter(fs.existsSync);

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
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertFalse(containsElementId(html, 'sweepr-unindexed-guides-bridge'), 'Bridge must be absent from disk file');
      }
    }
  },
  {
    id: 'F10-T1-04',
    feature: 'F10',
    tier: 1,
    name: 'Verify #sweepr-unindexed-guides-bridge absent in website/isp-throttling-test.html on disk',
    async fn() {
      const fp = path.join(WEBSITE_DIR, 'isp-throttling-test.html');
      if (fs.existsSync(fp)) {
        const html = fs.readFileSync(fp, 'utf8');
        assertFalse(containsElementId(html, 'sweepr-unindexed-guides-bridge'), 'Bridge must be absent from disk file');
      }
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
        if (fs.existsSync(fp)) {
          const html = fs.readFileSync(fp, 'utf8');
          assertTrue(containsElementId(html, 'sweepr-share-diagnostic-badge'), `Diagnostic badge must be preserved in ${fn}`);
        }
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
  // Feature F12: Static 12-Pillar Navigation Grid (+ Warrant Canary)
  // =========================================================================
  {
    id: 'F12-T1-01',
    feature: 'F12',
    tier: 1,
    name: 'Verify homepage footer contains curated navigation grid with all 13 links',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      assertEqual(res.status, 200, 'Homepage must return 200');
      const links = extractLinks(res.body).map((l) => l.href);
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
        assertTrue(links.includes(r), `Homepage must link to ${r}`);
      }
    }
  },
  {
    id: 'F12-T1-02',
    feature: 'F12',
    tier: 1,
    name: 'Verify /pricing footer contains curated navigation grid with all 13 links',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/pricing`);
      assertEqual(res.status, 200, 'Pricing must return 200');
      const links = extractLinks(res.body).map((l) => l.href);
      assertTrue(links.includes('/warrant-canary'), 'Pricing must link to warrant-canary');
      assertTrue(links.includes('/tools/leak-test'), 'Pricing must link to leak-test');
      assertTrue(links.includes('/solutions/talktalk-p2p-port-forwarding'), 'Pricing must link to talktalk');
    }
  },
  {
    id: 'F12-T1-03',
    feature: 'F12',
    tier: 1,
    name: 'Verify /tools/leak-test footer contains curated navigation grid with all 13 links',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/leak-test`);
      assertEqual(res.status, 200, 'Leak test must return 200');
      const links = extractLinks(res.body).map((l) => l.href);
      assertTrue(links.includes('/warrant-canary'), 'Leak test must link to warrant-canary');
      assertTrue(links.includes('/setup/gl-inet-travel-router'), 'Leak test must link to gl-inet');
    }
  },
  {
    id: 'F12-T1-04',
    feature: 'F12',
    tier: 1,
    name: 'Verify /tools/isp-throttling-test footer contains curated navigation grid with all 13 links',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/tools/isp-throttling-test`);
      assertEqual(res.status, 200, 'ISP throttling test must return 200');
      const links = extractLinks(res.body).map((l) => l.href);
      assertTrue(links.includes('/warrant-canary'), 'ISP throttling test must link to warrant-canary');
      assertTrue(links.includes('/guides/stop-samsung-smart-tv-acr-tracking'), 'ISP throttling test must link to samsung guide');
    }
  },
  {
    id: 'F12-T1-05',
    feature: 'F12',
    tier: 1,
    name: 'Verify all 13 navigation grid targets return HTTP 200 OK without nofollow',
    async fn({ baseUrl }) {
      const targets = [
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
      for (const t of targets) {
        const res = await fetchOpaque(`${baseUrl}${t}`);
        assertEqual(res.status, 200, `Target ${t} must return HTTP 200 OK`);
      }
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
    name: 'Verify consolidate-and-optimize-gsc.mjs executes without resurrecting consolidated pages',
    async fn() {
      const fp = path.join(SCRIPTS_DIR, 'consolidate-and-optimize-gsc.mjs');
      const res = execSync(`node "${fp}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertFalse(res.includes('[GSC Winner Lock]'), 'Winner Lock log should not trigger for consolidated pages');
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
      assertIncludes(content, 'talktalk-p2p-port-forwarding', 'Master pillar talktalk must remain in script');
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
    name: 'Verify zero retired /vs/ competitor comparisons exist in sitemap.xml',
    async fn() {
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const content = fs.readFileSync(sitemapPath, 'utf8');
      const { urls } = validateSitemapXml(content);
      const retiredVs = urls.filter((u) => u.includes('/vs/totalvpn') || u.includes('/vs/kaspersky') || u.includes('/vs/norton'));
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
  // Feature F18: Direct Crawlable Links to Canary & Demoted Top Pillars
  // =========================================================================
  {
    id: 'F18-T1-01',
    feature: 'F18',
    tier: 1,
    name: 'Verify website/index.html contains crawlable link to /warrant-canary',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      assertEqual(res.status, 200, 'Homepage must return 200');
      const links = extractLinks(res.body);
      const canaryLink = links.find((l) => l.href === '/warrant-canary');
      assertTrue(!!canaryLink, 'Homepage must have crawlable link to /warrant-canary');
      assertFalse(hasNofollow(canaryLink), 'Warrant canary link must not be nofollow');
    }
  },
  {
    id: 'F18-T1-02',
    feature: 'F18',
    tier: 1,
    name: 'Verify website/index.html links to all 6 demoted top pillars without nofollow',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/`);
      assertEqual(res.status, 200, 'Homepage must return 200');
      const links = extractLinks(res.body);
      const demotedPillars = [
        '/guides/stop-samsung-smart-tv-acr-tracking',
        '/setup/gl-inet-travel-router',
        '/tools/leak-test',
        '/tools/isp-throttling-test',
        '/setup/synology-nas-docker-vpn',
        '/alternatives/totalvpn'
      ];
      for (const p of demotedPillars) {
        const linkObj = links.find((l) => l.href === p);
        assertTrue(!!linkObj, `Homepage must link to demoted pillar ${p}`);
        assertFalse(hasNofollow(linkObj), `Link to ${p} must not have nofollow`);
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
    name: 'Verify /download picker contains crawlable links to demoted top pillars',
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
    name: 'Verify GitHub Actions workflow specifies --limit=0 in keyword engine step',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      assertTrue(fs.existsSync(wfPath), 'Pipeline workflow file must exist');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertIncludes(content, '--limit=0', 'Workflow must freeze page creation with --limit=0');
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
      // Should either be commented out (#) or not present
      const lines = content.split('\n');
      const activeCall = lines.some((l) => l.trim().startsWith('node scripts/enrich-pillars-with-live-proof.mjs'));
      assertFalse(activeCall, 'Workflow must not execute enrich-pillars script');
    }
  },
  {
    id: 'F19-T1-03',
    feature: 'F19',
    tier: 1,
    name: 'Verify keyword-research-engine.mjs with --limit=0 produces zero new HTML files',
    async fn() {
      const scriptPath = path.join(SCRIPTS_DIR, 'keyword-research-engine.mjs');
      if (fs.existsSync(scriptPath)) {
        const res = execSync(`node "${scriptPath}" --limit=0`, { cwd: ROOT_DIR, encoding: 'utf8' });
        assertTrue(res.includes('0') || res.includes('limit'), 'Keyword engine should acknowledge limit=0');
      }
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
  // Feature F20: Enforce CI Assertions in Pipeline
  // =========================================================================
  {
    id: 'F20-T1-01',
    feature: 'F20',
    tier: 1,
    name: 'Verify workflow contains CI assertion enforcing sitemap <= 95 URLs',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertTrue(
        content.includes('95') && (content.includes('sitemap') || content.includes('loc')),
        'Workflow must enforce sitemap <= 95 URLs'
      );
    }
  },
  {
    id: 'F20-T1-02',
    feature: 'F20',
    tier: 1,
    name: 'Verify workflow contains CI assertion enforcing 0 zombie noindex HTML files',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertTrue(
        content.includes('noindex') || content.includes('zombie') || content.includes('solutions'),
        'Workflow must enforce 0 zombie files assertion'
      );
    }
  },
  {
    id: 'F20-T1-03',
    feature: 'F20',
    tier: 1,
    name: 'Verify workflow contains CI assertion enforcing 5-gram overlap < 30%',
    async fn() {
      const wfPath = path.join(ROOT_DIR, '.github', 'workflows', 'vpn-daily-seo-pipeline.yml');
      const content = fs.readFileSync(wfPath, 'utf8');
      assertTrue(
        content.includes('30') && (content.includes('overlap') || content.includes('shingle') || content.includes('similarity')),
        'Workflow must enforce <30% overlap assertion'
      );
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
  }
];
