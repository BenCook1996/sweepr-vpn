#!/usr/bin/env node
/**
 * Non-Fabricating VideoObject JSON-LD & Shorts Readiness Helper (P3-2 / R6 / R10)
 *
 * Enforces zero fabrication:
 *  - Validates real 11-character YouTube video IDs and rejects dummy/placeholder patterns.
 *  - Returns `null` from `buildVideoObjectJsonLd()` whenever a video has not been uploaded.
 *  - Audits `scripts/youtube-demo-pipeline/video-registry.json` and local MP4/metadata files.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VPN_ROOT = path.resolve(__dirname, '..', '..');
export const VIDEO_REGISTRY_PATH = path.join(VPN_ROOT, 'scripts', 'youtube-demo-pipeline', 'video-registry.json');

const DUMMY_YOUTUBE_IDS = new Set([
  'dQw4w9WgXcQ',
  '12345678901',
  '01234567890',
  '98765432109',
  'abcdefghijk',
  'ABCDEFGHIJK',
  'placeholder',
  'PLACEHOLDER',
  'youtube_id1',
  'VIDEO_ID_11',
  'sample_id11'
]);

export function isValidYouTubeId(id) {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return false;
  if (/^([A-Za-z0-9_-])\1{10}$/.test(trimmed)) return false;
  if (DUMMY_YOUTUBE_IDS.has(trimmed)) return false;
  if (/^(test|demo|fake|stub|sample|dummy|place|example|video)/i.test(trimmed)) return false;
  return true;
}

export function extractYouTubeIdFromUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return null;
  const s = url.trim();
  const patterns = [
    /(?:youtube\.com|youtube-nocookie\.com)\/embed\/([A-Za-z0-9_-]{11})(?:[?&#/]|$)/i,
    /(?:youtube\.com)\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})(?:[&#]|$)/i,
    /(?:youtube\.com)\/shorts\/([A-Za-z0-9_-]{11})(?:[?&#/]|$)/i,
    /youtu\.be\/([A-Za-z0-9_-]{11})(?:[?&#/]|$)/i
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

export function toIso8601Duration(seconds) {
  const totalSec = Math.max(1, Math.round(Number(seconds) || 0));
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  let out = 'PT';
  if (hours > 0) out += `${hours}H`;
  if (mins > 0) out += `${mins}M`;
  if (secs > 0 || (hours === 0 && mins === 0)) out += `${secs}S`;
  return out;
}

export function buildVideoObjectJsonLd(entry, meta = {}) {
  if (!entry || !isValidYouTubeId(entry.youtubeVideoId)) return null;
  const uploadDate = String(entry.uploadDate || meta.uploadDate || '').trim();
  if (!uploadDate || Number.isNaN(Date.parse(uploadDate))) return null;

  const videoId = entry.youtubeVideoId.trim();
  const durationSec = entry.durationSec || meta?.verification?.durationSec;
  const title = entry.title || meta.title;
  const description = meta.description || entry.description || title;
  if (!title || !description) return null;

  const obj = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description,
    thumbnailUrl: [`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`],
    uploadDate,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
    publisher: {
      '@type': 'Organization',
      name: 'SWEEPR VPN (UK Sole Trader)',
      url: 'https://sweeprvpn.com/'
    }
  };
  if (durationSec && Number(durationSec) > 0) {
    obj.duration = toIso8601Duration(durationSec);
  }
  return obj;
}

export function loadVideoRegistry(registryPath = VIDEO_REGISTRY_PATH) {
  if (!fs.existsSync(registryPath)) {
    return { schemaVersion: '1.0.0', videos: [] };
  }
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

export function auditVideoReadiness(registryPath = VIDEO_REGISTRY_PATH) {
  const registry = loadVideoRegistry(registryPath);
  const videos = Array.isArray(registry.videos) ? registry.videos : [];

  const configuredVideos = [];
  const pendingVideos = [];
  const invalidIds = [];
  const missingLocalFiles = [];

  for (const entry of videos) {
    const absMp4 = entry.localMp4 ? path.resolve(VPN_ROOT, entry.localMp4) : null;
    if (!absMp4 || !fs.existsSync(absMp4)) {
      missingLocalFiles.push(entry.slug || entry.id);
    }

    const rawId = entry.youtubeVideoId;
    if (rawId !== null && rawId !== undefined && String(rawId).trim() !== '') {
      if (!isValidYouTubeId(String(rawId))) {
        invalidIds.push({ slug: entry.slug, youtubeVideoId: rawId });
      } else {
        let meta = {};
        const metaPath = absMp4 ? path.join(path.dirname(absMp4), 'metadata.json') : null;
        if (metaPath && fs.existsSync(metaPath)) {
          try {
            meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          } catch {}
        }
        const jsonLd = buildVideoObjectJsonLd(entry, meta);
        configuredVideos.push({
          slug: entry.slug,
          youtubeVideoId: rawId,
          hasValidJsonLd: Boolean(jsonLd),
          targetUrlPaths: entry.targetUrlPaths || []
        });
      }
    } else {
      pendingVideos.push({
        slug: entry.slug,
        title: entry.title,
        durationSec: entry.durationSec,
        isoDuration: toIso8601Duration(entry.durationSec),
        localMp4: entry.localMp4,
        targetUrlPaths: entry.targetUrlPaths || []
      });
    }
  }

  return {
    totalVideos: videos.length,
    configuredCount: configuredVideos.length,
    pendingUploadCount: pendingVideos.length,
    invalidIds,
    missingLocalFiles,
    configuredVideos,
    pendingVideos
  };
}
