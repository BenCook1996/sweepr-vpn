/**
 * HTML card & lower-third templates for SWEEPR VPN 1080p YouTube proof videos
 * and 1280x720 thumbnails. Matches SWEEPR VPN's emerald/slate design system.
 */

export function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderIntroHtml({ badge, title, subtitle, url, stats = [] }) {
  const statsHtml = stats
    .map(
      (s) => `
      <div class="stat-pill">
        <span class="stat-k">${escapeHtml(s.label)}</span>
        <span class="stat-v">${escapeHtml(s.value)}</span>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px;
    height: 1080px;
    background: #041A13;
    color: #F8FAFC;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 84px 104px;
    position: relative;
    overflow: hidden;
  }
  .grid-bg {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(16, 185, 129, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(16, 185, 129, 0.06) 1px, transparent 1px);
    background-size: 64px 64px;
    pointer-events: none;
  }
  .top-bar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(52, 211, 153, 0.22);
    padding-bottom: 28px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 18px;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .logo-box {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: #10B981;
    color: #041A13;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 32px;
  }
  .brand span { color: #34D399; }
  .badge {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #34D399;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(52, 211, 153, 0.35);
    padding: 12px 22px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 12px;
  }
  .dot {
    width: 11px;
    height: 11px;
    border-radius: 999px;
    background: #10B981;
    box-shadow: 0 0 12px #10B981;
  }
  .center {
    position: relative;
    max-width: 1460px;
  }
  .kicker {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 22px;
    font-weight: 700;
    color: #10B981;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    margin-bottom: 24px;
  }
  h1 {
    font-size: 76px;
    line-height: 1.08;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: #F8FAFC;
    margin-bottom: 28px;
  }
  .subtitle {
    font-size: 32px;
    line-height: 1.42;
    color: #CBD5E1;
    max-width: 1260px;
    font-weight: 400;
  }
  .bottom-bar {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding-top: 28px;
    border-top: 1px solid rgba(52, 211, 153, 0.22);
  }
  .stats {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
  }
  .stat-pill {
    background: #07241B;
    border: 1px solid rgba(52, 211, 153, 0.28);
    border-radius: 14px;
    padding: 14px 22px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .stat-k {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 15px;
    color: #94A3B8;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .stat-v {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 22px;
    font-weight: 700;
    color: #34D399;
  }
  .url-box {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 23px;
    color: #F8FAFC;
    background: #0B1215;
    border: 1px solid rgba(52, 211, 153, 0.38);
    padding: 16px 26px;
    border-radius: 14px;
  }
</style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="top-bar">
    <div class="brand">
      <div class="logo-box">S</div>
      <div>SWEEPR <span>VPN</span> // LAB WALKTHROUGH</div>
    </div>
    <div class="badge"><span class="dot"></span>${escapeHtml(badge)}</div>
  </div>
  <div class="center">
    <div class="kicker">VERIFIED TECHNICAL PROOF // 2026</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="subtitle">${escapeHtml(subtitle)}</p>
  </div>
  <div class="bottom-bar">
    <div class="stats">${statsHtml}</div>
    <div class="url-box">${escapeHtml(url)}</div>
  </div>
</body>
</html>`;
}

export function renderOutroHtml({ title, subtitle, links = [] }) {
  const linksHtml = links
    .map(
      (item) => `
      <div class="link-row">
        <div class="link-label">${escapeHtml(item.label)}</div>
        <div class="link-url">${escapeHtml(item.url)}</div>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px;
    height: 1080px;
    background: #041A13;
    color: #F8FAFC;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 84px 104px;
    position: relative;
    overflow: hidden;
  }
  .grid-bg {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(16, 185, 129, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(16, 185, 129, 0.05) 1px, transparent 1px);
    background-size: 64px 64px;
    pointer-events: none;
  }
  .header {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 30px;
    font-weight: 800;
  }
  .logo-box {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: #10B981;
    color: #041A13;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 30px;
  }
  .brand span { color: #34D399; }
  .pill {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 20px;
    color: #34D399;
    background: rgba(16, 185, 129, 0.14);
    border: 1px solid rgba(52, 211, 153, 0.35);
    padding: 12px 22px;
    border-radius: 999px;
    font-weight: 700;
  }
  .main {
    position: relative;
    display: grid;
    grid-template-columns: 1fr 1.15fr;
    gap: 64px;
    align-items: center;
  }
  h2 {
    font-size: 62px;
    line-height: 1.1;
    font-weight: 800;
    letter-spacing: -0.025em;
    margin-bottom: 24px;
  }
  p {
    font-size: 28px;
    line-height: 1.45;
    color: #CBD5E1;
  }
  .card {
    background: #07241B;
    border: 2px solid rgba(52, 211, 153, 0.36);
    border-radius: 24px;
    padding: 36px 40px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .card-title {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 18px;
    font-weight: 700;
    color: #34D399;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .link-row {
    background: #0B1215;
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 14px;
    padding: 16px 22px;
  }
  .link-label {
    font-size: 21px;
    font-weight: 700;
    color: #F8FAFC;
    margin-bottom: 6px;
  }
  .link-url {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 20px;
    color: #34D399;
  }
  .footer {
    position: relative;
    border-top: 1px solid rgba(52, 211, 153, 0.22);
    padding-top: 24px;
    display: flex;
    justify-content: space-between;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 20px;
    color: #94A3B8;
  }
</style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="header">
    <div class="brand"><div class="logo-box">S</div><div>SWEEPR <span>VPN</span></div></div>
    <div class="pill">FREE TOOLS &amp; GUIDES IN DESCRIPTION</div>
  </div>
  <div class="main">
    <div>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(subtitle)}</p>
    </div>
    <div class="card">
      <div class="card-title">Direct Resources Verified in This Demo</div>
      ${linksHtml}
    </div>
  </div>
  <div class="footer">
    <span>WireGuard 10Gbps RAM-Only Nodes • 10.64.0.1 / 10.66.0.1 DNS</span>
    <span>https://sweeprvpn.com</span>
  </div>
</body>
</html>`;
}

export function renderThumbnailHtml({ kicker, headline, metricBadge, subline }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px;
    height: 720px;
    background: #041A13;
    color: #F8FAFC;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 58px 68px;
    position: relative;
    overflow: hidden;
    border: 8px solid #10B981;
  }
  .grid-bg {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(16, 185, 129, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(16, 185, 129, 0.08) 1px, transparent 1px);
    background-size: 48px 48px;
  }
  .top {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .kicker {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: #041A13;
    background: #34D399;
    padding: 10px 22px;
    border-radius: 10px;
    text-transform: uppercase;
  }
  .brand {
    font-size: 26px;
    font-weight: 800;
    color: #F8FAFC;
    letter-spacing: -0.02em;
  }
  .brand span { color: #34D399; }
  .mid {
    position: relative;
    margin: 12px 0;
  }
  h1 {
    font-size: 74px;
    line-height: 1.04;
    font-weight: 900;
    letter-spacing: -0.03em;
    color: #FFFFFF;
    margin-bottom: 22px;
    max-width: 1120px;
  }
  .sub {
    font-size: 32px;
    font-weight: 600;
    color: #CBD5E1;
    max-width: 1050px;
  }
  .bottom {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .metric {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 30px;
    font-weight: 800;
    color: #34D399;
    background: #0B1215;
    border: 2px solid #10B981;
    padding: 14px 28px;
    border-radius: 14px;
  }
  .site {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 26px;
    font-weight: 700;
    color: #94A3B8;
  }
</style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="top">
    <div class="kicker">${escapeHtml(kicker)}</div>
    <div class="brand">SWEEPR <span>VPN</span></div>
  </div>
  <div class="mid">
    <h1>${escapeHtml(headline)}</h1>
    <div class="sub">${escapeHtml(subline)}</div>
  </div>
  <div class="bottom">
    <div class="metric">${escapeHtml(metricBadge)}</div>
    <div class="site">sweeprvpn.com</div>
  </div>
</body>
</html>`;
}

/**
 * Injected onto recorded live pages to provide a subtle non-blocking lower-third pill.
 */
export function injectLowerThirdInPage({ chapterLabel, pageUrl }) {
  const existing = document.getElementById('sweepr-demo-lower-third');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'sweepr-demo-lower-third';
  Object.assign(bar.style, {
    position: 'fixed',
    left: '24px',
    bottom: '24px',
    zIndex: '2147483647',
    pointerEvents: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 18px',
    borderRadius: '12px',
    background: 'rgba(4, 26, 19, 0.92)',
    border: '1px solid rgba(52, 211, 153, 0.45)',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.35)',
    color: '#F8FAFC',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '15px',
    fontWeight: '700',
    letterSpacing: '0.02em',
    backdropFilter: 'blur(8px)'
  });

  const dot = document.createElement('span');
  Object.assign(dot.style, {
    width: '9px',
    height: '9px',
    borderRadius: '999px',
    background: '#10B981',
    boxShadow: '0 0 8px #10B981',
    flexShrink: '0'
  });

  const labelEl = document.createElement('span');
  labelEl.textContent = chapterLabel;
  labelEl.style.color = '#34D399';

  const sep = document.createElement('span');
  sep.textContent = '|';
  sep.style.color = '#475569';

  const urlEl = document.createElement('span');
  urlEl.textContent = pageUrl.replace(/^https?:\/\//, '');
  urlEl.style.color = '#E2E8F0';
  urlEl.style.fontWeight = '600';

  bar.append(dot, labelEl, sep, urlEl);
  document.body.appendChild(bar);
}
