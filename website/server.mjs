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

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  let pathname = urlObj.pathname;

  // Forward AI & Search crawler hits to central SWEEPR CRM SEO Intelligence (project: vpn)
  const ua = req.headers['user-agent'] || '';
  if (req.method === 'GET' && BOT_UA_RE.test(ua) && !pathname.startsWith('/api/')) {
    crm.reportBotHit({ userAgent: ua, path: pathname, status: 200 });
  }

  // Proxy pricing & licensing calls to central SWEEPR Multi-Project CRM (project: vpn)
  if (pathname === '/api/pricing' && req.method === 'GET') {
    try {
      const data = await crm.fetchPricing({
        currency: urlObj.searchParams.get('currency') || undefined,
        country: urlObj.searchParams.get('country') || undefined,
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: e?.message || 'crm_unreachable' }));
    }
    return;
  }

  if ((pathname === '/v1/billing/checkout' || pathname === '/v1/license/activate' || pathname === '/v1/license/refresh') && req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch {}
    try {
      let data;
      if (pathname === '/v1/billing/checkout') data = await crm.createCheckout(body);
      else if (pathname === '/v1/license/activate') data = await crm.activateDevice({ accountId: body.account_id, refreshToken: body.refresh_token, deviceId: body.device_id });
      else data = await crm.refreshLicense({ accountId: body.account_id, refreshToken: body.refresh_token, deviceId: body.device_id });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: e?.message || 'crm_unreachable' }));
    }
    return;
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
