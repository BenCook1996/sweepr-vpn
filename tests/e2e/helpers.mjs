/**
 * SWEEPR VPN — E2E Test Suite Helper Utilities
 * Pure Node.js ESM (>=24.0.0) with zero external npm dependencies.
 */

import net from 'node:net';
import http from 'node:http';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Project root directory
export const ROOT_DIR = path.resolve(process.cwd());
export const WEBSITE_DIR = path.join(ROOT_DIR, 'website');
export const SCRIPTS_DIR = path.join(ROOT_DIR, 'scripts');

/**
 * Custom Assertion Error with detailed diagnostic context
 */
export class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

// ---------------------------------------------------------------------------
// Basic Assertions
// ---------------------------------------------------------------------------

export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new AssertionError(message, condition, true);
  }
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    const msg = message || `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertNotEqual(actual, expected, message) {
  if (actual === expected) {
    const msg = message || `Expected value to differ from ${JSON.stringify(expected)}`;
    throw new AssertionError(msg, actual, expected);
  }
}

export function assertTrue(value, message) {
  if (value !== true) {
    const msg = message || `Expected true but got ${JSON.stringify(value)}`;
    throw new AssertionError(msg, value, true);
  }
}

export function assertFalse(value, message) {
  if (value !== false) {
    const msg = message || `Expected false but got ${JSON.stringify(value)}`;
    throw new AssertionError(msg, value, false);
  }
}

export function assertMatch(actual, regex, message) {
  if (typeof actual !== 'string' || !regex.test(actual)) {
    const msg = message || `Expected "${actual}" to match regex ${regex}`;
    throw new AssertionError(msg, actual, regex);
  }
}

export function assertNotMatch(actual, regex, message) {
  if (typeof actual === 'string' && regex.test(actual)) {
    const msg = message || `Expected "${actual}" NOT to match regex ${regex}`;
    throw new AssertionError(msg, actual, regex);
  }
}

export function assertIncludes(actual, expected, message) {
  if (typeof actual === 'string') {
    if (!actual.includes(expected)) {
      const msg = message || `Expected string to contain ${JSON.stringify(expected)}`;
      throw new AssertionError(msg, actual, expected);
    }
  } else if (Array.isArray(actual)) {
    if (!actual.includes(expected)) {
      const msg = message || `Expected array to contain ${JSON.stringify(expected)}`;
      throw new AssertionError(msg, actual, expected);
    }
  } else if (actual instanceof Set) {
    if (!actual.has(expected)) {
      const msg = message || `Expected Set to contain ${JSON.stringify(expected)}`;
      throw new AssertionError(msg, actual, expected);
    }
  } else {
    throw new AssertionError(`Unsupported type for assertIncludes: ${typeof actual}`);
  }
}

export function assertNotIncludes(actual, expected, message) {
  if (typeof actual === 'string') {
    if (actual.includes(expected)) {
      const msg = message || `Expected string NOT to contain ${JSON.stringify(expected)}`;
      throw new AssertionError(msg, actual, expected);
    }
  } else if (Array.isArray(actual)) {
    if (actual.includes(expected)) {
      const msg = message || `Expected array NOT to contain ${JSON.stringify(expected)}`;
      throw new AssertionError(msg, actual, expected);
    }
  } else if (actual instanceof Set) {
    if (actual.has(expected)) {
      const msg = message || `Expected Set NOT to contain ${JSON.stringify(expected)}`;
      throw new AssertionError(msg, actual, expected);
    }
  } else {
    throw new AssertionError(`Unsupported type for assertNotIncludes: ${typeof actual}`);
  }
}

export function assertLessThan(actual, ceiling, message) {
  if (!(actual < ceiling)) {
    const msg = message || `Expected ${actual} to be strictly less than ${ceiling}`;
    throw new AssertionError(msg, actual, ceiling);
  }
}

export function assertLessThanOrEqual(actual, ceiling, message) {
  if (!(actual <= ceiling)) {
    const msg = message || `Expected ${actual} to be less than or equal to ${ceiling}`;
    throw new AssertionError(msg, actual, ceiling);
  }
}

export function assertGreaterThan(actual, floor, message) {
  if (!(actual > floor)) {
    const msg = message || `Expected ${actual} to be strictly greater than ${floor}`;
    throw new AssertionError(msg, actual, floor);
  }
}

export function assertGreaterThanOrEqual(actual, floor, message) {
  if (!(actual >= floor)) {
    const msg = message || `Expected ${actual} to be greater than or equal to ${floor}`;
    throw new AssertionError(msg, actual, floor);
  }
}

// ---------------------------------------------------------------------------
// Ephemeral Port Allocation & Server Lifecycle
// ---------------------------------------------------------------------------

/**
 * Dynamically allocate an open OS port using net.createServer
 * Bypasses the `Number(process.env.PORT) || 8080` falsy fallback in server.mjs
 */
export async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((err) => {
        if (err) return reject(err);
        if (!port || port <= 1024) {
          return reject(new Error(`Allocated invalid port: ${port}`));
        }
        resolve(port);
      });
    });
    server.on('error', reject);
  });
}

/**
 * Starts a live instance of website/server.mjs on an allocated port
 * Waits for readiness signal on stdout or polls health endpoint
 */
export async function startServer(port, options = {}) {
  const timeoutMs = options.timeoutMs || 12000;
  const verbose = options.verbose || false;

  const child = spawn(process.execPath, [path.join(WEBSITE_DIR, 'server.mjs')], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      IS_LIVE_STRIPE: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdoutBuffer = '';
  let stderrBuffer = '';
  let isReady = false;

  child.stdout.on('data', (chunk) => {
    const str = chunk.toString();
    stdoutBuffer += str;
    if (verbose) process.stdout.write(`[SERVER] ${str}`);
  });

  child.stderr.on('data', (chunk) => {
    const str = chunk.toString();
    stderrBuffer += str;
    if (verbose) process.stderr.write(`[SERVER ERR] ${str}`);
  });

  const serverInstance = {
    child,
    port,
    baseUrl: `http://127.0.0.1:${port}`,
    getStdout: () => stdoutBuffer,
    getStderr: () => stderrBuffer
  };

  // Wait for readiness
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (stdoutBuffer.includes(`SWEEPR VPN server running at http://0.0.0.0:${port}`) ||
        stdoutBuffer.includes(`running at http://`)) {
      isReady = true;
      break;
    }
    // Probe health via quick fetch attempt
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, { method: 'HEAD', signal: AbortSignal.timeout(500) });
      if (res.status >= 200 && res.status < 500) {
        isReady = true;
        break;
      }
    } catch {
      // Server not accepting connections yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  if (!isReady) {
    stopServer(serverInstance);
    throw new Error(`Server failed to start within ${timeoutMs}ms. Output: ${stdoutBuffer}\nErrors: ${stderrBuffer}`);
  }

  return serverInstance;
}

