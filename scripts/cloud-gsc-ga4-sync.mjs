#!/usr/bin/env node
/**
 * SWEEPR VPN (sweeprvpn.com) — Headless Cloud GSC, GA4 & Play Console Sync + Strike-Zone CTR Optimizer
 *
 * Replaces local browser-subagent inspection of Google Search Console, Google Analytics 4,
 * and Google Play Console in GitHub Actions / Railway Cloud Automations.
 *
 * Capabilities:
 *   1. Authenticates via free Google Cloud Service Account (`GCP_SERVICE_ACCOUNT_JSON`).
 *   2. Pulls 28d & 7d GSC Search Analytics (`sc-domain:sweeprvpn.com`) by page & query.
 *   3. Inspects up to 15 priority/unindexed URLs via GSC URL Inspection API (`urlInspection.index.inspect`).
 *   4. Submits `https://sweeprvpn.com/sitemap.xml` via GSC Sitemaps API (`sitemaps.submit`).
 *   5. Pulls 28d GA4 funnel report (`559903365`) via Google Analytics Data API v1beta.
 *   6. Checks `com.sweepr.vpn` release track status via Google Play Developer API v3.
 *   7. Persists ground-truth metrics into `website/gsc-ga4-latest-snapshot.json`.
 *   8. Runs deterministic Strike-Zone CTR `<title>` & `<meta>` surgery on up to 3 eligible
 *      indexable pages (Positions 3–30, CTR < 3%, outside 14-day `titleUpdatedAt` cooldown).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasServiceAccountCredentials,
  getServiceAccountEmail,
  fetchGscSearchAnalytics,
  listGscSitemaps,
  submitGscSitemap,
  inspectGscUrl,
  fetchGa4FunnelReport,
  fetchPlayAppTrackStatus,
  formatIsoDateDaysAgo
} from './lib/google-cloud-api.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VPN_ROOT = path.resolve(__dirname, '..');
const rootEnvPath = path.join(VPN_ROOT, '.env');
if (typeof process.loadEnvFile === 'function' && fs.existsSync(rootEnvPath)) {
  try { process.loadEnvFile(rootEnvPath); } catch {}
}
const WEBSITE_DIR = path.join(VPN_ROOT, 'website');
const SNAPSHOT_PATH = path.join(WEBSITE_DIR, 'gsc-ga4-latest-snapshot.json');
const PILLAR_STATE_PATH = path.join(WEBSITE_DIR, 'pillar-enrichment-state.json');
const INDEXING_QUEUE_PATH = path.join(WEBSITE_DIR, 'indexing-queue.json');

const RAILWAY_CRM_BASE = (process.env.SWEEPR_RAILWAY_CRM || process.env.SWEEPR_CRM_URL || 'https://sweepr-crm-production.up.railway.app').replace(/\/+$/, '');
const CLEANER_CRM_BASE = (process.env.SWEEPR_CRM_BASE || 'https://sweeprcleaner.com').replace(/\/+$/, '');
const CRM_USER = process.env.CRM_ADMIN_USER || 'admin';
const CRM_PASS = (process.env.CRM_ADMIN_PASSWORD || '').trim();
const CRM_API_KEY = (process.env.SWEEPR_CRM_API_KEY || '').trim();

const GSC_SITE_URL = process.env.GSC_SITE_URL || 'sc-domain:sweeprvpn.com';
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '559903365';
const SITEMAP_FEED_URL = 'https://sweeprvpn.com/sitemap.xml';
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_CTR_REWRITES_PER_RUN = 3;

const FORBIDDEN_COMPLIANCE_RE = /\b(netflix|hulu|bbc\s*iplayer\s*unblock|unblock\s+us|bypass\s+geo|pirate|torrent\s+unblock|kodi|stremio)\b/i;

function normalizeUrlPath(rawUrl) {
  try {
    const u = new URL(rawUrl, 'https://sweeprvpn.com');
    const p = u.pathname.replace(/\/+$/, '') || '/';
    return p;
  } catch {
    return String(rawUrl || '/').trim();
  }
}

function resolveHtmlFileForRoute(urlPath) {
  const coreMap = {
    '/': 'index.html',
    '/pricing': 'pricing.html',
    '/solutions': 'solutions.html',
    '/setup': 'setup.html',
    '/guides': 'guides.html',
    '/vs': 'vs.html',
    '/tools/leak-test': 'leak-test.html',
    '/tools/isp-throttling-test': 'isp-throttling-test.html',
    '/tools/vpn-renewal-price-checker': 'vpn-renewal-price-checker.html',
    '/tools/smart-tv-tracking-check': 'smart-tv-tracking-check.html',
    '/tools/whats-on-my-wifi': 'whats-on-my-wifi.html',
    '/public-wifi': 'public-wifi.html',
    '/de': 'de-index.html',
    '/fr': 'fr-index.html',
    '/es': 'es-index.html',
    '/de/pricing': 'de-pricing.html',
    '/fr/pricing': 'fr-pricing.html',
    '/es/pricing': 'es-pricing.html',
    '/de/tools/leak-test': 'de-leak-test.html',
    '/fr/tools/leak-test': 'fr-leak-test.html',
    '/es/tools/leak-test': 'es-leak-test.html',
    '/pt-br/tools/leak-test': 'pt-br-leak-test.html',
    '/sv/tools/leak-test': 'sv-leak-test.html',
    '/vs/totalvpn': 'vs/totalvpn.html',
    '/alternatives/totalvpn': 'alternatives-totalvpn.html',
    '/warrant-canary': 'warrant-canary.html'
  };
  if (coreMap[urlPath]) return path.join(WEBSITE_DIR, coreMap[urlPath]);
  if (/^\/(solutions|setup|guides|vs)\/[a-z0-9-]+$/i.test(urlPath)) {
    const abs = path.join(WEBSITE_DIR, `${urlPath.slice(1)}.html`);
    if (!fs.existsSync(abs)) return null;
    try {
      const html = fs.readFileSync(abs, 'utf8');
      if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) {
        return null;
      }
    } catch {
      return null;
    }
    return abs;
  }
  return null;
}

function buildQueryMatchedTitleAndDesc(urlPath, topQuery, currentTitle, currentDesc) {
  // Never overwrite localized DE/FR/ES/PT-BR/SV pages or core conversion/tool/hub pages with generic English pillar templates
  if (/^\/(de|fr|es|pt-br|sv)(\/|$)/i.test(urlPath)) return null;
  if (!/^\/(solutions|setup|guides|vs)\/[a-z0-9-]+$/i.test(urlPath)) return null;
  const cleanQuery = String(topQuery || '')
    .replace(/["'`[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleanQuery || cleanQuery.length < 4 || /\b(site|inurl|intitle):/i.test(cleanQuery) || FORBIDDEN_COMPLIANCE_RE.test(cleanQuery)) return null;

  // On /vs/[competitor], reject mismatched competitor queries (e.g., "nordvpn" leaking onto /vs/totalvpn)
  if (urlPath.startsWith('/vs/')) {
    const slugTokens = urlPath.replace(/^\/vs\//, '').split('-').filter((t) => t.length >= 3);
    const qLower = cleanQuery.toLowerCase();
    if (slugTokens.length > 0 && !slugTokens.some((t) => qLower.includes(t))) return null;
  }

  // Skip if currentTitle already covers every significant token of cleanQuery
  const currentLower = String(currentTitle || '').toLowerCase();
  const sigTokens = cleanQuery.toLowerCase().split(/\s+/).filter((t) => t.length >= 2 && !['to', 'on', 'in', 'for', 'of', 'the', 'and', 'or', 'my', 'a'].includes(t));
  if (sigTokens.length > 0 && sigTokens.every((t) => currentLower.includes(t))) {
    return null;
  }

  const LOWER_MID = new Set(['to', 'on', 'in', 'for', 'of', 'the', 'and', 'or', 'with', 'via', 'vs']);
  const words = cleanQuery.split(/\s+/);
  const titleCasedQuery = words
    .map((w, idx) => {
      const lw = w.toLowerCase();
      if (lw === 'wireguard') return 'WireGuard';
      if (lw === 'steamos') return 'SteamOS';
      if (lw === 'macos') return 'macOS';
      if (lw === 'ios') return 'iOS';
      if (lw === 'nvidia') return 'NVIDIA';
      if (lw === 'opnsense') return 'OPNsense';
      if (lw === 'pfsense') return 'pfSense';
      if (lw === 'openwrt') return 'OpenWrt';
      if (/^gl\.?inet$/i.test(w)) return 'GL.iNet';
      if (/^(vpn|isp|dns|mtu|ssh|p2p|acr|uk|us|5g|4k|uhd|lan|tv|os|cli|nas|lg|bt|ee|o2|tcp|udp|ip|ipv6|doh|nat|cgnat|pppoe)$/i.test(w)) return w.toUpperCase();
      if (lw === 'wifi' || lw === 'wi-fi') return 'Wi-Fi';
      if (idx > 0 && idx < words.length - 1 && LOWER_MID.has(lw)) return lw;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');

  const hasWg = /\bwireguard\b/i.test(titleCasedQuery);
  const hasVpn = /\bvpn\b/i.test(titleCasedQuery);
  let candidateTitle = hasWg
    ? `${titleCasedQuery} (2026 10Gbps Fix) | SWEEPR VPN`
    : `${titleCasedQuery}: 2026 10Gbps WireGuard Fix | SWEEPR VPN`;
  if (urlPath.startsWith('/setup/')) {
    candidateTitle = hasWg
      ? `${titleCasedQuery} — 2026 .conf Setup Guide | SWEEPR VPN`
      : `${titleCasedQuery} — 2026 WireGuard .conf Guide | SWEEPR VPN`;
  } else if (urlPath.startsWith('/guides/')) {
    candidateTitle = /^how to\b/i.test(titleCasedQuery)
      ? `${titleCasedQuery} (2026 Guide) | SWEEPR VPN`
      : `${titleCasedQuery} (2026 DNS & Router Guide) | SWEEPR VPN`;
  } else if (urlPath.startsWith('/vs/')) {
    candidateTitle = hasVpn
      ? `${titleCasedQuery}: 2026 Speed & Price Comparison | SWEEPR`
      : `${titleCasedQuery} VPN: 2026 Speed & Price Guide | SWEEPR`;
  }
  const compactSuffix = urlPath.startsWith('/solutions/') ? ' (2026 Fix) | SWEEPR VPN' : ' (2026 Guide) | SWEEPR VPN';
  if (candidateTitle.length > 65) {
    const withCompact = `${titleCasedQuery}${compactSuffix}`;
    if (withCompact.length <= 65) {
      candidateTitle = withCompact;
    } else if (`${titleCasedQuery} | SWEEPR VPN`.length <= 65) {
      candidateTitle = `${titleCasedQuery} | SWEEPR VPN`;
    } else {
      const maxQueryLen = Math.max(10, 65 - compactSuffix.length);
      let trimmedQuery = titleCasedQuery.slice(0, maxQueryLen).replace(/\s+\S*$/, '').trim();
      if (trimmedQuery.length < 10) trimmedQuery = titleCasedQuery.slice(0, maxQueryLen).trim();
      trimmedQuery = trimmedQuery.replace(/\b(on|for|with|using|and|to|in|of|over|via|vs)$/i, '').trim();
      candidateTitle = `${trimmedQuery}${compactSuffix}`;
    }
  }
  if (candidateTitle.length > 65) {
    candidateTitle = candidateTitle.slice(0, 65).trim();
  }
  if (candidateTitle.length < 30 || candidateTitle === currentTitle) return null;

  const shortQ = cleanQuery.length > 42 ? cleanQuery.slice(0, 42).replace(/\s+\S*$/, '').trim() : cleanQuery;
  const candidateDesc = `Guide for ${shortQ}: verified 2026 10Gbps WireGuard setup (MTU 1420/1412/1380), encrypted DNS 10.66.0.1, and 30s Home Wi-Fi scanner.`;
  return { title: candidateTitle, description: candidateDesc };
}

function applyHtmlHeadRewrite(html, newTitle, newDesc) {
  const escTitle = newTitle.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const escDesc = newDesc.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  let out = html;
  out = out.replace(/<title[^>]*>[\s\S]*?<\/title>/i, `<title>${escTitle}</title>`);
  out = out.replace(/<meta\s+name=["']description["']\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${escDesc}" />`);
  out = out.replace(/<meta\s+property=["']og:title["']\s+content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${escTitle}" />`);
  out = out.replace(/<meta\s+property=["']og:description["']\s+content="[^"]*"\s*\/?>/i, `<meta property="og:description" content="${escDesc}" />`);
  out = out.replace(/<meta\s+name=["']twitter:title["']\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:title" content="${escTitle}" />`);
  out = out.replace(/<meta\s+name=["']twitter:description["']\s+content="[^"]*"\s*\/?>/i, `<meta name="twitter:description" content="${escDesc}" />`);
  return out;
}

function buildCrmHeaders(baseUrl) {
  let origin = baseUrl;
  try { origin = new URL(baseUrl).origin; } catch {}
  return {
    'Content-Type': 'application/json',
    'X-Sweepr-Project': 'vpn',
    Origin: origin,
    ...(CRM_API_KEY ? { 'x-crm-api-key': CRM_API_KEY, 'x-sweepr-api-key': CRM_API_KEY } : {}),
    ...(CRM_PASS ? { Authorization: 'Basic ' + Buffer.from(`${CRM_USER}:${CRM_PASS}`).toString('base64') } : {})
  };
}

async function postJsonSafe(url, headers, payload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    const text = await res.text();
    return { url, status: res.status, ok: res.ok, body: text.slice(0, 200) };
  } catch (err) {
    return { url, status: 0, ok: false, error: err.message };
  }
}

async function syncVpnGscGa4ToCentralCrm({ snapshot, gscIngestRows, appliedCtrRewrites, inspectedCount, nowIso }) {
  const results = {
    syncedAt: nowIso,
    cloudSync: null,
    telemetry: null,
    changelog: []
  };

  const rowsPayload = (gscIngestRows && gscIngestRows.length > 0
    ? gscIngestRows
    : Object.entries(snapshot.pages || {})
        .filter(([, stats]) => stats && stats.topQuery && Number(stats.avgPosition || 0) > 0)
        .map(([urlPath, stats]) => ({
          date: nowIso.slice(0, 10),
          query: String(stats.topQuery).trim().toLowerCase(),
          page: `https://sweeprvpn.com${urlPath === '/' ? '/' : urlPath}`,
          clicks: Number(stats.clicks28d || 0),
          impressions: Number(stats.impressions28d || 0),
          ctr: Number(stats.ctrPct || 0) / 100,
          position: Number(stats.avgPosition || 0)
        }))
  ).slice(0, 500);

  if (CRM_API_KEY || CRM_PASS) {
    results.cloudSync = await postJsonSafe(
      `${RAILWAY_CRM_BASE}/api/crm/seo/gsc/cloud-sync`,
      buildCrmHeaders(RAILWAY_CRM_BASE),
      {
        project_id: 'vpn',
        site_url: GSC_SITE_URL,
        rows: rowsPayload,
        gsc_summary: snapshot.gscSummary || {},
        ga4_summary: snapshot.ga4Summary || {},
        inspected_urls_count: inspectedCount,
        ctr_rewrites_count: appliedCtrRewrites.length
      }
    );
    if (!results.cloudSync.ok) {
      console.warn(`[Cloud CRM GSC Sync] Notice (${results.cloudSync.status}): ${results.cloudSync.error || results.cloudSync.body}`);
    } else {
      console.log(`[Cloud CRM GSC Sync] Synced ${rowsPayload.length} GSC rows to ${RAILWAY_CRM_BASE} (HTTP ${results.cloudSync.status}).`);
    }
  } else {
    console.log('[Cloud CRM GSC Sync] Skipped protected /api/crm/seo/gsc/cloud-sync (CRM_ADMIN_PASSWORD / SWEEPR_CRM_API_KEY not configured).');
  }

  results.telemetry = await postJsonSafe(
    `${RAILWAY_CRM_BASE}/v1/telemetry/event`,
    {
      'Content-Type': 'application/json',
      'X-Sweepr-Project': 'vpn',
      ...(CRM_API_KEY ? { 'x-crm-api-key': CRM_API_KEY, 'x-sweepr-api-key': CRM_API_KEY } : {})
    },
    {
      project_id: 'vpn',
      event_name: 'gsc_ga4_cloud_sync_completed',
      category: 'seo_audit',
      os: 'server',
      properties: {
        gscSummary: snapshot.gscSummary || {},
        ga4Summary: snapshot.ga4Summary || {},
        ctrRewritesCount: appliedCtrRewrites.length,
        inspectedUrlsCount: inspectedCount,
        rankingPagesCount: Object.keys(snapshot.pages || {}).length
      }
    }
  );

  const shouldLogChangelog =
    (appliedCtrRewrites.length > 0 || process.argv.includes('--log-changelog')) &&
    Boolean(CRM_API_KEY || CRM_PASS);

  if (shouldLogChangelog) {
    const impr28d = snapshot.gscSummary?.last28Days?.impressions ?? 0;
    const clicks28d = snapshot.gscSummary?.last28Days?.clicks ?? 0;
    const changelogPayload = {
      project_id: 'vpn',
      date: nowIso.slice(0, 10),
      category: appliedCtrRewrites.length > 0 ? 'technical_seo' : 'gsc_indexing',
      title: appliedCtrRewrites.length > 0
        ? `[VPN] Cloud GSC Strike-Zone CTR Surgery (${appliedCtrRewrites.length} pillar${appliedCtrRewrites.length === 1 ? '' : 's'})`
        : `[VPN] Cloud GSC & GA4 Telemetry Sync (${nowIso.slice(0, 10)})`,
      description: appliedCtrRewrites.length > 0
        ? `Rewrote titles/meta on ${appliedCtrRewrites.map((r) => `${r.urlPath} (query="${r.query}", pos ${r.avgPosition})`).join(', ')}. 28d GSC: ${impr28d} impressions, ${clicks28d} clicks.`
        : `Automated GSC & GA4 snapshot sync completed (${rowsPayload.length} rows, ${inspectedCount} URL inspections). 28d GSC: ${impr28d} impressions, ${clicks28d} clicks.`,
      impact: `GSC 28d: ${impr28d} impr / ${clicks28d} clicks; CTR rewrites: ${appliedCtrRewrites.length}`,
      impact_area: 'sweeprvpn.com pillars & GSC Strike-Zone CTR',
      author: 'sweepr-cloud-bot',
      status: 'deployed',
      target_urls: appliedCtrRewrites.map((r) => `https://sweeprvpn.com${r.urlPath === '/' ? '/' : r.urlPath}`),
      metadata: {
        inspectedCount,
        gscSummary: snapshot.gscSummary || {},
        ga4Summary: snapshot.ga4Summary || {},
        rewrites: appliedCtrRewrites
      }
    };

    const crmTargets = [...new Set([RAILWAY_CRM_BASE, CLEANER_CRM_BASE].filter(Boolean))];
    for (const base of crmTargets) {
      const cRes = await postJsonSafe(`${base}/api/crm/seo/changelog`, buildCrmHeaders(base), changelogPayload);
      results.changelog.push(cRes);
      if (!cRes.ok) {
        console.warn(`[Cloud CRM Changelog] Notice for ${base} (${cRes.status}): ${cRes.error || cRes.body}`);
      }
    }
  }

  return results;
}

async function runCloudGscGa4Sync() {
  const dryRun = process.argv.includes('--dry-run');
  const skipCrm = process.argv.includes('--skip-crm');
  const nowIso = new Date().toISOString();
  let gscIngestRows = [];
  let inspectedCount = 0;

  let snapshot = {
    capturedAt: nowIso,
    windowDays: 28,
    property: GSC_SITE_URL,
    gscSummary: {},
    pages: {},
    historicalGscRedirectedUrls: []
  };
  if (fs.existsSync(SNAPSHOT_PATH)) {
    try {
      snapshot = { ...snapshot, ...JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')) };
    } catch {}
  }

  let pillarState = { titleUpdatedAt: {}, proofUpdatedAt: {} };
  if (fs.existsSync(PILLAR_STATE_PATH)) {
    try {
      pillarState = { ...pillarState, ...JSON.parse(fs.readFileSync(PILLAR_STATE_PATH, 'utf8')) };
    } catch {}
  }

  let indexingQueue = { pending_urls: [], gsc_requested: [] };
  if (fs.existsSync(INDEXING_QUEUE_PATH)) {
    try {
      indexingQueue = { ...indexingQueue, ...JSON.parse(fs.readFileSync(INDEXING_QUEUE_PATH, 'utf8')) };
    } catch {}
  }

  if (hasServiceAccountCredentials()) {
    console.log(`[Cloud GSC/GA4 Sync] Authenticated with Google Service Account: ${getServiceAccountEmail()}`);
    const endDate = formatIsoDateDaysAgo(2);
    const start28d = formatIsoDateDaysAgo(30);
    const start7d = formatIsoDateDaysAgo(9);

    try {
      const [rows28dPage, rows7dPage, rows28dQueryPage, rows28dDailyQueryPage] = await Promise.all([
        fetchGscSearchAnalytics({ siteUrl: GSC_SITE_URL, startDate: start28d, endDate, dimensions: ['page'], rowLimit: 500 }),
        fetchGscSearchAnalytics({ siteUrl: GSC_SITE_URL, startDate: start7d, endDate, dimensions: ['page'], rowLimit: 500 }),
        fetchGscSearchAnalytics({ siteUrl: GSC_SITE_URL, startDate: start28d, endDate, dimensions: ['query', 'page'], rowLimit: 1000 }),
        fetchGscSearchAnalytics({ siteUrl: GSC_SITE_URL, startDate: start28d, endDate, dimensions: ['date', 'query', 'page'], rowLimit: 5000 })
      ]);

      const page7dMap = new Map();
      let clicks7d = 0;
      let impr7d = 0;
      for (const r of rows7dPage) {
        const urlPath = normalizeUrlPath(r.keys?.[0]);
        page7dMap.set(urlPath, r);
        clicks7d += Number(r.clicks || 0);
        impr7d += Number(r.impressions || 0);
      }

      const topQueryByPage = new Map();
      for (const r of rows28dQueryPage) {
        const query = r.keys?.[0];
        const urlPath = normalizeUrlPath(r.keys?.[1]);
        const existing = topQueryByPage.get(urlPath);
        if (!existing || Number(r.impressions || 0) > Number(existing.impressions || 0)) {
          topQueryByPage.set(urlPath, { query, impressions: Number(r.impressions || 0), position: Number(r.position || 0) });
        }
      }

      const dailySourceRows =
        Array.isArray(rows28dDailyQueryPage) && rows28dDailyQueryPage.length > 0
          ? rows28dDailyQueryPage.map((r) => ({
              date: String(r.keys?.[0] || endDate).trim(),
              query: String(r.keys?.[1] || '').trim().toLowerCase(),
              page: String(r.keys?.[2] || '').trim(),
              clicks: Math.max(0, Number(r.clicks || 0)),
              impressions: Math.max(0, Number(r.impressions || 0)),
              ctr: Number(r.ctr || 0),
              position: Number(r.position || 0)
            }))
          : rows28dQueryPage.map((r) => ({
              date: endDate,
              query: String(r.keys?.[0] || '').trim().toLowerCase(),
              page: String(r.keys?.[1] || '').trim(),
              clicks: Math.max(0, Number(r.clicks || 0)),
              impressions: Math.max(0, Number(r.impressions || 0)),
              ctr: Number(r.ctr || 0),
              position: Number(r.position || 0)
            }));

      gscIngestRows = dailySourceRows
        .filter((r) => r.date && r.query && r.page && r.position > 0)
        .sort((a, b) => b.impressions - a.impressions);

      let clicks28d = 0;
      let impr28d = 0;
      let weightedPosSum = 0;

      for (const r of rows28dPage) {
        const urlPath = normalizeUrlPath(r.keys?.[0]);
        const impr = Number(r.impressions || 0);
        const clk = Number(r.clicks || 0);
        const pos = Number(Number(r.position || 0).toFixed(1));
        const ctrPct = impr > 0 ? Number(((clk / impr) * 100).toFixed(2)) : 0;
        const r7 = page7dMap.get(urlPath);
        const topQ = topQueryByPage.get(urlPath)?.query || snapshot.pages?.[urlPath]?.topQuery || '';

        clicks28d += clk;
        impr28d += impr;
        weightedPosSum += pos * impr;

        const prevEntry = snapshot.pages?.[urlPath] || {};
        const appliedAt = prevEntry.appliedAt || pillarState.titleUpdatedAt?.[urlPath] || '2026-11-04T05:00:00.000Z';
        const daysElapsed = Math.max(0, Math.round((Date.now() - Date.parse(appliedAt)) / (24 * 60 * 60 * 1000)));

        snapshot.pages[urlPath] = {
          ...prevEntry,
          impressions28d: impr,
          impressions7d: Number(r7?.impressions || prevEntry.impressions7d || 0),
          clicks28d: clk,
          ctrPct,
          avgPosition: pos,
          avgPosition7d: r7?.position ? Number(Number(r7.position).toFixed(1)) : prevEntry.avgPosition7d || pos,
          topQuery: topQ,
          appliedAt,
          changeType: prevEntry.changeType || 'GSC_TITLE_SURGERY',
          preChangeBaseline: prevEntry.preChangeBaseline || {
            capturedAt: appliedAt,
            gscImpressions28d: impr,
            gscClicks28d: clk,
            gscCtrPct: ctrPct,
            gscAvgPosition: pos,
            ga4ToolOrDownloadEvents: prevEntry.ga4Conversions || 0,
            ga4CheckoutStarts: 0
          },
          postChangeActual: {
            lastMeasuredAt: nowIso,
            daysElapsed,
            gscImpressions28d: impr,
            gscClicks28d: clk,
            gscCtrPct: ctrPct,
            gscAvgPosition: pos,
            ga4ToolOrDownloadEvents: prevEntry.ga4Conversions || 0,
            ga4CheckoutStarts: 0
          }
        };
      }

      if (impr28d > 0) {
        snapshot.gscSummary = {
          ...snapshot.gscSummary,
          last28Days: {
            dateRange: `${start28d} to ${endDate}`,
            clicks: clicks28d,
            impressions: impr28d,
            ctrPct: Number(((clicks28d / impr28d) * 100).toFixed(2)),
            avgPosition: Number((weightedPosSum / impr28d).toFixed(1))
          },
          last7Days: {
            dateRange: `${start7d} to ${endDate}`,
            clicks: clicks7d,
            impressions: impr7d,
            ctrPct: impr7d > 0 ? Number(((clicks7d / impr7d) * 100).toFixed(2)) : 0,
            avgPosition: snapshot.gscSummary?.last7Days?.avgPosition || 20.0
          }
        };
      }
      console.log(`[Cloud GSC Sync] Pulled ${rows28dPage.length} ranking pages (${impr28d} 28d impressions, ${clicks28d} clicks).`);
    } catch (err) {
      console.warn(`[Cloud GSC Sync] Notice: ${err.message}`);
    }

    // Submit Sitemap & Check Sitemaps API
    try {
      await submitGscSitemap({ siteUrl: GSC_SITE_URL, feedpath: SITEMAP_FEED_URL });
      const sitemaps = await listGscSitemaps({ siteUrl: GSC_SITE_URL });
      console.log(`[Cloud GSC Sitemaps] Submitted ${SITEMAP_FEED_URL} (${sitemaps.length} sitemaps active).`);
    } catch (err) {
      console.warn(`[Cloud GSC Sitemaps] Notice: ${err.message}`);
    }

    // Inspect up to 12 priority URLs from indexing-queue.json via URL Inspection API
    try {
      const urlsToInspect = (indexingQueue.pending_urls || []).slice(0, 12);
      const inspectedNow = [];
      for (const u of urlsToInspect) {
        const res = await inspectGscUrl({ siteUrl: GSC_SITE_URL, inspectionUrl: u });
        inspectedNow.push({ url: u, ...res, inspectedAt: nowIso });
      }
      if (inspectedNow.length > 0) {
        inspectedCount = inspectedNow.length;
        indexingQueue.gsc_requested = [
          ...inspectedNow.map((x) => x.url),
          ...(indexingQueue.gsc_requested || [])
        ].slice(0, 200);
        console.log(`[Cloud GSC URL Inspection] Inspected ${inspectedNow.length} priority URLs.`);
      }
    } catch (err) {
      console.warn(`[Cloud GSC URL Inspection] Notice: ${err.message}`);
    }

    // Pull GA4 Funnel Report
    try {
      const ga4Report = await fetchGa4FunnelReport({ propertyId: GA4_PROPERTY_ID });
      snapshot.ga4Summary = {
        capturedAt: nowIso,
        propertyId: GA4_PROPERTY_ID,
        ...ga4Report.summary,
        events: ga4Report.events
      };
      for (const [pagePath, pStats] of Object.entries(ga4Report.pages || {})) {
        const normP = normalizeUrlPath(pagePath);
        if (snapshot.pages[normP]) {
          snapshot.pages[normP].ga4Sessions = pStats.sessions;
        }
      }
      console.log(`[Cloud GA4 Sync] Pulled GA4 Property ${GA4_PROPERTY_ID}: ${ga4Report.summary.activeUsers} active users, ${ga4Report.summary.sessions} sessions.`);
    } catch (err) {
      console.warn(`[Cloud GA4 Sync] Notice: ${err.message}`);
    }

    // Check Google Play Developer API track status (optional)
    try {
      const tracks = await fetchPlayAppTrackStatus({ packageName: 'com.sweepr.vpn' });
      snapshot.playConsoleTracks = tracks;
      console.log(`[Cloud Play Console Sync] Checked com.sweepr.vpn tracks (${tracks.length} tracks returned).`);
    } catch {}
  } else {
    console.log('ℹ️  [Cloud GSC/GA4 Sync] GCP_SERVICE_ACCOUNT_JSON not set — running Strike-Zone CTR check against existing website/gsc-ga4-latest-snapshot.json.');
  }

  // Deterministic Strike-Zone CTR Optimizer (Positions 3.0–30.0, CTR < 3%, Strictly Respecting 14-Day Cooldown)
  let ctrRewritesCount = 0;
  const appliedCtrRewrites = [];
  const candidateEntries = Object.entries(snapshot.pages || {})
    .filter(([urlPath, stats]) => {
      const pos = Number(stats.avgPosition || 99);
      const impr = Number(stats.impressions28d || 0);
      const ctr = Number(stats.ctrPct || 0);
      if (pos < 3.0 || pos > 30.0 || impr < 5 || ctr >= 3.0) return false;
      const lastMod = pillarState.titleUpdatedAt?.[urlPath] || stats.appliedAt;
      if (lastMod && Date.now() - Date.parse(lastMod) < FOURTEEN_DAYS_MS) return false;
      const absFile = resolveHtmlFileForRoute(urlPath);
      return Boolean(absFile && fs.existsSync(absFile));
    })
    .sort((a, b) => Number(b[1].impressions28d || 0) - Number(a[1].impressions28d || 0));

  for (const [urlPath, stats] of candidateEntries) {
    if (ctrRewritesCount >= MAX_CTR_REWRITES_PER_RUN) break;
    const absFile = resolveHtmlFileForRoute(urlPath);
    if (!absFile || !fs.existsSync(absFile)) continue;
    const html = fs.readFileSync(absFile, 'utf8');
    if (/<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(html)) continue;

    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content="([^"]*)"/i);
    const currentTitle = titleMatch ? titleMatch[1].trim() : '';
    const currentDesc = descMatch ? descMatch[1].trim() : '';

    const rewrite = buildQueryMatchedTitleAndDesc(urlPath, stats.topQuery, currentTitle, currentDesc);
    if (!rewrite) continue;

    const updatedHtml = applyHtmlHeadRewrite(html, rewrite.title, rewrite.description);
    if (updatedHtml !== html) {
      if (!dryRun) {
        fs.writeFileSync(absFile, updatedHtml, 'utf8');
        pillarState.titleUpdatedAt[urlPath] = nowIso;
        const fullUrl = `https://sweeprvpn.com${urlPath}`;
        indexingQueue.pending_urls = [
          fullUrl,
          ...(indexingQueue.pending_urls || []).filter((u) => u !== fullUrl)
        ];
      }
      ctrRewritesCount++;
      appliedCtrRewrites.push({
        urlPath,
        query: stats.topQuery,
        oldTitle: currentTitle,
        newTitle: rewrite.title,
        impressions28d: stats.impressions28d,
        avgPosition: stats.avgPosition
      });
      console.log(`✨ [Cloud CTR Rewrite] ${urlPath} (Pos ${stats.avgPosition}, ${stats.impressions28d} impr, query="${stats.topQuery}") -> "${rewrite.title}"`);
    }
  }

  snapshot.capturedAt = nowIso;
  if (!dryRun && !skipCrm) {
    snapshot.lastCrmSync = await syncVpnGscGa4ToCentralCrm({
      snapshot,
      gscIngestRows,
      appliedCtrRewrites,
      inspectedCount,
      nowIso
    });
  } else if (dryRun || skipCrm) {
    console.log(`[Cloud CRM GSC Sync] Skipped (${dryRun ? '--dry-run' : '--skip-crm'}). Would sync ${gscIngestRows.length || Object.keys(snapshot.pages || {}).length} candidate GSC page/query records and ${appliedCtrRewrites.length} CTR rewrites.`);
  }
  if (!dryRun) {
    fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    fs.writeFileSync(PILLAR_STATE_PATH, JSON.stringify(pillarState, null, 2) + '\n', 'utf8');
    fs.writeFileSync(INDEXING_QUEUE_PATH, JSON.stringify(indexingQueue, null, 2) + '\n', 'utf8');
  }
  console.log(`✅ [Cloud GSC/GA4 Sync Complete] CTR rewrites applied today: ${ctrRewritesCount} (14-day cooldown enforced on ${Object.keys(pillarState.titleUpdatedAt || {}).length} pillars).`);
}

runCloudGscGa4Sync().catch((err) => {
  console.error('[Cloud GSC/GA4 Sync Error]', err);
  process.exit(1);
});
