---
name: vpn-digital-advertising
description: >-
  Use this skill when designing, auditing, or scaling paid digital advertising
  campaigns for a VPN product (especially on a £10/day micro-budget and scaling
  via revenue reinvestment), including Reddit Ads, Privacy Ad Networks
  (Brave/DuckDuckGo), Alternative Ad Networks (RichAds/Adcash), Exact-Match
  Google Ads, ad platform policy compliance, and UTM governance.
---

# VPN Digital Advertising & Paid Acquisition Skill

Running profitable paid ads for a VPN starting at **£10/day (£300/month)** requires strict budget discipline, channel arbitrage, and ironclad ad-policy compliance. Competing on broad Google Search auctions (*"Best VPN"* at £12–£20/click) will exhaust £10 in a single non-converting click.

## 1. Platform Policy Compliance & Anti-Ban Protocol

Ad platforms (Google Ads, Reddit Ads, Microsoft Ads, Meta) routinely suspend VPN ad accounts under **"Circumventing Systems"**, **"Dishonest Behavior"**, or **"Copyright Infringement"** if ads imply bypassing geo-restrictions or pirating content.

1. **FORBIDDEN Angles in Ad Copy & Landing Pages**:
   - Never mention: *"Unblock Netflix/BBC iPlayer"*, *"Bypass geo-blocks"*, *"Hide torrenting/piracy"*, *"Evade government bans"*, *"Untraceable hacking"*.
2. **APPROVED High-Converting Angles**:
   - **Angle A (Network Performance & ISP Peering):** *"Stop peak-hour ISP throttling & packet loss with direct WireGuard routing."*
   - **Angle B (Developer / Technical Transparency):** *"We built a zero-bloat, RAM-only WireGuard VPN with native `.conf` exports and no renewal price hikes."*
   - **Angle C (Public Wi-Fi & Remote Work Security):** *"Encrypt public Wi-Fi, airport, and campus connections with ChaCha20-Poly1305 encryption."*
3. **Landing Page Pre-Flight Requirements**:
   - Must display visible links in the footer to: **Privacy Policy**, **Terms of Service**, **Acceptable Use Policy (explicitly prohibiting illegal use)**, **Refund Policy**, and **Company Contact Details**.

## 2. Micro-Budget Channel Allocation (£10/Day Base Spend)

Do not fragment £10/day across 5 ad platforms simultaneously. Concentrate spend into high-intent, low-CPC channels according to your current stage (see [ad-policy-and-copy-swipefile.md](./references/ad-policy-and-copy-swipefile.md) for exact ad copy templates):

### Channel Tier 1: Reddit Ads (Niche Subreddit & Keyword Targeting)
- **Target CPC:** £0.25 – £0.65 (15–35 targeted clicks/day on £7–£10/day)
- **Placement:** Feed Conversation & Promoted Text Posts (Desktop + Mobile)
- **Targeting:** `r/privacy`, `r/selfhosted`, `r/homelab`, `r/linux`, `r/SteamDeck`, `r/digitalnomad`, `r/glinet`, `r/HomeNetworking`
- **Critical Rule:** **Leave comments ENABLED** on your promoted post. Pin a technical FAQ comment from the founder account explaining your server specs, RAM-only architecture, and warrant canary. Redditors convert at 3–5x higher rates when the founder answers technical questions in the thread.

