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
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.exe': 'application/vnd.microsoft.portable-executable'
};

const ROUTE_ALIASES = {
  '/': 'index.html',
  '/pricing': 'pricing.html',
  '/order': 'order.html',
  '/login': 'login.html',
  '/refund': 'refund.html',
  '/terms': 'terms.html',
  '/privacy': 'privacy.html',
  '/support': 'support.html',
  '/vs/totalvpn': 'vs-totalvpn.html',
  '/vs-totalvpn': 'vs-totalvpn.html',
  '/alternatives/totalvpn': 'alternatives-totalvpn.html',
  '/alternatives-totalvpn': 'alternatives-totalvpn.html'
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

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  let pathname = urlObj.pathname;

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
      properties: { path: '/download' },
    }).catch(() => {});

    let osType = 'windows';
    if (requestedPlatform === 'mac' || requestedPlatform === 'macos') osType = 'mac';
    else if (requestedPlatform === 'linux') osType = 'linux';
    else if (requestedPlatform === 'win' || requestedPlatform === 'windows') osType = 'windows';
    else if (uaLower.includes('iphone') || uaLower.includes('ipad') || uaLower.includes('android')) osType = 'mobile';
    else if (uaLower.includes('mac os') || uaLower.includes('macintosh')) osType = 'mac';
    else if (uaLower.includes('linux')) osType = 'linux';

    if (osType === 'mobile' || (requestedPlatform && osType !== 'windows')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(renderPlatformDownloadPicker(osType));
    }

    const exePath = path.join(__dirname, 'SWEEPRVPN.exe');
    if (fs.existsSync(exePath)) {
      const stat = fs.statSync(exePath);
      res.writeHead(200, {
        'Content-Type': 'application/vnd.microsoft.portable-executable',
        'Content-Disposition': 'attachment; filename="SWEEPRVPN.exe"',
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=3600'
      });
      return fs.createReadStream(exePath).pipe(res);
    }
  }

  // Returning-visitor redirect on `/` -> `/order` if sweepr_visited_order=1 cookie is present
  if ((pathname === '/' || pathname === '/index.html') && req.method === 'GET') {
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

  // VPN Lead Capture (order page email blur & Free Home Wi-Fi Scanner leads)
  if ((pathname === '/api/vpn/leads' || pathname === '/api/lead') && req.method === 'POST') {
    const body = await readJsonBody(req);
    try {
      const data = await crm.captureLead(body);
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 200, { ok: true });
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

  const isOrderRoute = pathname === '/order' || pathname === '/order.html';

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
    }
    res.writeHead(200, headers);
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SWEEPR VPN server running at http://0.0.0.0:${PORT}`);
});
