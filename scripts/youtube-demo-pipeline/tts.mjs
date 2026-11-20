import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Communicate } from 'edge-tts-universal';
import ffprobeStatic from 'ffprobe-static';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const execFileAsync = promisify(execFile);

const DEFAULT_VOICE = process.env.SWEEPR_TTS_VOICE || 'en-GB-RyanNeural';
const DEFAULT_RATE = process.env.SWEEPR_TTS_RATE || '+4%';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function synthesizeWithMsEdgeTts(text, outMp3Path, voice, rate) {
  const tts = new MsEdgeTTS({
    enableLogger: false,
    connectionTimeoutMs: 15000,
    synthesisTimeoutMs: 45000
  });

  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text, { rate });
    const chunks = [];

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('msedge-tts stream timed out after 45s'));
      }, 45000);

      audioStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      audioStream.on('end', () => {
        clearTimeout(timeout);
        resolve();
      });
      audioStream.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    const audio = Buffer.concat(chunks);
    if (audio.length < 1500) {
      throw new Error(`msedge-tts produced insufficient audio bytes (${audio.length})`);
    }
    await fs.mkdir(path.dirname(outMp3Path), { recursive: true });
    await fs.writeFile(outMp3Path, audio);
    return { provider: 'msedge-tts', bytes: audio.length };
  } finally {
    try {
      tts.close();
    } catch {
      // Ignore socket shutdown errors
    }
  }
}

async function synthesizeWithUniversalTts(text, outMp3Path, voice, rate) {
  const comm = new Communicate(text, {
    voice,
    rate,
    connectionTimeout: 15000
  });

  const chunks = [];
  for await (const chunk of comm.stream()) {
    if (chunk.type === 'audio' && chunk.data) {
      chunks.push(Buffer.from(chunk.data));
    }
  }

  const audio = Buffer.concat(chunks);
  if (audio.length < 1500) {
    throw new Error(`edge-tts-universal produced insufficient audio bytes (${audio.length})`);
  }
  await fs.mkdir(path.dirname(outMp3Path), { recursive: true });
  await fs.writeFile(outMp3Path, audio);
  return { provider: 'edge-tts-universal', bytes: audio.length };
}

/**
 * Synthesizes neural TTS speech to MP3 with retries and multi-provider fallback.
 * Refuses robotic fallback so production audio stays human-sounding.
 */
export async function synthesizeSpeech(text, outMp3Path, options = {}) {
  const voice = options.voice || DEFAULT_VOICE;
  const rate = options.rate || DEFAULT_RATE;
  const errors = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await synthesizeWithMsEdgeTts(text, outMp3Path, voice, rate);
    } catch (err) {
      errors.push(`msedge-tts attempt ${attempt}: ${err.message}`);
      await sleep(attempt * 600);
    }
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await synthesizeWithUniversalTts(text, outMp3Path, voice, rate);
    } catch (err) {
      errors.push(`edge-tts-universal attempt ${attempt}: ${err.message}`);
      await sleep(attempt * 800);
    }
  }

  throw new Error(`Neural TTS failed across both providers:\n${errors.join('\n')}`);
}

export async function probeDurationSeconds(mediaPath) {
  const { stdout } = await execFileAsync(ffprobeStatic.path, [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'csv=p=0',
    mediaPath
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Invalid duration reported by ffprobe for ${mediaPath}: "${stdout.trim()}"`);
  }
  return duration;
}