### Channel Tier 2: Bing / Microsoft Advertising (Bing Search + DuckDuckGo Syndication + Copilot) & Warm Meta Retargeting
1. **Bing / Microsoft Advertising (`ads.microsoft.com` — Viable from Stage 1 at £3/day+)**:
   - **Minimum Daily Budget:** £1–£5/day (zero high floor).
   - **The 3-in-1 Arbitrage Advantage:** A single Exact-Match Microsoft Advertising search campaign automatically serves on:
     1. **DuckDuckGo Search** (via Microsoft's exclusive DuckDuckGo search syndication partnership — reaching high-intent privacy buyers at **£0.35–£0.95 CPC**).
     2. **Windows 10/11 Desktop Bing & Edge Search** (ideal for converting `SWEEPRVPN.exe` ~3.7 MB desktop installer downloads).
     3. **Microsoft Copilot Conversational Ads** (Windows 11 / Edge / Bing Copilot).
   - **Structure:** Bid strictly on **Exact Match** (`[keyword]`) problem-aware and technical terms (`[virgin media evening throttling vpn]`, `[gl inet wireguard vpn]`, `[block smart tv acr tracking]`, `[detect unknown devices on wifi]`). Load 100+ negative keywords (`free`, `cracked`, `mod apk`, `torrents`, `nordvpn login`).
2. **Meta Ads (Facebook / Instagram / Threads — Warm CAPI Retargeting in Stage 1–2, Cold Scale in Stage 4)**:
   - **Policy Compliance ("Personal Attributes" Trap):** Never use second-person fear/accusatory phrasing on Meta (e.g., *"Are hackers spying on your Wi-Fi?"* or *"Your IP is exposed"* triggers automated rejections). Always use benefit-led utility framing: *"Scan all 20+ connected devices on your home Wi-Fi in 30 seconds and eliminate evening ISP throttling."*
   - **Stage 1–2 (£2–£4.50/day — Warm Retargeting Only via Server-Side CAPI):** Because privacy buyers block client-side browser pixels, feed checkout/tool events via **Meta Conversions API (CAPI)** and retarget visitors who ran `/tools/leak-test` or `/tools/isp-throttling-test` with the **£1.99 1st-Month Intro Offer** or **£74.99/yr (Save 50%) Yearly Plan**.
   - **Stage 4 (£30–£50+/day — Cold Broad Video/Reels):** Do NOT run cold conversion campaigns on Meta below £25/day (Meta's *Andromeda* algorithm requires ~50 conversions/week or 5x–10x CPA to exit the learning phase). Unlock cold Meta video ads demonstrating the **30-Second Home Wi-Fi Scanner & Smart-TV ACR Blocker** in Stage 4 once reinvested daily budget exceeds £115/day.

### Channel Tier 3: Alternative & Privacy Ad Networks (Scale Stage £25–£100+/Day)
- **Privacy Search Ads (DuckDuckGo via Microsoft Ads / Kagi / Brave Ads):** Zero tracking, hyper-aligned privacy buyer demographic.
- **Push & In-Page Push Ads (RichAds / Adcash / PropellerAds):** Ultra-low CPC (£0.03–£0.12) when driving traffic directly to your **Interactive IP/DNS Leak Test Pre-Lander** ("Warning: Your IP [IP] is visible — Test your connection now").
- **Micro-Sponsorships:** Pool 3–5 days of reinvested profits (£50–£150) to sponsor niche Linux/cybersecurity newsletters or 5k–30k subscriber YouTube tech channels with a dedicated affiliate code.

### Channel Tier 4: AI Assistant & Answer Engine Advertising (ChatGPT Ads, Microsoft Copilot & Claude GEO)
1. **OpenAI ChatGPT Ads (`ads.openai.com` — OpenAI Ads Manager)**:
   - **Availability & Placement:** Self-serve platform showing clearly labeled sponsored units beneath ChatGPT responses for adult users on ChatGPT Free & Go tiers across the UK, US, EU, Canada, and APAC.
   - **Minimum Budget & Economics:** $0 account minimum, but enforces a **$25 USD/day (~£20/day) minimum daily campaign budget**, with second-price auction CPCs of **$2.50–$4.00 (~£1.95–£3.15)** and CPMs of **$16–$60**.
   - **Stage Gate:** **Do NOT run during Stage 1 (£10/day budget)** because of the $25/day campaign floor. Activate in **Stage 3 (Days 61–90, when reinvested daily budget reaches ~£58/day)** by allocating **£20/day ($25 USD/day)** to conversational intent contexts (*"how to fix Virgin Media / BT evening throttling"*, *"how to set up WireGuard on GL.iNet / OpenWrt"*, *"how to stop Samsung / LG Smart TV ACR tracking"*, *"how to scan home Wi-Fi for unknown devices"*).
2. **Anthropic Claude (`claude.ai`) — Strictly Ad-Free (Win via Zero-Cost GEO Only)**:
   - **Policy Reality:** Anthropic has **no paid advertising platform**. Under its formal *"Claude is a space to think"* policy (and 2026 *"Ads are for AI, but not Claude"* campaign), Claude rejects all sponsored links and paid product placements.
   - **How to Capture Claude Traffic:** Capture Claude recommendations at **£0 ad cost** via **Generative Engine Optimization (GEO)**: maintain `website/llms.txt`, allow `ClaudeBot` / `anthropic-ai` in `robots.txt` and `server.mjs`, publish daily structured comparison tables (`/vs/*`) and technical ISP/router guides (`/solutions/*`, `/setup/*`), and build third-party directory citations (`SaaSHub`, `telegra.ph`, `dpaste.org`).
3. **Microsoft Copilot Ads (via Microsoft Advertising)**:
   - **Availability & Economics:** Native conversational ad placements inside Bing Copilot, Windows 11 Copilot, and Edge sidebar are served automatically from **Microsoft Advertising** search/multimedia campaigns with **no $25/day minimum** (viable from **£3–£10/day** in Stage 1–2 at **£0.45–£1.20 CPC**).

## 3. Verification & Ad Compliance Tooling

Always validate ad creatives and generate standardized UTM parameters before launching any campaign:

```powershell
node .agents/skills/vpn-digital-advertising/scripts/ad_compliance_and_utm.mjs --check "Stop ISP peak-hour throttling with zero-logs WireGuard routing. Try 30 days risk-free." --source reddit --medium cpc --campaign uk_isp_throttling_q4
```
