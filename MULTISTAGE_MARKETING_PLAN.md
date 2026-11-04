# SWEEPR VPN — Multistage Marketing, SEO & Revenue-Reinvestment Master Plan (Live Telemetry Edition — Nov 4, 2026)

> [!IMPORTANT]
> **Executive Summary — What Our Actual Live Data Tells Us (Verified November 4, 2026):**
> We audited live production data across **Stripe (`acct_1USluy0Fq96R9TfN`)**, **Google Search Console (`sc-domain:sweeprvpn.com`)**, **Bing Webmaster Tools**, **Google Analytics 4 (`G-7D28EEMNXX` / Property `559903365`)**, **Google Play Console (`com.sweepr.vpn`)**, **Reddit Ads**, **Microsoft Advertising**, **Meta Ads Manager**, and our local repository.
>
> **1. The Unvarnished Commercial Baseline:**
> - **Stripe Live Revenue (`SWEEPR VPN`):** **£0.00 gross volume, 0 active standalone subscriptions, 0 successful payments all-time** (only 4 historical test attempts on Oct 20–23: 1 failed test wallet attempt and 3 cancelled checkouts). Every engineering and marketing action must therefore be prioritized around **getting from 0 to our first 25 paying customers**, rather than building premature churn/win-back infrastructure for subscribers we do not yet have.
>
> **2. Significant Organic & App-Store Momentum Since Nov 1:**
> - **Google Search Console (`285` Impressions [+19.2% vs. Nov 1], `1` Click, `22.4` Avg. Position):** With only 15 days of active search data (Oct 19–Nov 2), SWEEPR VPN now has **13 pages ranking on Page 1 (Positions 2.5–10.6)** in the last 7 days (`147` impressions in 7d), led by a **breakout commercial-intent jump on `/alternatives/totalvpn` from Position 38.8 (Nov 1) -> Position 2.8 (last 7d)**!
> - **Google Play Console (`com.sweepr.vpn`):** Graduated from `0` testers on Nov 1 to **12 testers continuously opted in for 3 of the required 14 days**. Zero additional tester recruitment is needed — keeping those 12 testers opted in unlocks **Google Play Production on ~November 15, 2026**.
> - **Sitemap Pruned from `1,155` -> `195` High-Signal Canonical Pillars (`commit 04b3696` & `0e3475c`):** Consolidated `891` repetitive ISP × Use-Case permutations to `noindex, follow` so Google and Bing concentrate crawl equity on our **195 highest-value commercial, setup, tool, and guide URLs**.
> - **Harmful Mass-Pastebin Backlink Spam Permanently Disabled (Nov 4, 2026):** Retired the 6-hourly `telegra.ph` / `catbox.moe` / `dpaste.org` auto-posting loop (`~1,200` pastebin links/day) in [`scripts/vpn-seo-drip.mjs`](./scripts/vpn-seo-drip.mjs) so domain authority isn't penalized by Google's SpamBrain link-scheme filters. [`scripts/vpn-seo-drip.mjs`](./scripts/vpn-seo-drip.mjs) now strictly runs white-hat directory verification, `pad.xml` health checks, and Delta-Only IndexNow pinging (max 25 URLs/run).

---

## 1. Live Channel Telemetry & Baseline Scorecard (November 4, 2026)