/**
 * Stop server child process cleanly and terminate process tree
 */
export function stopServer(serverInstance) {
  if (!serverInstance || !serverInstance.child) return;
  const pid = serverInstance.child.pid;
  try {
    if (process.platform === 'win32' && pid) {
      try {
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } catch {
        serverInstance.child.kill('SIGTERM');
      }
    } else {
      serverInstance.child.kill('SIGTERM');
    }
  } catch {
    // Process may already be dead
  }
}

// ---------------------------------------------------------------------------
// HTTP Opaque Client
// ---------------------------------------------------------------------------

/**
 * Opaque-box HTTP request helper
 * By default does NOT follow redirects (redirect: 'manual') so tests can assert 301/302 headers
 */
export async function fetchOpaque(url, options = {}, retries = 2) {
  const method = (options.method || 'GET').toUpperCase();
  if (method === 'TRACE' || method === 'TRACK') {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
      const req = http.request(url, {
        method,
        headers: options.headers || {},
        timeout: options.timeoutMs || 8000
      }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const headersObj = {};
          for (const [k, v] of Object.entries(res.headers)) {
            headersObj[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : (v ?? '');
          }
          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            location: headersObj.location || null,
            headers: headersObj,
            body: Buffer.concat(chunks).toString('utf8'),
            durationMs: Date.now() - startTime,
            getHeader(name) {
              return headersObj[name.toLowerCase()] || null;
            }
          });
        });
      });
      req.on('timeout', () => {
        req.destroy(new Error(`Request timeout after ${options.timeoutMs || 8000}ms`));
      });
      req.on('error', (err) => {
        reject(new Error(`fetchOpaque failed to connect to ${url}: ${err.message}`));
      });
      if (options.body) req.write(options.body);
      req.end();
    });
  }

  const reqOptions = {
    method: options.method || 'GET',
    redirect: options.redirect || 'manual',
    headers: options.headers || {},
    signal: options.signal || AbortSignal.timeout(options.timeoutMs || 8000)
  };

  if (options.body) {
    reqOptions.body = options.body;
  }

  const startTime = Date.now();
  let response;
  try {
    response = await fetch(url, reqOptions);
  } catch (err) {
    if (retries > 0 && (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED') || err.message.includes('UND_ERR'))) {
      await new Promise((r) => setTimeout(r, 250));
      return fetchOpaque(url, options, retries - 1);
    }
    throw new Error(`fetchOpaque failed to connect to ${url}: ${err.message}`);
  }
  const durationMs = Date.now() - startTime;

  let bodyText = '';
  try {
    bodyText = await response.text();
  } catch {
    bodyText = '';
  }

  const headersObj = {};
  for (const [k, v] of response.headers.entries()) {
    headersObj[k.toLowerCase()] = v;
  }

  return {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    location: response.headers.get('location') || null,
    headers: headersObj,
    body: bodyText,
    durationMs,
    getHeader(name) {
      return headersObj[name.toLowerCase()] || null;
    }
  };
}

