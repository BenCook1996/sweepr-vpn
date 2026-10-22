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

  function applyCurrencyToDOM(currencyCode) {
    const p = getComputedPricing(currencyCode);
    window.SWEEPR_ACTIVE_PRICING = p;

    document.querySelectorAll('[data-price]').forEach((el) => {
      const key = el.getAttribute('data-price');
      if (p[key] !== undefined) {
        el.textContent = p[key];
      }
    });

    const flagEl = document.getElementById('currentLangFlag');
    const codeEl = document.getElementById('currentLangCode');
    if (flagEl) flagEl.textContent = p.flag;
    if (codeEl) codeEl.textContent = p.code;

    const menu = document.getElementById('langDropdownMenu');
    const btn = document.getElementById('langDropdownBtn');
    const chevron = document.getElementById('langDropdownChevron');
    if (menu) menu.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (chevron) chevron.classList.remove('rotate-180');

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
    const activeObj = SWEEPR_PRICING[activeCode] || SWEEPR_PRICING.GBP;

    if (mount) {
      const isDarkHeader = mount.getAttribute('data-theme') === 'dark' || Boolean(mount.closest('header.bg-\\[\\#232931\\]'));
      const btnClasses = isDarkHeader
        ? 'text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer font-medium text-white transition-colors'
        : 'btn btn-ghost text-sm flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer font-medium text-gray-700 hover:text-emerald-600 transition-colors';
      const chevronColor = isDarkHeader ? 'text-gray-300' : 'text-gray-400';

      mount.innerHTML = `
        <div class="relative inline-block text-left" id="langDropdownContainer">
          <button type="button" id="langDropdownBtn" class="${btnClasses}" aria-expanded="false" aria-label="Select Currency">
            <span class="text-base" id="currentLangFlag">${activeObj.flag}</span>
            <span class="text-xs font-bold tracking-wide" id="currentLangCode">${activeObj.code}</span>
            <svg id="langDropdownChevron" class="w-3 h-3 ${chevronColor} transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </button>

          <div id="langDropdownMenu" class="hidden absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-xl border border-gray-200/90 rounded-2xl shadow-xl p-1.5 z-50 transition-all text-gray-800">
            <div class="space-y-0.5 text-xs">
              ${Object.values(SWEEPR_PRICING).map(c => `
                <button type="button" onclick="window.setSweeprCurrency('${c.code}')" class="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-emerald-50 text-gray-800 hover:text-emerald-700 transition-colors font-medium cursor-pointer">
                  <span class="flex items-center gap-2"><span>${c.flag}</span> <span>${c.name}</span></span>
                  <span class="text-[10px] text-gray-400 font-mono">${c.symbol.trim()}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      const btn = document.getElementById('langDropdownBtn');
      const menu = document.getElementById('langDropdownMenu');
      const chevron = document.getElementById('langDropdownChevron');

      if (btn && menu) {
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
    }

    applyCurrencyToDOM(activeCode);
  });
})();
