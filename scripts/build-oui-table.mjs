// Builds the compact manufacturer lookup table embedded in the Wi-Fi Radar.
// Source: IEEE MA-L registry (https://standards-oui.ieee.org/oui/oui.csv)
// Output: crates/sweepr-wifi-radar/data/oui.tsv.gz  ("AABBCC\tShort Vendor\n" lines)
import { writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'crates', 'sweepr-wifi-radar', 'data', 'oui.tsv.gz');

const res = await fetch('https://standards-oui.ieee.org/oui/oui.csv', { headers: { 'User-Agent': 'Mozilla/5.0 sweepr-oui-builder' } });
if (!res.ok) throw new Error('IEEE download failed: ' + res.status);
const csv = await res.text();

// Minimal CSV parser (handles quoted fields with commas)
function parseLine(line) {
  const f = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { f.push(cur); cur = ''; } else cur += c;
  }
  f.push(cur); return f;
}

const SUFFIX = /[,.]?\s*\b(co\.?,?\s*ltd\.?|company limited|co\.?|ltd\.?|limited|inc\.?|incorporated|corp\.?|corporation|llc|l\.l\.c\.|gmbh|s\.?a\.?|ag|plc|b\.?v\.?|pte|pty|technologies|technology|electronics|electronic|international|holdings?|group|communications?|systems?|industrial|manufacturing|trading|kabushiki kaisha|k\.k\.)\b\.?/gi;
const BRAND = [
  [/samsung/i, 'Samsung'], [/^lg |lg electronics|lg innotek/i, 'LG'], [/apple/i, 'Apple'], [/amazon/i, 'Amazon'],
  [/google/i, 'Google'], [/roku/i, 'Roku'], [/sonos/i, 'Sonos'], [/sony/i, 'Sony'], [/vizio/i, 'Vizio'],
  [/hisense/i, 'Hisense'], [/tcl /i, 'TCL'], [/tp-link|tp link/i, 'TP-Link'], [/netgear/i, 'Netgear'],
  [/hewlett|^hp /i, 'HP'], [/brother/i, 'Brother'], [/seiko epson|epson/i, 'Epson'], [/canon/i, 'Canon'],
  [/espressif/i, 'Espressif'], [/raspberry/i, 'Raspberry Pi'], [/microsoft/i, 'Microsoft'], [/nintendo/i, 'Nintendo'],
  [/intel corporate|intel/i, 'Intel'], [/dell/i, 'Dell'], [/lenovo/i, 'Lenovo'], [/asustek|asus/i, 'ASUS'],
  [/huawei/i, 'Huawei'], [/xiaomi/i, 'Xiaomi'], [/sky uk|british sky/i, 'Sky'], [/british telecom|^bt /i, 'BT'],
  [/virgin media/i, 'Virgin Media'], [/arris/i, 'Arris'], [/technicolor/i, 'Technicolor'], [/sagemcom/i, 'Sagemcom'],
  [/signify|philips lighting/i, 'Philips Hue'], [/philips/i, 'Philips'], [/ring llc/i, 'Ring'], [/nest labs/i, 'Google Nest'],
  [/bose/i, 'Bose'], [/panasonic/i, 'Panasonic'], [/sharp/i, 'Sharp'], [/realtek/i, 'Realtek'], [/murata/i, 'Murata'],
  [/azurewave/i, 'AzureWave'], [/liteon|lite-on/i, 'Lite-On'], [/hon hai|foxconn/i, 'Foxconn'], [/ubiquiti/i, 'Ubiquiti'],
  [/d-link/i, 'D-Link'], [/zyxel/i, 'Zyxel'], [/avm /i, 'AVM (FRITZ!Box)'], [/tuya/i, 'Tuya'], [/shelly|allterco/i, 'Shelly'],
  [/hikvision/i, 'Hikvision'], [/wyze/i, 'Wyze'], [/arlo/i, 'Arlo'], [/eero/i, 'eero'], [/plume/i, 'Plume'],
];

function shorten(name) {
  for (const [re, b] of BRAND) if (re.test(name)) return b;
  let s = name.replace(SUFFIX, '').replace(/\s{2,}/g, ' ').replace(/[\s,.-]+$/, '').trim();
  if (s.length > 28) s = s.slice(0, 28).trim();
  return s || name.trim();
}

const lines = csv.split(/\r?\n/).slice(1);
const rows = [];
for (const line of lines) {
  if (!line.trim()) continue;
  const f = parseLine(line); // Registry,Assignment,Organization Name,Organization Address
  if (f.length < 3 || f[0] !== 'MA-L') continue;
  const oui = f[1].trim().toUpperCase();
  if (!/^[0-9A-F]{6}$/.test(oui)) continue;
  rows.push(oui + '\t' + shorten(f[2]));
}
rows.sort();
mkdirSync(dirname(out), { recursive: true });
const gz = gzipSync(Buffer.from(rows.join('\n') + '\n'), { level: 9 });
writeFileSync(out, gz);
console.log(`Wrote ${rows.length} manufacturers to ${out} (${(gz.length / 1024).toFixed(0)} KB)`);
