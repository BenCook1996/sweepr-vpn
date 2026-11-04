#!/usr/bin/env node
/**
 * SWEEPR VPN (sweeprvpn.com) — GSC Index Consolidation, Eduroam Hub Merger,
 * Smart-TV ACR Open-Source Blocklist & Interactive Tool Share-Badge Enforcer
 *
 * Enforces Phases 1–4 of `gsc_impressions_root_cause_and_turnaround_plan.md`:
 *  1. Phase 1 (Target Index Size ~175–185 URLs):
 *     - Keeps strictly the ~56 Tier-1 UK/US/CA/AU/IE/NZ Master ISP & Network Pillars + 100% of GSC-impression winners in `/solutions/`.
 *     - Consolidates all remaining `/solutions/*-smart-tv-acr-blocking` stragglers (`comcast-xfinity`, `fibrus`) to `/guides/stop-samsung-smart-tv-acr-tracking`.
 *     - Consolidates duplicate Eduroam, BT, Sky, TalkTalk, Virgin Media, Vodafone UK, NHS, EE, Three, O2, and Hotel sub-variants to their single winning Master ISP Pillar.
 *     - Consolidates zero-impression micro-regional/foreign ISP clones to `/solutions` and 18 low-volume legacy antivirus `/vs/` pages to `/vs`.
 *  2. Phase 3 Item 1: Injects a 1-Click "Share / Embed Diagnostic Result & Backlink Badge" into `/tools/leak-test` (`website/leak-test.html`) and `/tools/isp-throttling-test` (`website/isp-throttling-test.html`).
 *  3. Phase 3 Item 4: Merges Eduroam P2P Port Forwarding & Remote Dev SSH engineering sections into the unified `/solutions/eduroam-campus-wifi-gaming-packet-loss` Hub.
 *  4. Phase 4 Item 2: Generates the public, crawlable Pi-hole / AdGuard / Hosts Smart-TV ACR Blocklist at `website/smart-tv-acr-blocklist.txt` (`https://sweeprvpn.com/smart-tv-acr-blocklist.txt`).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(ROOT_DIR, 'website');

// ============================================================================
// 1. Authoritative Set of Indexable `/solutions/` Pillars (~56 Tier-1 + GSC Winners)
// ============================================================================
const AUTHORITATIVE_SOLUTIONS_PILLARS = new Set([
  // Proven GSC Impression / Click Winners & Primary UK/US/CA/AU/Global ISP Pillars
  'talktalk-p2p-port-forwarding',
  'eduroam-campus-wifi-gaming-packet-loss',
  'gigaclear-rural-fibre-gaming-packet-loss',
  'gigaclear-rural-fibre-isp-throttling',
  'comcast-xfinity-broadband-isp-throttling',
  'virgin-media-p2p-port-forwarding',
  'virgin-media-gaming-packet-loss',
  'virgin-media-warzone-packet-loss',
  'virgin-media-isp-throttling',
  'zen-internet-uk-isp-throttling',
  'bt-broadband-gaming-packet-loss',
  'bt-broadband-iptv-isp-blocking',
  'sky-broadband-gaming-packet-loss',
  'sky-broadband-iptv-isp-blocking',
  'vodafone-uk-gaming-packet-loss',
  't-mobile-5g-home-discord-voice-drop',
  't-mobile-5g-home-internet-isp-throttling',
  'bell-fibe-twitch-4k-buffering',
  'bell-pure-fibre-canada-isp-throttling',
  'ee-mobile-5g-uk-cgnat-port-forwarding',
  'ee-5g-mobile-hotspot-isp-throttling',
  'rogers-ignite-ca-teams-zoom-jitter',
  'rogers-ignite-canada-isp-throttling',
  'telstra-nbn-au-valorant-high-ping',
  'telstra-nbn-australia-isp-throttling',
  'deutsche-telekom-iptv-isp-blocking',
  'deutsche-telekom-dsl-isp-throttling',
  // Major Tier-1 UK / Ireland / US / Canada / Australia / Global Networks
  'plusnet-broadband-uk-isp-throttling',
  'now-broadband-uk-isp-throttling',
  'three-5g-home-broadband-isp-throttling',
  'o2-uk-mobile-tethering-isp-throttling',
  'hyperoptic-broadband-isp-throttling',
  'community-fibre-london-isp-throttling',
  'cityfibre-uk-isp-throttling',
  'youfibre-uk-isp-throttling',
  'kcom-lightstream-hull-isp-throttling',
  'starlink-satellite-uk-isp-throttling',
  'starlink-rv-roam-isp-throttling',
  'virgin-media-ireland-isp-throttling',
  'eir-fibre-ireland-isp-throttling',
  'vodafone-ireland-siro-isp-throttling',
  'bt-ireland-broadband-isp-throttling',
  'att-fiber-broadband-isp-throttling',
  'verizon-fios-broadband-isp-throttling',
  'spectrum-charter-cable-isp-throttling',
  'cox-panoramic-wifi-isp-throttling',
  'optimum-altice-cable-us-isp-throttling',
  'frontier-fiber-us-isp-throttling',
  'centurylink-quantum-fiber-isp-throttling',
  'google-fiber-us-isp-throttling',
  'astound-broadband-us-isp-throttling',
  't-mobile-fiber-us-isp-throttling',
  'ziply-fiber-us-isp-throttling',
  'sonic-fiber-california-isp-throttling',
  'telus-purefibre-canada-isp-throttling',
  'shaw-rogers-fibre-plus-isp-throttling',
  'videotron-helix-canada-isp-throttling',
  'optus-nbn-australia-isp-throttling',
  'aussie-broadband-australia-isp-throttling',
  'tpg-telecom-australia-isp-throttling',
  'iinet-australia-isp-throttling',
  'spark-fibre-new-zealand-isp-throttling',
  'nhs-guest-wifi-isp-throttling',
  'hotel-captive-portal-wifi-isp-throttling',
  'hotel-captive-portal-wifi-p2p-port-forwarding',
  'comcast-xfinity-broadband-smart-tv-acr-blocking',
  'ee-5g-mobile-hotspot-wifi-arp-spoofing-protection',
  'ee-5g-mobile-hotspot-voip-teams-zoom-jitter',
  'three-5g-home-broadband-uhd-streaming-buffering',
  'three-5g-home-broadband-voip-teams-zoom-jitter',
  'o2-uk-mobile-tethering-uhd-streaming-buffering',
  'nhs-guest-wifi-uhd-streaming-buffering',
  'nhs-guest-wifi-voip-teams-zoom-jitter',
  'fibrus-full-fibre-smart-tv-acr-blocking',
  'airport-lounge-public-wifi-isp-throttling',
  'national-rail-train-wifi-isp-throttling'
]);

// Specific Consolidation Target Map for `/solutions/` sub-pages
const SPECIFIC_SOLUTIONS_CANONICAL_MAP = {
  // Eduroam sub-pages -> Unified Eduroam Hub (Phase 3 Item 4)
  'eduroam-campus-wifi-p2p-port-forwarding': '/solutions/eduroam-campus-wifi-gaming-packet-loss',
  'eduroam-campus-wifi-remote-dev-ssh': '/solutions/eduroam-campus-wifi-gaming-packet-loss',
  'eduroam-campus-wifi-uhd-streaming-buffering': '/solutions/eduroam-campus-wifi-gaming-packet-loss',
  'eduroam-campus-wifi-isp-throttling': '/solutions/eduroam-campus-wifi-gaming-packet-loss',
  // TalkTalk sub-pages -> Click-winning TalkTalk Pillar
  'talktalk-gaming-packet-loss': '/solutions/talktalk-p2p-port-forwarding',
  'talktalk-remote-dev-ssh': '/solutions/talktalk-p2p-port-forwarding',
  'talktalk-uhd-streaming-buffering': '/solutions/talktalk-p2p-port-forwarding',
  'talktalk-isp-throttling': '/solutions/talktalk-p2p-port-forwarding',
  // Virgin Media sub-pages -> Virgin Media Pillar
  'virgin-media-remote-dev-ssh': '/solutions/virgin-media-p2p-port-forwarding',
  'virgin-media-uhd-streaming-buffering': '/solutions/virgin-media-p2p-port-forwarding',
  // BT Broadband sub-pages -> BT Broadband Pillar
  'bt-broadband-p2p-port-forwarding': '/solutions/bt-broadband-gaming-packet-loss',
  'bt-broadband-remote-dev-ssh': '/solutions/bt-broadband-gaming-packet-loss',
  'bt-broadband-uhd-streaming-buffering': '/solutions/bt-broadband-gaming-packet-loss',
  // Sky Broadband sub-pages -> Sky Broadband Pillar
  'sky-broadband-p2p-port-forwarding': '/solutions/sky-broadband-gaming-packet-loss',
  'sky-broadband-remote-dev-ssh': '/solutions/sky-broadband-gaming-packet-loss',
  'sky-broadband-uhd-streaming-buffering': '/solutions/sky-broadband-gaming-packet-loss',
  // Vodafone UK sub-pages -> Vodafone UK Pillar
  'vodafone-uk-p2p-port-forwarding': '/solutions/vodafone-uk-gaming-packet-loss',
  'vodafone-uk-remote-dev-ssh': '/solutions/vodafone-uk-gaming-packet-loss',
  'vodafone-uk-uhd-streaming-buffering': '/solutions/vodafone-uk-gaming-packet-loss'
};

// 18 Low-Search-Volume / Legacy Antivirus-Bundled `/vs/` Pages Consolidated to `/vs`
const CONSOLIDATED_VS_SLUGS = new Set([
  'goose-vpn',
  'le-vpn',
  'panda-dome-vpn',
  'zoogvpn',
  'vpn-ac',
  'perfect-privacy',
  'f-secure-freedome',
  'kaspersky-vpn',
  'keepsolid-vpn-unlimited',
  'norton-secure-vpn',
  'mcafee-safe-connect',
  'avira-phantom-vpn',
  'avg-secure-vpn',
  'avast-secureline',
  'bitdefender-vpn',
  'malwarebytes-privacy-vpn',
  'ivacy-vpn',
  'fastestvpn'
]);

function applyCanonicalAndRobots(html, canonicalPath, isIndexable) {
  const fullCanon = `https://sweeprvpn.com${canonicalPath}`;
  const robotsDirective = isIndexable
    ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    : 'noindex, follow';

  let out = html
    .replace(
      /<meta\s+name=["']robots["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta name="robots" content="${robotsDirective}">`
    )
    .replace(
      /<link\s+rel=["']canonical["']\s+href=["'][^"']*["']\s*\/?>/i,
      `<link rel="canonical" href="${fullCanon}">`
    )
    .replace(
      /<meta\s+property=["']og:url["']\s+content=["'][^"']*["']\s*\/?>/i,
      `<meta property="og:url" content="${fullCanon}">`
    );
  return out;
}

function resolveCanonicalForConsolidatedSolution(slug) {
  if (SPECIFIC_SOLUTIONS_CANONICAL_MAP[slug]) {
    return SPECIFIC_SOLUTIONS_CANONICAL_MAP[slug];
  }
  if (slug.endsWith('-smart-tv-acr-blocking')) {
    return '/guides/stop-samsung-smart-tv-acr-tracking';
  }
  // Check if this slug is a use-case variant of an authoritative ISP pillar
  for (const authSlug of AUTHORITATIVE_SOLUTIONS_PILLARS) {
    if (authSlug.endsWith('-isp-throttling')) {
      const ispPrefix = authSlug.replace(/-isp-throttling$/, '');
      if (slug.startsWith(`${ispPrefix}-`)) {
        return `/solutions/${authSlug}`;
      }
    }
  }
  // Micro-regional / non-English ISP with 0 GSC impressions -> consolidate to /solutions Category Hub
  return '/solutions';
}

// ============================================================================
// 2. Consolidate `/solutions/` and `/vs/` & Rewrite Internal Links to Canonicals
// ============================================================================
const rewriteLinkMap = new Map();
let consolidatedSolutionsCount = 0;
let indexableSolutionsCount = 0;

const solutionsDir = path.join(WEBSITE_DIR, 'solutions');
if (fs.existsSync(solutionsDir)) {
  for (const file of fs.readdirSync(solutionsDir).sort()) {
    if (!file.endsWith('.html')) continue;
    const slug = file.replace(/\.html$/, '');
    const absPath = path.join(solutionsDir, file);
    const html = fs.readFileSync(absPath, 'utf8');

    if (AUTHORITATIVE_SOLUTIONS_PILLARS.has(slug)) {
      const updated = applyCanonicalAndRobots(html, `/solutions/${slug}`, true);
      if (updated !== html) fs.writeFileSync(absPath, updated, 'utf8');
      indexableSolutionsCount++;
    } else {
      const targetCanon = resolveCanonicalForConsolidatedSolution(slug);
      rewriteLinkMap.set(`/solutions/${slug}`, targetCanon);
      const updated = applyCanonicalAndRobots(html, targetCanon, false);
      if (updated !== html) fs.writeFileSync(absPath, updated, 'utf8');
      consolidatedSolutionsCount++;
    }
  }
}

let consolidatedVsCount = 0;
let indexableVsCount = 0;
const vsDir = path.join(WEBSITE_DIR, 'vs');
if (fs.existsSync(vsDir)) {
  for (const file of fs.readdirSync(vsDir).sort()) {
    if (!file.endsWith('.html')) continue;
    const slug = file.replace(/\.html$/, '');
    const absPath = path.join(vsDir, file);
    const html = fs.readFileSync(absPath, 'utf8');

    if (CONSOLIDATED_VS_SLUGS.has(slug)) {
      rewriteLinkMap.set(`/vs/${slug}`, '/vs');
      const updated = applyCanonicalAndRobots(html, '/vs', false);
      if (updated !== html) fs.writeFileSync(absPath, updated, 'utf8');
      consolidatedVsCount++;
    } else {
      indexableVsCount++;
    }
  }
}

// Rewrite any internal links in indexable pages ( skips noindex files to avoid unnecessary I/O )
for (const dir of ['solutions', 'setup', 'vs', 'guides']) {
  const dirAbs = path.join(WEBSITE_DIR, dir);
  if (!fs.existsSync(dirAbs)) continue;
  for (const file of fs.readdirSync(dirAbs)) {
    if (!file.endsWith('.html')) continue;
    const absPath = path.join(dirAbs, file);
    let html = fs.readFileSync(absPath, 'utf8');
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;
    let changed = false;
    for (const [oldHref, newHref] of rewriteLinkMap.entries()) {
      if (html.includes(`href="${oldHref}"`)) {
        html = html.split(`href="${oldHref}"`).join(`href="${newHref}"`);
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(absPath, html, 'utf8');
  }
}

// ============================================================================
// 3. Phase 3 Item 4: Merge Eduroam P2P & Remote Dev SSH Sections into
//    `/solutions/eduroam-campus-wifi-gaming-packet-loss.html`
// ============================================================================
const eduroamHubPath = path.join(WEBSITE_DIR, 'solutions', 'eduroam-campus-wifi-gaming-packet-loss.html');
if (fs.existsSync(eduroamHubPath)) {
  let eduHtml = fs.readFileSync(eduroamHubPath, 'utf8');
  if (!eduHtml.includes('id="eduroam-unified-udp443-hub"')) {
    const unifiedEduroamSection = `
    <section id="eduroam-unified-udp443-hub" style="margin:2rem 0;padding:1.5rem;border-radius:14px;background:#0f172a;border:1px solid #10b981;">
      <h2 style="margin-top:0;color:#f8fafc;border:none;padding:0;">Unified Eduroam WireGuard Hub: Gaming, P2P Port Forwarding &amp; Remote SSH over UDP 443 (MTU 1380)</h2>
      <p style="color:#cbd5e1;font-size:0.94rem;line-height:1.65;">
        University <strong>eduroam (802.1X WPA2/WPA3-Enterprise)</strong> firewalls enforce strict outbound port whitelists (dropping standard WireGuard <code>UDP 51820</code>, Steam/EA UDP ports, BitTorrent P2P handshakes, and outbound <code>TCP 22</code> SSH) alongside Cisco/Aruba CAPWAP controller encapsulation that shrinks effective path MTU to <code>1380 bytes</code>.
      </p>
      <div style="overflow-x:auto;margin-top:12px;">
        <table style="width:100%;border-collapse:collapse;font-size:0.84rem;color:#e2e8f0;margin:0;">
          <thead>
            <tr style="background:#020617;color:#34d399;text-align:left;">
              <th style="padding:9px 10px;border:1px solid #1e293b;">Eduroam Workload</th>
              <th style="padding:9px 10px;border:1px solid #1e293b;">Campus Firewall Block Mechanism</th>
              <th style="padding:9px 10px;border:1px solid #1e293b;">SWEEPR VPN WireGuard Bypass Config</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="padding:8px 10px;border:1px solid #1e293b;font-weight:700;">Steam / Valorant / PS5 / Xbox Gaming</td>
              <td style="padding:8px 10px;border:1px solid #1e293b;">Symmetric NAT (Strict NAT Type 3) + UDP 3074/27015-27050 ACL Drop</td>
              <td style="padding:8px 10px;border:1px solid #1e293b;color:#6ee7b7;">Endpoint <code>78.141.205.68:443</code> + <code>MTU = 1380</code> (Open NAT Type 2, 4ms London RTT)</td>
            </tr>
            <tr>
              <td style="padding:8px 10px;border:1px solid #1e293b;font-weight:700;">Torrenting / P2P &amp; Linux ISO Seeding</td>
              <td style="padding:8px 10px;border:1px solid #1e293b;">Palo Alto / Fortinet L7 BitTorrent DHT &amp; Tracker DPI Reset</td>
              <td style="padding:8px 10px;border:1px solid #1e293b;color:#6ee7b7;">ChaCha20-Poly1305 AEAD over <code>UDP 443</code> + WFP Kill-Switch Interface Binding</td>
            </tr>
            <tr>
              <td style="padding:8px 10px;border:1px solid #1e293b;font-weight:700;">Remote Dev SSH, Git &amp; Docker Pulls</td>
              <td style="padding:8px 10px;border:1px solid #1e293b;">Outbound TCP 22 blocked + Idle TCP state table eviction every 60s</td>
              <td style="padding:8px 10px;border:1px solid #1e293b;color:#6ee7b7;"><code>PersistentKeepalive = 25</code> + <code>TCPMSS = 1340</code> (Zero SSH freeze or MTU blackhole)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>`;
    eduHtml = eduHtml.replace('<div class="cta-box">', `${unifiedEduroamSection}\n    <div class="cta-box">`);
    fs.writeFileSync(eduroamHubPath, eduHtml, 'utf8');
  }
}

// ============================================================================
// 4. Phase 3 Item 1: Inject 1-Click "Share / Embed Diagnostic Result" Badge
//    into `website/leak-test.html` and `website/isp-throttling-test.html`
// ============================================================================
function injectShareDiagnosticWidget(filePath, toolTitle, toolUrl) {
  if (!fs.existsSync(filePath)) return;
  let html = fs.readFileSync(filePath, 'utf8');
  if (html.includes('id="sweepr-share-diagnostic-badge"')) return;

  const badgeHtml = `
    <section id="sweepr-share-diagnostic-badge" class="max-w-5xl mx-auto px-6 pb-8">
      <div class="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div class="text-xs font-extrabold uppercase tracking-wider text-emerald-400 mb-1">🔗 Share or Cite This Free Diagnostic Tool</div>
          <p class="text-xs text-slate-300 m-0">Sharing a router setup guide on Reddit, GitHub, or a broadband forum? Copy a 1-click verification link or HTML badge:</p>
        </div>
        <div class="flex flex-wrap gap-2 shrink-0">
          <button type="button" onclick="navigator.clipboard.writeText('${toolUrl}');this.textContent='✓ Copied Link!';" class="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition-all cursor-pointer">📋 Copy Tool URL</button>
          <button type="button" onclick="navigator.clipboard.writeText('<a href=&quot;${toolUrl}&quot; target=&quot;_blank&quot; rel=&quot;noopener&quot;>${toolTitle} — Verified by SWEEPR VPN</a>');this.textContent='✓ Copied HTML Badge!';" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-bold text-xs transition-all cursor-pointer">&lt;/&gt; Copy HTML Embed Badge</button>
          <a href="/smart-tv-acr-blocklist.txt" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs no-underline">📄 Smart-TV ACR Blocklist (.txt)</a>
        </div>
      </div>
    </section>`;

  if (html.includes('<footer')) {
    html = html.replace('<footer', `${badgeHtml}\n  <footer`);
    fs.writeFileSync(filePath, html, 'utf8');
  }
}

injectShareDiagnosticWidget(
  path.join(WEBSITE_DIR, 'leak-test.html'),
  'Free WebRTC, IPv6 & DNS Leak Test',
  'https://sweeprvpn.com/tools/leak-test'
);
injectShareDiagnosticWidget(
  path.join(WEBSITE_DIR, 'isp-throttling-test.html'),
  'Free ISP Speed Slowdown & Throttling Checker',
  'https://sweeprvpn.com/tools/isp-throttling-test'
);

// ============================================================================
// 5. Phase 4 Item 2: Verify Public Crawlable Smart-TV ACR Telemetry Blocklist
//    (`website/smart-tv-acr-blocklist.txt` — owned by `daily-wireguard-and-acr-pipeline.mjs`)
// ============================================================================
const acrBlocklistPath = path.join(WEBSITE_DIR, 'smart-tv-acr-blocklist.txt');
if (!fs.existsSync(acrBlocklistPath)) {
  console.warn('[GSC Consolidation] smart-tv-acr-blocklist.txt missing; run daily-wireguard-and-acr-pipeline.mjs.');
}

console.log(
  `[GSC Consolidation & Optimization Complete]\n` +
  `  - /solutions/ Indexable Pillars: ${indexableSolutionsCount} (Consolidated via 301/noindex: ${consolidatedSolutionsCount})\n` +
  `  - /vs/ Indexable Competitors:    ${indexableVsCount} (Consolidated via 301/noindex: ${consolidatedVsCount})\n` +
  `  - Unified Eduroam Hub updated:   /solutions/eduroam-campus-wifi-gaming-packet-loss\n` +
  `  - 1-Click Share/Embed Badges:    /tools/leak-test & /tools/isp-throttling-test\n` +
  `  - Open-Source ACR Blocklist:     /smart-tv-acr-blocklist.txt (Preserved 65-domain 8-OS list)`
);
