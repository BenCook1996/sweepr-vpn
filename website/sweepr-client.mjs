/**
 * SWEEPR Multi-Project CRM & Licensing SDK (`sweepr-client.mjs`)
 * Pure ESM JavaScript version for zero-build Node 22 servers (`vpn`, `adblocker`, etc.).
 */
import crypto from 'node:crypto';

export class SweeprCrmClient {
  constructor(opts = {}) {
    this.projectId = String(opts.projectId || 'vpn').trim().toLowerCase();
    this.crmUrl = String(opts.crmUrl || process.env.SWEEPR_CRM_URL || 'http://localhost:8787').replace(/\/+$/, '');
    this.apiKey = opts.apiKey || process.env.SWEEPR_CRM_API_KEY || '';
    this.publicKeySpki = opts.publicKeySpki || process.env.SWEEPR_LICENSE_PUBLIC_KEY || '';
  }

  headers(extra = {}) {
    const h = {
      'content-type': 'application/json',
      'x-sweepr-project': this.projectId,
      ...extra,
    };
    if (this.apiKey) h['x-sweepr-api-key'] = this.apiKey;
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

      const keyObj = rawKey.includes('BEGIN PUBLIC KEY')
        ? crypto.createPublicKey(rawKey)
        : crypto.createPublicKey({ key: Buffer.from(rawKey, 'base64'), format: 'der', type: 'spki' });

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

  async activateDevice({ accountId, refreshToken, deviceId }) {
    const res = await fetch(`${this.crmUrl}/v1/license/activate`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        account_id: accountId,
        refresh_token: refreshToken,
        device_id: deviceId,
      }),
    });
    return res.json();
  }

  async refreshLicense({ accountId, refreshToken, deviceId }) {
    const res = await fetch(`${this.crmUrl}/v1/license/refresh`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        account_id: accountId,
        refresh_token: refreshToken,
        device_id: deviceId,
      }),
    });
    return res.json();
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
    const res = await fetch(`${this.crmUrl}/v1/billing/checkout`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        project_id: this.projectId,
        plan: params.plan || 'annual',
        currency: params.currency,
        email: params.email,
        account_id: params.accountId,
        intro: params.intro,
        addons: params.addons || [],
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
      await fetch(`${this.crmUrl}/v1/telemetry/event`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          project_id: this.projectId,
          event: params.event,
          account_id: params.accountId,
          device_id: params.deviceId,
          platform: params.platform,
          app_version: params.appVersion,
          properties: params.properties,
        }),
      });
    } catch {}
  }
}
