#!/usr/bin/env node
import { execFile } from 'node:child_process';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { chromium } from 'playwright-core';
import {
  injectLowerThirdInPage,
  renderIntroHtml,
  renderOutroHtml,
  renderThumbnailHtml
} from './templates.mjs';
import { probeDurationSeconds, synthesizeSpeech } from './tts.mjs';
import { VIDEOS } from './videos.mjs';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_ROOT = path.join(__dirname, 'output');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fsSync.existsSync(candidate)) return candidate;
  }
  throw new Error('No Chrome/Edge executable found on this machine. Set CHROME_PATH env var.');
}

function parseArgs(argv) {
  const args = new Set();
  let onlyIds = [];
  for (const arg of argv) {
    if (arg === '--all') args.add('all');
    else if (arg === '--keep-tmp') args.add('keepTmp');
    else if (arg.startsWith('--only=')) {
      onlyIds = arg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return {
    all: args.has('all'),
    keepTmp: args.has('keepTmp'),
    onlyIds
  };
}

function formatChapterTimestamp(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatSrtTimestamp(totalSeconds) {
  const msTotal = Math.max(0, Math.round(totalSeconds * 1000));
  const hours = Math.floor(msTotal / 3600000);
  const minutes = Math.floor((msTotal % 3600000) / 60000);
  const seconds = Math.floor((msTotal % 60000) / 1000);
  const millis = msTotal % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function splitCaptionChunks(text, maxWords = 10) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '));
  }
  return chunks;
}

function buildSrtContent(sceneTimings) {
  const entries = [];
  let index = 1;

  for (const scene of sceneTimings) {
    const chunks = splitCaptionChunks(scene.narration, 10);
    const totalWords = chunks.reduce((acc, c) => acc + c.split(/\s+/).length, 0) || 1;
    let cursor = scene.startSec + 0.08;
    const speechSpan = Math.max(1.0, scene.audioSec - 0.12);

    for (let i = 0; i < chunks.length; i++) {
      const chunkWords = chunks[i].split(/\s+/).length;
      const sliceDuration = speechSpan * (chunkWords / totalWords);
      const start = cursor;
      const end = i === chunks.length - 1 ? scene.startSec + scene.audioSec : cursor + sliceDuration;
      entries.push(`${index}\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}\n${chunks[i]}\n`);
      index++;
      cursor = end;
    }
  }

  return entries.join('\n');
}

async function applyPrivacyAndAnalyticsGuards(context) {
  // Never fire real analytics or telemetry during offline video synthesis
  await context.route('**/*google-analytics.com/**', (route) => route.abort());
  await context.route('**/*googletagmanager.com/**', (route) => route.abort());
  await context.route('**/api/tools/telemetry', (route) =>
    route.fulfill({ status: 204, body: '' })
  );

  // Never expose real user/host IP on camera during leak-test recordings (RFC 5737 test IP)
  await context.route('**/api/tools/network-check', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ip: '203.0.113.42',
        country: 'GB',
        countryFlag: '🇬🇧'
      })
    })
  );

  await context.addInitScript(() => {
    class MockRTCPeerConnection {
      constructor() {
        this.onicecandidate = null;
      }
      createDataChannel() {
        return {};
      }
      async createOffer() {
        return { type: 'offer', sdp: 'v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n' };
      }
      async setLocalDescription() {
        setTimeout(() => {
          if (typeof this.onicecandidate === 'function') {
            this.onicecandidate({ candidate: null });
          }
        }, 120);
      }
      close() {}
    }

    try {
      Object.defineProperty(window, 'RTCPeerConnection', {
        configurable: true,
        writable: true,
        value: MockRTCPeerConnection
      });
    } catch {
      window.RTCPeerConnection = MockRTCPeerConnection;
    }
  });
}

async function smoothScrollTo(page, targetY, durationMs) {
  await page.evaluate(
    async ({ y, ms }) => {
      const startY = window.scrollY;
      const clampedY = Math.max(0, Math.min(y, Math.max(0, document.documentElement.scrollHeight - window.innerHeight)));
      const delta = clampedY - startY;
      const start = performance.now();
      await new Promise((resolve) => {
        function frame(now) {
          const t = Math.min(1, (now - start) / Math.max(1, ms));
          const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          window.scrollTo(0, startY + delta * eased);
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        }
        requestAnimationFrame(frame);
      });
    },
    { y: targetY, ms: durationMs }
  );
}

