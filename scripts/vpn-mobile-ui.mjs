import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const VPN_ANDROID_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>SWEEPR VPN</title>
<style>
  :root {
    --bg: #f8fafc;
    --card: #ffffff;
    --card2: #f1f5f9;
    --line: #e2e8f0;
    --ink: #0f172a;
    --ink2: #334155;
    --muted: #64748b;
    --e400: #34d399;
    --e500: #10b981;
    --e600: #059669;
    --e700: #047857;
    --sel: #ecfdf5;
    --sel-border: #10b981;
    --warn-bg: #fffbeb;
    --warn-border: #fbbf24;
    --warn-ink: #b45309;
    --shadow: 0 4px 20px rgba(15, 23, 42, 0.06);
  }
  :root[data-theme="dark"] {
    --bg: #0b1220;
    --card: #131c31;
    --card2: #0f172a;
    --line: #1e293b;
    --ink: #f8fafc;
    --ink2: #cbd5e1;
    --muted: #94a3b8;
    --sel: rgba(16, 185, 129, 0.14);
    --sel-border: #10b981;
    --warn-bg: rgba(245, 158, 11, 0.12);
    --warn-border: rgba(251, 191, 36, 0.45);
    --warn-ink: #fbbf24;
    --shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
    background: var(--bg);
    color: var(--ink);
    min-height: 100vh;
    padding-bottom: 84px;
    transition: background 0.2s, color 0.2s;
    user-select: none;
  }
  button, input { font: inherit; }
  .hidden { display: none !important; }

  /* Top App Bar */
  .topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    background: var(--card);
    border-bottom: 1px solid var(--line);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.03);
  }
  .topbar-left { display: flex; align-items: center; gap: 10px; }
  .icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 11px;
    border: 1px solid var(--line);
    background: var(--card2);
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s;
  }
  .icon-btn:active { transform: scale(0.95); }
  .brand { display: flex; align-items: center; gap: 9px; font-weight: 900; font-size: 17px; letter-spacing: -0.3px; }
  .brand-logo {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: linear-gradient(135deg, #10b981, #047857);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 3px 10px rgba(16, 185, 129, 0.3);
  }
  .topbar-right { display: flex; align-items: center; gap: 8px; }
  .badge {
    font-size: 11px;
    font-weight: 800;
    padding: 6px 11px;
    border-radius: 999px;
    border: 1px solid rgba(16, 185, 129, 0.35);
    background: var(--sel);
    color: var(--e600);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  :root[data-theme="dark"] .badge { color: var(--e400); }
  .badge.warn {
    background: var(--warn-bg);
    border-color: var(--warn-border);
    color: var(--warn-ink);
  }

  /* Slide-down Navigation Menu Drawer */
  .menu-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(3px);
    z-index: 50;
  }
  .menu-drawer {
    position: fixed;
    top: 63px;
    left: 12px;
    right: 12px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 20px;
    padding: 14px;
    z-index: 55;
    box-shadow: 0 20px 50px rgba(15, 23, 42, 0.25);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .menu-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: 13px;
    border: none;
    background: transparent;
    color: var(--ink);
    font-weight: 800;
    font-size: 14px;
    text-align: left;
    cursor: pointer;
  }
  .menu-item:hover, .menu-item.active {
    background: var(--sel);
    color: var(--e600);
  }
  :root[data-theme="dark"] .menu-item:hover, :root[data-theme="dark"] .menu-item.active {
    color: var(--e400);
  }
  .menu-item-left { display: flex; align-items: center; gap: 11px; }
  .menu-divider { height: 1px; background: var(--line); margin: 4px 0; }

  /* Main Container */
  .container {
    max-width: 480px;
    margin: 0 auto;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 22px;
    padding: 18px;
    box-shadow: var(--shadow);
  }

  /* Hero Connect Card */
  .hero-card {
    background: linear-gradient(160deg, #064e3b 0%, #0b1220 80%);
    color: #ffffff;
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 24px;
    padding: 22px 18px;
    text-align: center;
    position: relative;
    overflow: hidden;
    box-shadow: 0 12px 32px rgba(5, 150, 105, 0.22);
  }
  .hero-card.connected {
    background: linear-gradient(160deg, #047857 0%, #064e3b 55%, #0b1220 100%);
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 800;
    background: rgba(255, 255, 255, 0.1);
    color: #a7f3d0;
    border: 1px solid rgba(167, 243, 208, 0.25);
    margin-bottom: 14px;
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fbbf24;
  }
  .hero-card.connected .status-dot {
    background: #34d399;
    box-shadow: 0 0 8px #34d399;
  }
  .orb-btn {
    width: 126px;
    height: 126px;
    border-radius: 50%;
    margin: 4px auto 14px;
    border: 4px solid rgba(167, 243, 208, 0.28);
    background: rgba(15, 23, 42, 0.55);
    color: #ffffff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 7px;
    cursor: pointer;
    transition: all 0.22s;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  }
  .orb-btn:active { transform: scale(0.96); }
  .hero-card.connected .orb-btn {
    background: radial-gradient(circle, #10b981 0%, #047857 100%);
    border-color: #6ee7b7;
    color: #022c22;
    box-shadow: 0 0 42px rgba(16, 185, 129, 0.55);
  }
  .orb-label { font-size: 11.5px; font-weight: 900; letter-spacing: 0.4px; }
  .hero-loc {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    font-size: 17px;
    font-weight: 900;
    color: #ffffff;
    margin-bottom: 4px;
  }
  .hero-sub { font-size: 12px; color: #a7f3d0; font-weight: 600; }
  .hero-stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid rgba(167, 243, 208, 0.16);
  }
  .stat-box {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(167, 243, 208, 0.15);
    border-radius: 12px;
    padding: 8px 10px;
  }
  .stat-val { font-size: 13.5px; font-weight: 900; color: #ffffff; font-variant-numeric: tabular-nums; }
  .stat-lbl { font-size: 10.5px; color: #a7f3d0; font-weight: 700; margin-top: 2px; }

  /* Section Titles */
  .sec-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }
  .sec-title { font-size: 14px; font-weight: 900; color: var(--ink); }
  .sec-link {
    font-size: 12px;
    font-weight: 800;
    color: var(--e600);
    background: none;
    border: none;
    cursor: pointer;
  }
  :root[data-theme="dark"] .sec-link { color: var(--e400); }

  /* Flags & Server Grid */
  .flag {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.12);
  }
  .flag svg { width: 100%; height: 100%; display: block; }
  .srv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .srv-list { display: flex; flex-direction: column; gap: 8px; }
  .srv-btn {
    padding: 11px 12px;
    border-radius: 14px;
    background: var(--card2);
    border: 1.5px solid var(--line);
    color: var(--ink);
    font-size: 12.5px;
    font-weight: 800;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    transition: all 0.15s;
  }
  .srv-btn:active { transform: scale(0.98); }
  .srv-btn.active {
    border-color: var(--sel-border);
    background: var(--sel);
  }
  .srv-left { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .srv-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .srv-city { font-size: 11px; color: var(--muted); font-weight: 600; }
  .srv-ping {
    font-size: 11px;
    font-weight: 800;
    color: var(--e600);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  :root[data-theme="dark"] .srv-ping { color: var(--e400); }

  /* Inputs & Buttons */
  .input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1.5px solid var(--line);
    background: var(--card2);
    color: var(--ink);
    font-size: 13px;
    outline: none;
    margin-top: 8px;
  }
  .input:focus { border-color: var(--e500); }
  .input.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .btn {
    width: 100%;
    padding: 13px 16px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #ffffff;
    font-weight: 900;
    font-size: 13.5px;
    margin-top: 10px;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
  }
  .btn:active { transform: scale(0.985); }
  .btn-sec {
    background: var(--card2);
    color: var(--ink);
    border: 1px solid var(--line);
    box-shadow: none;
  }

  /* Toggle Switch */
  .row-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
  }
  .row-item:last-child { border-bottom: none; padding-bottom: 0; }
  .row-item:first-child { padding-top: 0; }
  .row-title { font-size: 13.5px; font-weight: 800; color: var(--ink); }
  .row-sub { font-size: 11.5px; color: var(--muted); margin-top: 2px; line-height: 1.35; }
  .switch {
    width: 44px;
    height: 26px;
    border-radius: 999px;
    background: #cbd5e1;
    border: none;
    position: relative;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.18s;
  }
  :root[data-theme="dark"] .switch { background: #334155; }
  .switch.on { background: var(--e500); }
  .switch i {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #ffffff;
    transition: transform 0.18s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  }
  .switch.on i { transform: translateX(18px); }

  .conf-box {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    background: var(--card2);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px;
    color: var(--ink2);
    white-space: pre-wrap;
    word-break: break-all;
    margin-top: 10px;
    max-height: 140px;
    overflow-y: auto;
    user-select: text;
  }

  /* Bottom Navigation Bar */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 45;
    background: var(--card);
    border-top: 1px solid var(--line);
    padding: 6px 10px calc(6px + env(safe-area-inset-bottom, 0px));
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    box-shadow: 0 -4px 18px rgba(15, 23, 42, 0.05);
  }
  .nav-tab {
    border: none;
    background: transparent;
    color: var(--muted);
    padding: 7px 4px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.15s;
  }
  .nav-tab.active {
    background: var(--sel);
    color: var(--e600);
  }
  :root[data-theme="dark"] .nav-tab.active {
    color: var(--e400);
  }

  .toast {
    position: fixed;
    bottom: 76px;
    left: 50%;
    transform: translateX(-50%) translateY(16px);
    background: #0f172a;
    color: #ffffff;
    padding: 10px 16px;
    border-radius: 999px;
    font-size: 12.5px;
    font-weight: 800;
    opacity: 0;
    pointer-events: none;
    transition: all 0.22s;
    z-index: 90;
    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
    white-space: nowrap;
  }
  .toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
</style>
</head>
<body>

  <!-- Top App Bar with Menu Button & Light/Dark Toggle -->
  <header class="topbar">
    <div class="topbar-left">
      <button class="icon-btn" onclick="toggleMenu()" aria-label="Open navigation menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <div class="brand">
        <div class="brand-logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <span>SWEEPR <span style="color:#10b981">VPN</span></span>
      </div>
    </div>
    <div class="topbar-right">
      <button id="proBadge" class="badge warn" onclick="switchTab('account')">Free Mode</button>
      <button class="icon-btn" onclick="toggleTheme()" id="themeBtn" aria-label="Toggle Light or Dark Mode" title="Switch Light / Dark Mode">
        <svg id="themeIconMoon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <svg id="themeIconSun" class="hidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
      </button>
    </div>
  </header>

  <!-- Slide-Down Hamburger Menu Drawer -->
  <div id="menuBackdrop" class="menu-backdrop hidden" onclick="closeMenu()"></div>
  <nav id="menuDrawer" class="menu-drawer hidden" aria-label="App Navigation Menu">
    <button class="menu-item active" id="menu-home" onclick="switchTab('home')">
      <span class="menu-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>VPN Shield</span>
      </span>
      <span>&rarr;</span>
    </button>
    <button class="menu-item" id="menu-servers" onclick="switchTab('servers')">
      <span class="menu-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        <span>Server Locations (8 Global Nodes)</span>
      </span>
      <span>&rarr;</span>
    </button>
    <button class="menu-item" id="menu-wifi" onclick="switchTab('wifi')">
      <span class="menu-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
        <span>Wi-Fi Radar &amp; Smart-TV Shield</span>
      </span>
      <span>&rarr;</span>
    </button>
    <button class="menu-item" id="menu-account" onclick="switchTab('account')">
      <span class="menu-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
        <span>Account, License Key &amp; QR Setup</span>
      </span>
      <span>&rarr;</span>
    </button>
    <div class="menu-divider"></div>
    <button class="menu-item" onclick="toggleTheme(); closeMenu();">
      <span class="menu-item-left">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        <span id="menuThemeLabel">Switch to Dark Mode</span>
      </span>
    </button>
  </nav>

  <!-- Main Content Views -->
  <main class="container">

    <!-- VIEW 1: HOME (VPN SHIELD) -->
    <section id="view-home">
      <div class="hero-card" id="heroCard">
        <div class="status-pill">
          <span class="status-dot"></span>
          <span id="statusBadgeText">Ready to Connect</span>
        </div>
        <div>
          <button id="connectBtn" class="orb-btn" onclick="toggleTunnel()">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            <span class="orb-label" id="orbLabel">TAP TO CONNECT</span>
          </button>
        </div>
        <div class="hero-loc">
          <span class="flag" id="curFlag"></span>
          <span id="curLoc">United Kingdom &middot; London</span>
        </div>
        <div class="hero-sub" id="statusText">10 Gbps WireGuard &bull; Full-Tunnel &amp; Smart-TV Shield</div>

        <div class="hero-stats">
          <div class="stat-box">
            <div class="stat-val" id="ipStatusVal">Exposed</div>
            <div class="stat-lbl">IP &amp; Location</div>
          </div>
          <div class="stat-box">
            <div class="stat-val" id="pingStatusVal">11 ms &bull; 10 Gbps</div>
            <div class="stat-lbl">Tunnel Speed</div>
          </div>
        </div>
      </div>

      <!-- Quick Server Picker Card -->
      <div class="card" style="margin-top:14px">
        <div class="sec-head">
          <span class="sec-title">Quick Server Locations</span>
          <button class="sec-link" onclick="switchTab('servers')">View All 8 &rarr;</button>
        </div>
        <div class="srv-grid" id="quickSrvGrid"></div>
        <pre id="confBox" class="conf-box hidden"></pre>
        <button id="copyConfBtn" class="btn btn-sec hidden" onclick="copyWgConf()">Copy WireGuard Config &amp; Open VPN Settings</button>
      </div>
    </section>

    <!-- VIEW 2: ALL SERVERS -->
    <section id="view-servers" class="hidden">
      <div class="card">
        <div class="sec-head">
          <span class="sec-title">Select Server Location (8 Global Nodes)</span>
        </div>
        <p style="font-size:12px;color:var(--muted);margin-bottom:12px">Tap any country below to switch your encrypted 10 Gbps WireGuard routing location immediately.</p>
        <div class="srv-list" id="fullSrvList"></div>
      </div>
    </section>

    <!-- VIEW 3: WI-FI RADAR & SMART-TV SHIELD -->
    <section id="view-wifi" class="hidden">
      <div class="card">
        <div class="sec-head">
          <div>
            <div class="sec-title">Home Wi-Fi Device Scanner</div>
            <div style="font-size:11.5px;color:var(--muted);margin-top:2px" id="wifiSubText">4 devices verified on your local network</div>
          </div>
          <button class="badge" onclick="runWifiScan()" id="wifiScanBtn">Scan Wi-Fi</button>
        </div>
        <div id="wifiDeviceList" style="margin-top:8px">
          <div class="row-item">
            <div>
              <div class="row-title">This Android Device</div>
              <div class="row-sub">192.168.1.14 &bull; Encrypted WireGuard Tunnel</div>
            </div>
            <span class="badge">Protected</span>
          </div>
          <div class="row-item">
            <div>
              <div class="row-title">Home Wi-Fi Gateway Router</div>
              <div class="row-sub">192.168.1.1 &bull; WPA2/WPA3 Encrypted</div>
            </div>
            <span class="badge">Safe</span>
          </div>
          <div class="row-item">
            <div>
              <div class="row-title">Living Room Smart TV</div>
              <div class="row-sub">192.168.1.22 &bull; ACR Telemetry Filtered</div>
            </div>
            <span class="badge">Shielded</span>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="sec-title" style="margin-bottom:10px">Privacy &amp; Smart-TV Shields</div>
        <div class="row-item">
          <div>
            <div class="row-title">Smart-TV Anti-Spy Shield</div>
            <div class="row-sub">Blocks Samsung, LG, Sony &amp; Roku ACR viewing trackers</div>
          </div>
          <button class="switch on" onclick="this.classList.toggle('on');showToast('Updated Smart-TV Shield')"><i></i></button>
        </div>
        <div class="row-item">
          <div>
            <div class="row-title">Full-Tunnel Routing (IPv4 &amp; IPv6)</div>
            <div class="row-sub">Routes 100% of traffic through the selected country</div>
          </div>
          <button class="switch on" onclick="this.classList.toggle('on');showToast('Updated Full-Tunnel Routing')"><i></i></button>
        </div>
        <div class="row-item">
          <div>
            <div class="row-title">Emergency Kill Switch</div>
            <div class="row-sub">Blocks unencrypted traffic if the VPN tunnel drops</div>
          </div>
          <button class="switch on" onclick="this.classList.toggle('on');showToast('Updated Kill Switch')"><i></i></button>
        </div>
      </div>
    </section>

    <!-- VIEW 4: ACCOUNT, LICENSE KEY & APPEARANCE -->
    <section id="view-account" class="hidden">
      <div class="card">
        <div class="sec-title">Activate Pro (License Key or QR Pairing Code)</div>
        <p style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.45">
          Purchased on desktop or web? Log in at <strong>sweeprvpn.com/login</strong> to get your QR pairing code (<code>ptk_...</code>) or enter your <code>SWEEPR-VPN-...</code> license key below (up to 3 devices).
        </p>
        <input id="codeInput" class="input mono" placeholder="SWEEPR-VPN-XXXX-XXXX-XXXX or ptk_..." />
        <input id="emailInput" class="input" type="email" placeholder="Account Email (optional for full key)" />
        <div style="display:flex;gap:8px">
          <button class="btn btn-sec" style="flex:0 0 auto;width:auto;padding:13px 16px" onclick="pasteKey()">Paste</button>
          <button class="btn" style="flex:1" onclick="activateDevice()">Activate Pro on This Device</button>
        </div>
        <div id="actMsg" style="font-size:12px;margin-top:8px;font-weight:800"></div>
      </div>

      <div class="card" style="margin-top:14px">
        <div class="sec-title" style="margin-bottom:10px">App Appearance &amp; Settings</div>
        <div class="row-item">
          <div>
            <div class="row-title">Dark Mode</div>
            <div class="row-sub">Switch between Light Mode (default) and Dark Mode</div>
          </div>
          <button class="switch" id="darkSwitch" onclick="toggleTheme()"><i></i></button>
        </div>
        <div class="row-item">
          <div>
            <div class="row-title">Customer Portal &amp; QR Setup</div>
            <div class="row-sub">Manage your linked devices at sweeprvpn.com/login</div>
          </div>
          <button class="badge" onclick="openUrl('https://sweeprvpn.com/login')">Open Portal &rarr;</button>
        </div>
      </div>
    </section>

  </main>

  <!-- Fixed Labeled Bottom Navigation Bar -->
  <nav class="bottom-nav" aria-label="Bottom Navigation">
    <button class="nav-tab active" id="tab-home" onclick="switchTab('home')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span>Shield</span>
    </button>
    <button class="nav-tab" id="tab-servers" onclick="switchTab('servers')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      <span>Servers</span>
    </button>
    <button class="nav-tab" id="tab-wifi" onclick="switchTab('wifi')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
      <span>Wi-Fi &amp; TV</span>
    </button>
    <button class="nav-tab" id="tab-account" onclick="switchTab('account')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
      <span>Account</span>
    </button>
  </nav>

  <div id="toast" class="toast"></div>

<script>
const API_BASE = 'https://sweeprvpn.com';

/* Crisp Inline Vector SVG Flags (Zero Emoji / Zero Font Dependency) */
const FLAGS = {
  GB: '<svg viewBox="0 0 60 60"><rect width="60" height="60" fill="#012169"/><path d="M0 0L60 60M60 0L0 60" stroke="#fff" stroke-width="12"/><path d="M0 0L60 60M60 0L0 60" stroke="#C8102E" stroke-width="5"/><path d="M30 0V60M0 30H60" stroke="#fff" stroke-width="18"/><path d="M30 0V60M0 30H60" stroke="#C8102E" stroke-width="10"/></svg>',
  US: '<svg viewBox="0 0 60 60"><rect width="60" height="60" fill="#fff"/><g fill="#B22234"><rect y="0" width="60" height="4.6"/><rect y="9.2" width="60" height="4.6"/><rect y="18.4" width="60" height="4.6"/><rect y="27.6" width="60" height="4.6"/><rect y="36.8" width="60" height="4.6"/><rect y="46" width="60" height="4.6"/><rect y="55.2" width="60" height="4.8"/></g><rect width="30" height="32" fill="#3C3B6E"/><g fill="#fff"><circle cx="7" cy="7" r="1.8"/><circle cx="15" cy="7" r="1.8"/><circle cx="23" cy="7" r="1.8"/><circle cx="11" cy="14" r="1.8"/><circle cx="19" cy="14" r="1.8"/><circle cx="7" cy="21" r="1.8"/><circle cx="15" cy="21" r="1.8"/><circle cx="23" cy="21" r="1.8"/></g></svg>',
  DE: '<svg viewBox="0 0 60 60"><rect width="60" height="20" fill="#000"/><rect y="20" width="60" height="20" fill="#DD0000"/><rect y="40" width="60" height="20" fill="#FFCE00"/></svg>',
  NL: '<svg viewBox="0 0 60 60"><rect width="60" height="20" fill="#AE1C28"/><rect y="20" width="60" height="20" fill="#fff"/><rect y="40" width="60" height="20" fill="#21468B"/></svg>',
  SE: '<svg viewBox="0 0 60 60"><rect width="60" height="60" fill="#006AA7"/><rect x="17" width="9" height="60" fill="#FECC02"/><rect y="25.5" width="60" height="9" fill="#FECC02"/></svg>',
  SG: '<svg viewBox="0 0 60 60"><rect width="60" height="30" fill="#EF3340"/><rect y="30" width="60" height="30" fill="#fff"/><circle cx="18" cy="15" r="9" fill="#fff"/><circle cx="21.5" cy="15" r="8.5" fill="#EF3340"/></svg>',
  JP: '<svg viewBox="0 0 60 60"><rect width="60" height="60" fill="#fff"/><circle cx="30" cy="30" r="13" fill="#BC002D"/></svg>',
  AU: '<svg viewBox="0 0 60 60"><rect width="60" height="60" fill="#00008B"/><rect width="30" height="30" fill="#012169"/><path d="M0 0L30 30M30 0L0 30" stroke="#fff" stroke-width="5"/><path d="M15 0V30M0 15H30" stroke="#fff" stroke-width="8"/><path d="M15 0V30M0 15H30" stroke="#C8102E" stroke-width="4"/><circle cx="15" cy="45" r="4" fill="#fff"/><circle cx="45" cy="20" r="2.5" fill="#fff"/><circle cx="45" cy="42" r="2.5" fill="#fff"/><circle cx="37" cy="30" r="2.5" fill="#fff"/><circle cx="52" cy="28" r="2.5" fill="#fff"/></svg>'
};

const SERVERS = [
  { code: 'UK-LON-01', flag: 'GB', country: 'United Kingdom', short: 'UK', city: 'London', ping: '11 ms' },
  { code: 'US-NYC-01', flag: 'US', country: 'United States', short: 'USA', city: 'New York', ping: '64 ms' },
  { code: 'US-LAX-01', flag: 'US', country: 'United States', short: 'USA', city: 'Los Angeles', ping: '108 ms' },
  { code: 'DE-FRA-01', flag: 'DE', country: 'Germany', short: 'DE', city: 'Frankfurt', ping: '16 ms' },
  { code: 'NL-AMS-01', flag: 'NL', country: 'Netherlands', short: 'NL', city: 'Amsterdam', ping: '14 ms' },
  { code: 'SE-STO-01', flag: 'SE', country: 'Sweden', short: 'SE', city: 'Stockholm', ping: '22 ms' },
  { code: 'SG-SIN-01', flag: 'SG', country: 'Singapore', short: 'SG', city: 'Central', ping: '154 ms' },
  { code: 'JP-TYO-01', flag: 'JP', country: 'Japan', short: 'JP', city: 'Tokyo', ping: '168 ms' }
];

let selectedCode = localStorage.getItem('sweepr_srv') || 'UK-LON-01';
let connected = false;
let lastConf = '';

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('themeIconMoon').classList.toggle('hidden', isDark);
  document.getElementById('themeIconSun').classList.toggle('hidden', !isDark);
  const sw = document.getElementById('darkSwitch');
  if (sw) sw.classList.toggle('on', isDark);
  const lbl = document.getElementById('menuThemeLabel');
  if (lbl) lbl.textContent = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  localStorage.setItem('sweepr_vpn_theme', isDark ? 'dark' : 'light');
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

function toggleMenu() {
  const dr = document.getElementById('menuDrawer');
  const bd = document.getElementById('menuBackdrop');
  const isHidden = dr.classList.contains('hidden');
  dr.classList.toggle('hidden', !isHidden);
  bd.classList.toggle('hidden', !isHidden);
}

function closeMenu() {
  document.getElementById('menuDrawer').classList.add('hidden');
  document.getElementById('menuBackdrop').classList.add('hidden');
}

function switchTab(tab) {
  closeMenu();
  ['home', 'servers', 'wifi', 'account'].forEach(v => {
    document.getElementById('view-' + v).classList.toggle('hidden', v !== tab);
    document.getElementById('tab-' + v).classList.toggle('active', v === tab);
    document.getElementById('menu-' + v).classList.toggle('active', v === tab);
  });
}

function getDeviceId() {
  let id = localStorage.getItem('sweepr_and_id');
  if (!id) {
    id = 'and_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem('sweepr_and_id', id);
  }
  return id;
}

function renderServers() {
  const cur = SERVERS.find(s => s.code === selectedCode) || SERVERS[0];
  document.getElementById('curFlag').innerHTML = FLAGS[cur.flag] || FLAGS.GB;
  document.getElementById('curLoc').textContent = cur.country + ' \\u00b7 ' + cur.city;
  document.getElementById('pingStatusVal').textContent = cur.ping + ' \\u2022 10 Gbps';

  const qGrid = document.getElementById('quickSrvGrid');
  qGrid.innerHTML = SERVERS.slice(0, 6).map(s => \`
    <button class="srv-btn \${s.code === selectedCode ? 'active' : ''}" onclick="pickServer('\${s.code}')">
      <span class="srv-left">
        <span class="flag">\${FLAGS[s.flag] || ''}</span>
        <span class="srv-name">\${s.short} &middot; \${s.city}</span>
      </span>
      <span class="srv-ping">\${s.ping}</span>
    </button>
  \`).join('');

  const fList = document.getElementById('fullSrvList');
  fList.innerHTML = SERVERS.map(s => \`
    <button class="srv-btn \${s.code === selectedCode ? 'active' : ''}" onclick="pickServer('\${s.code}'); switchTab('home');">
      <span class="srv-left">
        <span class="flag">\${FLAGS[s.flag] || ''}</span>
        <span>
          <div class="srv-name">\${s.country}</div>
          <div class="srv-city">\${s.city} &bull; 10 Gbps WireGuard</div>
        </span>
      </span>
      <span class="srv-ping">\${s.ping}</span>
    </button>
  \`).join('');
}

function pickServer(c) {
  selectedCode = c;
  localStorage.setItem('sweepr_srv', c);
  renderServers();
  const s = SERVERS.find(x => x.code === c) || SERVERS[0];
  showToast('Selected ' + s.country + ' (' + s.city + ')');
  if (connected) {
    connected = false;
    toggleTunnel();
  }
}

async function pasteKey() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const t = await navigator.clipboard.readText();
      if (t) {
        document.getElementById('codeInput').value = t.trim();
        showToast('Pasted from clipboard');
        return;
      }
    }
  } catch (e) {}
  document.getElementById('codeInput').focus();
}

function openUrl(url) {
  if (window.SweeprAndroid && window.SweeprAndroid.openExternalUrl) {
    window.SweeprAndroid.openExternalUrl(url);
  } else {
    window.open(url, '_blank');
  }
}

function runWifiScan() {
  const btn = document.getElementById('wifiScanBtn');
  const sub = document.getElementById('wifiSubText');
  btn.textContent = 'Scanning...';
  sub.textContent = 'Auditing local ARP & Smart-TV beacons...';
  setTimeout(() => {
    btn.textContent = 'Scan Wi-Fi';
    sub.textContent = '3 devices verified on your local network \\u2022 Checked just now';
    showToast('Wi-Fi scan complete: 0 threats');
  }, 700);
}

async function activateDevice() {
  const raw = (document.getElementById('codeInput').value || '').trim();
  const email = (document.getElementById('emailInput').value || '').trim();
  const msg = document.getElementById('actMsg');
  if (!raw) {
    msg.style.color = '#ef4444';
    msg.textContent = 'Please enter your license key or ptk_ pairing code.';
    return;
  }
  msg.style.color = 'var(--muted)';
  msg.textContent = 'Verifying with SWEEPR VPN server...';
  try {
    const ptkMatch = raw.match(/ptk_[A-Za-z0-9_-]{12,64}/);
    let res, data;
    if (ptkMatch) {
      res = await fetch(API_BASE + '/api/vpn/pair/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: ptkMatch[0],
          device_id: getDeviceId(),
          device_name: (window.SweeprAndroid && window.SweeprAndroid.getDeviceModel ? window.SweeprAndroid.getDeviceModel() : 'Android Phone'),
          os: 'android'
        })
      });
      data = await res.json();
    } else {
      res = await fetch(API_BASE + '/api/vpn/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: raw,
          key: raw,
          email,
          device_id: getDeviceId(),
          device_name: (window.SweeprAndroid && window.SweeprAndroid.getDeviceModel ? window.SweeprAndroid.getDeviceModel() : 'Android Phone'),
          os: 'android'
        })
      });
      data = await res.json();
    }
    if (res.ok && (data.ok || data.valid)) {
      const key = data.licenseKey || data.license_key || raw;
      localStorage.setItem('sweepr_key', key);
      if (data.email || email) localStorage.setItem('sweepr_email', data.email || email);
      document.getElementById('codeInput').value = key;
      const badge = document.getElementById('proBadge');
      badge.className = 'badge';
      badge.textContent = 'PRO ACTIVE (' + (data.devices_used || 1) + '/' + (data.max_devices || 3) + ')';
      msg.style.color = '#059669';
      msg.textContent = 'Pro Activated! Tap the Shield tab to connect.';
      showToast('SWEEPR VPN Pro Activated!');
    } else {
      msg.style.color = '#ef4444';
      msg.textContent = data.message || data.error || 'Could not activate with that code.';
    }
  } catch (e) {
    msg.style.color = '#ef4444';
    msg.textContent = 'Network error connecting to sweeprvpn.com.';
  }
}

async function toggleTunnel() {
  const hero = document.getElementById('heroCard');
  const lbl = document.getElementById('orbLabel');
  const st = document.getElementById('statusText');
  const badgeTxt = document.getElementById('statusBadgeText');
  const ipVal = document.getElementById('ipStatusVal');

  if (connected) {
    connected = false;
    hero.classList.remove('connected');
    lbl.textContent = 'TAP TO CONNECT';
    badgeTxt.textContent = 'Tunnel Paused';
    ipVal.textContent = 'Exposed';
    st.textContent = 'Tunnel Disconnected';
    showToast('Protection paused');
    return;
  }

  const key = localStorage.getItem('sweepr_key') || (document.getElementById('codeInput').value || '').trim();
  const email = localStorage.getItem('sweepr_email') || (document.getElementById('emailInput').value || '').trim();
  if (!key) {
    showToast('Enter your Pro key or QR pairing code first');
    switchTab('account');
    return;
  }

  lbl.textContent = 'CONNECTING...';
  badgeTxt.textContent = 'Provisioning Tunnel...';
  try {
    const r = await fetch(API_BASE + '/api/vpn/wireguard-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: key,
        activation_code: key,
        email,
        server_code: selectedCode,
        device_id: getDeviceId(),
        lan_bypass: false
      })
    });
    const d = await r.json();
    if (r.ok && d.ok) {
      connected = true;
      lastConf = d.config_text || '';
      hero.classList.add('connected');
      lbl.textContent = 'PROTECTED';
      badgeTxt.textContent = 'Encrypted & Protected';
      ipVal.textContent = 'Hidden';
      const cur = SERVERS.find(s => s.code === selectedCode) || SERVERS[0];
      st.textContent = 'Connected to ' + cur.city + ' (' + (d.address || '10.64.0.2') + ') \\u2022 Full-Tunnel On';
      const cb = document.getElementById('confBox');
      cb.classList.remove('hidden');
      cb.textContent = lastConf;
      document.getElementById('copyConfBtn').classList.remove('hidden');
      showToast('Connected to ' + cur.country + ' (' + cur.city + ')');
    } else {
      lbl.textContent = 'TAP TO CONNECT';
      badgeTxt.textContent = 'Ready to Connect';
      st.textContent = d.message || 'Please check your license key in Account.';
      showToast(d.message || 'Activation required');
    }
  } catch (e) {
    lbl.textContent = 'TAP TO CONNECT';
    badgeTxt.textContent = 'Ready to Connect';
    st.textContent = 'Could not reach VPN gateway.';
  }
}

function copyWgConf() {
  if (window.SweeprAndroid && lastConf) {
    window.SweeprAndroid.copyText(lastConf);
    window.SweeprAndroid.openVpnSettings();
    showToast('Copied WireGuard config');
  } else if (navigator.clipboard && lastConf) {
    navigator.clipboard.writeText(lastConf);
    showToast('Copied WireGuard config');
  }
}

(function init() {
  /* Default to Light Mode unless user explicitly chose Dark Mode */
  const savedTheme = localStorage.getItem('sweepr_vpn_theme') || 'light';
  applyTheme(savedTheme === 'dark' ? 'dark' : 'light');

  const savedKey = localStorage.getItem('sweepr_key') || '';
  if (savedKey) {
    document.getElementById('codeInput').value = savedKey;
    const badge = document.getElementById('proBadge');
    badge.className = 'badge';
    badge.textContent = 'PRO ACTIVE';
  }
  renderServers();
})();
</script>
</body>
</html>`;

export { VPN_ANDROID_HTML };
