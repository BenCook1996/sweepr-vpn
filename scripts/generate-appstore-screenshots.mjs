#!/usr/bin/env node
/**
 * Generates 12 Apple App Store & Mac App Store screenshots (4 live UI states x 3 display specs)
 * using headless Chromium + CDP Emulation.setDeviceMetricsOverride, flattened to 24-bit opaque RGB PNGs.
 *
 * Output: apps/mobile-ios/fastlane/screenshots/en-GB/*.png
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'apps', 'mobile-ios', 'fastlane', 'screenshots', 'en-GB');
const BG = { r: 4, g: 26, b: 19 }; // #041A13 deep emerald spruce background

const DEVICES = [
  { key: 'iphone-6.9', label: 'iPhone 6.9"', width: 1290, height: 2796, mobile: true, isDesktop: false },
  { key: 'ipad-13', label: 'iPad Pro 13"', width: 2048, height: 2732, mobile: true, isDesktop: false },
  { key: 'macos', label: 'macOS Retina', width: 2880, height: 1800, mobile: false, isDesktop: true }
];

const SCREENS = [
  { id: '01-connected', title: '10Gbps WireGuard Tunnel Active' },
  { id: '02-servers', title: 'RAM-Only WireGuard Server Network' },
  { id: '03-wifi-shield', title: 'Smart-TV & Tracker DNS Shield' },
  { id: '04-account', title: 'Zero-Logs Account & Multi-Device Key' }
];

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium'
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No Chromium/Chrome/Edge binary found for headless screenshot capture.');
}

// --- Pure Node PNG decoder + 24-bit opaque RGB encoder (zero alpha channel) ---
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crcBuf]);
}
function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}
function flattenPngToOpaqueRgb(pngBuf) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(pngBuf.subarray(0, 8).equals(sig), 'Invalid PNG buffer from CDP');
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idats = [];
  while (offset < pngBuf.length) {
    const length = pngBuf.readUInt32BE(offset);
    const type = pngBuf.subarray(offset + 4, offset + 8).toString('ascii');
    const data = pngBuf.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      assert.equal(bitDepth, 8, `Unsupported PNG bitDepth=${bitDepth}`);
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  const raw = zlib.inflateSync(Buffer.concat(idats));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
  const stride = width * bpp;
  const recon = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const rowIn = y * (stride + 1) + 1;
    const rowOut = y * stride;
    for (let x = 0; x < stride; x++) {
      const byte = raw[rowIn + x];
      const a = x >= bpp ? recon[rowOut + x - bpp] : 0;
      const b = y > 0 ? recon[rowOut - stride + x] : 0;
      const c = (x >= bpp && y > 0) ? recon[rowOut - stride + x - bpp] : 0;
      let val = byte;
      if (filter === 1) val = (byte + a) & 0xff;
      else if (filter === 2) val = (byte + b) & 0xff;
      else if (filter === 3) val = (byte + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) val = (byte + paeth(a, b, c)) & 0xff;
      recon[rowOut + x] = val;
    }
  }

  // Re-encode strictly as opaque RGB (colorType=2) with scanline filter byte 0 (or 1)
  const outStride = width * 3 + 1;
  const outRaw = Buffer.alloc(height * outStride);
  for (let y = 0; y < height; y++) {
    const srcRow = y * stride;
    const dstRow = y * outStride;
    outRaw[dstRow] = 0;
    for (let x = 0; x < width; x++) {
      const si = srcRow + x * bpp;
      const di = dstRow + 1 + x * 3;
      if (bpp === 4) {
        const alpha = recon[si + 3] / 255;
        outRaw[di] = Math.round(recon[si] * alpha + BG.r * (1 - alpha));
        outRaw[di + 1] = Math.round(recon[si + 1] * alpha + BG.g * (1 - alpha));
        outRaw[di + 2] = Math.round(recon[si + 2] * alpha + BG.b * (1 - alpha));
      } else {
        outRaw[di] = recon[si];
        outRaw[di + 1] = recon[si + 1];
        outRaw[di + 2] = recon[si + 2];
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bitDepth
  ihdr[9] = 2; // RGB opaque
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(outRaw, { level: 3 });
  return {
    width,
    height,
    buffer: Buffer.concat([sig, makeChunk('IHDR', ihdr), makeChunk('IDAT', compressed), makeChunk('IEND', Buffer.alloc(0))])
  };
}

function renderScreenHtml(screenId, device) {
  const isTablet = device.key === 'ipad-13';
  const isMac = device.key === 'macos';
  const scale = isMac ? 2.0 : isTablet ? 2.0 : 2.95;

  const navItems = [
    { id: '01-connected', label: 'Connect', icon: 'M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z' },
    { id: '02-servers', label: 'Locations', icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z' },
    { id: '03-wifi-shield', label: 'Wi-Fi Shield', icon: 'M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z' },
    { id: '04-account', label: 'Account', icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' }
  ];

  const mainContent = {
    '01-connected': `
      <div class="hero-card">
        <div class="badge-live"><span class="dot"></span>ENCRYPTED &bull; WIREGUARD 10GBPS</div>
        <div class="shield-orb">
          <svg viewBox="0 0 24 24" fill="currentColor" width="52" height="52"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm-1.2 13.4L7.4 12l1.4-1.4 2 2 4.4-4.4 1.4 1.4-5.8 5.8z"/></svg>
        </div>
        <h1>Public Wi-Fi &amp; ISP Protection On</h1>
        <p class="sub">ChaCha20-Poly1305 &bull; IPv6 DNS64 / NAT64 Ready &bull; Zero Traffic Logs</p>
        <div class="endpoint-pill">
          <div>
            <div class="ep-title">London, United Kingdom</div>
            <div class="ep-host">lon-01.sweeprvpn.com &bull; Port 51820</div>
          </div>
          <span class="pill-rtt">8 ms</span>
        </div>
        <div class="metrics-row">
          <div class="metric-box"><div class="m-val">8 ms</div><div class="m-lbl">Handshake RTT</div></div>
          <div class="metric-box"><div class="m-val">ON</div><div class="m-lbl">TV DNS Shield</div></div>
          <div class="metric-box"><div class="m-val">3 / 3</div><div class="m-lbl">RAM Nodes Ready</div></div>
        </div>
        <button class="cta-btn">Disconnect Tunnel</button>
      </div>
      <div class="info-card">
        <div class="row-between">
          <div>
            <div class="row-title">Smart-TV ACR &amp; Telemetry DNS Shield</div>
            <div class="row-sub">Blocks tracking &amp; profiling domains inside WireGuard DNS</div>
          </div>
          <span class="switch on"></span>
        </div>
      </div>`,
    '02-servers': `
      <div class="section-head">
        <h2>RAM-Only 10Gbps Locations</h2>
        <span class="chip">All Nodes Verified</span>
      </div>
      <div class="server-list">
        ${[
          ['London, United Kingdom', 'lon-01.sweeprvpn.com', '8 ms', '14% Load', true],
          ['Manchester, United Kingdom', 'man-01.sweeprvpn.com', '12 ms', '11% Load', false],
          ['Amsterdam, Netherlands', 'ams-01.sweeprvpn.com', '16 ms', '19% Load', false],
          ['Frankfurt, Germany', 'fra-01.sweeprvpn.com', '19 ms', '17% Load', false],
          ['Zurich, Switzerland', 'zrh-01.sweeprvpn.com', '23 ms', '9% Load', false],
          ['New York, United States', 'nyc-01.sweeprvpn.com', '68 ms', '22% Load', false]
        ]
          .map(
            ([city, host, rtt, load, active]) => `
          <div class="server-row ${active ? 'active' : ''}">
            <div>
              <div class="row-title">${city} ${active ? '<span class="tag-cur">CONNECTED</span>' : ''}</div>
              <div class="row-sub">${host} &bull; IPv4 + IPv6 Dual-Stack</div>
            </div>
            <div class="server-right">
              <div class="rtt-val">${rtt}</div>
              <div class="row-sub">${load}</div>
            </div>
          </div>`
          )
          .join('')}
      </div>`,
    '03-wifi-shield': `
      <div class="section-head">
        <h2>Wi-Fi Radar &amp; DNS Shield</h2>
        <span class="chip">Local Inspection Only</span>
      </div>
      <div class="hero-card compact">
        <div class="row-between">
          <div>
            <div class="row-title">Smart-TV ACR Telemetry Filter</div>
            <div class="row-sub">Intercepts Samsung, LG &amp; Roku ACR beacons via hardened tunnel DNS</div>
          </div>
          <span class="switch on"></span>
        </div>
      </div>
      <div class="section-subhead">Live Local Network Path &amp; Bonjour Diagnostic</div>
      <div class="server-list">
        <div class="server-row active">
          <div>
            <div class="row-title">Network Path Status (NWPathMonitor)</div>
            <div class="row-sub">Interface: Wi-Fi + WireGuard utun &bull; DNS64/NAT64 Verified</div>
          </div>
          <span class="pill-rtt">SATISFIED</span>
        </div>
        <div class="server-row">
          <div>
            <div class="row-title">DNS Leak &amp; Resolver Check</div>
            <div class="row-sub">Tunnel DNS: 10.66.66.2 &amp; fd66:66::2 (No ISP Resolver Leak)</div>
          </div>
          <span class="pill-rtt">CLEAN</span>
        </div>
        <div class="server-row">
          <div>
            <div class="row-title">mDNS / Bonjour LAN Discovery</div>
            <div class="row-sub">Apple TV / AirPlay Gateway Verified Locally (Zero Cloud Upload)</div>
          </div>
          <span class="pill-rtt">LOCAL</span>
        </div>
      </div>`,
    '04-account': `
      <div class="section-head">
        <h2>Account &amp; Subscription</h2>
        <span class="chip">PRO ACTIVE</span>
      </div>
      <div class="hero-card compact">
        <div class="row-between">
          <div>
            <div class="ep-title">SWEEPR VPN Pro &bull; Annual Plan</div>
            <div class="row-sub">Offline Ed25519 Signed Entitlement &bull; Apple In-App Purchase</div>
          </div>
          <span class="pill-rtt">ACTIVE</span>
        </div>
        <div class="metrics-row two">
          <div class="metric-box"><div class="m-val">2 / 3</div><div class="m-lbl">Protected Devices</div></div>
          <div class="metric-box"><div class="m-val">ON</div><div class="m-lbl">Keychain Binding</div></div>
        </div>
      </div>
      <div class="server-list">
        <div class="server-row">
          <div>
            <div class="row-title">Manage Subscription / Restore Purchases</div>
            <div class="row-sub">StoreKit 2 Verified Receipt &amp; Cross-Device Activation</div>
          </div>
          <span class="pill-rtt">MANAGE</span>
        </div>
        <div class="server-row">
          <div>
            <div class="row-title">Direct Technical Support</div>
            <div class="row-sub">support@sweeprvpn.com &bull; Privacy Policy &amp; Terms</div>
          </div>
          <span class="pill-rtt">CONTACT</span>
        </div>
        <div class="server-row danger">
          <div>
            <div class="row-title" style="color:#fca5a5;">Delete Account &amp; Data</div>
            <div class="row-sub">Permanently revokes device keys &amp; erases account records</div>
          </div>
          <span class="pill-danger">DELETE</span>
        </div>
      </div>`
  }[screenId];

  const macShell = isMac
    ? `
      <div class="mac-window">
        <div class="mac-titlebar">
          <div class="traffic"><span></span><span></span><span></span></div>
          <div class="win-title">SWEEPR VPN &mdash; Open-Source WireGuard &amp; Wi-Fi Privacy</div>
          <div class="win-right">Encrypted</div>
        </div>
        <div class="mac-body">
          <aside class="mac-sidebar">
            <div class="brand-row"><div class="logo">S</div><div><div class="b-name">SWEEPR</div><div class="b-sub">VPN v2.6</div></div></div>
            ${navItems
              .map(
                (n) => `
              <div class="mac-nav ${n.id === screenId ? 'active' : ''}">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="${n.icon}"/></svg>
                <span>${n.label}</span>
              </div>`
              )
              .join('')}
            <div class="sidebar-foot">Launch at Login Ready<br/>Zero Logs &bull; App Sandbox</div>
          </aside>
          <main class="mac-main"><div class="mac-inner">${mainContent}</div></main>
        </div>
      </div>`
    : `
      <div class="mobile-shell">
        <header class="app-header">
          <div class="brand-row"><div class="logo">S</div><div><div class="b-name">SWEEPR VPN</div><div class="b-sub">Open-Source WireGuard Security</div></div></div>
          <div class="hdr-pill">ZERO LOGS</div>
        </header>
        <main class="app-main">${mainContent}</main>
        <nav class="tab-bar">
          ${navItems
            .map(
              (n) => `
            <div class="tab-item ${n.id === screenId ? 'active' : ''}">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="${n.icon}"/></svg>
              <span>${n.label}</span>
            </div>`
            )
            .join('')}
        </nav>
      </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 100%; height: 100%;
    background: #041A13;
    color: #ECFDF5;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", system-ui, sans-serif;
    overflow: hidden;
    font-variant-numeric: tabular-nums;
  }
  body {
    width: ${device.width}px;
    height: ${device.height}px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(circle at 50% 0%, #0A3829 0%, #041A13 72%);
  }
  .zoom-wrap {
    width: ${Math.round(device.width / scale)}px;
    height: ${Math.round(device.height / scale)}px;
    flex-shrink: 0;
    transform: scale(${scale});
    transform-origin: center center;
    padding: ${isMac ? '36px 48px' : '0'};
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .mobile-shell {
    width: 100%; height: 100%;
    padding: ${isTablet ? '44px 120px' : '24px 18px'};
    display: flex; flex-direction: column; justify-content: space-between; gap: 14px;
  }
  .mac-window {
    width: 100%; height: 100%;
    background: #051F16;
    border: 1px solid rgba(16,185,129,0.28);
    border-radius: 16px;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 32px 80px rgba(0,0,0,0.45);
  }
  .mac-titlebar {
    height: 44px; padding: 0 18px;
    background: #03150F;
    border-bottom: 1px solid rgba(16,185,129,0.18);
    display: flex; align-items: center; justify-content: space-between;
  }
  .traffic { display: flex; gap: 8px; }
  .traffic span { width: 12px; height: 12px; border-radius: 50%; background: #334155; }
  .traffic span:nth-child(1) { background: #ef4444; }
  .traffic span:nth-child(2) { background: #f59e0b; }
  .traffic span:nth-child(3) { background: #10b981; }
  .win-title { font-size: 13px; font-weight: 700; color: #a7f3d0; }
  .win-right { font-size: 11px; font-weight: 800; color: #10b981; text-transform: uppercase; }
  .mac-body { flex: 1; display: grid; grid-template-columns: 230px 1fr; overflow: hidden; }
  .mac-sidebar {
    background: #041710;
    border-right: 1px solid rgba(16,185,129,0.16);
    padding: 20px 14px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .mac-main { padding: 32px 48px; display: flex; flex-direction: column; justify-content: center; align-items: center; overflow: hidden; }
  .mac-inner { width: 100%; max-width: 760px; display: flex; flex-direction: column; gap: 16px; }
  .mac-nav {
    display: flex; align-items: center; gap: 10px;
    padding: 11px 12px; border-radius: 10px;
    color: #94a3b8; font-size: 13.5px; font-weight: 600;
  }
  .mac-nav.active { background: rgba(16,185,129,0.18); color: #34d399; border: 1px solid rgba(16,185,129,0.32); }
  .sidebar-foot { margin-top: auto; font-size: 11px; line-height: 1.5; color: #6ee7b7; opacity: 0.75; padding: 8px; }
  .app-header { display: flex; align-items: center; justify-content: space-between; }
  .brand-row { display: flex; align-items: center; gap: 10px; margin-bottom: ${isMac ? '14px' : '0'}; }
  .logo {
    width: 34px; height: 34px; border-radius: 9px;
    background: #10b981; color: #032016;
    font-weight: 900; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
  }
  .b-name { font-size: 15px; font-weight: 900; letter-spacing: 0.02em; }
  .b-sub { font-size: 11px; color: #6ee7b7; }
  .hdr-pill {
    font-size: 10px; font-weight: 800; letter-spacing: 0.06em;
    padding: 5px 9px; border-radius: 999px;
    background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.35); color: #34d399;
  }
  .app-main { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 14px; overflow: hidden; }
  .hero-card {
    background: #07271C;
    border: 1px solid rgba(16,185,129,0.3);
    border-radius: 20px;
    padding: ${isMac ? '22px' : '22px 18px'};
    display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px;
  }
  .hero-card.compact { align-items: stretch; text-align: left; padding: 18px; }
  .badge-live {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em;
    color: #34d399; background: rgba(16,185,129,0.14);
    border: 1px solid rgba(16,185,129,0.35); padding: 5px 12px; border-radius: 999px;
  }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #10b981; }
  .shield-orb {
    width: 84px; height: 84px; border-radius: 50%;
    background: rgba(16,185,129,0.18); border: 2px solid #10b981;
    color: #34d399; display: flex; align-items: center; justify-content: center;
  }
  h1 { font-size: 21px; font-weight: 900; line-height: 1.2; color: #FFFFFF; }
  h2 { font-size: 20px; font-weight: 900; color: #FFFFFF; }
  .sub { font-size: 12px; color: #a7f3d0; }
  .endpoint-pill {
    width: 100%; background: #041A13; border: 1px solid rgba(16,185,129,0.25);
    border-radius: 13px; padding: 11px 14px;
    display: flex; align-items: center; justify-content: space-between; text-align: left;
  }
  .ep-title { font-size: 13.5px; font-weight: 800; color: #FFFFFF; }
  .ep-host { font-size: 11px; color: #6ee7b7; margin-top: 2px; }
  .metrics-row { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .metrics-row.two { grid-template-columns: repeat(2, 1fr); margin-top: 6px; }
  .metric-box { background: #041A13; border: 1px solid rgba(16,185,129,0.2); border-radius: 11px; padding: 10px 8px; text-align: center; }
  .m-val { font-size: 15px; font-weight: 900; color: #34d399; }
  .m-lbl { font-size: 10px; color: #a7f3d0; margin-top: 2px; }
  .cta-btn {
    width: 100%; border: 0; border-radius: 12px; padding: 12px;
    background: #10b981; color: #032016; font-size: 13.5px; font-weight: 900;
  }
  .info-card {
    background: #07271C; border: 1px solid rgba(16,185,129,0.24);
    border-radius: 16px; padding: 14px 16px;
  }
  .row-between { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .row-title { font-size: 13px; font-weight: 800; color: #FFFFFF; }
  .row-sub { font-size: 11px; color: #a7f3d0; margin-top: 2px; }
  .switch {
    width: 42px; height: 24px; border-radius: 999px; background: #10b981; position: relative; flex-shrink: 0;
  }
  .switch::after {
    content: ''; position: absolute; right: 3px; top: 3px;
    width: 18px; height: 18px; border-radius: 50%; background: #FFFFFF;
  }
  .section-head { display: flex; align-items: center; justify-content: space-between; }
  .section-subhead { font-size: 12px; font-weight: 800; color: #6ee7b7; text-transform: uppercase; letter-spacing: 0.05em; }
  .chip {
    font-size: 10.5px; font-weight: 800; padding: 4px 10px; border-radius: 999px;
    background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.35); color: #34d399;
  }
  .server-list { display: flex; flex-direction: column; gap: 9px; }
  .server-row {
    background: #07271C; border: 1px solid rgba(16,185,129,0.2);
    border-radius: 14px; padding: 12px 14px;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .server-row.active { border-color: #10b981; background: rgba(16,185,129,0.12); }
  .server-row.danger { border-color: rgba(248,113,113,0.4); }
  .server-right { text-align: right; }
  .rtt-val { font-size: 13px; font-weight: 900; color: #34d399; }
  .tag-cur { font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 6px; background: #10b981; color: #032016; margin-left: 6px; }
  .pill-rtt { font-size: 10.5px; font-weight: 800; padding: 4px 9px; border-radius: 999px; background: rgba(16,185,129,0.18); color: #34d399; border: 1px solid rgba(16,185,129,0.35); }
  .pill-danger { font-size: 10.5px; font-weight: 800; padding: 4px 9px; border-radius: 999px; background: rgba(239,68,68,0.18); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); }
  .tab-bar {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;
    background: #07271C; border: 1px solid rgba(16,185,129,0.25);
    border-radius: 16px; padding: 8px 6px;
  }
  .tab-item { display: flex; flex-direction: column; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; color: #94a3b8; }
  .tab-item.active { color: #34d399; }
</style>
</head>
<body>
  <div class="zoom-wrap">${macShell}</div>
</body>
</html>`;
}

async function launchBrowserCdp(exePath) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sweepr-cdp-'));
  const proc = spawn(
    exePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      'about:blank'
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] }
  );

  const wsUrl = await new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for CDP WebSocket. Stderr:\n${stderr}`)), 15000);
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      const m = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (m) {
        clearTimeout(timer);
        resolve(m[1]);
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Browser exited early (${code}). Stderr:\n${stderr}`));
    });
  });

  // Connect to browser-level CDP and open/attach to a page target
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });

  function send(method, params = {}, sessionId = undefined) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  }

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);

  return {
    send: (method, params) => send(method, params, sessionId),
    close: async () => {
      try { ws.close(); } catch {}
      try { proc.stderr?.destroy(); } catch {}
      if (process.platform === 'win32' && proc.pid) {
        try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
      }
      await new Promise((resolve) => {
        const done = () => resolve();
        proc.once('exit', done);
        try { proc.kill(); } catch { resolve(); }
        setTimeout(done, 800);
      });
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 150 });
      } catch {}
    }
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browserPath = findBrowserExecutable();
  const cdp = await launchBrowserCdp(browserPath);
  const generated = [];

  try {
    for (const device of DEVICES) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: device.width,
        height: device.height,
        deviceScaleFactor: 1,
        mobile: device.mobile
      });

      for (const screen of SCREENS) {
        const html = renderScreenHtml(screen.id, device);
        assert.ok(!/\b(android|google play|trial|beta|netflix|unblock)\b/i.test(html), `Forbidden string found in ${screen.id}`);
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
        await cdp.send('Page.navigate', { url: dataUrl });
        await cdp.send('Runtime.evaluate', {
          expression: 'document.fonts.ready.then(() => true)',
          awaitPromise: true
        });
        const { data: b64 } = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        const flattened = flattenPngToOpaqueRgb(Buffer.from(b64, 'base64'));
        assert.equal(flattened.width, device.width, `Width mismatch for ${device.key}-${screen.id}`);
        assert.equal(flattened.height, device.height, `Height mismatch for ${device.key}-${screen.id}`);

        const fileName = `${device.key}-${screen.id}.png`;
        const outPath = path.join(OUT_DIR, fileName);
        fs.writeFileSync(outPath, flattened.buffer);

        // Verify IHDR on disk
        const written = fs.readFileSync(outPath);
        assert.equal(written.readUInt32BE(16), device.width);
        assert.equal(written.readUInt32BE(20), device.height);
        assert.equal(written[24], 8, 'PNG bitDepth must be 8');
        assert.equal(written[25], 2, 'PNG colorType must be 2 (opaque RGB)');
        generated.push(`${fileName} (${device.width}x${device.height}, colorType=2)`);
      }
    }
  } finally {
    await cdp.close();
  }

  console.log(`Generated ${generated.length}/12 App Store & Mac App Store opaque RGB screenshots in ${path.relative(ROOT, OUT_DIR)}:`);
  for (const item of generated) console.log(`  - ${item}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('generate-appstore-screenshots failed:', err);
  process.exit(1);
});
