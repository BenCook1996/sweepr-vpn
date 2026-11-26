#!/usr/bin/env node
/**
 * Safe Automation #1 (Read-Only / Draft-Only):
 * Weekly GSC Query-Mining & 1-Hour Refresh Brief
 *
 * Schedule: Every Monday 07:00 Europe/London
 * Output  : artifacts/weekly-gsc-refresh-brief.md (unless --dry-run)
 * Safety  : Strictly READ-ONLY on website/, scripts/, and git. Never edits HTML or commits.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasServiceAccountCredentials,
  fetchGscSearchAnalytics,
  formatIsoDateDaysAgo
} from '../lib/google-cloud-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VPN_ROOT = path.resolve(__dirname, '..', '..');
const WEBSITE_DIR = path.join(VPN_ROOT, 'website');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
const SNAPSHOT_PATH = path.join(WEBSITE_DIR, 'gsc-ga4-latest-snapshot.json');
const ENRICHMENT_STATE_PATH = path.join(WEBSITE_DIR, 'pillar-enrichment-state.json');

function parseCliArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  const tryLive = argv.includes('--live');
  let outDir = path.join(VPN_ROOT, 'artifacts');
  const outIdx = argv.indexOf('--out-dir');
  if (outIdx >= 0 && argv[outIdx + 1]) {
    outDir = path.resolve(VPN_ROOT, argv[outIdx + 1]);
  } else {
    const eqArg = argv.find((a) => a.startsWith('--out-dir='));
    if (eqArg) outDir = path.resolve(VPN_ROOT, eqArg.slice('--out-dir='.length));
  }
  return { dryRun, tryLive, outDir };
}

function loadSitemapPaths() {
  if (!fs.existsSync(SITEMAP_PATH)) return new Set();
  const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const paths = new Set();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    try {
      paths.add(new URL(m[1].trim()).pathname);
    } catch {}
  }
  return paths;
}

function resolveHtmlPathForUrl(urlPath) {
  const clean = urlPath === '/' ? 'index' : urlPath.replace(/^\/+|\/+$/g, '');
  const map = {
    'de': 'de-index',
    'fr': 'fr-index',
    'es': 'es-index',
    'de/pricing': 'de-pricing',
    'fr/pricing': 'fr-pricing',
    'es/pricing': 'es-pricing',
    'tools/leak-test': 'leak-test',
    'de/tools/leak-test': 'de-leak-test',
    'fr/tools/leak-test': 'fr-leak-test',
    'es/tools/leak-test': 'es-leak-test',
    'pt-br/tools/leak-test': 'pt-br-leak-test',
    'sv/tools/leak-test': 'sv-leak-test',
    'tools/isp-throttling-test': 'isp-throttling-test',
    'tools/vpn-renewal-price-checker': 'vpn-renewal-price-checker',
    'tools/smart-tv-tracking-check': 'smart-tv-tracking-check',
    'tools/whats-on-my-wifi': 'whats-on-my-wifi',
    'alternatives/totalvpn': 'alternatives-totalvpn'
  };
  const rel = (map[clean] || clean) + '.html';
  const abs = path.join(WEBSITE_DIR, rel);
  return fs.existsSync(abs) ? abs : null;
}

function readTitleAndH1(urlPath) {
  const abs = resolveHtmlPathForUrl(urlPath);
  if (!abs) return { title: null, h1: null };
  const raw = fs.readFileSync(abs, 'utf8');
  const t = (raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/\s+/g, ' ').trim() || null;
  const h1 = (raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
  return { title: t, h1 };
}

function buildSurgicalDrafts(candidates) {
  const drafts = [];
  for (const row of candidates.slice(0, 3)) {
    const { title, h1 } = readTitleAndH1(row.urlPath);
    const query = row.topQuery || row.urlPath.replace(/^\/(?:solutions|setup|guides|vs)\//, '').replace(/-/g, ' ');
    const capQuery = query.replace(/\b\w/g, (c) => c.toUpperCase());
    let proposedTitle = `${capQuery}: 10Gbps WireGuard Fix | SWEEPR VPN`;
    if (proposedTitle.length > 65) {
      proposedTitle = `${capQuery.slice(0, 38).trim()} | WireGuard | SWEEPR VPN`;
    }
    if (proposedTitle.length > 65) {
      proposedTitle = `${proposedTitle.slice(0, 62).trim()}...`;
    }
    const proposedH2 = `How 10Gbps WireGuard Eliminates ${capQuery} Bottlenecks (3 Devices + Router)`;
    drafts.push({
      urlPath: row.urlPath,
      avgPosition: row.avgPosition,
      impressions28d: row.impressions28d,
      ctrPct: row.ctrPct,
      topQuery: row.topQuery || 'N/A',
      currentTitle: title || '(dynamic/missing)',
      currentH1: h1 || '(dynamic/missing)',
      proposedTitle,
      proposedH2
    });
  }
  return drafts;
}

async function main() {
  const { dryRun, tryLive, outDir } = parseCliArgs(process.argv.slice(2));
  const nowIso = new Date().toISOString();
  const sitemapPaths = loadSitemapPaths();

  const snapshot = fs.existsSync(SNAPSHOT_PATH)
    ? JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'))
    : { capturedAt: null, pages: {} };
  const enrichState = fs.existsSync(ENRICHMENT_STATE_PATH)
    ? JSON.parse(fs.readFileSync(ENRICHMENT_STATE_PATH, 'utf8'))
    : { titleUpdatedAt: {} };

  let dataSource = `Offline Snapshot (${SNAPSHOT_PATH.replace(VPN_ROOT + path.sep, '')}, captured ${snapshot.capturedAt || 'unknown'})`;
  let liveRows = [];

  if (tryLive && hasServiceAccountCredentials()) {
    try {
      const startDate = formatIsoDateDaysAgo(90);
      const endDate = formatIsoDateDaysAgo(1);
      liveRows = await fetchGscSearchAnalytics({
        siteUrl: process.env.GSC_SITE_URL || 'sc-domain:sweeprvpn.com',
        startDate,
        endDate,
        dimensions: ['page', 'query'],
        rowLimit: 500
      });
      if (liveRows.length > 0) {
        dataSource = `Live 90-Day GSC Search Analytics (${startDate} to ${endDate}, ${liveRows.length} rows)`;
      }
    } catch (err) {
      dataSource += ` [Live GSC fallback notice: ${err.message}]`;
    }
  }

  const allEntries = Object.entries(snapshot.pages || {}).map(([urlPath, data]) => {
    const inSitemap = sitemapPaths.has(urlPath);
    const titleModIso = enrichState.titleUpdatedAt?.[urlPath] || data.appliedAt || null;
    const daysSinceChange = titleModIso ? Math.floor((Date.now() - Date.parse(titleModIso)) / 86400000) : null;
    const in14dCooldown = daysSinceChange !== null && daysSinceChange < 14;
    return {
      urlPath,
      inSitemap,
      impressions28d: Number(data.impressions28d || 0),
      impressions7d: Number(data.impressions7d || 0),
      clicks28d: Number(data.clicks28d || 0),
      ctrPct: Number(data.ctrPct || 0),
      avgPosition: Number(data.avgPosition || 0),
      avgPosition7d: data.avgPosition7d ?? null,
      topQuery: data.topQuery || '',
      daysSinceChange,
      in14dCooldown
    };
  });

  const livePages = allEntries.filter((e) => e.inSitemap);
  const redirectedSnapshotSlugs = allEntries.filter((e) => !e.inSitemap);

  // 1. Top avgPosition > 5 sorted by clicks28d desc, then impressions28d desc
  const posGt5 = livePages
    .filter((e) => e.avgPosition > 5)
    .sort((a, b) => b.clicks28d - a.clicks28d || b.impressions28d - a.impressions28d)
    .slice(0, 15);

  // 2. Striking-distance Pos 4-15 highest-impression low-CTR (<3%)
  const strikeZone = livePages
    .filter((e) => e.avgPosition >= 4 && e.avgPosition <= 15 && e.ctrPct < 3.0)
    .sort((a, b) => b.impressions28d - a.impressions28d)
    .slice(0, 12);

  // 3. Stagnant Pos > 50 or 0-click / dropping URLs (>60d or no recent cooldown)
  const stagnantOrDropping = livePages
    .filter((e) => (e.avgPosition > 50 || (e.clicks28d === 0 && e.impressions28d >= 10 && e.impressions7d === 0)) && (e.daysSinceChange === null || e.daysSinceChange >= 14))
    .sort((a, b) => b.avgPosition - a.avgPosition || b.impressions28d - a.impressions28d)
    .slice(0, 12);

  // Surgical drafts (only live sitemap pages not in 14d title cooldown)
  const draftPool = strikeZone.filter((e) => !e.in14dCooldown);
  const drafts = buildSurgicalDrafts(draftPool.length > 0 ? draftPool : posGt5.filter((e) => !e.in14dCooldown));

  const lines = [
    '# Weekly GSC Query-Mining & 1-Hour Refresh Brief',
    '',
    `- **Generated At**: \`${nowIso}\` (Schedule: Every Monday 07:00 Europe/London)`,
    `- **Mode**: READ-ONLY / DRAFT-ONLY (${dryRun ? '`--dry-run` (0 files written)' : 'artifact report only; zero HTML/sitemap/git mutations'})`,
    `- **Data Source**: ${dataSource}`,
    `- **Sitemap Corpus**: ${sitemapPaths.size} canonical URLs | Snapshot Entries: ${allEntries.length} (${livePages.length} live canonical, ${redirectedSnapshotSlugs.length} historical 301-redirected slugs excluded from HTML edits)`,
    '',
    '## 1. Top `avgPosition > 5` Live Pages (Sorted by Clicks, then Impressions)',
    '',
    '| URL | Clicks (28d) | Impressions (28d / 7d) | CTR | Avg Pos | Top Query | Cooldown |',
    '|---|---:|---:|---:|---:|---|---|',
    ...(posGt5.length > 0
      ? posGt5.map((r) => `| \`${r.urlPath}\` | ${r.clicks28d} | ${r.impressions28d} / ${r.impressions7d} | ${r.ctrPct}% | ${r.avgPosition} | ${r.topQuery || '—'} | ${r.in14dCooldown ? '14d Lock' : 'Eligible'} |`)
      : ['| _No matching rows_ | 0 | 0 / 0 | 0% | — | — | — |']),
    '',
    '## 2. Striking-Distance `Pos 4–15` Low-CTR (`<3%`) Candidates',
    '',
    '| URL | Avg Pos | Impressions (28d) | CTR | Top Query | Status |',
    '|---|---:|---:|---:|---|---|',
    ...(strikeZone.length > 0
      ? strikeZone.map((r) => `| \`${r.urlPath}\` | ${r.avgPosition} | ${r.impressions28d} | ${r.ctrPct}% | ${r.topQuery || '—'} | ${r.in14dCooldown ? '14d Cooldown' : 'Ready for CTR Refresh'} |`)
      : ['| _No Pos 4–15 low-CTR candidates in snapshot_ | — | 0 | 0% | — | — |']),
    '',
    '## 3. Stagnant `Pos > 50` or 0-Click / Dropping Live URLs (1-Word URL + 301 Evaluation)',
    '',
    '| URL | Avg Pos | Impressions (28d / 7d) | Days Since Last Edit | Top Query | Recommendation |',
    '|---|---:|---:|---:|---|---|',
    ...(stagnantOrDropping.length > 0
      ? stagnantOrDropping.map((r) => `| \`${r.urlPath}\` | ${r.avgPosition} | ${r.impressions28d} / ${r.impressions7d} | ${r.daysSinceChange ?? 'N/A'} | ${r.topQuery || '—'} | ${r.daysSinceChange !== null && r.daysSinceChange < 60 ? 'Monitor (<60d grace window)' : 'Evaluate 1-Word URL + 301 / H1 Refresh'} |`)
      : ['| _No stagnant Pos > 50 candidates_ | — | 0 / 0 | — | — | — |']),
    '',
    '### Historical `301`-Redirected Slugs in GSC Snapshot (Do NOT Edit HTML)',
    '',
    ...(redirectedSnapshotSlugs.length > 0
      ? redirectedSnapshotSlugs.map((r) => `- \`${r.urlPath}\` (Pos ${r.avgPosition}, ${r.impressions28d} impr) — **NOT in \`sitemap.xml\`** (consolidated via HTTP 301; skip HTML edits).`)
      : ['- None detected.']),
    '',
    '## 4. Ready-to-Paste Surgical `<title>` & `<h2>` Refresh Drafts (Max 3, UK Sole Trader & Principle 2 Compliant)',
    '',
    '> Guardrails: `SWEEPR VPN (UK Sole Trader)`, 3 simultaneous VPN devices (+ unlimited behind router), WireGuard-only, `<title>` <= 65 chars, zero geo-unblocking claims.',
    ''
  ];

  for (const [idx, d] of drafts.entries()) {
    lines.push(
      `### Draft ${idx + 1}: \`${d.urlPath}\``,
      `- **Metrics**: Pos \`${d.avgPosition}\`, \`${d.impressions28d}\` 28d impressions, \`${d.ctrPct}%\` CTR | Top Query: \`${d.topQuery}\``,
      `- **Current \`<title>\`**: \`${d.currentTitle}\``,
      `- **Proposed \`<title>\`** (${d.proposedTitle.length}/65 chars): \`${d.proposedTitle}\``,
      `- **Current \`<h1>\`**: \`${d.currentH1}\``,
      `- **Proposed \`<h2>\`**: \`${d.proposedH2}\``,
      ''
    );
  }

  if (liveRows.length > 0) {
    lines.push('## 5. Live 90-Day GSC Top Query-Page Pairs (Sample Top 10)', '');
    lines.push('| Page | Query | Clicks | Impressions | Pos |');
    lines.push('|---|---|---:|---:|---:|');
    for (const r of liveRows.slice(0, 10)) {
      lines.push(`| \`${r.keys?.[0] || ''}\` | ${r.keys?.[1] || ''} | ${r.clicks || 0} | ${r.impressions || 0} | ${Number(r.position || 0).toFixed(1)} |`);
    }
    lines.push('');
  }

  const md = lines.join('\n');
  if (dryRun) {
    console.log(md);
    console.log('\n[DRY-RUN] weekly-gsc-refresh-brief completed with 0 disk writes.');
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'weekly-gsc-refresh-brief.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`✅ Wrote read-only brief to ${path.relative(VPN_ROOT, outPath)}`);
}

main().catch((err) => {
  console.error('[weekly-gsc-refresh-brief Error]', err);
  process.exit(1);
});
