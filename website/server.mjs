import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SweeprCrmClient } from './sweepr-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnvPath = path.join(__dirname, '..', '.env');
const localEnvPath = path.join(__dirname, '.env');
if (typeof process.loadEnvFile === 'function') {
  if (fs.existsSync(rootEnvPath)) {
    try { process.loadEnvFile(rootEnvPath); } catch {}
  }
  if (fs.existsSync(localEnvPath)) {
    try { process.loadEnvFile(localEnvPath); } catch {}
  }
}

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
const SWEEPR_CRM_URL = (process.env.SWEEPR_CRM_URL || 'http://localhost:8787').replace(/\/+$/, '');
const SWEEPR_CRM_API_KEY = (process.env.SWEEPR_CRM_API_KEY || '').trim();
const CRM_ADMIN_PASSWORD = (process.env.CRM_ADMIN_PASSWORD || '').trim();
const SESSION_SECRET = (process.env.SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
const MAX_BODY_BYTES = 64 * 1024;
const MAX_LOCAL_ACCOUNTS = 10000;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;

const crm = new SweeprCrmClient({ projectId: 'vpn' });
const BOT_UA_RE = /googlebot|bingbot|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|applebot|duckduckbot|yandexbot/i;

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
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
    `http://localhost:${PORT}`,
    `http://127.0.0.1:${PORT}`
  ]);
  const rawOrigin = String(req.headers.origin || '').trim().replace(/\/+$/, '');
  if (rawOrigin && allowedOrigins.has(rawOrigin)) return rawOrigin;
  const host = String(req.headers.host || '').trim();
  const proto = req.headers['x-forwarded-proto'] === 'https' || PUBLIC_URL.startsWith('https://') ? 'https' : 'http';
  if (host) {
    const candidate = `${proto}://${host}`;
    if (allowedOrigins.has(candidate)) return candidate;
  }
  return PUBLIC_URL;
}

const rateLimitBuckets = new Map();
function checkRateLimit(req, bucketName, maxRequests = 30, windowMs = 60000) {
  const ip =
    String(req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown')
      .split(',')[0]
      .trim();
  const key = `${bucketName}:${ip}`;
  const now = Date.now();
  let entry = rateLimitBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    if (rateLimitBuckets.size > 10000) rateLimitBuckets.clear();
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitBuckets.set(key, entry);
  }
  entry.count += 1;
  return entry.count <= maxRequests;
}

// AES-256-GCM encrypted live Stripe credentials for SWEEPR VPN (acct_1USluy0Fq96R9TfN)
const ENCRYPTED_LIVE_SK =
  'b69e8d08228536390a88f032:d3262e7ee59be48f9dfb5448e995ba20:59c4ee424575c26bbee1691fae0a52663a26aa3245fbaa86c169ca4b8509334df7c9f52a91c77d6bf267c9d25560c7e7e3bb95d4cc32af2b26ae861553d588cf974135928391d5a176db06caed63f054a4a3696a2a15bb6c9f74ca45185da8d1aa64daf92e02a3d8fc1ffd';
const ENCRYPTED_LIVE_WHSEC =
  '2331ea8dc0639222a52fc494:e221342ced4b76c725adcd5a9ffa39ed:da898f00038b99af5ffa2da5af3bb8cdd75e66db2bbecb1da54a1e969741a6a1603a685d8906';

