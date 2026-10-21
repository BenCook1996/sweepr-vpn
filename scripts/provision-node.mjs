// Creates and registers SWEEPR VPN WireGuard servers (1 location or all 8 in parallel).
//
// Usage:
//   # Provision all 8 locations in parallel on Vultr (~3-4 minutes total):
//   $env:VULTR_API_KEY="xxx"; node scripts/provision-node.mjs --provider vultr --all
//
//   # Provision a single location:
//   $env:VULTR_API_KEY="xxx"; node scripts/provision-node.mjs --provider vultr --code UK-LON-01
//
//   # Show all registered servers & the Railway VPN_NODES variable:
//   node scripts/provision-node.mjs --list

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = join(root, 'infra', 'nodes.local.json');

// Automatically load .env from project root if present
const envFile = join(root, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

const LOCATIONS = {
  'UK-LON-01': { upcloud: 'uk-lon1', vultr: 'lhr', hetzner: 'fsn1', country: 'United Kingdom', city: 'London', flag: 'GB' },
  'SE-STO-01': { upcloud: 'fi-hel1', vultr: 'sto', hetzner: 'hel1', country: 'Sweden',         city: 'Stockholm', flag: 'SE' },
  'NL-AMS-01': { upcloud: 'nl-ams1', vultr: 'ams', hetzner: 'fsn1', country: 'Netherlands',    city: 'Amsterdam', flag: 'NL' },
  'DE-FRA-01': { upcloud: 'de-fra1', vultr: 'fra', hetzner: 'nbg1', country: 'Germany',        city: 'Frankfurt', flag: 'DE' },
  'US-NYC-01': { upcloud: 'us-nyc1', vultr: 'ewr', hetzner: 'ash',  country: 'United States',  city: 'New York', flag: 'US' },
  'US-LAX-01': { upcloud: 'us-sjo1', vultr: 'lax', hetzner: 'hil',  country: 'United States',  city: 'Los Angeles', flag: 'US' },
  'SG-SIN-01': { upcloud: 'sg-sin1', vultr: 'sgp', hetzner: 'sin',  country: 'Singapore',      city: 'Singapore', flag: 'SG' },
  'JP-TYO-01': { upcloud: 'sg-sin1', vultr: 'nrt', hetzner: 'sin',  country: 'Japan',          city: 'Tokyo', flag: 'JP' }
};

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const registry = existsSync(REGISTRY) ? JSON.parse(readFileSync(REGISTRY, 'utf8')) : [];

function saveRegistry() {
  writeFileSync(REGISTRY, JSON.stringify(registry, null, 2));
}

function printEnv() {
  const env = JSON.stringify(
    registry.map(({ code, country, city, flag, ip, port, public_key, agent_port, agent_secret }) => ({
      code,
      country,
      city,
      flag,
      ip,
      port,
      public_key,
      agent_port,
      agent_secret
    }))
  );
  console.log('\n================================================================');
  console.log('Paste this into Railway → your service → Variables as VPN_NODES:');
  console.log('================================================================\n');
  console.log(env);
  console.log('');
}

if (args.includes('--list')) {
  for (const n of registry) {
    console.log(`${n.code}  ${n.city.padEnd(14)} ${n.ip.padEnd(16)} ${n.provider || 'vps'}:${n.instance_id || 'manual'}`);
  }
  printEnv();
  process.exit(0);
}

if (args.includes('--test')) {
  const { createHmac, randomBytes: rb } = await import('node:crypto');
  for (const n of registry) {
    const ud = await vultr('GET', `/instances/${n.instance_id}/user-data`);
    const decoded = Buffer.from(ud.user_data?.data || '', 'base64').toString('utf8');
    const m = decoded.match(/AGENT_SECRET="([^"]+)"/);
    const udSecret = m ? m[1] : '';
    if (udSecret && udSecret !== n.agent_secret) {
      console.log(`[${n.code}] Syncing agent_secret from Vultr user-data`);
      n.agent_secret = udSecret;
    }
    const payload = JSON.stringify({
      public_key: 'PeQDujOboCFTlTPOFEFJOsQczDCNSNnBE8R+ikx+uGc=',
      licence: '0123456789abcdef0123456789abcdef'
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const nonce = rb(16).toString('hex');
    const sig = createHmac('sha256', n.agent_secret)
      .update(`POST\n/peers\n${ts}\n${nonce}\n${payload}`)
      .digest('hex');
    const r = await fetch(`http://${n.ip}:${n.agent_port || 8787}/peers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sweepr-Timestamp': ts,
        'X-Sweepr-Nonce': nonce,
        'X-Sweepr-Signature': sig
      },
      body: payload
    });
    console.log(`[${n.code}] ${n.ip} POST /peers -> ${r.status}:`, await r.text());
  }
  saveRegistry();
  process.exit(0);
}

if (args.includes('--check-plans')) {
  const { account } = await vultr('GET', '/account');
  console.log('Vultr Account:', JSON.stringify(account));
  const { regions } = await vultr('GET', '/regions?per_page=100');
  const { plans } = await vultr('GET', '/plans?type=vc2&per_page=100');
  const p35 = plans.find((p) => p.id === 'vc2-1c-0.5gb');
  const p50 = plans.find((p) => p.id === 'vc2-1c-1gb');
  console.log('\n--- 8 SWEEPR VPN Target Locations on Vultr ---');
  let totalUsd = 0;
  for (const [code, loc] of Object.entries(LOCATIONS)) {
    const reg = regions.find((r) => r.id === loc.vultr);
    const has35 = p35?.locations?.includes(loc.vultr);
    const has50 = p50?.locations?.includes(loc.vultr);
    const chosen = has35 ? p35 : p50;
    totalUsd += chosen ? chosen.monthly_cost : 5;
    console.log(
      `${code} | App: ${(loc.country + ' - ' + loc.city).padEnd(30)} | Vultr DC: ${loc.vultr} (${reg ? reg.city + ', ' + reg.country : 'N/A'}) | Plan: ${chosen?.id} ($${chosen?.monthly_cost.toFixed(2)}/mo, ${chosen?.ram}MB RAM, ${chosen?.bandwidth}GB BW)`
    );
  }
  console.log(`Total Monthly USD: $${totalUsd.toFixed(2)}/mo`);
  console.log('\n--- All Vultr Regions & Lowest Available Plan ---');
  for (const r of regions) {
    const has35 = p35?.locations?.includes(r.id);
    const has50 = p50?.locations?.includes(r.id);
    if (has35 || has50) {
      console.log(`${r.id.padEnd(5)} ${r.country.padEnd(3)} ${r.city.padEnd(16)} -> ${has35 ? '$3.50/mo (vc2-1c-0.5gb) + $5.00/mo' : '$5.00/mo (vc2-1c-1gb)'}`);
    }
  }
  process.exit(0);
}

const provider = (
  arg('--provider') ||
  (process.env.UPCLOUD_TOKEN ? 'upcloud' : process.env.HETZNER_API_TOKEN ? 'hetzner' : 'vultr')
).toLowerCase();

const targetCodes = args.includes('--all')
  ? Object.keys(LOCATIONS)
  : [arg('--code')].filter(Boolean);

if (targetCodes.length === 0 || targetCodes.some((c) => !LOCATIONS[c])) {
  console.error('Use --all or --code with one of: ' + Object.keys(LOCATIONS).join(', '));
  process.exit(1);
}

const agentPy = readFileSync(join(root, 'infra', 'node', 'sweepr_agent.py'), 'utf8').replace(/\r\n/g, '\n');
const setupTemplate = readFileSync(join(root, 'infra', 'node', 'setup-node.sh'), 'utf8').replace(/\r\n/g, '\n');

async function vultr(method, path, body) {
  const KEY = process.env.VULTR_API_KEY;
  if (!KEY) throw new Error('Set VULTR_API_KEY (Vultr → Account → API).');
  const r = await fetch('https://api.vultr.com/v2' + path, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Vultr ${method} ${path} -> ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

let cachedUbuntuOsId = null;
async function getVultrUbuntuId() {
  if (cachedUbuntuOsId) return cachedUbuntuOsId;
  const { os } = await vultr('GET', '/os?per_page=500');
  const ubuntu = os.find((o) => /Ubuntu 24\.04/i.test(o.name) && /x64/i.test(o.name));
  if (!ubuntu) throw new Error('Ubuntu 24.04 image not found on Vultr');
  cachedUbuntuOsId = ubuntu.id;
  return cachedUbuntuOsId;
}

async function pickVultrPlan(region) {
  const explicit = arg('--plan');
  if (explicit) return explicit;
  try {
    const { available_plans } = await vultr('GET', `/regions/${region}/availability`);
    if (Array.isArray(available_plans)) {
      if (available_plans.includes('vc2-1c-0.5gb')) return 'vc2-1c-0.5gb'; // $3.50/mo where available
      if (available_plans.includes('vc2-1c-1gb')) return 'vc2-1c-1gb';     // $5.00/mo standard
    }
  } catch {}
  return 'vc2-1c-1gb';
}

async function provisionOne(code) {
  if (registry.some((n) => n.code === code)) {
    console.log(`[${code}] Already registered in ${REGISTRY}, skipping creation.`);
    return;
  }
  const loc = LOCATIONS[code];
  const agentSecret = randomBytes(32).toString('hex');
  const userData = setupTemplate
    .replace('__AGENT_SECRET__', agentSecret)
    .replace('__AGENT_PY__', agentPy);

  let ip = '';
  let instanceId = '';

  if (provider === 'vultr') {
    const label = `sweepr-${code.toLowerCase()}`;
    const { instances } = await vultr('GET', '/instances?per_page=100');
    const existing = (instances || []).find((i) => i.label === label);
    if (existing) {
      instanceId = String(existing.id);
      ip = existing.main_ip;
      console.log(`[${code}] Updating user_data (LF) & reinstalling existing Vultr server ${ip} (${instanceId})…`);
      await vultr('PATCH', `/instances/${instanceId}`, {
        user_data: Buffer.from(userData, 'utf8').toString('base64')
      });
      await vultr('POST', `/instances/${instanceId}/reinstall`, {
        hostname: label
      });
    } else {
      const osId = await getVultrUbuntuId();
      const plan = await pickVultrPlan(loc.vultr);
      console.log(`[${code}] Creating ${loc.city} (${loc.vultr}, plan ${plan}) on Vultr…`);
      const { instance } = await vultr('POST', '/instances', {
        region: loc.vultr,
        plan,
        os_id: osId,
        label,
        hostname: label,
        user_data: Buffer.from(userData, 'utf8').toString('base64'),
        backups: 'disabled',
        enable_ipv6: false,
        tags: ['sweepr-vpn']
      });
      instanceId = String(instance.id);
      for (let i = 0; i < 60 && (!ip || ip === '0.0.0.0'); i++) {
        await new Promise((r) => setTimeout(r, 5000));
        ip = (await vultr('GET', `/instances/${instance.id}`)).instance.main_ip;
      }
    }
  } else if (provider === 'upcloud') {
    const TOKEN = process.env.UPCLOUD_TOKEN;
    if (!TOKEN) throw new Error('Set UPCLOUD_TOKEN.');
    const plan = arg('--plan') || '1xCPU-1GB';
    console.log(`[${code}] Creating ${loc.city} (${loc.upcloud}, plan ${plan}) on UpCloud…`);
    const r = await fetch('https://api.upcloud.com/1.3/server', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        server: {
          zone: loc.upcloud,
          title: `SWEEPR VPN ${code} (${loc.city})`,
          hostname: `sweepr-${code.toLowerCase()}`,
          plan,
          user_data: userData,
          storage_devices: {
            storage_device: [
              {
                action: 'clone',
                storage: '01000000-0000-4000-8000-000030240200',
                title: `sweepr-${code.toLowerCase()}-disk`,
                size: plan.startsWith('DEV-') ? 10 : 25,
                tier: plan.startsWith('DEV-') ? 'standard' : 'maxiops'
              }
            ]
          }
        }
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`UpCloud ${code}: ${JSON.stringify(data)}`);
    instanceId = data.server.uuid;
    const pubIface = (data.server.networking?.interfaces?.interface || []).find((i) => i.type === 'public');
    ip = pubIface?.ip_addresses?.ip_address?.[0]?.address || '';
  } else {
    const TOKEN = process.env.HETZNER_API_TOKEN;
    if (!TOKEN) throw new Error('Set HETZNER_API_TOKEN.');
    console.log(`[${code}] Creating ${loc.city} (${loc.hetzner}) on Hetzner Cloud…`);
    const r = await fetch('https://api.hetzner.cloud/v1/servers', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `sweepr-${code.toLowerCase()}`,
        server_type: arg('--plan') || 'cpx11',
        image: 'ubuntu-24.04',
        location: loc.hetzner,
        user_data: userData,
        labels: { service: 'sweepr-vpn', code }
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`Hetzner ${code}: ${JSON.stringify(data)}`);
    instanceId = String(data.server.id);
    ip = data.server.public_net?.ipv4?.ip || '';
  }

  console.log(`[${code}] Server IP is ${ip}. Waiting for WireGuard & Unbound DNS setup (2–4 mins)…`);

  let health = null;
  for (let i = 0; i < 80 && !health; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    try {
      const r = await fetch(`http://${ip}:8787/health`, { signal: AbortSignal.timeout(4000) });
      if (r.ok) health = await r.json();
    } catch {}
  }
  if (!health) throw new Error(`[${code}] Setup did not finish at ${ip}.`);

  registry.push({
    code,
    country: loc.country,
    city: loc.city,
    flag: loc.flag,
    provider,
    ip,
    port: 51820,
    agent_port: 8787,
    public_key: health.public_key,
    agent_secret: agentSecret,
    instance_id: instanceId,
    created: new Date().toISOString()
  });
  saveRegistry();
  console.log(`[${code}] LIVE at ${ip}:51820 (WireGuard key: ${health.public_key})`);
}

await Promise.all(targetCodes.map((c) => provisionOne(c)));
printEnv();
