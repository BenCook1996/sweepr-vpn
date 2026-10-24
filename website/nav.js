/**
 * Sweepr VPN Navigation Interactions (modeled on sweeprcleaner.com/nav.js)
 * Handles desktop dropdown flyout menus, mobile hamburger drawer navigation,
 * and click-outside / Escape dismissal across all pages.
 */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('navDropdownBtn');
  const menu = document.getElementById('navDropdownMenu');
  const chevron = document.getElementById('navDropdownChevron');

  // Ensure "QR Code Setup" is present in desktop nav bar & dropdown across all pages
  const desktopNavGroup = document.querySelector('nav.glass-nav .hidden.md\\:flex');
  if (desktopNavGroup && !desktopNavGroup.querySelector('a[href="/qr-setup"]')) {
    const qrLink = document.createElement('a');
    qrLink.href = '/qr-setup';
    qrLink.className = 'btn btn-ghost text-sm';
    qrLink.textContent = 'QR Code Setup';
    const dropdownContainer = document.getElementById('navDropdownContainer');
    if (dropdownContainer) {
      desktopNavGroup.insertBefore(qrLink, dropdownContainer);
    } else {
      desktopNavGroup.appendChild(qrLink);
    }
  }
  if (menu && !menu.querySelector('a[href="/qr-setup"]')) {
    const grid = menu.querySelector('.grid');
    if (grid) {
      const tile = document.createElement('a');
      tile.href = '/qr-setup';
      tile.className = 'flex items-start gap-3 p-3 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-200/60 transition-all text-inherit no-underline group';
      tile.innerHTML =
        '<div class="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">' +
        '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg>' +
        '</div>' +
        '<div class="flex-1 min-w-0">' +
        '<div class="flex items-center justify-between gap-1 mb-0.5">' +
        '<span class="text-sm font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">QR Code Connection Setup</span>' +
        '<span class="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">iOS &amp; Android</span>' +
        '</div>' +
        '<p class="text-xs text-gray-500 leading-snug line-clamp-2">Connect your phone or tablet in 15 seconds with a 1-tap WireGuard QR code or profile.</p>' +
        '</div>';
      grid.insertBefore(tile, grid.firstChild);
    }
  }

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
  if (nav && !document.getElementById('mobileNavBtn')) {
    const rightGroup = nav.children[nav.children.length - 1];
    if (rightGroup) {
      const mobileBtn = document.createElement('button');
      mobileBtn.type = 'button';
      mobileBtn.id = 'mobileNavBtn';
      mobileBtn.setAttribute('aria-label', 'Toggle navigation menu');
      mobileBtn.setAttribute('aria-expanded', 'false');
      mobileBtn.className =
        'md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200/90 bg-white/90 text-gray-800 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-colors cursor-pointer shrink-0';
      mobileBtn.innerHTML =
        '<svg id="mobileNavIconOpen" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 6h16M4 12h16M4 18h16"/></svg>' +
        '<svg id="mobileNavIconClose" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/></svg>';
      rightGroup.appendChild(mobileBtn);

      const drawer = document.createElement('div');
      drawer.id = 'mobileNavDrawer';
      drawer.className =
        'hidden md:hidden fixed left-0 right-0 top-[68px] bg-white/98 backdrop-blur-xl border-b border-gray-200 shadow-2xl px-4 py-4 z-50 max-h-[calc(100vh-68px)] overflow-y-auto';
      drawer.innerHTML = `
        <div class="max-w-lg mx-auto space-y-3 text-left">
          <div class="grid grid-cols-2 gap-2">
            <a href="/#features" class="mobile-nav-link flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-gray-200/80 text-gray-900 font-bold text-sm no-underline">
              <span>⚡ Features</span>
            </a>
            <a href="/pricing" class="mobile-nav-link flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 hover:bg-emerald-50 border border-gray-200/80 text-gray-900 font-bold text-sm no-underline">
              <span>💎 Pricing</span>
            </a>
            <a href="/qr-setup" class="col-span-2 mobile-nav-link flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200 text-emerald-950 font-bold text-sm no-underline">
              <span>📱 QR Code Connection Setup</span>
              <span class="text-[10px] font-extrabold uppercase text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded-full">iOS &amp; Android</span>
            </a>
          </div>

          <div class="pt-1">
            <div class="text-[11px] font-extrabold uppercase tracking-wider text-gray-400 px-1 mb-1.5">Free Privacy &amp; Speed Tools</div>
            <div class="space-y-1.5">
              <a href="/tools/leak-test" class="mobile-nav-link flex items-center justify-between p-3 rounded-xl bg-white hover:bg-emerald-50/70 border border-gray-200/80 text-gray-900 no-underline">
                <div>
                  <div class="text-sm font-bold">Free IP, DNS &amp; WebRTC Leak Test</div>
                  <div class="text-xs text-gray-500">Check if your real IP is visible in 5 seconds</div>
                </div>
                <span class="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">Free</span>
              </a>
              <a href="/tools/isp-throttling-test" class="mobile-nav-link flex items-center justify-between p-3 rounded-xl bg-white hover:bg-emerald-50/70 border border-gray-200/80 text-gray-900 no-underline">
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
              <a href="/vs/totalvpn" class="mobile-nav-link flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50/80 hover:bg-emerald-50 border border-gray-200/70 text-xs font-bold text-gray-800 no-underline">
                <span>SWEEPR VPN vs Total VPN</span>
                <span class="text-emerald-600">&rarr;</span>
              </a>
              <a href="/alternatives/totalvpn" class="mobile-nav-link flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50/80 hover:bg-emerald-50 border border-gray-200/70 text-xs font-bold text-gray-800 no-underline">
                <span>Best Total VPN Alternatives (2026)</span>
                <span class="text-emerald-600">&rarr;</span>
              </a>
            </div>
          </div>

          <div class="pt-2 border-t border-gray-100 flex flex-col gap-2">
            <a href="/order?plan=annual" class="mobile-nav-link btn btn-go w-full justify-center py-3 text-sm font-extrabold">
              <span>Get SWEEPR VPN Pro &mdash; Save 50%</span>
            </a>
            <div class="grid grid-cols-2 gap-2">
              <a href="/login" class="mobile-nav-link btn btn-ghost border border-gray-200 w-full justify-center text-xs font-bold py-2.5">Customer Login</a>
              <a href="/support" class="mobile-nav-link btn btn-ghost border border-gray-200 w-full justify-center text-xs font-bold py-2.5">Help &amp; Support</a>
            </div>
          </div>
        </div>
      `;
      nav.appendChild(drawer);

      const closeMobileDrawer = () => {
        drawer.classList.add('hidden');
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
          drawer.classList.remove('hidden');
          mobileBtn.setAttribute('aria-expanded', 'true');
          const openIcon = document.getElementById('mobileNavIconOpen');
          const closeIcon = document.getElementById('mobileNavIconClose');
          if (openIcon) openIcon.classList.add('hidden');
          if (closeIcon) closeIcon.classList.remove('hidden');
        } else {
          closeMobileDrawer();
        }
      });

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
});