### 1.1 Cross-Channel Baseline Summary
| Channel / Console | Live Property / ID | Previous (Nov 1, 2026) | Current Live Metrics (Nov 4, 2026) | Status & Immediate Action |
| :--- | :--- | :--- | :--- | :--- |
| **Stripe Billing** | `SWEEPR VPN` (`acct_1USluy0Fq96R9TfN`) | Not audited directly (`0` 30d orders in CRM) | • **£0.00 Gross Volume**, **0 Active Subscriptions**, **0 Successful Payments**<br>• 4 all-time test attempts (Oct 20–23: 1 Failed £89.98, 3 Cancelled) | **P0 Gate:** Run 1 real £1.99 live test checkout (`Card` / `Apple Pay`) to verify Stripe webhook -> Ed25519 JWT license -> GA4 `purchase` event end-to-end, then refund. |
| **Google Search Console** | `sc-domain:sweeprvpn.com` (data thru `11/2/26`) | • `1` Click, `239` Impr (`0.4%` CTR, Pos `22.8`)<br>• `177` Indexed / `158` Not Indexed (`1,004` in sitemap) | • **28d:** **1 Click**, **285 Impressions (+19.2%)**, **0.4% CTR**, **22.4 Avg. Pos** (`147` impr in last 7d)<br>• **13 URLs on Page 1 (Pos 2.5–10.6 in 7d)**; `/alternatives/totalvpn` jumped to **Pos 2.8 (7d)**<br>• **Enhancements (`11/3/26`):** Breadcrumbs `9 -> 10` valid, Review snippets `2 -> 3` valid, Validation `Started` on all 5 indexing buckets | Resubmit pruned **195-URL [`website/sitemap.xml`](./website/sitemap.xml)**; ship "Renewal Price Truth" comparison table on `/alternatives/totalvpn` & `/vs/*` to convert Page-1 impressions into clicks. |
| **Bing Webmaster Tools** | `https://sweeprvpn.com/` | • `0` Clicks, `0` Impr, `0` Indexed<br>• Sitemap `904` URLs (`10/29/26`), IndexNow unactivated | • **0 Clicks**, **0 Impressions**, **0 Indexed URLs**<br>• Sitemap resubmitted `11/4/26` (`Processing`, `195` canonical pillars)<br>• IndexNow **Activated** + **Top 10 URLs manually submitted (`11/4/26`)** | **DONE (`Nov 4, 2026`):** Delta-only IndexNow (max 25 URLs/run) in code + Sitemap resubmitted + IndexNow activated + 10 URLs submitted in Bing UI. |
| **Google Analytics 4 (GA4)** | `Sweepr VPN` (`p559903365` / `G-7D28EEMNXX`) | • `93` Active Users (14d), `114` Sessions, `0` Organic, `0` Key Events | • **28d:** **105 Active Users**, **129 Sessions** (`118` Direct, `11` Referral, `0` Organic), **36 Engaged (`27.9%`)**, **\$0.00 Revenue**<br>• **Key Events (`11/4/26`):** `purchase` & `begin_checkout` **toggled ON** | **DONE (`Nov 3–4, 2026`):** Full GA4 funnel events + internal/headless filter deployed (`commit 879ea87`) and `purchase` + `begin_checkout` enabled as Key Events in GA4 Admin. |
| **Google Play Console** | `com.sweepr.vpn` (`v2.4.3`, `versionCode 15`, SDK 36) | • `Closed testing`, **0 testers opted in** | • `Closed testing` (`Production: Inactive`)<br>• **12 testers opted in for 3 days continuously (Needs 11 more days -> ~Nov 15, 2026)**<br>• **Deep Links Fixed (`11/4/26`):** Added all 3 Play App Signing SHA-256 keys (`77:17:C8:...`, `CE:8C:66:...`, `9B:EF:6F:...`) to `/.well-known/assetlinks.json` | **DONE in code (`Nov 4, 2026`):** All 4 SHA-256 fingerprints now served at `/.well-known/assetlinks.json`.<br>**Next Gate:** Apply for Google Play Production on **~Nov 15, 2026**. |
| **Paid Ad Platforms** | Reddit Ads (`a2_jy81fs9ouy2u`), Microsoft Ads (`aid=187332574`), Meta Ads | Not yet launched (£10/day planned) | • **Microsoft Ads (`campaignId=525148119`):** Created `[DRAFT - PAUSED] SWEEPR VPN Exact Match` (£4/day, **Status: `Campaign paused`**, `£0.00` spend)<br>• **Reddit Ads:** Built `[DRAFT - DO NOT LAUNCH] SWEEPR VPN - Stage 1 Technical Communities` (\$6/day, unpublished on Review screen, `\$0.00` spend) | **Strict Rule Enforced: NOTHING IS LIVE.** Both campaigns are staged & paused (`£0.00` spend, no payment method charged). |

---

### 1.2 Google Search Console — Live Top Performing Pages (Verified Nov 4, 2026)
Across the last 28 days (`Oct 19–Nov 2, 2026`) and last 7 days (`Oct 27–Nov 2, 2026`), SWEEPR VPN's organic footprint has accelerated sharply into **Page 1**:

