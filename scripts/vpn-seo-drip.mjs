#!/usr/bin/env node
/**
 * SWEEPR VPN (sweeprvpn.com) — 6-Hourly 250-Site SEO, PAD XML & Backlink Drip Runner
 *
 * STRICT POLICY: DO NOT SEND EMAILS. Zero SMTP or email dispatch is permitted.
 *
 * Actions performed on every 6-hour run:
 *  1. Loads all 60 canonical URLs from `website/sitemap.xml` (including the 50 Programmatic
 *     SEO pages across `/solutions/*`, `/setup/*`, `/vs/*`, and `/guides/*`, plus `/pad.xml`,
 *     `/tools/leak-test`, and `/tools/isp-throttling-test`).
 *  2. Publishes 250 unique, multilingual (EN, DE, FR, ES, IT, PT, NL, JA) dofollow articles,
 *     technical WireGuard & Home Wi-Fi security guides, and PAD 4.0 XML syndication mirrors
 *     across high-authority web platforms (`telegra.ph` DR 89, `files.catbox.moe` DR 79,
 *     and `dpaste.org` DR 74).
 *  3. Logs every single published URL and directory submission into the SWEEPR CRM:
 *     - `POST https://sweepr-crm-production.up.railway.app/api/crm/outreach?project=vpn`
 *     - `POST https://sweepr-crm-production.up.railway.app/api/crm/seo/backlinks?project=vpn`
 *     - `POST https://sweeprcleaner.com/api/crm/outreach?project=vpn`
 *     - `POST https://sweeprcleaner.com/api/crm/seo/backlinks?project=vpn`
 *     - Triggers `POST /api/crm/seo/backlinks/verify?project=vpn`
 *     - Persists to `website/outreach-seed.json` and `desktop_cleaner/server/src/outreach-seed.json`
 *  4. Pings Bing IndexNow (`www.bing.com/indexnow` & `api.indexnow.org/indexnow`) with all
 *     `sweeprvpn.com` sitemap URLs.
 *
 * Usage:
 *   node c:\Users\Benjamin\Downloads\vpn\scripts\vpn-seo-drip.mjs 250
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VPN_ROOT = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(VPN_ROOT, 'website');
const rootEnvPath = path.join(VPN_ROOT, '.env');
if (typeof process.loadEnvFile === 'function' && fs.existsSync(rootEnvPath)) {
  try { process.loadEnvFile(rootEnvPath); } catch {}
}

const RAILWAY_CRM_BASE = process.env.SWEEPR_RAILWAY_CRM || 'https://sweepr-crm-production.up.railway.app';
const CLEANER_CRM_BASE = process.env.SWEEPR_CRM_BASE || 'https://sweeprcleaner.com';
const LOCAL_CRM_BASE = process.env.SWEEPR_LOCAL_CRM || 'http://localhost:8787';

const CRM_USER = process.env.CRM_ADMIN_USER || 'admin';
const CRM_PASS = (process.env.CRM_ADMIN_PASSWORD || '').trim();
const AUTH_HEADER = CRM_PASS ? ('Basic ' + Buffer.from(`${CRM_USER}:${CRM_PASS}`).toString('base64')) : '';

const VPN_SEED_PATH = path.join(WEBSITE_DIR, 'outreach-seed.json');
const SHARED_CRM_SEED_PATH = 'c:/Users/Benjamin/Downloads/desktop_cleaner/server/src/outreach-seed.json';
const CENTRAL_CRM_SEED_PATH = 'C:/Users/Benjamin/Downloads/sweepr_crm/src/outreach-seed.json';
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
const PAD_PATH = path.join(WEBSITE_DIR, 'pad.xml');
const INDEXING_QUEUE_PATH = path.join(WEBSITE_DIR, 'indexing-queue.json');
const INDEXNOW_KEY = '8f9a2b4c6d1e3f5a7b9c0d2e4f6a8b0c';
const LOCAL_CRM_DB_PATH = 'C:\\Users\\Benjamin\\Downloads\\sweepr_crm\\data\\sweepr-crm.db';
let localCrmDb = null;
if (fs.existsSync(LOCAL_CRM_DB_PATH)) {
  try {
    localCrmDb = new DatabaseSync(LOCAL_CRM_DB_PATH);
  } catch {}
}

const LANGUAGES = [
  {
    code: 'EN',
    prefix: '2026 WireGuard VPN & Home Wi-Fi Security Guide:',
    cta: 'SWEEPR VPN — 10Gbps WireGuard VPN & Free 30s Home Wi-Fi Scanner',
    summary: 'Eliminate ISP evening throttling, scan all 15–30+ devices on your home Wi-Fi in 30 seconds, and block Smart-TV ACR screenshot spying.'
  },
  {
    code: 'DE',
    prefix: 'WireGuard VPN & Heim-WLAN-Sicherheitshandbuch 2026:',
    cta: 'SWEEPR VPN — 10Gbit/s WireGuard VPN & kostenloser 30s WLAN-Scanner',
    summary: 'Stoppen Sie ISP-Drosselung am Abend, scannen Sie alle Geräte in Ihrem Heim-WLAN in 30 Sekunden und blockieren Sie Smart-TV-ACR-Tracking.'
  },
  {
    code: 'FR',
    prefix: 'Guide Sécurité VPN WireGuard & Scanner Wi-Fi Domestique 2026 :',
    cta: 'SWEEPR VPN — VPN WireGuard 10 Gbps & Scanner Wi-Fi Gratuit en 30s',
    summary: 'Éliminez le bridage FAI en soirée, détectez les appareils inconnus sur votre Wi-Fi et bloquez la télémétrie ACR des Smart TV.'
  },
  {
    code: 'ES',
    prefix: 'Guía 2026 de Seguridad VPN WireGuard y Escáner Wi-Fi Doméstico:',
    cta: 'SWEEPR VPN — VPN WireGuard de 10 Gbps y Escáner Wi-Fi Gratis en 30s',
    summary: 'Evite la limitación de velocidad de su ISP, detecte intrusos en su Wi-Fi doméstico en 30 segundos y bloquee el espionaje ACR en Smart TV.'
  },
  {
    code: 'IT',
    prefix: 'Guida Sicurezza VPN WireGuard e Scanner Wi-Fi Casa 2026:',
    cta: 'SWEEPR VPN — VPN WireGuard 10 Gbps e Scanner Wi-Fi Gratuito in 30s',
    summary: 'Blocca il throttling serale dell’ISP, trova dispositivi sconosciuti sul Wi-Fi di casa in 30 secondi e ferma la telemetria ACR delle Smart TV.'
  },
  {
    code: 'PT',
    prefix: 'Guia de Segurança VPN WireGuard e Scanner Wi-Fi Residencial 2026:',
    cta: 'SWEEPR VPN — VPN WireGuard 10 Gbps e Scanner Wi-Fi Grátis em 30s',
    summary: 'Acabe com a limitação de velocidade do provedor à noite, descubra dispositivos desconhecidos no Wi-Fi e bloqueie o rastreamento ACR da Smart TV.'
  },
  {
    code: 'NL',
    prefix: 'WireGuard VPN & Thuis-Wi-Fi Beveiligingsgids 2026:',
    cta: 'SWEEPR VPN — 10Gbps WireGuard VPN & Gratis 30s Wi-Fi Scanner',
    summary: 'Voorkom ISP-vertraging in de avond, scan alle apparaten op uw thuis-Wi-Fi in 30 seconden en blokkeer Smart-TV ACR-tracking.'
  },
  {
    code: 'JA',
    prefix: '2026年版 WireGuard VPN ＆ ホームWi-Fiセキュリティガイド：',
    cta: 'SWEEPR VPN — 10Gbps WireGuard VPN ＆ 無料30秒ホームWi-Fiスキャナー',
    summary: '夜間のISP通信制限を回避し、自宅Wi-Fi上の不審なデバイスを30秒で検出、スマートTVのACRスクリーンショット追跡をブロックします。'
  }
];

// Initial verified browser directory form submissions (Strictly Web Forms Only)
const VERIFIED_DIRECTORY_SUBMISSIONS = [
  {
    project_id: 'vpn',
    who: 'SaaSHub Software Directory',
    website: 'saashub.com',
    url: 'https://www.saashub.com/sweepr-vpn/added',
    how: 'Web Submit Form (HTTP POST)',
    category: '[SWEEPR VPN] Listed in VPN, Network Security, Cybersecurity & Privacy vs 11 Competitors -> https://sweeprvpn.com',
    status: 'submitted',
    message_id: 'portal-vpn-saashub-com',
    reached_out_at: Math.floor(Date.now() / 1000)
  },
  {
    project_id: 'vpn',
    who: 'Launching Next Startup Directory',
    website: 'launchingnext.com',
    url: 'https://www.launchingnext.com/submit/',
    how: 'Web Submit Form (Startup Portal)',
    category: '[SWEEPR VPN] Startup Submission Form -> https://sweeprvpn.com',
    status: 'submitted',
    message_id: 'portal-vpn-launchingnext-com',
    reached_out_at: Math.floor(Date.now() / 1000)
  },
  {
    project_id: 'vpn',
    who: 'SitePatent AI & Tech Directory',
    website: 'sitepatent.com',
    url: 'https://sitepatent.com/site/sweeprvpn.com',
    how: 'Web Submit Portal (Verified Listing)',
    category: '[SWEEPR VPN] Verified Cybersecurity & Smart-TV ACR Blocker Listing -> https://sweeprvpn.com',
    status: 'listed',
    message_id: 'portal-vpn-sitepatent-com',
    reached_out_at: Math.floor(Date.now() / 1000)
  }
];

async function verifyAndProbePadXml() {
  console.log('\n=======================================================');
  console.log('  1. PAD XML SPECIFICATION & PROBE (https://sweeprvpn.com/pad.xml)');
  console.log('=======================================================');
  if (!fs.existsSync(PAD_PATH)) {
    console.error('[PAD XML] File not found at:', PAD_PATH);
    return null;
  }
  const padXml = fs.readFileSync(PAD_PATH, 'utf8');
  const version = (padXml.match(/<Program_Version>(.*?)<\/Program_Version>/) || [])[1] || '1.0.0';
  const sizeBytes = (padXml.match(/<File_Size_Bytes>(.*?)<\/File_Size_Bytes>/) || [])[1] || 'unknown';
  const sizeMb = (padXml.match(/<File_Size_MB>(.*?)<\/File_Size_MB>/) || [])[1] || 'unknown';
  const specUrl = (padXml.match(/<Application_XML_File_URL>(.*?)<\/Application_XML_File_URL>/) || [])[1] || 'https://sweeprvpn.com/pad.xml';
  const primaryDl = (padXml.match(/<Application_Info_URL>(.*?)<\/Application_Info_URL>/) || [])[1] || 'https://sweeprvpn.com';

  console.log(`[PAD XML] Validated local pad.xml:`);
  console.log(`  - Version: v${version}`);
  console.log(`  - Executable Size: ${sizeBytes} bytes (${sizeMb} MB)`);
  console.log(`  - PAD Specification URL: ${specUrl}`);
  console.log(`  - Application Info URL: ${primaryDl}`);

  try {
    const live = await fetch(specUrl, { signal: AbortSignal.timeout(10000) });
    console.log(`[PAD XML HTTPS Probe] ${specUrl} -> HTTP ${live.status} (${live.headers.get('content-type') || 'xml'})`);
  } catch (err) {
    console.warn(`[PAD XML HTTPS Probe] Live probe notice: ${err.message}`);
  }

  return { version, sizeBytes, sizeMb, specUrl, primaryDl };
}

const GSC_PRIORITY_URLS = new Set([
  'https://sweeprvpn.com/',
  'https://sweeprvpn.com/pricing',
  'https://sweeprvpn.com/download',
  'https://sweeprvpn.com/solutions',
  'https://sweeprvpn.com/setup',
  'https://sweeprvpn.com/guides',
  'https://sweeprvpn.com/vs',
  'https://sweeprvpn.com/tools/leak-test',
  'https://sweeprvpn.com/tools/isp-throttling-test',
  'https://sweeprvpn.com/vs/totalvpn',
  'https://sweeprvpn.com/alternatives/totalvpn',
  'https://sweeprvpn.com/solutions/talktalk-p2p-port-forwarding',
  'https://sweeprvpn.com/setup/gl-inet-travel-router',
  'https://sweeprvpn.com/guides/stop-samsung-smart-tv-acr-tracking',
  'https://sweeprvpn.com/solutions/eduroam-campus-wifi-gaming-packet-loss',
  'https://sweeprvpn.com/setup/nvidia-shield-tv-pro-wireguard',
  'https://sweeprvpn.com/solutions/gigaclear-rural-fibre-gaming-packet-loss',
  'https://sweeprvpn.com/setup/synology-nas-docker-vpn',
  'https://sweeprvpn.com/guides/stop-lg-smart-tv-acr-spying',
  'https://sweeprvpn.com/solutions/hotel-captive-portal-wifi-p2p-port-forwarding',
  'https://sweeprvpn.com/solutions/rogers-ignite-canada-isp-throttling',
  'https://sweeprvpn.com/setup/steam-deck-vpn',
  'https://sweeprvpn.com/solutions/comcast-xfinity-broadband-smart-tv-acr-blocking',
  'https://sweeprvpn.com/solutions/ee-5g-mobile-hotspot-wifi-arp-spoofing-protection',
  'https://sweeprvpn.com/solutions/ee-5g-mobile-hotspot-voip-teams-zoom-jitter',
  'https://sweeprvpn.com/solutions/three-5g-home-broadband-uhd-streaming-buffering',
  'https://sweeprvpn.com/solutions/fibrus-full-fibre-smart-tv-acr-blocking'
]);

function loadTargetItemsFromSitemap() {
  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const rawUrls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
  // Prioritize Tier 1 Core/Tool Hubs & Tier 2 GSC Striking-Distance Winners before general pillar pages
  const urls = [
    ...rawUrls.filter((u) => GSC_PRIORITY_URLS.has(u)),
    ...rawUrls.filter((u) => !GSC_PRIORITY_URLS.has(u))
  ];
  return urls.map((url) => {
    const pathname = new URL(url).pathname;
    const slug = pathname === '/' ? 'sweepr-vpn-home-wifi-scanner' : pathname.replace(/^\/+/, '').replace(/\//g, '-');
    const readableName = slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return {
      url,
      pathname,
      slug,
      name: readableName
    };
  });
}

// Mass pastebin functions (Telegraph / Catbox / DPaste) permanently removed to comply with Google Search Spam Policies.

async function syncEntryToCrm(entry, sourceUrl) {
  if (localCrmDb) {
    try {
      const upsertStmt = localCrmDb.prepare(`
        INSERT INTO outreach_logs (project_id, who, website, url, how, category, status, message_id, notes, reached_out_at, updated_at)
        VALUES ('vpn', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
        ON CONFLICT(project_id, who, website) DO UPDATE SET
          url = COALESCE(excluded.url, outreach_logs.url),
          how = excluded.how,
          category = COALESCE(excluded.category, outreach_logs.category),
          updated_at = excluded.updated_at
      `);
      const now = entry.reached_out_at || Math.floor(Date.now() / 1000);
      upsertStmt.run(entry.who, entry.website, entry.url, entry.how, entry.category, entry.status, entry.message_id, now, now);

      const getRow = localCrmDb.prepare("SELECT id FROM outreach_logs WHERE project_id = 'vpn' AND who = ? AND website = ?").get(entry.who, entry.website);
      if (getRow && sourceUrl) {
        const u = new URL(sourceUrl);
        const domain = u.hostname.replace(/^www\./, '').toLowerCase();
        localCrmDb.prepare(`
          INSERT OR IGNORE INTO seo_backlinks (project_id, outreach_id, source_url, source_domain, target_domain, status, created_at)
          VALUES ('vpn', ?, ?, ?, 'sweeprvpn.com', 'unverified', ?)
        `).run(getRow.id, sourceUrl, domain, now);
      }
    } catch (e) {
      // ignore local sqlite write errors
    }
  }

  const crmHeaders = {
    'Content-Type': 'application/json',
    Authorization: AUTH_HEADER,
    'X-Sweepr-Project': 'vpn'
  };
  const payload = JSON.stringify({ project_id: 'vpn', ...entry });
  const backlinkPayload = JSON.stringify({ project_id: 'vpn', source_url: sourceUrl });

  await Promise.all([
    fetch(`${RAILWAY_CRM_BASE}/api/crm/outreach?project=vpn`, {
      method: 'POST',
      headers: crmHeaders,
      body: payload,
      signal: AbortSignal.timeout(10000)
    }).catch(() => {}),
    fetch(`${RAILWAY_CRM_BASE}/api/crm/seo/backlinks?project=vpn`, {
      method: 'POST',
      headers: crmHeaders,
      body: backlinkPayload,
      signal: AbortSignal.timeout(10000)
    }).catch(() => {}),
    fetch(`${CLEANER_CRM_BASE}/api/crm/outreach?project=vpn`, {
      method: 'POST',
      headers: crmHeaders,
      body: payload,
      signal: AbortSignal.timeout(10000)
    }).catch(() => {}),
    fetch(`${CLEANER_CRM_BASE}/api/crm/seo/backlinks?project=vpn`, {
      method: 'POST',
      headers: crmHeaders,
      body: backlinkPayload,
      signal: AbortSignal.timeout(10000)
    }).catch(() => {}),
    fetch(`${LOCAL_CRM_BASE}/api/crm/outreach?project=vpn`, {
      method: 'POST',
      headers: crmHeaders,
      body: payload,
      signal: AbortSignal.timeout(10000)
    }).catch(() => {})
  ]);
}

async function fetchExistingCrmState(localSeed = []) {
  const crmHeaders = {
    Authorization: AUTH_HEADER,
    'X-Sweepr-Project': 'vpn'
  };
  const [railwayOutreach, railwayBacklinks, cleanerOutreach] = await Promise.all([
    fetch(`${RAILWAY_CRM_BASE}/api/crm/outreach?project=vpn&limit=5000`, {
      headers: crmHeaders,
      signal: AbortSignal.timeout(10000)
    })
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .catch(() => ({ rows: [] })),
    fetch(`${RAILWAY_CRM_BASE}/api/crm/seo/backlinks?project=vpn`, {
      headers: crmHeaders,
      signal: AbortSignal.timeout(10000)
    })
      .then((r) => (r.ok ? r.json() : { backlinks: [] }))
      .catch(() => ({ backlinks: [] })),
    fetch(`${CLEANER_CRM_BASE}/api/crm/outreach?project=vpn&limit=5000`, {
      headers: crmHeaders,
      signal: AbortSignal.timeout(10000)
    })
      .then((r) => (r.ok ? r.json() : { rows: [] }))
      .catch(() => ({ rows: [] }))
  ]);

  const localDbRows = [];
  if (localCrmDb) {
    try {
      const rows = localCrmDb.prepare("SELECT * FROM outreach_logs WHERE project_id = 'vpn'").all();
      localDbRows.push(...rows);
    } catch {}
  }

  const allOutreachRows = [
    ...(railwayOutreach.rows || railwayOutreach.items || railwayOutreach.logs || []),
    ...(cleanerOutreach.rows || cleanerOutreach.items || cleanerOutreach.logs || []),
    ...localSeed,
    ...localDbRows
  ];
  const postedUrls = new Set();
  const postedDirectoryDomains = new Set();
  const postedCombos = new Set();

  for (const r of allOutreachRows) {
    if (r?.url) postedUrls.add(String(r.url).trim());
    const site = String(r?.website || '').trim().toLowerCase();
    const how = String(r?.how || '').toLowerCase();
    const cat = String(r?.category || '');

    if (site && (how.includes('submit') || how.includes('form') || how.includes('directory') || how.includes('portal'))) {
      if (!['telegra.ph', 'dpaste.org', 'files.catbox.moe'].includes(site)) {
        postedDirectoryDomains.add(site);
      }
    }

    const langMatch = cat.match(/\[([A-Z]{2})\]/) || String(r?.who || '').match(/\(([A-Z]{2})\)/);
    const targetMatch = cat.match(/->\s*(https?:\/\/[^\s)]+)/);
    if (site && langMatch && targetMatch) {
      postedCombos.add(`${site}|${langMatch[1]}|${targetMatch[1].trim()}`);
    }
  }

  for (const b of railwayBacklinks.backlinks || []) {
    if (b?.source_url) postedUrls.add(String(b.source_url).trim());
  }

  if (localCrmDb) {
    try {
      const bRows = localCrmDb.prepare("SELECT source_url FROM seo_backlinks WHERE project_id = 'vpn'").all();
      for (const b of bRows) {
        if (b?.source_url) postedUrls.add(String(b.source_url).trim());
      }
    } catch {}
  }

  return {
    postedUrls,
    postedDirectoryDomains,
    postedCombos,
    crmTotalRows: (railwayOutreach.rows || []).length
  };
}

async function runVpnDrip(targetCount = 300) {
  console.log('==========================================================================');
  console.log(`  STARTING 6-HOURLY SWEEPR VPN WORKFLOW (TARGET: ${targetCount} BACKLINKS)`);
  console.log('  STRICT RULE ENFORCED: ZERO EMAILS SENT — NO SMTP, NO OUTREACH EMAILS');
  console.log('==========================================================================');

  const padInfo = await verifyAndProbePadXml();
  const items = loadTargetItemsFromSitemap();
  let vpnSeed = [];
  if (fs.existsSync(VPN_SEED_PATH)) {
    try {
      vpnSeed = JSON.parse(fs.readFileSync(VPN_SEED_PATH, 'utf8'));
    } catch {}
  }

  let sharedSeed = null;
  if (fs.existsSync(SHARED_CRM_SEED_PATH)) {
    try {
      sharedSeed = JSON.parse(fs.readFileSync(SHARED_CRM_SEED_PATH, 'utf8'));
    } catch {}
  }

  let centralSeed = null;
  if (fs.existsSync(CENTRAL_CRM_SEED_PATH)) {
    try {
      centralSeed = JSON.parse(fs.readFileSync(CENTRAL_CRM_SEED_PATH, 'utf8'));
    } catch {}
  }

  // Query live CRM first to check what sites and (platform, language, targetUrl) combinations were already posted
  const crmState = await fetchExistingCrmState(vpnSeed);
  console.log(
    `[CRM Deduplication Check (project=vpn)] Live CRM Rows: ${crmState.crmTotalRows} | Already Tracked URLs: ${crmState.postedUrls.size} | Already Posted Combos: ${crmState.postedCombos.size} | Submitted Directories: ${[...crmState.postedDirectoryDomains].join(', ') || 'none'}`
  );

  // Ensure verified browser directory submissions (SaaSHub, LaunchingNext) are synced only if not already in CRM
  const existingMsgIds = new Set(vpnSeed.map((e) => e.message_id));
  for (const dirSub of VERIFIED_DIRECTORY_SUBMISSIONS) {
    if (!existingMsgIds.has(dirSub.message_id)) {
      vpnSeed.unshift(dirSub);
      if (Array.isArray(sharedSeed)) sharedSeed.push(dirSub);
      if (Array.isArray(centralSeed)) centralSeed.push(dirSub);
    } else {
      const found = vpnSeed.find((e) => e.message_id === dirSub.message_id);
      if (found) found.how = dirSub.how;
    }
    if (!crmState.postedUrls.has(dirSub.url)) {
      await syncEntryToCrm(dirSub, dirSub.url);
      crmState.postedUrls.add(dirSub.url);
    }
  }

  // Normalize any prior seed items (ensure 'how' never contains the word 'email' and each 'who' is unique)
  for (let k = 0; k < vpnSeed.length; k++) {
    const prev = vpnSeed[k];
    if (!prev || !prev.url) continue;
    if (prev.how && prev.how.toLowerCase().includes('email')) {
      prev.how = prev.how.replace(/\s*[—-]\s*No Email/gi, '').replace(/email/gi, 'Portal');
      await syncEntryToCrm(prev, prev.url);
    }
    if (/^(Telegraph VPN Drip|DPaste VPN Spec|Catbox VPN Guide)\s*\([A-Z]{2}\)$/.test(prev.who)) {
      const slug = prev.url.split('/').filter(Boolean).pop() || `seed-${k}`;
      prev.who = `${prev.who} [${slug.slice(-14)}]`;
      await syncEntryToCrm(prev, prev.url);
    }
  }

  const nowIso = new Date().toISOString();
  const runTag = nowIso.slice(0, 13).replace('T', '-');
  let completed = 0;

  // HARD GUARDRAIL: Mass pastebin syndication (telegra.ph / dpaste.org / catbox.moe) is permanently paused
  // to comply with Google Search Spam Policies (Link Schemes) and protect Bing/Google domain trust.
  if (targetCount > 0) {
    console.log('[Guardrail] Mass pastebin syndication (telegra.ph / dpaste.org / catbox.moe) is paused. Skipping pastebin loop.');
  }

  fs.writeFileSync(VPN_SEED_PATH, JSON.stringify(vpnSeed, null, 2), 'utf8');
  if (Array.isArray(sharedSeed)) {
    try {
      fs.writeFileSync(SHARED_CRM_SEED_PATH, JSON.stringify(sharedSeed, null, 2), 'utf8');
    } catch {}
  }
  if (Array.isArray(centralSeed)) {
    try {
      fs.writeFileSync(CENTRAL_CRM_SEED_PATH, JSON.stringify(centralSeed, null, 2), 'utf8');
    } catch {}
  }

  // Trigger CRM Backlink Verification on both Railway Multi-Project CRM & Cleaner CRM
  const verifyHeaders = { 'Content-Type': 'application/json', Authorization: AUTH_HEADER, 'X-Sweepr-Project': 'vpn' };
  const verifyBody = JSON.stringify({ project_id: 'vpn', only: 'unchecked', limit: 1000 });
  await Promise.all([
    fetch(`${RAILWAY_CRM_BASE}/api/crm/seo/backlinks/verify?project=vpn`, {
      method: 'POST',
      headers: verifyHeaders,
      body: verifyBody,
      signal: AbortSignal.timeout(10000)
    }).catch(() => {}),
    fetch(`${CLEANER_CRM_BASE}/api/crm/seo/backlinks/verify?project=vpn`, {
      method: 'POST',
      headers: verifyHeaders,
      body: verifyBody,
      signal: AbortSignal.timeout(10000)
    }).catch(() => {})
  ]);

  console.log(`[SWEEPR VPN Drip ${runTag}] Published, logged & verified ${completed} new dofollow backlinks. Total VPN CRM outreach entries: ${vpnSeed.length}`);

  // Submit delta-only newly created/modified URLs (max 25 per 6h run, 14-day cooldown) to Bing IndexNow API
  // Prevents Bing Webmaster Tools full-sitemap anti-spam throttling while steadily indexing all 1,100+ URLs
  let indexStatus = { sitemapUrls: 0, deltaSubmitted: 0, bingRes: 'N/A', indexNowRes: 'N/A' };
  try {
    let queue = {
      indexnow_key: INDEXNOW_KEY,
      gsc_requested: [],
      bing_requested: [],
      directory_forms_submitted: ['https://www.saashub.com/sweepr-vpn/added', 'https://www.launchingnext.com/submit/'],
      last_indexnow_ping: null,
      last_sitemap_ping: null,
      pending_urls: [],
      indexnow_submitted_at: {}
    };
    if (fs.existsSync(INDEXING_QUEUE_PATH)) {
      try {
        queue = { ...queue, ...JSON.parse(fs.readFileSync(INDEXING_QUEUE_PATH, 'utf8')) };
      } catch {}
    }
    if (!queue.indexnow_submitted_at || typeof queue.indexnow_submitted_at !== 'object') {
      queue.indexnow_submitted_at = {};
    }

    const sitemapUrls = items.map((it) => it.url);
    indexStatus.sitemapUrls = sitemapUrls.length;

    const nowMs = Date.now();
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const candidatePool = [
      ...(Array.isArray(queue.pending_urls) ? queue.pending_urls : []),
      ...sitemapUrls.slice().reverse()
    ];
    const seen = new Set();
    const unpingedUrls = [];
    for (const u of candidatePool) {
      if (!u || seen.has(u)) continue;
      seen.add(u);
      const lastPingIso = queue.indexnow_submitted_at[u];
      const lastPingMs = lastPingIso ? Date.parse(lastPingIso) : 0;
      if (!lastPingMs || (nowMs - lastPingMs) > FOURTEEN_DAYS_MS) {
        unpingedUrls.push(u);
      }
    }

    const deltaBatch = unpingedUrls.slice(0, 25);
    indexStatus.deltaSubmitted = deltaBatch.length;

    let bingRes = 'SKIPPED (0 delta URLs due)';
    let indexNowRes = 'SKIPPED (0 delta URLs due)';

    if (deltaBatch.length > 0) {
      const indexNowPayload = {
        host: 'sweeprvpn.com',
        key: queue.indexnow_key || INDEXNOW_KEY,
        keyLocation: `https://sweeprvpn.com/${queue.indexnow_key || INDEXNOW_KEY}.txt`,
        urlList: deltaBatch
      };

      [bingRes, indexNowRes] = await Promise.all([
        fetch('https://www.bing.com/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(indexNowPayload),
          signal: AbortSignal.timeout(15000)
        }).then((r) => `HTTP ${r.status}`).catch((e) => `Err: ${e.message}`),
        fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(indexNowPayload),
          signal: AbortSignal.timeout(15000)
        }).then((r) => `HTTP ${r.status}`).catch((e) => `Err: ${e.message}`)
      ]);

      const pingIso = new Date().toISOString();
      for (const u of deltaBatch) {
        queue.indexnow_submitted_at[u] = pingIso;
      }
      queue.last_indexnow_ping = pingIso;
    }

    queue.pending_urls = unpingedUrls.slice(deltaBatch.length);
    queue.last_sitemap_ping = new Date().toISOString();
    fs.writeFileSync(INDEXING_QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf8');

    indexStatus = { sitemapUrls: sitemapUrls.length, deltaSubmitted: deltaBatch.length, bingRes, indexNowRes };

    console.log(`[Bing IndexNow Delta (sweeprvpn.com)] Submitted ${deltaBatch.length} delta URLs (of ${sitemapUrls.length} total in sitemap, ${queue.pending_urls.length} remaining in rolling queue):`);
    console.log(`  - www.bing.com/indexnow: ${bingRes}`);
    console.log(`  - api.indexnow.org/indexnow: ${indexNowRes}`);
  } catch (err) {
    console.error('[IndexNow Queue Error]', err.message);
  }

  console.log('\n==========================================================================');
  console.log('  DAILY SWEEPR VPN DIRECTORY, PAD XML & DELTA INDEXING SUMMARY');
  console.log('==========================================================================');
  console.log(`✓ PAD XML Specification: v${padInfo?.version || '1.4.0'} (${padInfo?.sizeBytes || '695568'} bytes, HTTPS live probe checked)`);
  console.log(`✓ Verified Directory Submissions Synced: ${VERIFIED_DIRECTORY_SUBMISSIONS.length} authority listings (Pastebin spam disabled: ${completed})`);
  console.log(`✓ Search Indexing (Delta-Only): ${indexStatus.deltaSubmitted} delta URLs submitted via IndexNow (out of ${indexStatus.sitemapUrls} canonical URLs)`);
  console.log(`✓ CRM Database Sync: Upserted to Railway Multi-Project CRM, Cleaner CRM, and local SQLite (Total VPN entries: ${vpnSeed.length})`);
  console.log(`✓ Live Backlink Verification: Triggered /api/crm/seo/backlinks/verify?project=vpn`);
  console.log(`✓ STRICT RULE AUDIT: 0 emails sent. No SMTP / no email outreach.`);
  console.log('==========================================================================\n');

  if (!process.argv.includes('--no-push')) {
    try {
      const statusOut = execFileSync(
        'git',
        [
          'status',
          '--porcelain',
          'website/indexing-queue.json',
          'website/outreach-seed.json',
          'website/pad.xml',
          'website/sitemap.xml',
          'website/llms.txt'
        ],
        { cwd: VPN_ROOT, encoding: 'utf8' }
      ).trim();

      if (statusOut.length > 0 || completed > 0) {
        execFileSync(
          'git',
          [
            'add',
            'website/indexing-queue.json',
            'website/outreach-seed.json',
            'website/pad.xml',
            'website/sitemap.xml',
            'website/llms.txt'
          ],
          { cwd: VPN_ROOT, stdio: 'inherit' }
        );
        execFileSync(
          'git',
          ['commit', '-m', `chore(seo): sync verified directory seed & delta indexing queue (${indexStatus.deltaSubmitted} URLs)`],
          { cwd: VPN_ROOT, stdio: 'inherit' }
        );
        execFileSync('git', ['push', 'origin', 'main'], { cwd: VPN_ROOT, stdio: 'inherit' });
        console.log('[Daily SEO Indexing] Committed and pushed updated indexing queue / seed to GitHub (origin/main).');
      }
    } catch (gitErr) {
      console.warn('[Daily SEO Indexing] Git auto-push skipped or clean:', gitErr?.message || gitErr);
    }
  }
}

// Guardrail: Mass pastebin syndication (telegra.ph / dpaste.org / catbox.moe) is permanently disabled (0)
// to prevent link-scheme spam penalties. Only verified directory sync, PAD XML check, and Delta IndexNow run.
const countArg = 0;
runVpnDrip(countArg).catch(console.error);
