// Shared Interactive Engine for the 5 Pre vs. Post Ergonomic Mockups
(function () {
  const OPTIONS = {
    1: {
      num: 1,
      title: "Option 1: Fitts's Law Zero-Travel Command Hub",
      laws: ["Fitts's Law (D → 0px)", "Single-Focus Hierarchy", "1-Click Connect"],
      sub: "Eliminates the 480px horizontal mouse chasm between the left Country List and right Connect Panel on Desktop; merges server selection and 1-click connection into a single unified command column; reduces Website Hero from 3 competing CTAs to 1 OS-aware button.",
      metrics: {
        desktop: {
          pre: ["D = 480px mouse travel", "2 clicks to switch & connect", "2 duplicate Mini-Window buttons"],
          post: ["D = 0px (1-click row connect)", "1 unified focal column", "44×44px minimum targets"]
        },
        mobile: {
          pre: ["Full tab switch to pick country", "Top hamburger duplicates bottom nav", "38×38px top buttons (<44px)"],
          post: ["Inline thumb-zone country drawer", "Zero top hamburger clutter", "100% ≥48×48px thumb targets"]
        },
        web: {
          pre: ["3 competing Hero CTAs (Hick's n=3)", "Mock card 'Enable Now' goes to /order", "22 top navbar + dropdown links"],
          post: ["1 Primary OS Download CTA", "Interactive hero previews real app", "4 top-level navbar items"]
        }
      },
      diagnostics: {
        desktop: {
          pre: [
            "❌ <strong>Fitts's Chasm (480px):</strong> Clicking 'United Kingdom' in the center list requires moving the cursor 480px right to click 'Connect' in the dark panel.",
            "❌ <strong>Split Attention:</strong> Left column ('Select a Location') and Right panel ('Connect to stay private') fight for primary eye tracking.",
            "❌ <strong>Duplicate Controls:</strong> 'Mini window' button appears both in the bottom-left rail and top-right of the green panel."
          ],
          post: [
            "✅ <strong>Zero-Travel Connect:</strong> Hero status card sits directly above the top 3 countries; clicking any country row connects immediately in 1 click.",
            "✅ <strong>38% Narrower Window Footprint:</strong> Fits comfortably on laptop screens without covering the user's browser.",
            "✅ <strong>Single Mini-Mode Pill:</strong> Consolidated into one top-right window control."
          ]
        },
        mobile: {
          pre: [
            "❌ <strong>Tab Bounce Effort:</strong> Tapping 'Change Location' switches to Tab 2 ('Countries'), then auto-bounces back to Tab 1.",
            "❌ <strong>Redundant Hamburger Drawer:</strong> Top-left menu opens a list of the exact same 4 tabs already in the bottom bar."
          ],
          post: [
            "✅ <strong>Thumb-Zone Country Pill Strip:</strong> Top 3 countries (UK, USA, SE) sit right below the Power Orb for 1-tap switching without leaving Home.",
            "✅ <strong>Removed Top Hamburger:</strong> Clean header with 48px theme toggle."
          ]
        },
        web: {
          pre: [
            "❌ <strong>3 Competing Hero CTAs:</strong> 'Free Download', 'Get Pro Now', and 'Try 1st month for £1.99' force visitors to choose before trying.",
            "❌ <strong>Misleading Card CTA:</strong> 'Enable Now' on the right server card looks like an app toggle but redirects to Checkout."
          ],
          post: [
            "✅ <strong>Single High-Width Primary CTA:</strong> One 56px tall 'Download Free for Windows' button + quiet 'Or get Pro from £1.99 ›' sub-link.",
            "✅ <strong>Honest Interactive Preview:</strong> Clicking a country in the preview card shows live latency and downloads the pre-configured installer."
          ]
        }
      }
    },
    2: {
      num: 2,
      title: "Option 2: Taste-Skill & Unslop Tactile Hardware",
      laws: ["Taste-Skill (Zero Emoji Icons)", "Unslop (Zero Pill Soup)", "Inline Slide Drawer"],
      sub: "Applies leonxlnx/taste-skill and theclaymethod/unslop: strips all emoji icons (📡, 🛏️, 📉, 📷, ✏️, 🌙), removes nested card-in-card borders and badge clutter, and replaces 2-button Wi-Fi device rows with clean 1-click expandable hardware rows.",
      metrics: {
        desktop: {
          pre: ["7 emojis used as UI icons", "3 pills/buttons per Wi-Fi row", "Duplicate 'Airbnb Scan' buttons"],
          post: ["100% crisp SVG iconography", "1 status indicator per row", "Click row → inline action drawer"]
        },
        mobile: {
          pre: ["Emoji-heavy buttons (📡, 📷, 🔔, 📄)", "5 stacked bordered cards on Shields tab", "Hidden 'Tunnel' button with no affordance"],
          post: ["Pure SVG tactile controls", "Flat typographic hierarchy", "Explicit segmented Stealth toggle"]
        },
        web: {
          pre: ["Repetitive '14-day guarantee' micro-copy", "Slanted rotated card + pulsing badges", "Formulaic AI marketing subheads"],
          post: ["Editorial Figma/Linear-grade grid", "Equal left/right structural alignment", "Crisp factual copy (Unslop validated)"]
        }
      },
      diagnostics: {
        desktop: {
          pre: [
            "❌ <strong>ui-ux-pro-max 'no-emoji-icons' Violation:</strong> Uses 📡, 🛏️, 📉, 📷, ✏️, 🌙 emojis inside buttons and tabs instead of vector icons.",
            "❌ <strong>Row Badge Collision Risk:</strong> Each Wi-Fi device row crams 'Translated from Chip' badge + '✏️ Rename' + '🌙 Bedtime Pause' side by side.",
            "❌ <strong>Duplicate Airbnb Trigger:</strong> '📷 Airbnb Camera Scan' is both a top-right button AND the 4th tab directly below it."
          ],
          post: [
            "✅ <strong>Clean Single-Line Device Rows:</strong> Each row shows only Device Icon + Plain-English Name + IP + 1 Status Dot. Clicking any row slides open its Rename / Bedtime Pause drawer.",
            "✅ <strong>SVG-Only Segmented Bar:</strong> 3 clean tabs ('Devices', 'Bedtime Schedule', 'ISP Speed Log') with vector icons."
          ]
        },
        mobile: {
          pre: [
            "❌ <strong>Emoji Clutter on Mobile Shields:</strong> 8 different emojis (📡, 📷, 🔔, 🚨, 🎮, 🔌, 📄, ⚡) create visual noise.",
            "❌ <strong>Hidden Affordance:</strong> 'Tunnel: 10 Gbps WG' looks like static text but is secretly a button for Stealth 443 mode."
          ],
          post: [
            "✅ <strong>Tactile Hardware Switches:</strong> Clean iOS/Android native-style switches and vector icons.",
            "✅ <strong>Explicit Protocol Selector:</strong> Visible 2-way pill ('WireGuard 10G' | 'Stealth 443') on the Home card."
          ]
        },
        web: {
          pre: [
            "❌ <strong>Unslop Structure Flag:</strong> Hero badge, subhead, trust strip, and card footer repeat '10 Gbps', 'Plain-English Wi-Fi', and '14-day guarantee' multiple times.",
            "❌ <strong>Visual Gimmicks:</strong> Rotated card (`rotate-1`) and multiple glowing blurs distract from product proof."
          ],
          post: [
            "✅ <strong>Taste-Skill Software Layout:</strong> Equal left/right margins, unrotated real product UI frame, and zero repeated filler claims."
          ]
        }
      }
    },
    3: {
      num: 3,
      title: "Option 3: Hick's Law Progressive Disclosure (≤ 3 Choices)",
      laws: ["Hick's Law (n ≤ 3 per view)", "Progressive Disclosure", "2-Step Checkout"],
      sub: "Reduces simultaneous choices (n) on every screen to at most 3: collapses Desktop Wi-Fi's 19 competing controls into a 3-card summary, groups 8 countries behind a 'Fastest Automatic' default, and turns the 14-control /order page into a 2-step progressive flow.",
      metrics: {
        desktop: {
          pre: ["n = 19 simultaneous Wi-Fi controls", "8 countries + 3 tabs + search visible", "Right VPN panel always takes 40% width"],
          post: ["n = 3 choices per view", "Auto-Fastest default + expandable list", "Full-width active workspace"]
        },
        mobile: {
          pre: ["1,350px scrolling Shields tab (14 buttons)", "All 5 diagnostic tools open at once", "4 bottom tabs + 5 drawer items"],
          post: ["Single-screen 3-Card Shields summary", "Tap card to open focused sheet", "3 bottom tabs (VPN, Wi-Fi, Account)"]
        },
        web: {
          pre: ["n = 14 simultaneous controls on /order", "11 sequential clicks/inputs to buy", "2 separate legal checkboxes"],
          post: ["Step 1: Plan → Step 2: 1-Click Pay", "4 interactions total (-63% effort)", "Single combined terms acknowledgment"]
        }
      },
      diagnostics: {
        desktop: {
          pre: [
            "❌ <strong>Hick's Law Overload (n = 19 on Wi-Fi Tab):</strong> 2 top scan buttons + 4 mode tabs + 1 master toggle + 8 row buttons + 3 ISP inputs + 1 bottom strip button all fight for attention.",
            "❌ <strong>Idle Right Panel on Secondary Tabs:</strong> When viewing Wi-Fi or Account, the huge green VPN panel stays on screen taking 410px of horizontal space."
          ],
          post: [
            "✅ <strong>≤ 3 Choices Rule:</strong> Wi-Fi tab shows 1 Network Health Header + 3 Action Cards ('4 Devices Connected', 'Kids Bedtime Pause', 'ISP Refund Proof'). Click any card to drill in.",
            "✅ <strong>Compact Top Status Pill on Secondary Tabs:</strong> Hides the giant right VPN panel when on Wi-Fi/Account, replacing it with a 1-click '● Protected (UK · 8ms)' top bar pill."
          ]
        },
        mobile: {
          pre: [
            "❌ <strong>1,350px Scroll Wall on Mobile Shields:</strong> Users must scroll past 5 stacked cards (Wi-Fi Guard, ISP Refund, Kill Switch, ACR Rules, Leak Test) to find basic settings."
          ],
          post: [
            "✅ <strong>Zero-Scroll 3-Row Hub:</strong> Mobile Shields fits on 1 screen with 3 progressive disclosure rows that open clean bottom sheets on tap."
          ]
        },
        web: {
          pre: [
            "❌ <strong>Checkout Choice Paralysis (/order):</strong> 3 plan tabs + 1 add-on box + 3 express wallets + 3 payment method tabs + 5 card fields + 2 checkboxes visible at once."
          ],
          post: [
            "✅ <strong>Progressive 2-Step Checkout:</strong> Express Wallets (Apple Pay / Google Pay / PayPal) are front-and-center; Card fields expand smoothly only if 'Pay by Card' is clicked."
          ]
        }
      }
    },
    4: {
      num: 4,
      title: "Option 4: Bottom Thumb-Arc & Fitts's Corner-Pinned Ergonomics",
      laws: ["Thumb-Zone Arc (Mobile)", "Bottom-Pinned Action Dock", "≥ 48×48px Touch Targets"],
      sub: "Maps every primary trigger to the natural one-handed thumb arc on mobile (bottom 40% of viewport) and Fitts's Law hot-zones on desktop; moves hard-to-reach top-right 'Scan Wi-Fi' and 'Enter Key' buttons into an ergonomic bottom action dock.",
      metrics: {
        desktop: {
          pre: ["Top-right 'Scan Wi-Fi' (D = 540px)", "Top-right 'Enter license key' pill", "42×42px rail icons"],
          post: ["Bottom-pinned Action Bar (D = 90px)", "52×52px labeled rail targets", "Keyboard shortcut badges (Space / S)"]
        },
        mobile: {
          pre: ["Top-left Hamburger (640px thumb stretch)", "Top '5-Sec Wi-Fi Scan' button", "38×38px header buttons"],
          post: ["100% actions in bottom 280px thumb zone", "Sticky bottom Scan & Connect bar", "Zero top-corner reach required"]
        },
        web: {
          pre: ["Mobile CTA scrolls off screen", "Top-right mobile menu button", "Tiny 18×18px checkout checkboxes"],
          post: ["Sticky bottom Mobile Download/Try bar", "Full-width 52px tap cards", "1-Tap Express Checkout dock"]
        }
      },
      diagnostics: {
        desktop: {
          pre: [
            "❌ <strong>Top-Right Scatter:</strong> On Desktop, 'Free plan · Enter license key', '📷 Airbnb Camera Scan', and 'Scan Wi-Fi' are pinned to the top-right corner—furthest from the bottom-right Connect button.",
            "❌ <strong>No Visible Keyboard Affordance:</strong> Users don't know `Space` connects or `Ctrl+K` switches countries."
          ],
          post: [
            "✅ <strong>Unified Bottom Action Dock:</strong> Primary action for every tab ('Connect VPN', 'Scan Wi-Fi Now', 'Activate Pro') sits in the exact same bottom-center/right Fitts's hot-zone.",
            "✅ <strong>1-Key Shortcuts:</strong> Press `Space` to Connect/Disconnect or `S` to Scan Wi-Fi from anywhere."
          ]
        },
        mobile: {
          pre: [
            "❌ <strong>Top-Zone Stretch on Phone:</strong> '📡 5-Sec Wi-Fi Scan' and '📷 Scan Airbnb Cameras' are near the top of the screen, requiring two hands or grip-shifting.",
            "❌ <strong>38×38px Top Icons:</strong> Hamburger and Theme icons are below the 44×44px WCAG / Apple HIG minimum."
          ],
          post: [
            "✅ <strong>Thumb-Arc Sticky Dock:</strong> 'Scan Wi-Fi' and 'Connect Orb' are anchored in the bottom thumb zone right above the navigation bar."
          ]
        },
        web: {
          pre: [
            "❌ <strong>Lost CTA on Mobile Scroll:</strong> Once a mobile visitor scrolls past the hero, the 'Free Download' button disappears."
          ],
          post: [
            "✅ <strong>Thumb-Pinned Bottom Bar on Mobile Web:</strong> Persistent 54px bottom bar with 1-tap OS Download."
          ]
        }
      }
    },
    5: {
      num: 5,
      title: "Option 5: Adaptive Contextual Exception-First Workspace",
      laws: ["Exception-First Ergonomics", "Calm Computing", "Zero-Noise Status"],
      sub: "Instead of dumping all 8 servers, all 6 safe household devices, and all 4 tabs on the user at all times, the UI adapts to context: surfacing ONLY what needs action right now (e.g. 1 unrecognized device or an evening ISP slowdown) while grouping healthy items into a calm 1-line summary.",
      metrics: {
        desktop: {
          pre: ["Safe devices & threats look identical", "All 6+ Wi-Fi rows always expanded", "Static layout regardless of state"],
          post: ["Anomalies pinned at top with 1-click fix", "Safe devices collapsed into '5 Trusted ✓'", "Context-aware Smart Action card"]
        },
        mobile: {
          pre: ["4 tabs require manual checking", "User must hunt for unknown devices", "ISP refund buried in Tab 3 scroll"],
          post: ["Unified Home Feed surfaces alerts", "1-Tap 'Block Unknown Device' card on Home", "Calm green state when all is safe"]
        },
        web: {
          pre: ["Static generic homepage for all visitors", "Separate /pricing and /order pages", "4 separate free tool pages"],
          post: ["Live Visitor ISP & Wi-Fi Instant Audit Hero", "Inline 1-Click Plan Picker + Drawer Checkout", "Zero page-loads from Landing to Purchase"]
        }
      },
      diagnostics: {
        desktop: {
          pre: [
            "❌ <strong>Flat Priority in Device List:</strong> 'Windows Desktop (This Device)', 'Home Router', and 4 'Amazon Fire TV' rows take up 100% of the screen, pushing unknown devices or ISP speed drops below the fold.",
            "❌ <strong>Manual Hunting Across Tabs:</strong> User has to click Tab 2 ('Wi-Fi & TV') and then click sub-tab 3 ('ISP Refund Proof') to discover their evening speed dropped."
          ],
          post: [
            "✅ <strong>Exception-First Priority Queue:</strong> If an unknown device joins or ISP speed drops, it surfaces as a single 1-click action card at the top. All recognized safe devices collapse into a clean '5 Household Devices Safe ▾' accordion.",
            "✅ <strong>Smart Duplicate Grouping:</strong> Multiple identical Amazon/Echo devices group cleanly with expandable details."
          ]
        },
        mobile: {
          pre: [
            "❌ <strong>Siloed Tabs:</strong> Home tab only shows the VPN Orb; user never sees that an unknown Roku joined their Guest Wi-Fi unless they open the Shields tab."
          ],
          post: [
            "✅ <strong>Live Smart Card Under Orb:</strong> Home screen dynamically shows the single highest-value action ('1 Unknown Device on Wi-Fi — Tap to Block' or 'All 5 Wi-Fi Devices Safe ✓')."
          ]
        },
        web: {
          pre: [
            "❌ <strong>3-Page Funnel Drop-Off:</strong> Visitor clicks `/` → `/pricing` → `/order` (3 full page loads) to buy Pro."
          ],
          post: [
            "✅ <strong>Zero-Reload Slide-Over Checkout:</strong> Visitors can download free in 1 click OR open the instant slide-over Apple Pay / Card drawer right on the homepage."
          ]
        }
      }
    }
  };

  let state = {
    viewMode: "split", // 'split' | 'pre' | 'post'
    surface: "desktop", // 'desktop' | 'mobile' | 'web'
    preTab: "wifi", // 'home' | 'wifi'
    postTab: "wifi", // 'home' | 'wifi'
    connected: true,
    selectedCountry: "UK · London (8 ms)",
    expandedDevice: 0,
    safeGroupOpen: false,
    checkoutStep: 1
  };

  window.setAuditViewMode = function (m) {
    state.viewMode = m;
    renderAll();
  };
  window.setAuditSurface = function (s) {
    state.surface = s;
    renderAll();
  };
  window.setPreTab = function (t) {
    state.preTab = t;
    renderAll();
  };
  window.setPostTab = function (t) {
    state.postTab = t;
    renderAll();
  };
  window.toggleMockConnect = function (country) {
    if (country) {
      state.selectedCountry = country;
      state.connected = true;
    } else {
      state.connected = !state.connected;
    }
    renderAll();
  };
  window.toggleExpandDevice = function (idx) {
    state.expandedDevice = state.expandedDevice === idx ? -1 : idx;
    renderAll();
  };
  window.toggleSafeGroup = function () {
    state.safeGroupOpen = !state.safeGroupOpen;
    renderAll();
  };
  window.setCheckoutStep = function (step) {
    state.checkoutStep = step;
    renderAll();
  };

  function renderPreDesktop(optNum) {
    const isHome = state.preTab === "home";
    return `
      <div style="width:100%;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:800;color:#64748b">INTERACTIVE PRE-UI (Click tabs/buttons to test current friction):</span>
          <div style="display:inline-flex;gap:4px;background:#fff;padding:3px;border-radius:8px;border:1px solid #cbd5e1">
            <button onclick="setPreTab('home')" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:800;${isHome ? 'background:#0f172a;color:#fff' : 'color:#475569'}">Tab 1: VPN Home</button>
            <button onclick="setPreTab('wifi')" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:800;${!isHome ? 'background:#0f172a;color:#fff' : 'color:#475569'}">Tab 2: Wi-Fi & TV</button>
          </div>
        </div>

        <div class="mock-desktop pre-split">
          <!-- Left Rail -->
          <div class="mock-rail">
            <div class="audit-logo" style="width:28px;height:28px;font-size:13px">S</div>
            <button class="mock-rail-btn ${isHome ? 'on' : ''}" onclick="setPreTab('home')">🛡️<span>VPN</span></button>
            <button class="mock-rail-btn ${!isHome ? 'on' : ''}" onclick="setPreTab('wifi')">📶<span>Wi-Fi</span></button>
            <button class="mock-rail-btn">👤<span>Acct</span></button>
            <div style="flex:1"></div>
            <button class="mock-rail-btn" title="Duplicate Mini Window #1">🗕</button>
          </div>

          <!-- Center Column -->
          <div class="mock-main">
            ${isHome ? `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                <div>
                  <div style="font-size:16px;font-weight:900">Select a Location</div>
                  <div style="font-size:11px;color:#64748b">Choose a Country</div>
                </div>
                <span class="m-pill warn">🔑 Free plan · Enter key</span>
              </div>
              <div class="fitts-chasm">
                <span>⚠️ Step 1: Click Country here</span>
                <span>─── 480px Mouse Travel ───►</span>
              </div>
              <div class="m-row" style="background:#fffbeb;border-color:#fde68a">
                <div style="font-size:11.5px;font-weight:800;color:#92400e">📺 Samsung TV is tracking what you watch</div>
                <button class="m-btn" style="background:#059669;color:#fff;border:0">Block</button>
              </div>
              ${["🇬🇧 United Kingdom · London (8 ms)", "🇸🇪 Sweden · Stockholm (19 ms)", "🇳🇱 Netherlands · Amsterdam (12 ms)", "🇩🇪 Germany · Frankfurt (15 ms)", "🇺🇸 United States · New York (68 ms)", "🇯🇵 Japan · Tokyo (162 ms)"].map((c, i) => `
                <button class="m-row ${i === 0 ? 'active' : ''}" onclick="toggleMockConnect('${c}')">
                  <span style="font-size:12px;font-weight:800">${c}</span>
                  <span style="font-size:11px;color:#059669;font-weight:800">${i === 0 ? 'Selected' : 'Select'}</span>
                </button>
              `).join('')}
            ` : `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap">
                <div>
                  <div style="font-size:16px;font-weight:900">6 devices on Wi-Fi</div>
                  <div style="font-size:10.5px;color:#64748b">Hick's Law Overload: 19 simultaneous controls</div>
                </div>
                <div style="display:flex;gap:4px">
                  <button class="m-btn" style="border-color:#ef4444;color:#b91c1c">📷 Airbnb Camera Scan</button>
                  <button class="m-btn">Scan Wi-Fi</button>
                </div>
              </div>
              <!-- 4 Emoji Tabs -->
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                <span class="m-pill" style="background:#064e3b;color:#fff">📡 Who's on My Wi-Fi</span>
                <span class="m-pill" style="background:#e2e8f0;color:#334155">🛏️ Kids Bedtime Pause</span>
                <span class="m-pill" style="background:#e2e8f0;color:#334155">📉 ISP Refund Proof</span>
                <span class="m-pill" style="background:#fee2e2;color:#991b1b;border:1px dashed #ef4444">📷 Airbnb Camera Scan (Duplicate!)</span>
              </div>
              <!-- Master Toggle -->
              <div class="m-row" style="background:#f8fafc">
                <div style="font-size:11.5px;font-weight:800">🛡️ New Device Alerts & Smart-TV Protection <span class="m-pill">PRO</span></div>
                <span class="m-pill">ON</span>
              </div>
              <!-- Crowded Multi-Button Rows -->
              ${["Amazon Fire TV / Echo Show #1 (192.168.1.44)", "Amazon Fire TV / Echo Show #2 (192.168.1.56)", "Amazon Fire TV / Echo Show #3 (192.168.1.91)", "Windows Desktop (192.168.1.196)"].map((d) => `
                <div class="m-row" style="flex-wrap:wrap;gap:6px">
                  <div style="min-width:0;flex:1">
                    <div style="font-size:12px;font-weight:800">${d}</div>
                    <span class="m-pill" style="font-size:9px">Translated from Amazon Chip</span>
                  </div>
                  <div style="display:flex;gap:4px">
                    <button class="m-btn">✏️ Rename</button>
                    <button class="m-btn">🌙 Bedtime Pause</button>
                  </div>
                </div>
              `).join('')}
              <div class="m-row" style="background:#fef3c7;border-color:#fde68a">
                <div style="font-size:11px;font-weight:800;color:#92400e">⚠️ ISP Accountability: Evening drop to 88 Mbps</div>
                <button class="m-btn">Generate $35 Refund Script</button>
              </div>
            `}
          </div>

          <!-- Right Connect Panel (Always visible even on Wi-Fi tab!) -->
          <div class="mock-panel">
            <span style="position:absolute;top:10px;right:10px;font-size:10px;background:rgba(255,255,255,0.15);padding:3px 6px;border-radius:6px" title="Duplicate Mini Window #2">🗕 Mini #2</span>
            <div class="audit-logo" style="width:42px;height:42px;font-size:18px">S</div>
            <div style="font-size:18px;font-weight:900;line-height:1.15">${state.connected ? '<span style="color:#6ee7b7">Connected</span><br>& Protected' : '<span style="color:#6ee7b7">Connect</span><br>to stay private'}</div>
            <div style="font-size:11px;color:#a7f3d0">${state.selectedCountry}</div>
            <div style="background:rgba(0,0,0,0.25);padding:10px;border-radius:12px;width:100%">
              <div style="font-size:10px;color:#a7f3d0">Protected session</div>
              <div style="font-size:20px;font-weight:900;font-family:monospace">${state.connected ? '00:14:22' : '00:00:00'}</div>
            </div>
            <button class="m-btn-go" style="width:100%" onclick="toggleMockConnect()">
              ${state.connected ? '🛡️ Connected (Click)' : 'Connect (Step 2)'}
            </button>
            ${!isHome ? `<div style="font-size:10px;color:#fca5a5;margin-top:4px">⚠️ Takes 40% width while user is on Wi-Fi tab!</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderPostDesktop(optNum) {
    const isHome = state.postTab === "home";
    return `
      <div style="width:100%;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;font-weight:800;color:#065f46">INTERACTIVE POST-UI (Click any row or button to test):</span>
          <div style="display:inline-flex;gap:4px;background:#fff;padding:3px;border-radius:8px;border:1px solid #6ee7b7">
            <button onclick="setPostTab('home')" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:800;${isHome ? 'background:#059669;color:#fff' : 'color:#065f46'}">Tab 1: VPN Command</button>
            <button onclick="setPostTab('wifi')" style="padding:4px 9px;border-radius:6px;font-size:11px;font-weight:800;${!isHome ? 'background:#059669;color:#fff' : 'color:#065f46'}">Tab 2: Wi-Fi & TV</button>
          </div>
        </div>

        <div class="mock-desktop post-unified">
          <!-- Ergonomic 48px Labeled Rail -->
          <div class="mock-rail" style="width:62px">
            <div class="audit-logo" style="width:32px;height:32px;font-size:14px">S</div>
            <button class="mock-rail-btn ${isHome ? 'on' : ''}" style="width:48px;height:48px" onclick="setPostTab('home')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>VPN</span>
            </button>
            <button class="mock-rail-btn ${!isHome ? 'on' : ''}" style="width:48px;height:48px" onclick="setPostTab('wifi')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
              <span>Wi-Fi</span>
            </button>
            <button class="mock-rail-btn" style="width:48px;height:48px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>
              <span>Account</span>
            </button>
          </div>

          <!-- Unified Full-Width Ergonomic Workspace -->
          <div class="mock-main" style="padding:18px;gap:12px">
            <!-- Persistent 1-Line Top Status Bar (Replaces the 410px right panel on all tabs) -->
            <div style="display:flex;justify-content:space-between;align-items:center;background:#064e3b;color:#fff;padding:12px 16px;border-radius:14px">
              <div style="display:flex;align-items:center;gap:10px">
                <span style="width:10px;height:10px;border-radius:50%;background:${state.connected ? '#34d399' : '#fbbf24'};box-shadow:0 0 0 4px rgba(52,211,153,0.25)"></span>
                <div>
                  <div style="font-size:14px;font-weight:900">${state.connected ? 'Protected · ' + state.selectedCountry : 'Protection Paused'}</div>
                  <div style="font-size:11px;color:#a7f3d0">10 Gbps WireGuard · 6 Wi-Fi Devices Guarded · TV Trackers Blocked</div>
                </div>
              </div>
              <button class="m-btn-go" style="padding:9px 16px;min-height:44px;background:${state.connected ? '#10b981' : '#f59e0b'}" onclick="toggleMockConnect()">
                ${state.connected ? 'Disconnect' : 'Connect Now'}
              </button>
            </div>

            ${isHome ? `
              <div class="fitts-win">
                <span>✓ Zero Cursor Travel (D = 0px): Click any country row to connect immediately</span>
                <span>1-Click Action</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                ${[
                  { name: "United Kingdom · London", meta: "Fastest · 8 ms", flag: "🇬🇧" },
                  { name: "Sweden · Stockholm", meta: "Privacy Hub · 19 ms", flag: "🇸🇪" },
                  { name: "Netherlands · Amsterdam", meta: "10 Gbps · 12 ms", flag: "🇳🇱" },
                  { name: "United States · New York", meta: "Streaming · 68 ms", flag: "🇺🇸" }
                ].map((c) => `
                  <button class="m-row ${state.selectedCountry.includes(c.name.split(' ')[0]) ? 'active' : ''}" style="min-height:54px;padding:12px" onclick="toggleMockConnect('${c.name} (${c.meta.split('· ')[1]})')">
                    <div style="text-align:left">
                      <div style="font-size:13px;font-weight:900">${c.flag} ${c.name}</div>
                      <div style="font-size:11px;color:#64748b">${c.meta}</div>
                    </div>
                    <span class="m-pill">${state.selectedCountry.includes(c.name.split(' ')[0]) ? 'Connected ✓' : '1-Click Connect'}</span>
                  </button>
                `).join('')}
              </div>
              <details class="m-card" style="cursor:pointer">
                <summary style="font-size:12.5px;font-weight:800;color:#059669">Browse all 8 countries & Ctrl+K quick search ▾</summary>
                <div style="margin-top:8px;font-size:12px;color:#475569">Germany (15 ms), US West (112 ms), Singapore (148 ms), Japan (162 ms)</div>
              </details>
            ` : `
              ${optNum === 5 ? `
                <!-- Option 5: Exception-First Contextual Layout -->
                <div class="m-card" style="border:2px solid #f59e0b;background:#fffbeb;display:flex;justify-content:space-between;align-items:center;gap:10px">
                  <div>
                    <div style="font-size:11px;font-weight:900;color:#b45309;text-transform:uppercase">1 Action Recommended Now</div>
                    <div style="font-size:14px;font-weight:900;color:#0f172a">Evening ISP Speed Drop Detected (88 Mbps vs 500 Mbps Plan)</div>
                    <div style="font-size:11.5px;color:#78350f">Eligible for a $35 (£28) monthly bill credit from your provider.</div>
                  </div>
                  <button class="m-btn-go" style="min-height:44px;white-space:nowrap" onclick="alert('Copied verified $35 ISP Refund Script!')">Copy $35 Claim Script</button>
                </div>
              ` : `
                <div class="fitts-win">
                  <span>✓ Clean 1-Click Rows (Zero Overlapping Badges): Click any device to expand actions</span>
                  <span>n = 3 Choices</span>
                </div>
              `}

              <!-- Clean Device List with 1-Click Inline Expansion (Zero multi-button clutter) -->
              ${[
                { name: "Living Room Fire TV", ip: "192.168.1.44 · Amazon Fire OS", state: "TV Tracking Blocked ✓", kids: false },
                { name: "Bedroom Echo Show", ip: "192.168.1.56 · Amazon Smart Display", state: "Bedtime Pause Active", kids: true },
                { name: "MacBook Air (Just Joined)", ip: "192.168.1.204 · Apple macOS", state: "New on Wi-Fi", kids: false }
              ].map((d, idx) => `
                <div class="m-card" style="padding:0;overflow:hidden;border-color:${state.expandedDevice === idx ? '#059669' : '#dcece5'}">
                  <button onclick="toggleExpandDevice(${idx})" style="width:100%;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;text-align:left;min-height:52px">
                    <div>
                      <div style="font-size:13px;font-weight:900;color:#0f172a">${d.name}</div>
                      <div style="font-size:11px;color:#64748b">${d.ip}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px">
                      <span class="m-pill ${d.state.includes('New') ? 'warn' : ''}">${d.state}</span>
                      <span style="font-size:12px;color:#64748b;font-weight:900">${state.expandedDevice === idx ? '▴' : '▾'}</span>
                    </div>
                  </button>
                  ${state.expandedDevice === idx ? `
                    <div style="padding:10px 14px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;gap:8px;align-items:center;justify-content:space-between">
                      <span style="font-size:11.5px;color:#475569;font-weight:700">Device Controls:</span>
                      <div style="display:flex;gap:6px">
                        <button class="m-btn" style="min-height:38px;padding:6px 12px" onclick="alert('Rename device')">Rename Device</button>
                        <button class="m-btn" style="min-height:38px;padding:6px 12px;background:#064e3b;color:#fff;border:0" onclick="alert('Toggled Bedtime Pause')">Bedtime Pause</button>
                      </div>
                    </div>
                  ` : ''}
                </div>
              `).join('')}

              <!-- Progressive Disclosure Group for Remaining Safe Household Devices -->
              <button class="m-row" style="background:#f8fafc;min-height:44px" onclick="toggleSafeGroup()">
                <span style="font-size:12px;font-weight:800;color:#334155">✓ 3 More Trusted Household Devices (Windows PC, Home Router, Kitchen Plug)</span>
                <span style="font-size:11.5px;font-weight:800;color:#059669">${state.safeGroupOpen ? 'Hide ▴' : 'Show ▾'}</span>
              </button>
              ${state.safeGroupOpen ? `
                <div class="m-card" style="font-size:12px;color:#475569;display:flex;flex-direction:column;gap:6px">
                  <div>• <strong>Windows Desktop (This PC)</strong> — 192.168.1.196 · WireGuard Protected</div>
                  <div>• <strong>Home Wi-Fi Router</strong> — 192.168.1.1 · WPA3 Gateway</div>
                  <div>• <strong>Kitchen Smart Plug</strong> — 192.168.1.110 · Trusted IoT</div>
                </div>
              ` : ''}

              <!-- Bottom Ergonomic Action Bar -->
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:auto;padding-top:4px">
                <button class="m-btn" style="min-height:44px;flex:1" onclick="alert('Running 5-second Wi-Fi & Hidden Camera Scan...')">Re-Scan Wi-Fi & Hidden Cameras</button>
                <button class="m-btn" style="min-height:44px;flex:1;border-color:#059669;color:#065f46" onclick="alert('Copied $35 ISP Refund Script!')">ISP Speed Log ($35 Credit Ready)</button>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  function renderPreMobile() {
    return `
      <div class="mock-phone">
        <!-- Top Bar with 38px Hamburger that duplicates Bottom Nav -->
        <div class="phone-top">
          <div style="display:flex;align-items:center;gap:6px">
            <button style="width:32px;height:32px;border:1.5px dashed #ef4444;border-radius:8px;font-size:13px" title="38x38px (<44px min) & duplicates bottom bar">☰</button>
            <span style="font-weight:900;font-size:14px">SWEEPR <span style="color:#059669">VPN</span></span>
          </div>
          <span class="m-pill danger">Top Hamburger = Duplicate Nav</span>
        </div>

        <div class="phone-body">
          <div class="fitts-chasm" style="font-size:10px">
            <span>⚠️ Top-Zone Stretch (640px from thumb)</span>
          </div>
          <div class="m-card" style="padding:10px">
            <div style="font-size:14px;font-weight:900">Wi-Fi Guard Home</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">
              <button class="m-btn" style="background:#059669;color:#fff;border:0">📡 5-Sec Scan</button>
              <button class="m-btn">📷 Airbnb Scan</button>
            </div>
            <div style="margin-top:8px;display:flex;flex-direction:column;gap:5px">
              <div class="m-row" style="padding:7px">
                <span style="font-size:11px;font-weight:800">🚨 Neighbor's Roku</span>
                <button class="m-btn" style="background:#f59e0b;color:#fff;border:0">Kick Off</button>
              </div>
              <div class="m-row" style="padding:7px">
                <span style="font-size:11px;font-weight:800">🎮 Jake's PS5</span>
                <button class="m-btn">🌙 Pause</button>
              </div>
            </div>
          </div>

          <div class="m-card" style="padding:10px">
            <div style="font-size:13px;font-weight:900">ISP Speed-Drop Proof (-82%)</div>
            <button class="m-btn" style="width:100%;margin-top:6px">📄 Copy $35 Credit Script</button>
            <button class="m-btn" style="width:100%;margin-top:4px;background:#059669;color:#fff">⚡ Bypass with VPN</button>
          </div>

          <div class="m-card" style="padding:10px">
            <div style="font-size:12px;font-weight:900">Kill Switch + Auto-Shield + ACR Rules + Leak Check (Scrolls 1,350px...)</div>
          </div>
        </div>

        <div class="phone-bottom-nav">
          <button class="p-nav-btn">⚡<span>Connect</span></button>
          <button class="p-nav-btn">🌍<span>Countries</span></button>
          <button class="p-nav-btn on">🛡️<span>Shields</span></button>
          <button class="p-nav-btn">👤<span>Profile</span></button>
        </div>
      </div>
    `;
  }

  function renderPostMobile() {
    return `
      <div class="mock-phone" style="border-color:#064e3b">
        <!-- Clean Header: Zero Redundant Hamburger -->
        <div class="phone-top">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="audit-logo" style="width:26px;height:26px;font-size:12px">S</div>
            <span style="font-weight:900;font-size:14px">SWEEPR <span style="color:#059669">VPN</span></span>
          </div>
          <span class="m-pill">● Protected (UK)</span>
        </div>

        <div class="phone-body" style="justify-content:space-between">
          <!-- Top Calm Status + Exception Card -->
          <div style="display:flex;flex-direction:column;gap:8px">
            <div class="m-card" style="border:2px solid #f59e0b;background:#fffbeb">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:11px;font-weight:900;color:#b45309">1 UNKNOWN DEVICE ON WI-FI</span>
                <span class="m-pill warn">Action</span>
              </div>
              <div style="font-size:13.5px;font-weight:900;margin-top:3px">Neighbor's Roku Stick</div>
              <div style="font-size:11px;color:#78350f;margin-bottom:8px">Streaming on Guest Wi-Fi · 192.168.1.88</div>
              <button class="m-btn-go" style="width:100%;min-height:44px;background:#d97706" onclick="alert('Blocked Neighbor Roku Stick!')">Block Device (1-Tap)</button>
            </div>

            <!-- Progressive Disclosure Summary Rows (48px tall) -->
            <button class="m-row" style="min-height:48px" onclick="alert('Opens Kids Bedtime Schedule Sheet')">
              <div>
                <div style="font-size:12.5px;font-weight:900">Kids Bedtime Pause</div>
                <div style="font-size:11px;color:#64748b">Jake's PS5 paused at 10:00 PM</div>
              </div>
              <span class="m-pill">Active ›</span>
            </button>

            <button class="m-row" style="min-height:48px" onclick="alert('Copied $35 ISP Refund Claim Script!')">
              <div>
                <div style="font-size:12.5px;font-weight:900">ISP Speed Refund Proof</div>
                <div style="font-size:11px;color:#059669;font-weight:700">$35 bill credit ready to copy</div>
              </div>
              <span class="m-pill">Copy ›</span>
            </button>
          </div>

          <!-- Natural Bottom Thumb-Arc Action Dock -->
          <div style="background:#ecfdf5;border:1.5px solid #10b981;border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:6px">
            <div style="font-size:10.5px;font-weight:900;color:#065f46;text-align:center">✓ THUMB-ARC ACTION DOCK (≥48px Targets)</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <button class="m-btn-go" style="min-height:46px;font-size:12px;padding:8px" onclick="alert('Scanning Wi-Fi...')">Scan Wi-Fi (5s)</button>
              <button class="m-btn" style="min-height:46px;font-size:12px;background:#fff;border-color:#059669;color:#065f46" onclick="alert('0 Hidden Cameras Found ✓')">Camera Check</button>
            </div>
          </div>
        </div>

        <!-- 3-Tab Ergonomic Bottom Bar (Countries integrated into Home sheet) -->
        <div class="phone-bottom-nav three-tabs">
          <button class="p-nav-btn">VPN Orb</button>
          <button class="p-nav-btn on">Wi-Fi Guard</button>
          <button class="p-nav-btn">Account</button>
        </div>
      </div>
    `;
  }

  function renderPreWeb() {
    return `
      <div style="width:100%;display:flex;flex-direction:column;gap:12px">
        <!-- Pre Hero -->
        <div class="m-card" style="padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin-bottom:12px">
            <span style="font-weight:900">SWEEPR VPN</span>
            <div style="display:flex;gap:8px;font-size:11px;color:#475569;flex-wrap:wrap">
              <span>Features</span><span>Pricing</span><span>Compare & Guides ▾ (7 links)</span><span>🌐 EN ▾ (8 langs)</span><span>Login</span><span class="m-pill">Get SWEEPR VPN</span>
            </div>
          </div>
          <div class="fitts-chasm" style="margin-bottom:10px">
            <span>⚠️ 3 Competing Hero CTAs + Mock Card 'Enable Now' routes to /order</span>
          </div>
          <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:14px;align-items:center">
            <div>
              <span class="m-pill">Fast VPN • Home Wi-Fi Device Scanner • Smart-TV Privacy</span>
              <div style="font-size:22px;font-weight:900;margin:8px 0">Private Browsing.<br><span style="color:#059669">Safer Home Wi-Fi.</span></div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">
                <button class="m-btn-go" style="font-size:12px">CTA 1: Free Download →</button>
                <button class="m-btn" style="font-size:12px;padding:10px">CTA 2: Get Pro Now</button>
              </div>
              <div style="font-size:11px;margin-top:8px;color:#059669;text-decoration:underline">CTA 3: Try 1st month for £1.99</div>
            </div>
            <div class="m-card" style="background:#f8fafc;text-align:center">
              <div style="font-size:10px;font-weight:800;color:#64748b">4 COUNTRY PILLS + CTA 4</div>
              <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:6px 0">
                <span class="m-btn">🇬🇧 UK</span><span class="m-btn">🇺🇸 US</span><span class="m-btn">🇩🇪 DE</span><span class="m-btn">🇯🇵 JP</span>
              </div>
              <button class="m-btn-go" style="width:100%;font-size:11px">CTA 4: Enable Now (Goes to /order)</button>
            </div>
          </div>
        </div>

        <!-- Pre Checkout -->
        <div class="m-card" style="padding:14px;border-color:#fca5a5">
          <div style="font-size:13px;font-weight:900;color:#991b1b;margin-bottom:6px">Current /order Checkout: 14 Simultaneous Controls (11 Steps)</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-bottom:8px">
            <span class="m-btn">Annual £74.99</span><span class="m-btn">6-Mo £48.99</span><span class="m-btn">Monthly £1.99</span>
          </div>
          <div style="font-size:11px;color:#475569;display:flex;flex-direction:column;gap:4px">
            <div>+ [Checkbox] Add Wi-Fi & Smart-TV Shield (+£14.99)</div>
            <div>+ [3 Express Buttons] PayPal | Google Pay | Apple Pay</div>
            <div>+ [3 Payment Tabs] Card | Revolut Pay | Amazon Pay</div>
            <div>+ [5 Inputs] Email + Card Number + Expiry + CVC + Postcode</div>
            <div>+ [2 Separate Legal Checkboxes] Terms + Immediate Activation</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderPostWeb() {
    return `
      <div style="width:100%;display:flex;flex-direction:column;gap:12px">
        <!-- Post Hero -->
        <div class="m-card" style="padding:18px;border:2px solid #10b981">
          <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin-bottom:12px">
            <span style="font-weight:900">SWEEPR <span style="color:#059669">VPN</span></span>
            <div style="display:flex;gap:14px;font-size:12px;font-weight:700;color:#334155;align-items:center">
              <span>Features</span><span>Free Wi-Fi & Leak Check</span><span>Pricing</span>
              <button class="m-btn-go" style="padding:6px 12px;font-size:11.5px">Download Free</button>
            </div>
          </div>
          <div class="fitts-win" style="margin-bottom:10px">
            <span>✓ Single Dominant OS-Aware Primary Action (Hick's n = 1 Primary Decision)</span>
          </div>
          <div style="display:grid;grid-template-columns:1.3fr 1fr;gap:16px;align-items:center">
            <div>
              <div style="font-size:24px;font-weight:900;line-height:1.1">Private Browsing &<br><span style="color:#059669">Plain-English Wi-Fi Guard.</span></div>
              <p style="font-size:12.5px;color:#475569;margin:8px 0 12px">Encrypts your traffic, translates every device on your Wi-Fi into plain English, and proves ISP speed drops.</p>
              <button class="m-btn-go" style="width:100%;min-height:52px;font-size:14px" onclick="window.location.href='/download'">
                Free Download →
              </button>
              <div style="font-size:11.5px;color:#475569;margin-top:8px;text-align:center">
                Includes free 30-second Wi-Fi scan · <a href="/order?plan=monthly&offer=intro" style="color:#059669;font-weight:800">Or unlock 3-Device Pro from £1.99 ›</a>
              </div>
            </div>
            <div class="m-card" style="background:#064e3b;color:#fff">
              <div style="font-size:11px;color:#a7f3d0;font-weight:800">LIVE APP PREVIEW</div>
              <div style="font-size:15px;font-weight:900;margin:4px 0">● Connected · UK (8 ms)</div>
              <div style="font-size:11px;color:#d1fae5;margin-bottom:8px">✓ 4 Wi-Fi Devices Safe · ✓ 0 TV Trackers</div>
              <div style="font-size:10.5px;background:rgba(255,255,255,0.1);padding:7px;border-radius:8px">
                 Auto-detects Windows, macOS, iOS & Android
              </div>
            </div>
          </div>
        </div>

        <!-- Post Progressive 2-Step Checkout -->
        <div class="m-card" style="padding:16px;border:2px solid #6ee7b7;background:#f8fafc">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:13.5px;font-weight:900;color:#065f46">Proposed Progressive Checkout (4 Interactions Total · -63% Effort)</div>
            <div style="display:flex;gap:4px">
              <button class="m-btn ${state.checkoutStep === 1 ? 'active' : ''}" onclick="setCheckoutStep(1)">Step 1: Express Pay</button>
              <button class="m-btn ${state.checkoutStep === 2 ? 'active' : ''}" onclick="setCheckoutStep(2)">Step 2: Card Expanded</button>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">
            <div class="m-row active" style="padding:8px"><div><div style="font-size:11.5px;font-weight:900">Yearly · Save 50%</div><div style="font-size:10px;color:#059669">£6.25/mo (£74.99/yr)</div></div></div>
            <div class="m-row" style="padding:8px"><div><div style="font-size:11.5px;font-weight:900">6-Months</div><div style="font-size:10px;color:#64748b">£8.17/mo</div></div></div>
            <div class="m-row" style="padding:8px"><div><div style="font-size:11.5px;font-weight:900">1st-Mo Trial</div><div style="font-size:10px;color:#64748b">£1.99 today</div></div></div>
          </div>
          ${state.checkoutStep === 1 ? `
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
              <button class="m-btn-go" style="background:#000;min-height:44px"> Pay (1-Click)</button>
              <button class="m-btn-go" style="background:#1e293b;min-height:44px">G Pay (1-Click)</button>
              <button class="m-btn-go" style="background:#0070ba;min-height:44px">PayPal</button>
            </div>
            <button class="m-btn" style="width:100%;margin-top:8px;min-height:40px" onclick="setCheckoutStep(2)">Or pay with Credit / Debit Card › (Progressive Disclosure)</button>
          ` : `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <input placeholder="Email address" style="padding:9px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px" />
              <input placeholder="Card number · MM/YY · CVC" style="padding:9px;border-radius:8px;border:1px solid #cbd5e1;font-size:12px" />
            </div>
            <button class="m-btn-go" style="width:100%;margin-top:8px;min-height:46px">Complete Secure Order — £74.99 (14-Day Guarantee)</button>
          `}
        </div>
      </div>
    `;
  }

  function renderAll() {
    const optNum = Number(document.body.dataset.option || 1);
    const cfg = OPTIONS[optNum] || OPTIONS[1];

    // Update mode buttons
    document.querySelectorAll("[data-mode-btn]").forEach((b) => {
      b.classList.toggle("active", b.dataset.modeBtn === state.viewMode);
    });
    // Update surface buttons
    document.querySelectorAll("[data-surf-btn]").forEach((b) => {
      b.classList.toggle("active", b.dataset.surfBtn === state.surface);
    });

    const grid = document.getElementById("compareGrid");
    if (!grid) return;
    grid.className = "compare-grid mode-" + state.viewMode;

    const preMetrics = cfg.metrics[state.surface].pre.map((m) => `<span class="metric-chip">${m}</span>`).join("");
    const postMetrics = cfg.metrics[state.surface].post.map((m) => `<span class="metric-chip">${m}</span>`).join("");

    const preDiag = cfg.diagnostics[state.surface].pre.map((d) => `<div class="diag-item">${d}</div>`).join("");
    const postDiag = cfg.diagnostics[state.surface].post.map((d) => `<div class="diag-item">${d}</div>`).join("");

    let preCanvas = "";
    let postCanvas = "";
    if (state.surface === "desktop") {
      preCanvas = renderPreDesktop(optNum);
      postCanvas = renderPostDesktop(optNum);
    } else if (state.surface === "mobile") {
      preCanvas = renderPreMobile(optNum);
      postCanvas = renderPostMobile(optNum);
    } else {
      preCanvas = renderPreWeb(optNum);
      postCanvas = renderPostWeb(optNum);
    }

    grid.innerHTML = `
      <div class="col-card col-pre">
        <div class="col-head">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge-pre">PRE (CURRENT UI)</span>
            <strong style="font-size:14px;color:#7f1d1d">Ergonomic Bottlenecks Identified</strong>
          </div>
          <div class="metric-strip">${preMetrics}</div>
        </div>
        <div class="diag-list">${preDiag}</div>
        <div class="canvas-body">${preCanvas}</div>
      </div>

      <div class="col-card col-post">
        <div class="col-head">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="badge-post">POST (PROPOSED OPTION ${optNum})</span>
            <strong style="font-size:14px;color:#064e3b">Ergonomic & De-Slopped Architecture</strong>
          </div>
          <div class="metric-strip">${postMetrics}</div>
        </div>
        <div class="diag-list">${postDiag}</div>
        <div class="canvas-body">${postCanvas}</div>
      </div>
    `;
  }

  window.addEventListener("DOMContentLoaded", () => {
    const optNum = Number(document.body.dataset.option || 1);
    if (optNum === 1) state.preTab = "home", state.postTab = "home";
    renderAll();
  });
})();