async function runSceneSteps(page, steps = []) {
  for (const step of steps) {
    if (step.type === 'wait') {
      await sleep(step.ms);
    } else if (step.type === 'scroll') {
      await smoothScrollTo(page, step.y, step.durationMs || 2500);
    } else if (step.type === 'scrollSelector') {
      const y = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return window.scrollY + 500;
        const rect = el.getBoundingClientRect();
        return Math.max(0, window.scrollY + rect.top - 120);
      }, step.selector);
      await smoothScrollTo(page, y, step.durationMs || 2500);
    } else if (step.type === 'select') {
      await page.selectOption(step.selector, step.value);
      await sleep(step.pauseMs || 1500);
    } else if (step.type === 'click') {
      await page.click(step.selector);
      await sleep(step.pauseMs || 1500);
    }
  }
}

async function renderThumbnail(browser, videoDef, outPngPath) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1
  });
  try {
    const page = await context.newPage();
    await page.setContent(renderThumbnailHtml(videoDef.thumbnail), { waitUntil: 'load' });
    await page.screenshot({ path: outPngPath, type: 'png' });
  } finally {
    await context.close();
  }
}

async function recordSceneWebm(browser, videoDef, scene, sceneAudioSec, tmpDir) {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: tmpDir,
      size: { width: 1920, height: 1080 }
    }
  });

  await applyPrivacyAndAnalyticsGuards(context);

  const pageCreatedAt = performance.now();
  const page = await context.newPage();
  const videoHandle = page.video();
  let trimStartSec = 0;

  try {
    if (scene.kind === 'intro') {
      await page.setContent(renderIntroHtml(videoDef.intro), { waitUntil: 'load' });
      await sleep(250);
      trimStartSec = Math.max(0, (performance.now() - pageCreatedAt) / 1000);
      await sleep(Math.round((sceneAudioSec + 0.7) * 1000));
    } else if (scene.kind === 'outro') {
      await page.setContent(renderOutroHtml(videoDef.outro), { waitUntil: 'load' });
      await sleep(250);
      trimStartSec = Math.max(0, (performance.now() - pageCreatedAt) / 1000);
      await sleep(Math.round((sceneAudioSec + 0.7) * 1000));
    } else {
      await page.goto(scene.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await Promise.race([page.waitForLoadState('networkidle'), sleep(3000)]);

      if (scene.isPlainText) {
        await page.addStyleTag({
          content: `
            html, body { background: #0B1215 !important; color: #D1FAE5 !important; margin: 0 !important; padding: 36px 56px !important; }
            pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace !important; font-size: 21px !important; line-height: 1.55 !important; white-space: pre-wrap !important; color: #A7F3D0 !important; }
          `
        });
      }

      await page.evaluate(injectLowerThirdInPage, {
        chapterLabel: scene.label || scene.chapter,
        pageUrl: scene.url
      });
      await sleep(300);

      // Trim the initial loading frames so rendered scene starts crisply synced with voiceover
      trimStartSec = Math.max(0, (performance.now() - pageCreatedAt) / 1000);
      const visibleStart = performance.now();
      await runSceneSteps(page, scene.steps);

      const targetMs = Math.round((sceneAudioSec + 0.75) * 1000);
      const elapsedVisibleMs = performance.now() - visibleStart;
      if (elapsedVisibleMs < targetMs) {
        await sleep(targetMs - elapsedVisibleMs);
      }
    }
  } finally {
    await context.close();
  }

  const webmPath = await videoHandle.path();
  return { webmPath, trimStartSec };
}

async function encodeSyncedSceneSegment({ webmPath, mp3Path, trimStartSec, audioSec, outMp4Path }) {
  const segmentDuration = audioSec + 0.45;
  const trimFilter = trimStartSec > 0.05 ? `trim=start=${trimStartSec.toFixed(3)},setpts=PTS-STARTPTS,` : '';
  await execFileAsync(ffmpegStatic, [
    '-y',
    '-i',
    webmPath,
    '-i',
    mp3Path,
    '-filter_complex',
    `[0:v]${trimFilter}scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,tpad=stop_mode=clone:stop_duration=5,format=yuv420p[v];[1:a]aresample=48000,apad[a]`,
    '-map',
    '[v]',
    '-map',
    '[a]',
    '-t',
    segmentDuration.toFixed(3),
    '-c:v',
    'libx264',
    '-preset',
    'medium',
    '-crf',
    '19',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-c:a',
    'aac',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-b:a',
    '192k',
    outMp4Path
  ]);
}