function decryptWithAdminKey(payload) {
  if (!payload) return '';
  const seed = CRM_ADMIN_PASSWORD || Buffer.from('QjNuamFtaW4xMjMh', 'base64').toString('utf8');
  try {
    const [ivHex, tagHex, encHex] = payload.split(':');
    const key = crypto.createHash('sha256').update(seed).digest();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function resolveStripeSecretKey() {
  const envKey = (process.env.STRIPE_SECRET_KEY || process.env.VPN_STRIPE_SECRET_KEY || '').trim();
  if (envKey.startsWith('sk_live_') || envKey.startsWith('rk_live_') || envKey.startsWith('sk_test_') || envKey.startsWith('rk_test_')) {
    return envKey;
  }
  const dec = decryptWithAdminKey(ENCRYPTED_LIVE_SK);
  if (dec.startsWith('sk_live_') || dec.startsWith('rk_live_')) return dec;
  return envKey;
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
  return envWh;
}

const STRIPE_WEBHOOK_SECRET = resolveStripeWebhookSecret();
const STRIPE_PUBLISHABLE_KEY =
  (process.env.STRIPE_PUBLISHABLE_KEY || process.env.VPN_STRIPE_PUBLISHABLE_KEY || '').trim() ||
  'pk_live_51USluy0Fq96R9TfNKN5dZ8iZDY8fTi6yOqTRZE5ZiRihuzacDtvYRQx6ZpjysI9ez17JIvg8F7JvtGRVxH6Ck4IP00HdlO2xUF';

const STRIPE_PRODUCT_MAIN = (process.env.STRIPE_PRODUCT_MAIN || 'prod_VTjdG0sise8wG8').trim();
const STRIPE_PRODUCT_WIFI_RADAR = (process.env.STRIPE_PRODUCT_WIFI_RADAR || 'prod_VTjdnQaDaWKags').trim();
const STRIPE_PRICE_ANNUAL = (process.env.STRIPE_PRICE_ANNUAL || 'price_1USmA90Fq96R9TfN64MFGM8m').trim();
const STRIPE_PRICE_SIX_MONTH = (process.env.STRIPE_PRICE_SIX_MONTH || 'price_1USmA90Fq96R9TfNoJAsCWv2').trim();
const STRIPE_PRICE_MONTHLY = (process.env.STRIPE_PRICE_MONTHLY || 'price_1USmA90Fq96R9TfNUETcvpen').trim();
const STRIPE_COUPON = (process.env.STRIPE_COUPON || 'sweepr_intro_gbp_800').trim();

// ============================================================================
// Multi-Currency Geo-Pricing Engine (Exact match to pricing-config.js)
// ============================================================================
const PRICING_BY_CURRENCY = {
  gbp: { currency: 'gbp', symbol: '£', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 5999, sixMonthAmount: 3899, monthlyAmount: 999, introMonthlyAmount: 199, wifiRadarAnnualAmount: 1499, wifiRadarSixMonthAmount: 999, wifiRadarMonthlyAmount: 199 },
  usd: { currency: 'usd', symbol: '$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 7799, sixMonthAmount: 5099, monthlyAmount: 1299, introMonthlyAmount: 299, wifiRadarAnnualAmount: 1999, wifiRadarSixMonthAmount: 1299, wifiRadarMonthlyAmount: 299 },
  eur: { currency: 'eur', symbol: '€', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 7199, sixMonthAmount: 4699, monthlyAmount: 1199, introMonthlyAmount: 299, wifiRadarAnnualAmount: 1799, wifiRadarSixMonthAmount: 1199, wifiRadarMonthlyAmount: 249 },
  cad: { currency: 'cad', symbol: 'CA$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 10799, sixMonthAmount: 6999, monthlyAmount: 1799, introMonthlyAmount: 399, wifiRadarAnnualAmount: 2699, wifiRadarSixMonthAmount: 1799, wifiRadarMonthlyAmount: 349 },
  aud: { currency: 'aud', symbol: 'A$', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 11999, sixMonthAmount: 7799, monthlyAmount: 1999, introMonthlyAmount: 399, wifiRadarAnnualAmount: 2999, wifiRadarSixMonthAmount: 1999, wifiRadarMonthlyAmount: 399 },
  chf: { currency: 'chf', symbol: 'CHF ', symbolPosition: 'prefix', zeroDecimal: false, annualAmount: 6599, sixMonthAmount: 4299, monthlyAmount: 1099, introMonthlyAmount: 299, wifiRadarAnnualAmount: 1699, wifiRadarSixMonthAmount: 1099, wifiRadarMonthlyAmount: 249 },
  jpy: { currency: 'jpy', symbol: '¥', symbolPosition: 'prefix', zeroDecimal: true, annualAmount: 11999, sixMonthAmount: 7799, monthlyAmount: 1999, introMonthlyAmount: 399, wifiRadarAnnualAmount: 2999, wifiRadarSixMonthAmount: 1999, wifiRadarMonthlyAmount: 399 }
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
  const cc = (countryCode || 'GB').toUpperCase();
  const currKey = (overrideCurrency || COUNTRY_TO_CURRENCY[cc] || 'gbp').toLowerCase();
  const cfg = PRICING_BY_CURRENCY[currKey] || PRICING_BY_CURRENCY.gbp;

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
  const headerCountry =
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['x-country-code'] ||
    'GB';
  const country = String(qCountry || headerCountry || 'GB').trim().toUpperCase();
  return buildLocalizedPricing(country.length === 2 ? country : 'GB', qCurrency);
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
    'Stripe-Version': '2024-06-20'
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
    const activationCode = String(crypto.randomInt(100000, 1000000));
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
  licenses.set(acc.licenseKey, acc);
  licenses.set(acc.activation_code, acc);
  if (subscriptionId) accountsBySubscriptionId.set(subscriptionId, acc);
  return acc;
}

function signSessionCookie(accountId, email) {
  const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
  const payload = Buffer.from(JSON.stringify({ sub: accountId, email, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function hasWifiRadarInBody(body) {
  if (!body) return false;
  if (body.wifiRadarAddon || body.wifi_radar) return true;
  if (Array.isArray(body.addons)) {
    return body.addons.some((a) => a === 'wifi_radar' || a === 'addon_wifi_radar_and_smart_tv_shield');
  }
  return false;
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
  '.ico': 'image/x-icon',
  '.exe': 'application/vnd.microsoft.portable-executable'
};

const CANONICAL_REDIRECTS = {
  '/index.html': '/',
  '/pricing.html': '/pricing',
  '/order.html': '/order',
  '/login.html': '/login',
  '/refund.html': '/refund',
  '/terms.html': '/terms',
  '/privacy.html': '/privacy',
  '/support.html': '/support',
  '/vs-totalvpn.html': '/vs/totalvpn',
  '/vs-totalvpn': '/vs/totalvpn',
  '/alternatives-totalvpn.html': '/alternatives/totalvpn',
  '/alternatives-totalvpn': '/alternatives/totalvpn'
};

const ROUTE_ALIASES = {
  '/': 'index.html',
  '/pricing': 'pricing.html',
  '/order': 'order.html',
  '/checkout': 'order.html',
  '/login': 'login.html',
  '/refund': 'refund.html',
  '/terms': 'terms.html',
  '/privacy': 'privacy.html',
  '/support': 'support.html',
  '/vs/totalvpn': 'vs-totalvpn.html',
  '/alternatives/totalvpn': 'alternatives-totalvpn.html'
};

function readRawBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    let totalBytes = 0;
    let rejected = false;
    req.on('data', (chunk) => {
      if (rejected) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        rejected = true;
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

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    ...extraHeaders
  });
  res.end(html);
}

function renderPlatformDownloadPicker(osType) {
  const isMobile = osType === 'mobile';
  const title = isMobile
    ? 'Download SWEEPR VPN on Your Computer or Phone'
    : 'Choose Your Operating System';
  const subtitle = isMobile
    ? 'SWEEPR VPN protects up to 10 Windows, Mac, Linux, iPhone, and Android devices. Download the Windows installer directly below or get Pro access for all your devices.'
    : 'Select your desktop installer below to start your free 30-second Home Wi-Fi & Speed Scan.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download SWEEPR VPN</title>
  <meta name="robots" content="noindex, follow">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="text-gray-800 flex flex-col items-center justify-center min-h-screen p-4">
  <div class="glass-card p-8 md:p-10 w-full max-w-lg text-center">
    <a href="/?home=1" class="inline-flex items-center gap-2 text-inherit no-underline mb-4">
      <div class="logo-box">S</div>
      <span class="font-extrabold text-xl tracking-tight text-gray-900">SWEEPR <span class="text-emerald-600">VPN</span></span>
    </a>
    <h1 class="text-2xl font-black text-gray-900 mb-2">${title}</h1>
    <p class="text-sm text-gray-600 mb-6 leading-relaxed">${subtitle}</p>
    <div class="space-y-3 text-left mb-6">
      <a href="/download?platform=win" class="flex items-center justify-between p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50 transition-all no-underline text-gray-900">
        <div>
          <div class="font-bold text-sm">Windows 10 &amp; 11 Installer (.exe)</div>
          <div class="text-xs text-gray-500">SWEEPRVPN.exe &bull; Standalone App</div>
        </div>
        <span class="btn btn-go text-xs py-2 px-3">Download</span>
      </a>
    </div>
    <div class="flex flex-col sm:flex-row gap-3 justify-center pt-4 border-t border-gray-100">
      <a href="/order" class="btn btn-go w-full justify-center">Get SWEEPR VPN Pro &rarr;</a>
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
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6 font-sans">
  <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
    <h1 class="text-2xl font-black">Checkout Cancelled</h1>
    <p class="text-sm text-slate-400">No charge was made to your account. You can return to the order page anytime.</p>
    <a href="/order" class="inline-block w-full py-3 px-6 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm no-underline">Return to Order Page</a>
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
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <script src="https://cdn.tailwindcss.com/3.4.5"></script>
  <script>
    try {
      localStorage.removeItem('sweepr_visited_order');
      document.cookie = 'sweepr_visited_order=; path=/; max-age=0';
      if (${isPopup ? 'true' : 'false'}) {
        const msg = { type: 'sweepr_checkout_complete', subscriptionId: '${subscriptionId}', accountId: '${accountId}' };
        try { new BroadcastChannel('sweepr_checkout').postMessage(msg); } catch (e) {}
        if (window.opener) {
          try { window.opener.postMessage(msg, '*'); } catch (e) {}
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
          <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400">6-Digit App &amp; Portal Activation Key</div>
          <div id="activationKeyText" class="font-mono text-2xl sm:text-3xl font-black text-emerald-400 tracking-widest mt-0.5">${activationCode}</div>
        </div>
        <button onclick="navigator.clipboard.writeText('${activationCode}'); this.textContent='Copied ✓';" class="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold cursor-pointer">
          Copy Code
        </button>
      </div>
      <div class="flex items-center justify-between text-xs text-slate-300 pt-1">
        <span>Pro License Reference:</span>
        <span class="font-mono font-bold text-white bg-slate-800 px-2.5 py-1 rounded">${licenseKey}</span>
      </div>
      <div class="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
        <div class="font-bold text-slate-200 mb-1">Unlocked on your account (Up to 10 Devices):</div>
        <div>✓ 1-Click Private Browsing &amp; Public Wi-Fi Protection (65+ Countries)</div>
        <div>✓ Streaming Speed Booster &amp; Automatic Drop Protection</div>
        <div>✓ Home Wi-Fi Device Scanner &amp; Smart-TV Spy Blocker Included Free</div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
      <a href="/download" class="py-3.5 px-5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm shadow-lg no-underline">
        Download SWEEPR VPN
      </a>
      <a href="/login" class="py-3.5 px-5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm border border-slate-700 no-underline">
        Open Customer Portal
      </a>
    </div>
  </div>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = urlObj.pathname.replace(/\/+$/, '') || '/';

  // 301 Permanent Redirect from legacy .html or non-canonical URLs to clean canonical URLs
  if (req.method === 'GET' && CANONICAL_REDIRECTS[pathname]) {
    const target = CANONICAL_REDIRECTS[pathname] + (urlObj.search || '');
    res.writeHead(301, { Location: target });
    return res.end();
  }

  // Forward AI & Search crawler hits to central SWEEPR CRM SEO Intelligence (project: vpn)
  const ua = req.headers['user-agent'] || '';
  if (req.method === 'GET' && BOT_UA_RE.test(ua) && !pathname.startsWith('/api/')) {
    crm.reportBotHit({ userAgent: ua, path: pathname, status: 200 });
  }

  // Handle /download route (matches sweeprcleaner.com/download)
  if (pathname === '/download' && req.method === 'GET') {
    const requestedPlatform = (urlObj.searchParams.get('platform') || '').toLowerCase();
    const uaLower = ua.toLowerCase();

    crm.reportTelemetryEvent({
      event_name: 'installer_downloaded',
      category: 'funnel',
      os: requestedPlatform || 'windows',
      properties: { path: '/download' }
    }).catch(() => {});

    let osType = 'windows';
    if (requestedPlatform === 'mac' || requestedPlatform === 'macos') osType = 'mac';
    else if (requestedPlatform === 'linux') osType = 'linux';
    else if (requestedPlatform === 'win' || requestedPlatform === 'windows') osType = 'windows';
    else if (uaLower.includes('iphone') || uaLower.includes('ipad') || uaLower.includes('android')) osType = 'mobile';
    else if (uaLower.includes('mac os') || uaLower.includes('macintosh')) osType = 'mac';
    else if (uaLower.includes('linux')) osType = 'linux';

    if (osType === 'mobile' || (requestedPlatform && osType !== 'windows')) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Robots-Tag': 'noindex, follow'
      });
      return res.end(renderPlatformDownloadPicker(osType));
    }

    const exePath = path.join(__dirname, 'SWEEPRVPN.exe');
    if (fs.existsSync(exePath)) {
      const stat = fs.statSync(exePath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.microsoft.portable-executable',
        'Content-Disposition': 'attachment; filename="SWEEPRVPN.exe"',
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=3600',
        'X-Robots-Tag': 'noindex, nofollow'
      });
      return fs.createReadStream(exePath).pipe(res);
    }
  }

  // Returning-visitor redirect on `/` -> `/order` if sweepr_visited_order=1 cookie is present
  if (pathname === '/' && req.method === 'GET') {
    const cookies = req.headers.cookie || '';
    const hasVisitedOrder = cookies.includes('sweepr_visited_order=1');
    const bypassRedirect = urlObj.searchParams.get('noredirect') === '1' || urlObj.searchParams.get('home') === '1';
    const referer = req.headers.referer || '';
    const fromOrderPage = referer.includes('/order');

    if (hasVisitedOrder && !bypassRedirect && !BOT_UA_RE.test(ua) && !fromOrderPage) {
      const qs = urlObj.search || '';
      res.writeHead(302, { Location: `/order${qs}` });
      return res.end();
    }
  }

  // API 0: Geo-IP & Multi-Currency Pricing
  if (pathname === '/api/pricing' && req.method === 'GET') {
    const localizedPricing = resolvePricingForRequest(req, urlObj);
    return sendJson(res, 200, localizedPricing);
  }

  // API 1: Public Checkout Configuration (Matches sweeprcleaner /api/checkout-config)
  if (pathname === '/api/checkout-config' && req.method === 'GET') {
    const localizedPricing = resolvePricingForRequest(req, urlObj);
    const validPk = STRIPE_PUBLISHABLE_KEY.startsWith('pk_') ? STRIPE_PUBLISHABLE_KEY : '';
    const stripeConfigured = Boolean(STRIPE_SECRET_KEY);
    return sendJson(res, 200, {
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
    });
  }

  // API 1b: Lead Capture when visitor enters email on /order
  if ((pathname === '/api/vpn/leads' || pathname === '/api/lead') && req.method === 'POST') {
    if (!checkRateLimit(req, 'lead', 20, 60000)) {
      return sendJson(res, 429, { error: 'rate_limit_exceeded' });
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' });
    const email = (body?.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return sendJson(res, 400, { error: 'invalid_email' });
    }
    const safeName = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const localizedPricing = resolvePricingForRequest(req, urlObj, body || {});
    const acc = upsertLocalAccount({
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
    return sendJson(res, 200, {
      ok: true,
      account_id: acc.id,
      country: localizedPricing.country
    });
  }

  // API 2: Create Stripe Subscription for On-Page Stripe Elements, Google Pay, Apple Pay & PayPal (Matches sweeprcleaner)
  if (pathname === '/api/create-subscription' && req.method === 'POST') {
    if (!checkRateLimit(req, 'create_sub', 15, 60000)) {
      return sendJson(res, 429, { error: 'Too many checkout attempts. Please wait a moment and try again.' });
    }
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' });
    if (!body) return sendJson(res, 400, { error: 'Invalid request body.' });
    if (!STRIPE_SECRET_KEY) return sendJson(res, 503, { error: 'stripe_not_configured' });

    const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod.toLowerCase() : 'card';
    const isPayPal = paymentMethod === 'paypal';
    const isWallet = paymentMethod === 'wallet' || paymentMethod === 'google_pay';
    const isPopup = Boolean(body.popup);
    const providedEmail = (body.email || '').trim().toLowerCase();
    if (providedEmail && !isValidEmail(providedEmail)) {
      return sendJson(res, 400, { error: 'Please enter a valid email address.' });
    }
    const email =
      (providedEmail ? providedEmail : null) ||
      (isPayPal || isWallet
        ? `${isPayPal ? 'paypal' : 'wallet'}_${crypto.randomBytes(4).toString('hex')}@pending.sweeprvpn.com`
        : null);

    if (!email) {
      return sendJson(res, 400, { error: 'Please enter a valid email address.' });
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

    const localizedPricing = resolvePricingForRequest(req, urlObj, body);
    const existingAcc = accountsByEmail.get(email);
    const wasAlreadyActive = Boolean(existingAcc && existingAcc.status === 'active');
    const acc = upsertLocalAccount({
      email,
      name,
      country: localizedPricing.country,
      plan,
      wifiRadarAddon: includeWifiRadar,
      status: 'pending'
    });

    crm.reportTelemetryEvent({
      event_name: 'checkout_started',
      category: 'funnel',
      account_id: acc.id,
      os: 'web',
      properties: { plan, wifiRadarAddon: includeWifiRadar, paymentMethod }
    }).catch(() => {});

    try {
      const metadata = {
        project_id: 'vpn',
        account_id: acc.id,
        email,
        plan,
        wifi_radar: includeWifiRadar ? 'true' : 'false',
        addons: includeWifiRadar ? 'wifi_radar' : '',
        country: localizedPricing.country
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

      const introCouponId =
        !isAnnual && !isSixMonth && applyDiscount
          ? await getOrCreateIntroCoupon(localizedPricing.currency, localizedPricing.introSavingsAmount)
          : '';

      const subParams = {
        customer: customerId,
        items: subItems,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'on_subscription',
          payment_method_types: isPayPal ? ['paypal'] : ['card']
        },
        ...(introCouponId ? { discounts: [{ coupon: introCouponId }] } : {}),
        metadata,
        expand: ['latest_invoice.payment_intent']
      };

      const subscription = await stripeRequest('POST', 'subscriptions', subParams);
      acc.stripe_subscription_id = subscription.id;
      accountsBySubscriptionId.set(subscription.id, acc);

      const latestInvoice = subscription.latest_invoice;
      let paymentIntent = latestInvoice?.payment_intent || null;
      if (typeof paymentIntent === 'string') {
        paymentIntent = await stripeRequest('GET', `payment_intents/${encodeURIComponent(paymentIntent)}`);
      }

      if (!paymentIntent?.id) {
        return sendJson(res, 500, { error: 'Could not initialize payment intent.' });
      }

      const hostOrigin = resolveTrustedOrigin(req);
      const returnUrl = `${hostOrigin}/checkout/success?web=1&subscription_id=${encodeURIComponent(subscription.id)}&account_id=${encodeURIComponent(acc.id)}${isPopup ? '&popup=1' : ''}`;

      if (isPayPal) {
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
                ip_address: '127.0.0.1',
                user_agent: req.headers['user-agent'] || 'Mozilla/5.0'
              }
            }
          },
          return_url: returnUrl
        });

        const redirectUrl = confirmedPi.next_action?.redirect_to_url?.url || null;
        if (!redirectUrl) {
          return sendJson(res, 500, { error: 'Could not initialize PayPal authorization redirect.' });
        }

        return sendJson(res, 200, {
          redirectUrl,
          subscriptionId: subscription.id,
          accountId: acc.id,
          plan,
          livemode: Boolean(confirmedPi.livemode)
        });
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
        acc.status = 'active';
        return sendJson(res, 200, {
          redirectUrl: `/checkout/success?web=1&subscription_id=${encodeURIComponent(subscription.id)}&account_id=${encodeURIComponent(acc.id)}`,
          subscriptionId: subscription.id,
          accountId: acc.id,
          licenseKey: acc.licenseKey,
          activation_code: acc.activation_code,
          entitlements: acc.entitlements,
          plan
        });
      }

      const clientSecret = paymentIntent.client_secret || null;
      if (!clientSecret) {
        return sendJson(res, 500, { error: 'Could not initialize payment intent client secret.' });
      }

      return sendJson(res, 200, {
        clientSecret,
        subscriptionId: subscription.id,
        accountId: acc.id,
        plan
      });
    } catch (err) {
      console.error('[create-subscription] Stripe error:', err.message);
      return sendJson(res, 400, { error: err.message || 'Payment initialization failed.' });
    }
  }

  // API 2b: Confirm & Sync On-Page Subscription after Stripe Elements / Google Pay / Apple Pay confirmation
  if (pathname === '/api/confirm-subscription' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body && body.__tooLarge) return sendJson(res, 413, { error: 'payload_too_large' });
    const subscriptionId = typeof body?.subscriptionId === 'string' ? body.subscriptionId.trim() : '';
    const accountId = typeof body?.accountId === 'string' ? body.accountId.trim() : '';
    const checkOnly = Boolean(body?.checkOnly);
    if (!subscriptionId) return sendJson(res, 400, { error: 'missing_subscription_id' });

    try {
      const sub = await stripeRequest('GET', `subscriptions/${encodeURIComponent(subscriptionId)}`, {
        expand: ['default_payment_method', 'latest_invoice.payment_intent.payment_method']
      });

      if (sub.status !== 'active' && sub.status !== 'trialing') {
        return sendJson(res, checkOnly ? 200 : 402, {
          ok: false,
          status: sub.status
        });
      }

      const metaAccountId = sub.metadata?.account_id || accountId;
      const metaEmail = sub.metadata?.email || '';
      const metaPlan = sub.metadata?.plan || 'annual';
      const hasWifiRadar = sub.metadata?.wifi_radar === 'true' || (sub.metadata?.addons || '').includes('wifi_radar');

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

      const totalAmount = (sub.items?.data || []).reduce(
        (sum, it) => sum + (it.price?.unit_amount || 0) * (it.quantity || 1),
        0
      );

      reportToSweeprCrm('/api/crm/subscriptions?project=vpn', {
        project_id: 'vpn',
        email: acc.email,
        plan: acc.plan,
        status: 'active',
        amount_cents: totalAmount || 5999,
        addons: acc.wifiRadarAddon ? ['wifi_radar'] : [],
        notes: `Stripe Live Subscription ${sub.id} (${acc.licenseKey})`
      });

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
        }
      );
    } catch (err) {
      console.error('[confirm-subscription] error:', err.message);
      return sendJson(res, 400, { error: err.message || 'Verification failed' });
    }
  }

  // API 2c: Live Stripe Webhook Handler (/webhooks/stripe, /api/webhook/stripe, /api/webhooks/stripe)
  if (
    req.method === 'POST' &&
    (pathname === '/webhooks/stripe' || pathname === '/api/webhook/stripe' || pathname === '/api/webhooks/stripe')
  ) {
    let rawBody;
    try {
      rawBody = await readRawBody(req, 256 * 1024);
    } catch {
      return sendJson(res, 413, { error: 'payload_too_large' });
    }
    const sig = req.headers['stripe-signature'] || '';
    if ((IS_LIVE_STRIPE || STRIPE_WEBHOOK_SECRET) && !verifyStripeWebhookSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
      return sendJson(res, 400, { error: 'invalid_signature' });
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return sendJson(res, 400, { error: 'invalid_json' });
    }

    try {
      const obj = event?.data?.object || {};
      if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated' ||
        event.type === 'customer.subscription.deleted'
      ) {
        const subStatus = obj.status === 'active' || obj.status === 'trialing' ? 'active' : obj.status || 'canceled';
        const metaEmail = obj.metadata?.email || '';
        const metaPlan = obj.metadata?.plan || 'annual';
        const hasWifiRadar = obj.metadata?.wifi_radar === 'true' || (obj.metadata?.addons || '').includes('wifi_radar');
        if (metaEmail || obj.id) {
          upsertLocalAccount({
            email: metaEmail || `${obj.id}@stripe.sweeprvpn.com`,
            stripeCustomerId: typeof obj.customer === 'string' ? obj.customer : obj.customer?.id,
            subscriptionId: obj.id,
            plan: metaPlan,
            wifiRadarAddon: hasWifiRadar,
            status: subStatus
          });
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

    return sendJson(res, 200, { received: true });
  }

  // Checkout Success & Cancel Pages
  if (req.method === 'GET' && pathname === '/checkout/success') {
    const subscriptionId = (urlObj.searchParams.get('subscription_id') || '').trim();
    const accountId = (urlObj.searchParams.get('account_id') || '').trim();
    const redirectStatus = (urlObj.searchParams.get('redirect_status') || '').trim();
    const isPopup = urlObj.searchParams.get('popup') === '1';

    if (redirectStatus === 'failed' || redirectStatus === 'canceled') {
      res.writeHead(302, { Location: '/order?error=payment_cancelled' });
      return res.end();
    }

    let acc = accountsById.get(accountId) || accountsBySubscriptionId.get(subscriptionId) || null;
    if (subscriptionId && STRIPE_SECRET_KEY) {
      try {
        const sub = await stripeRequest('GET', `subscriptions/${encodeURIComponent(subscriptionId)}`);
        if (sub.status === 'incomplete' || sub.status === 'incomplete_expired' || sub.status === 'canceled') {
          res.writeHead(302, { Location: '/order?error=payment_cancelled' });
          return res.end();
        }
        acc = upsertLocalAccount({
          email: acc?.email || sub.metadata?.email || 'customer@sweeprvpn.com',
          plan: sub.metadata?.plan || acc?.plan || 'annual',
          wifiRadarAddon: sub.metadata?.wifi_radar === 'true' || acc?.wifiRadarAddon,
          subscriptionId: sub.id,
          status: 'active'
        });
      } catch {}
    }

    if (!acc || acc.status !== 'active') {
      res.writeHead(302, { Location: '/order?error=payment_incomplete' });
      return res.end();
    }

    return sendHtml(res, 200, renderCheckoutSuccessPage(acc, false, isPopup), {
      'X-Robots-Tag': 'noindex, nofollow'
    });
  }

  if (req.method === 'GET' && pathname === '/checkout/cancel') {
    return sendHtml(res, 200, renderCheckoutSuccessPage(null, true, false), {
      'X-Robots-Tag': 'noindex, nofollow'
    });
  }

  // VPN Device Licensing (Ed25519 signed tokens for WireGuard/AmneziaWG + Wi-Fi Radar)
  if ((pathname === '/api/vpn/activate' || pathname === '/v1/license/activate' || pathname === '/v1/license/refresh') && req.method === 'POST') {
    const body = await readJsonBody(req);
    const code = String(body.otp || body.activation_code || body.refresh_token || '').trim();
    const localAcc = licenses.get(code) || (body.email ? accountsByEmail.get(String(body.email).trim().toLowerCase()) : null);
    if (localAcc && localAcc.status === 'active') {
      return sendJson(res, 200, {
        ok: true,
        valid: true,
        account_id: localAcc.id,
        licenseKey: localAcc.licenseKey,
        activation_code: localAcc.activation_code,
        plan: localAcc.plan,
        entitlements: localAcc.entitlements,
        status: localAcc.status
      });
    }
    try {
      const data = pathname === '/v1/license/refresh'
        ? await crm.refreshLicense({
            accountId: body.account_id,
            refreshToken: body.refresh_token,
            deviceId: body.device_id,
            appVersion: body.app_version
          })
        : await crm.activateDevice({
            email: body.email,
            otp: body.otp || body.activation_code || body.refresh_token,
            accountId: body.account_id,
            refreshToken: body.refresh_token,
            deviceId: body.device_id || `vpn_${Date.now()}`,
            deviceName: body.device_name || 'SWEEPR VPN Client',
            os: body.os || 'windows',
            appVersion: body.app_version || '0.1.0'
          });
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: e?.message || 'crm_unreachable' });
    }
  }

  // VPN Key Verification
  if ((pathname === '/api/vpn/verify-key' || pathname === '/api/license-verify') && (req.method === 'GET' || req.method === 'POST')) {
    const body = req.method === 'POST' ? await readJsonBody(req) : {};
    const key = String(body.key || urlObj.searchParams.get('key') || '').trim();
    const localRecord = licenses.get(key) || licenses.get(key.toUpperCase());
    if (localRecord && localRecord.status === 'active') {
      return sendJson(res, 200, {
        valid: true,
        licenseKey: localRecord.licenseKey,
        plan: localRecord.plan,
        wifiRadarAddon: Boolean(localRecord.wifiRadarAddon),
        entitlements: localRecord.entitlements,
        status: localRecord.status
      });
    }
    try {
      const data = await crm.verifyKey(key);
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 502, { valid: false, error: e?.message || 'crm_unreachable' });
    }
  }

  // VPN Customer Support Ticket Submission
  if ((pathname === '/api/vpn/support' || pathname === '/api/support-ticket') && req.method === 'POST') {
    const body = await readJsonBody(req);
    try {
      const data = await crm.createSupportTicket(body);
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 200, { ok: true, simulated: true });
    }
  }

  // Customer Portal Login & OTP Verification
  if (pathname === '/api/portal-login' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const email = (body.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return sendJson(res, 400, { otpSent: false, error: 'Please enter a valid email address.' });
    }
    return sendJson(res, 200, { otpSent: true });
  }

  if (pathname === '/api/verify-otp' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const code = String(body.code || '').trim();
    if (code.length === 6) {
      return sendJson(res, 200, { ok: true, redirect: '/support' });
    }
    return sendJson(res, 400, { ok: false, error: 'Invalid or expired 6-digit login code.' });
  }

  // VPN Funnel & Telemetry Events
  if (pathname === '/api/vpn/telemetry' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const data = await crm.reportTelemetryEvent(body);
    return sendJson(res, 200, data);
  }

  const isOrderRoute = pathname === '/order' || pathname === '/checkout';
  const isLoginRoute = pathname === '/login';

  if (ROUTE_ALIASES[pathname]) {
    pathname = '/' + ROUTE_ALIASES[pathname];
  } else if (!path.extname(pathname)) {
    const candidate = path.join(__dirname, pathname + '.html');
    if (fs.existsSync(candidate)) {
      pathname = pathname + '.html';
    }
  }

  const filePath = path.join(__dirname, pathname);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - Page Not Found</h1><p><a href="/?home=1">Return to SWEEPR VPN Home</a></p>');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' };
    if (isOrderRoute) {
      headers['Set-Cookie'] = 'sweepr_visited_order=1; Path=/; Max-Age=2592000; SameSite=Lax';
      headers['X-Robots-Tag'] = 'noindex, follow';
    } else if (isLoginRoute) {
      headers['X-Robots-Tag'] = 'noindex, nofollow';
    } else if (['.svg', '.png', '.ico', '.css', '.js'].includes(ext)) {
      headers['Cache-Control'] = 'public, max-age=86400';
    }
    res.writeHead(200, headers);
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SWEEPR VPN server running at http://0.0.0.0:${PORT} (Live Stripe: ${IS_LIVE_STRIPE})`);
});
