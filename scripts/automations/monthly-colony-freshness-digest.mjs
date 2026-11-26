#!/usr/bin/env node
/**
 * Safe Automation #3 (Read-Only / Draft-Only Advisor):
 * Monthly SEO Colony Internal Link Rotation & Benchmark Freshness Digest
 *
 * Schedule: 1st of every month 08:00 Europe/London
 * Output  : artifacts/monthly-colony-freshness-digest.md (unless --dry-run)
 * Safety  : Strictly READ-ONLY on website/, scripts/, and git. Never edits HTML or commits.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VPN_ROOT = path.resolve(__dirname, '..', '..');
const WEBSITE_DIR = path.join(VPN_ROOT, 'website');
const SNAPSHOT_PATH = path.join(WEBSITE_DIR, 'gsc-ga4-latest-snapshot.json');
const LEDGER_PATH = path.join(WEBSITE_DIR, 'seo-strategy-performance-ledger.json');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
const FAQ_PATH = path.join(WEBSITE_DIR, 'faq.html');
const OUTREACH_SEED_PATH = path.join(WEBSITE_DIR, 'outreach-seed.json');

const TIER1_PAGES = [
  { urlPath: '/', file: 'index.html' },
  { urlPath: '/pricing', file: 'pricing.html' },
  { urlPath: '/alternatives/totalvpn', file: 'alternatives-totalvpn.html' },
  { urlPath: '/tools/leak-test', file: 'leak-test.html' },
  { urlPath: '/tools/isp-throttling-test', file: 'isp-throttling-test.html' },
  { urlPath: '/setup/gl-inet-travel-router', file: 'setup/gl-inet-travel-router.html' },
  { urlPath: '/vs/totalvpn', file: 'vs/totalvpn.html' }
];

function parseCliArgs(argv) {
  const dryRun = argv.includes('--dry-run');
  let outDir = path.join(VPN_ROOT, 'artifacts');
  const outIdx = argv.indexOf('--out-dir');
  if (outIdx >= 0 && argv[outIdx + 1]) {
    outDir = path.resolve(VPN_ROOT, argv[outIdx + 1]);
  } else {
    const eqArg = argv.find((a) => a.startsWith('--out-dir='));
    if (eqArg) outDir = path.resolve(VPN_ROOT, eqArg.slice('--out-dir='.length));
  }
  return { dryRun, outDir };
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

function scanTier1BenchmarkFreshness(nowMs) {
  const results = [];
  const thirtyDaysMs = 30 * 86400000;
  for (const p of TIER1_PAGES) {
    const abs = path.join(WEBSITE_DIR, p.file);
    if (!fs.existsSync(abs)) {
      results.push({ ...p, status: 'MISSING_FILE', dateStr: null, ageDays: null });
      continue;
    }
    const raw = fs.readFileSync(abs, 'utf8');
    // Look for "Last Speed-Tested", "Last Verified", "Probe Verified", or benchmark date near YYYY-MM-DD
    const markerMatch = raw.match(/(?:Last\s+Speed-Tested|Last\s+Verified|Probe\s+Verified|Benchmark\s+Captured)[^<\n]{0,60}?(\d{4}-\d{2}-\d{2})/i);
    if (!markerMatch) {
      results.push({ ...p, status: 'PENDING_M1_M2_MARKER', dateStr: null, ageDays: null });
      continue;
    }
    const dateStr = markerMatch[1];
    const parsedMs = Date.parse(`${dateStr}T00:00:00Z`);
    const ageDays = Number.isFinite(parsedMs) ? Math.floor((nowMs - parsedMs) / 86400000) : null;
    const isStale = Number.isFinite(parsedMs) && nowMs - parsedMs > thirtyDaysMs;
    results.push({
      ...p,
      status: isStale ? 'STALE (>30d)' : 'FRESH (<=30d)',
      dateStr,
      ageDays
    });
  }
  return results;
}

async function main() {
  const { dryRun, outDir } = parseCliArgs(process.argv.slice(2));
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const sitemapPaths = loadSitemapPaths();
  const snapshot = fs.existsSync(SNAPSHOT_PATH) ? JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')) : { pages: {} };
  const ledger = fs.existsSync(LEDGER_PATH) ? JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8')) : { entries: {} };
  const outreachSeed = fs.existsSync(OUTREACH_SEED_PATH) ? JSON.parse(fs.readFileSync(OUTREACH_SEED_PATH, 'utf8')) : [];

  const liveSnapshotRows = Object.entries(snapshot.pages || {})
    .filter(([urlPath]) => sitemapPaths.has(urlPath))
    .map(([urlPath, d]) => ({
      urlPath,
      avgPosition: Number(d.avgPosition || 0),
      impressions28d: Number(d.impressions28d || 0),
      clicks28d: Number(d.clicks28d || 0),
      ctrPct: Number(d.ctrPct || 0),
      topQuery: d.topQuery || ''
    }));

  // 1. Top-3 Stabilized Money Pages ready to graduate from /faq/ PAA rotation
  const top3Stabilized = liveSnapshotRows
    .filter((r) => r.avgPosition > 0 && r.avgPosition <= 3.0)
    .sort((a, b) => a.avgPosition - b.avgPosition || b.impressions28d - a.impressions28d)
    .slice(0, 5);

  // Next highest-impression Pos 4-15 live BOFU targets to rotate into /faq/
  const nextBofuTargets = liveSnapshotRows
    .filter((r) => r.avgPosition > 3.0 && r.avgPosition <= 15.0)
    .sort((a, b) => b.impressions28d - a.impressions28d)
    .slice(0, 6);

  const faqPresent = fs.existsSync(FAQ_PATH);
  const faqRaw = faqPresent ? fs.readFileSync(FAQ_PATH, 'utf8') : '';

  // 2. Benchmark Freshness (>30 days old)
  const benchmarkRows = scanTier1BenchmarkFreshness(nowMs);
  const ledgerEntries = Object.values(ledger.entries || {});
  const staleLedgerEntries = ledgerEntries
    .filter((e) => {
      const ts = Date.parse(e.postChangeActual?.lastMeasuredAt || e.lastAuditedAt || '');
      return Number.isFinite(ts) && nowMs - ts > 30 * 86400000;
    })
    .slice(0, 10);

  // 3. Referring-Domain Delta (filtering out sitepatent.com)
  const cleanSeed = (Array.isArray(outreachSeed) ? outreachSeed : []).filter(
    (r) => r && String(r.website || '').toLowerCase() !== 'sitepatent.com' && r.message_id !== 'portal-vpn-sitepatent-com'
  );
  const listedDomains = new Set(
    cleanSeed
      .filter((r) => String(r.status || '').toLowerCase() === 'listed' && r.website)
      .map((r) => String(r.website).toLowerCase())
  );
  const pendingOrSubmitted = cleanSeed.filter((r) => String(r.status || '').toLowerCase() !== 'listed');

  const lines = [
    '# Monthly SEO Colony Internal Link Rotation & Benchmark Freshness Digest',
    '',
    `- **Generated At**: \`${nowIso}\` (Schedule: 1st of every month 08:00 Europe/London)`,
    `- **Mode**: READ-ONLY / DRAFT-ONLY ADVISOR (${dryRun ? '`--dry-run` (0 files written)' : 'artifact digest only; zero HTML/sitemap/git mutations'})`,
    `- **\`/faq/\` PAA SEO Colony Status**: ${faqPresent ? 'LIVE (`website/faq.html` present)' : 'PENDING_M2 (`website/faq.html` will be created in M2)'}`,
    '',
    '## 1. `/faq/` PAA SEO Colony Link Rotation Candidates',
    '',
    '### Top-3 Stabilized Money Pages (Graduate from `/faq/` Rotation)',
    '',
    '| URL | Avg Pos | Impressions (28d) | Clicks (28d) | Currently Linked in `/faq/` | Top Query |',
    '|---|---:|---:|---:|:---:|---|',
    ...(top3Stabilized.length > 0
      ? top3Stabilized.map((r) => `| \`${r.urlPath}\` | ${r.avgPosition} | ${r.impressions28d} | ${r.clicks28d} | ${faqPresent ? (faqRaw.includes(r.urlPath) ? 'Yes' : 'No') : 'PENDING_M2'} | ${r.topQuery || '—'} |`)
      : ['| _No Pos <= 3.0 live URLs in snapshot_ | — | 0 | 0 | — | — |']),
    '',
    '### Next Highest-Impression `Pos 4–15` Live BOFU Targets (Rotate Into `/faq/`)',
    '',
    '| URL | Avg Pos | Impressions (28d) | CTR | Currently Linked in `/faq/` | Top Query |',
    '|---|---:|---:|---:|:---:|---|',
    ...(nextBofuTargets.length > 0
      ? nextBofuTargets.map((r) => `| \`${r.urlPath}\` | ${r.avgPosition} | ${r.impressions28d} | ${r.ctrPct}% | ${faqPresent ? (faqRaw.includes(r.urlPath) ? 'Yes' : 'No') : 'PENDING_M2'} | ${r.topQuery || '—'} |`)
      : ['| _No Pos 4–15 live URLs in snapshot_ | — | 0 | 0% | — | — |']),
    '',
    '## 2. Tier-1 Benchmark Freshness (`>30 Days` Audit)',
    '',
    '| Tier-1 Page | File | Status | Marker Date | Age (Days) |',
    '|---|---|---|---|---:|',
    ...benchmarkRows.map((b) => `| \`${b.urlPath}\` | \`website/${b.file}\` | **${b.status}** | ${b.dateStr || '—'} | ${b.ageDays ?? '—'} |`),
    '',
    `- **Performance Ledger Stale Entries (>30d since \`lastMeasuredAt\`)**: ${staleLedgerEntries.length} (out of ${ledgerEntries.length} total tracked entries)`,
    '',
    '## 3. Referring-Domain & Directory Ledger Summary',
    '',
    `- **Unique \`listed\` Referring Domains (\`website/outreach-seed.json\`)**: **${listedDomains.size}** (${[...listedDomains].sort().join(', ') || 'none'})`,
    `- **Total Tracked Clean Seed Entries**: ${cleanSeed.length} (${pendingOrSubmitted.length} pending/submitted)`,
    '',
    '## 4. Actionable Manual Checklist',
    '',
    ...(faqPresent
      ? top3Stabilized.map((g, i) => {
          const incoming = nextBofuTargets[i];
          return incoming
            ? `- [ ] Swap \`${g.urlPath}\` (Pos ${g.avgPosition}) in \`website/faq.html\` for \`${incoming.urlPath}\` (Pos ${incoming.avgPosition}, ${incoming.impressions28d} impr).`
            : `- [ ] Review graduating \`${g.urlPath}\` (Pos ${g.avgPosition}) in \`website/faq.html\`.`;
        })
      : ['- [ ] Once M2 publishes `website/faq.html`, verify Top-3 graduation swaps against the Pos 4–15 BOFU list above.']),
    ...benchmarkRows
      .filter((b) => b.status.startsWith('STALE') || b.status.startsWith('PENDING'))
      .map((b) => `- [ ] Refresh real iPerf3 / WebRTC leak benchmark & update \`Last Speed-Tested\` date on \`website/${b.file}\` (${b.status}).`),
    ''
  ];

  const md = lines.join('\n');
  if (dryRun) {
    console.log(md);
    console.log('\n[DRY-RUN] monthly-colony-freshness-digest completed with 0 disk writes.');
    return;
  }

  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'monthly-colony-freshness-digest.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`✅ Wrote read-only digest to ${path.relative(VPN_ROOT, outPath)}`);
}

main().catch((err) => {
  console.error('[monthly-colony-freshness-digest Error]', err);
  process.exit(1);
});
