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
    --bg: #f7f7f5;
    --card: #ffffff;
    --card-sub: #f3f2ed;
    --glass: rgba(255, 255, 255, 0.96);
    --text: #161a22;
    --text-sub: #374151;
    --muted: #5e6776;
    --border: #dfddd4;
    --border-strong: #cbc8bc;
    --accent: #059669;
    --accent-bright: #10b981;
    --accent-soft: #d1fae5;
    --accent-fg: #065f46;
    --accent-border: #10b981;
    --orb-off-bg: #ffffff;
    --orb-off-border: #cbc8bc;
    --orb-off-text: #161a22;
    --orb-off-ring: rgba(94, 103, 118, 0.12);
    --orb-on-bg: #059669;
    --orb-on-border: #047857;
    --orb-on-text: #ffffff;
    --orb-on-ring: rgba(5, 150, 105, 0.18);
    --shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
    --input-bg: #ffffff;
  }

  :root[data-theme="dark"] {
    --bg: #111315;
    --card: #181b1f;
    --card-sub: #20242a;
    --glass: rgba(24, 27, 31, 0.96);
    --text: #f3f4f6;
    --text-sub: #d1d5db;
    --muted: #8c95a3;
    --border: #2b3038;
    --border-strong: #3a414c;
    --accent: #10b981;
    --accent-bright: #34d399;
    --accent-soft: rgba(16, 185, 129, 0.14);
    --accent-fg: #34d399;
    --accent-border: rgba(52, 211, 153, 0.45);
    --orb-off-bg: #181b1f;
    --orb-off-border: #3a414c;
    --orb-off-text: #f3f4f6;
    --orb-off-ring: rgba(140, 149, 163, 0.1);
    --orb-on-bg: #059669;
    --orb-on-border: #34d399;
    --orb-on-text: #ffffff;
    --orb-on-ring: rgba(16, 185, 129, 0.22);
    --shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    --input-bg: #111315;
  }
  html.no-transitions, html.no-transitions * { transition: none !important; }

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
    width: 44px;
    height: 44px;
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
    font-weight:700;
    font-size: 16px;
    letter-spacing: -0.02em;
  }
  .logo {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: linear-gradient(135deg, #10b981, #059669);
    color: #fff;
    font-weight:700;
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
    font-weight:700;
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
    font-weight:700;
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
    font-weight:700;
    letter-spacing: 0.06em;
  }

  /* Bottom Thumb-Zone Location Card & Mini Speed/Ping Row */
  .c3-bottom-deck {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: auto;
  }
  /* @Memorisely Rule #1 (2A): Concentric Location Card (20px outer - 10px pad = 10px inner) */
  .c3-location-card {
    width: 100%;
    background: var(--card);
    border: 1.5px solid var(--border-strong);
    border-radius: 20px;
    padding: 10px 12px;
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
    padding-left: 2px;
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
    border-radius: 10px;
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
    border-radius: 20px;
    padding: 16px;
    box-shadow: var(--shadow);
  }
  .btn-secondary {
    width: 100%;
    padding: 11px 12px;
    border-radius: 12px;
    border: 1.5px solid var(--border-strong);
    background: transparent;
    color: var(--text);
    font-weight: 800;
    font-size: 12.5px;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .btn-secondary:active, .btn-primary:active { transform: scale(0.98); }
  .mob-anchor-ico {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: var(--card-sub);
    border: 1px solid var(--border);
    font-size: 15px;
    flex-shrink: 0;
  }
  .mob-field-lbl {
    display: block;
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    margin-top: 12px;
    margin-bottom: 4px;
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
    font-weight:700;
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
      <div class="brand">
        <div class="logo">S</div>
        <span>SWEEPR <span style="color:var(--accent)">VPN</span></span>
      </div>
    </div>
    <div class="topbar-right">
      <span id="proBadge" class="badge">● WireGuard Ready</span>
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
    <div class="mono" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 11px;margin-bottom:12px;border:1px solid var(--border);background:var(--card-sub);border-radius:10px;font-size:10.5px;color:var(--muted)">
      <span style="display:inline-flex;align-items:center;gap:6px;color:var(--text-sub);font-weight:700"><span style="width:7px;height:7px;border-radius:999px;background:#059669;display:inline-block"></span>TUNNEL // WIREGUARD ZERO-LOG</span>
      <span id="mobDnsBadge">DNS FILTER READY</span>
    </div>
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
      <!-- Option 1: Inline Thumb-Zone Quick Country Pill Strip (1-Tap Switch & Connect) -->
      <div id="quickCountryStrip" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
        <button class="srv-btn" style="margin:0;padding:8px 6px;justify-content:center;font-size:11.5px;font-weight:800;border-radius:12px" onclick="pickServer('UK-LON-01')">GB &middot; UK</button>
        <button class="srv-btn" style="margin:0;padding:8px 6px;justify-content:center;font-size:11.5px;font-weight:800;border-radius:12px" onclick="pickServer('US-NYC-01')">US &middot; NYC</button>
        <button class="srv-btn" style="margin:0;padding:8px 6px;justify-content:center;font-size:11.5px;font-weight:800;border-radius:12px" onclick="pickServer('SE-STO-01')">SE &middot; STO</button>
        <button class="srv-btn" style="margin:0;padding:8px 6px;justify-content:center;font-size:11.5px;font-weight:800;border-radius:12px;color:var(--accent-fg)" onclick="switchTab('servers')">All 8 ›</button>
      </div>
      <!-- Selected Country Switcher Card -->
      <button class="c3-location-card" onclick="switchTab('servers')">
        <div class="c3-loc-left">
          <span id="curFlag" class="flag-box"></span>
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em">Selected Location</div>
            <div id="curLoc" style="font-size:14.5px;font-weight:700;margin-top:2px">United Kingdom &middot; London</div>
          </div>
        </div>
        <span class="c3-change-pill">Change</span>
      </button>

      <!-- 2-Column Transport & Status Bar -->
      <div class="c3-metrics-row">
        <div class="c3-metric-box" style="cursor:pointer" onclick="toggleStealthMode()" title="Tap to switch between standard WireGuard UDP-51820 and Stealth UDP-443">
          <span style="color:var(--muted)">Port Mode</span>
          <span id="tunnelMetric" class="mono" style="color:var(--accent-fg)">UDP 51820</span>
        </div>
        <div class="c3-metric-box">
          <span style="color:var(--muted)">Gateway</span>
          <span id="pingMetric" class="mono" style="color:var(--accent-fg)">Online</span>
        </div>
      </div>
    </div>
  </main>

  <!-- ========================================================================
       TAB 2: COUNTRIES / SERVER PICKER
       ======================================================================== -->
  <section id="view-servers" class="view">
    <div class="card">
      <div style="font-size:17px;font-weight:700;margin-bottom:4px">Select Country</div>
      <p style="font-size:12.5px;color:var(--muted);margin-bottom:14px">Zero-log RAM-only WireGuard gateways with encrypted DNS and IPv6 leak protection.</p>
      <div id="fullSrvList"></div>
    </div>
  </section>

  <!-- ========================================================================
       TAB 3: TUNNEL DNS SHIELD & LIVE NETWORK CHECK
       ======================================================================== -->
  <section id="view-shields" class="view">
    <div class="card">
      <div style="font-size:16px;font-weight:700;margin-bottom:4px">Tunnel Protocol &amp; DNS Filter</div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:8px">Applied when generating your WireGuard / Apple VPN configuration profile.</p>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--border);gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="mob-anchor-ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg></div>
          <div>
            <div style="font-size:14px;font-weight:800">Tracker &amp; Malware DNS Filter</div>
            <div style="font-size:11.5px;color:var(--muted)">Routes tunnel DNS via 10.64.0.1 + 1.1.1.2 malware-blocking resolver</div>
          </div>
        </div>
        <button id="shieldBtnDnsShield" class="c3-change-pill" style="border:none;cursor:pointer;font-size:11.5px;font-weight:700" onclick="toggleMobileShield('dnsShield')">ACTIVE</button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;gap:10px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="mob-anchor-ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
          <div>
            <div style="font-size:14px;font-weight:800">Stealth WireGuard Port (UDP 443)</div>
            <div style="font-size:11.5px;color:var(--muted)">Uses UDP port 443 to traverse strict campus &amp; hotel Wi-Fi firewalls</div>
          </div>
        </div>
        <button id="shieldBtnStealth443" class="c3-change-pill" style="border:none;cursor:pointer;font-size:11.5px;font-weight:700" onclick="toggleStealthMode()">OFF</button>
      </div>
    </div>

    <div class="card">
      <div style="font-size:16px;font-weight:700;margin-bottom:4px">Public Exit IP &amp; Connection Check</div>
      <p style="font-size:12px;color:var(--muted);line-height:1.4">Checks your current public exit IP, country, and whether your connection exits through a SWEEPR WireGuard server.</p>
      <button class="btn-primary" style="margin-top:10px;padding:11px" onclick="runInAppLeakCheck()">Check Public IP &amp; VPN Status</button>
      <div id="inAppDiagOut" class="mono" style="font-size:11.5px;margin-top:10px;color:var(--text-sub);line-height:1.5"></div>
      <div id="momentOfProofPaywall" style="display:none;margin-top:10px;padding:12px;border-radius:14px;background:var(--accent-soft);border:1px solid var(--accent-border)">
        <div style="font-size:11.5px;font-weight:700;color:var(--accent-fg);margin-bottom:4px">Your Real Public IP Is Visible</div>
        <p id="momentOfProofText" style="font-size:11.5px;color:var(--text-sub);line-height:1.4;margin-bottom:8px">Connect via SWEEPR VPN to encrypt your traffic and mask your IP address.</p>
        <a href="/order?plan=annual&amp;utm_source=inapp_scanner&amp;utm_medium=plg_moment_of_proof&amp;utm_content=exit_check" class="btn-primary" style="display:block;text-align:center;text-decoration:none;padding:9px;font-size:12px">Get SWEEPR VPN Pro</a>
      </div>
    </div>

    <div class="card">
      <div style="font-size:15px;font-weight:700;margin-bottom:4px">Home Wi-Fi Device Scanner</div>
      <p style="font-size:12px;color:var(--muted);line-height:1.45">Mobile web browsers cannot scan LAN ARP tables directly. Use the <strong>SWEEPR VPN Desktop app</strong> (Windows/macOS) on your home Wi-Fi to discover local devices and inspect open RTSP/ONVIF camera ports.</p>
    </div>
  </section>

  <!-- ========================================================================
       TAB 4: PROFILE & LICENSE ACTIVATION
       ======================================================================== -->
  <section id="view-account" class="view">
    <div class="card">
      <div style="font-size:16px;font-weight:700">Activate Pro Device</div>
      <p style="font-size:12px;color:var(--muted);margin-top:4px;line-height:1.45">
        Purchased on desktop first? Sign in at <strong>sweeprvpn.com/login</strong> to scan your QR code or paste your pairing link or <code>SWEEPR-VPN-...</code> license key below (up to 3 devices).
      </p>
      <label class="mob-field-lbl" for="codeInput">ACTIVE LICENSE OR PAIRING KEY</label>
      <input id="codeInput" class="input mono" style="margin-top:0" placeholder="e.g. SWEEPR-VPN-XXXX or pairing link" autocomplete="off" />
      <label class="mob-field-lbl" for="emailInput">ACCOUNT EMAIL (OPTIONAL)</label>
      <input id="emailInput" class="input" style="margin-top:0" type="email" placeholder="e.g. you@example.com" autocomplete="email" />
      <button class="btn-primary" onclick="activateDevice()">Activate Pro on This Device</button>
      <div id="actMsg" style="font-size:12px;font-weight:700;margin-top:10px"></div>
    </div>

    <details class="card" style="padding:14px 16px">
      <summary style="cursor:pointer;font-size:14px;font-weight:800;display:flex;justify-content:space-between;align-items:center;list-style:none">
        <span>Standard WireGuard .conf Export (Routers &amp; TVs)</span>
        <span class="mono" style="font-size:11px;color:var(--accent-fg)">Export ▾</span>
      </summary>
      <div style="margin-top:10px">
        <p style="font-size:12px;color:var(--muted);line-height:1.4">Generate a standard WireGuard <code>.conf</code> file (MTU 1380 + tunnel DNS) compatible with GL.iNet, OpenWrt, Synology NAS, Steam Deck, or smart streaming devices:</p>
        <button class="btn-primary" style="margin-top:10px;padding:11px" onclick="exportRouterWgConf()">Download WireGuard .conf</button>
      </div>
    </details>

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

let SERVERS = [
  { code: 'UK-LON-01', flag: 'GB', country: 'United Kingdom', city: 'London', online: true },
  { code: 'US-NYC-01', flag: 'US', country: 'United States', city: 'New York', online: true },
  { code: 'US-LAX-01', flag: 'US', country: 'United States', city: 'Los Angeles', online: true },
  { code: 'DE-FRA-01', flag: 'DE', country: 'Germany', city: 'Frankfurt', online: true },
  { code: 'NL-AMS-01', flag: 'NL', country: 'Netherlands', city: 'Amsterdam', online: true },
  { code: 'SE-STO-01', flag: 'SE', country: 'Sweden', city: 'Stockholm', online: true },
  { code: 'SG-SIN-01', flag: 'SG', country: 'Singapore', city: 'Singapore', online: true },
  { code: 'JP-TYO-01', flag: 'JP', country: 'Japan', city: 'Tokyo', online: true }
];

let selectedCode = localStorage.getItem('sweepr_srv') || 'UK-LON-01';
let connected = false;
const mobileShields = {
  dnsShield: localStorage.getItem('sweepr_mob_dnsshield') !== '0'
};

function renderMobileShields() {
  const dnsBtn = document.getElementById('shieldBtnDnsShield');
  if (dnsBtn) {
    dnsBtn.textContent = mobileShields.dnsShield ? 'ACTIVE' : 'OFF';
    dnsBtn.style.color = mobileShields.dnsShield ? 'var(--accent-fg)' : 'var(--muted)';
    dnsBtn.style.opacity = mobileShields.dnsShield ? '1' : '0.65';
  }
  const badge = document.getElementById('mobDnsBadge');
  if (badge) badge.textContent = mobileShields.dnsShield ? 'DNS FILTER ON (10.64.0.1)' : 'STANDARD DNS (10.64.0.1)';
  const stealthBtn = document.getElementById('shieldBtnStealth443');
  if (stealthBtn) {
    stealthBtn.textContent = stealthMode ? 'ACTIVE' : 'OFF';
    stealthBtn.style.color = stealthMode ? 'var(--accent-fg)' : 'var(--muted)';
  }
  const metric = document.getElementById('tunnelMetric');
  if (metric) metric.textContent = stealthMode ? 'Stealth 443' : 'UDP 51820';
}

function toggleMobileShield(key) {
  if (key !== 'dnsShield') return;
  mobileShields.dnsShield = !mobileShields.dnsShield;
  localStorage.setItem('sweepr_mob_dnsshield', mobileShields.dnsShield ? '1' : '0');
  renderMobileShields();
  showToast(mobileShields.dnsShield ? 'Enabled Tracker & Malware DNS Filter (10.64.0.1 + 1.1.1.2)' : 'Switched to standard zero-log DNS (10.64.0.1 + 1.1.1.1)');
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
  document.documentElement.classList.add('no-transitions');
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.getElementById('iconSun').style.display = isDark ? 'block' : 'none';
  document.getElementById('iconMoon').style.display = isDark ? 'none' : 'block';
  document.getElementById('drawerThemeText').textContent = isDark ? 'Dark Mode' : 'Light Mode';
  void document.documentElement.offsetHeight;
  requestAnimationFrame(() => document.documentElement.classList.remove('no-transitions'));
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
    const arr = new Uint8Array(6);
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(arr);
    }
    const rand = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    id = 'mob_' + rand + Date.now().toString(36);
    localStorage.setItem('sweepr_and_id', id);
  }
  return id;
}

function renderServers() {
  const cur = SERVERS.find(s => s.code === selectedCode) || SERVERS[0];
  document.getElementById('curFlag').innerHTML = FLAGS[cur.flag] || FLAGS.GB;
  document.getElementById('curLoc').textContent = cur.country + ' \\u00b7 ' + cur.city;
  document.getElementById('pingMetric').textContent = cur.online === false ? 'Offline' : 'Online';

  const list = document.getElementById('fullSrvList');
  list.innerHTML = SERVERS.map(s => \`
    <button class="srv-btn \${s.code === selectedCode ? 'active' : ''}" \${s.online === false ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''} onclick="pickServer('\${s.code}')">
      <div style="display:flex;align-items:center;gap:12px">
        <span class="flag-box">\${FLAGS[s.flag] || ''}</span>
        <div>
          <div style="font-size:14px;font-weight:800">\${escHtml(s.country)} &middot; \${escHtml(s.city)}</div>
          <div class="mono" style="font-size:11px;color:var(--muted)">\${escHtml(s.code)} &bull; WireGuard Zero-Log</div>
        </div>
      </div>
      <span class="mono" style="font-size:12px;font-weight:800;color:\${s.online === false ? 'var(--muted)' : 'var(--accent-fg)'}">\${s.online === false ? 'Offline' : 'Online'}</span>
    </button>
  \`).join('');
}

async function fetchLiveMobileServers() {
  try {
    const r = await fetch('/api/vpn/servers', { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d && Array.isArray(d.servers) && d.servers.length) {
      d.servers.forEach(live => {
        const match = SERVERS.find(s => s.code === live.code);
        if (match) {
          match.online = live.online !== false;
          if (live.country) match.country = live.country;
          if (live.city) match.city = live.city;
        }
      });
      renderServers();
    }
  } catch (e) {}
}

function pickServer(code) {
  const s = SERVERS.find(x => x.code === code) || SERVERS[0];
  if (s.online === false) {
    showToast(s.city + ' gateway is currently offline');
    return;
  }
  selectedCode = code;
  localStorage.setItem('sweepr_srv', code);
  renderServers();
  switchTab('home');
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
    msg.textContent = 'Enter your license key or pairing code.';
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
    head.textContent = 'Install iOS VPN Profile & WireGuard App';
    sub.textContent = 'Requires the free WireGuard App Store app + Settings -> General -> VPN & Device Management';
    showToast('Downloading Apple WireGuard configuration profile...');
    fetch('/api/vpn/apple-mobileconfig-ticket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, email, server_code: selectedCode, device_id: getDeviceId(), dns_shield: dnsFlag, stealth_443: stealthMode }) }).then(r => r.json()).then(td => { if (td && td.url) window.location.href = td.url; else showToast('Could not verify license for iOS profile'); }).catch(() => showToast('Network error'));
    return;
  }

  lbl.textContent = 'OPEN ANDROID APP';
  pill.textContent = 'READY FOR ANDROID VPN';
  head.textContent = 'Opening SWEEPR Android App...';
  sub.textContent = 'Gateway: ' + cur.city + ' (' + cur.country + ')';
  showToast('Launching SWEEPR VPN Android app...');
  window.location.href = 'sweeprvpn://activate?key=' + encodeURIComponent(key) + '&email=' + encodeURIComponent(email);
}


let stealthMode = localStorage.getItem('sweepr_stealth_443') === '1';
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function toggleStealthMode() {
  stealthMode = !stealthMode;
  localStorage.setItem('sweepr_stealth_443', stealthMode ? '1' : '0');
  renderMobileShields();
  showToast(stealthMode ? 'Stealth UDP-443 Enabled (Firewall bypass)' : 'Standard WireGuard UDP-51820 Active');
}
async function runInAppLeakCheck() {
  const out = document.getElementById('inAppDiagOut');
  const mop = document.getElementById('momentOfProofPaywall');
  const mopText = document.getElementById('momentOfProofText');
  if (!out) return;
  out.textContent = 'Checking your current public exit IP & routing...';
  try {
    const t0 = performance.now();
    const r = await fetch('/api/tools/network-check', { cache: 'no-store' });
    const d = await r.json();
    const rtt = Math.max(1, Math.round(performance.now() - t0));
    if (!r.ok || !d || !d.ok) throw new Error('check_failed');
    out.innerHTML = '• Exit IP: <strong>' + escHtml(d.ip || 'Unknown') + '</strong> (' + escHtml(d.country || 'Unknown') + ')<br>• Network / ISP: ' + escHtml(d.isp || 'Detected') + '<br>• Tunnel Exit Match: <strong style="color:' + (d.encrypted ? 'var(--accent-fg)' : '#ef4444') + '">' + (d.encrypted ? 'PROTECTED ON SWEEPR VPN' : 'NOT ROUTING THROUGH SWEEPR NODE') + '</strong><br>• API Round-Trip: ' + rtt + ' ms';
    if (!d.encrypted && mop) {
      mop.style.display = 'block';
      if (mopText) {
        mopText.textContent = 'Traffic from this browser is currently exiting via ' + (d.isp || 'your ISP') + ' (' + (d.country || '') + '). Activate SWEEPR VPN to encrypt your connection.';
      }
    } else if (mop) {
      mop.style.display = 'none';
    }
  } catch (e) {
    out.textContent = '• Could not reach network check server — please verify your internet connection.';
  }
}
async function exportRouterWgConf() {
  const cur = SERVERS.find(s => s.code === selectedCode) || SERVERS[0];
  const key = localStorage.getItem('sweepr_key') || (document.getElementById('codeInput')?.value || '').trim();
  const email = localStorage.getItem('sweepr_email') || (document.getElementById('emailInput')?.value || '').trim();
  if (!key) {
    showToast('Activate your Pro key first to export a WireGuard config');
    switchTab('account');
    return;
  }
  try {
    const r = await fetch('/api/vpn/wireguard-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: key,
        email,
        server_code: cur.code,
        dns_shield: mobileShields.dnsShield,
        stealth_443: stealthMode,
        device_id: getDeviceId() + '_router'
      })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok || !d.config_text) {
      showToast(d.message || 'Could not generate WireGuard config');
      return;
    }
    const conf = d.config_text;
    const blob = new Blob([conf], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = d.filename || ('sweepr-' + cur.code.toLowerCase() + '.conf');
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Downloaded ' + a.download);
  } catch (e) {
    showToast('Network error generating WireGuard config');
  }
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
  fetchLiveMobileServers();
})();
</script>
</body>
</html>`;

export { VPN_ANDROID_HTML };
