import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SweeprCrmClient } from './sweepr-client.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const crm = new SweeprCrmClient({ projectId: 'vpn' });
const BOT_UA_RE = /googlebot|bingbot|gptbot|oai-searchbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|applebot|duckduckbot|yandexbot/i;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const ROUTE_ALIASES = {
  '/': 'index.html',
  '/pricing': 'pricing.html',
  '/order': 'order.html',
  '/vs/totalvpn': 'vs-totalvpn.html',
  '/vs-totalvpn': 'vs-totalvpn.html'
};

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    return {};
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  let pathname = urlObj.pathname;

  // Forward AI & Search crawler hits to central SWEEPR CRM SEO Intelligence (project: vpn)
  const ua = req.headers['user-agent'] || '';
  if (req.method === 'GET' && BOT_UA_RE.test(ua) && !pathname.startsWith('/api/')) {
    crm.reportBotHit({ userAgent: ua, path: pathname, status: 200 });
  }

  // Proxy pricing to central SWEEPR Multi-Project CRM (project: vpn)
  if (pathname === '/api/pricing' && req.method === 'GET') {
    try {
      const data = await crm.fetchPricing({
        currency: urlObj.searchParams.get('currency') || undefined,
        country: urlObj.searchParams.get('country') || undefined,
      });
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: e?.message || 'crm_unreachable' });
    }
  }

  // VPN Checkout & PaymentIntent (uses isolated VPN_STRIPE_SECRET_KEY in sweepr-crm)
  if ((pathname === '/api/vpn/checkout' || pathname === '/v1/billing/checkout') && req.method === 'POST') {
    const body = await readJsonBody(req);
    try {
      crm.reportTelemetryEvent({
        event_name: 'checkout_started',
        category: 'funnel',
        os: body.device || 'web',
        properties: { plan: body.plan || 'annual', wifi_radar: Boolean(body.wifi_radar) },
      });
      const data = body.mode === 'redirect'
        ? await crm.createCheckout(body)
        : await crm.createPaymentIntent(body);
      if (data?.ok || data?.dev_simulated) {
        crm.reportTelemetryEvent({
          event_name: 'purchase_completed',
          category: 'funnel',
          account_id: data.account_id,
          os: body.device || 'web',
          properties: { plan: body.plan || 'annual', wifi_radar: Boolean(body.wifi_radar) },
        });
      }
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: e?.message || 'crm_unreachable' });
    }
  }

  // VPN Device Licensing (Ed25519 signed tokens for WireGuard/AmneziaWG + Wi-Fi Radar)
  if ((pathname === '/api/vpn/activate' || pathname === '/v1/license/activate' || pathname === '/v1/license/refresh') && req.method === 'POST') {
    const body = await readJsonBody(req);
    try {
      const data = pathname === '/v1/license/refresh'
        ? await crm.refreshLicense({
            accountId: body.account_id,
            refreshToken: body.refresh_token,
            deviceId: body.device_id,
            appVersion: body.app_version,
          })
        : await crm.activateDevice({
            email: body.email,
            otp: body.otp || body.activation_code || body.refresh_token,
            accountId: body.account_id,
            refreshToken: body.refresh_token,
            deviceId: body.device_id || `vpn_${Date.now()}`,
            deviceName: body.device_name || 'SWEEPR VPN Client',
            os: body.os || 'windows',
            appVersion: body.app_version || '0.1.0',
          });
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: e?.message || 'crm_unreachable' });
    }
  }

  // VPN Key Verification
  if (pathname === '/api/vpn/verify-key' && (req.method === 'GET' || req.method === 'POST')) {
    const body = req.method === 'POST' ? await readJsonBody(req) : {};
    const key = body.key || urlObj.searchParams.get('key') || '';
    try {
      const data = await crm.verifyKey(key);
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 502, { valid: false, error: e?.message || 'crm_unreachable' });
    }
  }

  // VPN Lead Capture (Free Home Wi-Fi Diagnostic Scanner / Leak Test leads)
  if (pathname === '/api/vpn/leads' && req.method === 'POST') {
    const body = await readJsonBody(req);
    try {
      const data = await crm.captureLead(body);
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: e?.message || 'crm_unreachable' });
    }
  }

  // VPN Customer Support Ticket Submission
  if (pathname === '/api/vpn/support' && req.method === 'POST') {
    const body = await readJsonBody(req);
    try {
      const data = await crm.createSupportTicket(body);
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 502, { ok: false, error: e?.message || 'crm_unreachable' });
    }
  }

  // VPN Funnel & Telemetry Events
  if (pathname === '/api/vpn/telemetry' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const data = await crm.reportTelemetryEvent(body);
    return sendJson(res, 200, data);
  }

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
      res.end('<h1>404 - Page Not Found</h1><p><a href="/">Return to SWEEPR VPN Home</a></p>');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`SWEEPR VPN local server running at http://localhost:${PORT}`);
});