// ---------------------------------------------------------------------------
// 5-Gram Shingle Similarity Calculator
// ---------------------------------------------------------------------------

/**
 * Strips HTML tags, scripts, styles, header, nav, footer, comments, and decodes common entities
 */
export function extractSemanticText(html) {
  if (!html || typeof html !== 'string') return '';

  let text = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<details[\s\S]*?<\/details>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, ' ')
    .replace(/&bull;/gi, ' ');

  return text;
}

/**
 * Tokenize semantic text into lowercase alphanumeric words
 */
export function tokenizeWords(text) {
  if (!text || typeof text !== 'string') return [];
  const words = text.toLowerCase().match(/[a-z0-9]+/g);
  return words || [];
}

/**
 * Generate sliding window n-gram shingles (default n=5)
 */
export function generateShingles(words, n = 5) {
  const shingles = new Set();
  if (!words || words.length < n) return shingles;
  for (let i = 0; i <= words.length - n; i++) {
    shingles.add(words.slice(i, i + n).join(' '));
  }
  return shingles;
}

/**
 * Jaccard similarity between two sets: |A ∩ B| / |A ∪ B|
 * Returns float between 0.0 and 1.0 (or 0.0 if both empty)
 */
export function jaccardSimilarity(setA, setB) {
  if (!setA || !setB) return 0.0;
  if (setA.size === 0 && setB.size === 0) return 0.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  if (unionSize === 0) return 0.0;
  return intersectionSize / unionSize;
}

/**
 * Calculate pairwise 5-gram shingle similarity percentage between two HTML documents
 * Returns float [0.0, 100.0]
 */
export function calculate5GramOverlap(htmlA, htmlB) {
  const textA = extractSemanticText(htmlA);
  const textB = extractSemanticText(htmlB);

  const tokensA = tokenizeWords(textA);
  const tokensB = tokenizeWords(textB);

  if (tokensA.length < 5 || tokensB.length < 5) {
    return 0.0;
  }

  // Exact identity check
  if (tokensA.length === tokensB.length && tokensA.every((t, i) => t === tokensB[i])) {
    return 100.0;
  }

  const shinglesA = generateShingles(tokensA, 5);
  const shinglesB = generateShingles(tokensB, 5);

  const sim = jaccardSimilarity(shinglesA, shinglesB);
  return sim * 100.0;
}

// ---------------------------------------------------------------------------
// HTML & DOM Extraction Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts semantic <main> content from an HTML string
 */
export function extractMainContent(html) {
  if (!html || typeof html !== 'string') return '';
  const match = html.match(/<main[\s\S]*?<\/main>/i);
  return match ? match[0] : '';
}

/**
 * Extracts canonical URL href from <link rel="canonical" href="...">
 */
