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

### Channel Tier 2: Retargeting & High-Intent Problem Search (Microsoft / Google Exact Match)
- **Target CPC:** £0.35 – £0.85
- **Structure:** Only bid on **Exact Match** (`[keyword]`) problem-aware or technical niche terms (e.g., `[wireguard vpn with port forwarding]`, `[gl inet wireguard vpn provider]`, `[stop virgin media throttling vpn]`) plus **Remarketing** to visitors who ran your free IP/DNS Leak Test tool.
- **Negative Keywords:** Load 100+ negative keywords on Day 1 (`free`, `cracked`, `mod apk`, `torrents`, `school chromebook`, `opera`, `proton`, `nordvpn login`).

### Channel Tier 3: Alternative & Privacy Ad Networks (Scale Stage £25–£100+/Day)
- **Privacy Search Ads (DuckDuckGo via Microsoft Ads / Kagi / Brave Ads):** Zero tracking, hyper-aligned privacy buyer demographic.
- **Push & In-Page Push Ads (RichAds / Adcash / PropellerAds):** Ultra-low CPC (£0.03–£0.12) when driving traffic directly to your **Interactive IP/DNS Leak Test Pre-Lander** ("Warning: Your IP [IP] is visible — Test your connection now").
- **Micro-Sponsorships:** Pool 3–5 days of reinvested profits (£50–£150) to sponsor niche Linux/cybersecurity newsletters or 5k–30k subscriber YouTube tech channels with a dedicated affiliate code.

## 3. Verification & Ad Compliance Tooling

Always validate ad creatives and generate standardized UTM parameters before launching any campaign:

```powershell
node .agents/skills/vpn-digital-advertising/scripts/ad_compliance_and_utm.mjs --check "Stop ISP peak-hour throttling with zero-logs WireGuard routing. Try 30 days risk-free." --source reddit --medium cpc --campaign uk_isp_throttling_q4
```
