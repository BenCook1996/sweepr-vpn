/**
 * SWEEPR VPN — Centralized Multi-Currency Pricing Engine
 *
 * Base GBP Pricing Model:
 *   - Monthly Plan:   £12.49 / month (plus £1.99 1st-Month Introductory Offer)
 *   - 6-Monthly Plan: £48.99 / 6 months (£8.17/mo equivalent — Save 35%)
 *   - Yearly Plan:    £74.99 / year (£6.25/mo equivalent — Save 50%)
 *   - Paid Add-On (SWEEPR Wi-Fi Radar & Smart-TV Shield):
 *     +£14.99/yr | +£9.99/6mo | +£1.99/mo
 *
 * All foreign currencies are equated to the GBP base and adjusted so every price point
 * sits 1 pence/cent/unit under a round number (.99 or 999 for JPY), with Yearly strictly saving 50%.
 */

(function () {
  const SWEEPR_PRICING = {
    GBP: {
      code: 'GBP',
      symbol: '£',
      flag: '🇬🇧',
      label: 'GBP (£)',
      name: 'United Kingdom (GBP)',
      decimals: 2,
      monthly: 12.49,
      sixMonth: 48.99,
      annual: 74.99,
      introFirstMonth: 1.99,
      addonMonthly: 1.99,
      addonSixMonth: 9.99,
      addonAnnual: 14.99
    },
    USD: {
      code: 'USD',
      symbol: '$',
      flag: '🇺🇸',
      label: 'USD ($)',
      name: 'United States (USD)',
      decimals: 2,
      monthly: 15.99,
      sixMonth: 61.99,
      annual: 95.99,
      introFirstMonth: 2.99,
      addonMonthly: 2.99,
      addonSixMonth: 12.99,
      addonAnnual: 19.99
    },
    EUR: {
      code: 'EUR',
      symbol: '€',
      flag: '🇪🇺',
      label: 'EUR (€)',
      name: 'Europe (EUR)',
      decimals: 2,
      monthly: 14.99,
      sixMonth: 58.99,
      annual: 89.99,
      introFirstMonth: 2.99,
      addonMonthly: 2.49,
      addonSixMonth: 11.99,
      addonAnnual: 17.99
    },
    CAD: {
      code: 'CAD',
      symbol: 'CA$',
      flag: '🇨🇦',
      label: 'CAD (CA$)',
      name: 'Canada (CAD)',
      decimals: 2,
      monthly: 21.99,
      sixMonth: 85.99,
      annual: 131.99,
      introFirstMonth: 3.99,
      addonMonthly: 3.49,
      addonSixMonth: 17.99,
      addonAnnual: 26.99
    },
    AUD: {
      code: 'AUD',
      symbol: 'A$',
      flag: '🇦🇺',
      label: 'AUD (A$)',
      name: 'Australia (AUD)',
      decimals: 2,
      monthly: 24.99,
      sixMonth: 97.99,
      annual: 149.99,
      introFirstMonth: 3.99,
      addonMonthly: 3.99,
      addonSixMonth: 19.99,
      addonAnnual: 29.99
    },
    CHF: {
      code: 'CHF',
      symbol: 'CHF ',
      flag: '🇨🇭',
      label: 'CHF (Fr.)',
      name: 'Switzerland (CHF)',
      decimals: 2,
      monthly: 13.99,
      sixMonth: 54.99,
      annual: 83.99,
      introFirstMonth: 2.99,
      addonMonthly: 2.49,
      addonSixMonth: 10.99,
      addonAnnual: 16.99
    },
    JPY: {
      code: 'JPY',
      symbol: '¥',
      flag: '🇯🇵',
      label: 'JPY (¥)',
      name: 'Japan (JPY)',
      decimals: 0,
      monthly: 2499,
      sixMonth: 9799,
      annual: 14999,
      introFirstMonth: 399,
      addonMonthly: 399,
      addonSixMonth: 1999,
      addonAnnual: 2999
    }
  };

  function formatAmount(currObj, val) {
    if (currObj.decimals === 0) {
      return currObj.symbol + Math.round(val).toLocaleString('en-US');
    }
    return currObj.symbol + Number(val).toFixed(2);
  }

  function getComputedPricing(currencyCode) {
    const c = SWEEPR_PRICING[currencyCode] || SWEEPR_PRICING.GBP;
    const annualPerMonth = c.decimals === 0 ? Math.round(c.annual / 12) : Math.round((c.annual / 12) * 100) / 100;
    const sixMonthPerMonth = c.decimals === 0 ? Math.round(c.sixMonth / 6) : Math.round((c.sixMonth / 6) * 100) / 100;
    const addonAnnualPerMonth = c.decimals === 0 ? Math.round(c.addonAnnual / 12) : Math.round((c.addonAnnual / 12) * 100) / 100;
    const addonSixMonthPerMonth = c.decimals === 0 ? Math.round(c.addonSixMonth / 6) : Math.round((c.addonSixMonth / 6) * 100) / 100;
    const annualRegular = c.monthly * 12;
    const sixMonthRegular = c.monthly * 6;
    const annualSavingsAmt = annualRegular - c.annual;
    const sixMonthSavingsAmt = sixMonthRegular - c.sixMonth;
    const introSavingsAmt = c.monthly - c.introFirstMonth;

    return {
      ...c,
      fmt: (v) => formatAmount(c, v),
      monthlyStr: formatAmount(c, c.monthly),
      sixMonthStr: formatAmount(c, c.sixMonth),
      annualStr: formatAmount(c, c.annual),
      introStr: formatAmount(c, c.introFirstMonth),
      annualPerMonthStr: formatAmount(c, annualPerMonth),
      sixMonthPerMonthStr: formatAmount(c, sixMonthPerMonth),
      annualRegularStr: formatAmount(c, annualRegular),
      sixMonthRegularStr: formatAmount(c, sixMonthRegular),
      annualSavingsStr: formatAmount(c, annualSavingsAmt),
      sixMonthSavingsStr: formatAmount(c, sixMonthSavingsAmt),
      introSavingsStr: formatAmount(c, introSavingsAmt),
      addonMonthlyStr: formatAmount(c, c.addonMonthly),
      addonSixMonthStr: formatAmount(c, c.addonSixMonth),
      addonAnnualStr: formatAmount(c, c.addonAnnual),
      addonAnnualPerMonthStr: formatAmount(c, addonAnnualPerMonth),
      addonSixMonthPerMonthStr: formatAmount(c, addonSixMonthPerMonth)
    };
  }

  function getActiveCurrency() {
    try {
      const urlCurr = new URLSearchParams(window.location.search).get('currency');
      if (urlCurr && SWEEPR_PRICING[urlCurr.toUpperCase()]) {
        localStorage.setItem('sweepr_vpn_currency', urlCurr.toUpperCase());
        return urlCurr.toUpperCase();
      }
      const saved = localStorage.getItem('sweepr_vpn_currency');
      if (saved && SWEEPR_PRICING[saved]) return saved;
    } catch (e) {}
    return 'GBP';
  }

  const LANG_FLAGS = {
    en: { flag: '🇬🇧', code: 'EN', label: 'English' },
    de: { flag: '🇩🇪', code: 'DE', label: 'Deutsch' },
    fr: { flag: '🇫🇷', code: 'FR', label: 'Français' },
    es: { flag: '🇪🇸', code: 'ES', label: 'Español' },
    it: { flag: '🇮🇹', code: 'IT', label: 'Italiano' },
    pt: { flag: '🇵🇹', code: 'PT', label: 'Português' },
    nl: { flag: '🇳🇱', code: 'NL', label: 'Nederlands' },
    ja: { flag: '🇯🇵', code: 'JA', label: '日本語' }
  };

  function getActiveLanguage() {
    try {
      const saved = localStorage.getItem('sweepr_vpn_lang') || localStorage.getItem('deepblock_lang');
      if (saved && LANG_FLAGS[saved]) return saved;
    } catch (e) {}
    return 'en';
  }

  function setLanguage(langCode) {
    if (!LANG_FLAGS[langCode]) langCode = 'en';
    const chosen = LANG_FLAGS[langCode] || LANG_FLAGS.en;
    try {
      localStorage.setItem('sweepr_vpn_lang', langCode);
      localStorage.setItem('deepblock_lang', langCode);
      localStorage.setItem('sweepr_lang', langCode);
    } catch (e) {}

    const flagEl = document.getElementById('currentLangFlag');
    const codeEl = document.getElementById('currentLangCode');
    const langMenu = document.getElementById('langDropdownMenu');
    const langBtn = document.getElementById('langDropdownBtn');
    const langChevron = document.getElementById('langDropdownChevron');

    if (flagEl) flagEl.textContent = chosen.flag;
    if (codeEl) codeEl.textContent = chosen.code;
    if (langMenu) langMenu.classList.add('hidden');
    if (langBtn) langBtn.setAttribute('aria-expanded', 'false');
    if (langChevron) langChevron.classList.remove('rotate-180');
  }

  window.setLanguage = setLanguage;

  function applyCurrencyToDOM(currencyCode) {
    const p = getComputedPricing(currencyCode);
    window.SWEEPR_ACTIVE_PRICING = p;

    document.querySelectorAll('[data-price]').forEach((el) => {
      const key = el.getAttribute('data-price');
      if (p[key] !== undefined) {
        el.textContent = p[key];
      }
    });

    if (typeof window.onSweeprCurrencyChanged === 'function') {
      window.onSweeprCurrencyChanged(p);
    }
  }

  window.setSweeprCurrency = function (code) {
    if (!SWEEPR_PRICING[code]) code = 'GBP';
    try {
      localStorage.setItem('sweepr_vpn_currency', code);
    } catch (e) {}
    applyCurrencyToDOM(code);
  };

  window.SWEEPR_PRICING_TABLE = SWEEPR_PRICING;
  window.getSweeprPricing = getComputedPricing;

  document.addEventListener('DOMContentLoaded', () => {
    const mount = document.getElementById('currencySelectorMount');
    const activeCode = getActiveCurrency();
    const activeLangCode = getActiveLanguage();
    const activeLang = LANG_FLAGS[activeLangCode] || LANG_FLAGS.en;

    if (mount && !document.getElementById('langDropdownBtn')) {
      const isDarkHeader = mount.getAttribute('data-theme') === 'dark' || Boolean(mount.closest('header.bg-\\[\\#232931\\]'));
      const btnClasses = isDarkHeader
        ? 'text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer font-medium text-white transition-colors'
        : 'btn btn-ghost text-sm flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer font-medium text-gray-700 hover:text-emerald-600 transition-colors';
      const chevronColor = isDarkHeader ? 'text-gray-300' : 'text-gray-400';

      mount.innerHTML = `
        <div class="relative inline-block text-left" id="langDropdownContainer">
          <button type="button" id="langDropdownBtn" class="${btnClasses}" aria-expanded="false" aria-label="Select Language">
            <span class="text-sm" id="currentLangFlag">${activeLang.flag}</span>
            <span class="text-xs font-bold tracking-wide" id="currentLangCode">${activeLang.code}</span>
            <svg id="langDropdownChevron" class="w-3 h-3 ${chevronColor} transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          <div id="langDropdownMenu" class="hidden absolute right-0 mt-2 w-44 bg-white/95 backdrop-blur-xl border border-gray-200/90 rounded-2xl shadow-xl p-1.5 z-50 transition-all text-gray-800">
            <div class="space-y-0.5 text-xs">
              <button type="button" onclick="setLanguage('en')" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 transition-colors font-medium cursor-pointer">
                <span class="flex items-center gap-2"><span>🇬🇧</span> <span>English</span></span>
                <span class="text-[10px] text-gray-400 font-mono">EN</span>
              </button>
              <button type="button" onclick="setLanguage('de')" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 transition-colors font-medium cursor-pointer">
                <span class="flex items-center gap-2"><span>🇩🇪</span> <span>Deutsch</span></span>
                <span class="text-[10px] text-gray-400 font-mono">DE</span>
              </button>
              <button type="button" onclick="setLanguage('fr')" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 transition-colors font-medium cursor-pointer">
                <span class="flex items-center gap-2"><span>🇫🇷</span> <span>Français</span></span>
                <span class="text-[10px] text-gray-400 font-mono">FR</span>
              </button>
              <button type="button" onclick="setLanguage('es')" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 transition-colors font-medium cursor-pointer">
                <span class="flex items-center gap-2"><span>🇪🇸</span> <span>Español</span></span>
                <span class="text-[10px] text-gray-400 font-mono">ES</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    setLanguage(activeLangCode);

    const btn = document.getElementById('langDropdownBtn');
    const menu = document.getElementById('langDropdownMenu');
    const chevron = document.getElementById('langDropdownChevron');

    if (btn && menu && !btn.dataset.langListenerAttached) {
      btn.dataset.langListenerAttached = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = menu.classList.contains('hidden');
        if (isHidden) {
          menu.classList.remove('hidden');
          btn.setAttribute('aria-expanded', 'true');
          if (chevron) chevron.classList.add('rotate-180');
        } else {
          menu.classList.add('hidden');
          btn.setAttribute('aria-expanded', 'false');
          if (chevron) chevron.classList.remove('rotate-180');
        }
      });

      document.addEventListener('click', (e) => {
        if (!menu.contains(e.target) && !btn.contains(e.target)) {
          menu.classList.add('hidden');
          btn.setAttribute('aria-expanded', 'false');
          if (chevron) chevron.classList.remove('rotate-180');
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          menu.classList.add('hidden');
          btn.setAttribute('aria-expanded', 'false');
          if (chevron) chevron.classList.remove('rotate-180');
        }
      });
    }

    applyCurrencyToDOM(activeCode);

    // Unified GA4 Funnel, Ecommerce, Lead & Bot/Internal Filter Engine (Covers /order, /, /pricing, /tools/*, and all pSEO pages)
    try {
      const GA_ID = 'G-7D28EEMNXX';
      window.dataLayer = window.dataLayer || [];
      window.gtag =
        window.gtag ||
        function () {
          window.dataLayer.push(arguments);
        };

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

      if (typeof window.sweeprTrack !== 'function') {
        window.sweeprTrack = function (eventName, params) {
          try {
            if (window['ga-disable-' + GA_ID]) return;
            window.gtag(
              'event',
              eventName,
              Object.assign(
                {
                  page_path: window.location.pathname,
                  page_title: document.title
                },
                params || {}
              )
            );
          } catch (e) {}
        };
      }

      const path = window.location.pathname;

      // 1. Checkout Page (/order) Funnel & Ecommerce Instrumentation
      if (path === '/order' || path === '/checkout') {
        const activePricing = window.SWEEPR_ACTIVE_PRICING || getComputedPricing(activeCode);
        const resolveOrderPlanAndValue = () => {
          const currPlan = typeof selectedPlan === 'string' ? selectedPlan : sp.get('plan') || 'annual';
          const introActive =
            (typeof isDiscountApplied === 'boolean' && isDiscountApplied) ||
            sp.get('offer') === 'intro' ||
            sp.get('discount') === '1';
          const addonActive =
            typeof isWifiRadarAddonSelected === 'boolean'
              ? isWifiRadarAddonSelected
              : Boolean(document.getElementById('wifiRadarCheckbox')?.checked);
          const baseVal =
            currPlan === 'annual'
              ? activePricing.annual
              : currPlan === 'six_month'
              ? activePricing.sixMonth
              : introActive
              ? activePricing.introFirstMonth
              : activePricing.monthly;
          const addonVal = addonActive
            ? currPlan === 'annual'
              ? activePricing.addonAnnual
              : currPlan === 'six_month'
              ? activePricing.addonSixMonth
              : activePricing.addonMonthly
            : 0;
          const totalVal = Number((baseVal + addonVal).toFixed(2));
          const items = [
            {
              item_id: `sweepr_vpn_${currPlan}${introActive && currPlan === 'monthly' ? '_intro' : ''}`,
              item_name: `SWEEPR VPN Pro (${currPlan})`,
              price: baseVal,
              quantity: 1
            }
          ];
          if (addonActive) {
            items.push({
              item_id: `sweepr_wifi_radar_${currPlan}`,
              item_name: 'SWEEPR Wi-Fi Radar & Smart-TV Shield',
              price: addonVal,
              quantity: 1
            });
          }
          return { plan: currPlan, value: totalVal, currency: activePricing.code || 'GBP', addonActive, items };
        };

        // Fire `begin_checkout` once initial plan state is settled
        setTimeout(() => {
          const state = resolveOrderPlanAndValue();
          window.sweeprTrack('begin_checkout', {
            currency: state.currency,
            value: state.value,
            plan: state.plan,
            wifi_radar_addon: state.addonActive,
            items: state.items
          });
        }, 250);

        // Plan Tab Selection -> `select_item`
        ['planTabAnnual', 'planTabSixMonth', 'planTabMonthly'].forEach((tabId) => {
          const tabEl = document.getElementById(tabId);
          if (tabEl) {
            tabEl.addEventListener('click', () => {
              setTimeout(() => {
                const state = resolveOrderPlanAndValue();
                window.sweeprTrack('select_item', {
                  currency: state.currency,
                  value: state.value,
                  plan: state.plan,
                  items: state.items
                });
              }, 50);
            });
          }
        });

        // Add-on Toggle -> `addon_toggled`
        const bumpCard = document.getElementById('wifiRadarBumpCard');
        if (bumpCard) {
          bumpCard.addEventListener('click', () => {
            setTimeout(() => {
              const state = resolveOrderPlanAndValue();
              window.sweeprTrack('addon_toggled', {
                addon_id: 'wifi_radar',
                enabled: state.addonActive,
                plan: state.plan,
                value: state.value,
                currency: state.currency
              });
            }, 50);
          });
        }

        // Email Lead Capture -> `generate_lead`
        const emailEl = document.getElementById('email');
        if (emailEl) {
          let leadTracked = false;
          const onLeadCheck = () => {
            const val = (emailEl.value || '').trim();
            if (!leadTracked && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
              leadTracked = true;
              const state = resolveOrderPlanAndValue();
              window.sweeprTrack('generate_lead', {
                currency: state.currency,
                value: state.value,
                plan: state.plan,
                lead_source: 'order_checkout_email'
              });
            }
          };
          emailEl.addEventListener('blur', onLeadCheck);
          emailEl.addEventListener('change', onLeadCheck);
        }

        // Payment Initiation -> `add_payment_info`
        const trackPaymentAttempt = (paymentType) => {
          const state = resolveOrderPlanAndValue();
          window.sweeprTrack('add_payment_info', {
            currency: state.currency,
            value: state.value,
            payment_type: paymentType,
            plan: state.plan,
            items: state.items
          });
        };

        document.getElementById('orderForm')?.addEventListener('submit', () => trackPaymentAttempt('card'));
        document.getElementById('paypalBtn')?.addEventListener('click', () => trackPaymentAttempt('paypal'));
        document.getElementById('expressGPayBtn')?.addEventListener('click', () => trackPaymentAttempt('google_pay'));
        document.getElementById('expressApplePayBtn')?.addEventListener('click', () => trackPaymentAttempt('apple_pay'));
      }

      // 2. Interactive Diagnostic Tools (/tools/leak-test & /tools/isp-throttling-test)
      if (path === '/tools/leak-test' || path === '/leak-test.html') {
        setTimeout(() => {
          window.sweeprTrack('leak_test_completed', {
            tool: 'ip_dns_webrtc_leak_test'
          });
        }, 3500);
      } else if (path === '/tools/isp-throttling-test' || path === '/isp-throttling-test.html') {
        setTimeout(() => {
          window.sweeprTrack('throttling_test_completed', {
            tool: 'isp_throttling_test'
          });
        }, 4500);
      }

      // 3. Diagnostic Embed Badge Copy Button Tracking
      const copyBadgeBtn = document.getElementById('sweepr-copy-badge-btn');
      if (copyBadgeBtn) {
        copyBadgeBtn.addEventListener('click', () => {
          window.sweeprTrack('diagnostic_badge_copied', {
            source_page: path
          });
        });
      }
    } catch (e) {}
  });
})();
