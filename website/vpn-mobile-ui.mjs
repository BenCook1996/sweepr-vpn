const VPN_ANDROID_HTML = `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<title>SWEEPR VPN</title>
<style>
  :root[data-theme="light"] {
    --bg: #f8fafc;
    --card: #ffffff;
    --card-sub: #f1f5f9;
    --glass: rgba(255, 255, 255, 0.94);
    --text: #0f172a;
    --text-sub: #334155;
    --muted: #64748b;
    --border: #e2e8f0;
    --border-strong: #cbd5e1;
    --accent: #059669;
    --accent-bright: #10b981;
    --accent-soft: #d1fae5;
    --accent-fg: #065f46;
    --accent-border: #10b981;
    --orb-off-bg: linear-gradient(145deg, #ffffff, #f1f5f9);
    --orb-off-border: #cbd5e1;
    --orb-off-text: #0f172a;
    --orb-off-ring: rgba(148, 163, 184, 0.14);
    --orb-on-bg: radial-gradient(circle at 30% 30%, #10b981, #059669);
    --orb-on-border: #34d399;
    --orb-on-text: #ffffff;
    --orb-on-ring: rgba(16, 185, 129, 0.16);
    --shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
    --input-bg: #ffffff;
  }

  :root[data-theme="dark"] {
    --bg: #070b14;
    --card: #0f172a;
    --card-sub: #1e293b;
    --glass: rgba(15, 23, 42, 0.94);
    --text: #f8fafc;
    --text-sub: #cbd5e1;
    --muted: #94a3b8;
    --border: rgba(148, 163, 184, 0.16);
    --border-strong: rgba(148, 163, 184, 0.32);
    --accent: #10b981;
    --accent-bright: #34d399;
    --accent-soft: rgba(16, 185, 129, 0.16);
    --accent-fg: #34d399;
    --accent-border: rgba(52, 211, 153, 0.45);
    --orb-off-bg: linear-gradient(145deg, #1e293b, #0f172a);
    --orb-off-border: #334155;
    --orb-off-text: #f8fafc;
    --orb-off-ring: rgba(148, 163, 184, 0.1);
    --orb-on-bg: radial-gradient(circle at 30% 30%, #34d399, #059669);
    --orb-on-border: #6ee7b7;
    --orb-on-text: #022c22;
    --orb-on-ring: rgba(16, 185, 129, 0.22);
    --shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
    --input-bg: #090d16;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }

  body {
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    padding: 66px 16px 86px;
    display: flex;
    flex-direction: column;
    transition: background 0.2s ease, color 0.2s ease;
    user-select: none;
  }

  /* Top Header */
  .topbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 58px;
    background: var(--glass);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 14px;
    z-index: 100;
  }
  .topbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 11px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 900;
    font-size: 16px;
    letter-spacing: -0.02em;
  }
  .logo {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    font-weight: 900;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .badge {
    font-size: 11px;
    font-weight: 800;
    padding: 5px 10px;
    border-radius: 999px;
    background: var(--accent-soft);
    color: var(--accent-fg);
    border: 1px solid var(--accent-border);
  }

  /* Slide-down Menu Drawer */
  .drawer-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    z-index: 140;
    display: none;
  }
  .drawer-backdrop.open { display: block; }
  .drawer {
    position: fixed;
    top: 58px;
    left: 12px;
    right: 12px;
    background: var(--card);
    border: 1px solid var(--border-strong);
    border-radius: 20px;
    padding: 10px;
    z-index: 150;
    box-shadow: var(--shadow);
    display: none;
    flex-direction: column;
    gap: 4px;
  }
  .drawer.open { display: flex; }
  .drawer-item {
    border: none;
    background: transparent;
    color: var(--text);
    padding: 12px 14px;
    border-radius: 12px;
    font-size: 13.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    text-align: left;
  }
  .drawer-item.active, .drawer-item:hover {
    background: var(--card-sub);
  }

  /* View Container */
  .view {
    display: none;
    flex-direction: column;
    flex: 1;
    max-width: 460px;
    width: 100%;
    margin: 0 auto;
    gap: 14px;
  }
  .view.active {
    display: flex;
  }

  /* ==========================================================================
     CONCEPT 3: TACTILE POWER ORB HOME SCREEN
     ========================================================================== */
  .c3-status-header {
    text-align: center;
    padding-top: 10px;
  }
  .c3-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 900;
    padding: 5px 14px;
    border-radius: 999px;
    background: var(--card-sub);
    color: var(--muted);
    border: 1px solid var(--border-strong);
    letter-spacing: 0.04em;
  }
  .c3-status-pill.connected {
    background: var(--accent-soft);
    color: var(--accent-fg);
    border-color: var(--accent-border);
  }
  .c3-headline {
    font-size: 22px;
    font-weight: 900;
    margin-top: 12px;
    letter-spacing: -0.02em;
  }
  .c3-subline {
    font-size: 13px;
    color: var(--muted);
    font-weight: 600;
    margin-top: 4px;
  }

  /* Lower-Center Thumb-Zone 152px Tactile Power Orb */
  .c3-orb-stage {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 18px 0;
  }
  .c3-power-orb {
    width: 156px;
    height: 156px;
    border-radius: 999px;
    border: 5px solid var(--orb-off-border);
    background: var(--orb-off-bg);
    color: var(--orb-off-text);
    box-shadow: 0 16px 38px rgba(15, 23, 42, 0.12), 0 0 0 14px var(--orb-off-ring);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    cursor: pointer;
    transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), background 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
  }
  .c3-power-orb:active {
    transform: scale(0.94);
  }
  .c3-power-orb.connected {
    background: var(--orb-on-bg);
    border-color: var(--orb-on-border);
    color: var(--orb-on-text);
    box-shadow: 0 18px 44px rgba(16, 185, 129, 0.36), 0 0 0 14px var(--orb-on-ring);
  }
  .c3-orb-label {
    font-size: 11.5px;
    font-weight: 900;
    letter-spacing: 0.06em;
  }

  /* Bottom Thumb-Zone Location Card & Mini Speed/Ping Row */
  .c3-bottom-deck {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: auto;
  }
  .c3-location-card {
    width: 100%;
    background: var(--card);
    border: 1.5px solid var(--border-strong);
    border-radius: 22px;
    padding: 14px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    box-shadow: var(--shadow);
    text-align: left;
    color: var(--text);
  }
  .c3-loc-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .flag-box {
    width: 34px;
    height: 24px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border-strong);
    display: inline-flex;
    flex-shrink: 0;
  }
  .flag-box svg { width: 100%; height: 100%; display: block; }
  .c3-change-pill {
    padding: 7px 12px;
    border-radius: 11px;
    background: var(--card-sub);
    color: var(--accent-fg);
    font-size: 12px;
    font-weight: 800;
  }

  .c3-metrics-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .c3-metric-box {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 11px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    font-weight: 700;
  }

  /* Cards & Lists for Secondary Tabs */
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 22px;
    padding: 18px;
    box-shadow: var(--shadow);
  }
  .srv-btn {
    width: 100%;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 13px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--text);
    cursor: pointer;
    margin-bottom: 8px;
    text-align: left;
  }
  .srv-btn.active {
    border-color: var(--accent-border);
    background: var(--accent-soft);
  }
  .input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 13px;
    border: 1px solid var(--border-strong);
    background: var(--input-bg);
    color: var(--text);
    font-size: 13.5px;
    margin-top: 8px;
  }
  .btn-primary {
    width: 100%;
    padding: 14px;
    border-radius: 14px;
    border: none;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    font-weight: 900;
    font-size: 14px;
    margin-top: 12px;
    cursor: pointer;
  }

  /* Fixed 4-Tab Bottom Navigation Bar */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 68px;
    background: var(--glass);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-top: 1px solid var(--border);
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 6px 10px 10px;
    gap: 6px;
    z-index: 100;
  }
  .nav-tab {
    border: none;
    background: transparent;
    color: var(--muted);
    border-radius: 13px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
  }
  .nav-tab.active {
    color: var(--accent-fg);
    background: var(--accent-soft);
  }

  .toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: var(--text);
    color: var(--bg);
    padding: 10px 18px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
    opacity: 0;
    pointer-events: none;
    transition: all 0.2s ease;
    z-index: 200;
    white-space: nowrap;
  }
  .toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
</style>
</head>
<body>

  <!-- Top Bar -->
  <header class="topbar">
    <div class="topbar-left">
      <button class="icon-btn" onclick="toggleDrawer()" aria-label="Menu">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <div class="brand">
        <div class="logo">S</div>
        <span>SWEEPR <span style="color:var(--accent)">VPN</span></span>
      </div>
    </div>
    <div class="topbar-right">
      <span id="proBadge" class="badge">Ready</span>
      <button class="icon-btn" onclick="toggleTheme()" aria-label="Toggle Light/Dark Mode">
        <svg id="iconSun" style="display:none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        <svg id="iconMoon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
      </button>
    </div>
  </header>

  <!-- Slide-Down Hamburger Drawer -->
  <div id="drawerBackdrop" class="drawer-backdrop" onclick="closeDrawer()"></div>
  <nav id="drawerMenu" class="drawer">
    <button class="drawer-item active" data-drawer="home" onclick="switchTab('home')">
      <span>Power Orb Shield</span>
      <span style="font-size:11px;color:var(--muted)">Home</span>
    </button>
    <button class="drawer-item" data-drawer="servers" onclick="switchTab('servers')">
      <span>Country Locations</span>
      <span style="font-size:11px;color:var(--muted)">8 Gateways</span>
    </button>
    <button class="drawer-item" data-drawer="shields" onclick="switchTab('shields')">
      <span>Kill Switch &amp; Wi-Fi Shields</span>
      <span style="font-size:11px;color:var(--muted)">Active</span>
    </button>
    <button class="drawer-item" data-drawer="account" onclick="switchTab('account')">
      <span>Profile &amp; License Key</span>
      <span style="font-size:11px;color:var(--muted)">3 Devices</span>
    </button>
    <button class="drawer-item" onclick="toggleTheme(); closeDrawer();">
      <span>Switch Appearance</span>
      <span id="drawerThemeText" style="font-size:11px;font-weight:800;color:var(--accent)">Light Mode</span>
    </button>
  </nav>

  <!-- ========================================================================
       TAB 1: CONCEPT 3 — TACTILE POWER ORB HOME
       ======================================================================== -->
  <main id="view-home" class="view active">
    <div class="c3-status-header">
      <div id="statusPill" class="c3-status-pill">TAP ORB TO PROTECT</div>
      <div id="statusHeadline" class="c3-headline">Protection is Paused</div>
      <div id="statusSubline" class="c3-subline mono">Virtual IP: Not Connected</div>
    </div>

    <div class="c3-orb-stage">
      <button id="powerOrb" class="c3-power-orb" onclick="toggleTunnel()" aria-label="Connect or Disconnect VPN">
        <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
        <span id="orbLabel" class="c3-orb-label mono">TAP TO CONNECT</span>
      </button>
    </div>

    <div class="c3-bottom-deck">
      <!-- Selected Country Switcher Card -->
      <button class="c3-location-card" onclick="switchTab('servers')">
        <div class="c3-loc-left">
          <span id="curFlag" class="flag-box"></span>
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em">Selected Location</div>
            <div id="curLoc" style="font-size:14.5px;font-weight:900;margin-top:2px">United Kingdom &middot; London</div>
          </div>
        </div>
        <span class="c3-change-pill">Change</span>
      </button>

      <!-- 2-Column Speed & Ping Bar -->
      <div class="c3-metrics-row">
        <div class="c3-metric-box">
          <span style="color:var(--muted)">Tunnel</span>
          <span id="tunnelMetric" class="mono">10 Gbps WG</span>
        </div>
        <div class="c3-metric-box">
          <span style="color:var(--muted)">Ping</span>
          <span id="pingMetric" class="mono" style="color:var(--accent-fg)">11 ms</span>
        </div>
      </div>
    </div>
  </main>

  <!-- ========================================================================
       TAB 2: COUNTRIES / SERVER PICKER
       ======================================================================== -->
  <section id="view-servers" class="view">
    <div class="card">
      <div style="font-size:17px;font-weight:900;margin-bottom:4px">Select Country</div>
      <p style="font-size:12.5px;color:var(--muted);margin-bottom:14px">10 Gbps RAM-only WireGuard gateways with full IPv4, IPv6 &amp; DNS leak protection.</p>
      <div id="fullSrvList"></div>
    </div>
  </section>

  <!-- ========================================================================
       TAB 3: SHIELDS (KILL SWITCH & WI-FI / SMART-TV GUARD)
       ======================================================================== -->
  <section id="view-shields" class="view">
    <div class="card">
      <div style="font-size:17px;font-weight:900;margin-bottom:6px">Privacy Shields</div>
      <p style="font-size:12.5px;color:var(--muted);margin-bottom:14px">Automatic protection against IP leaks, hotel Wi-Fi snooping, and Smart-TV ACR trackers.</p>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:14px;font-weight:800">Internet Kill Switch</div>
          <div style="font-size:11.5px;color:var(--muted)">Blocks traffic if the VPN tunnel drops</div>
        </div>
        <button id="shieldBtnKillSwitch" class="c3-change-pill" style="border:none;cursor:pointer;font-size:11.5px;font-weight:900" onclick="toggleMobileShield('killSwitch')">ACTIVE</button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-size:14px;font-weight:800">Untrusted Wi-Fi Auto-Shield</div>
          <div style="font-size:11.5px;color:var(--muted)">Secures airport, cafe &amp; hotel Wi-Fi</div>
        </div>
        <button id="shieldBtnAutoWifi" class="c3-change-pill" style="border:none;cursor:pointer;font-size:11.5px;font-weight:900" onclick="toggleMobileShield('autoWifi')">ACTIVE</button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0">
        <div>
          <div style="font-size:14px;font-weight:800">Smart-TV &amp; WebRTC Leak Block</div>
          <div style="font-size:11.5px;color:var(--muted)">Masks real UK/local IP from analytics</div>
        </div>
        <button id="shieldBtnDnsShield" class="c3-change-pill" style="border:none;cursor:pointer;font-size:11.5px;font-weight:900" onclick="toggleMobileShield('dnsShield')">ACTIVE</button>
      </div>
    </div>
  </section>

  <!-- ========================================================================
       TAB 4: PROFILE & LICENSE ACTIVATION
       ======================================================================== -->
  <section id="view-account" class="view">
    <div class="card">
      <div style="font-size:16px;font-weight:900">Activate Pro Device</div>
      <p style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.45">
        Purchased on desktop first? Sign in at <strong>sweeprvpn.com/login</strong> to scan your QR code or paste your <code>ptk_...</code> pairing code or <code>SWEEPR-VPN-...</code> license key below (up to 3 devices).
      </p>
      <input id="codeInput" class="input mono" placeholder="SWEEPR-VPN-XXXX or ptk_..." autocomplete="off" />
      <input id="emailInput" class="input" type="email" placeholder="Account Email (optional)" autocomplete="email" />
      <button class="btn-primary" onclick="activateDevice()">Activate Pro on This Device</button>
      <div id="actMsg" style="font-size:12px;font-weight:700;margin-top:10px"></div>
    </div>

    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:14px;font-weight:800">Appearance Mode</div>
          <div style="font-size:12px;color:var(--muted)">Light mode by default; switch anytime</div>
        </div>
        <button class="c3-change-pill" style="border:none;cursor:pointer" onclick="toggleTheme()" id="profileThemeBtn">Switch Theme</button>
      </div>
    </div>
  </section>

  <!-- Bottom 4-Tab Navigation (Concept 3 Labels) -->
  <nav class="bottom-nav">
    <button class="nav-tab active" id="tab-home" onclick="switchTab('home')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>
      <span>Connect</span>
    </button>
    <button class="nav-tab" id="tab-servers" onclick="switchTab('servers')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/></svg>
      <span>Countries</span>
    </button>
    <button class="nav-tab" id="tab-shields" onclick="switchTab('shields')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <span>Shields</span>
    </button>
    <button class="nav-tab" id="tab-account" onclick="switchTab('account')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
      <span>Profile</span>
    </button>
  </nav>

  <div id="toast" class="toast"></div>

<script>
const API_BASE = 'https://sweeprvpn.com';

const FLAGS = {
  GB: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#012169"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" stroke-width="4"/><path d="M30 0V40M0 20H60" stroke="#fff" stroke-width="12"/><path d="M30 0V40M0 20H60" stroke="#C8102E" stroke-width="7"/></svg>',
  US: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#B22234"/><rect y="6" width="60" height="5" fill="#fff"/><rect y="16" width="60" height="5" fill="#fff"/><rect y="26" width="60" height="5" fill="#fff"/><rect width="26" height="22" fill="#3C3B6E"/></svg>',
  DE: '<svg viewBox="0 0 60 40"><rect width="60" height="13.3" fill="#000"/><rect y="13.3" width="60" height="13.3" fill="#DD0000"/><rect y="26.6" width="60" height="13.4" fill="#FFCE00"/></svg>',
  NL: '<svg viewBox="0 0 60 40"><rect width="60" height="13.3" fill="#AE1C28"/><rect y="13.3" width="60" height="13.3" fill="#fff"/><rect y="26.6" width="60" height="13.4" fill="#21468B"/></svg>',
  SE: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#006AA7"/><rect x="18" width="8" height="40" fill="#FECC02"/><rect y="16" width="60" height="8" fill="#FECC02"/></svg>',
  SG: '<svg viewBox="0 0 60 40"><rect width="60" height="20" fill="#EF3340"/><rect y="20" width="60" height="20" fill="#fff"/></svg>',
  JP: '<svg viewBox="0 0 60 40"><rect width="60" height="40" fill="#fff"/><circle cx="30" cy="20" r="11" fill="#BC002D"/></svg>'
};

const SERVERS = [
  { code: 'UK-LON-01', flag: 'GB', country: 'United Kingdom', city: 'London', ping: '11 ms', ip: '185.212.164.42' },
  { code: 'US-NYC-01', flag: 'US', country: 'United States', city: 'New York', ping: '64 ms', ip: '104.28.194.112' },
  { code: 'US-LAX-01', flag: 'US', country: 'United States', city: 'Los Angeles', ping: '108 ms', ip: '104.28.210.84' },
  { code: 'DE-FRA-01', flag: 'DE', country: 'Germany', city: 'Frankfurt', ping: '16 ms', ip: '193.32.126.19' },
  { code: 'NL-AMS-01', flag: 'NL', country: 'Netherlands', city: 'Amsterdam', ping: '14 ms', ip: '185.107.56.91' },
  { code: 'SE-STO-01', flag: 'SE', country: 'Sweden', city: 'Stockholm', ping: '22 ms', ip: '194.187.249.33' },
  { code: 'SG-SIN-01', flag: 'SG', country: 'Singapore', city: 'Central', ping: '145 ms', ip: '103.253.41.18' },
  { code: 'JP-TYO-01', flag: 'JP', country: 'Japan', city: 'Tokyo', ping: '158 ms', ip: '138.199.21.74' }
];

let selectedCode = localStorage.getItem('sweepr_srv') || 'UK-LON-01';
let connected = false;
const mobileShields = {
  killSwitch: localStorage.getItem('sweepr_mob_killswitch') !== '0',
  autoWifi: localStorage.getItem('sweepr_mob_autowifi') !== '0',
  dnsShield: localStorage.getItem('sweepr_mob_dnsshield') !== '0'
};

function renderMobileShields() {
  const map = [
    ['shieldBtnKillSwitch', mobileShields.killSwitch],
    ['shieldBtnAutoWifi', mobileShields.autoWifi],
    ['shieldBtnDnsShield', mobileShields.dnsShield]
  ];
  map.forEach(([id, on]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = on ? 'ACTIVE' : 'OFF';
    el.style.color = on ? 'var(--accent-fg)' : 'var(--muted)';
    el.style.opacity = on ? '1' : '0.65';
  });
}

function toggleMobileShield(key) {
  mobileShields[key] = !mobileShields[key];
  const storageKey = key === 'killSwitch' ? 'sweepr_mob_killswitch' : key === 'autoWifi' ? 'sweepr_mob_autowifi' : 'sweepr_mob_dnsshield';
  localStorage.setItem(storageKey, mobileShields[key] ? '1' : '0');
  renderMobileShields();
  showToast((mobileShields[key] ? 'Enabled ' : 'Paused ') + (key === 'killSwitch' ? 'Kill Switch' : key === 'autoWifi' ? 'Wi-Fi Auto-Shield' : 'Smart-TV DNS Shield'));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2500);
}

function applyTheme(theme) {
  const isDark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('iconSun').style.display = isDark ? 'block' : 'none';
  document.getElementById('iconMoon').style.display = isDark ? 'none' : 'block';
  document.getElementById('drawerThemeText').textContent = isDark ? 'Dark Mode' : 'Light Mode';
  localStorage.setItem('sweepr_vpn_theme', isDark ? 'dark' : 'light');
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

function toggleDrawer() {
  document.getElementById('drawerMenu').classList.toggle('open');
  document.getElementById('drawerBackdrop').classList.toggle('open');
}

function closeDrawer() {
  document.getElementById('drawerMenu').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
}

function switchTab(tab) {
  closeDrawer();
  ['home', 'servers', 'shields', 'account'].forEach(v => {
    document.getElementById('view-' + v).classList.toggle('active', v === tab);
    document.getElementById('tab-' + v).classList.toggle('active', v === tab);
    const d = document.querySelector('[data-drawer="' + v + '"]');
    if (d) d.classList.toggle('active', v === tab);
  });
}

function getDeviceId() {
  let id = localStorage.getItem('sweepr_and_id');
  if (!id) {
    id = 'mob_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem('sweepr_and_id', id);
  }
  return id;
}

function renderServers() {
  const cur = SERVERS.find(s => s.code === selectedCode) || SERVERS[0];
  document.getElementById('curFlag').innerHTML = FLAGS[cur.flag] || FLAGS.GB;
  document.getElementById('curLoc').textContent = cur.country + ' \\u00b7 ' + cur.city;
  document.getElementById('pingMetric').textContent = cur.ping;

  const list = document.getElementById('fullSrvList');
  list.innerHTML = SERVERS.map(s => \`
    <button class="srv-btn \${s.code === selectedCode ? 'active' : ''}" onclick="pickServer('\${s.code}')">
      <div style="display:flex;align-items:center;gap:12px">
        <span class="flag-box">\${FLAGS[s.flag] || ''}</span>
        <div>
          <div style="font-size:14px;font-weight:800">\${s.country} &middot; \${s.city}</div>
          <div class="mono" style="font-size:11px;color:var(--muted)">\${s.code} &bull; 10 Gbps WireGuard</div>
        </div>
      </div>
      <span class="mono" style="font-size:12px;font-weight:800;color:var(--accent-fg)">\${s.ping}</span>
    </button>
  \`).join('');
}

function pickServer(code) {
  selectedCode = code;
  localStorage.setItem('sweepr_srv', code);
  renderServers();
  switchTab('home');
  const s = SERVERS.find(x => x.code === code) || SERVERS[0];
  showToast('Selected ' + s.country + ' (' + s.city + ')');
  if (connected) {
    connected = false;
    toggleTunnel();
  }
}

async function activateDevice() {
  const raw = (document.getElementById('codeInput').value || '').trim();
  const email = (document.getElementById('emailInput').value || '').trim();
  const msg = document.getElementById('actMsg');
  if (!raw) {
    msg.style.color = '#ef4444';
    msg.textContent = 'Enter your license key or ptk_ pairing code.';
    return;
  }
  msg.style.color = 'var(--muted)';
  msg.textContent = 'Verifying subscription...';
  try {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    const devOs = isIos ? 'ios' : 'android';
    const devName = isIos ? 'iPhone / iPad' : 'Android Device';
    const ptk = raw.match(/ptk_[A-Za-z0-9_-]{12,64}/);
    const url = ptk ? (API_BASE + '/api/vpn/pair/redeem') : (API_BASE + '/api/vpn/activate');
    const body = ptk
      ? { token: ptk[0], device_id: getDeviceId(), device_name: devName, os: devOs }
      : { code: raw, key: raw, email, device_id: getDeviceId(), device_name: devName, os: devOs };
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json();
    if (r.ok && (d.ok || d.valid)) {
      const k = d.licenseKey || d.license_key || raw;
      localStorage.setItem('sweepr_key', k);
      if (d.email || email) localStorage.setItem('sweepr_email', d.email || email);
      document.getElementById('codeInput').value = k;
      document.getElementById('proBadge').textContent = 'PRO ACTIVE';
      msg.style.color = 'var(--accent)';
      msg.textContent = 'Activated! Tap the Connect Orb on the home screen.';
      showToast('SWEEPR VPN Pro Activated');
      setTimeout(() => switchTab('home'), 700);
    } else {
      msg.style.color = '#ef4444';
      msg.textContent = d.message || d.error || 'Invalid activation code.';
    }
  } catch (e) {
    msg.style.color = '#ef4444';
    msg.textContent = 'Network error connecting to sweeprvpn.com.';
  }
}

async function toggleTunnel() {
  const orb = document.getElementById('powerOrb');
  const lbl = document.getElementById('orbLabel');
  const pill = document.getElementById('statusPill');
  const head = document.getElementById('statusHeadline');
  const sub = document.getElementById('statusSubline');
  const cur = SERVERS.find(s => s.code === selectedCode) || SERVERS[0];

  if (connected) {
    connected = false;
    orb.classList.remove('connected');
    pill.classList.remove('connected');
    pill.textContent = 'TAP ORB TO PROTECT';
    head.textContent = 'Protection is Paused';
    sub.textContent = 'Virtual IP: Not Connected';
    lbl.textContent = 'TAP TO CONNECT';
    showToast('Protection paused');
    return;
  }

  const key = localStorage.getItem('sweepr_key') || (document.getElementById('codeInput').value || '').trim();
  const email = localStorage.getItem('sweepr_email') || (document.getElementById('emailInput').value || '').trim();
  if (!key) {
    showToast('Activate your Pro key or QR code first');
    switchTab('account');
    return;
  }

  lbl.textContent = 'SYNCING...';
  pill.textContent = 'PROVISIONING...';
  head.textContent = 'Preparing Native WireGuard Profile...';
  sub.textContent = 'Target gateway: ' + cur.city + ' (' + cur.country + ')';

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
  const dnsFlag = mobileShields.dnsShield ? '1' : '0';
  if (isIos) {
    lbl.textContent = 'INSTALL PROFILE';
    pill.textContent = 'PROFILE DOWNLOADING';
    head.textContent = 'Install iOS VPN Profile in Settings';
    sub.textContent = 'Approve profile in iOS Settings -> General -> VPN & Device Management';
    showToast('Downloading iOS WireGuard profile...');
    window.location.href = '/api/vpn/apple-mobileconfig?key=' + encodeURIComponent(key) + '&email=' + encodeURIComponent(email) + '&server_code=' + encodeURIComponent(selectedCode) + '&device_id=' + encodeURIComponent(getDeviceId()) + '&dns_shield=' + dnsFlag;
    return;
  }

  lbl.textContent = 'OPEN ANDROID APP';
  pill.textContent = 'READY FOR ANDROID VPN';
  head.textContent = 'Opening SWEEPR Android App...';
  sub.textContent = 'Gateway: ' + cur.city + ' (' + cur.country + ')';
  showToast('Launching SWEEPR VPN Android app...');
  window.location.href = 'sweeprvpn://activate?key=' + encodeURIComponent(key) + '&email=' + encodeURIComponent(email);
}

async function checkMobileWebUpdate() {
  try {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent || '');
    const plat = isIos ? 'ios' : 'android';
    const r = await fetch('/api/vpn/version?platform=' + plat + '&current_version=2.4.0');
    const d = await r.json().catch(() => ({}));
    if (r.ok && d && (d.force_update || d.update_available)) {
      const targetUrl = isIos ? '/ios-app?update=' + encodeURIComponent(d.latest_version || 'latest') : (d.play_store_url || 'https://play.google.com/store/apps/details?id=com.sweepr.vpn');
      if (d.force_update) {
        const modal = document.createElement('div');
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(11,17,32,0.92);display:flex;align-items:center;justify-content:center;padding:20px';
        modal.innerHTML = '<div class="card" style="max-width:360px;width:100%;text-align:center"><div style="font-size:18px;font-weight:900;margin-bottom:8px">Mandatory Update Required</div><p style="font-size:13px;color:var(--muted);margin-bottom:16px">' + (d.notes || 'Please update SWEEPR VPN to the latest version.') + '</p><a href="' + targetUrl + '" class="btn-primary" style="display:block;text-decoration:none;text-align:center">Update Now</a></div>';
        document.body.appendChild(modal);
      } else {
        showToast('SWEEPR VPN v' + (d.latest_version || '') + ' update available');
      }
    }
  } catch (e) {}
}

(function init() {
  const savedTheme = localStorage.getItem('sweepr_vpn_theme') || 'light';
  applyTheme(savedTheme);
  const savedKey = localStorage.getItem('sweepr_key') || '';
  if (savedKey) {
    document.getElementById('codeInput').value = savedKey;
    document.getElementById('proBadge').textContent = 'PRO ACTIVE';
  }
  renderMobileShields();
  renderServers();
  checkMobileWebUpdate();
})();
</script>
</body>
</html>`;

export { VPN_ANDROID_HTML };
