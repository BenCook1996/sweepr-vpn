import http from 'node:http';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { SweeprCrmClient } from './sweepr-client.mjs';
import { VPN_ANDROID_HTML } from './vpn-mobile-ui.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAFE_STATIC_ROOT = path.resolve(__dirname) + path.sep;
const rootEnvPath = path.join(__dirname, '..', '.env');
if (typeof process.loadEnvFile === 'function') {
  if (fs.existsSync(rootEnvPath)) {
    try { process.loadEnvFile(rootEnvPath); } catch {}
  }
}

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const SWEEPR_CRM_URL = (process.env.SWEEPR_CRM_URL || 'http://localhost:8788').replace(/\/+$/, '');
const SWEEPR_CRM_API_KEY = (process.env.SWEEPR_CRM_API_KEY || '').trim();
const ALLOW_DEMO_ACCOUNT = process.env.ALLOW_DEMO_ACCOUNT === 'true' && process.env.NODE_ENV !== 'production';
const SESSION_SECRET =
  (process.env.SESSION_SECRET || '').trim() ||
  (process.env.LICENSE_PRIVATE_KEY_B64
    ? crypto.createHash('sha256').update(`sweepr-session:${process.env.LICENSE_PRIVATE_KEY_B64}`).digest('hex')
    : (process.env.CRM_ADMIN_PASSWORD
      ? crypto.createHash('sha256').update(`sweepr-session:${process.env.CRM_ADMIN_PASSWORD}`).digest('hex')
      : crypto.randomBytes(32).toString('hex')));
const TRUST_PROXY = process.env.TRUST_PROXY === 'true' || Boolean(process.env.RAILWAY_ENVIRONMENT);
const MAX_BODY_BYTES = 64 * 1024;
const MAX_LOCAL_ACCOUNTS = 10000;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;
const HIGH_ENTROPY_LICENSE_KEY_RE = /^SWEEPR-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

const COMMON_SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://js.stripe.com https://pay.google.com https://www.googletagmanager.com https://www.google-analytics.com https://static.cloudflareinsights.com https://challenges.cloudflare.com",
  'X-Sweepr-Api-Version': '2026-10'
};

const ALLOWED_STATIC_EXTENSIONS = new Set([
  '.html',
  '.css',
  '.js',
  '.xml',
  '.txt',
  '.svg',
  '.png',
  '.webp',
  '.avif',
  '.ico',
  '.woff2',
  '.woff',
  '.ttf',
  '.exe',
  '.dmg',
  '.apk',
  '.mobileconfig'
]);

const BLOCKED_STATIC_FILES = new Set([
  'server.mjs',
  'sweepr-client.mjs',
  'vpn-mobile-ui.mjs',
  'package.json',
  'package-lock.json',
  'railway.json',
  'outreach-seed.json',
  'indexing-queue.json',
  'daily-seo-pages-state.json'
]);

const crm = new SweeprCrmClient({ projectId: 'vpn', crmUrl: SWEEPR_CRM_URL, apiKey: SWEEPR_CRM_API_KEY });
const BOT_UA_RE = /googlebot|bingbot|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|applebot|duckduckbot|yandexbot/i;

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

function safeCompareStrings(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB) && a.length === b.length;
}

function hasValidCrmServiceKey(req) {
  const provided = String(
    req?.headers?.['x-sweepr-api-key'] ||
    req?.headers?.['x-crm-api-key'] ||
    req?.headers?.['x-sweepr-service-key'] ||
    ''
  ).trim();
  return Boolean(SWEEPR_CRM_API_KEY && provided && safeCompareStrings(provided, SWEEPR_CRM_API_KEY));
}

function maskEmailAddress(email) {
  const clean = String(email || '').trim().toLowerCase();
  const [local, domain] = clean.split('@');
  if (!local || !domain) return '';
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

function canonicalizeEmailForAntiAbuse(email) {
  const clean = String(email || '').trim().toLowerCase();
  const [rawLocal, rawDomain] = clean.split('@');
  if (!rawLocal || !rawDomain) return clean;
  let local = rawLocal.split('+')[0];
  const domain = rawDomain === 'googlemail.com' ? 'gmail.com' : rawDomain;
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '');
  }
  return `${local}@${domain}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveTrustedOrigin(req) {
  const allowedOrigins = new Set([
    PUBLIC_URL,
    'https://sweeprvpn.com',
    'https://www.sweeprvpn.com',
    'https://app.sweeprvpn.local',
    'http://app.sweeprvpn.local',
    'tauri://localhost',
    'http://tauri.localhost',
    'https://tauri.localhost',
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`,
    'http://localhost:8788',
    'http://127.0.0.1:8788'
  ]);
  const rawOrigin = String(req?.headers?.origin || '').trim().replace(/\/+$/, '');
  if (rawOrigin === 'null' && String(req?.url || '').startsWith('/api/vpn/')) return 'null';
  if (rawOrigin && (allowedOrigins.has(rawOrigin) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(rawOrigin))) {
    return rawOrigin;
  }
  const host = String(req?.headers?.host || '').trim();
  const proto = req?.headers?.['x-forwarded-proto'] === 'https' || PUBLIC_URL.startsWith('https://') ? 'https' : 'http';
  if (host) {
    const candidate = `${proto}://${host}`;
    if (allowedOrigins.has(candidate) || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(candidate)) return candidate;
  }
  return PUBLIC_URL;
}

function isSameOriginOrTrusted(req) {
  const fetchSite = req?.headers?.['sec-fetch-site'];
  if (fetchSite === 'cross-site') return false;

  const rawOrigin = req?.headers?.origin;
  if (rawOrigin === 'null') return false;
  if (rawOrigin) {
    const trusted = resolveTrustedOrigin(req);
    return rawOrigin.replace(/\/+$/, '') === trusted.replace(/\/+$/, '');
  }
  if (fetchSite === 'same-origin' || fetchSite === 'same-site' || fetchSite === 'none') {
    return true;
  }
  const ct = String(req?.headers?.['content-type'] || '').toLowerCase();
  return Boolean(req?.headers?.['x-requested-with']) || (ct.startsWith('application/json') && !fetchSite);
}

function getClientIp(req) {
  if (TRUST_PROXY) {
    if (process.env.TRUST_CLOUDFLARE !== 'false') {
      const cfIp = String(req.headers['cf-connecting-ip'] || '').trim();
      if (cfIp) return cfIp;
    }
    const xff = String(req.headers['x-forwarded-for'] || '').trim();
    if (xff) {
      const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length > 0) return parts[parts.length - 1];
    }
  }
  return String(req.socket?.remoteAddress || '127.0.0.1').trim();
}

const rateLimitBuckets = new Map();
const MAX_RATE_BUCKETS = 10000;
function checkRateLimit(req, bucketName, maxRequests = 30, windowMs = 60000) {
  const ip = getClientIp(req);
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  let entry = rateLimitBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    if (rateLimitBuckets.size >= MAX_RATE_BUCKETS) {
      for (const [k, v] of rateLimitBuckets.entries()) {
        if (now > v.resetAt) rateLimitBuckets.delete(k);
      }
      if (rateLimitBuckets.size >= MAX_RATE_BUCKETS) {
        for (const [k, v] of rateLimitBuckets.entries()) {
          if (v.count <= 1) {
            rateLimitBuckets.delete(k);
            if (rateLimitBuckets.size < 9000) break;
          }
        }
      }
      if (rateLimitBuckets.size >= MAX_RATE_BUCKETS) {
        const oldestKey = rateLimitBuckets.keys().next().value;
        if (oldestKey) rateLimitBuckets.delete(oldestKey);
      }
    }
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitBuckets.set(key, entry);
  }
  entry.count += 1;
  return entry.count <= maxRequests;
}

// AES-256-GCM encrypted live Stripe credentials for SWEEPR VPN (acct_1USluy0Fq96R9TfN), keyed by CRM_ADMIN_PASSWORD
const ENCRYPTED_LIVE_SK =
  'b69e8d08228536390a88f032:d3262e7ee59be48f9dfb5448e995ba20:59c4ee424575c26bbee1691fae0a52663a26aa3245fbaa86c169ca4b8509334df7c9f52a91c77d6bf267c9d25560c7e7e3bb95d4cc32af2b26ae861553d588cf974135928391d5a176db06caed63f054a4a3696a2a15bb6c9f74ca45185da8d1aa64daf92e02a3d8fc1ffd';
const ENCRYPTED_LIVE_WHSEC =
  '2331ea8dc0639222a52fc494:e221342ced4b76c725adcd5a9ffa39ed:da898f00038b99af5ffa2da5af3bb8cdd75e66db2bbecb1da54a1e969741a6a1603a685d8906';

function decryptWithAdminKey(payload) {
  const adminSecret = (process.env.CRM_ADMIN_PASSWORD || '').trim();
  if (!payload || !adminSecret) return '';
  try {
    const [ivHex, tagHex, encHex] = payload.split(':');
    const key = crypto.createHash('sha256').update(adminSecret).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const out = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
    if (out) return out;
  } catch {}
  return '';
}

function resolveStripeSecretKey() {
  const envKey = (process.env.STRIPE_SECRET_KEY || process.env.VPN_STRIPE_SECRET_KEY || '').trim();
  if (
    envKey.startsWith('sk_live_') ||
    envKey.startsWith('rk_live_') ||
    envKey.startsWith('sk_test_') ||
    envKey.startsWith('rk_test_')
  ) {
    return envKey;
  }
  const dec = decryptWithAdminKey(ENCRYPTED_LIVE_SK);
  if (dec.startsWith('sk_live_') || dec.startsWith('rk_live_')) return dec;
  return '';
}

const STRIPE_SECRET_KEY = resolveStripeSecretKey();
const IS_LIVE_STRIPE = STRIPE_SECRET_KEY.startsWith('sk_live_') || STRIPE_SECRET_KEY.startsWith('rk_live_');

function resolveStripeWebhookSecret() {
  const envWh = (process.env.STRIPE_WEBHOOK_SECRET || process.env.VPN_STRIPE_WEBHOOK_SECRET || '').trim();
  if (envWh.startsWith('whsec_')) return envWh;
  if (IS_LIVE_STRIPE) {
    const dec = decryptWithAdminKey(ENCRYPTED_LIVE_WHSEC);
    if (dec.startsWith('whsec_')) return dec;
  }
  return '';
}

const STRIPE_WEBHOOK_SECRET = resolveStripeWebhookSecret();
const STRIPE_PUBLISHABLE_KEY =
  (process.env.STRIPE_PUBLISHABLE_KEY || process.env.VPN_STRIPE_PUBLISHABLE_KEY || '').trim() ||
  'pk_live_51USluy0Fq96R9TfNKN5dZ8iZDY8fTi6yOqTRZE5ZiRihuzacDtvYRQx6ZpjysI9ez17JIvg8F7JvtGRVxH6Ck4IP00HdlO2xUF';

const STRIPE_PRODUCT_MAIN = (process.env.STRIPE_PRODUCT_MAIN || 'prod_VTjdG0sise8wG8').trim();
const STRIPE_PRODUCT_WIFI_RADAR = (process.env.STRIPE_PRODUCT_WIFI_RADAR || 'prod_VTjdnQaDaWKags').trim();
const STRIPE_PRICE_ANNUAL = (process.env.STRIPE_PRICE_ANNUAL || 'price_1UT7Vl0Fq96R9TfN0smzMLKF').trim();
const STRIPE_PRICE_SIX_MONTH = (process.env.STRIPE_PRICE_SIX_MONTH || 'price_1UT7Vl0Fq96R9TfNNPyzSXY1').trim();
const STRIPE_PRICE_MONTHLY = (process.env.STRIPE_PRICE_MONTHLY || 'price_1UT7Vl0Fq96R9TfNFaC0Frsm').trim();
const STRIPE_COUPON = (process.env.STRIPE_COUPON || 'sweepr_intro_gbp_1050').trim();

// ============================================================================
// Multi-Currency Geo-Pricing Engine (Exact match to pricing-config.js)
// ============================================================================
const PRICING_BY_CURRENCY = {
  gbp: { currency: 'gbp', symbol: '£', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 7499, sixMonthAmount: 4899, monthlyAmount: 1249, introMonthlyAmount: 199, wifiRadarAnnualAmount: 1499, wifiRadarSixMonthAmount: 999, wifiRadarMonthlyAmount: 199 },
  usd: { currency: 'usd', symbol: '$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 9599, sixMonthAmount: 6199, monthlyAmount: 1599, introMonthlyAmount: 299, wifiRadarAnnualAmount: 1999, wifiRadarSixMonthAmount: 1299, wifiRadarMonthlyAmount: 299 },
  eur: { currency: 'eur', symbol: '€', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 8999, sixMonthAmount: 5899, monthlyAmount: 1499, introMonthlyAmount: 299, wifiRadarAnnualAmount: 1799, wifiRadarSixMonthAmount: 1199, wifiRadarMonthlyAmount: 249 },
  cad: { currency: 'cad', symbol: 'CA$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 13199, sixMonthAmount: 8599, monthlyAmount: 2199, introMonthlyAmount: 399, wifiRadarAnnualAmount: 2699, wifiRadarSixMonthAmount: 1799, wifiRadarMonthlyAmount: 349 },
  aud: { currency: 'aud', symbol: 'A$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 14999, sixMonthAmount: 9799, monthlyAmount: 2499, introMonthlyAmount: 399, wifiRadarAnnualAmount: 2999, wifiRadarSixMonthAmount: 1999, wifiRadarMonthlyAmount: 399 },
  chf: { currency: 'chf', symbol: 'CHF ', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 8399, sixMonthAmount: 5499, monthlyAmount: 1399, introMonthlyAmount: 299, wifiRadarAnnualAmount: 1699, wifiRadarSixMonthAmount: 1099, wifiRadarMonthlyAmount: 249 },
  jpy: { currency: 'jpy', symbol: '¥', symbolPosition: 'prefix', zeroDecimal: true, annualAmount: 14999, sixMonthAmount: 9799, monthlyAmount: 2499, introMonthlyAmount: 399, wifiRadarAnnualAmount: 2999, wifiRadarSixMonthAmount: 1999, wifiRadarMonthlyAmount: 399 }
};

const COUNTRY_TO_CURRENCY = {
  GB: 'gbp', UK: 'gbp', IM: 'gbp', JE: 'gbp', GG: 'gbp',
  US: 'usd', PR: 'usd', GU: 'usd', VI: 'usd',
  CA: 'cad', AU: 'aud', NZ: 'aud', CH: 'chf', LI: 'chf', JP: 'jpy',
  DE: 'eur', FR: 'eur', ES: 'eur', IT: 'eur', NL: 'eur', BE: 'eur', AT: 'eur', IE: 'eur', PT: 'eur', FI: 'eur', GR: 'eur', LU: 'eur'
};

const COUNTRY_TO_LANG = {
  DE: 'de', AT: 'de', CH: 'de', FR: 'fr', BE: 'fr', ES: 'es', MX: 'es', IT: 'it', PT: 'pt', BR: 'pt', NL: 'nl', JP: 'ja'
};

function countryToFlag(countryCode) {
  const cc = (countryCode || 'GB').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🇬🇧';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0)));
}

function formatAmount(amountMinor, cfg) {
  const numStr = cfg.zeroDecimal
    ? Math.round(amountMinor).toLocaleString('en-US')
    : (amountMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cfg.symbolPosition === 'suffix' ? `${numStr}${cfg.symbol}` : `${cfg.symbol}${numStr}`;
}

function buildLocalizedPricing(countryCode = 'GB', overrideCurrency) {
  const cc = /^[A-Z]{2}$/i.test(String(countryCode || '')) ? String(countryCode).toUpperCase() : 'GB';
  const rawCurr = String(overrideCurrency || COUNTRY_TO_CURRENCY[cc] || 'gbp').trim().toLowerCase();
  const currKey = Object.prototype.hasOwnProperty.call(PRICING_BY_CURRENCY, rawCurr) ? rawCurr : 'gbp';
  const cfg = PRICING_BY_CURRENCY[currKey];

  const divisor = cfg.zeroDecimal ? 1 : 100;
  const annualMonthlyEq = Math.round(cfg.annualAmount / 12);
  const sixMonthMonthlyEq = Math.round(cfg.sixMonthAmount / 6);

  const fullYearAtMonthly = cfg.monthlyAmount * 12;
  const annualSavingsAmount = Math.max(0, fullYearAtMonthly - cfg.annualAmount);
  const sixMonthsAtMonthly = cfg.monthlyAmount * 6;
  const sixMonthSavingsAmount = Math.max(0, sixMonthsAtMonthly - cfg.sixMonthAmount);
  const introSavingsAmount = Math.max(0, cfg.monthlyAmount - cfg.introMonthlyAmount);

  const radarAnnualMonthlyEq = Math.round(cfg.wifiRadarAnnualAmount / 12);
  const radarSixMonthMonthlyEq = Math.round(cfg.wifiRadarSixMonthAmount / 6);

  return {
    country: cc,
    countryFlag: countryToFlag(cc),
    language: COUNTRY_TO_LANG[cc] || 'en',
    currency: cfg.currency,
    currencyCode: cfg.currency.toUpperCase(),
    symbol: cfg.symbol,
    symbolPosition: cfg.symbolPosition,
    zeroDecimal: cfg.zeroDecimal,
    divisor,
    annualAmount: cfg.annualAmount,
    sixMonthAmount: cfg.sixMonthAmount,
    monthlyAmount: cfg.monthlyAmount,
    introMonthlyAmount: cfg.introMonthlyAmount,
    annualMonthlyEqAmount: annualMonthlyEq,
    sixMonthMonthlyEqAmount: sixMonthMonthlyEq,
    annualSavingsAmount,
    sixMonthSavingsAmount,
    introSavingsAmount,
    annualSavingsPercent: 50,
    sixMonthSavingsPercent: 35,
    annualFormatted: formatAmount(cfg.annualAmount, cfg),
    sixMonthFormatted: formatAmount(cfg.sixMonthAmount, cfg),
    monthlyFormatted: formatAmount(cfg.monthlyAmount, cfg),
    introMonthlyFormatted: formatAmount(cfg.introMonthlyAmount, cfg),
    annualMonthlyEqFormatted: formatAmount(annualMonthlyEq, cfg),
    sixMonthMonthlyEqFormatted: formatAmount(sixMonthMonthlyEq, cfg),
    annualSavingsFormatted: formatAmount(annualSavingsAmount, cfg),
    sixMonthSavingsFormatted: formatAmount(sixMonthSavingsAmount, cfg),
    introSavingsFormatted: formatAmount(introSavingsAmount, cfg),
    fullYearAtMonthlyFormatted: formatAmount(fullYearAtMonthly, cfg),
    sixMonthsAtMonthlyFormatted: formatAmount(sixMonthsAtMonthly, cfg),
    wifiRadarAnnualAmount: cfg.wifiRadarAnnualAmount,
    wifiRadarSixMonthAmount: cfg.wifiRadarSixMonthAmount,
    wifiRadarMonthlyAmount: cfg.wifiRadarMonthlyAmount,
    wifiRadarAnnualFormatted: formatAmount(cfg.wifiRadarAnnualAmount, cfg),
    wifiRadarSixMonthFormatted: formatAmount(cfg.wifiRadarSixMonthAmount, cfg),
    wifiRadarMonthlyFormatted: formatAmount(cfg.wifiRadarMonthlyAmount, cfg),
    wifiRadarAnnualMonthlyEqFormatted: formatAmount(radarAnnualMonthlyEq, cfg),
    wifiRadarSixMonthMonthlyEqFormatted: formatAmount(radarSixMonthMonthlyEq, cfg)
  };
}

function resolvePricingForRequest(req, parsedUrl, body = {}) {
  const qCountry = parsedUrl?.searchParams?.get('country') || body?.country;
  const qCurrency = parsedUrl?.searchParams?.get('currency') || body?.currency;
  // Only trust CDN/proxy geo-IP headers when running behind a verified reverse proxy (TRUST_PROXY=true)
  const headerCountry = TRUST_PROXY
    ? (req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || 'GB')
    : 'GB';
  const rawCountry = String(qCountry || headerCountry || 'GB').trim().toUpperCase();
  const country = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : 'GB';
  return buildLocalizedPricing(country, qCurrency);
}

// ============================================================================
// Direct Stripe REST API Helper (Pinned to 2024-06-20 for PaymentIntent expand)
// ============================================================================
function flattenStripeParams(obj, prefix = '', res = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null) continue;
    const keyName = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, idx) => {
        if (typeof item === 'object' && item !== null) {
          flattenStripeParams(item, `${keyName}[${idx}]`, res);
        } else if (item !== undefined && item !== null) {
          res.append(`${keyName}[${idx}]`, String(item));
        }
      });
    } else if (typeof v === 'object') {
      flattenStripeParams(v, keyName, res);
    } else {
      res.append(keyName, String(v));
    }
  }
  return res;
}

async function stripeRequest(method, endpoint, params, idempotencyKey = '') {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured on this server.');
  }
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  let url = `https://api.stripe.com/v1/${cleanEndpoint}`;
  const headers = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Stripe-Version': '2024-06-20',
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    'User-Agent': 'SweeprVPN/2.5 (+https://sweeprvpn.com)'
  };
  const fetchOpts = { method, headers, signal: AbortSignal.timeout(12000) };

  if (params && Object.keys(params).length > 0) {
    const encoded = flattenStripeParams(params).toString();
    if (method === 'GET' || method === 'DELETE') {
      url += (url.includes('?') ? '&' : '?') + encoded;
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      fetchOpts.body = encoded;
    }
  }

  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, { ...fetchOpts, signal: AbortSignal.timeout(12000) });
    if (res.status !== 429 && res.status < 502) break;
    if (method !== 'GET' && !idempotencyKey) break;
    await new Promise((r) => setTimeout(r, 150 * Math.pow(2, attempt) + Math.random() * 80));
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe error (${res.status})`);
    err.code = data?.error?.code;
    err.type = data?.error?.type;
    err.status = res.status;
    throw err;
  }
  return data;
}

let cachedMainProductId = STRIPE_PRODUCT_MAIN || null;
async function getStripeProductId() {
  if (cachedMainProductId) return cachedMainProductId;
  const list = await stripeRequest('GET', 'products', { active: true, limit: 10 });
  const match = (list.data || []).find((p) => /vpn/i.test(p.name)) || (list.data || [])[0];
  if (match) {
    cachedMainProductId = match.id;
    return match.id;
  }
  const created = await stripeRequest('POST', 'products', {
    name: 'SWEEPR VPN Pro',
    description: 'SWEEPR VPN Pro — High-Speed Private Wi-Fi Encryption, ISP Throttling Protection & Zero-Logs Privacy (Up to 3 Devices — Desktop or Mobile)'
  });
  cachedMainProductId = created.id;
  return created.id;
}

let cachedWifiRadarProductId = STRIPE_PRODUCT_WIFI_RADAR || null;
async function getStripeWifiRadarProductId() {
  if (cachedWifiRadarProductId) return cachedWifiRadarProductId;
  try {
    const list = await stripeRequest('GET', 'products', { active: true, limit: 20 });
    const match = (list.data || []).find((p) => /radar|smart-tv/i.test(p.name));
    if (match) {
      cachedWifiRadarProductId = match.id;
      return match.id;
    }
    const created = await stripeRequest('POST', 'products', {
      name: 'SWEEPR Wi-Fi Radar & Smart-TV Shield',
      description: 'Live home Wi-Fi intruder alerts, unknown device detection & Smart-TV tracking protection add-on'
    });
    cachedWifiRadarProductId = created.id;
    return created.id;
  } catch {
    return getStripeProductId();
  }
}

const cachedIntroCoupons = new Map();
async function getOrCreateIntroCoupon(currency, discountAmount) {
  const normCurr = (currency || 'gbp').toLowerCase();
  const couponId = `sweepr_intro_${normCurr}_${discountAmount}`;
  if (cachedIntroCoupons.has(couponId)) return cachedIntroCoupons.get(couponId);
  try {
    const existing = await stripeRequest('GET', `coupons/${encodeURIComponent(couponId)}`);
    if (existing && existing.id) {
      cachedIntroCoupons.set(couponId, existing.id);
      return existing.id;
    }
  } catch {}
  try {
    const created = await stripeRequest('POST', 'coupons', {
      id: couponId,
      currency: normCurr,
      amount_off: discountAmount,
      duration: 'once',
      name: 'Introductory 1st-Month Offer'
    });
    cachedIntroCoupons.set(couponId, created.id);
    return created.id;
  } catch {
    return STRIPE_COUPON;
  }
}

function verifyStripeWebhookSignature(rawBody, sigHeader, secret, toleranceSeconds = 300) {
  if (!sigHeader || !secret) return false;
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.trim().split('=');
    if (k && v) {
      if (!acc[k]) acc[k] = [];
      acc[k].push(v);
    }
    return acc;
  }, {});
  const timestamp = parts.t && parts.t[0];
  const signatures = parts.v1 || [];
  if (!timestamp || signatures.length === 0) return false;
  const tsNum = Number(timestamp);
  const nowSec = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(tsNum) || (toleranceSeconds > 0 && Math.abs(nowSec - tsNum) > toleranceSeconds)) {
    return false;
  }
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  return signatures.some((sig) => {
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false;
    }
  });
}

// ============================================================================
// Local Account / License Store + Central SWEEPR CRM Sync
// ============================================================================
const licenses = new Map();
const accountsById = new Map();
const accountsByEmail = new Map();
const accountsBySubscriptionId = new Map();
const portalOtpChallenges = new Map();
const MAX_DEVICES_PER_ACCOUNT = 3;
const PAIRING_TOKEN_TTL_MS = 120 * 1000;
const pairingTokens = new Map();
const pairingChallenges = new Map();
const claimedIntroEmails = new Set();
const claimedIntroCustomerIds = new Set();
const claimedIntroCardFingerprints = new Set();
const processedStripeWebhookEvents = new Set();

function pruneExpiredPairingEntries() {
  const now = Date.now();
  for (const [k, v] of pairingTokens.entries()) {
    if (!v || now > v.expiresAt + 60000) pairingTokens.delete(k);
  }
  for (const [k, v] of pairingChallenges.entries()) {
    if (!v || now > v.expiresAt + 60000) pairingChallenges.delete(k);
  }
}

function registerOrUpdateAccountDevice(acc, { deviceId, deviceName, os = 'windows', method = 'license_key' } = {}) {
  if (!acc) return { ok: false, error: 'account_not_found' };
  if (!Array.isArray(acc.devices)) acc.devices = [];
  const rawId = String(deviceId || '').trim();
  const cleanId = rawId
    ? rawId.replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 64)
    : `dev_vpn_${crypto.randomBytes(6).toString('hex')}`;
  const cleanOs = String(os || 'windows').trim().toLowerCase().slice(0, 24) || 'windows';
  const defaultName =
    cleanOs === 'ios' ? 'iPhone / iPad'
    : cleanOs === 'android' ? 'Android Device'
    : cleanOs === 'macos' ? 'Mac'
    : cleanOs === 'linux' ? 'Linux PC'
    : 'Windows PC';
  const cleanName = String(deviceName || defaultName).trim().slice(0, 60) || defaultName;
  const nowIso = new Date().toISOString();
  const wgHash = crypto
    .createHash('sha256')
    .update(`sweepr-licence:${acc.licenseKey || acc.id}:${cleanId}`)
    .digest('hex')
    .slice(0, 32);

  const existing = acc.devices.find((d) => d && d.id === cleanId);
  if (acc.revokedDeviceIds && acc.revokedDeviceIds instanceof Set) {
    acc.revokedDeviceIds.delete(cleanId);
  }
  if (existing) {
    if (deviceName) existing.name = cleanName;
    if (os) existing.os = cleanOs;
    if (method) existing.method = method;
    existing.last_seen_at = nowIso;
    existing.wg_licence_hash = wgHash;
    return {
      ok: true,
      device: existing,
      devices_used: acc.devices.length,
      device_count: acc.devices.length,
      max_devices: MAX_DEVICES_PER_ACCOUNT,
      device_limit: MAX_DEVICES_PER_ACCOUNT
    };
  }

  if (acc.devices.length >= MAX_DEVICES_PER_ACCOUNT) {
    return {
      ok: false,
      error: 'device_limit_reached',
      message: `You have reached the ${MAX_DEVICES_PER_ACCOUNT}-device limit on your SWEEPR VPN Pro subscription (any combination of desktop or mobile). Please remove an existing device from your Customer Portal or app first.`,
      devices: acc.devices,
      devices_used: acc.devices.length,
      device_count: acc.devices.length,
      max_devices: MAX_DEVICES_PER_ACCOUNT,
      device_limit: MAX_DEVICES_PER_ACCOUNT
    };
  }

  const entry = {
    id: cleanId,
    name: cleanName,
    os: cleanOs,
    method: String(method || 'license_key'),
    created_at: nowIso,
    last_seen_at: nowIso,
    wg_licence_hash: wgHash
  };
  acc.devices.push(entry);
  return {
    ok: true,
    device: entry,
    devices_used: acc.devices.length,
    device_count: acc.devices.length,
    max_devices: MAX_DEVICES_PER_ACCOUNT,
    device_limit: MAX_DEVICES_PER_ACCOUNT
  };
}

function recordBoundedSet(setObj, value, maxEntries = 10000) {
  if (!value) return;
  if (setObj.size >= maxEntries) {
    const oldest = setObj.values().next().value;
    if (oldest !== undefined) setObj.delete(oldest);
  }
  setObj.add(value);
}

function buildVpnEntitlements(wifiRadarAddon) {
  const list = [
    'vpn_wireguard_tunnel',
    'vpn_streaming_speed_booster',
    'vpn_auto_killswitch',
    'vpn_multi_device_10'
  ];
  if (wifiRadarAddon) {
    list.push('addon_wifi_radar_and_smart_tv_shield');
  }
  return list;
}

function generateHighEntropyLicenseKey() {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `SWEEPR-VPN-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

function generateUniqueActivationCode() {
  for (let i = 0; i < 20; i++) {
    const candidate = String(crypto.randomInt(100000, 1000000));
    if (!licenses.has(candidate)) return candidate;
  }
  return String(crypto.randomInt(100000, 1000000));
}

function evictStaleLeadAccountsIfNeeded() {
  if (accountsById.size < MAX_LOCAL_ACCOUNTS) return;
  for (const [id, record] of accountsById.entries()) {
    if (record.status !== 'active') {
      accountsById.delete(id);
      if (record.email) accountsByEmail.delete(record.email);
      licenses.delete(record.licenseKey);
      licenses.delete(record.activation_code);
      break;
    }
  }
}

function upsertLocalAccount({ email, name, country, stripeCustomerId, plan, wifiRadarAddon, subscriptionId, status = 'active' }) {
  const normEmail = (email || '').trim().toLowerCase();
  let acc = (normEmail && accountsByEmail.get(normEmail)) || null;
  if (!acc) {
    evictStaleLeadAccountsIfNeeded();
    const activationCode = generateUniqueActivationCode();
    const accountId = `acc_vpn_${crypto.randomBytes(6).toString('hex')}`;
    const licenseKey = generateHighEntropyLicenseKey();
    acc = {
      id: accountId,
      account_id: accountId,
      email: normEmail,
      name: name || '',
      country: country || 'GB',
      stripe_customer_id: stripeCustomerId || null,
      stripe_subscription_id: subscriptionId || null,
      activation_code: activationCode,
      licenseKey,
      plan: plan || 'annual',
      wifiRadarAddon: Boolean(wifiRadarAddon),
      entitlements: buildVpnEntitlements(Boolean(wifiRadarAddon)),
      status,
      createdAt: new Date().toISOString()
    };
  } else {
    const isAlreadyActive = acc.status === 'active';
    const isUnpaidTransition = status === 'lead' || status === 'pending';
    if (!isAlreadyActive || !isUnpaidTransition) {
      if (name) acc.name = name;
      if (country) acc.country = country;
      if (plan) acc.plan = plan;
      if (wifiRadarAddon !== undefined) {
        acc.wifiRadarAddon = Boolean(wifiRadarAddon);
        acc.entitlements = buildVpnEntitlements(acc.wifiRadarAddon);
      }
      if (status) acc.status = status;
    }
    if (stripeCustomerId) acc.stripe_customer_id = stripeCustomerId;
    if (subscriptionId) acc.stripe_subscription_id = subscriptionId;
  }

  accountsById.set(acc.id, acc);
  if (normEmail) {
    accountsByEmail.set(normEmail, acc);
  }
  if (acc.status === 'active') {
    licenses.set(acc.licenseKey, acc);
    licenses.set(acc.activation_code, acc);
  } else {
    if (licenses.get(acc.licenseKey) === acc) licenses.delete(acc.licenseKey);
    if (licenses.get(acc.activation_code) === acc) licenses.delete(acc.activation_code);
  }
  if (subscriptionId) accountsBySubscriptionId.set(subscriptionId, acc);
  return acc;
}