async function concatAndNormalizeVideo(segmentPaths, tmpDir, finalMp4Path) {
  const concatListPath = path.join(tmpDir, 'concat.txt');
  const lines = segmentPaths.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`);
  await fs.writeFile(concatListPath, lines.join('\n') + '\n', 'utf8');

  await execFileAsync(ffmpegStatic, [
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    concatListPath,
    '-c:v',
    'copy',
    '-af',
    'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-c:a',
    'aac',
    '-ar',
    '48000',
    '-ac',
    '2',
    '-b:a',
    '192k',
    '-movflags',
    '+faststart',
    finalMp4Path
  ]);
}

async function analyzeFinalVideo(finalMp4Path) {
  const { stdout: probeOut } = await execFileAsync(ffprobeStatic.path, [
    '-v',
    'error',
    '-show_entries',
    'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration,size',
    '-of',
    'json',
    finalMp4Path
  ]);
  const probe = JSON.parse(probeOut);

  let meanVolumeDb = null;
  let maxVolumeDb = null;
  try {
    const { stderr } = await execFileAsync(ffmpegStatic, [
      '-i',
      finalMp4Path,
      '-af',
      'volumedetect',
      '-vn',
      '-f',
      'null',
      process.platform === 'win32' ? 'NUL' : '/dev/null'
    ]);
    const meanMatch = stderr.match(/mean_volume:\s*([-0-9.]+)\s*dB/);
    const maxMatch = stderr.match(/max_volume:\s*([-0-9.]+)\s*dB/);
    if (meanMatch) meanVolumeDb = Number.parseFloat(meanMatch[1]);
    if (maxMatch) maxVolumeDb = Number.parseFloat(maxMatch[1]);
  } catch {
    // Non-fatal fallback
  }

  const videoStream = (probe.streams || []).find((s) => s.codec_type === 'video') || {};
  const audioStream = (probe.streams || []).find((s) => s.codec_type === 'audio') || {};
  return {
    durationSec: Number.parseFloat(probe.format?.duration || '0'),
    sizeBytes: Number.parseInt(probe.format?.size || '0', 10),
    videoCodec: videoStream.codec_name || 'unknown',
    width: videoStream.width || 0,
    height: videoStream.height || 0,
    audioCodec: audioStream.codec_name || 'unknown',
    meanVolumeDb,
    maxVolumeDb
  };
}

function buildYouTubeDescription(videoDef, sceneTimings) {
  const chapters = sceneTimings
    .map((s) => `${formatChapterTimestamp(s.startSec)} ${s.chapter}`)
    .join('\n');

  const links = videoDef.outro.links.map((l) => `- ${l.label}: ${l.url}`).join('\n');

  return `${videoDef.intro.subtitle}

Links & Resources Shown in This Walkthrough:
${links}

Chapters:
${chapters}

Technical Stack: WireGuard (ChaCha20-Poly1305) • 10Gbps RAM-Only Nodes • In-Tunnel DNS 10.64.0.1 / 10.66.0.1
Learn more: https://sweeprvpn.com`;
}