export function extractCanonical(html) {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/<link\s+[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
                html.match(/<link\s+[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  return match ? match[1] : null;
}

/**
 * Extracts robots meta content from <meta name="robots" content="...">
 */
export function extractRobots(html) {
  if (!html || typeof html !== 'string') return null;
  const match = html.match(/<meta\s+[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i) ||
                html.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']robots["']/i);
  return match ? match[1] : null;
}

/**
 * Extracts all hyperlinks with href, text, and rel attributes
 */
export function extractLinks(html) {
  if (!html || typeof html !== 'string') return [];
  const links = [];
  const regex = /<a\s+([^>]*?)>(.*?)<\/a>/gis;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const attrs = match[1];
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    const hrefMatch = attrs.match(/href=["']([^"']+)["']/i);
    const relMatch = attrs.match(/rel=["']([^"']+)["']/i);
    if (hrefMatch) {
      links.push({
        href: hrefMatch[1],
        text,
        rel: relMatch ? relMatch[1] : null,
        rawAttrs: attrs
      });
    }
  }
  return links;
}

/**
 * Checks if link contains rel="nofollow"
 */
export function hasNofollow(linkObj) {
  if (!linkObj || !linkObj.rel) return false;
  return /\bnofollow\b/i.test(linkObj.rel);
}

/**
 * Extracts headings (h1, h2, h3) with id and text content
 */
export function extractHeadings(html) {
  if (!html || typeof html !== 'string') return [];
  const headings = [];
  const regex = /<h([1-6])\s*([^>]*)>(.*?)<\/h\1>/gis;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const level = Number(match[1]);
    const attrs = match[2];
    const text = match[3].replace(/<[^>]+>/g, '').trim();
    const idMatch = attrs.match(/id=["']([^"']+)["']/i);
    headings.push({
      level,
      id: idMatch ? idMatch[1] : null,
      text,
      rawAttrs: attrs
    });
  }
  return headings;
}

/**
 * Checks whether an HTML string contains an element with the given id
 */
export function containsElementId(html, id) {
  if (!html || typeof html !== 'string') return false;
  const regex = new RegExp(`id=["']${id}["']`, 'i');
  return regex.test(html);
}

// ---------------------------------------------------------------------------
// XML Sitemap Parser
// ---------------------------------------------------------------------------

/**
 * Validates XML sitemap structure and extracts all URLs, lastmods, and loc count
 */
export function validateSitemapXml(xmlContent) {
  if (!xmlContent || typeof xmlContent !== 'string') {
    return { isValidXml: false, totalUrls: 0, urls: [], lastmods: {} };
  }

  const isValidRoot = xmlContent.includes('<urlset') && xmlContent.includes('</urlset>');
  const urls = [];
  const lastmods = {};

  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/gi;
  let blockMatch;
  while ((blockMatch = urlBlockRegex.exec(xmlContent)) !== null) {
    const block = blockMatch[1];
    const locMatch = block.match(/<loc>([^<]+)<\/loc>/i);
    const lastmodMatch = block.match(/<lastmod>([^<]+)<\/lastmod>/i);
    if (locMatch) {
      const loc = locMatch[1].trim();
      urls.push(loc);
      if (lastmodMatch) {
        lastmods[loc] = lastmodMatch[1].trim();
      }
    }
  }

  return {
    isValidXml: isValidRoot,
    totalUrls: urls.length,
    urls,
    lastmods
  };
}

// ---------------------------------------------------------------------------
// Filesystem & Discovery Helpers
// ---------------------------------------------------------------------------

/**
 * Find all .html files in directory (optionally recursive)
 */
export function findHtmlFiles(dirPath, recursive = true) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (recursive && !['node_modules', '.git', '.agents'].includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        results.push(fullPath);
      }
    }
  }

  walk(dirPath);
  return results;
}

/**
 * Finds files in directory that contain a given regex pattern
 */
export function findFilesWithPattern(dirPath, pattern, recursive = true) {
  const matching = [];
  const files = findHtmlFiles(dirPath, recursive);
  const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;

  for (const fp of files) {
    try {
      const content = fs.readFileSync(fp, 'utf8');
      if (regex.test(content)) {
        matching.push(fp);
      }
    } catch {
      // Ignore unreadable
    }
  }
  return matching;
}

/**
 * List authoritative pillars across directories
 */
export function getAuthoritativePillars() {
  return [
    'talktalk-p2p-port-forwarding.html',
    'virgin-media-remote-dev-ssh.html',
    'bt-broadband-gaming-packet-loss.html',
    'eduroam-campus-wifi-gaming-packet-loss.html',
    'gl-inet-travel-router.html',
    'synology-nas-docker-vpn.html',
    'steam-deck-vpn.html',
    'nvidia-shield-tv-pro-wireguard.html',
    'stop-samsung-smart-tv-acr-tracking.html',
    'stop-lg-smart-tv-acr-spying.html',
    'stop-roku-vizio-firetv-spying.html',
    'nordvpn.html',
    'expressvpn.html',
    'surfshark.html'
  ];
}