// Seed Founder Pro account (cookbenjamin1996@gmail.com — matches sweepr_crm sub_founder_vpn)
{
  const founderAcc = upsertLocalAccount({
    email: 'cookbenjamin1996@gmail.com',
    name: 'Benjamin Cook',
    country: 'GB',
    plan: 'annual',
    wifiRadarAddon: true,
    status: 'active'
  });
  licenses.delete(founderAcc.activation_code);
  licenses.delete(founderAcc.licenseKey);
  founderAcc.activation_code = '236585';
  founderAcc.licenseKey = 'SWEEPR-VPN-F9DC-F69E-EB3D';
  licenses.set('236585', founderAcc);
  licenses.set('SWEEPR-VPN-F9DC-F69E-EB3D', founderAcc);
  licenses.set('SWEEPR-DB-F9DC-F69E-EB3D', founderAcc);

  crm.syncSubscription({
    email: 'cookbenjamin1996@gmail.com',
    name: 'Benjamin Cook',
    country: 'GB',
    plan: 'annual',
    status: 'active',
    days: 3650,
    amount_cents: 7499,
    currency: 'gbp',
    activation_code: '236585',
    license_key: 'SWEEPR-VPN-F9DC-F69E-EB3D',
    addons: ['wifi_radar'],
    notes: 'Seeded Founder Pro VPN Account'
  }).catch(() => {});
}

// Seed deterministic demo Pro account ONLY when ALLOW_DEMO_ACCOUNT=true in non-production environments
if (ALLOW_DEMO_ACCOUNT) {
  const demoProAccount = upsertLocalAccount({
    email: 'demo@sweeprvpn.com',
    name: 'SWEEPR Demo Pro',
    country: 'GB',
    plan: 'annual',
    wifiRadarAddon: true,
    status: 'active'
  });
  licenses.delete(demoProAccount.activation_code);
  licenses.delete(demoProAccount.licenseKey);
  demoProAccount.activation_code = '849201';
  demoProAccount.licenseKey = 'SWEEPR-VPN-PRO1-2026-DEMO';
  licenses.set('849201', demoProAccount);
  licenses.set('SWEEPR-VPN-PRO1-2026-DEMO', demoProAccount);

  // Ensure demo account exists in central sweepr_crm so it can also be managed/revoked from CRM
  crm.verifyKey('849201', 'demo@sweeprvpn.com').then((res) => {
    if (res && res.error === 'key_not_found') {
      return crm.syncSubscription({
        email: 'demo@sweeprvpn.com',
        name: 'SWEEPR Demo Pro',
        country: 'GB',
        plan: 'annual',
        status: 'active',
        days: 365,
        amount_cents: 7499,
        currency: 'gbp',
        activation_code: '849201',
        license_key: 'SWEEPR-VPN-PRO1-2026-DEMO',
        addons: ['wifi_radar'],
        notes: 'Seeded SWEEPR VPN Demo Pro account'
      });
    }
  }).catch(() => {});
}

function syncLocalCacheFromCrm(crmData, fallbackEmail = '', fallbackCode = '') {
  if (!crmData || typeof crmData !== 'object') return null;
  const email = String(crmData.email || fallbackEmail || (crmData.account_id ? `${crmData.account_id}@license.sweeprvpn.com` : '')).trim().toLowerCase();
  const isActive = Boolean(crmData.valid === true && (crmData.status === 'active' || crmData.status === 'trialing' || !crmData.status));
  if (isActive && email) {
    const addonsList = Array.isArray(crmData.addons)
      ? crmData.addons
      : Array.isArray(crmData.entitlements?.addons)
      ? crmData.entitlements.addons
      : [];
    const hasWifiRadar = Boolean(
      crmData.wifiRadarAddon ||
      addonsList.includes('wifi_radar') ||
      addonsList.includes('sweepr_secure_bundle')
    );
    const acc = upsertLocalAccount({
      email,
      plan: crmData.plan || 'annual',
      wifiRadarAddon: hasWifiRadar,
      status: 'active'
    });
    if (crmData.account_id) {
      accountsById.delete(acc.id);
      acc.id = crmData.account_id;
      acc.account_id = crmData.account_id;
      accountsById.set(acc.id, acc);
    }
    const newCode = String(crmData.activation_code || fallbackCode || '').trim();
    const newKey = String(crmData.licenseKey || crmData.license_key || '').trim();
    if (email !== 'cookbenjamin1996@gmail.com') {
      if (newCode && /^\d{6}$/.test(newCode) && newCode !== acc.activation_code) {
        licenses.delete(acc.activation_code);
        acc.activation_code = newCode;
      }
      if (newKey && newKey !== acc.licenseKey) {
        licenses.delete(acc.licenseKey);
        acc.licenseKey = newKey;
      }
    } else {
      if (newCode && /^\d{6}$/.test(newCode)) licenses.set(newCode, acc);
      if (newKey) licenses.set(newKey.toUpperCase(), acc);
      acc.activation_code = '236585';
      acc.licenseKey = 'SWEEPR-VPN-F9DC-F69E-EB3D';
      licenses.set('236585', acc);
      licenses.set('SWEEPR-VPN-F9DC-F69E-EB3D', acc);
    }
    licenses.set(acc.activation_code, acc);
    licenses.set(acc.licenseKey, acc);
    return acc;
  }

  // If CRM authoritatively reports subscription is canceled/expired or revoked, evict active status from local cache
  if (crmData.valid === false && crmData._httpStatus && crmData._httpStatus < 500) {
    const localByEmail = email ? accountsByEmail.get(email) : null;
    const localByCode = fallbackCode ? (licenses.get(fallbackCode) || licenses.get(fallbackCode.toUpperCase())) : null;
    const target = localByEmail || localByCode;
    if (
      target &&
      target.email !== 'cookbenjamin1996@gmail.com' &&
      (crmData.error === 'subscription_inactive' ||
        crmData.error === 'device_revoked' ||
        crmData.status === 'canceled' ||
        crmData.status === 'expired')
    ) {
      target.status = crmData.status || 'canceled';
      licenses.delete(target.activation_code);
      licenses.delete(target.licenseKey);
      revokeLicenceOnAllNodes(target).catch(() => {});
    }
  }
  return null;
}

const VPN_SERVER_LOCATIONS = [
  { code: 'UK-LON-01', country: 'United Kingdom', city: 'London Docklands', flag: '🇬🇧', pingMs: 4, speedMbps: 940, loadPct: 18, ip: '78.141.205.68', protocol: 'WireGuard 10Gbps' },
  { code: 'SE-STO-01', country: 'Sweden', city: 'Stockholm Privacy Core', flag: '🇸🇪', pingMs: 14, speedMbps: 915, loadPct: 22, ip: '70.34.208.107', protocol: 'WireGuard 10Gbps' },
  { code: 'NL-AMS-01', country: 'Netherlands', city: 'Amsterdam Core', flag: '🇳🇱', pingMs: 8, speedMbps: 930, loadPct: 24, ip: '95.179.181.53', protocol: 'WireGuard 10Gbps' },
  { code: 'DE-FRA-01', country: 'Germany', city: 'Frankfurt IX', flag: '🇩🇪', pingMs: 11, speedMbps: 925, loadPct: 19, ip: '80.240.20.239', protocol: 'WireGuard 10Gbps' },
  { code: 'US-NYC-01', country: 'United States', city: 'New York Core', flag: '🇺🇸', pingMs: 68, speedMbps: 860, loadPct: 31, ip: '45.77.109.112', protocol: 'WireGuard 10Gbps' },
  { code: 'US-LAX-01', country: 'United States', city: 'Los Angeles', flag: '🇺🇸', pingMs: 118, speedMbps: 810, loadPct: 27, ip: '45.32.85.162', protocol: 'WireGuard 10Gbps' },
  { code: 'SG-SIN-01', country: 'Singapore', city: 'Singapore Marina', flag: '🇸🇬', pingMs: 154, speedMbps: 785, loadPct: 16, ip: '149.28.157.142', protocol: 'WireGuard 10Gbps' },
  { code: 'JP-TYO-01', country: 'Japan', city: 'Tokyo Shinagawa', flag: '🇯🇵', pingMs: 162, speedMbps: 770, loadPct: 21, ip: '104.156.239.162', protocol: 'WireGuard 10Gbps' }
];

// Zero-dependency ISO/IEC 18004 QR Code SVG generator (supports up to 367-byte WireGuard .conf payloads)
function renderWireGuardQrSvg(text) {
  try {
    const bytes = Buffer.from(String(text || ''), 'utf8');
    // Pick QR Version 10-L (<= 271 bytes) or Version 12-L (<= 367 bytes)
    const ver = bytes.length <= 271 ? 10 : 12;
    const size = 17 + ver * 4;
    const alignCenters = ver === 10 ? [6, 28, 50] : [6, 32, 58];
    const ecPerBlock = ver === 10 ? 18 : 24;
    const blockLens = ver === 10 ? [68, 68, 69, 69] : [92, 92, 93, 93];
    const totalDataBytes = blockLens.reduce((a, b) => a + b, 0);

    // 1. Encode byte-mode bit stream (mode 0100 + 16-bit length for v10+)
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    pushBits(0b0100, 4);
    pushBits(bytes.length, 16);
    for (const b of bytes) pushBits(b, 8);
    const maxBits = totalDataBytes * 8;
    for (let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
    while (bits.length % 8 !== 0) bits.push(0);
    const dataWords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let w = 0;
      for (let j = 0; j < 8; j++) w = (w << 1) | bits[i + j];
      dataWords.push(w);
    }
    let padToggle = true;
    while (dataWords.length < totalDataBytes) {
      dataWords.push(padToggle ? 0xec : 0x11);
      padToggle = !padToggle;
    }

    // 2. GF(256) Reed-Solomon Error Correction (primitive polynomial 0x11D)
    const gfExp = new Uint8Array(512);
    const gfLog = new Uint8Array(256);
    let x = 1;
    for (let i = 0; i < 255; i++) {
      gfExp[i] = x;
      gfLog[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];
    const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : gfExp[gfLog[a] + gfLog[b]]);

    let gen = [1];
    for (let i = 0; i < ecPerBlock; i++) {
      const next = new Array(gen.length + 1).fill(0);
      for (let j = 0; j < gen.length; j++) {
        next[j] ^= gen[j];
        next[j + 1] ^= gfMul(gen[j], gfExp[i]);
      }
      gen = next;
    }

    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;
    for (const len of blockLens) {
      const block = dataWords.slice(offset, offset + len);
      offset += len;
      dataBlocks.push(block);
      const ec = new Array(ecPerBlock).fill(0);
      for (const b of block) {
        const factor = b ^ ec[0];
        ec.shift();
        ec.push(0);
        for (let j = 0; j < ecPerBlock; j++) {
          ec[j] ^= gfMul(gen[j + 1], factor);
        }
      }
      ecBlocks.push(ec);
    }

    const finalWords = [];
    const maxBlockLen = Math.max(...blockLens);
    for (let i = 0; i < maxBlockLen; i++) {
      for (let b = 0; b < dataBlocks.length; b++) {
        if (i < dataBlocks[b].length) finalWords.push(dataBlocks[b][i]);
      }
    }
    for (let i = 0; i < ecPerBlock; i++) {
      for (let b = 0; b < ecBlocks.length; b++) {
        finalWords.push(ecBlocks[b][i]);
      }
    }

    // 3. Build Matrix & Function Patterns
    const grid = Array.from({ length: size }, () => new Uint8Array(size));
    const isFunc = Array.from({ length: size }, () => new Uint8Array(size));
    const setFunc = (r, c, dark) => {
      if (r < 0 || c < 0 || r >= size || c >= size) return;
      grid[r][c] = dark ? 1 : 0;
      isFunc[r][c] = 1;
    };

    const drawFinder = (r0, c0) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const onBorder = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
          setFunc(r0 + dr, c0 + dc, onBorder);
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    for (let i = 8; i < size - 8; i++) {
      setFunc(6, i, i % 2 === 0);
      setFunc(i, 6, i % 2 === 0);
    }

    for (const r of alignCenters) {
      for (const c of alignCenters) {
        if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            setFunc(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      }
    }

    // Reserve format & version areas
    for (let i = 0; i <= 8; i++) {
      if (i !== 6) {
        isFunc[8][i] = 1;
        isFunc[i][8] = 1;
      }
      if (i < 8) {
        isFunc[8][size - 1 - i] = 1;
        isFunc[size - 1 - i][8] = 1;
      }
    }
    setFunc(size - 8, 8, true);

    // Version info (BCH 18,6 with generator 0x1F25)
    let remV = ver;
    for (let i = 0; i < 12; i++) remV = (remV << 1) ^ ((remV >>> 11) * 0x1f25);
    const verBits = (ver << 12) | remV;
    for (let i = 0; i < 18; i++) {
      const bit = ((verBits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }

    // 4. Place Data & EC Bits in Zigzag
    let bitIdx = 0;
    const totalBits = finalWords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const c = right - j;
          const upward = ((right + 1) & 2) === 0;
          const r = upward ? size - 1 - vert : vert;
          if (!isFunc[r][c] && bitIdx < totalBits) {
            const byte = finalWords[bitIdx >>> 3];
            const bit = (byte >>> (7 - (bitIdx & 7))) & 1;
            grid[r][c] = bit;
            bitIdx++;
          }
        }
      }
    }

    // Apply Mask 0 ((r + c) % 2 === 0) and write Format Info (EC Level L = 01, Mask = 000)
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isFunc[r][c] && (r + c) % 2 === 0) grid[r][c] ^= 1;
      }
    }
    const fmtData = (0b01 << 3) | 0;
    let remF = fmtData;
    for (let i = 0; i < 10; i++) remF = (remF << 1) ^ ((remF >>> 9) * 0x537);
    const fmtBits = ((fmtData << 10) | remF) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFunc(8, i, ((fmtBits >>> i) & 1) === 1);
    setFunc(8, 7, ((fmtBits >>> 6) & 1) === 1);
    setFunc(8, 8, ((fmtBits >>> 7) & 1) === 1);
    setFunc(7, 8, ((fmtBits >>> 8) & 1) === 1);
    for (let i = 9; i < 15; i++) setFunc(14 - i, 8, ((fmtBits >>> i) & 1) === 1);
    for (let i = 0; i < 8; i++) setFunc(size - 1 - i, 8, ((fmtBits >>> i) & 1) === 1);
    for (let i = 8; i < 15; i++) setFunc(8, size - 15 + i, ((fmtBits >>> i) & 1) === 1);

    // 5. Render compact SVG path
    let pathD = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c]) pathD += `M${c + 2},${r + 2}h1v1h-1z`;
      }
    }
    const viewSize = size + 4;
    return `<svg viewBox="0 0 ${viewSize} ${viewSize}" width="180" height="180" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg"><rect width="${viewSize}" height="${viewSize}" fill="#ffffff"/><path d="${pathD}" fill="#0f172a"/></svg>`;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------- Real VPN servers
// VPN_NODES (Railway variable) is created by scripts/provision-node.mjs:
// [{ code, country, city, flag, ip, port, public_key, agent_port, agent_secret }]
const ENCRYPTED_VPN_NODES =
  '8f4f88e81ddab7d94a399d57:010c5f16f5298ffd02875619317e1c9e:aadfae75b18df85705903245d80bc7f8ceee98e47588069c3521d78a28fa7debaeddc969c536f97222f464d81d9b49816791078b2b468cf9ad7931dd0497f058df5a5c1445b01162cd4474dafbe3dcfa91492c119ef78162b9fc1a4dc4690164c043de7f72ee9dc948df4dc534b2c1d09ff4ec44f800b4e90f65953cc655165a97ce77f996fbd123a299bd3683262aa2934619f65a972c622a117743d5ef8a5a7c4065cacafc1b790c76610c5d45aaa30bbb2766247781888abe9120759eaca1a6ac7ed3a3d8edc80e82fcb1fcf00901db86525557acb2bfb7f7680377bb9e6b7b8d8de95eec262cee3c9eb5a4e5770f0eb7c24f3b2c3fc2d65ce713fb97333eb73eef8557b9a21ffe75930518f752f11a0a8f979166e5c8750acfcf51dafae93b39b064a72d7200139b75e918d742de3daff663a45ebbbc87dc2e93e21b1d5c9a47a95f2f02a1fa179d010097917d2e336d2207f4d76f8879c8c51ebdc1764aa98464ff620782fcb54df7cca5b2aed8d167fe1936e712aaa3ebd22265bd08f5097a7e597554a24aab4ed5e5995c12764247368c3a3d69ddcd1ab8353a7f2edcd6550c7d5c64a4c39ee8eb29e1df53558eac2395f49f8f11735cad90046d7a6c05cf7116fe1cce7c9d3eb2e60352481bc922ec0479344b5441c859d8933e03c9f929ee1f0b72ca98e252119dac2adac235e7b6e689b3019d2b4d88e7065422d387ea7283a6d4b2fb950fdd462a5bd976c7b7287fae49c489d6e7755f9631cd2a785bc1c47579dccf8750da964be83172f9ee1f5f297c5dba5fedb40fd1b951428131096569eac94375aad1c2af1f4dc316f7151d5db7d95f86dfc509b198bbd858c8bbd589fdbc9d692f50e600c89518dbca103c16d6bb0426b8f5b4d5a83ba54d0fd5926e0b62db1ca88e69b53a976528e28f63d3271ddd50614282d946bc425f1561ebea70ecdc779a1506b9c61d1d62e87218a380f996cd0459a5635c44cde2a7fa455d3846e52ee5ab451bcee12e10cf5561fcabe3ba4361635ff99ddb21b0266cbbe7ac38c3a372881bfdb64a24cae25809d7ec72ccf7e1e47b131439eb3941bc22ca5fe98be3a972830652ab343601b9be66aa4d4340738a489ca7b125bc3d6ca7174d7852977e1405d53bd7ca5bdc116a65c358907e90bab844146c29a470ac4e3fafa3ba85a9bced31ea808f6d126bc5ec00b65ccb8300822ea3d100e7176964bd1dfb2ca56df24599f4952eca6d80a586b041ac95e1a490ca5f5f032c76532e83bea9c4cfdaaefc65d0b2f2171b4ff1239f48228dc54fe7a355c116a0b2abacd7146d4c4984190a9b51d38a73ce6f787f22461a7026f94213ee72da247b8c3016bc97fb7a0f05eafbfbd4970c9faacb7fde5ae31f3620dbb73e5d92872c30ddd1de8eaf99edf8368c553f9ea6d010caa5814aea6f448d158ccd1077e7795891cd3f8a9441a77b029a98029244fed4073b18af6f122657d9abe2f014be5e3430d2f70a1868e46b1e5458408762ceb39156132c673327990e50b902c4a7095b60ce0155fee0ff0d14cbf2f5064aca227c3da792ebb5e64f41cd923bfc95869aabe7f752d0fdf5cfd06c5aab979fcad2f290e43cb34d3a4a8d4c6c513bcd9a1edeb42a1c84016864564cc5981d26366de317bf3821f88325004e74211bde743a7ea0318708f2c34904c38c5160b4e9fd93511d992b34f366d966a66aa8ea9320d9e185e609c19e6770609c75c405359b537dd48e45d30f35917bcd2c430b455d2d86f468f12690ef23026e097ddd23d22f37fcbb44c329cbfdaaae128454b7ad76fb5ed6079577f4cedc44f79997fda832b433460305f3c53d7a2bb456c4df78e240010d3279582c0fa9db9a284364763df146457a4ff1ed432563d9bdfe78a98a6126f5861f152ae9376d528509cda9a50dd56259167d1f9d90b3ce5c1afba8b0c51bb36982fd472c6d7323353a66abd2037afd2e537238debc34eb0dc97980f96496e4d42b0861ac6f67affdfde8ab1b440a7779db2e3c52675d9eb1c5f80cc2f7784f7ebd41f2dd047b84acc6317692a2d9f8384973ecede602ab530ea3130c2489af263b9d521f42bb4cf1f3b2bbe6fb5b1e6567df5a5dd14cc1e0d539997c548d49950d2eca7b3a35bca5279d68df8b3e1b52c8cbbc127e3e18d815547431a08d8e1e64f93f4165f2a265911e8422980f81712d3b80dadf38b03ea219a1d7be633998af4cd984b1db032511506e5358902ccc57548c40473725cfde2ca45ea2e1438e3c1954261206fb5aef8b76f7ef6fa71529bd50b9f8a59cdca09244e202eb63263fd9825e45e32f06ea792e366a5f7bb0f1534f05555a4952b99c91a860cf9732152f48d6eb6cf31f31a0045ace57927265dee430e350170546391e41292db7300379f0b68b4805e4786b41a1b6c64bc52fb533a0294e56439a9e715f655b687215ff1fc9e50ccd3c7c9035bfc885dea7c017bc020dbd2bf54cc666';
const ENCRYPTED_LICENSE_PRIV_KEY_B64 =
  'f768e9721e298c69899c9448:01f3f60ab30a24f88eec036a8f83342a:e9dd6a2f72cf229c78d7ffcf2415f465c62386d32387c12120c8670eb1fc4485f2b44895ab2c0d1f86bc1b60bf19771a44628cc0697cc2fe0c5d8b789c0956d34d1c4796df12007ef241eb7aa10e36fa6aa9e5286e51a30b89e9f06c622062b5dfffdaa943cf3e72df5d36d46ffb919e1566c66c591e0cfa25cacf45dd0827e3383dfa7f666e6fd308e5cae234e86c3db0929bd4a503db609f89fdc6f9b3c5e5';
const ENCRYPTED_SMTP_USER =
  'a4043e8c7c5d0bf1df66a24d:0aa3cd11b41aea690e95491853d2e4cd:70256eb6d028c6c11e50de2fdba455b176f1546d22b65085423d';
const ENCRYPTED_SMTP_PASS =
  '74b1937c1b56de9b8691eb8c:096aab59dc0b0dd3ee18dc1feda09ff7:160defeca58906848629ef56b55c07ac';

function decryptServerVault(payload) {
  if (!payload || !STRIPE_SECRET_KEY) return '';
  try {
    const [ivHex, tagHex, encHex] = payload.split(':');
    const key = crypto.createHash('sha256').update('sweepr_vault_v2:' + STRIPE_SECRET_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return decryptWithAdminKey(payload);
  }
}

function loadVpnNodes() {
  try {
    const raw = (process.env.VPN_NODES || '').trim();
    if (raw) {
      const v = JSON.parse(raw);
      const valid = Array.isArray(v) ? v.filter((n) => n && n.code && n.ip && n.agent_secret && n.agent_secret !== '__AGENT_SECRET__') : [];
      if (valid.length > 0) return valid;
    }
    const localReg = path.resolve(__dirname, '..', 'infra', 'nodes.local.json');
    if (fs.existsSync(localReg)) {
      const v = JSON.parse(fs.readFileSync(localReg, 'utf8'));
      const valid = Array.isArray(v) ? v.filter((n) => n && n.code && n.ip && n.agent_secret && n.agent_secret !== '__AGENT_SECRET__') : [];
      if (valid.length > 0) return valid;
    }
    const dec = decryptServerVault(ENCRYPTED_VPN_NODES);
    if (dec) {
      const v = JSON.parse(dec);
      return Array.isArray(v) ? v.filter((n) => n && n.code && n.ip && n.agent_secret) : [];
    }
    return [];
  } catch {
    return [];
  }
}

const nodeHealthCache = new Map();
const nodeCircuitState = new Map();

async function nodeHealth(n) {
  const cached = nodeHealthCache.get(n.code);
  if (cached && Date.now() - cached.at < 30000) return cached.value;
  let value = null;
  const t0 = performance.now();
  try {
    const scheme = n.agent_tls ? 'https' : 'http';
    const r = await fetch(`${scheme}://${n.ip}:${n.agent_port || 8787}/health`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) {
      const probeMs = Math.round(performance.now() - t0);
      const prevSamples = (cached?.samples || []).slice(-19).concat(probeMs);
      const sorted = [...prevSamples].sort((a, b) => a - b);
      const p99Ms = sorted[Math.max(0, sorted.length - 1)] || probeMs;
      value = { ...(await r.json()), probeMs, p99Ms };
      nodeHealthCache.set(n.code, { at: Date.now(), value, samples: prevSamples });
      return value;
    }
  } catch {}
  if (cached?.value) {
    crm.reportTelemetryEvent({ event_name: 'vpn_node_down', category: 'infra', properties: { code: n.code, ip: n.ip } }).catch(() => {});
  }
  nodeHealthCache.set(n.code, { at: Date.now(), value, samples: cached?.samples || [] });
  return value;
}

async function selectHealthyNodeForRegion(nodes, serverCode) {
  const candidates = nodes.filter((n) => n.code === serverCode || n.code.startsWith(serverCode.slice(0, 6)));
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];
  const scored = await Promise.all(
    candidates.map(async (n) => {
      const h = await nodeHealth(n);
      return { node: n, online: Boolean(h), devices: h?.devices ?? 9999 };
    })
  );
  scored.sort((a, b) => Number(b.online) - Number(a.online) || a.devices - b.devices);
  return scored[0].node;
}

// Requests to a node are signed with HMAC-SHA256 (timestamp + one-time nonce), see infra/node/sweepr_agent.py
async function callNodeAgent(n, method, agentPath, payload) {
  const cb = nodeCircuitState.get(n.code);
  if (cb && cb.openUntil > Date.now()) {
    throw new Error('node_circuit_open');
  }
  const body = JSON.stringify(payload || {});
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString('hex');
  const sig = crypto.createHmac('sha256', n.agent_secret).update(`${method}\n${agentPath}\n${ts}\n${nonce}\n${body}`).digest('hex');
  const scheme = n.agent_tls ? 'https' : 'http';
  try {
    const r = await fetch(`${scheme}://${n.ip}:${n.agent_port || 8787}${agentPath}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Sweepr-Timestamp': ts, 'X-Sweepr-Nonce': nonce, 'X-Sweepr-Signature': sig },
      body,
      signal: AbortSignal.timeout(6000)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) throw new Error(data.error || `agent_${r.status}`);
    if (cb) nodeCircuitState.delete(n.code);
    return data;
  } catch (err) {
    const fails = (cb?.failures || 0) + 1;
    nodeCircuitState.set(n.code, { failures: fails, openUntil: fails >= 3 ? Date.now() + 20000 : 0 });
    nodeHealthCache.set(n.code, { at: Date.now(), value: null, samples: nodeHealthCache.get(n.code)?.samples || [] });
    throw err;
  }
}

function computeVpnLicenceHash(rawKey) {
  const clean = String(rawKey || '').trim();
  if (!clean) return '';
  return crypto.createHash('sha256').update('sweepr-licence:' + clean).digest('hex').slice(0, 32);
}

async function revokeLicenceOnAllNodes(accOrKeys) {
  const nodes = loadVpnNodes();
  if (!Array.isArray(nodes) || nodes.length === 0) return { revokedHashes: 0, nodesContacted: 0 };

  const rawCandidates = new Set();
  if (typeof accOrKeys === 'string') {
    rawCandidates.add(accOrKeys);
  } else if (accOrKeys && typeof accOrKeys === 'object') {
    for (const k of [
      accOrKeys.licenseKey,
      accOrKeys.license_key,
      accOrKeys.id,
      accOrKeys.account_id,
      accOrKeys.activation_code,
      ...(Array.isArray(accOrKeys.keys) ? accOrKeys.keys : [])
    ]) {
      if (k) {
        rawCandidates.add(String(k).trim());
        rawCandidates.add(String(k).trim().toUpperCase());
      }
    }
    if (Array.isArray(accOrKeys.devices)) {
      for (const dev of accOrKeys.devices) {
        if (dev && dev.wg_licence_hash) rawCandidates.add(String(dev.wg_licence_hash).trim());
      }
    }
  }

  const hashes = new Set();
  for (const raw of rawCandidates) {
    if (/^[a-f0-9]{32}$/.test(raw)) {
      hashes.add(raw);
    }
    const h = computeVpnLicenceHash(raw);
    if (h) hashes.add(h);
  }

  const tasks = [];
  for (const n of nodes) {
    for (const licenceHash of hashes) {
      tasks.push(callNodeAgent(n, 'POST', '/licences/revoke', { licence: licenceHash }).catch(() => null));
    }
  }
  await Promise.allSettled(tasks);
  return { revokedHashes: hashes.size, nodesContacted: nodes.length };
}

// Returns { id } for an active licence, where id is a one-way hash (servers never see the real key).
// Authoritatively verifies against centralized sweepr_crm first, with local fallback if CRM is unreachable or key is in local cache.
async function resolveVpnLicence(code, email, deviceId) {
  const rawInput = String(code || '').trim();
  const extractedKey = rawInput.toUpperCase().match(/SWEEPR\s*-\s*[A-Z0-9]{2,8}\s*-\s*[A-Z0-9]{4}\s*-\s*[A-Z0-9]{4}\s*-\s*[A-Z0-9]{4}/i);
  const cleanCode = extractedKey
    ? extractedKey[0].replace(/\s+/g, '').toUpperCase()
    : rawInput.replace(/\s+/g, '').toUpperCase();
  if (!cleanCode || cleanCode.length < 6) return null;
  const local = licenses.get(cleanCode) || licenses.get(cleanCode.toUpperCase());
  const normEmail = (email ? String(email).trim().toLowerCase() : '') || (local && local.status === 'active' ? local.email : '');
  const isShortSixDigit = /^\d{6}$/.test(cleanCode);
  if (isShortSixDigit && !isValidEmail(normEmail) && !(local && local.status === 'active')) {
    return null;
  }

  const cleanDevId = deviceId ? String(deviceId).trim().replace(/[^a-zA-Z0-9_.:-]/g, '').slice(0, 64) : '';
  if (cleanDevId && local && local.revokedDeviceIds && local.revokedDeviceIds.has(cleanDevId)) {
    return null;
  }

  let key = null;
  let resolvedAcc = local || null;

  try {
    const data = await crm.activateDevice({
      email: normEmail || undefined,
      otp: cleanCode,
      deviceId: cleanDevId || ('vpn_tunnel_' + crypto.createHash('sha256').update((normEmail || 'key') + ':' + cleanCode).digest('hex').slice(0, 12)),
      deviceName: 'SWEEPR VPN Tunnel',
      os: 'windows',
      appVersion: '2.5.0'
    });

    if (data && data._httpStatus && data._httpStatus < 500) {
      const synced = syncLocalCacheFromCrm(data, normEmail, cleanCode);
      if (synced) resolvedAcc = synced;
      if (data.valid && (!normEmail || !data.email || String(data.email).toLowerCase() === normEmail || String(data.email).includes('*'))) {
        key = data.licenseKey || data.license_key || data.account_id || cleanCode;
      }
    }
  } catch {}

  if (!key) {
    try {
      const verifyData = await crm.verifyKey(cleanCode, normEmail || undefined);
      if (verifyData && verifyData.valid) {
        const synced = syncLocalCacheFromCrm(verifyData, normEmail, cleanCode);
        if (synced) resolvedAcc = synced;
        key = verifyData.licenseKey || verifyData.license_key || verifyData.account_id || cleanCode;
      }
    } catch {}
  }

  const localAfter = licenses.get(cleanCode) || licenses.get(cleanCode.toUpperCase()) || resolvedAcc || local || (normEmail ? accountsByEmail.get(normEmail) : null);
  if (!key) {
    if (localAfter && localAfter.status === 'active' && (!normEmail || localAfter.email === normEmail)) {
      key = localAfter.licenseKey || localAfter.id;
      resolvedAcc = localAfter;
    }
  } else if (localAfter && localAfter.status === 'active') {
    resolvedAcc = localAfter;
  }

  if (!key) return null;
  return {
    id: computeVpnLicenceHash(cleanDevId ? `${key}:${cleanDevId}` : key),
    account: resolvedAcc,
    key
  };
}

function signFallbackEd25519LicenseToken(acc, deviceId = 'vpn_desktop') {
  try {
    const b64Pem = (process.env.LICENSE_PRIVATE_KEY_B64 || '').trim() || decryptServerVault(ENCRYPTED_LICENSE_PRIV_KEY_B64);
    if (!b64Pem) return null;
    const privKey = crypto.createPrivateKey(Buffer.from(b64Pem, 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 72 * 3600;
    const kid = (process.env.SWEEPR_LICENSE_KID || 'ed25519-2026-01').trim();
    const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT', kid })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: acc.id,
        device_id: deviceId,
        project_id: 'vpn',
        status: 'active',
        plan: acc.plan || 'annual',
        addons: acc.wifiRadarAddon ? ['wifi_radar'] : [],
        iat: now,
        exp
      })
    ).toString('base64url');
    const signingInput = `${header}.${payload}`;
    const sig = crypto.sign(null, Buffer.from(signingInput, 'utf8'), privKey).toString('base64url');
    return { token: `${signingInput}.${sig}`, expires_at: exp };
  } catch {
    return null;
  }
}

function signSessionCookie(accountId, email) {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
  const payload = Buffer.from(JSON.stringify({ sub: accountId, email, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionCookie(req) {
  try {
    const rawCookies = req.headers.cookie || '';
    const match = rawCookies.match(/(?:^|;\s*)sweepr_session=([^;]+)/);
    if (!match || !match[1]) return null;
    const token = decodeURIComponent(match[1].trim());
    const dotIdx = token.indexOf('.');
    if (dotIdx <= 0) return null;
    const payloadB64 = token.slice(0, dotIdx);
    const sigB64 = token.slice(dotIdx + 1);
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
    if (!safeCompareStrings(sigB64, expectedSig)) return null;
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!parsed || !parsed.sub) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (parsed.exp && Number(parsed.exp) < nowSec) return null;
    return {
      accountId: String(parsed.sub),
      email: String(parsed.email || '').trim().toLowerCase()
    };
  } catch {
    return null;
  }
}

async function sendWelcomeLicenseEmail(acc) {
  if (!acc || acc.welcomeEmailSent) return false;
  const email = String(acc.email || '').trim().toLowerCase();
  if (!isValidEmail(email) || email.endsWith('@pending.sweeprvpn.com') || email === 'customer@sweeprvpn.com') {
    return false;
  }
  acc.welcomeEmailSent = true;
  const licenseKey = acc.licenseKey || 'SWEEPR-VPN-PRO';
  const activationCode = acc.activation_code || '849201';
  const subject = 'Welcome to SWEEPR VPN Pro — Your License Key & Setup Guide';
  const textBody = `Hi ${acc.name || 'there'},\n\nThank you for subscribing to SWEEPR VPN Pro! Your subscription is active for up to 3 devices (any combination of desktop or mobile).\n\nFull Product License Key (Paste in App): ${licenseKey}\n6-Digit Quick Activation Code: ${activationCode}\nRegistered Email: ${email}\n\n1. Open SWEEPR VPN (or download at https://sweeprvpn.com/download?key=${encodeURIComponent(licenseKey)}&autoconf=1)\n2. Paste ${licenseKey} into the license key box to unlock all 8 global locations and Smart-TV shields.\n\nBest regards,\nThe SWEEPR VPN Team`;
  const htmlBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#0f172a;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
  <h2 style="margin:0 0 8px;font-size:21px;font-weight:800;color:#0f172a">Welcome to SWEEPR VPN Pro! 🎉</h2>
  <p style="margin:0 0 18px;font-size:14px;color:#475569">Hi ${escapeHtml(acc.name || 'there')}, your subscription is active across up to 3 devices (any combination of desktop or mobile). Here are your credentials:</p>
  <div style="background:#f0fdf4;border:2px dashed #10b981;border-radius:12px;padding:18px;text-align:center;margin:18px 0">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#047857;margin-bottom:6px">Full Product License Key (Paste in App)</div>
    <div style="font-family:monospace;font-size:19px;font-weight:800;color:#0f172a;letter-spacing:1px">${escapeHtml(licenseKey)}</div>
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#047857;margin:14px 0 4px">6-Digit Portal &amp; Quick Code</div>
    <div style="font-family:monospace;font-size:26px;font-weight:800;color:#059669;letter-spacing:6px">${escapeHtml(activationCode)}</div>
  </div>
  <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">Copy <strong>${escapeHtml(licenseKey)}</strong> and paste it into SWEEPR VPN to activate protection immediately.</p>
</div>`;

  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  if (resendKey) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'SWEEPR VPN <onboarding@resend.dev>',
          to: [email],
          subject,
          text: textBody,
          html: htmlBody
        })
      });
      if (r.ok) return true;
    } catch {}
  }

  const smtpUser = (process.env.SMTP_GMAIL_USER || '').trim().replace(/^["']|["']$/g, '') ||
    decryptServerVault(ENCRYPTED_SMTP_USER);
  const smtpPass = (process.env.SMTP_GMAIL_PASS || '').trim().replace(/\s+/g, '').replace(/^["']|["']$/g, '') ||
    decryptServerVault(ENCRYPTED_SMTP_PASS);
  if (smtpUser && smtpPass) {
    try {
      await new Promise((resolve, reject) => {
        const sock = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com', timeout: 8000 });
        let step = 0, buf = '';
        const boundary = '----=_Part_SWEEPR_' + Date.now().toString(36);
        const mime = [
          `From: "SWEEPR VPN" <${smtpUser}>`,
          `To: <${email}>`,
          `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
          `Date: ${new Date().toUTCString()}`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/plain; charset="UTF-8"',
          'Content-Transfer-Encoding: base64',
          '',
          Buffer.from(textBody, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset="UTF-8"',
          'Content-Transfer-Encoding: base64',
          '',
          Buffer.from(htmlBody, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
          '',
          `--${boundary}--`,
          '.',
          ''
        ].join('\r\n');
        const fail = (err) => { try { sock.destroy(); } catch {} reject(err); };
        sock.on('timeout', () => fail(new Error('timeout')));
        sock.on('error', fail);
        sock.on('data', (chunk) => {
          buf += chunk.toString('utf8');
          const lines = buf.split('\r\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line || (line.length >= 4 && line[3] === '-')) continue;
            const code = parseInt(line.slice(0, 3), 10);
            if (code >= 400) return fail(new Error(line));
            if (step === 0 && code === 220) { step = 1; sock.write('EHLO sweeprvpn.com\r\n'); }
            else if (step === 1 && code === 250) { step = 2; sock.write('AUTH LOGIN\r\n'); }
            else if (step === 2 && code === 334) { step = 3; sock.write(Buffer.from(smtpUser, 'utf8').toString('base64') + '\r\n'); }
            else if (step === 3 && code === 334) { step = 4; sock.write(Buffer.from(smtpPass, 'utf8').toString('base64') + '\r\n'); }
            else if (step === 4 && code === 235) { step = 5; sock.write(`MAIL FROM:<${smtpUser}>\r\n`); }
            else if (step === 5 && code === 250) { step = 6; sock.write(`RCPT TO:<${email}>\r\n`); }
            else if (step === 6 && code === 250) { step = 7; sock.write('DATA\r\n'); }
            else if (step === 7 && code === 354) { step = 8; sock.write(mime + '\r\n'); }
            else if (step === 8 && code === 250) { step = 9; sock.write('QUIT\r\n'); try { sock.end(); } catch {} resolve(true); }
          }
        });
      });
      return true;
    } catch {}
  }
  return false;
}

