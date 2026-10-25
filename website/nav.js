/**
 * Sweepr VPN Navigation Interactions (modeled on sweeprcleaner.com/nav.js)
 * Handles desktop dropdown flyout menus, mobile hamburger drawer navigation,
 * click-outside / Escape dismissal, and mobile direct-install feedback across all pages.
 */
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
                  <a href="/download/SWEEPRVPN.apk" download="SWEEPRVPN.apk" class="btn btn-go w-full justify-center py-2.5 text-xs font-extrabold">⬇️ Download SWEEPRVPN.apk Again</a>
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
});