async function generateVideo(browser, videoDef, keepTmp) {
  console.log(`\n=== [${videoDef.id}] Rendering ${videoDef.slug} ===`);
  const videoDir = path.join(OUTPUT_ROOT, videoDef.slug);
  const tmpDir = path.join(videoDir, '_tmp');
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(tmpDir, { recursive: true });

  const thumbnailPath = path.join(videoDir, 'thumbnail.png');
  await renderThumbnail(browser, videoDef, thumbnailPath);
  console.log(`  [+] Thumbnail: ${thumbnailPath}`);

  const segmentPaths = [];
  const sceneTimings = [];
  let cursorSec = 0;

  for (let i = 0; i < videoDef.scenes.length; i++) {
    const scene = videoDef.scenes[i];
    const tag = `scene-${String(i + 1).padStart(2, '0')}`;
    const mp3Path = path.join(tmpDir, `${tag}.mp3`);
    const segMp4Path = path.join(tmpDir, `${tag}.mp4`);

    const ttsInfo = await synthesizeSpeech(scene.narration, mp3Path);
    const audioSec = await probeDurationSeconds(mp3Path);
    console.log(`  [+] ${tag} TTS (${ttsInfo.provider}): ${audioSec.toFixed(2)}s — "${scene.chapter}"`);

    const { webmPath, trimStartSec } = await recordSceneWebm(browser, videoDef, scene, audioSec, tmpDir);
    await encodeSyncedSceneSegment({
      webmPath,
      mp3Path,
      trimStartSec,
      audioSec,
      outMp4Path: segMp4Path
    });

    const segDurationSec = await probeDurationSeconds(segMp4Path);
    segmentPaths.push(segMp4Path);
    sceneTimings.push({
      index: i + 1,
      chapter: scene.chapter,
      url: scene.url,
      narration: scene.narration,
      startSec: cursorSec,
      audioSec,
      segmentDurationSec: segDurationSec
    });
    cursorSec += segDurationSec;
  }

  const finalMp4Path = path.join(videoDir, `${videoDef.slug}.mp4`);
  await concatAndNormalizeVideo(segmentPaths, tmpDir, finalMp4Path);
  const verification = await analyzeFinalVideo(finalMp4Path);

  if (verification.width !== 1920 || verification.height !== 1080) {
    throw new Error(`Unexpected video dimensions for ${finalMp4Path}: ${verification.width}x${verification.height}`);
  }
  if (verification.audioCodec !== 'aac' || verification.videoCodec !== 'h264') {
    throw new Error(`Unexpected codecs for ${finalMp4Path}: ${verification.videoCodec}/${verification.audioCodec}`);
  }
  if (verification.meanVolumeDb !== null && verification.meanVolumeDb < -50) {
    throw new Error(`Audio appears silent (${verification.meanVolumeDb} dB) in ${finalMp4Path}`);
  }

  const captionsPath = path.join(videoDir, 'captions.srt');
  await fs.writeFile(captionsPath, buildSrtContent(sceneTimings), 'utf8');

  const description = buildYouTubeDescription(videoDef, sceneTimings);
  const metadata = {
    id: videoDef.id,
    slug: videoDef.slug,
    title: videoDef.title,
    description,
    tags: videoDef.tags,
    chapters: sceneTimings.map((s) => ({
      timestamp: formatChapterTimestamp(s.startSec),
      chapter: s.chapter,
      url: s.url
    })),
    files: {
      mp4: finalMp4Path,
      thumbnail: thumbnailPath,
      captions: captionsPath
    },
    verification
  };

  const metadataPath = path.join(videoDir, 'metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

  if (!keepTmp) {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  console.log(
    `  [OK] ${videoDef.slug}.mp4 (${verification.width}x${verification.height}, ${verification.durationSec.toFixed(2)}s, ${verification.videoCodec}/${verification.audioCodec}, mean ${verification.meanVolumeDb} dB)`
  );
  return metadata;
}

async function writeUploadPack() {
  const allMeta = [];
  for (const videoDef of VIDEOS) {
    const metaPath = path.join(OUTPUT_ROOT, videoDef.slug, 'metadata.json');
    if (fsSync.existsSync(metaPath)) {
      const parsed = JSON.parse(await fs.readFile(metaPath, 'utf8'));
      allMeta.push(parsed);
    }
  }

  const sections = allMeta.map((m) => {
    const mb = (m.verification.sizeBytes / (1024 * 1024)).toFixed(2);
    return `## ${m.id}. ${m.title}

- **Video**: \`${m.files.mp4}\` (${m.verification.width}x${m.verification.height} \`${m.verification.videoCodec}/${m.verification.audioCodec}\`, **${m.verification.durationSec.toFixed(1)}s**, ${mb} MB, mean audio \`${m.verification.meanVolumeDb} dB\`)
- **Thumbnail**: \`${m.files.thumbnail}\` (1280x720 PNG)
- **Captions**: \`${m.files.captions}\`
- **Tags**: \`${m.tags.join(', ')}\`

### YouTube Title
\`\`\`text
${m.title}
\`\`\`

### YouTube Description (Copy-Paste)
\`\`\`text
${m.description}
\`\`\`
`;
  });

  const md = `# SWEEPR VPN — YouTube Technical Proof Demos Upload Pack

Generated automatically by \`scripts/youtube-demo-pipeline/render.mjs\` (Playwright 1920x1080 capture + \`en-GB-RyanNeural\` TTS + FFmpeg \`loudnorm -16 LUFS\`).

Total videos ready for YouTube Studio upload: **${allMeta.length} / ${VIDEOS.length}**

---

${sections.join('\n---\n\n')}`;

  const packPath = path.join(OUTPUT_ROOT, 'YOUTUBE_UPLOAD_PACK.md');
  await fs.writeFile(packPath, md, 'utf8');
  console.log(`\n[PACK] Wrote ${packPath} (${allMeta.length} videos).`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const selected = opts.all
    ? VIDEOS
    : opts.onlyIds.length > 0
      ? VIDEOS.filter((v) => opts.onlyIds.includes(v.id) || opts.onlyIds.includes(v.slug))
      : [VIDEOS[0]];

  if (selected.length === 0) {
    throw new Error('No matching video IDs found. Use --all or --only=01,02,...');
  }

  const executablePath = findBrowserExecutable();
  console.log(`[INIT] Using Chromium executable: ${executablePath}`);
  console.log(`[INIT] Rendering ${selected.length} video(s): ${selected.map((v) => v.id).join(', ')}`);

  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--disable-gpu-sandbox', '--autoplay-policy=no-user-gesture-required']
  });

  try {
    for (const videoDef of selected) {
      await generateVideo(browser, videoDef, opts.keepTmp);
    }
  } finally {
    await browser.close();
  }

  await writeUploadPack();
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