async function sendSupportTicketOwnerEmail({ fromEmail, subject, message, platform = 'desktop', ticketId = 'VPN-LOCAL' }) {
  const notifyTo = (process.env.SUPPORT_NOTIFY_EMAIL || process.env.SMTP_GMAIL_USER || '').trim().replace(/^["']|["']$/g, '') || 'cookbenjamin1996@gmail.com';
  const emailSubject = `[SWEEPR VPN Support] ${subject} (from ${fromEmail})`;
  const textBody = `New support message received via SWEEPR VPN (${platform}):\n\nFrom: ${fromEmail}\nProject: SWEEPR VPN (vpn)\nSubject: ${subject}\nTicket ID: ${ticketId}\n\nMessage:\n${message}\n`;
  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  if (resendKey) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'SWEEPR VPN <onboarding@resend.dev>',
          to: [notifyTo],
          reply_to: fromEmail,
          subject: emailSubject,
          text: textBody
        })
      });
      if (r.ok) return true;
    } catch {}
  }
  const smtpUser = (process.env.SMTP_GMAIL_USER || '').trim().replace(/^["']|["']$/g, '') ||
    decryptServerVault(ENCRYPTED_SMTP_USER) || 'cookbenjamin1996@gmail.com';
  const smtpPass = (process.env.SMTP_GMAIL_PASS || '').trim().replace(/\s+/g, '').replace(/^["']|["']$/g, '') ||
    decryptServerVault(ENCRYPTED_SMTP_PASS) || 'chkjyludllijfxdk';
  if (smtpUser && smtpPass) {
    try {
      await new Promise((resolve, reject) => {
        const sock = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com', timeout: 8000 });
        let step = 0, buf = '';
        const mime = [
          `From: "SWEEPR VPN Support" <${smtpUser}>`,
          `To: <${notifyTo}>`,
          `Reply-To: <${fromEmail}>`,
          `Subject: =?UTF-8?B?${Buffer.from(emailSubject, 'utf8').toString('base64')}?=`,
          `Date: ${new Date().toUTCString()}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset="UTF-8"',
          'Content-Transfer-Encoding: base64',
          '',
          Buffer.from(textBody, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
          '',
          '.',
          ''
        ].join('\r\n');
        const fail = (err) => { try { sock.destroy(); } catch {} reject(err); };
        sock.on('timeout', () => fail(new Error('timeout')));
        sock.on('error', fail);
        sock.on('data', (chunk) => {
          buf += chunk.toString('utf8');
          const lines = buf.split('\r\n');
          buf = lines.pop() || '';
          for (const line of lines) {
            if (!line || (line.length >= 4 && line[3] === '-')) continue;
            const code = parseInt(line.slice(0, 3), 10);
            if (code >= 400) return fail(new Error(line));
            if (step === 0 && code === 220) { step = 1; sock.write('EHLO sweeprvpn.com\r\n'); }
            else if (step === 1 && code === 250) { step = 2; sock.write('AUTH LOGIN\r\n'); }
            else if (step === 2 && code === 334) { step = 3; sock.write(Buffer.from(smtpUser, 'utf8').toString('base64') + '\r\n'); }
            else if (step === 3 && code === 334) { step = 4; sock.write(Buffer.from(smtpPass, 'utf8').toString('base64') + '\r\n'); }
            else if (step === 4 && code === 235) { step = 5; sock.write(`MAIL FROM:<${smtpUser}>\r\n`); }
            else if (step === 5 && code === 250) { step = 6; sock.write(`RCPT TO:<${notifyTo}>\r\n`); }
            else if (step === 6 && code === 250) { step = 7; sock.write('DATA\r\n'); }
            else if (step === 7 && code === 354) { step = 8; sock.write(mime + '\r\n'); }
            else if (step === 8 && code === 250) { step = 9; sock.write('QUIT\r\n'); try { sock.end(); } catch {} resolve(true); }
          }
        });
      });
      return true;
    } catch {}
  }
  return false;
}

async function syncPayPalCustomerEmail(sub, acc, cs = null) {
  if (!STRIPE_SECRET_KEY || !sub || !acc) return;
  try {
    const currentEmail = (acc.email || '').trim().toLowerCase();
    const needsEmailSync = !currentEmail || currentEmail.endsWith('@pending.sweeprvpn.com') || currentEmail === 'customer@sweeprvpn.com';

    let pm = typeof sub.default_payment_method === 'object' && sub.default_payment_method ? sub.default_payment_method : null;
    if (!pm) {
      const latestInv = sub.latest_invoice;
      const pi = latestInv?.payment_intent;
      if (pi && typeof pi.payment_method === 'object' && pi.payment_method) {
        pm = pi.payment_method;
      } else if (typeof sub.default_payment_method === 'string') {
        pm = await stripeRequest('GET', `payment_methods/${encodeURIComponent(sub.default_payment_method)}`).catch(() => null);
      }
    }

    let payerEmail = String(
      pm?.paypal?.payer_email ||
      pm?.billing_details?.email ||
      cs?.customer_details?.email ||
      cs?.customer_email ||
      sub?.latest_invoice?.customer_email ||
      ''
    ).trim().toLowerCase();
    const payerName = String(
      pm?.billing_details?.name ||
      cs?.customer_details?.name ||
      ''
    ).trim();

    const custId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id || acc.stripe_customer_id;
    if ((!payerEmail || payerEmail.endsWith('@pending.sweeprvpn.com')) && custId) {
      const cust = await stripeRequest('GET', `customers/${encodeURIComponent(custId)}`).catch(() => null);
      if (cust && !cust.deleted && cust.email && !String(cust.email).toLowerCase().endsWith('@pending.sweeprvpn.com')) {
        payerEmail = String(cust.email).trim().toLowerCase();
      }
    }

    if (payerName && !acc.name) acc.name = payerName;

    if (needsEmailSync && payerEmail && isValidEmail(payerEmail) && !payerEmail.endsWith('@pending.sweeprvpn.com')) {
      const existing = accountsByEmail.get(payerEmail);
      if (!existing || existing.id === acc.id) {
        if (acc.email) accountsByEmail.delete(acc.email);
        acc.email = payerEmail;
        accountsByEmail.set(payerEmail, acc);
        if (custId) {
          await stripeRequest('POST', `customers/${encodeURIComponent(custId)}`, {
            email: payerEmail,
            ...(acc.name ? { name: acc.name } : {})
          }).catch(() => {});
        }
      }
    }
    sendWelcomeLicenseEmail(acc).catch(() => {});
  } catch {}
}

async function fetchStripeSubOrPayPalIntent(id) {
  if (!id) return null;
  if (id.startsWith('pi_')) {
    const pi = await stripeRequest('GET', `payment_intents/${encodeURIComponent(id)}`, {
      expand: ['payment_method', 'latest_charge']
    });
    if (!pi) return null;
    const pm = typeof pi.payment_method === 'object' ? pi.payment_method : null;
    return {
      id: pi.id,
      object: 'payment_intent',
      status: pi.status === 'succeeded' ? 'active' : pi.status,
      customer: pi.customer,
      currency: pi.currency,
      metadata: pi.metadata || {},
      default_payment_method: pm,
      latest_invoice: {
        payment_intent: pi,
        customer_email:
          pi.receipt_email ||
          pm?.paypal?.payer_email ||
          pm?.billing_details?.email ||
          pi.latest_charge?.billing_details?.email ||
          null
      },
      items: {
        data: [{ price: { unit_amount: pi.amount || 0 }, quantity: 1 }]
      }
    };
  }
  return stripeRequest('GET', `subscriptions/${encodeURIComponent(id)}`, {
    expand: ['default_payment_method', 'latest_invoice.payment_intent.payment_method']
  });
}

function hasWifiRadarInBody(body) {
  if (!body) return false;
  if (body.wifiRadarAddon || body.wifi_radar) return true;
  if (Array.isArray(body.addons)) {
    return body.addons.some((a) => a === 'wifi_radar' || a === 'addon_wifi_radar_and_smart_tv_shield');
  }
  return false;
}

function extractAffiliateRef(req, urlObj, body) {
  const fromBody = String(body?.ref || body?.affiliate_code || body?.referral_code || body?.attribution?.ref || '').trim();
  const fromQuery = String(
    urlObj?.searchParams?.get('ref') ||
    urlObj?.searchParams?.get('aff') ||
    urlObj?.searchParams?.get('referral') ||
    ''
  ).trim();
  let fromCookie = '';
  const rawCookies = String(req?.headers?.cookie || '');
  const m = rawCookies.match(/(?:^|;\s*)sweepr_ref=([^;]+)/);
  if (m && m[1]) {
    try {
      fromCookie = decodeURIComponent(m[1].trim());
    } catch {}
  }
  return (fromBody || fromQuery || fromCookie).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

function reportToSweeprCrm(pathAndQuery, body) {
  try {
    const headers = {
      'content-type': 'application/json',
      'x-sweepr-project': 'vpn'
    };
    if (SWEEPR_CRM_API_KEY) {
      headers['x-crm-api-key'] = SWEEPR_CRM_API_KEY;
      headers['x-sweepr-api-key'] = SWEEPR_CRM_API_KEY;
    }
    fetch(`${SWEEPR_CRM_URL}${pathAndQuery}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ project_id: 'vpn', ...body })
    }).catch(() => {});
  } catch {}
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.exe': 'application/vnd.microsoft.portable-executable'
};

const CANONICAL_REDIRECTS = {
  '/index.html': '/',
  '/pricing.html': '/pricing',
  '/order.html': '/order',
  '/login.html': '/login',
  '/dashboard.html': '/dashboard',
  '/refund.html': '/refund',
  '/terms.html': '/terms',
  '/privacy.html': '/privacy',
  '/support.html': '/support',
  '/app': '/download',
  '/app-preview.html': '/download',
  '/app-preview': '/download',
  '/vs-totalvpn.html': '/vs/totalvpn',
  '/vs-totalvpn': '/vs/totalvpn',
  '/alternatives-totalvpn.html': '/alternatives/totalvpn',
  '/alternatives-totalvpn': '/alternatives/totalvpn',
  '/leak-test.html': '/tools/leak-test',
  '/isp-throttling-test.html': '/tools/isp-throttling-test',
  '/setup/asuswrt-merlin-vpn-client': '/setup/asuswrt-merlin-vpn-router',
  '/guides/block-samsung-tv-acr-tracking': '/guides/stop-samsung-smart-tv-acr-tracking',
  '/guides/block-lg-webos-acr-tracking': '/guides/stop-lg-smart-tv-acr-spying'
};

const ROUTE_ALIASES = {
  '/': 'index.html',
  '/pricing': 'pricing.html',
  '/order': 'order.html',
  '/checkout': 'order.html',
  '/login': 'login.html',
  '/dashboard': 'dashboard.html',
  '/refund': 'refund.html',
  '/terms': 'terms.html',
  '/privacy': 'privacy.html',
  '/support': 'support.html',
  '/vs/totalvpn': 'vs-totalvpn.html',
  '/alternatives/totalvpn': 'alternatives-totalvpn.html',
  '/tools/leak-test': 'leak-test.html',
  '/tools/isp-throttling-test': 'isp-throttling-test.html'
};

function readRawBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const declaredLen = Number(req.headers?.['content-length'] || 0);
    if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
      try { req.resume(); } catch {}
      const err = new Error('payload_too_large');
      err.statusCode = 413;
      reject(err);
      return;
    }
    let body = '';
    let totalBytes = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        rejected = true;
        body = '';
        try { req.resume(); } catch {}
        const err = new Error('payload_too_large');
        err.statusCode = 413;
        reject(err);
        return;
      }
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!rejected) resolve(body);
    });
    req.on('error', (err) => {
      if (!rejected) reject(err);
    });
  });
}

async function readJsonBody(req, maxBytes = MAX_BODY_BYTES) {
  try {
    const raw = await readRawBody(req, maxBytes);
    return JSON.parse(raw || '{}');
  } catch (err) {
    if (err && err.statusCode === 413) {
      return { __tooLarge: true };
    }
    return {};
  }
}

function sendJson(res, status, payload, extraHeaders = {}, req = null) {
  const allowedOrigin = req ? resolveTrustedOrigin(req) : PUBLIC_URL;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigin,
    Vary: 'Origin',
    ...COMMON_SECURITY_HEADERS,
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    ...COMMON_SECURITY_HEADERS,
    ...extraHeaders
  });
  res.end(html);
}

function buildIosWebClipMobileconfig(req) {
  const baseOrigin = PUBLIC_URL.includes('localhost') && req?.headers?.host
    ? `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`
    : PUBLIC_URL;
  let iconBase64 = '';
  try {
    const iconPath = path.join(__dirname, 'favicon.png');
    if (fs.existsSync(iconPath)) {
      iconBase64 = fs.readFileSync(iconPath).toString('base64');
    }
  } catch {}
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      ${iconBase64 ? `<key>Icon</key>\n      <data>${iconBase64}</data>` : ''}
      <key>IgnoreManifestScope</key>
      <true/>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>SWEEPR VPN</string>
      <key>PayloadDescription</key>
      <string>Installs the SWEEPR VPN app onto your iPhone or iPad Home Screen.</string>
      <key>PayloadDisplayName</key>
      <string>SWEEPR VPN iOS App</string>
      <key>PayloadIdentifier</key>
      <string>com.sweeprvpn.ios.webclip</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>7B94E2A0-19C4-4A12-9A2E-8147B53E9011</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>${escapeHtml(baseOrigin)}/ios-app</string>
    </dict>
    <dict>
      <key>DNSSettings</key>
      <dict>
        <key>DNSProtocol</key>
        <string>HTTPS</string>
        <key>ServerURL</key>
        <string>https://cloudflare-dns.com/dns-query</string>
      </dict>
      <key>PayloadDescription</key>
      <string>Configures SWEEPR VPN Encrypted DNS-over-HTTPS and Smart-TV Privacy Shield.</string>
      <key>PayloadDisplayName</key>
      <string>SWEEPR Encrypted DNS &amp; Privacy Shield</string>
      <key>PayloadIdentifier</key>
      <string>com.sweeprvpn.ios.dns</string>
      <key>PayloadType</key>
      <string>com.apple.dnsSettings.managed</string>
      <key>PayloadUUID</key>
      <string>8C41F3B1-28D5-4B23-8B3F-9258C64FA122</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>ProhibitDisablement</key>
      <false/>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Installs the SWEEPR VPN iOS App icon on your Home Screen and enables Encrypted DNS protection on iPhone and iPad.</string>
  <key>PayloadDisplayName</key>
  <string>SWEEPR VPN (iPhone &amp; iPad Installer)</string>
  <key>PayloadIdentifier</key>
  <string>com.sweeprvpn.ios.installer</string>
  <key>PayloadOrganization</key>
  <string>SWEEPR VPN</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>9D52A4C2-39E6-4C34-9C4A-0369D750B233</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;
}

function renderStandaloneIosVpnApp() {
  return VPN_ANDROID_HTML;
}

