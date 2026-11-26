#!/usr/bin/env node
/**
 * Shared IndexNow + HTTP 410 Gone Pruned-URL Submission Helper
 *
 * Parses `PRUNED_410_PATHS` from `website/server.mjs` (read-only) and coordinates
 * 14-day cooldown IndexNow submissions for canonical delta URLs + pruned 410 URLs.
 */

import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_INDEXNOW_KEY = 'e159f60b7cbd19abe8a6c1c8d84bb2b7';
export const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
export const INDEXNOW_ENDPOINTS = [
  'https://www.bing.com/indexnow',
  'https://api.indexnow.org/indexnow',
  'https://yandex.com/indexnow'
];

export function extractPruned410PathsFromServer(serverMjsPath) {
  if (!serverMjsPath || !fs.existsSync(serverMjsPath)) return [];
  const src = fs.readFileSync(serverMjsPath, 'utf8');
  const blockMatch = src.match(/const\s+PRUNED_410_PATHS\s*=\s*new\s+Set\(\[([\s\S]*?)\]\)/);
  if (!blockMatch) return [];
  const paths = [];
  for (const m of blockMatch[1].matchAll(/['"]([^'"]+)['"]/g)) {
    const p = m[1].trim();
    if (p.startsWith('/')) paths.push(p);
  }
  return [...new Set(paths)].sort();
}

export function loadPruned410Urls({ serverMjsPath, origin = 'https://sweeprvpn.com' } = {}) {
  const cleanOrigin = String(origin || 'https://sweeprvpn.com').replace(/\/+$/, '');
  return extractPruned410PathsFromServer(serverMjsPath).map((p) => `${cleanOrigin}${p}`);
}

export function selectDue410Urls(
  pruned410Urls = [],
  indexingQueue = {},
  { force = false, nowMs = Date.now(), cooldownMs = FOURTEEN_DAYS_MS } = {}
) {
  const submittedMap =
    indexingQueue && typeof indexingQueue.pruned_410_submitted_at === 'object' && indexingQueue.pruned_410_submitted_at
      ? indexingQueue.pruned_410_submitted_at
      : {};
  const uniqueUrls = [...new Set(pruned410Urls.filter(Boolean))];
  const due410Urls = uniqueUrls.filter((u) => {
    if (force) return true;
    const lastIso = submittedMap[u];
    const lastMs = lastIso ? Date.parse(lastIso) : 0;
    return !lastMs || nowMs - lastMs > cooldownMs;
  });
  return { due410Urls, total410Urls: uniqueUrls.length };
}

export async function submitIndexNowWith410({
  queue = {},
  canonicalDeltaUrls = [],
  pruned410Urls = [],
  key = DEFAULT_INDEXNOW_KEY,
  host = 'sweeprvpn.com',
  endpoints = INDEXNOW_ENDPOINTS,
  dryRun = false,
  force410 = false,
  maxCanonicalBatch = 25,
  nowMs = Date.now(),
  cooldownMs = FOURTEEN_DAYS_MS
} = {}) {
  const nextQueue = {
    ...queue,
    indexnow_key: queue?.indexnow_key || key,
    pending_urls: Array.isArray(queue?.pending_urls) ? [...queue.pending_urls] : [],
    indexnow_submitted_at:
      queue?.indexnow_submitted_at && typeof queue.indexnow_submitted_at === 'object'
        ? { ...queue.indexnow_submitted_at }
        : {},
    pruned_410_submitted_at:
      queue?.pruned_410_submitted_at && typeof queue.pruned_410_submitted_at === 'object'
        ? { ...queue.pruned_410_submitted_at }
        : {}
  };

  const canonicalBatch = [...new Set(canonicalDeltaUrls.filter(Boolean))].slice(0, maxCanonicalBatch);
  const { due410Urls, total410Urls } = selectDue410Urls(pruned410Urls, nextQueue, {
    force: force410,
    nowMs,
    cooldownMs
  });
  const combinedUrlList = [...new Set([...canonicalBatch, ...due410Urls])];

  const responses = {};
  if (combinedUrlList.length === 0) {
    for (const ep of endpoints) {
      responses[ep] = 'SKIPPED (0 URLs due)';
    }
    return {
      updatedQueue: nextQueue,
      canonicalBatch,
      due410Batch: due410Urls,
      total410Urls,
      combinedUrlList,
      responses,
      dryRun
    };
  }

  if (dryRun) {
    for (const ep of endpoints) {
      responses[ep] = `DRY-RUN (would POST ${combinedUrlList.length} URLs: ${canonicalBatch.length} canonical + ${due410Urls.length} 410 Gone)`;
    }
    return {
      updatedQueue: nextQueue,
      canonicalBatch,
      due410Batch: due410Urls,
      total410Urls,
      combinedUrlList,
      responses,
      dryRun: true
    };
  }

  const effectiveKey = nextQueue.indexnow_key || key;
  const payload = {
    host,
    key: effectiveKey,
    keyLocation: `https://${host}/${effectiveKey}.txt`,
    urlList: combinedUrlList
  };

  const results = await Promise.all(
    endpoints.map(async (ep) => {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000)
        });
        return [ep, `HTTP ${res.status}`];
      } catch (err) {
        return [ep, `Err: ${err?.message || err}`];
      }
    })
  );
  for (const [ep, status] of results) {
    responses[ep] = status;
  }

  const pingIso = new Date(nowMs).toISOString();
  for (const u of canonicalBatch) {
    nextQueue.indexnow_submitted_at[u] = pingIso;
  }
  if (canonicalBatch.length > 0) {
    nextQueue.last_indexnow_ping = pingIso;
  }
  for (const u of due410Urls) {
    nextQueue.pruned_410_submitted_at[u] = pingIso;
  }
  if (due410Urls.length > 0) {
    nextQueue.last_410_ping = pingIso;
  }

  return {
    updatedQueue: nextQueue,
    canonicalBatch,
    due410Batch: due410Urls,
    total410Urls,
    combinedUrlList,
    responses,
    dryRun: false
  };
}