| Rank | Landing Page URL | 28d Impr | 28d Pos | 7d Impr | 7d Avg. Pos | Strategic Classification & Momentum |
| :-: | :--- | :-: | :-: | :-: | :-: | :--- |
| **1** | `/alternatives/totalvpn` | 13 | 30.7 | **8** | **2.8** | **#1 Commercial Breakout (Pos 38.8 -> Pos 2.8 in 7d!)** — High-intent competitor switcher |
| **2** | `/` (Homepage) | 2 | 2.5 | **2** | **2.5** | **Brand / Navigational Root (Pos 2.5)** |
| **3** | `/setup/nvidia-shield-tv-pro-wireguard` | 10 | 5.7 | **2** | **5.5** | **Page 1 Hardware Winner (Pos 5.5)** — Android TV / Nvidia Shield WireGuard |
| **4** | `/solutions/comcast-xfinity-broadband-smart-tv-acr-blocking` | 6 | 6.3 | **5** | **5.8** | **Page 1 US ISP × Smart-TV ACR Winner (Pos 5.8)** |
| **5** | `/solutions/eduroam-campus-wifi-remote-dev-ssh` | 6 | 6.2 | **6** | **6.2** | **Page 1 Campus SSH / Dev Winner (Pos 6.2)** |
| **6** | `/solutions/gigaclear-rural-fibre-gaming-packet-loss` | 9 | 6.8 | **2** | **6.5** | **Page 1 UK Rural Fibre CGNAT Winner (Pos 6.5)** |
| **7** | `/solutions/ee-5g-mobile-hotspot-wifi-arp-spoofing-protection` | 3 | 7.0 | **3** | **7.0** | **Page 1 UK 5G Hotspot Security Winner (Pos 7.0)** |
| **8** | `/solutions/eduroam-campus-wifi-gaming-packet-loss` | 20 | 7.1 | 0 | — | **Page 1 Campus Gaming Stealth 443 Winner (20 Impr, Pos 7.1)** |
| **9** | `/solutions/ee-5g-mobile-hotspot-voip-teams-zoom-jitter` | 3 | 8.0 | **3** | **8.0** | **Page 1 UK Mobile VoIP Jitter Winner (Pos 8.0)** |
| **10** | `/solutions/comcast-xfinity-broadband-isp-throttling` | 4 | 8.3 | **4** | **8.3** | **Page 1 US ISP Throttling Winner (Pos 8.3)** |
| **11** | `/guides/stop-roku-vizio-firetv-spying` | 5 | 8.6 | **5** | **8.6** | **Page 1 Smart-TV ACR Guide (Pos 8.6)** — Pitches +£14.99/yr Wi-Fi Radar |
| **12** | `/solutions/hotel-captive-portal-wifi-p2p-port-forwarding` | 7 | 9.7 | **1** | **6.0** | **Page 1 Travel Wi-Fi UDP 443 Winner (Pos 6.0 in 7d / 9.7 in 28d)** |
| **13** | `/solutions/rogers-ignite-canada-isp-throttling` | 5 | 10.6 | 0 | — | **Page 1 Cusp Canadian ISP Throttling (Pos 10.6)** |
| **14** | `/setup/synology-nas-docker-vpn` | 11 | 19.6 | **4** | **12.4** | **Homelab / NAS Cluster (Jumped Pos 21.0 -> 12.4 in 7d)** |
| **15** | `/guides/stop-samsung-smart-tv-acr-tracking` | **35** | **13.5** | **5** | **26.4** | **#2 Total Impression Driver (`gpm.samsungqbe.com`)** |
| **16** | `/setup/gl-inet-travel-router` | **54** | **18.2** | **12** | **16.5** | **#1 Total Impression Driver (54 Impr, climbed Pos 18.8 -> 16.5 in 7d)** |
| **17** | `/solutions/talktalk-p2p-port-forwarding` | 4 | 24.8 | 0 | — | **First Organic Click Winner (`1` Click, `25%` CTR)** |
| **18** | `/tools/leak-test` | 25 | 60.6 | 0 | — | **Core Interactive Utility (`webrtc leak check` Pos 6.0–8.0)** |

---

## 2. Completed Code & Infrastructure Fixes (Nov 1 – Nov 4, 2026)

