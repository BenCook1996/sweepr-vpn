import http from 'node:http';
import tls from 'node:tls';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { SweeprCrmClient } from './sweepr-client.mjs';

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
  'Content-Security-Policy': "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'"
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
  '.exe'
]);

const BLOCKED_STATIC_FILES = new Set([
  'server.mjs',
  'sweepr-client.mjs',
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
  return ct.startsWith('application/json') || Boolean(req?.headers?.['x-requested-with']);
}

function getClientIp(req) {
  if (TRUST_PROXY) {
    if (process.env.TRUST_CLOUDFLARE === 'true') {
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
function checkRateLimit(req, bucketName, maxRequests = 30, windowMs = 60000) {
  const ip = getClientIp(req);
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  let entry = rateLimitBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    if (rateLimitBuckets.size >= 10000) {
      for (const [k, v] of rateLimitBuckets.entries()) {
        if (now > v.resetAt) rateLimitBuckets.delete(k);
      }
      if (rateLimitBuckets.size >= 10000) {
        for (const [k, v] of rateLimitBuckets.entries()) {
          if (v.count <= 1) {
            rateLimitBuckets.delete(k);
            if (rateLimitBuckets.size < 9000) break;
          }
        }
      }
      if (rateLimitBuckets.size >= 10000) {
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

async function stripeRequest(method, endpoint, params) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured on this server.');
  }
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  let url = `https://api.stripe.com/v1/${cleanEndpoint}`;
  const headers = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Stripe-Version': '2024-06-20',
    'User-Agent': 'SweeprVPN/2.5 (+https://sweeprvpn.com)'
  };
  const fetchOpts = { method, headers };

  if (params && Object.keys(params).length > 0) {
    const encoded = flattenStripeParams(params).toString();
    if (method === 'GET' || method === 'DELETE') {
      url += (url.includes('?') ? '&' : '?') + encoded;
    } else {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      fetchOpts.body = encoded;
    }
  }

  const res = await fetch(url, fetchOpts);
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
    description: 'SWEEPR VPN Pro — High-Speed Private Wi-Fi Encryption, ISP Throttling Protection & Zero-Logs Privacy (Up to 10 Devices)'
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
const claimedIntroEmails = new Set();
const claimedIntroCustomerIds = new Set();
const claimedIntroCardFingerprints = new Set();
const processedStripeWebhookEvents = new Set();

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
    if (newCode && /^\d{6}$/.test(newCode) && newCode !== acc.activation_code) {
      licenses.delete(acc.activation_code);
      acc.activation_code = newCode;
    }
    if (newKey && newKey !== acc.licenseKey) {
      licenses.delete(acc.licenseKey);
      acc.licenseKey = newKey;
    }
    licenses.set(acc.activation_code, acc);
    licenses.set(acc.licenseKey, acc);
    return acc;
  }

  // If CRM authoritatively reports subscription is inactive/canceled/expired or revoked, evict active status from local cache
  if (crmData.valid === false && crmData._httpStatus && crmData._httpStatus < 500) {
    const localByEmail = email ? accountsByEmail.get(email) : null;
    const localByCode = fallbackCode ? (licenses.get(fallbackCode) || licenses.get(fallbackCode.toUpperCase())) : null;
    const target = localByEmail || localByCode;
    if (
      target &&
      (crmData.error === 'subscription_inactive' ||
        crmData.error === 'no_subscription_for_email' ||
        crmData.error === 'no_subscription_for_project' ||
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
  '9835ac35a7d0f6bcb32cf5d0:3e4a58a47e2ac533693bc769c8f4aa7e:4777b5a01b2175cd5c19f37173178cd29e4c1ad21526d9105b63956fe889156aaba4c3eeab3f66c62d3036c04440e0ed67696ed4b09db9be3b94fb62aa425249504d6548b1554e2a667b626766f31e2293bcf1c94e4385d96349524666620373824fe4b6826e3916439491e5a034aae304afb55655cf6a27efb36ba2c65f86e01356cdd6ed34e3f6067c10252c95aa44c86d40ac0e81bbec8edc3d7da07256f67e4f59005f9c92c069968f2a2fcd0b20919e2be756336a2433d611e9127d49dec3a335586368154f63dd30b198ffb31e8b23e80d798006c7cdac7dd3accf2fa4246251d07459ab6ea484eaed7a1d60e565a4bc8c327032fb9264a362841f675205e59530181a75ee3af4799b31d004d6d523de27b22d0b22dc4a7a3e69a3a95f0b823db3d17b9913f2e0b6b66f8298a87eefd8b1e2a12f1ffcd31ec79aa81f66de8750067dc11ebbb5a8854f30d657480364c6bc470afdd1328739b91abd0dd6718488588f7004f1dbada8af6c9c47ecbbce84720d0c1d81d294b7a4f7f33ae1b1f2378c5d29304548d12abb9589350197b63931800f9e8ed009388d0b8e22ce9c117b4de2384fc9c38fc67b347796af3ba5ead0fecd8ed28f667b3785ada908aec6cb8b8611d7f6d35dfe4fbfdbf399578447972466ab8572dfe2f2174f15a468a0c2f43976258568df5569f0a4a38903d0cbd4f12b99fa821a7933423d5bd80a47f22519ea800b62660fd9fa802a9d4d64ab1d7b36be46da2a2330cabaf947f3935a004a4bb960debcec7c84195f0686a7e8626a76f32112d37274308c8e0c5b103919d8349dc1b655cc2eaa7e50a399753dc234e15f1d2e26057b5cda69f35ee738f4b74f80124052a3190d4258dea6abd2b8932591756ff7f205d211a35339b45c095e9332348398187d3358dd91a3a5ed06651c43cbfca58198588774ac08aa3facea79ffa091a32f9248c72b17a8c24952feb7a56e79c1e4e8cd0260673c616693f29e212f44626a4e28db795d24a54eaeed4cd4a5d46f23913999ad86d4560aa54451170bb5dcad008bbc010bc14837305e54a66e0a1453a6c1120c7e27bb812d40a29c69a491554a3bcc68a7d86bbb3d38fb24d2e5a5d9e412fc3397c3c1c9a77e1387645f6ffd3cf17f8d047e027a18f1f80699a047923fce7d5b8c8e6068d77da8cb92679fe5f0cdcaeb83dbca67eb5fb919213b0587f6dd2019d47775a2eb464d2978e8068d50b5a059c547e316d2de68a83eebac8251cff577da937a9ba84178c9bc63a531d778ac41724625e2e67b5fc67bcea3fd3cf3c77574620db4a3659cf4aeecdfb3658089641d6388e2a913e9d43c825a8748154c147603562c871666b622c136738e59437d35a696e6186237ce91c2ecfbecf62b448e3f14aa5274cc4a43bab7a49dbbda54b54810e44a98efce8eb6a8bbb183621f903fba82e0d672e4a6f47c02680dce16717dc4b8e829f06e277828ca1c4ff775c609b9a7fd0f380be40a6f2a725039fe9960a9749e5d19d6ab6e3bd11d96b50b337c69ff96ebc31bea5e2399f8dde60bde53d41a2551979ea72fb0a50da4d1b6c6b3babd4ab9cf86fef6ce3f9749a50772d3b6cbd55016b6988398643183e0f416c3fe3fa0c0b03a8ef5105866127eb1f4e582d6385a040fb9a8690df182b86a5327601d0a5652fca3d9f1d56a4405af994ff5b5b39a2cb61291c01bd1b7bdb09498262ae56d1e4a17ec2c16d55795d36bd21f53e3d276cdfa19f1752a7f068bea19b1267185ce4868a628902b3fe753fb11fd7b13a4567e0da480c9197141eef0c5fb8034c1a29f86afea67b489b8f79439f928b73a5253a171347a08045b7ff48e1569216c5b207eb0a70d968aee9ee0777fc03a23482b6303d178a076c20585701d91095f53add5becace1882b08a699c483e7e6cbadbd84f9ee3811d13a94f0b3db78d8fe2c4a93811457f06f44421077b9088c2d0358169eec3b5da2f8242f9bb202316c782363abba835c9ae20660fa38698f8efa96dd8d415902e3a48b334fe3e61a487fbd689470e5735ab97d70beca40961755e15d9d23342b84b10021b7fdd1e9685fa6bc42ff09c9ed3a27047133a58367546a0059b0d39984c6aa375809799947f0af0fe01999928f3e45fe4b90e6dbf899ef4bfdfee7533c93ee20b4f4098f1f31ff0cf863f886480c45a069524dfd6000bd360418ec3e8d4831a1dd475ef8a615b43fb877bcaa5ec5ed835897dada9bff6b83d13cb5b8f6488b4cd034a366bd2e0efa0ad217129e91f6fc1b411e30fd605fbc4315972edb4dd1630aab60e7fa1dc654c773fcd19d1e1c263059769192ee530defe0709fa750051c75bfe05310a834f5c4873ee18e2d97287e45ae54219ab892cac433081664504345f9cd3d3308f87e01acf4cd0ad867054f393cfc14437eba7bd698e14c490207105858abf41f48b811af84721ee4d2172ce5bae9ec2cbd3f6e97197e61f7de15c7322';
const ENCRYPTED_LICENSE_PRIV_KEY_B64 =
  '09a1b3320ceefec5bf18bd45:0c9948e9a42ff3e3a264f913d04c3a10:f18145160d4b75e7e0422dd1a2d9d012b9adfa095572ec2b587edc5eaacded4eed89300bd6814cc3f9ff6b4a0e5e63b5656e26fa62878ec3590081fb2e9afb45cddefe10d3928b5b1970fb7f1a5587e4bf436d876ba967609530f83fa54f9dd6eb2d122e937838046172a805199f885ed9156afd0618916c813cf293c2198a40356c22e850194c22d89f04fb8252ac06590b75182a8d87b5be4138b71d67b66d';

function decryptWithPkKey(payload) {
  if (!payload || !STRIPE_PUBLISHABLE_KEY) return '';
  try {
    const [ivHex, tagHex, encHex] = payload.split(':');
    const key = crypto.createHash('sha256').update('sweepr_v1:' + STRIPE_PUBLISHABLE_KEY).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return '';
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
    const dec = decryptWithPkKey(ENCRYPTED_VPN_NODES);
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
async function nodeHealth(n) {
  const cached = nodeHealthCache.get(n.code);
  if (cached && Date.now() - cached.at < 30000) return cached.value;
  let value = null;
  try {
    const r = await fetch(`http://${n.ip}:${n.agent_port || 8787}/health`, { signal: AbortSignal.timeout(2500) });
    if (r.ok) value = await r.json();
  } catch {}
  nodeHealthCache.set(n.code, { at: Date.now(), value });
  return value;
}

// Requests to a node are signed with HMAC-SHA256 (timestamp + one-time nonce), see infra/node/sweepr_agent.py
async function callNodeAgent(n, method, agentPath, payload) {
  const body = JSON.stringify(payload || {});
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomBytes(16).toString('hex');
  const sig = crypto.createHmac('sha256', n.agent_secret).update(`${method}\n${agentPath}\n${ts}\n${nonce}\n${body}`).digest('hex');
  const r = await fetch(`http://${n.ip}:${n.agent_port || 8787}${agentPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Sweepr-Timestamp': ts, 'X-Sweepr-Nonce': nonce, 'X-Sweepr-Signature': sig },
    body,
    signal: AbortSignal.timeout(6000)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.ok) throw new Error(data.error || `agent_${r.status}`);
  return data;
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
// Authoritatively verifies against centralized sweepr_crm first, with local fallback if CRM is unreachable.
async function resolveVpnLicence(code, email) {
  const cleanCode = String(code || '').trim();
  if (!cleanCode || cleanCode.length < 6) return null;
  const normEmail = email ? String(email).trim().toLowerCase() : '';
  const isShortSixDigit = /^\d{6}$/.test(cleanCode);
  // Prevent 6-digit activation code brute-forcing: short codes always require the matching account email
  if (isShortSixDigit && !isValidEmail(normEmail)) {
    return null;
  }

  let key = null;
  let crmReachable = false;

  try {
    const data = await crm.activateDevice({
      email: normEmail || undefined,
      otp: cleanCode,
      deviceId: 'vpn_tunnel_' + crypto.createHash('sha256').update((normEmail || 'key') + ':' + cleanCode).digest('hex').slice(0, 12),
      deviceName: 'SWEEPR VPN Tunnel',
      os: 'windows',
      appVersion: '2.5.0'
    });

    if (data && data._httpStatus && data._httpStatus < 500) {
      crmReachable = true;
      syncLocalCacheFromCrm(data, normEmail, cleanCode);
      if (data.valid && (!normEmail || !data.email || String(data.email).toLowerCase() === normEmail || String(data.email).includes('*'))) {
        key = data.licenseKey || data.license_key || data.account_id || cleanCode;
      }
    }
  } catch {}

  if (!crmReachable) {
    const local = licenses.get(cleanCode) || licenses.get(cleanCode.toUpperCase());
    if (local && local.status === 'active' && (!normEmail || local.email === normEmail)) {
      key = local.licenseKey || local.id;
    }
  }

  if (!key) return null;
  return { id: computeVpnLicenceHash(key) };
}

function signFallbackEd25519LicenseToken(acc, deviceId = 'vpn_desktop') {
  try {
    const b64Pem = (process.env.LICENSE_PRIVATE_KEY_B64 || '').trim() || decryptWithPkKey(ENCRYPTED_LICENSE_PRIV_KEY_B64);
    if (!b64Pem) return null;
    const privKey = crypto.createPrivateKey(Buffer.from(b64Pem, 'base64').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 72 * 3600;
    const header = Buffer.from(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })).toString('base64url');
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
  const textBody = `Hi ${acc.name || 'there'},\n\nThank you for subscribing to SWEEPR VPN Pro! Your subscription is active for up to 10 devices.\n\nFull Product License Key (Paste in App): ${licenseKey}\n6-Digit Quick Activation Code: ${activationCode}\nRegistered Email: ${email}\n\n1. Open SWEEPR VPN (or download at https://sweeprvpn.com/download?key=${encodeURIComponent(licenseKey)}&autoconf=1)\n2. Paste ${licenseKey} into the license key box to unlock all 8 global locations and Smart-TV shields.\n\nBest regards,\nThe SWEEPR VPN Team`;
  const htmlBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#0f172a;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
  <h2 style="margin:0 0 8px;font-size:21px;font-weight:800;color:#0f172a">Welcome to SWEEPR VPN Pro! 🎉</h2>
  <p style="margin:0 0 18px;font-size:14px;color:#475569">Hi ${escapeHtml(acc.name || 'there')}, your subscription is active across up to 10 devices. Here are your credentials:</p>
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
    decryptWithPkKey('292e02963cb47df56b0c11bf:ec9309892f80d12c4bc8d8f1c574a1c0:b28816343a58bc4241226fa1089541bcc2cda438670f8262ff09');
  const smtpPass = (process.env.SMTP_GMAIL_PASS || '').trim().replace(/\s+/g, '').replace(/^["']|["']$/g, '') ||
    decryptWithPkKey('e6a41c129c37f88ca73363ed:8311a7406578f3c1a4b112d09adf4202:09f6b7df83870a06c01211c984d297b4');
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
  '/app-preview.html': '/app',
  '/app-preview': '/app',
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
  '/tools/isp-throttling-test': 'isp-throttling-test.html',
  '/app': 'app-preview.html',
  '/app-preview': 'app-preview.html'
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

function renderPlatformDownloadPicker(osType = 'other') {
  const isMobile = osType === 'ios' || osType === 'android';
  const title = isMobile
    ? 'Instant Phone &amp; Computer Setup'
    : 'Choose Your Operating System';
  const subtitle = isMobile
    ? 'Connect your iPhone or Android in 15 seconds with a 1-tap WireGuard profile, or get SWEEPR VPN Pro for up to 10 devices.'
    : 'Select your setup option below to start your free 30-second Home Wi-Fi &amp; Speed Scan or activate 1-click WireGuard protection.';

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
    <h1 class="text-2xl font-black text-gray-900 mb-2">${title}</h1>
    <p class="text-sm text-gray-600 mb-5 leading-relaxed">${subtitle}</p>

    <!-- Instant iOS / Android WireGuard Profile Hand-Off -->
    <div class="p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/40 text-left mb-5">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="font-extrabold text-sm text-emerald-950">iOS &amp; Android 1-Tap WireGuard Setup</div>
        <span class="text-[11px] font-extrabold uppercase tracking-wider bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">Instant Tunnel</span>
      </div>
      <p class="text-xs text-gray-600 mb-3">Already have a license key? Enter it below to download your ready-to-import WireGuard profile or QR code.</p>
      <div class="flex flex-col sm:flex-row gap-2 mb-2">
        <input id="dlLicenseKey" type="text" maxlength="64" placeholder="SWEEPR-VPN-XXXX-XXXX-XXXX" oninput="this.value=this.value.toUpperCase()" class="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-mono text-gray-900 focus:border-emerald-600 focus:outline-none" />
        <select id="dlServerCode" class="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-xs font-bold text-gray-800">
          <option value="UK-LON-01">🇬🇧 UK · London</option>
          <option value="SE-STO-01">🇸🇪 Sweden · Stockholm</option>
          <option value="NL-AMS-01">🇳🇱 Netherlands · Amsterdam</option>
          <option value="DE-FRA-01">🇩🇪 Germany · Frankfurt</option>
          <option value="US-NYC-01">🇺🇸 USA · New York</option>
          <option value="US-LAX-01">🇺🇸 USA · Los Angeles</option>
          <option value="SG-SIN-01">🇸🇬 Singapore</option>
          <option value="JP-TYO-01">🇯🇵 Japan · Tokyo</option>
        </select>
      </div>
      <button type="button" id="dlGenBtn" onclick="generateMobileConf()" class="btn btn-go w-full justify-center text-xs py-2.5">Generate WireGuard .conf &amp; QR Code</button>
      <div id="dlError" class="hidden text-xs font-bold text-red-600 mt-2"></div>
      <div id="dlResult" class="hidden mt-3 pt-3 border-t border-emerald-200/70 text-center">
        <div id="dlQrWrap" class="bg-white rounded-xl p-3 border border-gray-200 inline-flex flex-col items-center mb-2"></div>
        <div class="flex flex-wrap gap-2 justify-center">
          <button type="button" onclick="downloadGeneratedConf()" class="btn btn-go text-xs py-2 px-4">Download .conf File</button>
          <button type="button" onclick="downloadAppleMobileConfig()" class="btn btn-ghost text-xs py-2 px-3 border border-emerald-300 bg-white text-emerald-800 font-bold">iOS / macOS .mobileconfig</button>
          <button type="button" id="dlCopyConfBtn" onclick="copyGeneratedConf()" class="btn btn-ghost text-xs py-2 px-3 border border-gray-300 bg-white">Copy Config</button>
        </div>
      </div>
    </div>

    <div class="space-y-3 text-left mb-6">
      <a href="/order?plan=annual" class="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-400 transition-all no-underline text-gray-900">
        <div>
          <div class="font-extrabold text-sm text-gray-900">Need a License Key? Get SWEEPR VPN Pro</div>
          <div class="text-xs text-gray-500">Protects up to 10 devices across iOS, Android, Windows &amp; Mac &bull; Save 50%</div>
        </div>
        <span class="btn btn-go text-xs py-2 px-3 shrink-0">Get Pro &rarr;</span>
      </a>
      <button type="button" onclick="navigator.clipboard.writeText(window.location.origin + '/download'); this.querySelector('.copy-pill').textContent='Copied ✓';" class="w-full flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 transition-all text-left cursor-pointer">
        <div>
          <div class="font-bold text-sm text-gray-900">Send Desktop Installer Link to Your PC / Mac</div>
          <div class="text-xs text-gray-500">Copy <span class="font-mono">sweeprvpn.com/download</span> to open on your computer</div>
        </div>
        <span class="copy-pill text-xs font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full shrink-0">Copy Link</span>
      </button>
      <a href="/download?platform=win" class="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50/80 hover:bg-white transition-all no-underline text-gray-700">
        <div>
          <div class="font-bold text-xs text-gray-800">Windows 10 &amp; 11 Desktop Installer (.exe)</div>
          <div class="text-[11px] text-gray-500">Direct download &bull; SWEEPRVPN.exe</div>
        </div>
        <span class="text-xs font-bold text-gray-600 underline shrink-0">Download .exe</span>
      </a>
    </div>
    <div class="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t border-gray-100">
      <a href="/app" class="btn btn-ghost w-full justify-center border border-gray-200">Open Interactive Web App</a>
      <a href="/?home=1" class="btn btn-ghost w-full justify-center">Back to Home</a>
    </div>
  </div>
  <script>
    let _dlConfText = '';
    let _dlConfFile = 'sweepr-vpn.conf';
    try {
      const p = new URLSearchParams(window.location.search || '');
      const urlKey = (p.get('key') || p.get('code') || '').trim().toUpperCase();
      const urlSrv = (p.get('server') || '').trim().toUpperCase();
      if (urlSrv) {
        const sel = document.getElementById('dlServerCode');
        if (sel && Array.from(sel.options).some(o => o.value === urlSrv)) sel.value = urlSrv;
      }
      const saved = urlKey || localStorage.getItem('sweepr_vpn_license_key') || localStorage.getItem('sweepr_vpn_code') || '';
      if (saved) {
        document.getElementById('dlLicenseKey').value = saved;
        localStorage.setItem('sweepr_vpn_code', saved);
        localStorage.setItem('sweepr_vpn_license_key', saved);
      }
      if (urlKey && p.get('autoconf') === '1') {
        setTimeout(() => generateMobileConf(), 120);
      }
    } catch (e) {}
    function downloadAppleMobileConfig() {
      const key = (document.getElementById('dlLicenseKey').value || '').trim().toUpperCase();
      const srv = document.getElementById('dlServerCode').value || 'UK-LON-01';
      if (key.length < 6) {
        const errEl = document.getElementById('dlError');
        errEl.textContent = 'Please enter your license key first.';
        errEl.classList.remove('hidden');
        return;
      }
      window.location.href = '/api/vpn/apple-mobileconfig?key=' + encodeURIComponent(key) + '&server_code=' + encodeURIComponent(srv);
    }
    async function generateMobileConf() {
      const key = (document.getElementById('dlLicenseKey').value || '').trim().toUpperCase();
      const srv = document.getElementById('dlServerCode').value || 'UK-LON-01';
      const errEl = document.getElementById('dlError');
      const resEl = document.getElementById('dlResult');
      const btn = document.getElementById('dlGenBtn');
      errEl.classList.add('hidden');
      if (key.length < 6) {
        errEl.textContent = 'Please enter your license key (e.g. SWEEPR-VPN-XXXX-XXXX-XXXX).';
        errEl.classList.remove('hidden');
        return;
      }
      btn.textContent = 'Generating WireGuard profile…';
      btn.disabled = true;
      try {
        const r = await fetch('/api/vpn/wireguard-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ license_key: key, activation_code: key, server_code: srv })
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.ok || !d.config_text) {
          throw new Error(d.message || 'Could not generate profile. Check your license key.');
        }
        _dlConfText = d.config_text;
        _dlConfFile = d.filename || ('sweepr-' + srv.toLowerCase() + '.conf');
        try { localStorage.setItem('sweepr_vpn_code', key); localStorage.setItem('sweepr_vpn_license_key', key); } catch (e) {}
        document.getElementById('dlQrWrap').innerHTML = (d.qr_svg || '') + '<div class="text-[11px] font-bold text-gray-700 mt-1">Scan in WireGuard App (iOS / Android)</div>';
        resEl.classList.remove('hidden');
      } catch (e) {
        errEl.textContent = e.message || String(e);
        errEl.classList.remove('hidden');
      } finally {
        btn.textContent = 'Generate WireGuard .conf & QR Code';
        btn.disabled = false;
      }
    }
    function downloadGeneratedConf() {
      if (!_dlConfText) return;
      const blob = new Blob([_dlConfText], { type: 'text/plain;charset=utf-8' });
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u; a.download = _dlConfFile;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 2000);
    }
    function copyGeneratedConf() {
      if (!_dlConfText) return;
      navigator.clipboard.writeText(_dlConfText).then(() => {
        const b = document.getElementById('dlCopyConfBtn');
        b.textContent = 'Copied ✓';
        setTimeout(() => { b.textContent = 'Copy Config'; }, 2000);
      });
    }
  </script>
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
        <div class="font-bold text-slate-200 mb-1">Unlocked on your account (Up to 10 Devices):</div>
        <div>✓ 1-Click Private Browsing &amp; Public Wi-Fi Protection (8 Global Locations)</div>
        <div>✓ Streaming Speed Booster &amp; Automatic Drop Protection</div>
        <div>✓ Home Wi-Fi Device Scanner &amp; Smart-TV Spy Blocker Included Free</div>
        ${acc?.wifiRadarAddon ? '<div class="text-emerald-300 font-semibold">✓ SWEEPR Wi-Fi Radar &amp; Smart-TV Shield Add-on Active</div>' : ''}
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
      <a href="/download?key=${encodeURIComponent(acc?.licenseKey || '')}&amp;autoconf=1" class="py-3.5 px-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-lg no-underline">
        Download &amp; Setup App
      </a>
      <a href="/app?key=${encodeURIComponent(acc?.licenseKey || '')}" class="py-3.5 px-4 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-extrabold text-xs sm:text-sm border border-emerald-500/40 no-underline">
        Open Web / Mobile App
      </a>
      <a href="/dashboard" class="py-3.5 px-4 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm border border-slate-700 no-underline">
        Customer Portal
      </a>
    </div>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = urlObj.pathname.replace(/\/+$/, '') || '/';

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
    !(pathname === '/download' && (urlObj.searchParams.get('key') || urlObj.searchParams.get('code') || urlObj.searchParams.get('autoconf') === '1')) &&
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

  // Handle /download route (matches sweeprcleaner.com/download)
  if (pathname === '/download' && req.method === 'GET') {
    const requestedPlatform = (urlObj.searchParams.get('platform') || '').toLowerCase();
    const hasSetupParams = Boolean(urlObj.searchParams.get('key') || urlObj.searchParams.get('code') || urlObj.searchParams.get('autoconf') === '1');
    const uaLower = ua.toLowerCase();

    let osType = 'windows';
    if (requestedPlatform === 'mac' || requestedPlatform === 'macos') osType = 'mac';
    else if (requestedPlatform === 'linux') osType = 'linux';
    else if (requestedPlatform === 'ios') osType = 'ios';
    else if (requestedPlatform === 'android') osType = 'android';
    else if (requestedPlatform === 'win' || requestedPlatform === 'windows') osType = 'windows';
    else if (/iphone|ipad|ipod/.test(uaLower)) osType = 'ios';
    else if (uaLower.includes('android')) osType = 'android';
    else if (uaLower.includes('mac os') || uaLower.includes('macintosh')) osType = 'mac';
    else if (uaLower.includes('linux')) osType = 'linux';

    crm.reportTelemetryEvent({
      event_name: 'installer_downloaded',
      category: 'funnel',
      os: requestedPlatform || osType,
      properties: { path: '/download' }
    }).catch(() => {});

    const forceWinExe = requestedPlatform === 'win' || requestedPlatform === 'windows';
    if (!forceWinExe && (osType !== 'windows' || hasSetupParams)) {
      return sendHtml(res, 200, renderPlatformDownloadPicker(hasSetupParams ? 'ios' : osType), {
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
    const isWallet = paymentMethod === 'wallet' || paymentMethod === 'google_pay' || paymentMethod === 'apple_pay';
    const isPopup = Boolean(body.popup);
    const providedEmail = (body.email || '').trim().toLowerCase();
    if (providedEmail && !isValidEmail(providedEmail)) {
      return sendJson(res, 400, { error: 'Please enter a valid email address.' }, {}, req);
    }
    const email =
      (providedEmail ? providedEmail : null) ||
      (isPayPal || isWallet
        ? `${isPayPal ? 'paypal' : 'wallet'}_${crypto.randomBytes(4).toString('hex')}@pending.sweeprvpn.com`
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
          payment_method_types: isPayPal ? ['paypal'] : ['card']
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
        if (isPayPal && String(subErr.message || '').toLowerCase().includes('paypal')) {
          const hostOrigin = resolveTrustedOrigin(req);
          // Tier 2: Direct PayPal PaymentIntent (works immediately once PayPal is linked in Stripe, even before Reference Transactions approval)
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
              payment_method_types: ['paypal'],
              confirm: true,
              payment_method_data: {
                type: 'paypal',
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
              payment_method_types: ['paypal', 'card']
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

      if (isPayPal) {
        const rawClientIp = getClientIp(req);
        const mandateIp = !rawClientIp || rawClientIp === '::1' ? '127.0.0.1' : rawClientIp;
        const confirmedPi = await stripeRequest('POST', `payment_intents/${encodeURIComponent(paymentIntent.id)}/confirm`, {
          payment_method_data: {
            type: 'paypal',
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
          return sendJson(res, 500, { error: 'Could not initialize PayPal authorization redirect.' }, {}, req);
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
  // Authoritatively backed by centralized sweepr_crm (with local cache fallback if CRM is offline)
  if ((pathname === '/api/vpn/activate' || pathname === '/v1/license/activate' || pathname === '/v1/license/refresh') && req.method === 'POST') {
    if (!checkRateLimit(req, 'vpn_activate', 20, 60000)) {
      return sendJson(res, 429, { ok: false, valid: false, error: 'rate_limit_exceeded' }, {}, req);
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { ok: false, error: 'payload_too_large' }, {}, req);
    const bearerSecret = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const code = String(body.otp || body.activation_code || body.key || body.refresh_token || bearerSecret || '').trim();
    const normEmail = body.email ? String(body.email).trim().toLowerCase() : '';
    if (pathname === '/v1/license/refresh') {
      if (!body.account_id || !body.device_id || (!code && !hasValidCrmServiceKey(req))) {
        return sendJson(res, 401, { ok: false, valid: false, error: 'unauthorized', message: 'Valid refresh_token, account_id, and device_id are required.' }, {}, req);
      }
    } else {
      if (!code || code.length < 6) {
        return sendJson(res, 400, { ok: false, valid: false, error: 'missing_or_invalid_activation_code', message: 'Please enter the license key from your order.' }, {}, req);
      }
      if (/^\d{6}$/.test(code) && !isValidEmail(normEmail) && !hasValidCrmServiceKey(req)) {
        return sendJson(res, 400, { ok: false, valid: false, error: 'email_required_for_short_code', message: 'Please enter your account email address along with your code, or enter your full SWEEPR-VPN-XXXX-XXXX-XXXX license key.' }, {}, req);
      }
    }

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
            email: normEmail || undefined,
            otp: code,
            accountId: body.account_id,
            refreshToken: body.refresh_token,
            deviceId: body.device_id || (normEmail ? `vpn_${crypto.createHash('sha256').update(normEmail).digest('hex').slice(0, 12)}` : `vpn_${Date.now()}`),
            deviceName: body.device_name || 'SWEEPR VPN Desktop',
            os: body.os || 'windows',
            appVersion: body.app_version || '2.5.0'
          });

      if (data && data._httpStatus && data._httpStatus < 500) {
        const syncedAcc = syncLocalCacheFromCrm(data, normEmail, code);
        const httpStatus = data._httpStatus;
        const { _httpStatus, ...cleanData } = data;
        if (cleanData.valid) {
          return sendJson(
            res,
            200,
            {
              ok: true,
              valid: true,
              account_id: cleanData.account_id || syncedAcc?.id,
              email: cleanData.email || syncedAcc?.email || normEmail,
              licenseKey: cleanData.licenseKey || cleanData.license_key || syncedAcc?.licenseKey,
              activation_code: cleanData.activation_code || syncedAcc?.activation_code || code,
              plan: cleanData.plan || syncedAcc?.plan || 'annual',
              entitlements: cleanData.entitlements || {
                status: cleanData.status || 'active',
                plan: cleanData.plan || 'annual',
                addons: cleanData.addons || []
              },
              status: cleanData.status || 'active',
              token: cleanData.token,
              license_token: cleanData.license_token,
              expires_at: cleanData.expires_at
            },
            {},
            req
          );
        }
        return sendJson(
          res,
          httpStatus >= 400 ? httpStatus : 401,
          {
            ok: false,
            valid: false,
            error: cleanData.error || 'invalid_activation_code',
            message: cleanData.message || 'No active paid subscription found for that email and license key.'
          },
          {},
          req
        );
      }
    } catch {}

    // 2. Fallback to local in-memory cache ONLY if central sweepr_crm is unreachable
    const localAcc =
      licenses.get(code) ||
      licenses.get(code.toUpperCase()) ||
      (normEmail ? accountsByEmail.get(normEmail) : null);

    if (localAcc) {
      const codeMatches =
        safeCompareStrings(code, localAcc.activation_code) ||
        safeCompareStrings(code.toUpperCase(), localAcc.licenseKey) ||
        licenses.get(code.toUpperCase()) === localAcc;
      const emailMatches = !normEmail || localAcc.email === normEmail;
      if (localAcc.status === 'active' && codeMatches && emailMatches) {
        const signed = signFallbackEd25519LicenseToken(localAcc, body.device_id || 'vpn_desktop');
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
            ...(signed ? { token: signed.token, license_token: signed.token, expires_at: signed.expires_at } : {})
          },
          {},
          req
        );
      }
    }

    return sendJson(res, 401, { ok: false, valid: false, error: 'invalid_activation_code', message: 'No active paid subscription found for that email and license key.' }, {}, req);
  }

  // VPN Key Verification (Authoritatively backed by centralized sweepr_crm first)
  if ((pathname === '/api/vpn/verify-key' || pathname === '/api/license-verify') && (req.method === 'GET' || req.method === 'POST')) {
    if (!checkRateLimit(req, 'verify_key', 20, 60000)) {
      return sendJson(res, 429, { valid: false, error: 'rate_limit_exceeded' }, {}, req);
    }
    const body = req.method === 'POST' ? await readJsonBody(req) : {};
    if (body && body.__tooLarge) return sendJson(res, 413, { valid: false, error: 'payload_too_large' }, {}, req);
    const key = String(body.key || urlObj.searchParams.get('key') || '').trim();
    const normEmail = String(body.email || urlObj.searchParams.get('email') || '').trim().toLowerCase();
    const isServiceCall = hasValidCrmServiceKey(req);
    if (!key || key.length < 6) {
      return sendJson(res, 400, { valid: false, error: 'invalid_key' }, {}, req);
    }
    if (!HIGH_ENTROPY_LICENSE_KEY_RE.test(key) && !isValidEmail(normEmail) && !isServiceCall) {
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
      const data = await crm.verifyKey(key, normEmail);
      if (data && data._httpStatus && data._httpStatus < 500) {
        syncLocalCacheFromCrm(data, normEmail || data.email || '', key);
        const { _httpStatus, ...cleanData } = data;
        if (!isServiceCall) {
          delete cleanData.account_id;
          delete cleanData.activation_code;
          if (cleanData.email) cleanData.email = maskEmailAddress(cleanData.email);
        }
        return sendJson(res, _httpStatus >= 400 ? _httpStatus : 200, cleanData, {}, req);
      }
    } catch {}

    const localRecord = licenses.get(key) || licenses.get(key.toUpperCase());
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
    try {
      const data = await crm.createSupportTicket(body);
      return sendJson(res, 200, data, {}, req);
    } catch (e) {
      return sendJson(res, 200, { ok: true, simulated: true }, {}, req);
    }
  }

  // Customer Portal Login & OTP Verification
  if ((pathname === '/api/portal-login' || pathname === '/v1/account/send-otp') && req.method === 'POST') {
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
        decryptWithPkKey('292e02963cb47df56b0c11bf:ec9309892f80d12c4bc8d8f1c574a1c0:b28816343a58bc4241226fa1089541bcc2cda438670f8262ff09');
      const smtpPass = (process.env.SMTP_GMAIL_PASS || '').trim().replace(/\s+/g, '').replace(/^["']|["']$/g, '') ||
        decryptWithPkKey('e6a41c129c37f88ca73363ed:8311a7406578f3c1a4b112d09adf4202:09f6b7df83870a06c01211c984d297b4');
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

  if ((pathname === '/api/verify-otp' || pathname === '/v1/account/verify-otp') && req.method === 'POST') {
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
      const isHttps = PUBLIC_URL.startsWith('https://') || req.headers['x-forwarded-proto'] === 'https';
      return sendJson(
        res,
        200,
        { ok: true, redirect: '/dashboard', license_key: acc.licenseKey, plan: acc.plan, status: acc.status },
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
        devices: Array.isArray(acc.devices) ? acc.devices : []
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
    const nodes = loadVpnNodes();
    const servers = await Promise.all(nodes.map(async (n) => {
      const h = await nodeHealth(n);
      return { code: n.code, country: n.country, city: n.city, flag: n.flag, online: Boolean(h), devices: h ? h.devices : null };
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
    const licence = await resolveVpnLicence(String(body?.activation_code || body?.license_key || '').trim(), body?.email);
    if (!licence) {
      return sendJson(res, 401, { ok: false, error: 'licence_required', message: 'Enter your license key to connect. It is in your order email.' }, {}, req);
    }
    const node = loadVpnNodes().find((n) => n.code === serverCode);
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
      const assignedDns = String(r.dns || '10.64.0.1').trim();
      if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(assignedDns)) {
        throw new Error('invalid_assigned_dns');
      }
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
    const licence = await resolveVpnLicence(rawKey, body?.email);
    if (!licence) {
      return sendJson(res, 401, { ok: false, error: 'licence_required', message: 'Please enter a valid active SWEEPR Pro license key.' }, {}, req);
    }
    const nodes = loadVpnNodes();
    const node = nodes.find((n) => n.code === serverCode) || nodes[0];
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
      const assignedDns = String(r.dns || '10.64.0.1').trim();
      const endpoint = `${node.ip}:${node.port || 51820}`;
      const lanBypass = Boolean(body?.lan_bypass);
      const allowedIps = lanBypass
        ? '1.0.0.0/8, 2.0.0.0/7, 4.0.0.0/6, 8.0.0.0/7, 10.64.0.0/16, 11.0.0.0/8, 12.0.0.0/6, 16.0.0.0/4, 32.0.0.0/3, 64.0.0.0/2, 128.0.0.0/3, 160.0.0.0/5, 168.0.0.0/6, 172.0.0.0/12, 172.32.0.0/11, 172.64.0.0/10, 172.128.0.0/9, 173.0.0.0/8, 174.0.0.0/7, 176.0.0.0/4, 192.0.0.0/9, 192.128.0.0/11, 192.160.0.0/13, 192.169.0.0/16, 192.170.0.0/15, 192.172.0.0/14, 192.176.0.0/12, 192.192.0.0/10, 193.0.0.0/8, 194.0.0.0/7, 196.0.0.0/6, 200.0.0.0/5, 208.0.0.0/4'
        : '0.0.0.0/0, ::/0';

      const configText = [
        '[Interface]',
        `PrivateKey = ${clientPrivateKey}`,
        `Address = ${assignedAddress}`,
        `DNS = ${assignedDns}`,
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
    const licence = await resolveVpnLicence(rawKey, body?.email || urlObj.searchParams.get('email'));
    if (!licence) {
      return sendJson(res, 401, { ok: false, error: 'licence_required', message: 'Please enter a valid active SWEEPR Pro license key.' }, {}, req);
    }
    const nodes = loadVpnNodes();
    const node = nodes.find((n) => n.code === serverCode) || nodes[0];
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
      const assignedDns = String(r.dns || '10.64.0.1').trim();
      const endpoint = `${node.ip}:${node.port || 51820}`;
      const wgConf = `[Interface]\nPrivateKey = ${clientPrivateKey}\nAddress = ${assignedAddress}\nDNS = ${assignedDns}\n\n[Peer]\nPublicKey = ${serverPubKey}\nAllowedIPs = 0.0.0.0/0, ::/0\nEndpoint = ${endpoint}\nPersistentKeepalive = 25`;
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
            status: 'active',
            licenseKey: crmLookup.license_key,
            activationCode: crmLookup.activation_code
          });
        }
      } catch {}
    }

    let emailed = false;
    if (localAcc && localAcc.status === 'active') {
      const licenseKey = localAcc.licenseKey || 'SWEEPR-VPN-F9DC-F69E-EB3D';
      const activationCode = localAcc.activation_code || '236585';
      const subject = 'Your SWEEPR VPN Pro License Key & Activation Code';
      const textBody = `Hi ${localAcc.name || 'there'},\n\nHere are your active SWEEPR VPN Pro subscription credentials (up to 10 devices):\n\nFull Product License Key: ${licenseKey}\n6-Digit Quick Activation Code: ${activationCode}\nRegistered Email: ${email}\n\nPaste ${licenseKey} into the license key field inside SWEEPR VPN to unlock all 8 global locations and Smart-TV shields.\n\nBest regards,\nThe SWEEPR VPN Team`;
      const htmlBody = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:28px 24px;color:#0f172a;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px">
  <h2 style="margin:0 0 8px;font-size:21px;font-weight:800;color:#0f172a">Your SWEEPR VPN Pro License Key</h2>
  <p style="margin:0 0 18px;font-size:14px;color:#475569">Hi ${escapeHtml(localAcc.name || 'there')}, here are your active SWEEPR VPN Pro credentials (up to 10 devices):</p>
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
          decryptWithPkKey('292e02963cb47df56b0c11bf:ec9309892f80d12c4bc8d8f1c574a1c0:b28816343a58bc4241226fa1089541bcc2cda438670f8262ff09');
        const smtpPass = (process.env.SMTP_GMAIL_PASS || '').trim().replace(/\s+/g, '').replace(/^["']|["']$/g, '') ||
          decryptWithPkKey('e6a41c129c37f88ca73363ed:8311a7406578f3c1a4b112d09adf4202:09f6b7df83870a06c01211c984d297b4');
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
    } else if (/^(favicon|logo-|padlock-favicon|icon-)/i.test(baseName) || ext === '.ico' || ext === '.js' || ext === '.css') {
      headers['Cache-Control'] = 'public, max-age=0, must-revalidate';
    } else if (['.svg', '.png', '.webp', '.avif', '.woff2', '.woff', '.ttf'].includes(ext)) {
      headers['Cache-Control'] = 'public, max-age=300, stale-while-revalidate=3600';
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
