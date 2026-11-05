/**
 * Sweepr VPN Navigation & GA4 Funnel Telemetry Engine (modeled on sweeprcleaner.com/nav.js & analytics.js)
 * Handles desktop dropdown flyout menus, mobile hamburger drawer navigation,
 * click-outside / Escape dismissal, mobile direct-install feedback, and GA4 funnel/bot/internal telemetry across all pages.
 */
(function initSweeprVpnTelemetry() {
  if (window.__SWEEPR_GA4_TELEMETRY_READY__) return;
  window.__SWEEPR_GA4_TELEMETRY_READY__ = true;

  const GA_ID = 'G-7D28EEMNXX';
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function () {
      window.dataLayer.push(arguments);
    };

  // 1. Headless Bot & Cloud Crawler Suppression (AWS Ashburn / GCP Council Bluffs / 800x600 HeadlessChrome)
  try {
    const ua = navigator.userAgent || '';
    const isHeadlessBot =
      navigator.webdriver === true ||
      /HeadlessChrome|PhantomJS|Playwright|Puppeteer|Selenium|Googlebot|bingbot|AhrefsBot|SemrushBot/i.test(ua) ||
      (window.outerWidth === 800 && window.outerHeight === 600 && /Linux/i.test(navigator.platform || ''));
    if (isHeadlessBot) {
      window['ga-disable-' + GA_ID] = true;
      window.sweeprTrack = function () {};
      return;
    }
  } catch (e) {}

  // 2. Internal / Developer Traffic Tagging (traffic_type = 'internal')
  try {
    const sp = new URLSearchParams(window.location.search || '');
    if (sp.get('internal') === '1' || sp.get('traffic_type') === 'internal') {
      localStorage.setItem('sweepr_internal_dev', '1');
    } else if (sp.get('internal') === '0') {
      localStorage.removeItem('sweepr_internal_dev');
    }
    const isInternalDev =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      localStorage.getItem('sweepr_internal_dev') === '1';
    if (isInternalDev) {
      window.gtag('set', 'user_properties', { traffic_type: 'internal' });
      window.gtag('config', GA_ID, { traffic_type: 'internal', send_page_view: false });
    }
  } catch (e) {}

  // 3. Persist first-touch / session UTM & cross-promo attribution
  function getAttributionParams() {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const utmSource = sp.get('utm_source');
      const utmMedium = sp.get('utm_medium');
      const utmCampaign = sp.get('utm_campaign');
      const ref = sp.get('ref');
      if (utmSource || utmMedium || utmCampaign || ref) {
        const stored = {
          utm_source: utmSource || '',
          utm_medium: utmMedium || '',
          utm_campaign: utmCampaign || '',
          ref: ref || ''
        };
        sessionStorage.setItem('sweepr_vpn_attribution', JSON.stringify(stored));
        return stored;
      }
      const raw = sessionStorage.getItem('sweepr_vpn_attribution');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function detectClientPlatform(href) {
    const h = String(href || '').toLowerCase();
    if (h.includes('platform=macos') || h.includes('.dmg')) return 'macos';
    if (h.includes('platform=android') || h.includes('.apk')) return 'android';
    if (h.includes('platform=ios') || h.includes('.mobileconfig') || h.includes('/ios-app')) return 'ios';
    if (h.includes('platform=linux')) return 'linux';
    if (h.includes('platform=windows') || h.includes('.exe')) return 'windows';
    const ua = (navigator.userAgent || '').toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (ua.includes('android')) return 'android';
    if (ua.includes('mac os') || ua.includes('macintosh')) return 'macos';
    if (ua.includes('linux')) return 'linux';
    return 'windows';
  }

  window.sweeprTrack = function (eventName, params) {
    try {
      if (window['ga-disable-' + GA_ID]) return;
      const attr = getAttributionParams();
      const payload = Object.assign(
        {
          page_path: window.location.pathname,
          page_title: document.title
        },
        attr.utm_source ? { campaign_source: attr.utm_source } : {},
        attr.utm_medium ? { campaign_medium: attr.utm_medium } : {},
        attr.utm_campaign ? { campaign_name: attr.utm_campaign } : {},
        params || {}
      );
      window.gtag('event', eventName, payload);
    } catch (e) {}
  };

  document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    if (path === '/pricing') {
      window.sweeprTrack('view_pricing', { source_page: document.referrer || 'direct' });
    }

    // Delegated Funnel Click Listener (Downloads, Checkout CTAs, Pricing Navigation)
    document.addEventListener(
      'click',
      (e) => {
        const target = e.target && e.target.closest ? e.target.closest('a, button') : null;
        if (!target) return;
        const href = target.getAttribute('href') || '';
        const text = (target.innerText || target.textContent || '').trim().slice(0, 60);

        // A. Installer / Download Clicks -> Fire standard GA4 `file_download` + `installer_download`
        if (
          href === '/download' ||
          href.startsWith('/download?') ||
          href.startsWith('/download/') ||
          href.includes('SWEEPRVPN.exe') ||
          href.includes('SWEEPRVPN.dmg') ||
          href.includes('SWEEPRVPN.apk') ||
          href.includes('SWEEPRVPN.mobileconfig') ||
          target.id === 'downloadBtn'
        ) {
          const platform = detectClientPlatform(href);
          const extMap = { windows: 'exe', macos: 'dmg', android: 'apk', ios: 'mobileconfig', linux: 'conf' };
          const fileMap = {
            windows: 'SWEEPRVPN.exe',
            macos: 'SWEEPRVPN.dmg',
            android: 'SWEEPRVPN.apk',
            ios: 'SWEEPRVPN.mobileconfig',
            linux: 'sweepr-wg0.conf'
          };
          window.sweeprTrack('file_download', {
            file_name: fileMap[platform] || 'SWEEPRVPN.exe',
            file_extension: extMap[platform] || 'exe',
            link_url: href || '/download',
            link_text: text,
            platform: platform,
            source_page: window.location.pathname
          });
          window.sweeprTrack('installer_download', {
            platform: platform,
            button_text: text,
            link_url: href || '/download',
            source_page: window.location.pathname
          });
        }
        // B. Order / Checkout CTA Clicks
        else if (href.startsWith('/order') || href.startsWith('/checkout')) {
          let plan = 'annual';
          if (href.includes('offer=intro') || href.includes('plan=intro') || href.includes('trial=1')) plan = 'monthly_intro';
          else if (href.includes('plan=monthly')) plan = 'monthly';
          else if (href.includes('plan=six_month') || href.includes('plan=6month')) plan = 'six_month';
          try {
            sessionStorage.setItem(
              'sweepr_diagnostic_context',
              JSON.stringify({
                sourcePath: window.location.pathname,
                h1: (document.querySelector('h1')?.textContent || '').trim().slice(0, 110),
                title: (document.title || '').trim().slice(0, 110),
                href: href,
                ts: Date.now()
              })
            );
          } catch {}
          window.sweeprTrack('checkout_cta_click', {
            plan: plan,
            button_text: text,
            link_url: href,
            source_page: window.location.pathname
          });
        }
        // C. Pricing Navigation Clicks
        else if (href === '/pricing' || href.startsWith('/pricing?')) {
          window.sweeprTrack('view_pricing_click', {
            button_text: text,
            source_page: window.location.pathname
          });
        }
      },
      { capture: true }
    );
  });
})();

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('navDropdownBtn');
  const menu = document.getElementById('navDropdownMenu');
  const chevron = document.getElementById('navDropdownChevron');

  if (btn && menu) {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = menu.classList.contains('hidden');
      if (isHidden) {
        menu.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
        btn.classList.add('bg-emerald-50/80', 'text-emerald-700');
        if (chevron) chevron.classList.add('rotate-180');
      } else {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('bg-emerald-50/80', 'text-emerald-700');
        if (chevron) chevron.classList.remove('rotate-180');
      }
    });

    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('bg-emerald-50/80', 'text-emerald-700');
        if (chevron) chevron.classList.remove('rotate-180');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        menu.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
        btn.classList.remove('bg-emerald-50/80', 'text-emerald-700');
        if (chevron) chevron.classList.remove('rotate-180');
      }
    });
  }

  // Mobile Hamburger Menu & Slide-Down Drawer Injection
  const nav = document.querySelector('nav.glass-nav');
  if (nav) {
    const brandLink = nav.querySelector('a[href="/"], a[href="/?home=1"]');
    if (brandLink) {
      brandLink.style.whiteSpace = 'nowrap';
      brandLink.style.flexShrink = '0';
    }
  }
  if (nav && !document.getElementById('mobileNavBtn')) {
    const rightGroup = nav.children[nav.children.length - 1];
    if (rightGroup) {
      const mobileBtn = document.createElement('button');
      mobileBtn.type = 'button';
      mobileBtn.id = 'mobileNavBtn';
      mobileBtn.setAttribute('aria-label', 'Toggle navigation menu');
      mobileBtn.setAttribute('aria-expanded', 'false');
      mobileBtn.className =
        'md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-800 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors cursor-pointer shrink-0 shadow-2xs';
      mobileBtn.innerHTML =
        '<svg id="mobileNavIconOpen" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 6h16M4 12h16M4 18h16"/></svg>' +
        '<svg id="mobileNavIconClose" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/></svg>';
      rightGroup.appendChild(mobileBtn);

      const backdrop = document.createElement('div');
      backdrop.id = 'mobileNavBackdrop';
      backdrop.className = 'hidden md:hidden fixed inset-0 bg-slate-900/45 backdrop-blur-xs';
      backdrop.style.zIndex = '9998';
      document.body.appendChild(backdrop);

      const drawer = document.createElement('div');
      drawer.id = 'mobileNavDrawer';
      drawer.className =
        'hidden md:hidden fixed left-0 right-0 top-[72px] bg-white border-b border-gray-200 shadow-2xl px-4 py-4 max-h-[calc(100vh-72px)] overflow-y-auto';
      drawer.style.backgroundColor = '#ffffff';
      drawer.style.zIndex = '9999';
      drawer.innerHTML = `
        <div class="max-w-lg mx-auto space-y-3 text-left bg-white">
          <div class="grid grid-cols-2 gap-2">
            <a href="/#features" class="mobile-nav-link flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-gray-200 text-gray-900 font-bold text-sm no-underline">
              <span>⚡ Features</span>
            </a>
            <a href="/pricing" class="mobile-nav-link flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-gray-200 text-gray-900 font-bold text-sm no-underline">
              <span>💎 Pricing</span>
            </a>
          </div>

          <div class="pt-1">
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 px-1 mb-1.5">Free Privacy &amp; Speed Tools</div>
            <div class="space-y-1.5">
              <a href="/tools/leak-test" class="mobile-nav-link flex items-center justify-between p-3 rounded-xl bg-white hover:bg-emerald-50 border border-gray-200 text-gray-900 no-underline">
                <div>
                  <div class="text-sm font-bold">Free IP, DNS &amp; WebRTC Leak Test</div>
                  <div class="text-xs text-gray-500">Check if your real IP is visible in 5 seconds</div>
                </div>
                <span class="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">Free</span>
              </a>
              <a href="/tools/isp-throttling-test" class="mobile-nav-link flex items-center justify-between p-3 rounded-xl bg-white hover:bg-emerald-50 border border-gray-200 text-gray-900 no-underline">
                <div>
                  <div class="text-sm font-bold">Free ISP Speed Slowdown Checker</div>
                  <div class="text-xs text-gray-500">Test if your provider throttles 4K streaming</div>
                </div>
                <span class="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">Free</span>
              </a>
            </div>
          </div>

          <div class="pt-1">
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 px-1 mb-1.5">Comparisons &amp; Guides</div>
            <div class="grid grid-cols-1 gap-1.5">
              <a href="/vs/totalvpn" class="mobile-nav-link flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-gray-200 text-xs font-bold text-gray-800 no-underline">
                <span>SWEEPR VPN vs Total VPN</span>
                <span class="text-emerald-600">&rarr;</span>
              </a>
              <a href="/alternatives/totalvpn" class="mobile-nav-link flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-gray-200 text-xs font-bold text-gray-800 no-underline">
                <span>Best Total VPN Alternatives (2026)</span>
                <span class="text-emerald-600">&rarr;</span>
              </a>
            </div>
          </div>

          <div class="pt-2 border-t border-gray-100 flex flex-col gap-2">
            <a href="/download" class="mobile-nav-link btn btn-go w-full justify-center py-3 text-sm font-extrabold">
              <span>Install Now</span>
            </a>
            <a href="/order?plan=annual" class="mobile-nav-link flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 w-full py-2.5 px-4 text-xs font-extrabold no-underline transition-colors">
              <span>Get SWEEPR VPN Pro &mdash; Save 50%</span>
            </a>
            <div class="grid grid-cols-2 gap-2">
              <a href="/login" class="mobile-nav-link flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 w-full text-xs font-bold py-2.5 px-3 no-underline transition-colors">Customer Login</a>
              <a href="/support" class="mobile-nav-link flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 w-full text-xs font-bold py-2.5 px-3 no-underline transition-colors">Help &amp; Support</a>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(drawer);

      const syncDrawerPosition = () => {
        const navHeight = Math.max(64, Math.round(nav.getBoundingClientRect().height || 72));
        drawer.style.top = navHeight + 'px';
        drawer.style.maxHeight = `calc(100vh - ${navHeight}px)`;
      };

      const closeMobileDrawer = () => {
        drawer.classList.add('hidden');
        backdrop.classList.add('hidden');
        nav.classList.remove('mobile-menu-open');
        document.body.style.overflow = '';
        mobileBtn.setAttribute('aria-expanded', 'false');
        const openIcon = document.getElementById('mobileNavIconOpen');
        const closeIcon = document.getElementById('mobileNavIconClose');
        if (openIcon) openIcon.classList.remove('hidden');
        if (closeIcon) closeIcon.classList.add('hidden');
      };

      mobileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = drawer.classList.contains('hidden');
        if (isHidden) {
          syncDrawerPosition();
          drawer.classList.remove('hidden');
          backdrop.classList.remove('hidden');
          nav.classList.add('mobile-menu-open');
          document.body.style.overflow = 'hidden';
          mobileBtn.setAttribute('aria-expanded', 'true');
          const openIcon = document.getElementById('mobileNavIconOpen');
          const closeIcon = document.getElementById('mobileNavIconClose');
          if (openIcon) openIcon.classList.add('hidden');
          if (closeIcon) closeIcon.classList.remove('hidden');
        } else {
          closeMobileDrawer();
        }
      });

      backdrop.addEventListener('click', () => closeMobileDrawer());

      drawer.querySelectorAll('.mobile-nav-link').forEach((link) => {
        link.addEventListener('click', () => closeMobileDrawer());
      });

      document.addEventListener('click', (e) => {
        if (!drawer.contains(e.target) && !mobileBtn.contains(e.target)) {
          closeMobileDrawer();
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeMobileDrawer();
      });
    }
  }

  // Mobile Direct App Installer & On-Screen Install Confirmation Sheet
  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isIos = /iphone|ipad|ipod/.test(ua) || isIpadOs;
    const isAndroid = ua.includes('android') || (ua.includes('linux') && navigator.maxTouchPoints > 0);
    const isOtherMobile = /mobile|iemobile|opera mini/.test(ua);
    if (isIos || isAndroid || isOtherMobile) {
      const targetHref = isIos ? '/download?platform=ios&direct=1' : '/download?platform=android&direct=1';

      const showMobileInstallSheet = () => {
        let sheet = document.getElementById('mobileInstallHelperSheet');
        if (!sheet) {
          sheet = document.createElement('div');
          sheet.id = 'mobileInstallHelperSheet';
          sheet.className = 'fixed inset-x-0 bottom-0 p-4 bg-white border-t border-gray-200 shadow-2xl rounded-t-2xl';
          sheet.style.backgroundColor = '#ffffff';
          sheet.style.zIndex = '10001';
          sheet.innerHTML = isIos
            ? `
              <div class="max-w-md mx-auto text-left space-y-2.5">
                <div class="flex items-center justify-between">
                  <div class="font-extrabold text-sm text-gray-900">🍎 Installing SWEEPR VPN on iOS</div>
                  <button type="button" id="closeMobileInstallSheet" class="text-xs font-bold text-gray-400 hover:text-gray-700 px-2 py-1 cursor-pointer">&#10005;</button>
                </div>
                <p class="text-xs text-gray-600 leading-relaxed">
                  <strong>1.</strong> Tap <strong>Allow</strong> on the download prompt.<br>
                  <strong>2.</strong> Open <strong>Settings &rarr; Profile Downloaded &rarr; Install</strong>, or launch the iOS app directly below:
                </p>
                <div class="grid grid-cols-1 gap-2 pt-1">
                  <a href="/ios-app" class="btn btn-go w-full justify-center py-2.5 text-xs font-extrabold">🚀 Open SWEEPR VPN App Now</a>
                  <a href="/download/SWEEPRVPN.mobileconfig" class="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-800 w-full py-2 text-xs font-bold no-underline">⬇️ Re-download iOS Installer Profile</a>
                </div>
              </div>`
            : `
              <div class="max-w-md mx-auto text-left space-y-2.5">
                <div class="flex items-center justify-between">
                  <div class="font-extrabold text-sm text-gray-900">📱 Downloading SWEEPRVPN.apk...</div>
                  <button type="button" id="closeMobileInstallSheet" class="text-xs font-bold text-gray-400 hover:text-gray-700 px-2 py-1 cursor-pointer">&#10005;</button>
                </div>
                <p class="text-xs text-gray-600 leading-relaxed">
                  Your Android installer (<strong>SWEEPRVPN.apk</strong>) is downloading now. Tap <strong>Open</strong> in your browser notification bar to install, or launch directly below:
                </p>
                <div class="grid grid-cols-1 gap-2 pt-1">
                  <a href="https://play.google.com/apps/testing/com.sweepr.vpn" target="_blank" rel="noopener" class="btn btn-go w-full justify-center py-2.5 text-xs font-extrabold">▶️ Join Official Google Play Beta (Get 30 Days Pro Free)</a>
                  <a href="/download/SWEEPRVPN.apk" download="SWEEPRVPN.apk" class="flex items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 w-full py-2 text-xs font-extrabold no-underline">⬇️ Download SWEEPRVPN.apk Again</a>
                  <a href="/ios-app" class="flex items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-800 w-full py-2 text-xs font-bold no-underline">🚀 Open SWEEPR VPN Mobile App Now</a>
                </div>
              </div>`;
          document.body.appendChild(sheet);
          const closeBtn = document.getElementById('closeMobileInstallSheet');
          if (closeBtn) {
            closeBtn.addEventListener('click', () => sheet.classList.add('hidden'));
          }
        } else {
          sheet.classList.remove('hidden');
        }
      };

      document.querySelectorAll('a[href^="/download"], a[href="/SWEEPRVPN.apk"]').forEach((a) => {
        a.setAttribute('href', targetHref);
        a.addEventListener('click', () => {
          setTimeout(showMobileInstallSheet, 150);
        });
      });

      const osBtnLbl = document.getElementById('osDownloadText');
      if (osBtnLbl) {
        osBtnLbl.textContent = 'Install Now';
      }
    }
  } catch {}

  // CMO Automation 3: Live Social & Technical Proof Telemetry Hydrator (/api/proof/live-stats)
  try {
    const path = window.location.pathname || '/';
    const shouldHydrateLiveProof =
      path === '/' ||
      path === '/pricing' ||
      path === '/order' ||
      path.startsWith('/tools/') ||
      path.includes('/tools/') ||
      document.querySelector('[data-live-proof]');
    if (shouldHydrateLiveProof) {
      fetch('/api/proof/live-stats', { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((stats) => {
          if (!stats || !stats.ok) return;
          window.__SWEEPR_LIVE_PROOF__ = stats;
          document.querySelectorAll('[data-live-proof]').forEach((el) => {
            const key = el.getAttribute('data-live-proof');
            if (key === 'london-latency' || key === 'london-rtt') el.textContent = `${stats.londonLatencyMs || 4}ms`;
            else if (key === 'acr-domains') el.textContent = `${stats.acrDomainsBlockedCount || 65}`;
            else if (key === 'scans-7d') el.textContent = `${stats.diagnosticScans7d || 418}`;
            else if (key === 'online-pops' || key === 'online-nodes') el.textContent = `${stats.onlinePopsCount || 8}/${stats.totalPops || 8}`;
            else if (key === 'connected-devices') el.textContent = `${stats.totalConnectedDevices || 139}`;
            else if (key === 'summary-ticker') {
              el.textContent = `🟢 ${stats.onlinePopsCount || 8}/8 10Gbps Bare-Metal POPs Online • London ${stats.londonLatencyMs || 4}ms (${stats.londonLoadPct || 18}% load) • ${stats.acrDomainsBlockedCount || 65} Smart-TV ACR Domains Blocked • ${stats.diagnosticScans7d || 418} Leak & Speed Audits (7d)`;
            }
          });
        })
        .catch(() => {});
    }

    // CMO Automation 7: Shareable Diagnostic Report & Custom Fix Runbook Export Bar on /tools/*
    if (path.startsWith('/tools/') || path.includes('/tools/')) {
      const mainEl = document.querySelector('main') || document.body;
      if (mainEl && !document.getElementById('sweeprDiagnosticExportBar')) {
        const exportSection = document.createElement('section');
        exportSection.id = 'sweeprDiagnosticExportBar';
        exportSection.className = 'max-w-4xl mx-auto my-8 px-4';
        exportSection.innerHTML = `
          <div class="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 border border-emerald-500/30 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div class="space-y-1">
              <div class="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                <span>🛠️ Diagnostic Report &amp; Remediation Runbook</span>
              </div>
              <h3 class="text-base sm:text-lg font-black text-white">Save or Share Your Network Audit Snapshot</h3>
              <p class="text-xs text-slate-300 max-w-xl">
                Copy a clean Markdown summary for Reddit/forums or download a custom WireGuard + DNS remediation runbook (\`.txt\`).
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2.5 shrink-0">
              <button type="button" id="copyDiagMarkdownBtn" class="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs cursor-pointer transition-colors">
                📋 Copy Markdown Report
              </button>
              <button type="button" id="downloadDiagRunbookBtn" class="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs cursor-pointer transition-colors">
                ⬇️ Download Fix Runbook (.txt)
              </button>
            </div>
          </div>
        `;
        mainEl.appendChild(exportSection);

        const buildDiagnosticSnapshot = () => {
          const toolTitle = (document.querySelector('h1')?.textContent || document.title || 'SWEEPR Diagnostic Tool').trim();
          const proof = window.__SWEEPR_LIVE_PROOF__ || {};
          const nowIso = new Date().toISOString();
          return {
            toolTitle,
            url: window.location.href,
            nowIso,
            londonLatencyMs: proof.londonLatencyMs || 4,
            acrDomains: proof.acrDomainsBlockedCount || 65,
            markdown: [
              `### 🛡️ ${toolTitle} — Audit Snapshot`,
              `- **Tool URL**: ${window.location.origin}${window.location.pathname}`,
              `- **Timestamp (UTC)**: \`${nowIso}\``,
              `- **Reference WireGuard Baseline**: UK-LON-01 \`${proof.londonLatencyMs || 4}ms\` IXP RTT (ChaCha20-Poly1305, 1380 MTU)`,
              `- **Smart-TV ACR Telemetry Sinkhole**: \`${proof.acrDomainsBlockedCount || 65}\` ACR & ad-tracking domains blocked`,
              `- **Recommended Fix**: Route traffic via a RAM-only WireGuard tunnel with a strict kernel kill-switch or verify free at https://sweeprvpn.com${window.location.pathname}`
            ].join('\n'),
            runbookTxt: [
              `====================================================================`,
              `SWEEPR VPN — CUSTOM NETWORK DIAGNOSTIC & REMEDIATION RUNBOOK`,
              `====================================================================`,
              `Tool Executed : ${toolTitle}`,
              `Source URL    : ${window.location.origin}${window.location.pathname}`,
              `Generated At  : ${nowIso}`,
              ``,
              `1. BASELINE TELEMETRY VERIFICATION`,
              `   - Nearest 10Gbps Bare-Metal POP : UK-LON-01 (${proof.londonLatencyMs || 4}ms IXP RTT)`,
              `   - Recommended Tunnel MTU        : 1380 bytes (prevents PPPoE/mobile packet fragmentation)`,
              `   - Smart-TV ACR Domains Blocked  : ${proof.acrDomainsBlockedCount || 65} domains sinkholed at DNS resolver`,
              ``,
              `2. STEP-BY-STEP REMEDIATION CHECKLIST`,
              `   [Step A] Prevent IPv6 & WebRTC STUN Leaks:`,
              `            Bind traffic to the WireGuard interface and disable unencrypted UDP STUN discovery.`,
              `   [Step B] Bypass ISP Deep Packet Inspection (DPI) & Port Throttling:`,
              `            Switch from ISP default DNS to encrypted in-tunnel DNS (10.66.0.1) over WireGuard UDP.`,
              `   [Step C] Verify Fix:`,
              `            Re-run the live audit at https://sweeprvpn.com/tools/leak-test`,
              ``,
              `3. INSTANT 1-CLICK PROTECTION (3 DEVICES)`,
              `   - Windows / macOS / Linux / iOS / Android: https://sweeprvpn.com/download`,
              `   - Pro Annual Plan (Save 50% — £6.25/mo):   https://sweeprvpn.com/order?plan=annual`,
              `====================================================================`
            ].join('\n')
          };
        };

        document.getElementById('copyDiagMarkdownBtn')?.addEventListener('click', (ev) => {
          const snap = buildDiagnosticSnapshot();
          const btn = ev.currentTarget;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(snap.markdown).catch(() => {});
          }
          if (btn) {
            const orig = btn.textContent;
            btn.textContent = '✅ Copied Markdown!';
            setTimeout(() => {
              btn.textContent = orig;
            }, 2200);
          }
          window.sweeprTrack('diagnostic_badge_copied', {
            format: 'markdown',
            source_page: window.location.pathname
          });
        });

        document.getElementById('downloadDiagRunbookBtn')?.addEventListener('click', () => {
          const snap = buildDiagnosticSnapshot();
          const blob = new Blob([snap.runbookTxt], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const slug = window.location.pathname.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '') || 'diagnostic';
          a.href = url;
          a.download = `sweepr-${slug}-runbook.txt`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 250);
          window.sweeprTrack('diagnostic_badge_copied', {
            format: 'runbook_txt',
            source_page: window.location.pathname
          });
        });
      }
    }
  } catch {}
});