| # | Fix / Milestone | Status | Verification Details |
| :-: | :--- | :---: | :--- |
| **1** | **GA4 Backfill & Full-Funnel Instrumentation (`G-7D28EEMNXX`)** | **DONE (`commits 2eb827a` & `879ea87`)** | Backfilled `G-7D28EEMNXX` across all pSEO templates and shipped [`website/analytics-funnel.js`](./website/analytics-funnel.js) with automatic `view_item`, `begin_checkout`, `add_payment_info`, `purchase`, `tool_completed`, and `download_click` events plus internal/headless bot traffic exclusion (`?internal=1` or `navigator.webdriver`). |
| **2** | **Sitemap Consolidation (`1,155` -> `195` Canonical Pillar URLs)** | **DONE (`commits 04b3696` & `0e3475c`)** | Pruned `891` near-duplicate Cartesian ISP × Use-Case variations from [`website/sitemap.xml`](./website/sitemap.xml) and marked them `<meta name="robots" content="noindex, follow">` so Google's crawl budget focuses on the **195 highest-value commercial, setup, guide, and tool pages**. |
| **3** | **Delta-Only IndexNow & Permanent Retirement of Pastebin Spam** | **DONE (`Nov 4, 2026`)** | Updated [`scripts/vpn-seo-drip.mjs`](./scripts/vpn-seo-drip.mjs) to permanently disable the 6-hourly `telegra.ph`, `catbox.moe`, and `dpaste.org` mass-pastebin generator (`countArg = 0` locked) and capped IndexNow broadcasts to **<= 25 newly modified canonical URLs per run** via [`website/indexing-queue.json`](./website/indexing-queue.json). |
| **4** | **iOS AASA & Android Digital Asset Links (`/.well-known/assetlinks.json`)** | **DONE (`commit 6f123d0` + `Nov 4, 2026`)** | Fixed [`website/server.mjs`](./website/server.mjs) so `/.well-known/apple-app-site-association` validates `process.env.APPLE_TEAM_ID` (`/^[A-Z0-9]{10}$/`), and updated `/.well-known/assetlinks.json` with all 4 SHA-256 fingerprints required by Google Play Console (`98:36:22:...` upload key + `77:17:C8:...`, `CE:8C:66:...`, and `9B:EF:6F:...` Play App Signing keys). |
| **5** | **Subfolder Hub Index Pages & Striking-Distance CTR Upgrades** | **DONE (`commits 2eb827a` & `f7a3875`)** | Deployed dedicated category hubs (`/solutions`, `/setup`, `/guides`, `/vs`) and upgraded `<title>`, `<meta name="description">`, and JSON-LD `FAQPage` schemas on our top GSC pages (increasing valid Breadcrumbs to `10` and Review Snippets to `3` in GSC as of `11/3/26`). |
| **6** | **GA4 Key Events, Bing IndexNow + 10 URLs, & Draft Paid Campaigns** | **DONE (`Nov 4, 2026`)** | Toggled `purchase` & `begin_checkout` ON in GA4 (`p559903365`); resubmitted `sitemap.xml` (`11/4/2026`), activated IndexNow, and submitted 10 top URLs in Bing Webmaster Tools; staged Microsoft Ads (`campaignId=525148119`, **`Campaign paused`**, `£0.00` spend) and Reddit Ads (`a2_jy81fs9ouy2u`, unpublished draft on Review screen, `\$0.00` spend). |

---

## 3. Priority-Ordered Master Action Plan (What To Do Next)

Because live Stripe revenue is currently **£0.00**, all actions are ordered strictly by **shortest path to first paid conversions and search/store visibility**:

### Priority 0 (P0): Immediate Revenue, Attribution & Deep-Link Blockers (Days 1–3)
1. **Run 1 Real End-to-End Live Checkout Verification (£1.99 Intro Offer -> Refund) — [YOUR NEXT ACTION]:**
   - **Why:** Stripe shows `0` successful payments all-time (only 4 cancelled/failed test attempts in October). Before driving paid or organic switchers to [`website/order.html`](./website/order.html), complete one real £1.99 live transaction (Card or Apple Pay) to verify in production:
     - Stripe `checkout.session.completed` webhook delivery to [`website/server.mjs`](./website/server.mjs)
     - Ed25519 offline license JWT issuance & 6-digit OTP portal login ([`website/login.html`](./website/login.html))
     - Server-side & client-side GA4 `purchase` Key Event recording in Property `559903365`
   - Refund the £1.99 test transaction immediately after verification.
2. **Mark `purchase` and `begin_checkout` as Key Events in GA4 Admin (`p559903365`) — [COMPLETED NOV 4, 2026]:**
   - Verified and confirmed toggled **ON** in `Admin -> Data display -> Events -> Key events`.
