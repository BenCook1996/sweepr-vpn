/**
 * SWEEPR Multi-Project CRM & Licensing SDK (`sweepr-client.mjs`)
 * Pure ESM JavaScript version for zero-build Node 22 servers (`vpn`, `adblocker`, etc.).
 */
import crypto from 'node:crypto';

export class SweeprCrmClient {
  constructor(opts = {}) {
    this.projectId = String(opts.projectId || 'vpn').trim().toLowerCase();
    this.crmUrl = String(opts.crmUrl || process.env.SWEEPR_CRM_URL || 'http://localhost:8788').replace(/\/+$/, '');
    this.apiKey = String(opts.apiKey || process.env.SWEEPR_CRM_API_KEY || '').trim();
    this.publicKeySpki = opts.publicKeySpki || process.env.SWEEPR_LICENSE_PUBLIC_KEY || '';
  }

  headers(extra = {}) {
    const h = {
      'content-type': 'application/json',
      'x-sweepr-project': this.projectId,
      ...extra,
    };
    if (this.apiKey) {
      h['x-crm-api-key'] = this.apiKey;
      h['x-sweepr-api-key'] = this.apiKey;
    }
    return h;
  }

  verifyLicenseTokenOffline(token, expectedDeviceId, publicKeyOverride) {
    try {
      const parts = String(token || '').split('.');
      if (parts.length !== 3) return { valid: false, reason: 'malformed_jws' };
      const [headerB64, payloadB64, sigB64] = parts;
      const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
      const signature = Buffer.from(sigB64, 'base64url');

      const rawKey = publicKeyOverride || this.publicKeySpki;
      if (!rawKey) return { valid: false, reason: 'missing_public_key' };

      let keyObj;
      if (rawKey.includes('BEGIN PUBLIC KEY')) {
        keyObj = crypto.createPublicKey(rawKey);
      } else {
        const rawBuf = Buffer.from(rawKey, rawKey.includes('-') || rawKey.includes('_') ? 'base64url' : 'base64');
        const spkiBuf = rawBuf.length === 32
          ? Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), rawBuf])
          : rawBuf;
        keyObj = crypto.createPublicKey({ key: spkiBuf, format: 'der', type: 'spki' });
      }

      const ok = crypto.verify(null, signingInput, keyObj, signature);
      if (!ok) return { valid: false, reason: 'invalid_signature' };

      const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      const now = Math.floor(Date.now() / 1000);

      if (claims.project_id && claims.project_id !== this.projectId) {
        const hasBundle = Array.isArray(claims.addons) && claims.addons.includes('sweepr_secure_bundle');
        if (!hasBundle) {
          return { valid: false, reason: `project_mismatch:${claims.project_id}`, claims };
        }
      }

      if (expectedDeviceId && claims.device_id !== expectedDeviceId) {
        return { valid: false, reason: 'device_mismatch', claims };
      }

      if (now > (claims.grace_until || claims.exp || 0)) {
        return { valid: false, reason: 'token_expired', claims };
      }

      const active = claims.status === 'active' || claims.status === 'trialing' ||
        (claims.status === 'past_due' && now <= (claims.grace_until || 0));

      return { valid: active, reason: active ? undefined : `inactive_status:${claims.status}`, claims };
    } catch (err) {
      return { valid: false, reason: err?.message || 'verify_error' };
    }
  }

  async activateDevice({ email, otp, accountId, refreshToken, deviceId, deviceName, os, appVersion }) {
    const res = await fetch(`${this.crmUrl}/v1/license/activate`, {
      method: 'POST',
      headers: this.headers(),
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        project_id: this.projectId,
        email,
        otp: otp || refreshToken,
        activation_code: otp || refreshToken,
        account_id: accountId,
        refresh_token: refreshToken,
        device_id: deviceId,
        device_name: deviceName,
        os,
        app_version: appVersion,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { _httpStatus: res.status, ...data };
  }

  async refreshLicense({ accountId, refreshToken, deviceId, appVersion }) {
    const res = await fetch(`${this.crmUrl}/v1/license/refresh`, {
      method: 'POST',
      headers: this.headers(),
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        project_id: this.projectId,
        account_id: accountId,
        refresh_token: refreshToken,
        device_id: deviceId,
        app_version: appVersion,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { _httpStatus: res.status, ...data };
  }

  async verifyKey(key, email = '') {
    const qs = new URLSearchParams({ project: this.projectId, key: String(key || '').trim() });
    if (email) qs.set('email', String(email).trim().toLowerCase());
    const res = await fetch(`${this.crmUrl}/v1/license/verify-key?${qs.toString()}`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json().catch(() => ({}));
    return { _httpStatus: res.status, ...data };
  }

  async syncSubscription(params = {}) {
    const res = await fetch(`${this.crmUrl}/api/crm/subscriptions?project=${encodeURIComponent(this.projectId)}`, {
      method: 'POST',
      headers: this.headers(),
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify({
        project_id: this.projectId,
        email: params.email,
        name: params.name,
        country: params.country,
        plan: params.plan,
        status: params.status || 'active',
        days: params.days,
        amount_cents: params.amountCents ?? params.amount_cents,
        currency: params.currency,
        stripe_customer_id: params.stripeCustomerId ?? params.stripe_customer_id,
        stripe_subscription_id: params.stripeSubscriptionId ?? params.stripe_subscription_id,
        activation_code: params.activationCode ?? params.activation_code,
        license_key: params.licenseKey ?? params.license_key,
        addons: params.addons || [],
        notes: params.notes,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { _httpStatus: res.status, ...data };
  }

  async portalLookup(lookup) {
    const payload = typeof lookup === 'object' && lookup !== null
      ? { project_id: this.projectId, ...lookup }
      : { project_id: this.projectId, lookup };
    const res = await fetch(`${this.crmUrl}/v1/license/portal-lookup`, {
      method: 'POST',
      headers: this.headers(),
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { _httpStatus: res.status, ...data };
  }

  async portalCancel(lookup, immediate = false) {
    const payload = typeof lookup === 'object' && lookup !== null
      ? { project_id: this.projectId, ...lookup, immediate }
      : { project_id: this.projectId, lookup, immediate };
    const res = await fetch(`${this.crmUrl}/v1/license/portal-cancel`, {
      method: 'POST',
      headers: this.headers(),
      signal: AbortSignal.timeout(6000),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { _httpStatus: res.status, ...data };
  }

  async fetchPricing(opts = {}) {
    const qs = new URLSearchParams({ project: this.projectId });
    if (opts.currency) qs.set('currency', opts.currency);
    if (opts.country) qs.set('country', opts.country);
    const res = await fetch(`${this.crmUrl}/api/pricing?${qs.toString()}`, {
      headers: this.headers(),
    });
    return res.json();
  }

  async createCheckout(params = {}) {
    const res = await fetch(`${this.crmUrl}/api/checkout`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        plan: params.plan || 'annual',
        currency: params.currency,
        country: params.country,
        email: params.email,
        device: params.device,
        wifi_radar: Boolean(params.wifi_radar),
        addons: params.addons || (params.wifi_radar ? ['wifi_radar'] : []),
      }),
    });
    return res.json();
  }

  async createPaymentIntent(params = {}) {
    const res = await fetch(`${this.crmUrl}/api/payment-intent`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        plan: params.plan || 'annual',
        currency: params.currency,
        country: params.country,
        email: params.email,
        device: params.device,
        wifi_radar: Boolean(params.wifi_radar),
        addons: params.addons || (params.wifi_radar ? ['wifi_radar'] : []),
      }),
    });
    return res.json();
  }

  async captureLead(params = {}) {
    const res = await fetch(`${this.crmUrl}/v1/leads/capture`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        email: params.email,
        name: params.name,
        source: params.source || 'vpn_web',
        domain: params.domain,
        country: params.country,
        device: params.device,
        tags: params.tags,
        metadata: params.metadata,
      }),
    });
    return res.json();
  }

  async createSupportTicket(params = {}) {
    const res = await fetch(`${this.crmUrl}/api/support/contact`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        email: params.email,
        name: params.name,
        subject: params.subject,
        message: params.message,
        category: params.category || 'general',
        priority: params.priority || 'normal',
        os: params.os || 'web',
        app_version: params.appVersion,
        device_id: params.deviceId,
        diagnostics: params.diagnostics,
      }),
    });
    return res.json();
  }

  async reportBotHit({ userAgent, path, status = 200 }) {
    try {
      await fetch(`${this.crmUrl}/api/crm/seo/bot-hit?project=${encodeURIComponent(this.projectId)}`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          project_id: this.projectId,
          user_agent: userAgent,
          path,
          status,
        }),
      });
    } catch {}
  }

  async reportTelemetryEvent(params = {}) {
    try {
      const res = await fetch(`${this.crmUrl}/v1/telemetry/event`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          project_id: this.projectId,
          event_name: params.event_name || params.event,
          category: params.category || 'funnel',
          account_id: params.account_id || params.accountId,
          device_id: params.device_id || params.deviceId,
          os: params.os || params.platform,
          app_version: params.app_version || params.appVersion,
          properties: params.properties,
        }),
      });
      return res.json().catch(() => ({ ok: res.ok }));
    } catch {
      return { ok: false };
    }
  }
}