function renderPlatformDownloadPicker(osType = 'other', rawUa = '', hostOrigin = PUBLIC_URL) {
  const uaLower = String(rawUa || '').toLowerCase();
  const isNonSafariIos = osType === 'ios' && (/crios|fxios|edgios|opios|instagram|fban|fbav|tiktok|line\/|wv/i.test(uaLower) || !uaLower.includes('safari'));
  const isAndroidWebView = osType === 'android' && /\bwv\b|instagram|fban|fbav|tiktok|bytedancewebview|line\/|micromessenger|reddit/i.test(uaLower);
  const cleanHost = String(hostOrigin || PUBLIC_URL).replace(/^https?:\/\//, '');
  const safariDeepLink = `x-safari-https://${cleanHost}/download/SWEEPRVPN.mobileconfig`;
  const chromeIntentLink = `intent://${cleanHost}/download/SWEEPRVPN.apk#Intent;scheme=https;package=com.android.chrome;end`;

  const browserAssistBanner = isNonSafariIos
    ? `<div class="mb-5 p-4 rounded-2xl border-2 border-emerald-400 bg-emerald-50/90 text-left space-y-2.5">
        <div class="font-extrabold text-sm text-emerald-950">📱 iPhone / iPad Detected — 1-Tap Install</div>
        <p class="text-xs text-emerald-900 leading-relaxed">Apple requires iOS Configuration Profiles to be opened in <strong>Safari</strong>, or you can launch the iOS app directly below:</p>
        <div class="grid grid-cols-1 gap-2 pt-1">
          <a href="${safariDeepLink}" class="btn btn-go w-full justify-center py-2.5 text-xs font-extrabold">🧭 Open in Safari &amp; Install iOS App</a>
          <a href="/ios-app" class="btn btn-ghost bg-white border border-emerald-300 w-full justify-center py-2.5 text-xs font-extrabold text-emerald-900">🚀 Launch SWEEPR VPN iOS App Now</a>
        </div>
      </div>`
    : isAndroidWebView
    ? `<div class="mb-5 p-4 rounded-2xl border-2 border-emerald-400 bg-emerald-50/90 text-left space-y-2.5">
        <div class="font-extrabold text-sm text-emerald-950">📱 Android Detected — Downloading SWEEPRVPN.apk...</div>
        <p class="text-xs text-emerald-900 leading-relaxed">If your current in-app browser blocks direct APK installation, tap below to open directly in Chrome:</p>
        <div class="grid grid-cols-1 gap-2 pt-1">
          <a href="${chromeIntentLink}" class="btn btn-go w-full justify-center py-2.5 text-xs font-extrabold">🌐 Open in Chrome &amp; Install APK</a>
          <a href="/download/SWEEPRVPN.apk" download="SWEEPRVPN.apk" class="btn btn-ghost bg-white border border-emerald-300 w-full justify-center py-2.5 text-xs font-extrabold text-emerald-900">⬇️ Direct Download SWEEPRVPN.apk</a>
        </div>
        <iframe src="/download/SWEEPRVPN.apk" class="hidden" title="APK Auto Download"></iframe>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download SWEEPR VPN</title>
  <meta name="robots" content="noindex, follow">
  <link rel="icon" type="image/svg+xml" href="/logo-emerald.svg?v=5">
  <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png?v=5">
  <link rel="shortcut icon" href="/favicon.ico?v=5">
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="text-gray-800 flex flex-col items-center justify-center min-h-screen p-4 overflow-x-hidden">
  <div class="glass-card p-6 sm:p-10 w-full max-w-lg text-center">
    <a href="/?home=1" class="inline-flex items-center gap-2 text-inherit no-underline mb-4">
      <div class="logo-box">S</div>
      <span class="font-extrabold text-xl tracking-tight text-gray-900">SWEEPR <span class="text-emerald-600">VPN</span></span>
    </a>
    <h1 class="text-2xl font-black text-gray-900 mb-2">Download SWEEPR VPN</h1>
    <p class="text-sm text-gray-600 mb-5 leading-relaxed">Select your device below to download and install SWEEPR VPN. Purchased on another device? Log in to your Customer Portal to activate this device via QR code.</p>

    ${browserAssistBanner}

    <div class="space-y-3 text-left mb-6">
      <a href="/download/SWEEPRVPN.apk" download="SWEEPRVPN.apk" class="flex items-center justify-between gap-3 p-4 rounded-xl border ${osType === 'android' ? 'border-2 border-emerald-500 bg-emerald-50/40' : 'border-gray-200 bg-white'} hover:border-emerald-400 transition-all no-underline text-gray-900">
        <div>
          <div class="font-bold text-sm text-gray-900">📱 Android Phone &amp; Tablet Installer (.apk)</div>
          <div class="text-xs text-gray-500">Direct 1-Tap APK Install &bull; SWEEPRVPN.apk</div>
        </div>
        <span class="btn btn-go text-xs py-2 px-3 shrink-0">Download .apk</span>
      </a>
      <a href="/download/SWEEPRVPN.mobileconfig" class="flex items-center justify-between gap-3 p-4 rounded-xl border ${osType === 'ios' ? 'border-2 border-emerald-500 bg-emerald-50/40' : 'border-gray-200 bg-white'} hover:border-emerald-400 transition-all no-underline text-gray-900">
        <div>
          <div class="font-bold text-sm text-gray-900">🍎 iPhone &amp; iPad Installer (iOS / iPadOS)</div>
          <div class="text-xs text-gray-500">Installs SWEEPR VPN App &amp; Privacy Profile &bull; 1-Tap Setup</div>
        </div>
        <span class="btn btn-go text-xs py-2 px-3 shrink-0">Install on iOS</span>
      </a>
      <a href="/download?platform=win" class="flex items-center justify-between gap-3 p-4 rounded-xl border ${osType === 'windows' ? 'border-2 border-emerald-500 bg-emerald-50/40' : 'border-gray-200 bg-white'} hover:border-emerald-400 transition-all no-underline text-gray-900">
        <div>
          <div class="font-bold text-sm text-gray-900">💻 Windows 10 &amp; 11 Desktop Installer (.exe)</div>
          <div class="text-xs text-gray-500">Direct download &bull; SWEEPRVPN.exe</div>
        </div>
        <span class="btn btn-go text-xs py-2 px-3 shrink-0">Download .exe</span>
      </a>
      <a href="/download?platform=mac" class="flex items-center justify-between gap-3 p-4 rounded-xl border ${osType === 'mac' ? 'border-2 border-emerald-500 bg-emerald-50/40' : 'border-gray-200 bg-white'} hover:border-emerald-400 transition-all no-underline text-gray-900">
        <div>
          <div class="font-bold text-sm text-gray-900">🍏 macOS 11+ Universal Desktop Installer (.dmg)</div>
          <div class="text-xs text-gray-500">Apple Silicon &amp; Intel &bull; SWEEPRVPN.dmg</div>
        </div>
        <span class="btn btn-go text-xs py-2 px-3 shrink-0">Download .dmg</span>
      </a>
      <a href="/login" class="flex items-center justify-between gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:border-emerald-400 transition-all no-underline text-gray-900">
        <div>
          <div class="font-extrabold text-sm text-gray-900">Already Purchased? Activate via QR Code</div>
          <div class="text-xs text-gray-500">Log in to your Customer Portal to scan or use your QR code to activate a separate device</div>
        </div>
        <span class="text-xs font-extrabold text-emerald-700 bg-white border border-emerald-200 px-3 py-1.5 rounded-full shrink-0">Customer Login &rarr;</span>
      </a>
      <a href="/order?plan=annual" class="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50/80 hover:bg-white transition-all no-underline text-gray-900">
        <div>
          <div class="font-extrabold text-sm text-gray-900">Need a License Key? Get SWEEPR VPN Pro</div>
          <div class="text-xs text-gray-500">Protects up to 3 devices (any combination of desktop or mobile) &bull; Save 50%</div>
        </div>
        <span class="text-xs font-bold text-emerald-700 underline shrink-0">Get Pro &rarr;</span>
      </a>
    </div>
    <div class="flex justify-center pt-4 border-t border-gray-100">
      <a href="/?home=1" class="btn btn-ghost w-full justify-center">Back to Home</a>
    </div>
  </div>
</body>
</html>`;
}

function renderCheckoutSuccessPage(acc, isCancelled = false, isPopup = false) {
  if (isCancelled) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Checkout Cancelled — SWEEPR VPN</title>
  <link rel="icon" type="image/svg+xml" href="/logo-emerald.svg?v=5">
  <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png?v=5">
  <link rel="shortcut icon" href="/favicon.ico?v=5">
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
  ${
    isPopup
      ? `<script>
    try {
      const payload = { type: 'paypal_cancelled', ts: Date.now() };
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(payload, window.location.origin);
      }
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('sweepr_paypal_checkout');
        bc.postMessage(payload);
        bc.close();
      }
      localStorage.setItem('sweepr_paypal_event', JSON.stringify(payload));
      setTimeout(() => { try { window.close(); } catch {} }, 300);
    } catch {}
  </script>`
      : ''
  }
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6 font-sans">
  <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
    <h1 class="text-2xl font-black">Checkout Cancelled</h1>
    <p class="text-sm text-slate-400">No charge was made to your account. ${isPopup ? 'This window will close automatically.' : 'You can return to the order page anytime.'}</p>
    <a href="/order" onclick="${isPopup ? 'try{window.close();return false;}catch{}' : ''}" class="inline-block w-full py-3 px-6 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm no-underline">${isPopup ? 'Close Window' : 'Return to Order Page'}</a>
  </div>
</body>
</html>`;
  }

  const licenseKey = escapeHtml(acc?.licenseKey || 'SWEEPR-VPN-PRO');
  const activationCode = escapeHtml(acc?.activation_code || '849204');
  const email = escapeHtml(acc?.email || '');
  const subscriptionId = escapeHtml(acc?.stripe_subscription_id || '');
  const accountId = escapeHtml(acc?.id || '');
  const planLabel = escapeHtml(
    acc?.plan === 'annual' ? 'Annual Plan' : acc?.plan === 'six_month' ? '6-Month Plan' : 'Monthly Plan'
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>You're Activated 🎉 — SWEEPR VPN Pro</title>
  <link rel="icon" type="image/svg+xml" href="/logo-emerald.svg?v=5">
  <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png?v=5">
  <link rel="shortcut icon" href="/favicon.ico?v=5">
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
  <script>
    try {
      localStorage.removeItem('sweepr_order_draft');
      localStorage.removeItem('sweepr_visited_order');
      document.cookie = 'sweepr_order_draft=; path=/; max-age=0; SameSite=Lax';
      document.cookie = 'sweepr_visited_order=; path=/; max-age=0; SameSite=Lax';
      if ('${licenseKey}') {
        localStorage.setItem('sweepr_vpn_code', '${licenseKey}');
        localStorage.setItem('sweepr_vpn_license_key', '${licenseKey}');
      }
      if ('${email}') {
        localStorage.setItem('sweepr_vpn_email', '${email}');
      }
      if (${isPopup ? 'true' : 'false'}) {
        const redirectUrl = '/checkout/success?web=1&subscription_id=${subscriptionId}&account_id=${accountId}';
        const msg = { type: 'paypal_success', redirectUrl, subscriptionId: '${subscriptionId}', accountId: '${accountId}' };
        const msg2 = { type: 'sweepr_checkout_complete', redirectUrl, subscriptionId: '${subscriptionId}', accountId: '${accountId}' };
        try { new BroadcastChannel('sweepr_paypal_checkout').postMessage(msg); } catch (e) {}
        try { new BroadcastChannel('sweepr_checkout').postMessage(msg2); } catch (e) {}
        try { localStorage.setItem('sweepr_paypal_event', JSON.stringify({ ...msg, ts: Date.now() })); } catch (e) {}
        if (window.opener) {
          try { window.opener.postMessage(msg, window.location.origin); } catch (e) {}
          try { window.opener.postMessage(msg2, window.location.origin); } catch (e) {}
          setTimeout(() => window.close(), 400);
        }
      }
    } catch (e) {}
  </script>
</head>
<body class="bg-[#0b1120] text-white min-h-screen flex items-center justify-center p-6 font-sans antialiased">
  <div class="max-w-xl w-full bg-[#131c31] border border-emerald-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6 text-center">
    <div class="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-3xl">
      🎉
    </div>
    <div>
      <span class="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-3">
        Pro License Active &bull; ${planLabel}
      </span>
      <h1 class="text-3xl sm:text-4xl font-black tracking-tight">You're Activated!</h1>
      <p class="text-sm text-slate-300 mt-2">
        Thank you for purchasing <strong>SWEEPR VPN Pro</strong>${email ? ` (${email})` : ''}. Your instant activation key and installer are ready below.
      </p>
    </div>

    <div class="bg-slate-900/90 border border-slate-700/80 rounded-2xl p-5 space-y-3 text-left">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Product License Key (Enter in App)</div>
          <div id="licenseKeyText" class="font-mono text-lg sm:text-xl font-black text-emerald-400 tracking-wider mt-0.5">${licenseKey}</div>
        </div>
        <button onclick="navigator.clipboard.writeText('${licenseKey}'); this.textContent='Copied ✓';" class="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer shrink-0">
          Copy License Key
        </button>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-300 pt-1">
        <div>
          <span class="text-slate-400">6-Digit Portal &amp; Quick Code:</span>
          <span id="activationKeyText" class="font-mono font-bold text-white bg-slate-800 px-2.5 py-1 rounded ml-1.5">${activationCode}</span>
        </div>
        <button onclick="navigator.clipboard.writeText('${activationCode}'); this.textContent='Copied ✓';" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-[11px] font-bold cursor-pointer">
          Copy Code
        </button>
      </div>
      <div class="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
        <div class="font-bold text-slate-200 mb-1">Unlocked on your account (Up to 3 Devices — Desktop or Mobile):</div>
        <div>✓ 1-Click Private Browsing &amp; Public Wi-Fi Protection (8 Global Locations)</div>
        <div>✓ Streaming Speed Booster &amp; Automatic Drop Protection</div>
        <div>✓ Home Wi-Fi Device Scanner &amp; Smart-TV Spy Blocker Included Free</div>
        ${acc?.wifiRadarAddon ? '<div class="text-emerald-300 font-semibold">✓ SWEEPR Wi-Fi Radar &amp; Smart-TV Shield Add-on Active</div>' : ''}
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
      <a href="/download" class="py-3.5 px-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-lg no-underline">
        Download App
      </a>
      <a href="/dashboard" class="py-3.5 px-4 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm border border-slate-700 no-underline">
        Customer Portal &amp; QR Setup
      </a>
    </div>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = (urlObj.pathname.replace(/\/+$/, '') || '/').replace(/^\/api\/v1\//, '/api/');

  // Handle CORS preflight requests for API routes with strict origin allowlist
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': resolveTrustedOrigin(req),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
      ...COMMON_SECURITY_HEADERS
    });
    return res.end();
  }

  // 301 Permanent Redirect from legacy .html or non-canonical URLs to clean canonical URLs
  if (req.method === 'GET' && CANONICAL_REDIRECTS[pathname]) {
    const target = CANONICAL_REDIRECTS[pathname] + (urlObj.search || '');
    res.writeHead(301, { Location: target, ...COMMON_SECURITY_HEADERS });
    return res.end();
  }
  if (req.method === 'GET' && /^\/(solutions|setup|vs|guides)\/[a-z0-9-]+\.html$/i.test(pathname)) {
    const target = pathname.replace(/\.html$/i, '') + (urlObj.search || '');
    res.writeHead(301, { Location: target, ...COMMON_SECURITY_HEADERS });
    return res.end();
  }

  // Forward AI & Search crawler hits to central SWEEPR CRM SEO Intelligence (project: vpn)
  const ua = req.headers['user-agent'] || '';
  if (req.method === 'GET' && BOT_UA_RE.test(ua) && !pathname.startsWith('/api/')) {
    crm.reportBotHit({ userAgent: ua, path: pathname, status: 200 });
  }

  // Capture Affiliate / Partner ?ref= or ?aff= into a 90-day sweepr_ref cookie and report click to Central CRM
  if (req.method === 'GET' && !pathname.startsWith('/api/')) {
    const urlRef = String(
      urlObj.searchParams.get('ref') ||
      urlObj.searchParams.get('aff') ||
      urlObj.searchParams.get('referral') ||
      ''
    )
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 64);
    if (urlRef) {
      res.setHeader('Set-Cookie', `sweepr_ref=${encodeURIComponent(urlRef)}; Path=/; Max-Age=${86400 * 90}; SameSite=Lax`);
      if (!BOT_UA_RE.test(ua)) {
        crm.reportAffiliateClick({
          code: urlRef,
          landingPath: pathname,
          referrer: req.headers.referer || ''
        }).catch(() => {});
      }
    }
  }

  if (pathname === '/api/affiliate/click' && req.method === 'POST') {
    if (!checkRateLimit(req, 'aff_click', 30, 60000)) {
      return sendJson(res, 429, { error: 'rate_limit_exceeded' }, {}, req);
    }
    const body = await readJsonBody(req);
    const code = extractAffiliateRef(req, urlObj, body);
    if (!code) return sendJson(res, 400, { ok: false, error: 'missing_code' }, {}, req);
    crm.reportAffiliateClick({
      code,
      landingPath: typeof body?.landing_path === 'string' ? body.landing_path.slice(0, 250) : '/',
      referrer: typeof body?.referrer === 'string' ? body.referrer.slice(0, 250) : req.headers.referer || ''
    }).catch(() => {});
    return sendJson(res, 200, { ok: true }, {}, req);
  }

  // Apple Pay Domain Verification File (Required by Stripe & Apple for on-page Apple Pay sheet)
  if (pathname === '/.well-known/apple-developer-merchantid-domain-association' && req.method === 'GET') {
    const assocPath = path.join(__dirname, '.well-known', 'apple-developer-merchantid-domain-association');
    if (fs.existsSync(assocPath)) {
      const body = fs.readFileSync(assocPath, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
        ...COMMON_SECURITY_HEADERS
      });
      return res.end(body);
    }
  }

  // Installable PWA Web App Manifest & Service Worker (Item 5)
  if (pathname === '/manifest.webmanifest' && req.method === 'GET') {
    return sendJson(
      res,
      200,
      {
        name: 'SWEEPR VPN — Easy Privacy & Home Wi-Fi Shield',
        short_name: 'SWEEPR VPN',
        description: '1-Click WireGuard VPN, Smart-TV ACR Telemetry Blocker, and Home Wi-Fi Device Radar.',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        background_color: '#0b1220',
        theme_color: '#047857',
        icons: [
          { src: '/favicon.svg?v=5', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: '/favicon.png?v=5', sizes: '64x64', type: 'image/png' },
          { src: '/apple-touch-icon.png?v=5', sizes: '180x180', type: 'image/png' }
        ]
      },
      { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
      req
    );
  }

  if (pathname === '/sw.js' && req.method === 'GET') {
    const swScript = `const CACHE = 'sweepr-vpn-pwa-v2.5';
const ASSETS = ['/app', '/favicon.svg?v=5', '/logo-emerald.svg?v=5'];
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) return;
  e.respondWith(fetch(e.request).then(res => {
    if (res && res.status === 200 && (e.request.url.endsWith('/app') || e.request.url.includes('favicon'))) {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
    }
    return res;
  }).catch(() => caches.match(e.request)));
});`;
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache',
      ...COMMON_SECURITY_HEADERS
    });
    return res.end(swScript);
  }

  // 30-Minute Order Draft Redirect: if visitor filled out any details on /order in the last 30 mins
  // (indicated by sweepr_order_draft=1 cookie, Max-Age=1800), redirect any revisited site page straight to /order.
  if (
    req.method === 'GET' &&
    !pathname.startsWith('/api/') &&
    !pathname.startsWith('/checkout/') &&
    !pathname.startsWith('/.well-known/') &&
    pathname !== '/order' &&
    pathname !== '/checkout' &&
    pathname !== '/login' &&
    pathname !== '/dashboard' &&
    pathname !== '/app' &&
    pathname !== '/app-preview' &&
    pathname !== '/download' &&
    pathname !== '/qr-setup' &&
    (!path.extname(pathname) || path.extname(pathname).toLowerCase() === '.html')
  ) {
    const cookies = req.headers.cookie || '';
    const hasActiveOrderDraft = /(?:^|;\s*)sweepr_order_draft=1(?:;|$)/.test(cookies);
    const bypassRedirect = urlObj.searchParams.get('noredirect') === '1';
    const referer = req.headers.referer || '';
    const isLegalFromOrder =
      (pathname === '/terms' || pathname === '/privacy' || pathname === '/refund') &&
      referer.includes('/order');

    if (hasActiveOrderDraft && !bypassRedirect && !BOT_UA_RE.test(ua) && !isLegalFromOrder) {
      res.writeHead(302, { Location: '/order', ...COMMON_SECURITY_HEADERS });
      return res.end();
    }
  }

  // QR Code Connection is only available when the customer logs in on the website (/dashboard)
  if (pathname === '/qr-setup' && (req.method === 'GET' || req.method === 'HEAD')) {
    const sess = verifySessionCookie(req);
    res.writeHead(302, { Location: sess ? '/dashboard' : '/login', ...COMMON_SECURITY_HEADERS });
    return res.end();
  }

  if (pathname === '/ios-app' && (req.method === 'GET' || req.method === 'HEAD')) {
    return sendHtml(res, 200, renderStandaloneIosVpnApp(), {
      'X-Robots-Tag': 'noindex, nofollow'
    });
  }

  if ((pathname === '/download/SWEEPRVPN.apk' || pathname === '/SWEEPRVPN.apk') && (req.method === 'GET' || req.method === 'HEAD')) {
    const apkPath = path.join(__dirname, 'SWEEPRVPN.apk');
    if (fs.existsSync(apkPath)) {
      const stat = fs.statSync(apkPath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': 'attachment; filename="SWEEPRVPN.apk"',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Robots-Tag': 'noindex, nofollow',
        ...COMMON_SECURITY_HEADERS
      });
      if (req.method === 'HEAD') return res.end();
      const apkStream = fs.createReadStream(apkPath);
      req.on('close', () => apkStream.destroy());
      apkStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
      return apkStream.pipe(res);
    }
  }

  if ((pathname === '/download/SWEEPRVPN.mobileconfig' || pathname === '/SWEEPRVPN.mobileconfig') && (req.method === 'GET' || req.method === 'HEAD')) {
    const xml = buildIosWebClipMobileconfig(req);
    res.writeHead(200, {
      'Content-Type': 'application/x-apple-aspen-config; charset=utf-8',
      'Content-Disposition': 'attachment; filename="SWEEPRVPN.mobileconfig"',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      ...COMMON_SECURITY_HEADERS
    });
    return res.end(req.method === 'HEAD' ? '' : xml);
  }

  // Handle /download route (supports Windows .exe, macOS .dmg, Android .apk, and iOS .mobileconfig)
  if (pathname === '/download' && (req.method === 'GET' || req.method === 'HEAD')) {
    const requestedPlatform = (urlObj.searchParams.get('platform') || '').toLowerCase();
    const uaLower = ua.toLowerCase();
    const chPlatform = String(req.headers['sec-ch-ua-platform'] || '').toLowerCase();
    const chMobile = String(req.headers['sec-ch-ua-mobile'] || '').toLowerCase();

    if (requestedPlatform === 'qr') {
      const sess = verifySessionCookie(req);
      res.writeHead(302, { Location: sess ? '/dashboard' : '/login', ...COMMON_SECURITY_HEADERS });
      return res.end();
    }

    let osType = 'windows';
    if (requestedPlatform === 'mac' || requestedPlatform === 'macos') osType = 'mac';
    else if (requestedPlatform === 'linux') osType = 'linux';
    else if (requestedPlatform === 'ios') osType = 'ios';
    else if (requestedPlatform === 'android' || requestedPlatform === 'apk') osType = 'android';
    else if (requestedPlatform === 'win' || requestedPlatform === 'windows') osType = 'windows';
    else if (/iphone|ipad|ipod/.test(uaLower) || chPlatform.includes('ios')) osType = 'ios';
    else if (uaLower.includes('android') || chPlatform.includes('android') || (chMobile === '?1' && uaLower.includes('linux')) || /mobile|iemobile|opera mini/.test(uaLower)) osType = 'android';
    else if (uaLower.includes('mac os') || uaLower.includes('macintosh') || chPlatform.includes('mac')) osType = 'mac';
    else if (uaLower.includes('linux') || chPlatform.includes('linux')) osType = 'linux';

    crm.reportTelemetryEvent({
      event_name: 'installer_downloaded',
      category: 'funnel',
      os: requestedPlatform || osType,
      properties: { path: '/download' }
    }).catch(() => {});

    const hostOrigin = PUBLIC_URL.includes('localhost') && req.headers.host
      ? `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`
      : PUBLIC_URL;

    if (requestedPlatform === 'picker') {
      return sendHtml(res, 200, renderPlatformDownloadPicker(osType, ua, hostOrigin), {
        'X-Robots-Tag': 'noindex, follow'
      });
    }

    // 1. Android: Always stream SWEEPRVPN.apk directly without showing a picker page
    if (osType === 'android') {
      const apkPath = path.join(__dirname, 'SWEEPRVPN.apk');
      if (fs.existsSync(apkPath)) {
        const stat = fs.statSync(apkPath);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.android.package-archive',
          'Content-Disposition': 'attachment; filename="SWEEPRVPN.apk"',
          'Content-Length': stat.size,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
          'X-Robots-Tag': 'noindex, nofollow',
          ...COMMON_SECURITY_HEADERS
        });
        if (req.method === 'HEAD') return res.end();
        const apkStream = fs.createReadStream(apkPath);
        req.on('close', () => apkStream.destroy());
        apkStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
        return apkStream.pipe(res);
      }
    }

    // 2. iOS / iPadOS: Always serve SWEEPRVPN.mobileconfig directly without showing a picker page
    if (osType === 'ios') {
      const xml = buildIosWebClipMobileconfig(req);
      res.writeHead(200, {
        'Content-Type': 'application/x-apple-aspen-config; charset=utf-8',
        'Content-Disposition': 'attachment; filename="SWEEPRVPN.mobileconfig"',
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        ...COMMON_SECURITY_HEADERS
      });
      return res.end(req.method === 'HEAD' ? '' : xml);
    }

    const forceWinExe = requestedPlatform === 'win' || requestedPlatform === 'windows';
    const forceMacDmg = requestedPlatform === 'mac' || requestedPlatform === 'macos' || requestedPlatform === 'dmg';
    const dmgPath = path.join(__dirname, 'SWEEPRVPN.dmg');

    if ((forceMacDmg || osType === 'mac') && fs.existsSync(dmgPath)) {
      const stat = fs.statSync(dmgPath);
      res.writeHead(200, {
        'Content-Type': 'application/x-apple-diskimage',
        'Content-Disposition': 'attachment; filename="SWEEPRVPN.dmg"',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'X-Robots-Tag': 'noindex, nofollow',
        ...COMMON_SECURITY_HEADERS
      });
      if (req.method === 'HEAD') return res.end();
      const dmgStream = fs.createReadStream(dmgPath);
      req.on('close', () => dmgStream.destroy());
      dmgStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
      return dmgStream.pipe(res);
    }

    if (!forceWinExe && osType !== 'windows') {
      return sendHtml(res, 200, renderPlatformDownloadPicker(osType, ua, hostOrigin), {
        'X-Robots-Tag': 'noindex, follow'
      });
    }

    const exePath = path.join(__dirname, 'SWEEPRVPN.exe');
    if (fs.existsSync(exePath)) {
      const stat = fs.statSync(exePath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.microsoft.portable-executable',
        'Content-Disposition': 'attachment; filename="SWEEPRVPN.exe"',
        'Content-Length': stat.size,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'X-Robots-Tag': 'noindex, nofollow',
        ...COMMON_SECURITY_HEADERS
      });
      const exeStream = fs.createReadStream(exePath);
      req.on('close', () => exeStream.destroy());
      exeStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
      return exeStream.pipe(res);
    }
  }

  // API 0: Geo-IP & Multi-Currency Pricing
  if (pathname === '/api/pricing' && req.method === 'GET') {
    const localizedPricing = resolvePricingForRequest(req, urlObj);
    return sendJson(res, 200, localizedPricing, {}, req);
  }

  // API 0b: Free Privacy & Speed Tool Network Diagnostic Check (/tools/leak-test & /tools/isp-throttling-test)
  if (pathname === '/api/tools/network-check' && req.method === 'GET') {
    if (!checkRateLimit(req, 'tools_net_check', 60, 60000)) {
      return sendJson(res, 429, { error: 'rate_limit_exceeded' }, {}, req);
    }
    const localizedPricing = resolvePricingForRequest(req, urlObj);
    const clientIp = getClientIp(req);
    const isSweeprNode = Array.isArray(VPN_SERVERS) && VPN_SERVERS.some((s) => s.ip === clientIp);
    const cfIsp = String(req.headers['cf-iporg'] || req.headers['x-asn-org'] || '').trim();
    const ispLabel = isSweeprNode
      ? 'SWEEPR Zero-Log WireGuard Network (Protected)'
      : cfIsp || `Residential / Consumer ISP (${localizedPricing.country || 'Unencrypted Transit'})`;
    return sendJson(
      res,
      200,
      {
        ok: true,
        ip: clientIp === '::1' || clientIp === '127.0.0.1' ? 'Public IPv4 (Unencrypted)' : clientIp,
        country: localizedPricing.country,
        countryFlag: localizedPricing.countryFlag,
        isp: ispLabel,
        encrypted: isSweeprNode,
        timestamp: Date.now()
      },
      { 'Cache-Control': 'no-store' },
      req
    );
  }

  // API 1: Public Checkout Configuration (Matches sweeprcleaner /api/checkout-config)
  if (pathname === '/api/checkout-config' && req.method === 'GET') {
    const localizedPricing = resolvePricingForRequest(req, urlObj);
    const validPk = STRIPE_PUBLISHABLE_KEY.startsWith('pk_') ? STRIPE_PUBLISHABLE_KEY : '';
    const stripeConfigured = Boolean(STRIPE_SECRET_KEY);
    return sendJson(
      res,
      200,
      {
        publishableKey: validPk,
        stripeConfigured,
        elementsEnabled: Boolean(stripeConfigured && validPk),
        country: localizedPricing.country,
        countryFlag: localizedPricing.countryFlag,
        language: localizedPricing.language,
        currency: localizedPricing.currency,
        currencyCode: localizedPricing.currencyCode,
        symbol: localizedPricing.symbol,
        symbolPosition: localizedPricing.symbolPosition,
        zeroDecimal: localizedPricing.zeroDecimal,
        pricing: localizedPricing,
        amountTodayPence: localizedPricing.annualAmount,
        amountRegularPence: localizedPricing.annualAmount,
        amountRecurringPence: localizedPricing.annualAmount,
        plans: {
          annual: {
            amountPence: localizedPricing.annualAmount,
            formatted: localizedPricing.annualFormatted,
            monthlyEqFormatted: localizedPricing.annualMonthlyEqFormatted,
            savingsPercent: localizedPricing.annualSavingsPercent,
            interval: 'year',
            name: 'SWEEPR VPN Pro (Annual)',
            label: `Annual Plan (${localizedPricing.annualFormatted}/yr — ${localizedPricing.annualMonthlyEqFormatted}/mo, Save 50%)`
          },
          six_month: {
            amountPence: localizedPricing.sixMonthAmount,
            formatted: localizedPricing.sixMonthFormatted,
            monthlyEqFormatted: localizedPricing.sixMonthMonthlyEqFormatted,
            savingsPercent: localizedPricing.sixMonthSavingsPercent,
            interval: '6 months',
            name: 'SWEEPR VPN Pro (6-Month)',
            label: `6-Month Plan (${localizedPricing.sixMonthFormatted}/6mo — ${localizedPricing.sixMonthMonthlyEqFormatted}/mo, Save 35%)`
          },
          monthly: {
            amountPence: localizedPricing.monthlyAmount,
            formatted: localizedPricing.monthlyFormatted,
            introPence: localizedPricing.introMonthlyAmount,
            introAmountPence: localizedPricing.introMonthlyAmount,
            introFormatted: localizedPricing.introMonthlyFormatted,
            introSavingsFormatted: localizedPricing.introSavingsFormatted,
            interval: 'month',
            name: 'SWEEPR VPN Pro (Monthly)',
            label: `Monthly Plan (${localizedPricing.monthlyFormatted}/mo)`
          }
        },
        addons: {
          wifi_radar: {
            id: 'wifi_radar',
            name: 'SWEEPR Wi-Fi Radar & Smart-TV Shield',
            label: 'SWEEPR Wi-Fi Radar & Smart-TV Shield',
            annualPence: localizedPricing.wifiRadarAnnualAmount,
            annualAmountPence: localizedPricing.wifiRadarAnnualAmount,
            annualFormatted: localizedPricing.wifiRadarAnnualFormatted,
            annualMonthlyEqFormatted: localizedPricing.wifiRadarAnnualMonthlyEqFormatted,
            sixMonthAmountPence: localizedPricing.wifiRadarSixMonthAmount,
            sixMonthFormatted: localizedPricing.wifiRadarSixMonthFormatted,
            sixMonthMonthlyEqFormatted: localizedPricing.wifiRadarSixMonthMonthlyEqFormatted,
            monthlyPence: localizedPricing.wifiRadarMonthlyAmount,
            monthlyAmountPence: localizedPricing.wifiRadarMonthlyAmount,
            monthlyFormatted: localizedPricing.wifiRadarMonthlyFormatted
          }
        }
      },
      {},
      req
    );
  }

  // API 1b: Lead Capture when visitor enters email on /order
  if ((pathname === '/api/vpn/leads' || pathname === '/api/lead') && req.method === 'POST') {
    if (!checkRateLimit(req, 'lead', 20, 60000)) {
      return sendJson(res, 429, { error: 'rate_limit_exceeded' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' }, {}, req);
    const email = (body?.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { error: 'invalid_email' }, {}, req);
    }
    const safeName = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const localizedPricing = resolvePricingForRequest(req, urlObj, body || {});
    upsertLocalAccount({
      email,
      name: safeName,
      country: localizedPricing.country,
      status: 'lead'
    });
    crm.captureLead({
      email,
      name: safeName || undefined,
      country: localizedPricing.country,
      source: 'order_page'
    }).catch(() => {});
    return sendJson(
      res,
      200,
      {
        ok: true,
        country: localizedPricing.country
      },
      {},
      req
    );
  }

  // API 2: Create Stripe Subscription for On-Page Stripe Elements, Google Pay, Apple Pay & PayPal (Matches sweeprcleaner)
  if (pathname === '/api/create-subscription' && req.method === 'POST') {
    if (!checkRateLimit(req, 'create_sub', 15, 60000)) {
      return sendJson(res, 429, { error: 'Too many checkout attempts. Please wait a moment and try again.' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' }, {}, req);
    if (!body) return sendJson(res, 400, { error: 'Invalid request body.' }, {}, req);
    if (!STRIPE_SECRET_KEY) return sendJson(res, 503, { error: 'stripe_not_configured' }, {}, req);

    const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.toLowerCase() : 'card';
    const isPayPal = paymentMethod === 'paypal';
    const isRedirectMethod = ['paypal', 'revolut_pay', 'amazon_pay', 'ideal', 'bancontact', 'cashapp', 'kakao_pay', 'naver_pay'].includes(paymentMethod);
    const isWallet = paymentMethod === 'wallet' || paymentMethod === 'google_pay' || paymentMethod === 'apple_pay';
    const isPopup = Boolean(body.popup);
    const providedEmail = (body.email || '').trim().toLowerCase();
    if (providedEmail && !isValidEmail(providedEmail)) {
      return sendJson(res, 400, { error: 'Please enter a valid email address.' }, {}, req);
    }
    const email =
      (providedEmail ? providedEmail : null) ||
      (isRedirectMethod || isWallet
        ? `${isRedirectMethod ? paymentMethod : 'wallet'}_${crypto.randomBytes(4).toString('hex')}@pending.sweeprvpn.com`
        : null);

    if (!email) {
      return sendJson(res, 400, { error: 'Please enter a valid email address.' }, {}, req);
    }

    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const addressLine1 = typeof body.address === 'string' ? body.address.trim().slice(0, 200) : '';
    const postalCode = typeof body.postcode === 'string' ? body.postcode.trim().slice(0, 32) : '';
    const rawPlan = typeof body.plan === 'string' ? body.plan.toLowerCase() : 'annual';
    const plan =
      rawPlan === 'annual'
        ? 'annual'
        : rawPlan === 'six_month' || rawPlan === '6month' || rawPlan === 'sixmonth'
        ? 'six_month'
        : 'monthly';
    const applyDiscount = Boolean(body.applyDiscount || body.discountApplied) && plan === 'monthly';
    const includeWifiRadar = hasWifiRadarInBody(body);

    let localizedPricing = resolvePricingForRequest(req, urlObj, body);
    if (isPayPal && localizedPricing.currency === 'jpy') {
      localizedPricing = resolvePricingForRequest(req, urlObj, { ...body, currency: 'usd' });
    }
    const canonicalEmail = canonicalizeEmailForAntiAbuse(email);
    const existingAcc = accountsByEmail.get(email);
    const wasAlreadyActive = Boolean(existingAcc && existingAcc.status === 'active');
    const alreadyClaimedIntro =
      wasAlreadyActive ||
      Boolean(canonicalEmail && claimedIntroEmails.has(canonicalEmail)) ||
      Boolean(existingAcc?.stripe_customer_id && claimedIntroCustomerIds.has(existingAcc.stripe_customer_id));
    const eligibleForIntroDiscount = applyDiscount && !alreadyClaimedIntro;

    const acc = upsertLocalAccount({
      email,
      name,
      country: localizedPricing.country,
      plan,
      wifiRadarAddon: includeWifiRadar,
      status: 'pending'
    });
    const refCode = extractAffiliateRef(req, urlObj, body);
    if (refCode) acc.ref = refCode;

    crm.reportTelemetryEvent({
      event_name: 'checkout_started',
      category: 'funnel',
      account_id: acc.id,
      os: 'web',
      properties: { plan, wifiRadarAddon: includeWifiRadar, paymentMethod, ...(refCode ? { ref: refCode } : {}) }
    }).catch(() => {});

    try {
      const metadata = {
        project_id: 'vpn',
        account_id: acc.id,
        email,
        plan,
        wifi_radar: includeWifiRadar ? 'true' : 'false',
        addons: includeWifiRadar ? 'wifi_radar' : '',
        country: localizedPricing.country,
        ...(refCode ? { ref: refCode } : {})
      };

      let customerId = acc.stripe_customer_id;
      if (customerId && !wasAlreadyActive) {
        try {
          await stripeRequest('POST', `customers/${encodeURIComponent(customerId)}`, {
            ...(providedEmail ? { email: providedEmail } : {}),
            ...(name ? { name } : {}),
            ...(addressLine1 || postalCode
              ? { address: { line1: addressLine1 || undefined, postal_code: postalCode || undefined } }
              : {}),
            metadata
          });
        } catch (custErr) {
          if (custErr.code === 'resource_missing' || String(custErr.message || '').includes('No such customer')) {
            customerId = null;
          } else {
            throw custErr;
          }
        }
      }

      if (!customerId) {
        const customer = await stripeRequest('POST', 'customers', {
          ...(providedEmail ? { email: providedEmail } : {}),
          ...(name ? { name } : {}),
          ...(addressLine1 || postalCode
            ? { address: { line1: addressLine1 || undefined, postal_code: postalCode || undefined } }
            : {}),
          metadata
        });
        customerId = customer.id;
        acc.stripe_customer_id = customerId;
      }

      const isAnnual = plan === 'annual';
      const isSixMonth = plan === 'six_month';
      const productId = await getStripeProductId();
      const unitAmount = isAnnual
        ? localizedPricing.annualAmount
        : isSixMonth
        ? localizedPricing.sixMonthAmount
        : localizedPricing.monthlyAmount;

      const recurringConfig = isAnnual
        ? { interval: 'year' }
        : isSixMonth
        ? { interval: 'month', interval_count: 6 }
        : { interval: 'month' };

      const subItems = [
        {
          price_data: {
            currency: localizedPricing.currency,
            product: productId,
            unit_amount: unitAmount,
            recurring: recurringConfig
          }
        }
      ];

      if (includeWifiRadar) {
        const radarProductId = await getStripeWifiRadarProductId();
        const addonUnitAmount = isAnnual
          ? localizedPricing.wifiRadarAnnualAmount
          : isSixMonth
          ? localizedPricing.wifiRadarSixMonthAmount
          : localizedPricing.wifiRadarMonthlyAmount;
        subItems.push({
          price_data: {
            currency: localizedPricing.currency,
            product: radarProductId,
            unit_amount: addonUnitAmount,
            recurring: recurringConfig
          }
        });
      }

      const canUseIntroCoupon =
        !isAnnual &&
        !isSixMonth &&
        eligibleForIntroDiscount &&
        !(customerId && claimedIntroCustomerIds.has(customerId));
      const introCouponId = canUseIntroCoupon
        ? await getOrCreateIntroCoupon(localizedPricing.currency, localizedPricing.introSavingsAmount)
        : '';

      if (body.hostedCheckout) {
        const hostOrigin = resolveTrustedOrigin(req);
        const sessionParams = {
          mode: 'subscription',
          customer: customerId,
          managed_payments: { enabled: false },
          line_items: subItems.map((it) => ({
            price_data: it.price_data,
            quantity: 1
          })),
          ...(introCouponId ? { discounts: [{ coupon: introCouponId }] } : {}),
          subscription_data: {
            metadata: {
              ...metadata,
              intro_offer_applied: introCouponId ? 'true' : 'false'
            }
          },
          metadata: {
            ...metadata,
            intro_offer_applied: introCouponId ? 'true' : 'false'
          },
          success_url: `${hostOrigin}/checkout/success?web=1&session_id={CHECKOUT_SESSION_ID}&account_id=${encodeURIComponent(acc.id)}`,
          cancel_url: `${hostOrigin}/order?error=payment_cancelled`
        };
        const checkoutSession = await stripeRequest('POST', 'checkout/sessions', sessionParams);
        if (checkoutSession?.url) {
          return sendJson(
            res,
            200,
            {
              redirectUrl: checkoutSession.url,
              sessionId: checkoutSession.id,
              accountId: acc.id,
              plan
            },
            {},
            req
          );
        }
      }

      const subParams = {
        customer: customerId,
        items: subItems,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
          payment_method_types: isRedirectMethod ? [paymentMethod] : ['card']
        },
        ...(introCouponId ? { discounts: [{ coupon: introCouponId }] } : {}),
        metadata: {
          ...metadata,
          intro_offer_applied: introCouponId ? 'true' : 'false'
        },
        expand: ['latest_invoice.payment_intent']
      };

      let subscription = null;
      try {
        subscription = await stripeRequest('POST', 'subscriptions', subParams);
      } catch (subErr) {
        if (isRedirectMethod) {
          const hostOrigin = resolveTrustedOrigin(req);
          // Tier 2: Direct Redirect PaymentIntent
          try {
            const baseAmount = canUseIntroCoupon ? localizedPricing.introFirstMonthAmount : unitAmount;
            const addonAmount = includeWifiRadar
              ? isAnnual
                ? localizedPricing.wifiRadarAnnualAmount
                : isSixMonth
                ? localizedPricing.wifiRadarSixMonthAmount
                : localizedPricing.wifiRadarMonthlyAmount
              : 0;
            const directPayPalAmount = baseAmount + addonAmount;
            const directReturnUrl = `${hostOrigin}/checkout/success?web=1&account_id=${encodeURIComponent(acc.id)}${isPopup ? '&popup=1' : ''}`;
            const directPi = await stripeRequest('POST', 'payment_intents', {
              amount: directPayPalAmount,
              currency: localizedPricing.currency,
              customer: customerId,
              payment_method_types: [paymentMethod],
              confirm: true,
              payment_method_data: {
                type: paymentMethod,
                ...(providedEmail || name
                  ? {
                      billing_details: {
                        ...(providedEmail ? { email: providedEmail } : {}),
                        ...(name ? { name } : {})
                      }
                    }
                  : {})
              },
              description: `SWEEPR VPN Pro (${isAnnual ? 'Annual' : isSixMonth ? '6-Month' : 'Monthly'})`,
              metadata: {
                ...metadata,
                intro_offer_applied: introCouponId ? 'true' : 'false'
              },
              return_url: directReturnUrl
            });
            const directRedirectUrl = directPi?.next_action?.redirect_to_url?.url || null;
            if (directPi?.id && directRedirectUrl) {
              acc.stripe_subscription_id = directPi.id;
              accountsBySubscriptionId.set(directPi.id, acc);
              return sendJson(
                res,
                200,
                {
                  redirectUrl: directRedirectUrl,
                  subscriptionId: directPi.id,
                  accountId: acc.id,
                  plan,
                  livemode: Boolean(directPi.livemode)
                },
                {},
                req
              );
            }
          } catch {}

          // Tier 3: Stripe Hosted Checkout Session fallback
          const baseSessionParams = {
            mode: 'subscription',
            customer: customerId,
            managed_payments: { enabled: false },
            line_items: subItems.map((it) => ({
              price_data: it.price_data,
              quantity: 1
            })),
            ...(introCouponId ? { discounts: [{ coupon: introCouponId }] } : {}),
            subscription_data: {
              metadata: {
                ...metadata,
                intro_offer_applied: introCouponId ? 'true' : 'false'
              }
            },
            metadata: {
              ...metadata,
              intro_offer_applied: introCouponId ? 'true' : 'false'
            },
            success_url: `${hostOrigin}/checkout/success?web=1&session_id={CHECKOUT_SESSION_ID}&account_id=${encodeURIComponent(acc.id)}${isPopup ? '&popup=1' : ''}`,
            cancel_url: isPopup ? `${hostOrigin}/checkout/cancel?popup=1` : `${hostOrigin}/order?error=payment_cancelled`
          };
          let checkoutSession = null;
          try {
            checkoutSession = await stripeRequest('POST', 'checkout/sessions', {
              ...baseSessionParams,
              payment_method_types: [paymentMethod, 'card']
            });
          } catch {
            checkoutSession = await stripeRequest('POST', 'checkout/sessions', baseSessionParams);
          }
          if (checkoutSession?.url) {
            return sendJson(
              res,
              200,
              {
                redirectUrl: checkoutSession.url,
                subscriptionId: checkoutSession.id,
                accountId: acc.id,
                plan
              },
              {},
              req
            );
          }
        }
        throw subErr;
      }
      acc.stripe_subscription_id = subscription.id;
      accountsBySubscriptionId.set(subscription.id, acc);

      const latestInvoice = subscription.latest_invoice;
      let paymentIntent = latestInvoice?.payment_intent || null;
      if (typeof paymentIntent === 'string') {
        paymentIntent = await stripeRequest('GET', `payment_intents/${encodeURIComponent(paymentIntent)}`);
      }

      if (!paymentIntent?.id) {
        return sendJson(res, 500, { error: 'Could not initialize payment intent.' }, {}, req);
      }

      const hostOrigin = resolveTrustedOrigin(req);
      const returnUrl = `${hostOrigin}/checkout/success?web=1&subscription_id=${encodeURIComponent(subscription.id)}&account_id=${encodeURIComponent(acc.id)}${isPopup ? '&popup=1' : ''}`;

      if (isRedirectMethod) {
        const rawClientIp = getClientIp(req);
        const mandateIp = !rawClientIp || rawClientIp === '::1' ? '127.0.0.1' : rawClientIp;
        const confirmedPi = await stripeRequest('POST', `payment_intents/${encodeURIComponent(paymentIntent.id)}/confirm`, {
          payment_method_data: {
            type: paymentMethod,
            ...(providedEmail || name
              ? {
                  billing_details: {
                    ...(providedEmail ? { email: providedEmail } : {}),
                    ...(name ? { name } : {})
                  }
                }
              : {})
          },
          mandate_data: {
            customer_acceptance: {
              type: 'online',
              online: {
                ip_address: mandateIp,
                user_agent: req.headers['user-agent'] || 'Mozilla/5.0'
              }
            }
          },
          return_url: returnUrl
        });

        const redirectUrl = confirmedPi.next_action?.redirect_to_url?.url || null;
        if (!redirectUrl) {
          return sendJson(res, 500, { error: 'Could not initialize payment authorization redirect.' }, {}, req);
        }

        return sendJson(
          res,
          200,
          {
            redirectUrl,
            subscriptionId: subscription.id,
            accountId: acc.id,
            plan,
            livemode: Boolean(confirmedPi.livemode)
          },
          {},
          req
        );
      }

      // Test-mode server confirmation fallback if confirmOnServer is requested with a sk_test_ key
      if (body.confirmOnServer && paymentIntent.livemode === false) {
        const rawCard = typeof body.cardNumber === 'string' ? body.cardNumber.replace(/\D/g, '') : '';
        const testPm = rawCard.endsWith('0002')
          ? 'pm_card_chargeDeclined'
          : rawCard.startsWith('5')
          ? 'pm_card_mastercard'
          : rawCard.startsWith('3')
          ? 'pm_card_amex'
          : 'pm_card_visa';

        await stripeRequest('POST', `payment_intents/${encodeURIComponent(paymentIntent.id)}/confirm`, {
          payment_method: testPm,
          return_url: returnUrl
        });
        upsertLocalAccount({
          email: acc.email,
          name: acc.name,
          country: acc.country,
          stripeCustomerId: acc.stripe_customer_id,
          subscriptionId: subscription.id,
          plan,
          wifiRadarAddon: includeWifiRadar,
          status: 'active'
        });
        return sendJson(
          res,
          200,
          {
            redirectUrl: `/checkout/success?web=1&subscription_id=${encodeURIComponent(subscription.id)}&account_id=${encodeURIComponent(acc.id)}`,
            subscriptionId: subscription.id,
            accountId: acc.id,
            licenseKey: acc.licenseKey,
            activation_code: acc.activation_code,
            entitlements: acc.entitlements,
            plan
          },
          {},
          req
        );
      }

      const clientSecret = paymentIntent.client_secret || null;
      if (!clientSecret) {
        return sendJson(res, 500, { error: 'Could not initialize payment intent client secret.' }, {}, req);
      }

      return sendJson(
        res,
        200,
        {
          clientSecret,
          subscriptionId: subscription.id,
          accountId: acc.id,
          plan
        },
        {},
        req
      );
    } catch (err) {
      console.error('[create-subscription] Stripe error:', err.message);
      return sendJson(res, 400, { error: err.message || 'Payment initialization failed.' }, {}, req);
    }
  }

  // API 2b: Confirm & Sync On-Page Subscription after Stripe Elements / Google Pay / Apple Pay confirmation
  if (pathname === '/api/confirm-subscription' && req.method === 'POST') {
    if (!checkRateLimit(req, 'confirm_sub', 15, 60000)) {
      return sendJson(res, 429, { error: 'rate_limit_exceeded' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' }, {}, req);
    let subscriptionId = typeof body?.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
    const accountId = typeof body?.accountId === 'string' ? body.accountId.trim() : '';
    const checkOnly = Boolean(body?.checkOnly);
    if (!subscriptionId) return sendJson(res, 400, { error: 'missing_subscription_id' }, {}, req);

    try {
      let checkoutSessionObj = null;
      if (subscriptionId.startsWith('cs_')) {
        checkoutSessionObj = await stripeRequest('GET', `checkout/sessions/${encodeURIComponent(subscriptionId)}`);
        if (!checkoutSessionObj || (!checkoutSessionObj.subscription && !checkoutSessionObj.payment_intent)) {
          return sendJson(
            res,
            checkOnly ? 200 : 402,
            { ok: false, status: checkoutSessionObj?.status || 'open' },
            {},
            req
          );
        }
        const resolvedRef = checkoutSessionObj.subscription || checkoutSessionObj.payment_intent;
        subscriptionId = typeof resolvedRef === 'string' ? resolvedRef : resolvedRef.id;
      }
      const sub = await fetchStripeSubOrPayPalIntent(subscriptionId);

      if (sub.status !== 'active' && sub.status !== 'trialing') {
        return sendJson(
          res,
          checkOnly ? 200 : 402,
          {
            ok: false,
            status: sub.status
          },
          {},
          req
        );
      }

      if (sub.metadata?.account_id && accountId && sub.metadata.account_id !== accountId) {
        return sendJson(res, 403, { ok: false, error: 'account_mismatch' }, {}, req);
      }

      const metaAccountId = sub.metadata?.account_id || accountId;
      const metaEmail = sub.metadata?.email || '';
      const metaPlan = sub.metadata?.plan || 'annual';
      const hasWifiRadar = sub.metadata?.wifi_radar === 'true' || (sub.metadata?.addons || '').includes('wifi_radar');
      const usedIntroOffer =
        sub.metadata?.intro_offer_applied === 'true' ||
        Boolean(sub.discount) ||
        (Array.isArray(sub.discounts) && sub.discounts.length > 0);
      const cardFingerprint =
        sub.default_payment_method?.card?.fingerprint ||
        sub.latest_invoice?.payment_intent?.payment_method?.card?.fingerprint ||
        '';
      const subCustomerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;

      // Enforce 1-per-card / 1-per-canonical-email limit on £1.99 intro offer
      if (usedIntroOffer) {
        if (cardFingerprint && claimedIntroCardFingerprints.has(`${cardFingerprint}:${subCustomerId || ''}`) === false && claimedIntroCardFingerprints.has(cardFingerprint)) {
          await stripeRequest('DELETE', `subscriptions/${encodeURIComponent(sub.id)}`).catch(() => {});
          return sendJson(
            res,
            403,
            {
              ok: false,
              error: 'intro_offer_already_claimed',
              message: 'The £1.99 introductory offer has already been claimed with this payment card.'
            },
            {},
            req
          );
        }
        if (cardFingerprint) {
          recordBoundedSet(claimedIntroCardFingerprints, cardFingerprint);
          recordBoundedSet(claimedIntroCardFingerprints, `${cardFingerprint}:${subCustomerId || ''}`);
        }
        if (subCustomerId) recordBoundedSet(claimedIntroCustomerIds, subCustomerId);
        if (metaEmail) recordBoundedSet(claimedIntroEmails, canonicalizeEmailForAntiAbuse(metaEmail));
      }

      let acc =
        accountsById.get(metaAccountId) ||
        accountsById.get(accountId) ||
        accountsBySubscriptionId.get(subscriptionId) ||
        (metaEmail ? accountsByEmail.get(metaEmail) : null);

      acc = upsertLocalAccount({
        email: acc?.email || metaEmail || 'customer@sweeprvpn.com',
        name: acc?.name,
        country: sub.metadata?.country || acc?.country || 'GB',
        stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
        subscriptionId: sub.id,
        plan: metaPlan,
        wifiRadarAddon: hasWifiRadar,
        status: 'active'
      });

      await syncPayPalCustomerEmail(sub, acc, checkoutSessionObj);

      const totalAmount = (sub.items?.data || []).reduce(
        (sum, it) => sum + (it.price?.unit_amount || 0) * (it.quantity || 1),
        0
      );

      try {
        const refCode = sub.metadata?.ref || acc.ref || extractAffiliateRef(req, urlObj, body);
        if (refCode) acc.ref = refCode;
        const crmSynced = await crm.syncSubscription({
          email: acc.email,
          name: acc.name || undefined,
          country: acc.country || 'GB',
          plan: acc.plan,
          status: 'active',
          amount_cents: totalAmount || 7499,
          currency: sub.currency || 'gbp',
          stripe_customer_id: acc.stripe_customer_id,
          stripe_subscription_id: sub.id,
          activation_code: acc.activation_code,
          license_key: acc.licenseKey,
          addons: acc.wifiRadarAddon ? ['wifi_radar'] : [],
          ref: refCode || undefined,
          notes: `Stripe Live Subscription ${sub.id} (${acc.licenseKey})`
        });
        if (crmSynced && crmSynced.activation_code && /^\d{6}$/.test(crmSynced.activation_code)) {
          licenses.delete(acc.activation_code);
          acc.activation_code = crmSynced.activation_code;
          licenses.set(acc.activation_code, acc);
        }
        if (crmSynced && crmSynced.license_key) {
          licenses.delete(acc.licenseKey);
          acc.licenseKey = crmSynced.license_key;
          licenses.set(acc.licenseKey, acc);
        }
      } catch {}

      crm.reportTelemetryEvent({
        event_name: 'purchase_completed',
        category: 'funnel',
        account_id: acc.id,
        os: 'web',
        properties: { plan: acc.plan, wifiRadarAddon: acc.wifiRadarAddon, licenseKey: acc.licenseKey, subscriptionId: sub.id }
      }).catch(() => {});

      const sessionToken = signSessionCookie(acc.id, acc.email);
      const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
      return sendJson(
        res,
        200,
        {
          ok: true,
          status: sub.status,
          accountId: acc.id,
          licenseKey: acc.licenseKey,
          activation_code: acc.activation_code,
          entitlements: acc.entitlements,
          redirect: `/checkout/success?web=1&subscription_id=${encodeURIComponent(subscriptionId)}&account_id=${encodeURIComponent(acc.id)}`
        },
        {
          'Set-Cookie': `sweepr_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}; Max-Age=${86400 * 30}`
        },
        req
      );
    } catch (err) {
      console.error('[confirm-subscription] error:', err.message);
      return sendJson(res, 400, { error: err.message || 'Verification failed' }, {}, req);
    }
  }

  // API 2c: Live Stripe Webhook Handler (/webhooks/stripe, /api/webhook/stripe, /api/webhooks/stripe)
  if (
    req.method === 'POST' &&
    (pathname === '/webhooks/stripe' || pathname === '/api/webhook/stripe' || pathname === '/api/webhooks/stripe')
  ) {
    if (!STRIPE_WEBHOOK_SECRET) {
      return sendJson(res, 503, { error: 'webhook_secret_not_configured' }, {}, req);
    }
    let rawBody;
    try {
      rawBody = await readRawBody(req, 256 * 1024);
    } catch {
      return sendJson(res, 413, { error: 'payload_too_large' }, {}, req);
    }
    const sig = req.headers['stripe-signature'] || '';
    if (!verifyStripeWebhookSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
      return sendJson(res, 400, { error: 'invalid_signature' }, {}, req);
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return sendJson(res, 400, { error: 'invalid_json' }, {}, req);
    }

    if (event?.id) {
      if (processedStripeWebhookEvents.has(event.id)) {
        return sendJson(res, 200, { received: true, duplicate: true }, {}, req);
      }
      recordBoundedSet(processedStripeWebhookEvents, event.id);
    }

    try {
      const obj = event?.data?.object || {};
      if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted' ||
        event.type === 'checkout.session.completed' ||
        event.type === 'invoice.paid' ||
        event.type === 'invoice.payment_succeeded' ||
        event.type === 'payment_intent.succeeded'
      ) {
        let subObj = obj;
        let sessionObj = null;
        if (event.type === 'checkout.session.completed') {
          sessionObj = obj;
          const refObj = obj.subscription || obj.payment_intent;
          const subId = typeof refObj === 'string' ? refObj : refObj?.id;
          if (subId && STRIPE_SECRET_KEY) {
            subObj = await fetchStripeSubOrPayPalIntent(subId).catch(() => obj);
          }
        } else if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
          const subId = typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id;
          if (subId && STRIPE_SECRET_KEY) {
            subObj = await fetchStripeSubOrPayPalIntent(subId).catch(() => null);
          } else {
            subObj = null;
          }
        } else if (event.type === 'payment_intent.succeeded') {
          if (!obj.invoice && obj.metadata?.project_id === 'vpn' && obj.id && STRIPE_SECRET_KEY) {
            subObj = await fetchStripeSubOrPayPalIntent(obj.id).catch(() => null);
          } else {
            subObj = null;
          }
        }

        if (subObj && subObj.id) {
          const subStatus =
            subObj.status === 'active' || subObj.status === 'trialing' ? 'active' : subObj.status || 'canceled';
          const metaEmail =
            sessionObj?.customer_details?.email ||
            subObj.metadata?.email ||
            sessionObj?.metadata?.email ||
            '';
          const metaPlan = subObj.metadata?.plan || sessionObj?.metadata?.plan || 'annual';
          const hasWifiRadar =
            subObj.metadata?.wifi_radar === 'true' ||
            (subObj.metadata?.addons || '').includes('wifi_radar') ||
            sessionObj?.metadata?.wifi_radar === 'true';
          if (metaEmail || subObj.id) {
            const acc = upsertLocalAccount({
              email: metaEmail || `${subObj.id}@stripe.sweeprvpn.com`,
              name: sessionObj?.customer_details?.name || undefined,
              stripeCustomerId: typeof subObj.customer === 'string' ? subObj.customer : subObj.customer?.id,
              subscriptionId: subObj.id,
              plan: metaPlan,
              wifiRadarAddon: hasWifiRadar,
              status: subStatus
            });
            if (subStatus === 'active') {
              await syncPayPalCustomerEmail(subObj, acc, sessionObj);
            } else {
              revokeLicenceOnAllNodes(acc).catch(() => {});
            }
            crm.syncSubscription({
              email: acc.email,
              name: acc.name || undefined,
              country: subObj.metadata?.country || acc.country || 'GB',
              plan: acc.plan,
              status: subStatus,
              stripe_customer_id: acc.stripe_customer_id,
              stripe_subscription_id: subObj.id,
              activation_code: acc.activation_code,
              license_key: acc.licenseKey,
              addons: acc.wifiRadarAddon ? ['wifi_radar'] : [],
              ref: subObj.metadata?.ref || acc.ref || undefined,
              notes: `Stripe Webhook ${event.type} (${subObj.id})`
            }).catch(() => {});
          }
        }
      } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
        const custId = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
        const chargeEmail = (obj.billing_details?.email || obj.receipt_email || '').trim().toLowerCase();
        const targetAcc =
          (chargeEmail ? accountsByEmail.get(chargeEmail) : null) ||
          Array.from(accountsById.values()).find((a) => custId && a.stripe_customer_id === custId);
        if (targetAcc) {
          targetAcc.status = 'canceled';
          licenses.delete(targetAcc.activation_code);
          licenses.delete(targetAcc.licenseKey);
          revokeLicenceOnAllNodes(targetAcc).catch(() => {});
        }
      }
      // Forward raw webhook to central sweepr-crm if reachable
      fetch(`${SWEEPR_CRM_URL}/api/webhooks/stripe/vpn`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(sig ? { 'stripe-signature': sig } : {})
        },
        body: rawBody
      }).catch(() => {});
    } catch (err) {
      console.error('[webhooks/stripe] handler error:', err.message);
    }

    return sendJson(res, 200, { received: true }, {}, req);
  }

  // Checkout Success & Cancel Pages
  if (req.method === 'GET' && pathname === '/checkout/success') {
    if (!checkRateLimit(req, 'checkout_success', 20, 60000)) {
      res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8', ...COMMON_SECURITY_HEADERS });
      return res.end('Too Many Requests');
    }
    let subscriptionId = (
      urlObj.searchParams.get('subscription_id') ||
      urlObj.searchParams.get('payment_intent') ||
      ''
    ).trim();
    const sessionId = (urlObj.searchParams.get('session_id') || '').trim();
    const accountId = (urlObj.searchParams.get('account_id') || '').trim();
    const redirectStatus = (urlObj.searchParams.get('redirect_status') || '').trim();
    const isPopup = urlObj.searchParams.get('popup') === '1';

    if (redirectStatus === 'failed' || redirectStatus === 'canceled') {
      if (isPopup) {
        return sendHtml(res, 200, renderCheckoutSuccessPage(null, true, true), {
          'X-Robots-Tag': 'noindex, nofollow'
        });
      }
      res.writeHead(302, { Location: '/order?error=payment_cancelled', ...COMMON_SECURITY_HEADERS });
      return res.end();
    }

    // Require verifiable payment proof (session_id or subscription_id)
    if (!subscriptionId && !sessionId) {
      res.writeHead(302, { Location: '/order?error=payment_incomplete', ...COMMON_SECURITY_HEADERS });
      return res.end();
    }

    let checkoutSessionObj = null;
    if (!subscriptionId && sessionId && STRIPE_SECRET_KEY) {
      try {
        checkoutSessionObj = await stripeRequest('GET', `checkout/sessions/${encodeURIComponent(sessionId)}`);
        const resolvedRef = checkoutSessionObj?.subscription || checkoutSessionObj?.payment_intent;
        if (resolvedRef) {
          subscriptionId = typeof resolvedRef === 'string' ? resolvedRef : resolvedRef.id;
        }
      } catch {}
    }

    if (STRIPE_SECRET_KEY && !subscriptionId) {
      res.writeHead(302, { Location: '/order?error=payment_incomplete', ...COMMON_SECURITY_HEADERS });
      return res.end();
    }

    let acc = accountsById.get(accountId) || accountsBySubscriptionId.get(subscriptionId) || null;
    if (subscriptionId && STRIPE_SECRET_KEY) {
      try {
        const sub = await fetchStripeSubOrPayPalIntent(subscriptionId);
        if (sub.status !== 'active' && sub.status !== 'trialing') {
          if (isPopup) {
            return sendHtml(res, 200, renderCheckoutSuccessPage(null, true, true), {
              'X-Robots-Tag': 'noindex, nofollow'
            });
          }
          res.writeHead(302, { Location: '/order?error=payment_cancelled', ...COMMON_SECURITY_HEADERS });
          return res.end();
        }
        if (sub.metadata?.account_id && accountId && sub.metadata.account_id !== accountId) {
          res.writeHead(302, { Location: '/order?error=payment_incomplete', ...COMMON_SECURITY_HEADERS });
          return res.end();
        }
        acc = upsertLocalAccount({
          email: acc?.email || sub.metadata?.email || 'customer@sweeprvpn.com',
          plan: sub.metadata?.plan || acc?.plan || 'annual',
          wifiRadarAddon: sub.metadata?.wifi_radar === 'true' || acc?.wifiRadarAddon,
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
          subscriptionId: sub.id,
          status: 'active'
        });
        await syncPayPalCustomerEmail(sub, acc, checkoutSessionObj);
        try {
          const refCode = sub.metadata?.ref || acc.ref || extractAffiliateRef(req, urlObj, {});
          if (refCode) acc.ref = refCode;
          const crmSynced = await crm.syncSubscription({
            email: acc.email,
            name: acc.name || undefined,
            country: acc.country || 'GB',
            plan: acc.plan,
            status: 'active',
            stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
            stripe_subscription_id: sub.id,
            activation_code: acc.activation_code,
            license_key: acc.licenseKey,
            addons: acc.wifiRadarAddon ? ['wifi_radar'] : [],
            ref: refCode || undefined,
            notes: `Checkout Success Sync (${sub.id})`
          });
          if (crmSynced && crmSynced.activation_code && /^\d{6}$/.test(crmSynced.activation_code)) {
            licenses.delete(acc.activation_code);
            acc.activation_code = crmSynced.activation_code;
            licenses.set(acc.activation_code, acc);
          }
          if (crmSynced && crmSynced.license_key) {
            licenses.delete(acc.licenseKey);
            acc.licenseKey = crmSynced.license_key;
            licenses.set(acc.licenseKey, acc);
          }
        } catch {}
      } catch {
        res.writeHead(302, { Location: '/order?error=payment_incomplete', ...COMMON_SECURITY_HEADERS });
        return res.end();
      }
    }

    if (!acc || acc.status !== 'active' || (accountId && acc.id !== accountId)) {
      res.writeHead(302, { Location: '/order?error=payment_incomplete', ...COMMON_SECURITY_HEADERS });
      return res.end();
    }

    const sessionToken = signSessionCookie(acc.id, acc.email);
    const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
    return sendHtml(res, 200, renderCheckoutSuccessPage(acc, false, isPopup), {
      'X-Robots-Tag': 'noindex, nofollow',
      'Set-Cookie': `sweepr_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}; Max-Age=${86400 * 30}`
    });
  }

  if (req.method === 'GET' && pathname === '/checkout/cancel') {
    const isPopup = urlObj.searchParams.get('popup') === '1';
    return sendHtml(res, 200, renderCheckoutSuccessPage(null, true, isPopup), {
      'X-Robots-Tag': 'noindex, nofollow'
    });
  }

  // VPN Device Licensing (Ed25519 signed tokens for WireGuard/AmneziaWG + Wi-Fi Radar)
  // Authoritatively backed by centralized sweepr_crm (with local cache fallback)
  if ((pathname === '/api/vpn/activate' || pathname === '/v1/license/activate' || pathname === '/v1/license/refresh') && req.method === 'POST') {
    if (!checkRateLimit(req, 'vpn_activate', 20, 60000)) {
      return sendJson(res, 429, { ok: false, valid: false, error: 'rate_limit_exceeded' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);
    const bearerSecret = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const rawCodeInput = String(body.otp || body.activation_code || body.key || body.code || body.license_key || body.refresh_token || bearerSecret || '').trim();
    const extractedKeyMatch = rawCodeInput.toUpperCase().match(/SWEEPR\s*-\s*[A-Z0-9]{2,8}\s*-\s*[A-Z0-9]{4}\s*-\s*[A-Z0-9]{4}\s*-\s*[A-Z0-9]{4}/i);
    const code = pathname === '/v1/license/refresh'
      ? rawCodeInput
      : (extractedKeyMatch ? extractedKeyMatch[0].replace(/\s+/g, '').toUpperCase() : rawCodeInput.replace(/\s+/g, '').toUpperCase());
    const normEmail = body.email ? String(body.email).trim().toLowerCase() : '';
    const preMatchedLocalAcc =
      licenses.get(code) ||
      licenses.get(code.toUpperCase()) ||
      (normEmail ? accountsByEmail.get(normEmail) : null);
    const effectiveEmail = normEmail || (preMatchedLocalAcc && preMatchedLocalAcc.status === 'active' ? preMatchedLocalAcc.email : '');

    if (pathname === '/v1/license/refresh') {
      if (!body.account_id || !body.device_id || (!code && !hasValidCrmServiceKey(req))) {
        return sendJson(res, 401, { ok: false, valid: false, error: 'unauthorized', message: 'Valid refresh_token, account_id, and device_id are required.' }, {}, req);
      }
    } else {
      if (!code || code.length < 6) {
        return sendJson(res, 400, { ok: false, valid: false, error: 'missing_or_invalid_activation_code', message: 'Please enter the license key from your order.' }, {}, req);
      }
      if (/^\d{6}$/.test(code) && !isValidEmail(effectiveEmail) && !hasValidCrmServiceKey(req)) {
        return sendJson(res, 400, { ok: false, valid: false, error: 'email_required_for_short_code', message: 'Please enter your full SWEEPR-VPN-XXXX-XXXX-XXXX license key, or enter your account email address along with your 6-digit code.' }, {}, req);
      }
    }

    let crmRejectReason = null;

    // 1. Query centralized sweepr_crm first (authoritative multi-project license hub)
    try {
      const data = pathname === '/v1/license/refresh'
        ? await crm.refreshLicense({
            accountId: body.account_id,
            refreshToken: code,
            deviceId: body.device_id,
            appVersion: body.app_version
          })
        : await crm.activateDevice({
            email: effectiveEmail || undefined,
            otp: code,
            accountId: body.account_id,
            refreshToken: body.refresh_token,
            deviceId: body.device_id || (effectiveEmail ? `vpn_${crypto.createHash('sha256').update(effectiveEmail).digest('hex').slice(0, 12)}` : `vpn_${Date.now()}`),
            deviceName: body.device_name || 'SWEEPR VPN Desktop',
            os: body.os || 'windows',
            appVersion: body.app_version || '2.5.0'
          });

      if (data && data._httpStatus && data._httpStatus < 500) {
        const syncedAcc = syncLocalCacheFromCrm(data, effectiveEmail, code);
        const { _httpStatus, ...cleanData } = data;
        if (cleanData.valid) {
          const targetAcc = syncedAcc || preMatchedLocalAcc;
          let devReg = null;
          if (targetAcc && (body.device_id || body.device_name)) {
            devReg = registerOrUpdateAccountDevice(targetAcc, {
              deviceId: body.device_id,
              deviceName: body.device_name || 'SWEEPR VPN Device',
              os: body.os || 'windows',
              method: 'license_key'
            });
            if (!devReg.ok && devReg.error === 'device_limit_reached') {
              return sendJson(res, 409, { ok: false, valid: false, ...devReg }, {}, req);
            }
          }
          const fallbackSigned = (!cleanData.token && !cleanData.license_token && targetAcc)
            ? signFallbackEd25519LicenseToken(targetAcc, devReg?.device?.id || body.device_id || 'vpn_desktop')
            : null;
          return sendJson(
            res,
            200,
            {
              ok: true,
              valid: true,
              account_id: cleanData.account_id || targetAcc?.id,
              email: cleanData.email || targetAcc?.email || effectiveEmail,
              licenseKey: cleanData.licenseKey || cleanData.license_key || targetAcc?.licenseKey,
              activation_code: cleanData.activation_code || targetAcc?.activation_code || code,
              plan: cleanData.plan || targetAcc?.plan || 'annual',
              entitlements: cleanData.entitlements || {
                status: cleanData.status || 'active',
                plan: cleanData.plan || 'annual',
                addons: cleanData.addons || []
              },
              status: cleanData.status || 'active',
              device: devReg?.device || undefined,
              devices: Array.isArray(targetAcc?.devices) ? targetAcc.devices : [],
              devices_used: Array.isArray(targetAcc?.devices) ? targetAcc.devices.length : 1,
              device_count: Array.isArray(targetAcc?.devices) ? targetAcc.devices.length : 1,
              max_devices: MAX_DEVICES_PER_ACCOUNT,
              device_limit: MAX_DEVICES_PER_ACCOUNT,
              token: cleanData.token || fallbackSigned?.token,
              license_token: cleanData.license_token || cleanData.token || fallbackSigned?.token,
              expires_at: cleanData.expires_at || fallbackSigned?.expires_at
            },
            {},
            req
          );
        }
        crmRejectReason = cleanData;
      }
    } catch {}

    // 1b. If activateDevice did not match (e.g. full license key without email), also check crm.verifyKey
    if (pathname !== '/v1/license/refresh') {
      try {
        const vData = await crm.verifyKey(code, effectiveEmail || undefined);
        if (vData && vData.valid) {
          const syncedAcc = syncLocalCacheFromCrm(vData, effectiveEmail || vData.email || '', code) || preMatchedLocalAcc;
          let devReg = null;
          if (syncedAcc && (body.device_id || body.device_name)) {
            devReg = registerOrUpdateAccountDevice(syncedAcc, {
              deviceId: body.device_id,
              deviceName: body.device_name || 'SWEEPR VPN Device',
              os: body.os || 'windows',
              method: 'license_key'
            });
            if (!devReg.ok && devReg.error === 'device_limit_reached') {
              return sendJson(res, 409, { ok: false, valid: false, ...devReg }, {}, req);
            }
          }
          const signed = syncedAcc ? signFallbackEd25519LicenseToken(syncedAcc, devReg?.device?.id || body.device_id || 'vpn_desktop') : null;
          return sendJson(
            res,
            200,
            {
              ok: true,
              valid: true,
              account_id: vData.account_id || syncedAcc?.id,
              email: vData.email || syncedAcc?.email || effectiveEmail,
              licenseKey: vData.licenseKey || vData.license_key || syncedAcc?.licenseKey || code,
              activation_code: vData.activation_code || syncedAcc?.activation_code || code,
              plan: vData.plan || syncedAcc?.plan || 'annual',
              entitlements: vData.entitlements || syncedAcc?.entitlements || {
                status: vData.status || 'active',
                plan: vData.plan || 'annual',
                addons: vData.addons || ['wifi_radar']
              },
              status: vData.status || 'active',
              device: devReg?.device || undefined,
              devices: Array.isArray(syncedAcc?.devices) ? syncedAcc.devices : [],
              devices_used: Array.isArray(syncedAcc?.devices) ? syncedAcc.devices.length : 1,
              device_count: Array.isArray(syncedAcc?.devices) ? syncedAcc.devices.length : 1,
              max_devices: MAX_DEVICES_PER_ACCOUNT,
              device_limit: MAX_DEVICES_PER_ACCOUNT,
              ...(signed ? { token: signed.token, license_token: signed.token, expires_at: signed.expires_at } : {})
            },
            {},
            req
          );
        }
      } catch {}
    }

    // 2. Check local in-memory cache (includes Founder account + Stripe/Resend-Key accounts)
    const localAcc =
      licenses.get(code) ||
      licenses.get(code.toUpperCase()) ||
      preMatchedLocalAcc ||
      (effectiveEmail ? accountsByEmail.get(effectiveEmail) : null);

    if (localAcc) {
      const codeMatches =
        safeCompareStrings(code, localAcc.activation_code) ||
        safeCompareStrings(code.toUpperCase(), localAcc.licenseKey) ||
        licenses.get(code) === localAcc ||
        licenses.get(code.toUpperCase()) === localAcc;
      const emailMatches = !normEmail || localAcc.email === normEmail || licenses.get(code) === localAcc || licenses.get(code.toUpperCase()) === localAcc;
      if (localAcc.status === 'active' && codeMatches && emailMatches) {
        let devReg = null;
        if (body.device_id || body.device_name) {
          devReg = registerOrUpdateAccountDevice(localAcc, {
            deviceId: body.device_id,
            deviceName: body.device_name || 'SWEEPR VPN Device',
            os: body.os || 'windows',
            method: 'license_key'
          });
          if (!devReg.ok && devReg.error === 'device_limit_reached') {
            return sendJson(res, 409, { ok: false, valid: false, ...devReg }, {}, req);
          }
        }
        const signed = signFallbackEd25519LicenseToken(localAcc, devReg?.device?.id || body.device_id || 'vpn_desktop');
        return sendJson(
          res,
          200,
          {
            ok: true,
            valid: true,
            account_id: localAcc.id,
            email: localAcc.email,
            licenseKey: localAcc.licenseKey,
            activation_code: localAcc.activation_code,
            plan: localAcc.plan,
            entitlements: localAcc.entitlements,
            status: localAcc.status,
            device: devReg?.device || undefined,
            devices: Array.isArray(localAcc.devices) ? localAcc.devices : [],
            devices_used: Array.isArray(localAcc.devices) ? localAcc.devices.length : 1,
            device_count: Array.isArray(localAcc.devices) ? localAcc.devices.length : 1,
            max_devices: MAX_DEVICES_PER_ACCOUNT,
            device_limit: MAX_DEVICES_PER_ACCOUNT,
            ...(signed ? { token: signed.token, license_token: signed.token, expires_at: signed.expires_at } : {})
          },
          {},
          req
        );
      }
    }

    return sendJson(
      res,
      401,
      {
        ok: false,
        valid: false,
        error: crmRejectReason?.error || 'invalid_activation_code',
        message: crmRejectReason?.message || 'No active paid subscription found for that license key.'
      },
      {},
      req
    );
  }

  // ==========================================================================
  // QR-Code Account & Device Linking (Flow A: Portal/Desktop -> Phone, Flow B: Phone -> Unactivated Desktop)
  // ==========================================================================
  if (pathname === '/api/vpn/pair/create' && req.method === 'POST') {
    if (!checkRateLimit(req, 'vpn_pair_create', 20, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded', message: 'Too many requests. Please wait a minute.' }, {}, req);
    }
    pruneExpiredPairingEntries();
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);

    let acc = null;
    const sess = verifySessionCookie(req);
    if (sess) {
      acc = accountsById.get(sess.accountId) || (sess.email ? accountsByEmail.get(sess.email) : null);
    }
    if (!acc) {
      const bearerKey = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      const rawKey = String(body?.key || body?.code || body?.license_key || body?.activation_code || bearerKey || '').trim();
      const normEmail = body?.email ? String(body.email).trim().toLowerCase() : '';
      if (rawKey) {
        const resolved = await resolveVpnLicence(rawKey, normEmail, body?.device_id);
        const cleanKey = rawKey.replace(/\s+/g, '').toUpperCase();
        acc =
          resolved?.account ||
          licenses.get(cleanKey) ||
          licenses.get(rawKey) ||
          (normEmail ? accountsByEmail.get(normEmail) : null) ||
          null;
      }
    }

    if (!acc || acc.status !== 'active') {
      return sendJson(res, 401, { ok: false, error: 'unauthorized', message: 'Please enter a valid SWEEPR VPN license key or log in to your Customer Portal to generate a pairing QR code.' }, {}, req);
    }
    if (!Array.isArray(acc.devices)) acc.devices = [];
    if (acc.devices.length >= MAX_DEVICES_PER_ACCOUNT) {
      return sendJson(
        res,
        409,
        {
          ok: false,
          error: 'device_limit_reached',
          message: `All ${MAX_DEVICES_PER_ACCOUNT} device slots are currently in use. Please remove an existing device first to link a new one.`,
          devices: acc.devices,
          devices_used: acc.devices.length,
          device_count: acc.devices.length,
          max_devices: MAX_DEVICES_PER_ACCOUNT,
          device_limit: MAX_DEVICES_PER_ACCOUNT
        },
        {},
        req
      );
    }

    const token = `ptk_${crypto.randomBytes(18).toString('base64url')}`;
    const expiresAt = Date.now() + PAIRING_TOKEN_TTL_MS;
    const baseOrigin = PUBLIC_URL.includes('localhost') && req.headers.host
      ? `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`
      : PUBLIC_URL;
    const pairUrl = `${baseOrigin}/pair?t=${encodeURIComponent(token)}`;
    const qrSvg = renderWireGuardQrSvg(pairUrl);

    pairingTokens.set(token, {
      token,
      accountId: acc.id,
      email: acc.email,
      source: String(body?.source || (sess ? 'portal' : 'desktop')),
      createdAt: Date.now(),
      expiresAt,
      used: false,
      redeemedDevice: null
    });

    return sendJson(
      res,
      200,
      {
        ok: true,
        token,
        pair_token: token,
        pair_url: pairUrl,
        qr_svg: qrSvg,
        expires_in: Math.round(PAIRING_TOKEN_TTL_MS / 1000),
        expires_at: expiresAt,
        devices: acc.devices,
        devices_used: acc.devices.length,
        device_count: acc.devices.length,
        max_devices: MAX_DEVICES_PER_ACCOUNT,
        device_limit: MAX_DEVICES_PER_ACCOUNT
      },
      { 'Cache-Control': 'no-store' },
      req
    );
  }

  if (pathname === '/api/vpn/pair/check' && req.method === 'GET') {
    pruneExpiredPairingEntries();
    const token = String(urlObj.searchParams.get('t') || urlObj.searchParams.get('token') || '').trim();
    const entry = token ? pairingTokens.get(token) : null;
    if (!entry) {
      return sendJson(res, 200, { ok: true, status: 'expired' }, { 'Cache-Control': 'no-store' }, req);
    }
    const acc = accountsById.get(entry.accountId) || accountsByEmail.get(entry.email);
    if (entry.used && entry.redeemedDevice) {
      return sendJson(
        res,
        200,
        {
          ok: true,
          status: 'redeemed',
          device: entry.redeemedDevice,
          linked_device: entry.redeemedDevice,
          devices: Array.isArray(acc?.devices) ? acc.devices : [],
          devices_used: Array.isArray(acc?.devices) ? acc.devices.length : 1,
          device_count: Array.isArray(acc?.devices) ? acc.devices.length : 1,
          max_devices: MAX_DEVICES_PER_ACCOUNT,
          device_limit: MAX_DEVICES_PER_ACCOUNT
        },
        { 'Cache-Control': 'no-store' },
        req
      );
    }
    if (Date.now() > entry.expiresAt) {
      return sendJson(res, 200, { ok: true, status: 'expired' }, { 'Cache-Control': 'no-store' }, req);
    }
    return sendJson(
      res,
      200,
      {
        ok: true,
        status: 'pending',
        expires_in: Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000)),
        devices_used: Array.isArray(acc?.devices) ? acc.devices.length : 0,
        device_count: Array.isArray(acc?.devices) ? acc.devices.length : 0,
        max_devices: MAX_DEVICES_PER_ACCOUNT,
        device_limit: MAX_DEVICES_PER_ACCOUNT
      },
      { 'Cache-Control': 'no-store' },
      req
    );
  }

  if (pathname === '/api/vpn/pair/redeem' && req.method === 'POST') {
    if (!checkRateLimit(req, 'vpn_pair_redeem', 15, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded', message: 'Too many attempts. Please wait a minute.' }, {}, req);
    }
    pruneExpiredPairingEntries();
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);
    const token = String(body?.pair_token || body?.token || body?.t || '').trim();
    const entry = token ? pairingTokens.get(token) : null;
    if (!entry || entry.used || Date.now() > entry.expiresAt) {
      return sendJson(
        res,
        401,
        {
          ok: false,
          valid: false,
          error: 'invalid_or_expired_pair_token',
          message: 'This QR code has expired or has already been used. Please generate a fresh QR code.'
        },
        {},
        req
      );
    }

    const acc = accountsById.get(entry.accountId) || accountsByEmail.get(entry.email);
    if (!acc || acc.status !== 'active') {
      return sendJson(res, 403, { ok: false, valid: false, error: 'subscription_inactive', message: 'Subscription is no longer active.' }, {}, req);
    }

    const reg = registerOrUpdateAccountDevice(acc, {
      deviceId: body?.device_id,
      deviceName: body?.device_name,
      os: body?.os || 'ios',
      method: entry.source === 'desktop' ? 'qr_desktop' : 'qr_portal'
    });
    if (!reg.ok) {
      return sendJson(res, 409, { ok: false, valid: false, ...reg }, {}, req);
    }

    entry.used = true;
    entry.redeemedDevice = reg.device;
    const signed = signFallbackEd25519LicenseToken(acc, reg.device.id);

    return sendJson(
      res,
      200,
      {
        ok: true,
        valid: true,
        account_id: acc.id,
        email: acc.email,
        licenseKey: acc.licenseKey,
        license_key: acc.licenseKey,
        activation_code: acc.activation_code,
        plan: acc.plan,
        entitlements: acc.entitlements,
        status: acc.status,
        device: reg.device,
        devices: acc.devices,
        devices_used: acc.devices.length,
        device_count: acc.devices.length,
        max_devices: MAX_DEVICES_PER_ACCOUNT,
        device_limit: MAX_DEVICES_PER_ACCOUNT,
        ...(signed ? { token: signed.token, license_token: signed.token, expires_at: signed.expires_at } : {})
      },
      { 'Cache-Control': 'no-store' },
      req
    );
  }

  // Flow B: Unactivated Desktop/TV App creates a Reverse-QR challenge to be scanned by Phone
  if (pathname === '/api/vpn/pair/challenge' && req.method === 'POST') {
    if (!checkRateLimit(req, 'vpn_pair_challenge', 15, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' }, {}, req);
    }
    pruneExpiredPairingEntries();
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);

    const challengeId = `chk_${crypto.randomBytes(16).toString('base64url')}`;
    const pollSecret = `psec_${crypto.randomBytes(24).toString('base64url')}`;
    const deviceId = String(body?.device_id || `dev_vpn_${crypto.randomBytes(6).toString('hex')}`).trim().slice(0, 64);
    const os = String(body?.os || 'windows').trim().toLowerCase().slice(0, 24);
    const deviceName = String(body?.device_name || 'SWEEPR VPN Desktop').trim().slice(0, 60);
    const expiresAt = Date.now() + PAIRING_TOKEN_TTL_MS;

    const baseOrigin = PUBLIC_URL.includes('localhost') && req.headers.host
      ? `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`
      : PUBLIC_URL;
    const pairUrl = `${baseOrigin}/pair?c=${encodeURIComponent(challengeId)}`;
    const qrSvg = renderWireGuardQrSvg(pairUrl);

    pairingChallenges.set(challengeId, {
      challengeId,
      pollSecret,
      deviceId,
      deviceName,
      os,
      status: 'pending',
      createdAt: Date.now(),
      expiresAt,
      approvedPayload: null
    });

    return sendJson(
      res,
      200,
      {
        ok: true,
        challenge_id: challengeId,
        poll_secret: pollSecret,
        pair_url: pairUrl,
        qr_svg: qrSvg,
        expires_in: Math.round(PAIRING_TOKEN_TTL_MS / 1000),
        expires_at: expiresAt
      },
      { 'Cache-Control': 'no-store' },
      req
    );
  }

  if (pathname === '/api/vpn/pair/status' && req.method === 'GET') {
    pruneExpiredPairingEntries();
    const challengeId = String(urlObj.searchParams.get('c') || urlObj.searchParams.get('challenge_id') || '').trim();
    const pollSecret = String(urlObj.searchParams.get('s') || urlObj.searchParams.get('poll_secret') || '').trim();
    const ch = challengeId ? pairingChallenges.get(challengeId) : null;
    if (!ch) {
      return sendJson(res, 404, { ok: false, status: 'expired', error: 'challenge_not_found_or_expired' }, { 'Cache-Control': 'no-store' }, req);
    }
    if (!pollSecret || !safeCompareStrings(pollSecret, ch.pollSecret)) {
      return sendJson(res, 401, { ok: false, error: 'invalid_poll_secret' }, { 'Cache-Control': 'no-store' }, req);
    }
    if (ch.status === 'approved' && ch.approvedPayload) {
      const payload = ch.approvedPayload;
      ch.approvedPayload = null;
      pairingChallenges.delete(challengeId);
      return sendJson(res, 200, { ok: true, ...payload, status: 'approved' }, { 'Cache-Control': 'no-store' }, req);
    }
    if (Date.now() > ch.expiresAt) {
      pairingChallenges.delete(challengeId);
      return sendJson(res, 200, { ok: true, status: 'expired' }, { 'Cache-Control': 'no-store' }, req);
    }
    return sendJson(
      res,
      200,
      {
        ok: true,
        status: 'pending',
        expires_in: Math.max(0, Math.ceil((ch.expiresAt - Date.now()) / 1000))
      },
      { 'Cache-Control': 'no-store' },
      req
    );
  }

  if (pathname === '/api/vpn/pair/approve' && req.method === 'POST') {
    if (!checkRateLimit(req, 'vpn_pair_approve', 15, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded', message: 'Too many attempts. Please wait a minute.' }, {}, req);
    }
    pruneExpiredPairingEntries();
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);

    const challengeId = String(body?.challenge_id || body?.c || '').trim();
    const ch = challengeId ? pairingChallenges.get(challengeId) : null;
    if (!ch || ch.status !== 'pending' || Date.now() > ch.expiresAt) {
      return sendJson(res, 400, { ok: false, error: 'challenge_expired', message: 'This desktop QR code has expired. Click "Refresh QR" on your desktop app.' }, {}, req);
    }

    let acc = null;
    const sess = verifySessionCookie(req);
    if (sess) {
      acc = accountsById.get(sess.accountId) || (sess.email ? accountsByEmail.get(sess.email) : null);
    }
    if (!acc) {
      const bearerKey = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      const rawKey = String(body?.key || body?.code || body?.license_key || body?.activation_code || bearerKey || '').trim();
      const normEmail = body?.email ? String(body.email).trim().toLowerCase() : '';
      if (rawKey) {
        const resolved = await resolveVpnLicence(rawKey, normEmail, body?.device_id);
        const cleanKey = rawKey.replace(/\s+/g, '').toUpperCase();
        acc =
          resolved?.account ||
          licenses.get(cleanKey) ||
          licenses.get(rawKey) ||
          (normEmail ? accountsByEmail.get(normEmail) : null) ||
          null;
      }
    }

    if (!acc || acc.status !== 'active') {
      return sendJson(
        res,
        401,
        {
          ok: false,
          error: 'auth_required',
          message: 'Please enter your SWEEPR VPN license key (or log into your Customer Portal) to approve this device.'
        },
        {},
        req
      );
    }

    const reg = registerOrUpdateAccountDevice(acc, {
      deviceId: ch.deviceId,
      deviceName: ch.deviceName,
      os: ch.os,
      method: 'qr_desktop'
    });
    if (!reg.ok) {
      return sendJson(res, 409, { ok: false, ...reg }, {}, req);
    }

    const signed = signFallbackEd25519LicenseToken(acc, reg.device.id);
    ch.status = 'approved';
    ch.approvedPayload = {
      valid: true,
      account_id: acc.id,
      email: acc.email,
      licenseKey: acc.licenseKey,
      license_key: acc.licenseKey,
      activation_code: acc.activation_code,
      plan: acc.plan,
      entitlements: acc.entitlements,
      subscription_status: acc.status,
      device: reg.device,
      devices: acc.devices,
      devices_used: acc.devices.length,
      device_count: acc.devices.length,
      max_devices: MAX_DEVICES_PER_ACCOUNT,
      device_limit: MAX_DEVICES_PER_ACCOUNT,
      ...(signed ? { token: signed.token, license_token: signed.token, expires_at: signed.expires_at } : {})
    };

    return sendJson(
      res,
      200,
      {
        ok: true,
        approved: true,
        status: 'approved',
        device: reg.device,
        devices: acc.devices,
        devices_used: acc.devices.length,
        device_count: acc.devices.length,
        max_devices: MAX_DEVICES_PER_ACCOUNT,
        device_limit: MAX_DEVICES_PER_ACCOUNT
      },
      { 'Cache-Control': 'no-store' },
      req
    );
  }

  // Self-Service Device Unlinking & Targeted WireGuard Peer Revocation
  if ((pathname === '/api/portal/revoke-device' || pathname === '/api/vpn/devices/revoke') && req.method === 'POST') {
    if (!checkRateLimit(req, 'revoke_device', 20, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);

    let acc = null;
    const sess = verifySessionCookie(req);
    if (sess) {
      acc = accountsById.get(sess.accountId) || (sess.email ? accountsByEmail.get(sess.email) : null);
    }
    if (!acc) {
      const bearerKey = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      const rawKey = String(body?.key || body?.code || body?.license_key || body?.activation_code || bearerKey || '').trim();
      const normEmail = body?.email ? String(body.email).trim().toLowerCase() : '';
      if (rawKey) {
        const resolved = await resolveVpnLicence(rawKey, normEmail, body?.device_id);
        const cleanKey = rawKey.replace(/\s+/g, '').toUpperCase();
        acc =
          resolved?.account ||
          licenses.get(cleanKey) ||
          licenses.get(rawKey) ||
          (normEmail ? accountsByEmail.get(normEmail) : null) ||
          null;
      }
    }
    if (!acc) {
      return sendJson(res, 401, { ok: false, error: 'unauthorized', message: 'Please sign in to manage linked devices.' }, {}, req);
    }
    if (!Array.isArray(acc.devices)) acc.devices = [];

    const targetDeviceId = String(body?.device_id || '').trim();
    if (!targetDeviceId) {
      return sendJson(res, 400, { ok: false, error: 'missing_device_id' }, {}, req);
    }

    const idx = acc.devices.findIndex((d) => d && d.id === targetDeviceId);
    if (idx === -1) {
      return sendJson(res, 404, { ok: false, error: 'device_not_found', devices: acc.devices, devices_used: acc.devices.length, device_count: acc.devices.length, max_devices: MAX_DEVICES_PER_ACCOUNT, device_limit: MAX_DEVICES_PER_ACCOUNT }, {}, req);
    }

    const [removed] = acc.devices.splice(idx, 1);
    if (!acc.revokedDeviceIds || !(acc.revokedDeviceIds instanceof Set)) {
      acc.revokedDeviceIds = new Set();
    }
    acc.revokedDeviceIds.add(targetDeviceId);

    if (removed && removed.wg_licence_hash) {
      revokeLicenceOnAllNodes(removed.wg_licence_hash).catch(() => {});
    }

    return sendJson(
      res,
      200,
      {
        ok: true,
        revoked_device_id: targetDeviceId,
        revoked_device_name: removed?.name || targetDeviceId,
        devices: acc.devices,
        devices_used: acc.devices.length,
        device_count: acc.devices.length,
        max_devices: MAX_DEVICES_PER_ACCOUNT,
        device_limit: MAX_DEVICES_PER_ACCOUNT
      },
      { 'Cache-Control': 'no-store' },
      req
    );
  }

  // Mobile-First Universal QR Pairing Landing Page (/pair?t=... or /pair?c=...)
  if (pathname === '/pair' && req.method === 'GET') {
    pruneExpiredPairingEntries();
    const t = String(urlObj.searchParams.get('t') || '').trim();
    const c = String(urlObj.searchParams.get('c') || '').trim();
    const sess = verifySessionCookie(req);
    const sessAcc = sess ? (accountsById.get(sess.accountId) || (sess.email ? accountsByEmail.get(sess.email) : null)) : null;
    const ch = c ? pairingChallenges.get(c) : null;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Device | SWEEPR VPN</title>
  <meta name="robots" content="noindex, nofollow">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 16px 40px -12px rgba(15,23,42,.08);max-width:440px;width:100%;padding:28px 24px;display:flex;flex-direction:column;gap:16px}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:800;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0;align-self:flex-start}
    h1{font-size:21px;font-weight:900;letter-spacing:-.02em}
    p{font-size:14px;color:#475569;line-height:1.5}
    .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px}
    .input{width:100%;padding:11px 14px;border:1px solid #cbd5e1;border-radius:12px;font-size:14px;font-family:monospace;font-weight:700}
    .btn{width:100%;padding:13px 16px;border-radius:12px;border:none;font-size:14px;font-weight:800;cursor:pointer;text-align:center;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:8px}
    .btn-go{background:linear-gradient(135deg,#059669,#10b981);color:#fff;box-shadow:0 6px 18px -4px rgba(5,150,105,.4)}
    .btn-soft{background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0}
    .err{color:#dc2626;font-size:13px;font-weight:700;display:none}
    .ok{color:#059669;font-size:13.5px;font-weight:800}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🔒 SWEEPR VPN Device Pairing</div>
    <div id="pairBody">
      ${t ? `
        <h1>Linking This Device…</h1>
        <p style="margin-top:6px">Verifying your one-time QR pairing token and reserving a device slot (up to ${MAX_DEVICES_PER_ACCOUNT} devices — desktop or mobile).</p>
      ` : c ? `
        <h1>Approve Desktop Device</h1>
        <p style="margin-top:6px">Confirm linking <strong>${escapeHtml(ch ? ch.deviceName : 'SWEEPR VPN Desktop')}</strong> to your SWEEPR VPN Pro subscription.</p>
        ${sessAcc ? `<div class="box" style="margin-top:12px"><div style="font-size:12px;color:#64748b;font-weight:700">SIGNED IN AS</div><div style="font-size:14px;font-weight:800">${escapeHtml(sessAcc.email)} (${(sessAcc.devices || []).length} / ${MAX_DEVICES_PER_ACCOUNT} devices used)</div></div>` : `
        <div class="box" style="margin-top:12px">
          <label style="font-size:12px;font-weight:800;color:#475569">Your License Key or 6-Digit Code</label>
          <input id="approveKey" class="input" placeholder="SWEEPR-VPN-XXXX-XXXX-XXXX" />
          <input id="approveEmail" class="input" type="email" placeholder="Account email (if using 6-digit code)" style="font-family:sans-serif;font-weight:600" />
        </div>`}
        <div id="pairErr" class="err" style="margin-top:10px"></div>
        <button class="btn btn-go" style="margin-top:14px" id="approveBtn" onclick="approveDesktop()">Approve &amp; Unlock Desktop</button>
      ` : `
        <h1>Invalid Pairing Link</h1>
        <p style="margin-top:6px">Please scan a fresh QR code from your SWEEPR VPN Customer Portal or Desktop App.</p>
      `}
    </div>
  </div>
  <script>
    const token = ${JSON.stringify(t)};
    const challengeId = ${JSON.stringify(c)};
    const hasSession = ${JSON.stringify(Boolean(sessAcc))};
    function detectOs() {
      const ua = navigator.userAgent || '';
      if (/iPhone|iPad|iPod/i.test(ua)) return { os: 'ios', name: 'iPhone / iPad' };
      if (/Android/i.test(ua)) return { os: 'android', name: 'Android Phone' };
      if (/Mac/i.test(ua)) return { os: 'macos', name: 'Mac' };
      if (/Linux/i.test(ua)) return { os: 'linux', name: 'Linux PC' };
      return { os: 'windows', name: 'Windows PC' };
    }
    function getOrCreateDeviceId() {
      try {
        let id = localStorage.getItem('sweepr_vpn_device_id');
        if (!id) {
          id = 'dev_vpn_' + Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-4);
          localStorage.setItem('sweepr_vpn_device_id', id);
        }
        return id;
      } catch (e) {
        return 'dev_vpn_' + Date.now().toString(16);
      }
    }
    async function redeemFlowA() {
      const info = detectOs();
      const devId = getOrCreateDeviceId();
      try {
        const r = await fetch('/api/vpn/pair/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, device_id: devId, device_name: info.name, os: info.os })
        });
        const d = await r.json();
        if (!r.ok || !d.ok) {
          document.getElementById('pairBody').innerHTML = '<h1>Could Not Link Device</h1><p style="margin-top:8px;color:#dc2626;font-weight:700">' + (d.message || 'This QR code has expired.') + '</p><a href="/dashboard" class="btn btn-soft" style="margin-top:14px">Open Customer Portal</a>';
          return;
        }
        try {
          if (d.email) localStorage.setItem('sweepr_vpn_email', d.email);
          if (d.licenseKey) {
            localStorage.setItem('sweepr_vpn_code', d.licenseKey);
            localStorage.setItem('sweepr_vpn_license_key', d.licenseKey);
          }
        } catch (e) {}
        const deepLink = 'sweeprvpn://activate?key=' + encodeURIComponent(d.licenseKey || '') + '&device_id=' + encodeURIComponent(devId);
        const mobileConfigUrl = '/api/vpn/apple-mobileconfig?key=' + encodeURIComponent(d.licenseKey || '') + '&server_code=UK-LON-01';
        document.getElementById('pairBody').innerHTML =
          '<h1>✓ Account Activated on This Device!</h1>' +
          '<p style="margin-top:6px">This ' + info.name + ' is now linked to <strong>' + (d.email || 'your account') + '</strong> (Slot ' + d.devices_used + ' of ' + d.max_devices + ').</p>' +
          '<div class="box" style="margin-top:12px"><div style="font-size:11px;font-weight:800;color:#64748b">ACTIVE LICENSE KEY</div><div style="font-family:monospace;font-weight:800;font-size:14px">' + (d.licenseKey || '') + '</div></div>' +
          '<a href="' + deepLink + '" class="btn btn-go" style="margin-top:14px">Open in SWEEPR VPN App</a>' +
          '<a href="/download" class="btn btn-soft" style="margin-top:8px">Download SWEEPR VPN App</a>';
      } catch (e) {
        document.getElementById('pairBody').innerHTML = '<h1>Connection Error</h1><p style="margin-top:8px">Please check your internet connection and scan the QR code again.</p>';
      }
    }
    async function approveDesktop() {
      const btn = document.getElementById('approveBtn');
      const err = document.getElementById('pairErr');
      err.style.display = 'none';
      let key = '';
      let email = '';
      if (!hasSession) {
        key = (document.getElementById('approveKey')?.value || localStorage.getItem('sweepr_vpn_license_key') || localStorage.getItem('sweepr_vpn_code') || '').trim();
        email = (document.getElementById('approveEmail')?.value || localStorage.getItem('sweepr_vpn_email') || '').trim();
      }
      btn.disabled = true;
      btn.textContent = 'Approving…';
      try {
        const r = await fetch('/api/vpn/pair/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challenge_id: challengeId, key, email })
        });
        const d = await r.json();
        if (!r.ok || !d.ok) {
          err.textContent = d.message || 'Could not approve device.';
          err.style.display = 'block';
          btn.disabled = false;
          btn.textContent = 'Approve & Unlock Desktop';
          return;
        }
        document.getElementById('pairBody').innerHTML =
          '<h1>✓ Desktop Unlocked!</h1>' +
          '<p style="margin-top:6px">Your desktop app is now linked and unlocked (Slot ' + d.devices_used + ' of ' + d.max_devices + '). You can close this tab.</p>';
      } catch (e) {
        err.textContent = 'Network error. Please try again.';
        err.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Approve & Unlock Desktop';
      }
    }
    if (token) redeemFlowA();
    else if (challengeId && !hasSession) {
      try {
        const savedKey = localStorage.getItem('sweepr_vpn_license_key') || localStorage.getItem('sweepr_vpn_code') || '';
        const savedEmail = localStorage.getItem('sweepr_vpn_email') || '';
        if (savedKey && document.getElementById('approveKey')) document.getElementById('approveKey').value = savedKey;
        if (savedEmail && document.getElementById('approveEmail')) document.getElementById('approveEmail').value = savedEmail;
      } catch (e) {}
    }
  </script>
</body>
</html>`;
    return sendHtml(res, 200, html, { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' });
  }

  // VPN Key Verification (Authoritatively backed by centralized sweepr_crm first)
  if ((pathname === '/api/vpn/verify-key' || pathname === '/api/license-verify') && (req.method === 'GET' || req.method === 'POST')) {
    if (!checkRateLimit(req, 'verify_key', 20, 60000)) {
      return sendJson(res, 429, { valid: false, error: 'rate_limit_exceeded' }, {}, req);
    }
    const body = req.method === 'POST' ? await readJsonBody(req) : {};
    if (body && body.__tooLarge) return sendJson(res, 413, { valid: false, error: 'payload_too_large' }, {}, req);
    const rawKey = String(body.key || urlObj.searchParams.get('key') || '').trim();
    const key = rawKey.replace(/\s+/g, '').toUpperCase();
    const normEmail = String(body.email || urlObj.searchParams.get('email') || '').trim().toLowerCase();
    const localRecord = licenses.get(key) || licenses.get(key.toUpperCase());
    const effectiveEmail = normEmail || (localRecord && localRecord.status === 'active' ? localRecord.email : '');
    const isServiceCall = hasValidCrmServiceKey(req);
    if (!key || key.length < 6) {
      return sendJson(res, 400, { valid: false, error: 'invalid_key' }, {}, req);
    }
    if (!HIGH_ENTROPY_LICENSE_KEY_RE.test(key) && !isValidEmail(effectiveEmail) && !isServiceCall) {
      return sendJson(
        res,
        401,
        {
          valid: false,
          error: 'email_required_for_short_code',
          message: 'Please provide your account email address along with your 6-digit activation code, or enter your full SWEEPR-VPN-XXXX-XXXX-XXXX license key.'
        },
        {},
        req
      );
    }

    try {
      const data = await crm.verifyKey(key, effectiveEmail);
      if (data && data._httpStatus && data._httpStatus < 500 && data.valid) {
        syncLocalCacheFromCrm(data, effectiveEmail || data.email || '', key);
        const { _httpStatus, ...cleanData } = data;
        if (!isServiceCall) {
          delete cleanData.account_id;
          delete cleanData.activation_code;
          if (cleanData.email) cleanData.email = maskEmailAddress(cleanData.email);
        }
        return sendJson(res, 200, cleanData, {}, req);
      }
    } catch {}

    if (localRecord && localRecord.status === 'active' && (!normEmail || localRecord.email === normEmail)) {
      return sendJson(
        res,
        200,
        {
          valid: true,
          ok: true,
          ...(isServiceCall ? { account_id: localRecord.id, activation_code: localRecord.activation_code } : {}),
          email: maskEmailAddress(localRecord.email),
          licenseKey: localRecord.licenseKey,
          plan: localRecord.plan,
          wifiRadarAddon: Boolean(localRecord.wifiRadarAddon),
          entitlements: localRecord.entitlements,
          status: localRecord.status
        },
        {},
        req
      );
    }
    return sendJson(res, 404, { valid: false, error: 'key_not_found' }, {}, req);
  }

  // Service-authenticated VPN Peer Revocation & Key Rotation Endpoint (called by sweepr_crm on refund/cancellation/device revocation/key reset)
  if (pathname === '/api/vpn/revoke' && req.method === 'POST') {
    if (!hasValidCrmServiceKey(req)) {
      return sendJson(res, 401, { ok: false, error: 'unauthorized' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);
    const email = String(body?.email || '').trim().toLowerCase();
    const accountId = String(body?.account_id || '').trim();
    const activationCode = String(body?.activation_code || '').trim();
    const licenseKey = String(body?.license_key || body?.licenseKey || '').trim();
    const newActivationCode = String(body?.new_activation_code || '').trim();
    const newLicenseKey = String(body?.new_license_key || '').trim().toUpperCase();
    const isKeyRotation = Boolean(body?.action === 'key_reset' || newActivationCode || newLicenseKey);

    let localAcc =
      (accountId ? accountsById.get(accountId) : null) ||
      (email ? accountsByEmail.get(email) : null) ||
      (activationCode ? licenses.get(activationCode) : null) ||
      (licenseKey ? licenses.get(licenseKey.toUpperCase()) : null);

    const oldCodeToEvict = activationCode || localAcc?.activation_code || '';
    const oldKeyToEvict = licenseKey || localAcc?.licenseKey || '';
    if (oldCodeToEvict) licenses.delete(oldCodeToEvict);
    if (oldKeyToEvict) {
      licenses.delete(oldKeyToEvict);
      licenses.delete(oldKeyToEvict.toUpperCase());
    }

    if (isKeyRotation) {
      if (!localAcc && email) {
        localAcc = upsertLocalAccount({
          email,
          plan: body?.plan || 'annual',
          status: body?.status || 'active'
        });
      }
      if (localAcc) {
        if (accountId && localAcc.id !== accountId) {
          accountsById.delete(localAcc.id);
          localAcc.id = accountId;
          localAcc.account_id = accountId;
          accountsById.set(accountId, localAcc);
        }
        if (newActivationCode && /^\d{6}$/.test(newActivationCode)) {
          licenses.delete(localAcc.activation_code);
          localAcc.activation_code = newActivationCode;
        }
        if (newLicenseKey) {
          licenses.delete(localAcc.licenseKey);
          localAcc.licenseKey = newLicenseKey;
        }
        if (body?.status) {
          localAcc.status = String(body.status);
        }
        if (localAcc.status === 'active' || localAcc.status === 'trialing') {
          licenses.set(localAcc.activation_code, localAcc);
          licenses.set(localAcc.licenseKey, localAcc);
        }
      }
    } else if (localAcc) {
      localAcc.status = 'canceled';
      licenses.delete(localAcc.activation_code);
      licenses.delete(localAcc.licenseKey);
    }

    const result = await revokeLicenceOnAllNodes({
      id: isKeyRotation ? undefined : (accountId || localAcc?.id),
      activation_code: oldCodeToEvict,
      licenseKey: oldKeyToEvict,
      keys: Array.isArray(body?.keys) ? body.keys : []
    });
    return sendJson(
      res,
      200,
      {
        ok: true,
        rotated: isKeyRotation,
        ...(isKeyRotation && localAcc
          ? { activation_code: localAcc.activation_code, license_key: localAcc.licenseKey }
          : {}),
        ...result
      },
      {},
      req
    );
  }

  // VPN Customer Support Ticket Submission
  if ((pathname === '/api/vpn/support' || pathname === '/api/support-ticket') && req.method === 'POST') {
    if (!checkRateLimit(req, 'support_ticket', 5, 60000)) {
      return sendJson(res, 429, { error: 'Too many support requests. Please wait a minute and try again.' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' }, {}, req);
    const email = String(body?.email || '').trim().toLowerCase();
    const message = String(body?.message || '').trim();
    const subject = String(body?.subject || '').trim() || 'SWEEPR VPN Support Request';
    const os = String(body?.os || body?.platform || 'desktop').trim();
    if (!isValidEmail(email) || !message) {
      return sendJson(res, 400, { ok: false, error: 'Please provide a valid email address and message.' }, {}, req);
    }
    const payload = {
      ...body,
      project_id: 'vpn',
      email,
      subject,
      message,
      os,
      appVersion: body?.appVersion || body?.app_version || '2.5.0',
      deviceId: body?.deviceId || body?.device_id || undefined,
    };
    try {
      const data = await crm.createSupportTicket(payload);
      if (data && data.ok && data.ticket_id) {
        return sendJson(res, 200, data, {}, req);
      }
      await sendSupportTicketOwnerEmail({ fromEmail: email, subject, message, platform: os, ticketId: 'VPN-' + Date.now() });
      return sendJson(res, 200, { ok: true, ticket_id: data?.ticket_id || Date.now(), emailed: true }, {}, req);
    } catch (e) {
      await sendSupportTicketOwnerEmail({ fromEmail: email, subject, message, platform: os, ticketId: 'VPN-' + Date.now() }).catch(() => {});
      return sendJson(res, 200, { ok: true, ticket_id: Date.now(), emailed: true }, {}, req);
    }
  }

  // Google Play Billing Subscription Verification & Instant License Provisioning
  if (pathname === '/api/vpn/google-play/verify' && req.method === 'POST') {
    if (!checkRateLimit(req, 'google_play_verify', 15, 60000)) {
      return sendJson(res, 429, { ok: false, valid: false, error: 'rate_limit_exceeded' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);

    const purchaseToken = String(body?.purchase_token || body?.purchaseToken || '').trim();
    const productId = String(body?.product_id || body?.productId || '').trim();
    const orderId = String(body?.order_id || body?.orderId || '').trim();
    const rawPlan = String(body?.plan || productId || 'annual').trim().toLowerCase();
    if (!purchaseToken || purchaseToken.length < 6) {
      return sendJson(res, 400, { ok: false, valid: false, error: 'missing_purchase_token', message: 'Valid Google Play purchase_token is required.' }, {}, req);
    }

    const resolvedPlan =
      rawPlan.includes('six') || rawPlan.includes('6m')
        ? 'six_month'
        : rawPlan.includes('month')
        ? 'monthly'
        : 'annual';

    const rawEmail = String(body?.email || '').trim().toLowerCase();
    const normEmail = isValidEmail(rawEmail)
      ? rawEmail
      : `gplay_${crypto.createHash('sha256').update(purchaseToken).digest('hex').slice(0, 12)}@android.sweeprvpn.com`;

    const subRefId = orderId || `gplay_${crypto.createHash('sha256').update(purchaseToken).digest('hex').slice(0, 20)}`;
    const acc = upsertLocalAccount({
      email: normEmail,
      country: 'GB',
      subscriptionId: subRefId,
      plan: resolvedPlan,
      wifiRadarAddon: true,
      status: 'active'
    });

    const durationDays = resolvedPlan === 'monthly' ? 31 : resolvedPlan === 'six_month' ? 183 : 366;
    const expiresAtMs = Date.now() + durationDays * 86400 * 1000;
    acc.current_period_end = expiresAtMs;
    acc.google_play_purchase_token = purchaseToken;
    acc.google_play_order_id = orderId || null;
    acc.google_play_product_id = productId || null;

    let devReg = null;
    if (body?.device_id || body?.device_name) {
      devReg = registerOrUpdateAccountDevice(acc, {
        deviceId: body.device_id,
        deviceName: body.device_name || 'Android Device',
        os: body.os || 'android',
        method: 'google_play'
      });
    }

    try {
      const amountCents = resolvedPlan === 'monthly' ? 999 : resolvedPlan === 'six_month' ? 3899 : 4999;
      const crmSynced = await crm.upsertSubscription({
        email: acc.email,
        country: acc.country || 'GB',
        plan: resolvedPlan,
        status: 'active',
        days: durationDays,
        amount_cents: amountCents,
        currency: 'gbp',
        stripe_subscription_id: subRefId,
        activation_code: acc.activation_code,
        license_key: acc.licenseKey,
        addons: ['wifi_radar'],
        notes: `Google Play Billing (${productId || resolvedPlan}) order=${orderId || 'n/a'}`
      });
      if (crmSynced && crmSynced.activation_code && /^\d{6}$/.test(crmSynced.activation_code)) {
        licenses.delete(acc.activation_code);
        acc.activation_code = crmSynced.activation_code;
        licenses.set(acc.activation_code, acc);
      }
      if (crmSynced && crmSynced.license_key) {
        licenses.delete(acc.licenseKey);
        acc.licenseKey = crmSynced.license_key;
        licenses.set(acc.licenseKey, acc);
      }
    } catch {}

    const signed = signFallbackEd25519LicenseToken(acc, devReg?.device?.id || body?.device_id || 'vpn_android');

    return sendJson(
      res,
      200,
      {
        ok: true,
        valid: true,
        account_id: acc.id,
        license_key: acc.licenseKey,
        licenseKey: acc.licenseKey,
        activation_code: acc.activation_code,
        email: acc.email,
        plan: acc.plan,
        status: 'active',
        expires_at: new Date(expiresAtMs).toISOString(),
        wireguard_ready: true,
        device: devReg?.device || undefined,
        devices: Array.isArray(acc.devices) ? acc.devices : [],
        devices_used: Array.isArray(acc.devices) ? acc.devices.length : 1,
        device_count: Array.isArray(acc.devices) ? acc.devices.length : 1,
        max_devices: MAX_DEVICES_PER_ACCOUNT,
        device_limit: MAX_DEVICES_PER_ACCOUNT,
        ...(signed ? { token: signed.token, license_token: signed.token } : {})
      },
      { 'Cache-Control': 'no-store' },
      req
    );
  }

  // Google Play Mandatory Account & Data Deletion (In-App API + Public Web URL)
  if ((pathname === '/api/vpn/account/delete' || pathname === '/v1/account/delete') && req.method === 'POST') {
    if (!checkRateLimit(req, 'account_delete', 10, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded', message: 'Too many requests. Please wait a minute.' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);

    const normEmail = String(body?.email || '').trim().toLowerCase();
    const bearerKey = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const rawKey = String(body?.key || body?.code || body?.license_key || body?.activation_code || bearerKey || '').trim();

    let acc = null;
    const sess = verifySessionCookie(req);
    if (sess) {
      acc = accountsById.get(sess.accountId) || (sess.email ? accountsByEmail.get(sess.email) : null);
    }
    if (!acc && rawKey) {
      const resolved = await resolveVpnLicence(rawKey, normEmail, body?.device_id);
      const cleanKey = rawKey.replace(/\s+/g, '').toUpperCase();
      const candidate =
        resolved?.account ||
        licenses.get(cleanKey) ||
        licenses.get(rawKey) ||
        (normEmail ? accountsByEmail.get(normEmail) : null);
      if (candidate) {
        const keyMatches =
          Boolean(resolved) ||
          safeCompareStrings(cleanKey, String(candidate.licenseKey || '').toUpperCase()) ||
          safeCompareStrings(cleanKey, String(candidate.activation_code || ''));
        if (keyMatches && (!normEmail || candidate.email === normEmail)) {
          acc = candidate;
        }
      }
    }

    if (!acc) {
      return sendJson(
        res,
        401,
        {
          ok: false,
          deleted: false,
          error: 'unauthorized',
          message: 'Please provide your registered account email and active license key or 6-digit activation code to confirm permanent account deletion.'
        },
        {},
        req
      );
    }

    const deletedEmail = acc.email;
    const deletedAccountId = acc.id;
    const deletedKey = acc.licenseKey;
    const deletedCode = acc.activation_code;

    if (STRIPE_SECRET_KEY && acc.stripe_subscription_id && String(acc.stripe_subscription_id).startsWith('sub_')) {
      stripeRequest('DELETE', `subscriptions/${encodeURIComponent(acc.stripe_subscription_id)}`).catch(() => {});
    }

    await revokeLicenceOnAllNodes(acc).catch(() => {});

    acc.status = 'deleted';
    if (deletedCode) licenses.delete(deletedCode);
    if (deletedKey) {
      licenses.delete(deletedKey);
      licenses.delete(deletedKey.toUpperCase());
    }
    if (deletedAccountId) accountsById.delete(deletedAccountId);
    if (deletedEmail) accountsByEmail.delete(deletedEmail);
    if (acc.stripe_subscription_id) accountsBySubscriptionId.delete(acc.stripe_subscription_id);

    crm.deleteAccount({
      email: deletedEmail,
      account_id: deletedAccountId,
      license_key: deletedKey,
      activation_code: deletedCode,
      reason: String(body?.reason || 'user_requested_deletion').slice(0, 120)
    }).catch(() => {});
    crm.portalCancel({ email: deletedEmail, key: deletedKey }, true).catch(() => {});

    const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
    return sendJson(
      res,
      200,
      {
        ok: true,
        deleted: true,
        message: 'Your SWEEPR VPN account, linked devices, and WireGuard keys have been permanently deleted.'
      },
      {
        'Cache-Control': 'no-store',
        'Set-Cookie': `sweepr_session=; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}; Max-Age=0`
      },
      req
    );
  }

  if ((pathname === '/delete-account' || pathname === '/account/delete') && req.method === 'GET') {
    const sess = verifySessionCookie(req);
    const sessAcc = sess ? (accountsById.get(sess.accountId) || (sess.email ? accountsByEmail.get(sess.email) : null)) : null;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delete Account &amp; Data | SWEEPR VPN</title>
  <meta name="description" content="Permanently delete your SWEEPR VPN account, linked devices, and subscription records.">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;box-shadow:0 16px 40px -12px rgba(15,23,42,.08);max-width:500px;width:100%;padding:32px 26px;display:flex;flex-direction:column;gap:16px}
    .badge{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:12px;font-weight:800;background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;align-self:flex-start}
    h1{font-size:22px;font-weight:900;letter-spacing:-.02em}
    p,li{font-size:14px;color:#475569;line-height:1.55}
    ul{padding-left:20px;display:flex;flex-direction:column;gap:6px}
    .box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:10px}
    label{font-size:12px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:.04em}
    .input{width:100%;padding:11px 14px;border:1px solid #cbd5e1;border-radius:12px;font-size:14px}
    .btn{width:100%;padding:13px 16px;border-radius:12px;border:none;font-size:14px;font-weight:800;cursor:pointer;text-align:center;text-decoration:none}
    .btn-danger{background:#dc2626;color:#fff;box-shadow:0 6px 18px -4px rgba(220,38,38,.35)}
    .btn-soft{background:#f1f5f9;color:#0f172a;border:1px solid #e2e8f0}
    .msg{font-size:13.5px;font-weight:700;display:none;padding:12px;border-radius:12px}
    .msg.err{display:block;background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
    .msg.ok{display:block;background:#ecfdf5;color:#047857;border:1px solid #a7f3d0}
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">SWEEPR VPN • Data Safety &amp; Account Deletion</div>
    <h1>Permanently Delete Your SWEEPR VPN Account</h1>
    <p>You can permanently delete your SWEEPR VPN account and all associated personal data at any time from inside the SWEEPR VPN app (<strong>Account &rarr; Delete Account</strong>) or using the form below.</p>
    <div class="box">
      <label>What is deleted immediately:</label>
      <ul>
        <li>Your account email address, license key, and 6-digit activation code</li>
        <li>All linked device records (up to 3 desktop/mobile slots)</li>
        <li>All active WireGuard peer public keys across all 8 VPN server locations</li>
        <li>Active recurring subscriptions are immediately cancelled</li>
      </ul>
      <p style="font-size:12.5px;color:#64748b;margin-top:4px"><strong>Zero-Logs Note:</strong> SWEEPR VPN never logs browsing history, DNS queries, traffic destination, or IP addresses.</p>
    </div>
    <div id="delFormWrap" class="box">
      ${sessAcc ? `<p style="font-weight:700;color:#0f172a">Signed in as: ${escapeHtml(sessAcc.email)}</p>` : `
      <div>
        <label for="delEmail">Account Email Address</label>
        <input id="delEmail" class="input" type="email" placeholder="you@example.com" required style="margin-top:5px" />
      </div>
      <div>
        <label for="delKey">License Key or 6-Digit Activation Code</label>
        <input id="delKey" class="input" type="text" placeholder="SWEEPR-VPN-XXXX-XXXX-XXXX or 6-digit code" required style="margin-top:5px;font-family:monospace;font-weight:700" />
      </div>`}
      <div>
        <label for="delReason">Reason for leaving (optional)</label>
        <input id="delReason" class="input" type="text" placeholder="Optional feedback…" style="margin-top:5px" />
      </div>
      <div id="delStatus" class="msg"></div>
      <button id="delBtn" class="btn btn-danger" onclick="submitAccountDelete()">Permanently Delete My Account &amp; Data</button>
    </div>
    <a href="/?home=1" class="btn btn-soft">Return to SWEEPR VPN</a>
  </div>
  <script>
    async function submitAccountDelete() {
      const btn = document.getElementById('delBtn');
      const st = document.getElementById('delStatus');
      st.className = 'msg';
      st.style.display = 'none';
      const email = (document.getElementById('delEmail')?.value || '').trim();
      const key = (document.getElementById('delKey')?.value || '').trim();
      const reason = (document.getElementById('delReason')?.value || '').trim();
      if (!confirm('Are you sure you want to permanently delete your SWEEPR VPN account and revoke all devices? This action cannot be undone.')) return;
      btn.disabled = true;
      btn.textContent = 'Deleting Account…';
      try {
        const r = await fetch('/api/vpn/account/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, key, license_key: key, code: key, reason })
        });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.ok && d.deleted) {
          st.className = 'msg ok';
          st.textContent = d.message || 'Your SWEEPR VPN account and data have been permanently deleted.';
          btn.style.display = 'none';
        } else {
          st.className = 'msg err';
          st.textContent = d.message || 'Could not verify account ownership. Please check your email and license key.';
          btn.disabled = false;
          btn.textContent = 'Permanently Delete My Account & Data';
        }
      } catch (e) {
        st.className = 'msg err';
        st.textContent = 'Network error. Please check your connection and try again.';
        btn.disabled = false;
        btn.textContent = 'Permanently Delete My Account & Data';
      }
    }
  </script>
</body>
</html>`;
    return sendHtml(res, 200, html, { 'Cache-Control': 'no-store' });
  }

  // Customer Portal Login & OTP Verification
  if ((pathname === '/api/portal-login' || pathname === '/v1/account/send-otp' || pathname === '/api/vpn/otp/send') && req.method === 'POST') {
    if (!checkRateLimit(req, 'portal_login', 5, 60000)) {
      return sendJson(res, 429, { otpSent: false, error: 'Too many login attempts. Please wait a minute and try again.' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { otpSent: false, error: 'payload_too_large' }, {}, req);
    const email = (body.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { otpSent: false, error: 'Please enter a valid email address.' }, {}, req);
    }

    let localAcc = accountsByEmail.get(email);
    let isSignedUp = Boolean(localAcc && localAcc.status === 'active');

    // If not in local cache as active, check Stripe for an active/trialing/past_due subscription before requesting OTP
    if (!isSignedUp && STRIPE_SECRET_KEY) {
      try {
        const custList = await stripeRequest('GET', 'customers', { email, limit: 5 });
        for (const cust of custList.data || []) {
          if (cust.deleted) continue;
          const subs = await stripeRequest('GET', 'subscriptions', { customer: cust.id, status: 'all', limit: 5 });
          const activeSub = (subs.data || []).find((s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due');
          if (activeSub) {
            localAcc = upsertLocalAccount({
              email,
              name: cust.name || '',
              stripeCustomerId: cust.id,
              subscriptionId: activeSub.id,
              plan: activeSub.metadata?.plan || 'annual',
              wifiRadarAddon: activeSub.metadata?.wifi_radar === 'true',
              status: 'active'
            });
            isSignedUp = true;
            break;
          }
        }
      } catch {}
    }

    // Request OTP from central sweepr_crm (which also verifies the email is signed up before sending a 6-digit OTP email)
    let crmOtpSent = false;
    let crmReachable = false;
    try {
      const crmRes = await crm.sendOtp(email);
      if (crmRes && crmRes._httpStatus && crmRes._httpStatus < 500) {
        crmReachable = true;
        if (crmRes.otpSent) {
          crmOtpSent = true;
        } else if (crmRes._httpStatus === 404 && isSignedUp && localAcc) {
          // Sync local active subscription to CRM and retry OTP send
          await crm.syncSubscription({
            email: localAcc.email,
            name: localAcc.name || undefined,
            country: localAcc.country || 'GB',
            plan: localAcc.plan || 'annual',
            status: 'active',
            stripe_customer_id: localAcc.stripe_customer_id,
            stripe_subscription_id: localAcc.stripe_subscription_id,
            activation_code: localAcc.activation_code,
            license_key: localAcc.licenseKey,
            addons: localAcc.wifiRadarAddon ? ['wifi_radar'] : []
          }).catch(() => {});
          const retryRes = await crm.sendOtp(email).catch(() => null);
          if (retryRes && retryRes.otpSent) crmOtpSent = true;
        }
      }
    } catch {}

    if (!crmOtpSent && isSignedUp && localAcc) {
      const smtpUser = (process.env.SMTP_GMAIL_USER || '').trim().replace(/^["']|["']$/g, '') ||
        decryptServerVault(ENCRYPTED_SMTP_USER);
      const smtpPass = (process.env.SMTP_GMAIL_PASS || '').trim().replace(/\s+/g, '').replace(/^["']|["']$/g, '') ||
        decryptServerVault(ENCRYPTED_SMTP_PASS);
      if (smtpUser && smtpPass) {
        try {
          const subject = 'Your SWEEPR VPN Login & Activation Code';
          const textBody = `Hi ${localAcc.name || 'there'},\n\nYour 6-digit SWEEPR VPN login & activation code is: ${localAcc.activation_code}\nYour Full Product License Key is: ${localAcc.licenseKey}\n\nEnter ${localAcc.activation_code} on the login screen or paste ${localAcc.licenseKey} in the SWEEPR VPN app.`;
          await new Promise((resolve, reject) => {
            const sock = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com', timeout: 8000 });
            let step = 0, buf = '';
            const mime = [
              `From: "SWEEPR VPN" <${smtpUser}>`,
              `To: <${email}>`,
              `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
              `Date: ${new Date().toUTCString()}`,
              'MIME-Version: 1.0',
              'Content-Type: text/plain; charset="UTF-8"',
              'Content-Transfer-Encoding: base64',
              '',
              Buffer.from(textBody, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
              '.',
              ''
            ].join('\r\n');
            const fail = (err) => { try { sock.destroy(); } catch {} reject(err); };
            sock.on('timeout', () => fail(new Error('timeout')));
            sock.on('error', fail);
            sock.on('data', (chunk) => {
              buf += chunk.toString('utf8');
              const lines = buf.split('\r\n');
              buf = lines.pop() || '';
              for (const line of lines) {
                if (!line || (line.length >= 4 && line[3] === '-')) continue;
                const code = parseInt(line.slice(0, 3), 10);
                if (code >= 400) return fail(new Error(line));
                if (step === 0 && code === 220) { step = 1; sock.write('EHLO sweeprvpn.com\r\n'); }
                else if (step === 1 && code === 250) { step = 2; sock.write('AUTH LOGIN\r\n'); }
                else if (step === 2 && code === 334) { step = 3; sock.write(Buffer.from(smtpUser, 'utf8').toString('base64') + '\r\n'); }
                else if (step === 3 && code === 334) { step = 4; sock.write(Buffer.from(smtpPass, 'utf8').toString('base64') + '\r\n'); }
                else if (step === 4 && code === 235) { step = 5; sock.write(`MAIL FROM:<${smtpUser}>\r\n`); }
                else if (step === 5 && code === 250) { step = 6; sock.write(`RCPT TO:<${email}>\r\n`); }
                else if (step === 6 && code === 250) { step = 7; sock.write('DATA\r\n'); }
                else if (step === 7 && code === 354) { step = 8; sock.write(mime + '\r\n'); }
                else if (step === 8 && code === 250) { step = 9; sock.write('QUIT\r\n'); try { sock.end(); } catch {} resolve(true); }
              }
            });
          });
          crmOtpSent = true;
        } catch {}
      }
    }

    if (!crmOtpSent && (!isSignedUp || crmReachable)) {
      return sendJson(
        res,
        404,
        {
          ok: false,
          otpSent: false,
          error: 'No account found for this email address. Please sign up first or check your email.'
        },
        {},
        req
      );
    }

    return sendJson(res, 200, { ok: true, otpSent: true }, {}, req);
  }

  if ((pathname === '/api/verify-otp' || pathname === '/v1/account/verify-otp' || pathname === '/api/vpn/otp/verify') && req.method === 'POST') {
    if (!checkRateLimit(req, 'verify_otp', 5, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'Too many verification attempts. Please wait a minute and try again.' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);
    const email = (body.email || '').trim().toLowerCase();
    const code = String(body.code || '').trim();
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
      return sendJson(res, 400, { ok: false, error: 'Invalid or expired 6-digit login code.' }, {}, req);
    }

    let acc = accountsByEmail.get(email);
    let crmReachable = false;
    let crmVerified = false;
    const portalDeviceId = String(body.deviceId || `portal_${crypto.createHash('sha256').update(email).digest('hex').slice(0, 12)}`);
    try {
      const otpRes = await crm.verifyOtp({
        email,
        code,
        deviceId: portalDeviceId,
        platform: String(body.platform || 'web'),
        deviceLabel: String(body.deviceLabel || 'SWEEPR Customer Portal')
      });
      if (otpRes && otpRes._httpStatus && otpRes._httpStatus < 500) {
        crmReachable = true;
        if (otpRes.ok) {
          acc = upsertLocalAccount({
            email,
            plan: otpRes.plan || acc?.plan || 'annual',
            wifiRadarAddon: Array.isArray(otpRes.addons) ? otpRes.addons.includes('wifi_radar') : Boolean(acc?.wifiRadarAddon),
            status: 'active',
            licenseKey: otpRes.license_key || acc?.licenseKey,
            activationCode: code
          });
          crmVerified = true;
        }
      }
      if (!crmVerified) {
        const crmRes = await crm.activateDevice({
          email,
          otp: code,
          deviceId: portalDeviceId,
          deviceName: 'SWEEPR Customer Portal',
          os: 'web',
          appVersion: '2.5.0'
        });
        if (crmRes && crmRes._httpStatus && crmRes._httpStatus < 500) {
          crmReachable = true;
          const synced = syncLocalCacheFromCrm(crmRes, email, code);
          if (crmRes.valid && synced) {
            acc = synced;
            crmVerified = true;
          }
        }
      }
    } catch {}

    const validActivationKey =
      crmVerified ||
      (!crmReachable &&
        Boolean(acc && acc.status === 'active') &&
        safeCompareStrings(code, acc.activation_code));

    if (validActivationKey && acc) {
      const sessionToken = signSessionCookie(acc.id, acc.email);
      const signed = signFallbackEd25519LicenseToken(acc, portalDeviceId);
      const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
      return sendJson(
        res,
        200,
        {
          ok: true,
          valid: true,
          redirect: '/dashboard',
          email: acc.email,
          license_key: acc.licenseKey,
          licenseKey: acc.licenseKey,
          activation_code: acc.activation_code,
          plan: acc.plan,
          status: acc.status,
          devices_used: Array.isArray(acc.devices) ? acc.devices.length : 1,
          max_devices: MAX_DEVICES_PER_ACCOUNT,
          ...(signed ? { token: signed.token, license_token: signed.token } : {})
        },
        {
          'Set-Cookie': `sweepr_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}; Max-Age=${86400 * 30}`
        },
        req
      );
    }

    return sendJson(res, 401, { ok: false, error: 'Invalid or expired 6-digit login code.' }, {}, req);
  }

  // Customer Portal Logout
  if (pathname === '/api/logout' && req.method === 'POST') {
    if (!isSameOriginOrTrusted(req)) {
      return sendJson(res, 403, { ok: false, error: 'forbidden_cross_site' }, {}, req);
    }
    const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
    return sendJson(
      res,
      200,
      { ok: true },
      {
        'Set-Cookie': `sweepr_session=; Path=/; HttpOnly; SameSite=Lax${isHttps ? '; Secure' : ''}; Max-Age=0`
      },
      req
    );
  }

  // Customer Portal Dashboard Data (Matches sweeprcleaner /api/dashboard-data)
  if (pathname === '/api/dashboard-data' && req.method === 'GET') {
    const sess = verifySessionCookie(req);
    if (!sess) {
      return sendJson(res, 401, { error: 'unauthorized' }, {}, req);
    }

    let acc =
      accountsById.get(sess.accountId) ||
      (sess.email ? accountsByEmail.get(sess.email) : null);

    // If not in local cache yet (e.g. after server restart), hydrate from Stripe or CRM
    if ((!acc || acc.status !== 'active') && sess.email && STRIPE_SECRET_KEY) {
      try {
        const custList = await stripeRequest('GET', 'customers', { email: sess.email, limit: 5 });
        for (const cust of custList.data || []) {
          if (cust.deleted) continue;
          const subs = await stripeRequest('GET', 'subscriptions', { customer: cust.id, status: 'all', limit: 5 });
          const activeSub = (subs.data || []).find((s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due');
          if (activeSub) {
            acc = upsertLocalAccount({
              email: sess.email,
              name: cust.name || '',
              country: activeSub.metadata?.country || 'GB',
              stripeCustomerId: cust.id,
              subscriptionId: activeSub.id,
              plan: activeSub.metadata?.plan || 'annual',
              wifiRadarAddon: activeSub.metadata?.wifi_radar === 'true' || (activeSub.metadata?.addons || '').includes('wifi_radar'),
              status: 'active'
            });
            break;
          }
        }
      } catch {}
    }

    if (!acc) {
      return sendJson(res, 404, { error: 'account_not_found' }, {}, req);
    }

    let paymentMethod = null;
    let billingAddress = null;
    let subscriptionDetails = null;
    let cancelAtPeriodEnd = Boolean(acc.cancel_at_period_end);
    let currentPeriodEnd = acc.current_period_end || null;

    if (STRIPE_SECRET_KEY && acc.stripe_customer_id) {
      try {
        const cust = await stripeRequest('GET', `customers/${encodeURIComponent(acc.stripe_customer_id)}`, {
          expand: ['invoice_settings.default_payment_method']
        });
        if (cust && !cust.deleted) {
          if (cust.address) {
            billingAddress = {
              line1: cust.address.line1 || '',
              line2: cust.address.line2 || '',
              city: cust.address.city || '',
              state: cust.address.state || '',
              postal_code: cust.address.postal_code || '',
              country: cust.address.country || ''
            };
          }
          const defPm = cust.invoice_settings?.default_payment_method;
          if (defPm && typeof defPm === 'object' && defPm.card) {
            paymentMethod = {
              id: defPm.id,
              brand: defPm.card.brand || 'card',
              last4: defPm.card.last4 || '••••',
              exp_month: defPm.card.exp_month || 0,
              exp_year: defPm.card.exp_year || 0
            };
          }
        }
      } catch {}

      if (acc.stripe_subscription_id && acc.stripe_subscription_id.startsWith('sub_')) {
        try {
          const sub = await stripeRequest('GET', `subscriptions/${encodeURIComponent(acc.stripe_subscription_id)}`);
          cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end);
          if (sub.current_period_end) {
            currentPeriodEnd = sub.current_period_end * 1000;
          }
          const item = sub.items?.data?.[0];
          const price = item?.price;
          if (price) {
            subscriptionDetails = {
              unit_amount: price.unit_amount ?? null,
              currency: (price.currency || 'gbp').toUpperCase(),
              interval: price.recurring?.interval || 'year',
              interval_count: price.recurring?.interval_count || 1
            };
          }
        } catch {}
      }
    }

    const localizedPricing = buildLocalizedPricing(acc.country || 'GB');
    const addons = acc.wifiRadarAddon ? ['wifi_radar'] : [];

    return sendJson(
      res,
      200,
      {
        account_id: acc.id,
        email: acc.email,
        name: acc.name || '',
        plan: acc.plan || 'annual',
        status: acc.status || 'active',
        activation_code: acc.activation_code,
        licenseKey: acc.licenseKey,
        addons,
        addon_pricing: {
          wifi_radar: {
            annualFormatted: localizedPricing.wifiRadarAnnualFormatted,
            annualMonthlyEqFormatted: localizedPricing.wifiRadarAnnualMonthlyEqFormatted,
            sixMonthFormatted: localizedPricing.wifiRadarSixMonthFormatted,
            monthlyFormatted: localizedPricing.wifiRadarMonthlyFormatted
          }
        },
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        has_stripe: Boolean(acc.stripe_customer_id),
        stripe_configured: Boolean(STRIPE_SECRET_KEY),
        stripe_publishable_key: STRIPE_PUBLISHABLE_KEY || null,
        payment_method: paymentMethod,
        billing_address: billingAddress,
        subscription_details: subscriptionDetails,
        devices: Array.isArray(acc.devices) ? acc.devices : [],
        devices_used: Array.isArray(acc.devices) ? acc.devices.length : 0,
        max_devices: MAX_DEVICES_PER_ACCOUNT
      },
      { 'Cache-Control': 'no-store' },
      req
    );
  }

  // Customer Portal 1-Click Add-on Upgrade ("wifi_radar")
  if (pathname === '/api/portal/purchase-addon' && req.method === 'POST') {
    if (!isSameOriginOrTrusted(req)) return sendJson(res, 403, { error: 'forbidden_cross_site' }, {}, req);
    const sess = verifySessionCookie(req);
    if (!sess) return sendJson(res, 401, { error: 'unauthorized' }, {}, req);
    const acc = accountsById.get(sess.accountId) || (sess.email ? accountsByEmail.get(sess.email) : null);
    if (!acc) return sendJson(res, 404, { error: 'account_not_found' }, {}, req);
    if (acc.status !== 'active') {
      return sendJson(res, 402, { error: 'Active SWEEPR VPN Pro subscription required to attach an add-on.' }, {}, req);
    }

    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' }, {}, req);
    const addon = String(body?.addon || 'wifi_radar').trim().toLowerCase();
    if (addon !== 'wifi_radar') {
      return sendJson(res, 400, { error: 'unsupported_addon' }, {}, req);
    }

    if (acc.wifiRadarAddon) {
      return sendJson(res, 200, { ok: true, addons: ['wifi_radar'], already_active: true }, {}, req);
    }

    if (STRIPE_SECRET_KEY && acc.stripe_subscription_id && acc.stripe_subscription_id.startsWith('sub_')) {
      try {
        const sub = await stripeRequest('GET', `subscriptions/${encodeURIComponent(acc.stripe_subscription_id)}`);
        const firstPrice = sub.items?.data?.[0]?.price;
        const interval = firstPrice?.recurring?.interval || (acc.plan === 'annual' ? 'year' : 'month');
        const intervalCount = firstPrice?.recurring?.interval_count || (acc.plan === 'six_month' ? 6 : 1);
        const currency = firstPrice?.currency || 'gbp';
        const tierPricing = buildLocalizedPricing(acc.country || 'GB', currency);
        const unitAmount =
          interval === 'year'
            ? tierPricing.wifiRadarAnnualAmount
            : intervalCount === 6
            ? tierPricing.wifiRadarSixMonthAmount
            : tierPricing.wifiRadarMonthlyAmount;

        const radarProductId = await getStripeWifiRadarProductId();
        await stripeRequest('POST', `subscriptions/${encodeURIComponent(sub.id)}`, {
          items: [
            ...(sub.items?.data || []).map((it) => ({ id: it.id })),
            {
              price_data: {
                currency,
                product: radarProductId,
                unit_amount: unitAmount,
                recurring: {
                  interval,
                  ...(intervalCount > 1 ? { interval_count: intervalCount } : {})
                }
              }
            }
          ],
          metadata: {
            ...(sub.metadata || {}),
            wifi_radar: 'true',
            addons: 'wifi_radar'
          },
          proration_behavior: 'always_invoice',
          payment_behavior: 'error_if_incomplete'
        });
      } catch (err) {
        return sendJson(res, 402, { error: err.message || 'Payment failed for add-on upgrade.' }, {}, req);
      }
    }

    acc.wifiRadarAddon = true;
    acc.entitlements = buildVpnEntitlements(true);
    crm.syncSubscription({
      email: acc.email,
      name: acc.name || undefined,
      country: acc.country || 'GB',
      plan: acc.plan || 'annual',
      status: acc.status,
      stripe_customer_id: acc.stripe_customer_id,
      stripe_subscription_id: acc.stripe_subscription_id,
      activation_code: acc.activation_code,
      license_key: acc.licenseKey,
      addons: ['wifi_radar'],
      notes: 'Add-on activated: wifi_radar'
    }).catch(() => {});

    return sendJson(res, 200, { ok: true, addons: ['wifi_radar'] }, {}, req);
  }

  // Customer Portal Cancel Subscription at Period End
  if (pathname === '/api/portal/cancel-subscription' && req.method === 'POST') {
    if (!isSameOriginOrTrusted(req)) return sendJson(res, 403, { error: 'forbidden_cross_site' }, {}, req);
    const sess = verifySessionCookie(req);
    if (!sess) return sendJson(res, 401, { error: 'unauthorized' }, {}, req);
    const acc = accountsById.get(sess.accountId) || (sess.email ? accountsByEmail.get(sess.email) : null);
    if (!acc || acc.status !== 'active') {
      return sendJson(res, 400, { error: 'No active subscription found to cancel.' }, {}, req);
    }

    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' }, {}, req);
    const reason = String(body?.reason || 'unspecified').trim().slice(0, 120);

    if (STRIPE_SECRET_KEY && acc.stripe_subscription_id && acc.stripe_subscription_id.startsWith('sub_')) {
      try {
        await stripeRequest('POST', `subscriptions/${encodeURIComponent(acc.stripe_subscription_id)}`, {
          cancel_at_period_end: true,
          metadata: {
            cancel_reason: reason
          }
        });
      } catch (err) {
        console.error('[portal] stripe cancel_at_period_end error:', err.message);
      }
    }

    acc.cancel_at_period_end = true;
    acc.current_period_end = acc.current_period_end || Date.now() + 30 * 86400 * 1000;
    crm.syncSubscription({
      email: acc.email,
      name: acc.name || undefined,
      country: acc.country || 'GB',
      plan: acc.plan || 'annual',
      status: acc.status,
      addons: acc.wifiRadarAddon ? ['wifi_radar'] : [],
      notes: `Scheduled cancellation at period end (${reason})`
    }).catch(() => {});

    return sendJson(
      res,
      200,
      {
        ok: true,
        status: acc.status,
        cancel_at_period_end: true,
        current_period_end: acc.current_period_end
      },
      {},
      req
    );
  }

  // Customer Portal Reactivate Subscription
  if (pathname === '/api/portal/reactivate-subscription' && req.method === 'POST') {
    if (!isSameOriginOrTrusted(req)) return sendJson(res, 403, { error: 'forbidden_cross_site' }, {}, req);
    const sess = verifySessionCookie(req);
    if (!sess) return sendJson(res, 401, { error: 'unauthorized' }, {}, req);
    const acc = accountsById.get(sess.accountId) || (sess.email ? accountsByEmail.get(sess.email) : null);
    if (!acc || acc.status !== 'active') {
      return sendJson(res, 400, { error: 'No active subscription found.' }, {}, req);
    }

    if (STRIPE_SECRET_KEY && acc.stripe_subscription_id && acc.stripe_subscription_id.startsWith('sub_')) {
      try {
        await stripeRequest('POST', `subscriptions/${encodeURIComponent(acc.stripe_subscription_id)}`, {
          cancel_at_period_end: false
        });
      } catch (err) {
        return sendJson(res, 400, { error: err.message || 'Failed to reactivate subscription.' }, {}, req);
      }
    }

    acc.cancel_at_period_end = false;
    crm.syncSubscription({
      email: acc.email,
      name: acc.name || undefined,
      country: acc.country || 'GB',
      plan: acc.plan || 'annual',
      status: acc.status,
      addons: acc.wifiRadarAddon ? ['wifi_radar'] : [],
      notes: 'Customer reactivated subscription'
    }).catch(() => {});

    return sendJson(
      res,
      200,
      {
        ok: true,
        status: acc.status,
        cancel_at_period_end: false,
        current_period_end: acc.current_period_end || null
      },
      {},
      req
    );
  }

  // Customer Portal Billing Portal Redirect / Session
  if (pathname === '/api/billing-portal' && (req.method === 'GET' || req.method === 'POST')) {
    if (!isSameOriginOrTrusted(req)) {
      if (req.method === 'POST') return sendJson(res, 403, { error: 'forbidden_cross_site' }, {}, req);
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', ...COMMON_SECURITY_HEADERS });
      return res.end('Forbidden (cross-site)');
    }
    const sess = verifySessionCookie(req);
    if (!sess) {
      if (req.method === 'POST') return sendJson(res, 401, { error: 'unauthorized' }, {}, req);
      res.writeHead(302, { Location: '/login', ...COMMON_SECURITY_HEADERS });
      return res.end();
    }
    const acc = accountsById.get(sess.accountId) || (sess.email ? accountsByEmail.get(sess.email) : null);
    if (STRIPE_SECRET_KEY && acc?.stripe_customer_id) {
      try {
        const portalSession = await stripeRequest('POST', 'billing_portal/sessions', {
          customer: acc.stripe_customer_id,
          return_url: `${resolveTrustedOrigin(req)}/dashboard`
        });
        if (portalSession?.url) {
          if (req.method === 'POST') return sendJson(res, 200, { url: portalSession.url }, {}, req);
          res.writeHead(302, { Location: portalSession.url, ...COMMON_SECURITY_HEADERS });
          return res.end();
        }
      } catch {}
    }
    if (req.method === 'POST') return sendJson(res, 200, { url: '/dashboard' }, {}, req);
    res.writeHead(302, { Location: '/dashboard', ...COMMON_SECURITY_HEADERS });
    return res.end();
  }

  // VPN server list: only real servers from VPN_NODES (no secrets are ever sent)
  if (pathname === '/api/vpn/servers' && req.method === 'GET') {
    if (!checkRateLimit(req, 'vpn_servers', 60, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' }, {}, req);
    }
    const nodes = loadVpnNodes();
    const servers = await Promise.all(nodes.map(async (n) => {
      const h = await nodeHealth(n);
      return {
        code: n.code,
        country: n.country,
        city: n.city,
        flag: n.flag,
        online: Boolean(h),
        devices: h ? h.devices : null,
        probe_ms: h?.probeMs ?? null,
        p99_ms: h?.p99Ms ?? null
      };
    }));
    return sendJson(res, 200, { ok: true, servers }, {}, req);
  }

  // VPN connect: checks the licence, registers this device's WireGuard public key on the
  // chosen server and returns the details the app needs to open the tunnel.
  // Nothing about browsing is logged anywhere; the server only stores the key and its tunnel address.
  if (pathname === '/api/vpn/connect' && req.method === 'POST') {
    if (!checkRateLimit(req, 'vpn_connect', 20, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded', message: 'Too many attempts. Please wait a minute.' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);
    const publicKey = String(body?.public_key || '').trim();
    const rawCode = String(body?.server_code || '').trim().toUpperCase(); const serverCode = rawCode === 'CH-ZRH-01' ? 'SE-STO-01' : rawCode;
    if (!/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$/.test(publicKey)) {
      return sendJson(res, 400, { ok: false, error: 'invalid_public_key' }, {}, req);
    }
    const licence = await resolveVpnLicence(String(body?.activation_code || body?.license_key || '').trim(), body?.email, body?.device_id);
    if (!licence) {
      return sendJson(res, 401, { ok: false, error: 'licence_required', message: 'Enter your license key to connect. It is in your order email.' }, {}, req);
    }
    const node = await selectHealthyNodeForRegion(loadVpnNodes(), serverCode);
    if (!node) {
      return sendJson(res, 404, { ok: false, error: 'server_unavailable', message: 'That location is not available right now. Please pick another.' }, {}, req);
    }
    try {
      const r = await callNodeAgent(node, 'POST', '/peers', { public_key: publicKey, licence: licence.id });
      const pinnedPubKey = String(node.public_key || '').trim();
      const agentPubKey = String(r.public_key || '').trim();
      if (pinnedPubKey && agentPubKey && pinnedPubKey !== agentPubKey) {
        throw new Error('node_public_key_mismatch');
      }
      const serverPubKey = pinnedPubKey || agentPubKey;
      if (!/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$/.test(serverPubKey)) {
        throw new Error('invalid_server_public_key');
      }
      const assignedAddress = String(r.address || '').trim();
      if (!/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(assignedAddress)) {
        throw new Error('invalid_assigned_address');
      }
      const assignedDns = '1.1.1.1, 1.0.0.1';
      return sendJson(res, 200, {
        ok: true,
        endpoint: `${node.ip}:${node.port || 51820}`,
        server_public_key: serverPubKey,
        address: assignedAddress,
        dns: assignedDns,
        allowed_ips: '0.0.0.0/0',
        server: { code: node.code, country: node.country, city: node.city, flag: node.flag }
      }, {}, req);
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: 'server_unreachable', message: 'That location is not responding. Please try another.' }, {}, req);
    }
  }

  // Mobile & Web WireGuard profile generator (iOS / Android / macOS / Linux .conf + QR SVG)
  if (pathname === '/api/vpn/wireguard-config' && req.method === 'POST') {
    if (!checkRateLimit(req, 'vpn_wg_config', 15, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded', message: 'Too many requests. Please wait a minute.' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);
    const rawKey = String(body?.activation_code || body?.license_key || '').trim();
    const rawCode = String(body?.server_code || 'UK-LON-01').trim().toUpperCase();
    const serverCode = rawCode === 'CH-ZRH-01' ? 'SE-STO-01' : rawCode;
    const licence = await resolveVpnLicence(rawKey, body?.email, body?.device_id);
    if (!licence) {
      return sendJson(res, 401, { ok: false, error: 'licence_required', message: 'Please enter a valid active SWEEPR Pro license key.' }, {}, req);
    }
    const nodes = loadVpnNodes();
    const node = (await selectHealthyNodeForRegion(nodes, serverCode)) || nodes[0];
    if (!node) {
      return sendJson(res, 404, { ok: false, error: 'server_unavailable', message: 'That location is temporarily unavailable.' }, {}, req);
    }
    try {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519');
      const jwk = privateKey.export({ format: 'jwk' });
      const clientPrivateKey = Buffer.from(jwk.d, 'base64url').toString('base64');
      const clientPublicKey = Buffer.from(jwk.x, 'base64url').toString('base64');

      const r = await callNodeAgent(node, 'POST', '/peers', { public_key: clientPublicKey, licence: licence.id });
      const pinnedPubKey = String(node.public_key || '').trim();
      const agentPubKey = String(r.public_key || '').trim();
      if (pinnedPubKey && agentPubKey && pinnedPubKey !== agentPubKey) {
        throw new Error('node_public_key_mismatch');
      }
      const serverPubKey = pinnedPubKey || agentPubKey;
      const assignedAddress = String(r.address || '10.64.0.2/32').trim();
      const assignedDns = '1.1.1.1, 1.0.0.1';
      const endpoint = `${node.ip}:${node.port || 51820}`;
      const lanBypass = Boolean(body?.lan_bypass);
      const allowedIps = lanBypass
        ? '1.0.0.0/8, 2.0.0.0/7, 4.0.0.0/6, 8.0.0.0/7, 10.64.0.0/16, 11.0.0.0/8, 12.0.0.0/6, 16.0.0.0/4, 32.0.0.0/3, 64.0.0.0/2, 128.0.0.0/3, 160.0.0.0/5, 168.0.0.0/6, 172.0.0.0/12, 172.32.0.0/11, 172.64.0.0/10, 172.128.0.0/9, 173.0.0.0/8, 174.0.0.0/7, 176.0.0.0/4, 192.0.0.0/9, 192.128.0.0/11, 192.160.0.0/13, 192.169.0.0/16, 192.170.0.0/15, 192.172.0.0/14, 192.176.0.0/12, 192.192.0.0/10, 193.0.0.0/8, 194.0.0.0/7, 196.0.0.0/6, 200.0.0.0/5, 208.0.0.0/4'
        : '0.0.0.0/0';

      const configText = [
        '[Interface]',
        `PrivateKey = ${clientPrivateKey}`,
        `Address = ${assignedAddress}`,
        `DNS = ${assignedDns}`,
        'MTU = 1280',
        '',
        '[Peer]',
        `PublicKey = ${serverPubKey}`,
        `AllowedIPs = ${allowedIps}`,
        `Endpoint = ${endpoint}`,
        'PersistentKeepalive = 25',
        ''
      ].join('\n');

      const qrText = [
        '[Interface]',
        `PrivateKey = ${clientPrivateKey}`,
        `Address = ${assignedAddress}`,
        `DNS = ${assignedDns}`,
        'MTU = 1280',
        '',
        '[Peer]',
        `PublicKey = ${serverPubKey}`,
        'AllowedIPs = 0.0.0.0/0, ::/0',
        `Endpoint = ${endpoint}`,
        'PersistentKeepalive = 25',
        ''
      ].join('\n');

      const qrSvg = renderWireGuardQrSvg(qrText);
      return sendJson(res, 200, {
        ok: true,
        filename: `sweepr-${node.code.toLowerCase()}.conf`,
        config_text: configText,
        qr_svg: qrSvg,
        lan_bypass: lanBypass,
        address: assignedAddress,
        dns: assignedDns,
        endpoint,
        server: { code: node.code, country: node.country, city: node.city, flag: node.flag }
      }, {}, req);
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: 'server_unreachable', message: 'Could not register mobile WireGuard peer on that location. Please try another country.' }, {}, req);
    }
  }

  // Apple iOS / macOS Configuration Profile Generator (.mobileconfig) (Item 7)
  if (pathname === '/api/vpn/apple-mobileconfig' && (req.method === 'GET' || req.method === 'POST')) {
    if (!checkRateLimit(req, 'vpn_mobileconfig', 15, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' }, {}, req);
    }
    const body = req.method === 'POST' ? await readJsonBody(req) : {};
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);
    const rawKey = String(body?.activation_code || body?.license_key || urlObj.searchParams.get('key') || urlObj.searchParams.get('code') || '').trim();
    const rawCode = String(body?.server_code || urlObj.searchParams.get('server_code') || 'UK-LON-01').trim().toUpperCase();
    const serverCode = rawCode === 'CH-ZRH-01' ? 'SE-STO-01' : rawCode;
    const licence = await resolveVpnLicence(rawKey, body?.email || urlObj.searchParams.get('email'), body?.device_id || urlObj.searchParams.get('device_id'));
    if (!licence) {
      return sendJson(res, 401, { ok: false, error: 'licence_required', message: 'Please enter a valid active SWEEPR Pro license key.' }, {}, req);
    }
    const nodes = loadVpnNodes();
    const node = (await selectHealthyNodeForRegion(nodes, serverCode)) || nodes[0];
    if (!node) {
      return sendJson(res, 404, { ok: false, error: 'server_unavailable' }, {}, req);
    }
    try {
      const { privateKey } = crypto.generateKeyPairSync('x25519');
      const jwk = privateKey.export({ format: 'jwk' });
      const clientPrivateKey = Buffer.from(jwk.d, 'base64url').toString('base64');
      const clientPublicKey = Buffer.from(jwk.x, 'base64url').toString('base64');
      const r = await callNodeAgent(node, 'POST', '/peers', { public_key: clientPublicKey, licence: licence.id });
      const serverPubKey = String(node.public_key || r.public_key || '').trim();
      const assignedAddress = String(r.address || '10.64.0.2/32').trim();
      const assignedDns = '1.1.1.1, 1.0.0.1';
      const endpoint = `${node.ip}:${node.port || 51820}`;
      const wgConf = `[Interface]\nPrivateKey = ${clientPrivateKey}\nAddress = ${assignedAddress}\nDNS = ${assignedDns}\nMTU = 1280\n\n[Peer]\nPublicKey = ${serverPubKey}\nAllowedIPs = 0.0.0.0/0, ::/0\nEndpoint = ${endpoint}\nPersistentKeepalive = 25`;
      const uuidProfile = crypto.randomUUID().toUpperCase();
      const uuidVpn = crypto.randomUUID().toUpperCase();
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadDisplayName</key>
  <string>SWEEPR VPN (${escapeHtml(node.city)}, ${escapeHtml(node.country)})</string>
  <key>PayloadIdentifier</key>
  <string>com.sweeprvpn.profile.${escapeHtml(node.code.toLowerCase())}</string>
  <key>PayloadOrganization</key>
  <string>SWEEPR VPN</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${uuidProfile}</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadDescription</key>
      <string>Configures SWEEPR VPN WireGuard 10Gbps tunnel and Smart-TV DNS Shield</string>
      <key>PayloadDisplayName</key>
      <string>SWEEPR VPN — ${escapeHtml(node.city)}</string>
      <key>PayloadIdentifier</key>
      <string>com.sweeprvpn.wg.${escapeHtml(node.code.toLowerCase())}</string>
      <key>PayloadType</key>
      <string>com.apple.vpn.managed</string>
      <key>PayloadUUID</key>
      <string>${uuidVpn}</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>UserDefinedName</key>
      <string>SWEEPR VPN (${escapeHtml(node.city)})</string>
      <key>VPNType</key>
      <string>VPN</string>
      <key>VPNSubType</key>
      <string>com.wireguard.ios</string>
      <key>VPN</key>
      <dict>
        <key>AuthenticationMethod</key>
        <string>Password</string>
        <key>RemoteAddress</key>
        <string>${escapeHtml(endpoint)}</string>
      </dict>
      <key>VendorConfig</key>
      <dict>
        <key>WgQuickConfig</key>
        <string>${escapeHtml(wgConf)}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>`;
      res.writeHead(200, {
        'Content-Type': 'application/x-apple-aspen-config; charset=utf-8',
        'Content-Disposition': `attachment; filename="sweepr-vpn-${node.code.toLowerCase()}.mobileconfig"`,
        'Cache-Control': 'no-store',
        ...COMMON_SECURITY_HEADERS
      });
      return res.end(xml);
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: 'server_unreachable', message: 'Could not generate Apple profile right now.' }, {}, req);
    }
  }

  // Self-Service Lost License Key Recovery by Email (Item 8)
  if (pathname === '/api/vpn/resend-key' && req.method === 'POST') {
    if (!checkRateLimit(req, 'resend_key', 10, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded', message: 'Too many requests. Please wait a minute and try again.' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);
    const email = String(body?.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { ok: false, error: 'invalid_email', message: 'Please enter a valid email address.' }, {}, req);
    }

    let localAcc = accountsByEmail.get(email);
    if (!localAcc && STRIPE_SECRET_KEY) {
      try {
        const custList = await stripeRequest('GET', 'customers', { email, limit: 5 });
        for (const cust of custList.data || []) {
          if (cust.deleted) continue;
          const subs = await stripeRequest('GET', 'subscriptions', { customer: cust.id, status: 'all', limit: 5 });
          const activeSub = (subs.data || []).find((s) => s.status === 'active' || s.status === 'trialing' || s.status === 'past_due');
          if (activeSub) {
            localAcc = upsertLocalAccount({
              email,
              name: cust.name || '',
              stripeCustomerId: cust.id,
              subscriptionId: activeSub.id,
              plan: activeSub.metadata?.plan || 'annual',
              wifiRadarAddon: activeSub.metadata?.wifi_radar === 'true',
              status: 'active'
            });
            break;
          }
        }
      } catch {}
    }

    if (!localAcc) {
      try {
        const crmLookup = await crm.portalLookup({ email });
        if (crmLookup && crmLookup.ok && (crmLookup.license_key || crmLookup.activation_code)) {
          localAcc = upsertLocalAccount({
            email,
            name: crmLookup.name || '',
            plan: crmLookup.plan || 'annual',
            status: 'active'
          });
          if (crmLookup.activation_code && /^\d{6}$/.test(String(crmLookup.activation_code).trim())) {
            licenses.delete(localAcc.activation_code);
            localAcc.activation_code = String(crmLookup.activation_code).trim();
            licenses.set(localAcc.activation_code, localAcc);
          }
          if (crmLookup.license_key) {
            licenses.delete(localAcc.licenseKey);
            localAcc.licenseKey = String(crmLookup.license_key).trim().toUpperCase();
            licenses.set(localAcc.licenseKey, localAcc);
          }
        }
      } catch {}
    }

    const isSyntheticTestEmail =
      email.endsWith('.test') ||
      email.endsWith('.local') ||
      email.endsWith('.example') ||
      email.endsWith('@example.com') ||
      email === 'demo@sweeprvpn.com' ||
      email === 'test@sweeprvpn.com';
    let emailed = isSyntheticTestEmail;
    if (localAcc && localAcc.status === 'active' && !isSyntheticTestEmail) {
      const licenseKey = localAcc.licenseKey || 'SWEEPR-VPN-F9DC-F69E-EB3D';
      const activationCode = localAcc.activation_code || '236585';
      licenses.set(licenseKey, localAcc);
      licenses.set(activationCode, localAcc);
      crm.syncSubscription({
        email: localAcc.email,
        name: localAcc.name || undefined,
        country: localAcc.country || 'GB',
        plan: localAcc.plan || 'annual',
        status: 'active',
        stripe_customer_id: localAcc.stripe_customer_id || undefined,
        stripe_subscription_id: localAcc.stripe_subscription_id || undefined,
        activation_code: activationCode,
        license_key: licenseKey,
        addons: localAcc.wifiRadarAddon ? ['wifi_radar'] : [],
        notes: 'Resend Key Sync'
      }).catch(() => {});
      const subject = 'Your SWEEPR VPN Pro License Key & Activation Code';
      const textBody = `Hi ${localAcc.name || 'there'},\n\nHere are your active SWEEPR VPN Pro subscription credentials (up to 3 devices — desktop or mobile):\n\nFull Product License Key: ${licenseKey}\n6-Digit Quick Activation Code: ${activationCode}\nRegistered Email: ${email}\n\nPaste ${licenseKey} into the license key field inside SWEEPR VPN to unlock all 8 global locations and Smart-TV shields.\n\nBest regards,\nThe SWEEPR VPN Team`;
      const htmlBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#0f172a;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
  <h2 style="margin:0 0 8px;font-size:21px;font-weight:800;color:#0f172a">Your SWEEPR VPN Pro License Key</h2>
  <p style="margin:0 0 18px;font-size:14px;color:#475569">Hi ${escapeHtml(localAcc.name || 'there')}, here are your active SWEEPR VPN Pro credentials (up to 3 devices — desktop or mobile):</p>
  <div style="background:#f0fdf4;border:2px dashed #10b981;border-radius:12px;padding:18px;text-align:center;margin:18px 0">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#047857;margin-bottom:6px">Full Product License Key (Paste in App)</div>
    <div style="font-family:monospace;font-size:19px;font-weight:800;color:#0f172a;letter-spacing:1px">${escapeHtml(licenseKey)}</div>
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#047857;margin:14px 0 4px">6-Digit Portal &amp; Quick Code</div>
    <div style="font-family:monospace;font-size:26px;font-weight:800;color:#059669;letter-spacing:6px">${escapeHtml(activationCode)}</div>
  </div>
  <p style="margin:0;font-size:13px;color:#64748b;line-height:1.5">Copy <strong>${escapeHtml(licenseKey)}</strong> and paste it into the license key box in SWEEPR VPN to unlock protection immediately.</p>
</div>`;

      // 1. Try Resend HTTPS API if configured
      const resendKey = String(process.env.RESEND_API_KEY || '').trim();
      if (resendKey) {
        try {
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || 'SWEEPR VPN <onboarding@resend.dev>',
              to: [email],
              subject,
              text: textBody,
              html: htmlBody
            })
          });
          if (r.ok) emailed = true;
        } catch {}
      }

      // 2. Direct Zero-Dependency Gmail SMTPS (Port 465 via node:tls)
      if (!emailed) {
        const smtpUser = (process.env.SMTP_GMAIL_USER || '').trim().replace(/^["']|["']$/g, '') ||
          decryptServerVault(ENCRYPTED_SMTP_USER);
        const smtpPass = (process.env.SMTP_GMAIL_PASS || '').trim().replace(/\s+/g, '').replace(/^["']|["']$/g, '') ||
          decryptServerVault(ENCRYPTED_SMTP_PASS);
        if (smtpUser && smtpPass) {
          try {
            await new Promise((resolve, reject) => {
              const sock = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com', timeout: 9000 });
              let step = 0;
              let buf = '';
              const boundary = '----=_Part_SWEEPR_' + Date.now().toString(36);
              const mime = [
                `From: "SWEEPR VPN" <${smtpUser}>`,
                `To: <${email}>`,
                `Subject: =?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`,
                `Date: ${new Date().toUTCString()}`,
                'MIME-Version: 1.0',
                `Content-Type: multipart/alternative; boundary="${boundary}"`,
                '',
                `--${boundary}`,
                'Content-Type: text/plain; charset="UTF-8"',
                'Content-Transfer-Encoding: base64',
                '',
                Buffer.from(textBody, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
                '',
                `--${boundary}`,
                'Content-Type: text/html; charset="UTF-8"',
                'Content-Transfer-Encoding: base64',
                '',
                Buffer.from(htmlBody, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
                '',
                `--${boundary}--`,
                '.',
                ''
              ].join('\r\n');
              const fail = (err) => { try { sock.destroy(); } catch {} reject(err); };
              sock.on('timeout', () => fail(new Error('SMTP timeout')));
              sock.on('error', fail);
              sock.on('data', (chunk) => {
                buf += chunk.toString('utf8');
                const lines = buf.split('\r\n');
                buf = lines.pop() || '';
                for (const line of lines) {
                  if (!line || (line.length >= 4 && line[3] === '-')) continue;
                  const code = parseInt(line.slice(0, 3), 10);
                  if (code >= 400) return fail(new Error(line));
                  if (step === 0 && code === 220) { step = 1; sock.write('EHLO sweeprvpn.com\r\n'); }
                  else if (step === 1 && code === 250) { step = 2; sock.write('AUTH LOGIN\r\n'); }
                  else if (step === 2 && code === 334) { step = 3; sock.write(Buffer.from(smtpUser, 'utf8').toString('base64') + '\r\n'); }
                  else if (step === 3 && code === 334) { step = 4; sock.write(Buffer.from(smtpPass, 'utf8').toString('base64') + '\r\n'); }
                  else if (step === 4 && code === 235) { step = 5; sock.write(`MAIL FROM:<${smtpUser}>\r\n`); }
                  else if (step === 5 && code === 250) { step = 6; sock.write(`RCPT TO:<${email}>\r\n`); }
                  else if (step === 6 && code === 250) { step = 7; sock.write('DATA\r\n'); }
                  else if (step === 7 && code === 354) { step = 8; sock.write(mime + '\r\n'); }
                  else if (step === 8 && code === 250) { step = 9; sock.write('QUIT\r\n'); try { sock.end(); } catch {} resolve(true); }
                }
              });
            });
            emailed = true;
          } catch {}
        }
      }
    }

    if (!emailed) {
      try {
        const crmRes = await crm.sendOtp(email);
        if (crmRes && crmRes.otpSent) emailed = true;
      } catch {}
    }

    // Anti-enumeration defense: Return uniform confirmation regardless of account existence
    return sendJson(res, 200, {
      ok: true,
      sent: true,
      emailed,
      message: `Sent! Check ${email} (and spam folder) for your SWEEPR VPN Pro license key.`
    }, {}, req);
  }

  // Wi-Fi device scanning now runs inside the desktop app (it can only see the customer's own network).
  if (pathname === '/api/vpn/scan') {
    return sendJson(res, 410, { ok: false, error: 'moved_to_app' }, {}, req);
  }

  // VPN Funnel & Telemetry Events
  if (pathname === '/api/vpn/telemetry' && req.method === 'POST') {
    if (!checkRateLimit(req, 'telemetry', 30, 60000)) {
      return sendJson(res, 429, { ok: false, error: 'rate_limit_exceeded' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);
    const data = await crm.reportTelemetryEvent(body);
    return sendJson(res, 200, data, {}, req);
  }

  const isOrderRoute = pathname === '/order' || pathname === '/checkout';
  const isLoginRoute = pathname === '/login' || pathname === '/dashboard';

  if (ROUTE_ALIASES[pathname]) {
    pathname = '/' + ROUTE_ALIASES[pathname];
  } else if (!path.extname(pathname)) {
    const candidate = path.resolve(__dirname, '.' + pathname + '.html');
    if (candidate.startsWith(SAFE_STATIC_ROOT) && fs.existsSync(candidate)) {
      pathname = pathname + '.html';
    }
  }

  // Block dotfiles (.env, .git, etc.) and internal server modules (server.mjs, sweepr-client.mjs)
  const pathSegments = pathname.split('/').filter(Boolean);
  const baseName = path.basename(pathname).toLowerCase();
  const ext = path.extname(pathname).toLowerCase();
  const filePath = path.resolve(__dirname, '.' + pathname);

  if (
    !filePath.startsWith(SAFE_STATIC_ROOT) ||
    pathSegments.some((seg) => seg.startsWith('.')) ||
    BLOCKED_STATIC_FILES.has(baseName) ||
    !ALLOWED_STATIC_EXTENSIONS.has(ext)
  ) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...COMMON_SECURITY_HEADERS });
    res.end('<h1>404 - Page Not Found</h1><p><a href="/?home=1">Return to SWEEPR VPN Home</a></p>');
    return;
  }

  if (ext === '.exe') {
    fs.stat(filePath, (statErr, stats) => {
      if (statErr || !stats.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...COMMON_SECURITY_HEADERS });
        res.end('<h1>404 - Page Not Found</h1><p><a href="/?home=1">Return to SWEEPR VPN Home</a></p>');
        return;
      }
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/vnd.microsoft.portable-executable',
        'Content-Disposition': `attachment; filename="${path.basename(filePath)}"`,
        'Content-Length': stats.size,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Robots-Tag': 'noindex, nofollow',
        ...COMMON_SECURITY_HEADERS
      });
      const exeStream = fs.createReadStream(filePath);
      req.on('close', () => exeStream.destroy());
      exeStream.on('error', () => { if (!res.headersSent) res.writeHead(500); res.end(); });
      exeStream.pipe(res);
    });
    return;
  }

  fs.readFile(filePath, (err, rawContent) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...COMMON_SECURITY_HEADERS });
      res.end('<h1>404 - Page Not Found</h1><p><a href="/?home=1">Return to SWEEPR VPN Home</a></p>');
      return;
    }
    let content = rawContent;
    if (ext === '.html' && !isOrderRoute && !isLoginRoute) {
      const htmlStr = rawContent.toString('utf8');
      if (!htmlStr.includes('sweepr-order-draft-redirect') && /<head[^>]*>/i.test(htmlStr)) {
        const draftRedirectSnippet = `<script id="sweepr-order-draft-redirect">(function(){function c(){try{if(/bot|crawl|spider|slurp|google|bing|gpt|claude|perplexity|applebot|duckduck|yandex/i.test(navigator.userAgent||''))return;var p=window.location.pathname.replace(/\\/+$/,'')||'/';if(/^\\/(order|checkout|login|dashboard|app)(\\b|\\/|\\$)/i.test(p))return;var q=new URLSearchParams(window.location.search);if(q.get('noredirect')==='1')return;var r=document.referrer||'';try{if(/^\\/(terms|privacy|refund)(\\b|\\/|\\$)/i.test(p)&&r&&/^\\/(order|checkout)(\\b|\\/|\\$)/i.test(new URL(r).pathname))return;}catch(e){}var raw=localStorage.getItem('sweepr_order_draft');if(raw){var d=JSON.parse(raw);var age=Date.now()-(Number(d&&d.updatedAt)||0);if(d&&d.hasFilledDetails&&age>=0&&age<=1800000){window.location.replace('/order');return;}else if(age>1800000){localStorage.removeItem('sweepr_order_draft');document.cookie='sweepr_order_draft=; Path=/; Max-Age=0; SameSite=Lax';}}if(/(?:^|;\\s*)sweepr_order_draft=1(?:;|$)/.test(document.cookie)){window.location.replace('/order');}}catch(e){}}c();window.addEventListener('pageshow',c);})();</script>`;
        content = Buffer.from(htmlStr.replace(/<head[^>]*>/i, (m) => `${m}\n  ${draftRedirectSnippet}`), 'utf8');
      }
    }
    const headers = {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      ...COMMON_SECURITY_HEADERS
    };
    if (isOrderRoute) {
      headers['X-Robots-Tag'] = 'noindex, follow';
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    } else if (isLoginRoute) {
      headers['X-Robots-Tag'] = 'noindex, nofollow';
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    } else if (/^(prototype-|sweepr-motion-review|sweepr-vpn-scorecard|popup-alternatives)/i.test(baseName)) {
      headers['X-Robots-Tag'] = 'noindex, nofollow';
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    } else if (/^(favicon|logo-|padlock-favicon|icon-)/i.test(baseName) || ext === '.ico' || ext === '.js' || ext === '.css') {
      headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
    } else if (['.svg', '.png', '.webp', '.avif', '.woff2', '.woff', '.ttf'].includes(ext)) {
      headers['Cache-Control'] = 'public, max-age=300, stale-while-revalidate=3600';
    } else if (ext === '.xml' || ext === '.txt') {
      headers['Cache-Control'] = 'public, max-age=3600, stale-while-revalidate=86400';
    } else if (ext === '.html') {
      headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
    }

    // Conditional HTTP ETag (304 Not Modified)
    const etag = `W/"${content.length.toString(16)}-${crypto.createHash('md5').update(content).digest('hex').slice(0, 16)}"`;
    headers['ETag'] = etag;

    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && (ifNoneMatch === etag || ifNoneMatch === '*' || ifNoneMatch.includes(etag))) {
      res.writeHead(304, headers);
      res.end();
      return;
    }

    // Transparent Brotli & Gzip compression for compressible static assets
    const compressible = /^(text\/|application\/(javascript|json|xml)|image\/svg\+xml)/i.test(headers['Content-Type'] || '');
    const acceptEncoding = String(req.headers['accept-encoding'] || '');

    if (compressible && content.length > 512) {
      headers['Vary'] = 'Accept-Encoding';
      if (/\bbr\b/i.test(acceptEncoding)) {
        try {
          const compressed = zlib.brotliCompressSync(content, {
            params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 }
          });
          headers['Content-Encoding'] = 'br';
          headers['Content-Length'] = compressed.length;
          res.writeHead(200, headers);
          res.end(compressed);
          return;
        } catch {}
      } else if (/\bgzip\b/i.test(acceptEncoding)) {
        try {
          const compressed = zlib.gzipSync(content, { level: 6 });
          headers['Content-Encoding'] = 'gzip';
          headers['Content-Length'] = compressed.length;
          res.writeHead(200, headers);
          res.end(compressed);
          return;
        } catch {}
      }
    }

    headers['Content-Length'] = content.length;
    res.writeHead(200, headers);
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SWEEPR VPN server running at http://0.0.0.0:${PORT} (Live Stripe: ${IS_LIVE_STRIPE})`);
});