3. **Fix Google Play Console's "2 Deep Links May Be Failing" Warning (`/.well-known/assetlinks.json`) — [COMPLETED NOV 4, 2026]:**
   - Extracted the 3 Google Play App Signing SHA-256 certificate fingerprints (`77:17:C8:...`, `CE:8C:66:...`, `9B:EF:6F:...`) from Play Console and added them alongside the upload key (`98:36:22:...`) in `/.well-known/assetlinks.json` in [`website/server.mjs`](./website/server.mjs#L2673-L2690).
4. **Activate Bing Webmaster Tools IndexNow + Resubmit Pruned 195-URL Sitemap — [COMPLETED NOV 4, 2026]:**
   - Clicked **"Get Started"** on IndexNow in Bing Webmaster Tools, resubmitted `https://sweeprvpn.com/sitemap.xml` (`11/4/2026 Submitted`), and manually submitted the top 10 high-priority URLs (`10` submitted today, `90` quota remaining).

### Priority 1 (P1): Capture Immediate Organic Commercial & Utility Conversions (Days 4–14)
5. **Ship Campaign 1 ("Renewal Price Truth") on `/alternatives/totalvpn` (Pos 2.8!) & Top 20 `/vs/*` Pages:**
   - **Why:** `/alternatives/totalvpn` surged to **Position 2.8 in Google Search over the last 7 days**. Adding a **dated, sourced Renewal Price Comparison Table** (Competitor Intro vs. Year-2 Renewal Hike vs. SWEEPR's flat £74.99/yr / £1.99 1st-Month Trial) + an interactive **Renewal Price Calculator (`/tools/vpn-renewal-price-checker`)** gives Page-1 commercial searchers an immediate reason to click and convert.
6. **Ship Campaign 3 ("What's on My Wi-Fi?" & Smart-TV ACR Domain Checker) + Tool-Result Offer Bridge (Automation A3):**
   - **Why:** `/guides/stop-samsung-smart-tv-acr-tracking` (`35` impr), `/guides/stop-roku-vizio-firetv-spying` (`Pos 8.6`), `/solutions/comcast-xfinity-broadband-smart-tv-acr-blocking` (`Pos 5.8`), and `/tools/leak-test` (`25` impr) are already ranking.
   - Add dynamic **Tool-Result Conversion Cards** right inside `/tools/leak-test` and `/tools/isp-throttling-test` that tailor the CTA to the user's live test result (e.g., detected WebRTC/IPv6 exposure or evening jitter -> *"Fix this on your connection in 60 seconds — £1.99 1st-Month Trial or £74.99/yr"*).
7. **Graduate Android (`com.sweepr.vpn`) from Closed Testing to Google Play Production (~Nov 15, 2026):**
   - Keep the **12 active testers** opted in through **Day 14 (~Nov 15, 2026)**, click **"Apply for production"** in Play Console, and title the public Play Store listing *"SWEEPR: Wi-Fi Scanner & WireGuard VPN"* to capture high-authority store search rankings (`Inpages Strategy S8`).
8. **Submit High-Authority Third-Party Software Directory Listings (`Inpages Strategy S8`):**
   - Submit SWEEPR VPN to **AlternativeTo**, **SaaSHub**, **SourceForge**, **Softpedia** (using our live [`website/pad.xml`](./website/pad.xml)), and **Microsoft Store / Flathub** to replace artificial pastebin links with permanent DR 70–90 software directory backlinks and referral traffic.

### Priority 2 (P2): Pre-Built Draft Paid Campaigns & In-App PLG Paywall (Days 15–30)
9. **Review & Approve Pre-Built DRAFT Paid Campaigns (£10/day = £6 Reddit + £4 Microsoft/Bing/DDG — Currently PAUSED):**
   - All campaign structures, exact-match keywords, negative keyword lists, and ad copy below are configured as **STRICTLY DRAFT / PAUSED (`£0.00` spend)** until P0/P1 are complete and you explicitly switch them on.
10. **Deploy Automation A4 (In-App "Moment of Proof" Contextual Paywall) & Ecosystem Cross-Promo:**
    - Trigger an in-app upgrade card inside the Windows/macOS/Android free Wi-Fi scanner immediately when a scan detects Smart-TV ACR telemetry domains (`gpm.samsungqbe.com`) or unknown LAN devices, plus cross-promote SWEEPR VPN on the post-purchase screens of **SWEEPR Cleaner** and **SWEEPR DeepBlock**.
11. **Deploy Automation A1 (Intent-Gap Content Router) & Automation A2 (Striking-Distance CTR Auto-Tuner):**
    - Connect `GSC_SERVICE_ACCOUNT_JSON` to the Railway CRM so [`scripts/daily-50-seo-pages.mjs`](./scripts/daily-50-seo-pages.mjs) only generates net-new Commercial/Transactional gap pages (`<= 10/day`) and automatically tests `<title>` / `<meta>` CTR improvements on pages ranking Positions 3–15.

### Priority 3 (P3): Post-Traction Retention, Creator Affiliates & Localization (Days 31–90, After First 25+ Paid Subscribers)
12. **Deploy Automation A5 (Churn Shield: Pre-Renewal Reminder, Dunning & Cancel Save Flow):**
    - Implement once the first cohort of £1.99 Intro and Annual subscribers is active in Stripe.
13. **Launch Automation A7 (Human-Approved Micro-Creator Affiliate Prospecting — 50% Initial / 25% Recurring):**
    - Target 5k–30k subscriber YouTube/homelab creators ranking for `gl inet wireguard`, `steamos wireguard`, `nvidia shield wireguard`, and `samsung tv acr tracking`. (**Strictly 0 automated emails**; founder-approved outreach only.)
14. **Launch Campaign 2 ("Safe on Any Network" Localized Clusters in `DE`, `PT-BR`, `SV`):**
    - Translate only the **top 12 proven GSC pages + `/tools/leak-test`** with proper `hreflang` tags once English conversion rate is proven.

---

## 4. Draft Paid Campaign Specifications (Saved as DRAFT / PAUSED — Nothing Live)

> [!CAUTION]
> **Strict Non-Spend Guarantee:** Per your instruction, **no campaign below is permitted to go live or spend money**. Any setup in Reddit Ads (`ads.reddit.com`) or Microsoft Advertising (`ui.ads.microsoft.com`) is saved strictly in **DRAFT / PAUSED** status with zero active billing delivery.

### 4.1 Reddit Ads Draft Campaign (£6.00/day Planned Budget — `STATUS: DRAFT / PAUSED`)
- **Account:** `Cleanersweepr` (`ads.reddit.com`) — Dedicated Campaign: `SWEEPR_VPN_Stage1_Technical_Communities_DRAFT`
- **Objective:** Traffic / Conversions (`£6.00/day` cap, CPC bid cap `£0.45`, Desktop + Mobile)
- **Geographies:** United Kingdom, United States, Canada, Germany (our top 4 GSC impression geographies)
- **Ad Group 1 — Travel Router & Homelab WireGuard (`r/glinet`, `r/HomeNetworking`, `r/selfhosted`, `r/Synology`):**
  - **Headline:** `Native WireGuard + Stealth UDP 443 configs for GL.iNet, OpenWrt & Synology NAS — copy-paste .conf export included`
  - **Body:** `Most consumer VPNs lock you into bloated 400MB desktop clients and hide raw WireGuard keys. SWEEPR VPN (~3.7MB native app) lets you export standard WireGuard .conf files for GL.iNet (Beryl AX / Slate AX), OpenWrt, and Docker/Synology in one click, plus Stealth UDP/TCP 443 for strict hotel & campus firewalls. Try Month 1 for £1.99 ($2.99) or lock in flat £74.99/yr pricing with zero Year-2 renewal price hikes.`
  - **Destination URL:** `https://sweeprvpn.com/setup/gl-inet-travel-router?utm_source=reddit&utm_medium=cpc&utm_campaign=stage1_glinet_homelab&utm_content=conf_export_v1`
- **Ad Group 2 — Smart-TV ACR Telemetry & Home Wi-Fi Scanner (`r/privacy`, `r/SmartTV`, `r/Bravia`, `r/OLED_Gaming`):**
  - **Headline:** `Why is your Samsung or LG Smart TV pinging gpm.samsungqbe.com every 15 seconds? Free 30-second Home Wi-Fi & ACR Scanner`
  - **Body:** `Modern Smart TVs use Automatic Content Recognition (ACR) to fingerprint what is on your screen and phone home to ad servers. Use SWEEPR's free 30-second Home Wi-Fi Diagnostic Scanner or copy our open DNS blocklist to silence Samsung, LG, Sony, and Roku telemetry domains across your network.`
  - **Destination URL:** `https://sweeprvpn.com/guides/stop-samsung-smart-tv-acr-tracking?utm_source=reddit&utm_medium=cpc&utm_campaign=stage1_smarttv_acr&utm_content=acr_scanner_v1`
- **Ad Group 3 — Competitor Renewal-Hike Switchers (`r/VPN`, `r/SteamDeck`, `r/ShieldAndroidTV`):**
  - **Headline:** `Tired of VPN subscriptions jumping 250% in Year 2? See our transparent WireGuard benchmark & flat renewal table`
  - **Destination URL:** `https://sweeprvpn.com/alternatives/totalvpn?utm_source=reddit&utm_medium=cpc&utm_campaign=stage1_renewal_truth&utm_content=switcher_table_v1`

### 4.2 Microsoft Advertising (Bing + DuckDuckGo + Copilot) Draft Campaign (£4.00/day Planned Budget — `STATUS: DRAFT / PAUSED`)
- **Campaign Name:** `SWEEPR_VPN_Stage1_ExactMatch_UK_CA_DE_DRAFT`
- **Networks:** Bing Search + DuckDuckGo Search Syndication (Disable Audience Network content placements to protect micro-budget)
- **Bidding & Budget:** `£4.00/day` (`Manual CPC`, max CPC `£0.65`)
- **Exact-Match Keywords (Mapped 1-to-1 to GSC Page-1 Winners):**
  - **Ad Group A (Competitor Switcher — Pos 2.8 in GSC):** `[totalvpn alternative]`, `[total vpn renewal price]`, `[cancel totalvpn subscription]`, `[vpn without renewal price increase]` -> `https://sweeprvpn.com/alternatives/totalvpn?utm_source=bing&utm_medium=cpc&utm_campaign=stage1_exact_uk&utm_term=totalvpn_alternative`
  - **Ad Group B (Hardware WireGuard — Pos 5.5–16.5 in GSC):** `[gl inet wireguard setup]`, `[nvidia shield wireguard vpn]`, `[steamos wireguard vpn]`, `[eduroam wireguard vpn]` -> `https://sweeprvpn.com/setup/gl-inet-travel-router?utm_source=bing&utm_medium=cpc&utm_campaign=stage1_exact_uk&utm_term=gl_inet_wireguard`
  - **Ad Group C (Smart-TV ACR & Leak Check — Pos 5.8–13.5 in GSC):** `[stop samsung smart tv acr tracking]`, `[block gpm.samsungqbe.com]`, `[webrtc leak check]`, `[isp throttling test uk]` -> `https://sweeprvpn.com/guides/stop-samsung-smart-tv-acr-tracking?utm_source=bing&utm_medium=cpc&utm_campaign=stage1_exact_uk&utm_term=samsung_acr`
- **Mandatory Negative Keywords:** `free forever`, `cracked`, `mod apk`, `torrents`, `unblock netflix`, `bbc iplayer abroad`, `pirate bay`, `login`, `customer service number`.

---

## 5. The Updated Automation Operating System (Post-Spam Retirement)

| Brand | # | Automation Display Name | Schedule (`Europe/London`) | Updated Output & White-Hat Scope (As of Nov 4, 2026) |
| :--- | :-: | :--- | :--- | :--- |
| **SWEEPR VPN** (`sweeprvpn.com`) | **1** | **SWEEPR VPN — 1. Daily Programmatic SEO & Pillar Optimizer** | Daily at `06:00` (`0 6 * * *`) | Maintains the **195 high-signal canonical pillar URLs** in [`website/sitemap.xml`](./website/sitemap.xml) (`noindex, follow` on thin ISP permutations) and refreshes commercial/setup guides ([`scripts/daily-50-seo-pages.mjs`](./scripts/daily-50-seo-pages.mjs)) |
| **SWEEPR VPN** (`sweeprvpn.com`) | **2** | **SWEEPR VPN — 2. 6-Hourly Directory Sync & Delta IndexNow** | Every 6h at `:00` (`0 */6 * * *`) | **Pastebin spam permanently disabled (`countArg = 0`).** Runs verified software directory sync, [`website/pad.xml`](./website/pad.xml) health checks, and **Delta-Only IndexNow (`<= 25` modified URLs/run)** ([`scripts/vpn-seo-drip.mjs`](./scripts/vpn-seo-drip.mjs)) |
| **SWEEPR VPN** (`sweeprvpn.com`) | **3** | **SWEEPR VPN — 3. Weekly White-Hat Security Audit & Auto-Remediation** | Saturdays at `08:00` (`0 8 * * 6`) | Red-team audits & patches `website`, `desktop-client`, `apps`, `crates`, and `sweepr_crm` ([`SECURITY_AUDIT_LOG.md`](./SECURITY_AUDIT_LOG.md)) |
| **SWEEPR VPN** (`sweeprvpn.com`) | **4** | **SWEEPR VPN — 4. Daily Technical SEO & PageSpeed Audit** | Daily at `04:45` (`45 4 * * *`) | Non-visual 100/100 Crawlability, Technical SEO, GA4 tag enforcement & CWV auto-optimizer ([`TECHNICAL_SEO_AUDIT_LOG.md`](./TECHNICAL_SEO_AUDIT_LOG.md)) |
| **SWEEPR VPN** (`com.sweepr.vpn`) | **5** | **Hourly Google Play Compliance & Production Readiness Check** | Hourly at `:00` (`0 * * * *`) | Monitors `com.sweepr.vpn` (`12` testers at `3/14` days -> **Nov 15, 2026 Production unlock**) |

---

## 6. 6-Month Data-Calibrated Financial & Traffic Projection (Updated Nov 4, 2026)

Grounded in our verified **Nov 4, 2026 baseline** (`195` canonical pillar URLs in `sitemap.xml`, `177` Google indexed pages, `285` GSC impressions with `13` Page-1 URLs, `12` Android testers at `3/14` days, and `£0.00` live Stripe revenue prior to paid launch):

| Month | Starting Daily Ad Budget | Monthly Ad Spend | Canonical Indexed Pillars (Google + Bing) | Monthly Organic Clicks (GSC + Bing) | Monthly Paid Clicks | Total New Paid Orders (Paid + Organic + PLG) | Gross Cash Collected (Blended ~£36 AOV) | Net Profit Retained (After 65% Reinvestment) |
| :--- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| **Baseline (Nov 4, 2026)** | £0/day *(Drafts Ready)* | £0 | **177 Google / 0 Bing** (`195` pillar sitemap) | **1** (`285` imps, `13` Page-1 URLs) | 0 | **0 standalone** (`2` cross-brand bundle) | £0 standalone (£75 bundle ARR) | — |
| **Month 1 (Stage 1 — Post P0/P1 & Play Prod)** | **£10.00/day** | **£300** | **180+ Google / 150+ Bing** (of `195` pillars) | **60–120** (`4,000+` imps) | **650** | **18–25** | **£680 – £900** | **+£85 – £165** |
| **Month 2 (Stage 2)** | **£24.50/day** | **£735** | **280+ Google / 240+ Bing** (expanded Commercial/Tools) | **350–520** (`16,000+` imps) | **1,550** | **52–68** | **£1,870 – £2,450** | **+£235 – £385** |
| **Month 3 (Stage 3 — ChatGPT Ads Unlocked)** | **£54.00/day** | **£1,620** | **450+ Google / 400+ Bing** (with Localized DE/PT/SV) | **1,400–1,900** (`50,000+` imps) | **3,100** | **125–155** | **£4,500 – £5,580** | **+£615 – £895** |
| **Month 4 (Stage 4 — Cold Meta Video Unlocked)** | **£108.00/day** | **£3,240** | **700+ Google / 650+ Bing** | **2,900–3,800** (`105,000+` imps) | **6,200** | **260–320** | **£9,360 – £11,520** | **+£1,320 – £1,880** |
| **Month 5 (Stage 4 Scale)** | **£210.00/day** | **£6,300** | **1,000+ High-Intent Pillars** | **4,600–6,000** (`160,000+` imps) | **11,800** | **510–620** | **£18,360 – £22,320** | **+£2,615 – £3,650** |
| **Month 6 (Stage 4 Maturity)** | **£395.00/day** | **£11,850** | **1,400+ High-Intent Pillars** | **7,000–9,500** (`240,000+` imps) | **21,500** | **960–1,180** | **£34,560 – £42,480** | **+£4,920 – £6,980** |
