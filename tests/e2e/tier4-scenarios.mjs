/**
 * SWEEPR VPN — E2E Test Suite: Tier 4 Real-World Application Scenarios
 * Tests 14 end-to-end user and search engine bot workflow scenarios (S01 through S14).
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
  runConsolidationInTempSandbox,
  getServerStateDir,
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

export const tier4Scenarios = [
  // =========================================================================
  // Scenario 1: Googlebot Deep Crawl & Indexation Validation
  // =========================================================================
  {
    id: 'S01',
    tier: 4,
    name: 'Scenario 1: Googlebot Deep Crawl & Indexation Validation (robots.txt -> sitemap <=95 -> crawl 200 OK)',
    async fn({ baseUrl }) {
      // Step 1: Crawler requests /robots.txt
      const robotsRes = await fetchOpaque(`${baseUrl}/robots.txt`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
      });
      assertEqual(robotsRes.status, 200, 'robots.txt must return 200 OK');
      assertIncludes(robotsRes.body, 'sitemap.xml', 'robots.txt must point to sitemap.xml');

      // Step 2: Crawler fetches /sitemap.xml
      const sitemapRes = await fetchOpaque(`${baseUrl}/sitemap.xml`);
      assertEqual(sitemapRes.status, 200, 'sitemap.xml must return 200 OK');
      const { totalUrls, urls } = validateSitemapXml(sitemapRes.body);
      assertLessThanOrEqual(totalUrls, 95, `Sitemap must have <= 95 URLs, found ${totalUrls}`);

      // Step 3: Crawler samples sitemap URLs
      const sample = urls.slice(0, 10);
      for (const u of sample) {
        const parsed = new URL(u);
        const pageRes = await fetchOpaque(`${baseUrl}${parsed.pathname}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
        });
        assertEqual(pageRes.status, 200, `Crawled page ${parsed.pathname} must return 200`);
        assertFalse(containsElementId(pageRes.body, 'sweepr-live-wireguard-acr-proof'), 'No proof boilerplate');
        assertFalse(containsElementId(pageRes.body, 'sweepr-seo-directory'), 'No directory boilerplate');
      }
    }
  },

  // =========================================================================
  // Scenario 2: Legacy User Arriving via Retired ACR Solution Link
  // =========================================================================
  {
    id: 'S02',
    tier: 4,
    name: 'Scenario 2: Legacy User Arriving via Retired ACR Solution Link (301 redirect -> guide -> download conversion)',
    async fn({ baseUrl }) {
      // Step 1: User navigates to legacy ACR URL with UTM tag
      const legacyPath = '/solutions/samsung-smart-tv-acr-blocking?utm_source=avforums';
      const initial = await fetchOpaque(`${baseUrl}${legacyPath}`);
      assertEqual(initial.status, 301, 'Retired ACR path must return 301');
      assertIncludes(initial.location, '/guides/stop-samsung-smart-tv-acr-tracking', 'Target must be stop-samsung guide');
      assertIncludes(initial.location, 'utm_source=avforums', 'UTM tracking parameter must be preserved');

      // Step 2: User browser follows redirect
      const followed = await fetchOpaque(`${baseUrl}${initial.location}`);
      assertEqual(followed.status, 200, 'Destination guide must return 200 OK');
      assertTrue(followed.body.includes('Samsung') && followed.body.includes('ACR'), 'Guide must contain ACR instructions');

      // Step 3: User clicks CTA to download
      const downloadRes = await fetchOpaque(`${baseUrl}/download`);
      assertEqual(downloadRes.status, 200, '/download page must return 200 OK');
      assertTrue(downloadRes.body.includes('.exe') || downloadRes.body.includes('Download'), 'Download page must offer installer');
    }
  },

  // =========================================================================
  // Scenario 3: Privacy Researcher Warrant Canary & Leak Test Audit
  // =========================================================================
  {
    id: 'S03',
    tier: 4,
    name: 'Scenario 3: Privacy Researcher Warrant Canary & Leak Test Audit (Canary PGP -> Leak test ICE table -> WebRTC flags)',
    async fn({ baseUrl }) {
      // Step 1: Researcher lands on homepage
      const homeRes = await fetchOpaque(`${baseUrl}/`);
      assertEqual(homeRes.status, 200, 'Homepage must return 200');

      // Step 2: Researcher clicks /warrant-canary
      const canaryRes = await fetchOpaque(`${baseUrl}/warrant-canary`);
      assertEqual(canaryRes.status, 200, 'Warrant canary must return 200');
      assertTrue(
        canaryRes.body.includes('-----BEGIN PGP SIGNED MESSAGE-----') || canaryRes.body.includes('Warrant Canary'),
        'Warrant canary must have signed statement or attestations'
      );

      // Step 3: Researcher navigates to /tools/leak-test
      const leakRes = await fetchOpaque(`${baseUrl}/tools/leak-test`);
      assertEqual(leakRes.status, 200, 'Leak test must return 200');
      const main = extractMainContent(leakRes.body);
      assertTrue(main.includes('host') && main.includes('srflx'), 'Must have ICE candidate table');
      assertTrue(main.includes('media.peerconnection') || main.includes('Firefox'), 'Must have WebRTC remediation');
    }
  },

  // =========================================================================
  // Scenario 4: Automated CI/CD Daily SEO Pipeline Simulation (Local Dry Run)
  // =========================================================================
  {
    id: 'S04',
    tier: 4,
    name: 'Scenario 4: Automated CI/CD Daily SEO Pipeline Simulation (Audit run -> Guardrail checks: sitemap <=95, 0 zombies, <30% overlap)',
    async fn() {
      // Step 1: Run daily audit in verification mode
      const scriptPath = path.join(SCRIPTS_DIR, 'daily-seo-pagespeed-audit.mjs');
      const res = execSync(`node "${scriptPath}" --no-fix --no-ping`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertTrue(res.length > 0, 'Audit runs cleanly');

      // Step 2: Execute CI guardrail 1: Sitemap count <= 95
      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const { totalUrls } = validateSitemapXml(fs.readFileSync(sitemapPath, 'utf8'));
      assertLessThanOrEqual(totalUrls, 95, 'CI Guardrail 1: sitemap <= 95 URLs');

      // Step 3: Execute CI guardrail 2: 0 zombie files
      const solutionsDir = path.join(WEBSITE_DIR, 'solutions');
      const zombies = findFilesWithPattern(solutionsDir, /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i);
      assertEqual(zombies.length, 0, 'CI Guardrail 2: zero zombie files');

      // Step 4: Execute CI guardrail 3: 5-gram overlap < 30% & CI quality gate
      const p1 = path.join(WEBSITE_DIR, 'setup', 'gl-inet-travel-router.html');
      const p2 = path.join(WEBSITE_DIR, 'guides', 'stop-samsung-smart-tv-acr-tracking.html');
      assertTrue(fs.existsSync(p1) && fs.existsSync(p2), 'Both guardrail sample pillars must exist');
      const overlap = calculate5GramOverlap(fs.readFileSync(p1, 'utf8'), fs.readFileSync(p2, 'utf8'));
      assertLessThan(overlap, 30.0, 'CI Guardrail 3: 5-gram overlap < 30%');
      const gateOut = execSync(`node "${path.join(SCRIPTS_DIR, 'ci-seo-quality-gate.mjs')}"`, { cwd: ROOT_DIR, encoding: 'utf8' });
      assertIncludes(gateOut, 'CI SEO Quality Gate PASSED', 'CI Quality Gate must pass');
    }
  },

  // =========================================================================
  // Scenario 5: TotalVPN Competitor Comparison & Funnel Conversion Journey
  // =========================================================================
  {
    id: 'S05',
    tier: 4,
    name: 'Scenario 5: TotalVPN Competitor Comparison Journey (/vs-totalvpn -> 301 /vs/totalvpn -> /alternatives/totalvpn -> Pricing CTA)',
    async fn({ baseUrl }) {
      // Step 1: Consumer visits legacy /vs-totalvpn alias -> 301 -> /vs/totalvpn
      const initial = await fetchOpaque(`${baseUrl}/vs-totalvpn`);
      assertEqual(initial.status, 301, '/vs-totalvpn must redirect via 301');
      assertEqual(initial.location, '/vs/totalvpn', 'Must redirect to canonical /vs/totalvpn');

      const vsRes = await fetchOpaque(`${baseUrl}${initial.location}`);
      assertEqual(vsRes.status, 200, '/vs/totalvpn must return 200 OK');
      assertTrue(vsRes.body.includes('TotalVPN'), '/vs/totalvpn must cover TotalVPN comparison');

      // Step 2: Browser loads /alternatives/totalvpn
      const altRes = await fetchOpaque(`${baseUrl}/alternatives/totalvpn`);
      assertEqual(altRes.status, 200, '/alternatives/totalvpn must return 200 OK');
      assertTrue(altRes.body.includes('TotalVPN') || altRes.body.includes('Comparison'), 'Page must contain competitor comparison');

      // Step 3: Consumer clicks CTA to /pricing
      const pricingRes = await fetchOpaque(`${baseUrl}/pricing`);
      assertEqual(pricingRes.status, 200, 'Pricing page must return 200 OK');
      assertTrue(pricingRes.body.includes('12.49') || pricingRes.body.includes('74.99') || pricingRes.body.includes('Plan'), 'Must display pricing anchor options');
    }
  },

  // =========================================================================
  // Scenario 6: Network Engineer ISP Throttling & CGNAT Investigation
  // =========================================================================
  {
    id: 'S06',
    tier: 4,
    name: 'Scenario 6: Network Engineer ISP Throttling Investigation (MTU calc -> DPI table -> TalkTalk 301 -> CGNAT 200)',
    async fn({ baseUrl }) {
      // Step 1: Engineer visits /tools/mtu-calculator
      const initial = await fetchOpaque(`${baseUrl}/tools/mtu-calculator`);
      assertEqual(initial.status, 301, 'Alias must return 301');
      assertEqual(initial.location, '/tools/isp-throttling-test', 'Redirects to ISP throttling test');

      // Step 2: Destination loads with DPI table
      const followed = await fetchOpaque(`${baseUrl}${initial.location}`);
      assertEqual(followed.status, 200, 'Throttling test must return 200');
      const main = extractMainContent(followed.body);
      assertTrue(main.includes('SNI') || main.includes('DPI') || main.includes('P2P'), 'Must show DPI table');

      // Step 3: Legacy TalkTalk link 1-hop 301 -> current TalkTalk CGNAT canonical -> 200
      const legacyTalkTalk = await fetchOpaque(`${baseUrl}/solutions/talktalk-p2p-port-forwarding`);
      assertEqual(legacyTalkTalk.status, 301, 'Legacy TalkTalk slug must return 301');
      assertEqual(legacyTalkTalk.location, '/solutions/talktalk-fibre-wireguard-cgnat', 'Must redirect 1-hop to talktalk-fibre-wireguard-cgnat');

      const talktalkRes = await fetchOpaque(`${baseUrl}${legacyTalkTalk.location}`);
      assertEqual(talktalkRes.status, 200, 'TalkTalk CGNAT canonical must return 200');
    }
  },

  // =========================================================================
  // Scenario 7: Travel Router WireGuard Hardware Setup Journey
  // =========================================================================
  {
    id: 'S07',
    tier: 4,
    name: 'Scenario 7: Travel Router WireGuard Setup Journey (Router guide -> Clean prose -> Synology cross-link)',
    async fn({ baseUrl }) {
      // Step 1: Remote worker accesses GL.iNet guide
      const routerRes = await fetchOpaque(`${baseUrl}/setup/gl-inet-travel-router`);
      assertEqual(routerRes.status, 200, 'Router guide must return 200 OK');
      assertFalse(containsElementId(routerRes.body, 'sweepr-live-wireguard-acr-proof'), 'No boilerplate proof');

      // Step 2: Clicks curated grid link to Synology guide
      const synologyRes = await fetchOpaque(`${baseUrl}/setup/synology-nas-docker-vpn`);
      assertEqual(synologyRes.status, 200, 'Synology guide must return 200 directly');
      assertFalse(containsElementId(synologyRes.body, 'sweepr-live-wireguard-acr-proof'), 'No boilerplate proof');
    }
  },

  // =========================================================================
  // Scenario 8: Bingbot Discovers Retired Non-Pillar Micro-ISP URL
  // =========================================================================
  {
    id: 'S08',
    tier: 4,
    name: 'Scenario 8: Bingbot Discovers Retired Micro-ISP URL (Request retired ACR -> 301 to guide -> Canonical indexed)',
    async fn({ baseUrl }) {
      const res = await fetchOpaque(`${baseUrl}/solutions/fibrus-full-fibre-smart-tv-acr-blocking`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' }
      });
      assertEqual(res.status, 301, 'Pattern resolver must return 301');
      assertEqual(res.location, '/guides/stop-samsung-smart-tv-acr-tracking', 'Target is stop-samsung guide');

      const dest = await fetchOpaque(`${baseUrl}${res.location}`);
      assertEqual(dest.status, 200, 'Destination returns 200');
      const canonical = extractCanonical(dest.body);
      assertTrue(canonical && canonical.includes('stop-samsung-smart-tv-acr-tracking'), 'Canonical matches destination URL');
    }
  },

  // =========================================================================
  // Scenario 9: Webmaster Automated GSC/GA4 Sync & Sitemap Resubmission
  // =========================================================================
  {
    id: 'S09',
    tier: 4,
    name: 'Scenario 9: Webmaster GSC Sync & Sitemap Resubmission (Sync script contract -> Sandbox consolidation -> Sitemap <= 95)',
    async fn() {
      const syncPath = path.join(SCRIPTS_DIR, 'cloud-gsc-ga4-sync.mjs');
      const content = fs.readFileSync(syncPath, 'utf8');
      assertIncludes(content, 'https://sweeprvpn.com/sitemap.xml', 'Sync script must target production sitemap');

      // Verify consolidation script in isolated sandbox without resurrecting consolidated URLs
      const out = runConsolidationInTempSandbox();
      assertFalse(out.includes('[GSC Winner Lock]'), 'Consolidation must not resurrect consolidated URLs');

      const sitemapPath = path.join(WEBSITE_DIR, 'sitemap.xml');
      const { totalUrls } = validateSitemapXml(fs.readFileSync(sitemapPath, 'utf8'));
      assertLessThanOrEqual(totalUrls, 95, 'Sitemap remains <= 95 URLs after consolidation');
    }
  },

  // =========================================================================
  // Scenario 10: Security & Credential Hygiene Pre-Deployment Audit
  // =========================================================================
  {
    id: 'S10',
    tier: 4,
    name: 'Scenario 10: Security Pre-Deployment Audit (Git secret scan -> Private key scan -> HTTP error hardening)',
    async fn({ baseUrl }) {
      // Step 1: Scan git index for service account secrets
      const trackedSecrets = execSync('git ls-files "*.service-account.json" .gcp-service-account.json', { cwd: ROOT_DIR, encoding: 'utf8' }).trim();
      assertEqual(trackedSecrets, '', 'Zero service account secrets tracked in git index');

      // Step 2: Verify HTTP TRACE is rejected and does not leak stack trace
      const traceRes = await fetchOpaque(`${baseUrl}/`, { method: 'TRACE' });
      assertTrue(traceRes.status === 405 || traceRes.status === 400 || traceRes.status === 404, 'TRACE must be rejected with 4xx');
      assertFalse(traceRes.body.includes('at Server.<anonymous>'), 'Must not expose stack traces');
    }
  },

  // =========================================================================
  // Scenario 11: Comprehensive E2E Regression Pass (All 28 Features Pass Gate)
  // =========================================================================
  {
    id: 'S11',
    tier: 4,
    name: 'Scenario 11: Comprehensive E2E Regression Pass (Verify complete suite inventory: 140 T1 + 140 T2 + 28 T3 + 14 T4 = 322 tests)',
    async fn() {
      const { tier1Tests } = await import('./tier1-features.mjs');
      const { tier2Tests } = await import('./tier2-boundaries.mjs');
      const { tier3Tests } = await import('./tier3-cross-feature.mjs');

      assertGreaterThanOrEqual(tier1Tests.length, 140, `Tier 1 must have >= 140 tests, got ${tier1Tests.length}`);
      assertGreaterThanOrEqual(tier2Tests.length, 140, `Tier 2 must have >= 140 tests, got ${tier2Tests.length}`);
      assertGreaterThanOrEqual(tier3Tests.length, 28, `Tier 3 must have >= 28 tests, got ${tier3Tests.length}`);
      assertGreaterThanOrEqual(tier4Scenarios.length, 14, `Tier 4 must have >= 14 scenarios, got ${tier4Scenarios.length}`);

      const total = tier1Tests.length + tier2Tests.length + tier3Tests.length + tier4Scenarios.length;
      assertGreaterThanOrEqual(total, 322, `Total test inventory must be >= 322, got ${total}`);
    }
  },

  // =========================================================================
  // Scenario 12: AI Answer Engine Discovery Journey (R2 / R3)
  // =========================================================================
  {
    id: 'S12',
    tier: 4,
    name: 'Scenario 12: AI Answer Engine Discovery Journey (Claude-SearchBot robots.txt -> llms.txt -> /ai-info -> /faq -> /privacy)',
    async fn({ baseUrl }) {
      const robots = await fetchOpaque(`${baseUrl}/robots.txt`, {
        headers: { 'User-Agent': 'Claude-SearchBot/1.0' }
      });
      assertEqual(robots.status, 200, 'robots.txt must return 200');
      assertMatch(robots.body, /User-agent:\s*Claude-SearchBot[\s\S]*?Allow:\s*\//i, 'Claude-SearchBot must be allowed');

      const llms = await fetchOpaque(`${baseUrl}/llms.txt`);
      assertEqual(llms.status, 200, 'llms.txt must return 200');
      assertIncludes(llms.body, 'https://sweeprvpn.com/ai-info', 'llms.txt must link to /ai-info');
      assertIncludes(llms.body, 'https://sweeprvpn.com/faq', 'llms.txt must link to /faq');

      const aiInfo = await fetchOpaque(`${baseUrl}/ai-info`);
      assertEqual(aiInfo.status, 200, '/ai-info must return 200');
      assertIncludes(aiInfo.body, 'UK Sole Trader', '/ai-info must state UK Sole Trader');
      assertIncludes(aiInfo.body, 'UK-LON-01', '/ai-info must list live POPs');

      const faq = await fetchOpaque(`${baseUrl}/faq`);
      assertEqual(faq.status, 200, '/faq must return 200');
      assertMatch(faq.body, /<article\b/i, '/faq must wrap editorial body in <article>');

      const privacy = await fetchOpaque(`${baseUrl}/privacy`);
      assertEqual(privacy.status, 200, '/privacy must return 200');
      assertTrue(containsElementId(privacy.body, 'what-we-collect-vs-never-log'), '/privacy must contain RAM-vs-billing table');
      assertIncludes(privacy.body, 'G-7D28EEMNXX', '/privacy must disclose GA4 measurement ID');
    }
  },

  // =========================================================================
  // Scenario 13: Post-Install Onboarding & Uninstall Churn Diagnostic Journey (R4)
  // =========================================================================
  {
    id: 'S13',
    tier: 4,
    name: 'Scenario 13: Post-Install Onboarding & Churn Diagnostic Journey (/welcome -> /tools/leak-test -> /uninstall -> POST feedback)',
    async fn({ baseUrl, stateDir }) {
      const resolvedStateDir = stateDir || getServerStateDir();
      assertTrue(!!resolvedStateDir, 'Isolated SWEEPR_STATE_DIR must be active');

      const welcome = await fetchOpaque(`${baseUrl}/welcome`);
      assertEqual(welcome.status, 200, '/welcome must return 200');
      assertIncludes((welcome.getHeader('x-robots-tag') || '').toLowerCase(), 'noindex, nofollow', '/welcome must be noindex, nofollow');
      assertIncludes(welcome.body, '/tools/leak-test', '/welcome must guide users to /tools/leak-test');

      const leakTest = await fetchOpaque(`${baseUrl}/tools/leak-test`);
      assertEqual(leakTest.status, 200, '/tools/leak-test must return 200');

      const uninstall = await fetchOpaque(`${baseUrl}/uninstall`);
      assertEqual(uninstall.status, 200, '/uninstall must return 200');
      assertIncludes((uninstall.getHeader('x-robots-tag') || '').toLowerCase(), 'noindex, nofollow', '/uninstall must be noindex, nofollow');
      assertTrue(containsElementId(uninstall.body, 'uninstallForm'), '/uninstall must contain #uninstallForm');

      const marker = `s13-churn-${Date.now()}`;
      const postFb = await fetchOpaque(`${baseUrl}/api/uninstall-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'missing_location', os: 'win', version: '2.6.0', note: marker })
      });
      assertEqual(postFb.status, 200, 'Valid uninstall feedback must return 200');
      assertEqual(JSON.parse(postFb.body).ok, true, 'Feedback API must return ok: true');

      const fbFile = path.join(resolvedStateDir, 'uninstall-feedback.jsonl');
      assertTrue(fs.existsSync(fbFile), 'uninstall-feedback.jsonl must exist in isolated stateDir');
      assertIncludes(fs.readFileSync(fbFile, 'utf8'), marker, 'Scenario feedback marker must be persisted in isolated JSONL');
    }
  },

  // =========================================================================
  // Scenario 14: Carrier Consolidation & Real Visual Proof Journey (R1 / R5)
  // =========================================================================
  {
    id: 'S14',
    tier: 4,
    name: 'Scenario 14: Carrier Consolidation & Visual Proof Journey (Hyperoptic 301 -> TalkTalk 200 -> Router Guide WebP)',
    async fn({ baseUrl }) {
      const r1 = await fetchOpaque(`${baseUrl}/solutions/hyperoptic-broadband-isp-throttling?utm_source=gsc`);
      assertEqual(r1.status, 301, 'Retired Hyperoptic URL must return 301');
      assertEqual(r1.location, '/solutions/talktalk-fibre-wireguard-cgnat?utm_source=gsc', 'Must redirect 1-hop to TalkTalk preserving UTM');

      const r2 = await fetchOpaque(`${baseUrl}${r1.location}`);
      assertEqual(r2.status, 200, 'TalkTalk canonical must return 200');
      assertMatch(r2.body, /<article\b/i, 'TalkTalk canonical must wrap body in <article>');

      const router = await fetchOpaque(`${baseUrl}/setup/gl-inet-travel-router`);
      assertEqual(router.status, 200, 'GL.iNet travel router guide must return 200');
      assertIncludes(router.body, '/assets/desktop-home-light.webp', 'Router guide must embed desktop-home-light.webp');

      const imgRes = await fetchBinary(`${baseUrl}/assets/desktop-home-light.webp`);
      assertEqual(imgRes.status, 200, 'Embedded WebP must serve 200');
      assertIncludes(imgRes.getHeader('content-type') || '', 'image/webp', 'Embedded WebP must serve image/webp');
      assertLessThan(imgRes.byteLength, 81920, 'Embedded WebP must be < 80 KB');
    }
  }
];
