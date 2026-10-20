---
name: vpn-growth-and-cro
description: >-
  Use this skill when designing VPN sales funnels, landing page Conversion Rate
  Optimization (CRO), anchor pricing psychology, Product-Led Growth (PLG) referral
  loops, zero-upfront-cost affiliate/micro-influencer programs, and modeling
  £10/day budget + revenue reinvestment unit economics.
---

# VPN Growth Marketing, CRO & Revenue Reinvestment Skill

A £10/day (£300/month) marketing budget only turns into a £3,000–£10,000+/month growth engine if two conditions are met:
1. **High Landing Page Conversion Rate (3.5%–6.0%+)** driven by technical trust and zero-friction checkout.
2. **Immediate Upfront Cash Payback (Day-1 ROAS > 1.2x)** via multi-month/annual anchor pricing so revenue can be recycled into the ad budget within 7–14 days instead of waiting 6 months on monthly subscriptions.

## 1. Anchor & Decoy Pricing Architecture (The Reinvestment Unlock)

If a customer pays £7.99 for a 1-month plan and costs £18 in ad spend to acquire, your £10/day budget will bleed out of cash before Month 2 renewals arrive. You must structure your pricing page so **70%+ of buyers choose an upfront Annual or 2-Year plan** (detailed in [cro-and-pricing-playbook.md](./references/cro-and-pricing-playbook.md)):

- **Monthly Plan (The Decoy):** **£9.99 / month** ($12.99 USD | €11.99 EUR | CA$17.99 CAD | A$19.99 AUD | CHF 10.99 | ¥1,999 JPY)
- **6-Monthly Plan (Semi-Annual Anchor — Save 35%):** **£38.99 / 6 months** (£6.50/mo equivalent | $50.99 USD | €46.99 EUR | CA$69.99 CAD | A$77.99 AUD | CHF 42.99 | ¥7,799 JPY)
- **Yearly Plan (The Cash-Cow Default — Save 50%):** **£59.99 / year** (£5.00/mo equivalent | $77.99 USD | €71.99 EUR | CA$107.99 CAD | A$119.99 AUD | CHF 65.99 | ¥11,999 JPY)
- **1st-Month Introductory Offer (Exit-Intent / Downsell):** **£1.99 for Month 1** (renews at £9.99/mo unless cancelled in 1 click | $2.99 USD | €2.99 EUR | CA$3.99 CAD | A$3.99 AUD | CHF 2.99 | ¥399 JPY)
- **SWEEPR Wi-Fi Radar & Smart-TV Shield Add-On:** **+£14.99/yr** | **+£9.99/6mo** | **+£1.99/mo**

> **Resulting Blended Upfront Cash Collected (AOV):** **~£33.50 per new paid customer** (assuming 25% Monthly, 45% 1-Year, 30% 2-Year mix). At a £15–£22 niche CAC, every single customer generates **+£11.50 to +£18.50 in immediate net cash** above ad cost on Day 1!

## 2. High-Converting VPN Landing Page CRO Checklist

Every sales channel landing page must follow the **5-Section Technical Trust Wireframe**:

1. **Hero Section (Above the Fold)**:
   - Dynamic ISP/IP detection bar at top: *"Connected via [User ISP] • IP: [User IP] (Unencrypted) • Location: [City]"*
   - Value-driven headline matching the ad/SEO query (e.g., *"Zero-Logs 10Gbps WireGuard VPN — Built for Speed, Priced Without Renewal Traps"*).
   - Dual CTA: Primary (`Get Protected for £1.99/mo`) + Secondary (`Download Free / Run 10-Second Leak Test`).
2. **Interactive Speed & Latency Proof**:
   - Live server ping table (London, Manchester, Frankfurt, Amsterdam, New York, Zurich) showing real-time load % and WireGuard vs. OpenVPN throughput.
3. **Verifiable Privacy Architecture (Anti-Skepticism Block)**:
   - RAM-only diskless servers explanation, Warrant Canary link, open-source client/protocol details, and "Zero Email Required" anonymous account ID preview.
4. **1-Page Embedded Checkout (Eliminate Multi-Step Drop-Off)**:
   - Combine Plan Selection + Payment (Apple Pay / Google Pay / Card / Crypto) on a single screen. Never force a 5-field registration form before showing payment options.
5. **Exit-Intent Rescue Offer**:
   - If a visitor moves to close the tab on the pricing page, trigger a lightweight modal: *"Want to test your speeds first? Get a 7-Day Full-Speed Pass for £0.99 (or generate a free 24-hour WireGuard test config)."*

## 3. Zero-Upfront-CAC Viral & Affiliate Loops

Supplement the £10/day paid budget with channels that only cost money *after* a sale occurs:

1. **In-App "Give 30 Days, Get 30 Days" Referral Engine**:
   - Place a 1-click referral link inside the VPN desktop/mobile app and account dashboard. Every friend who trials or subscribes unlocks 30 days of free Pro bandwidth for both users.
2. **50% Revenue-Share Micro-Creator & Tech Blogger Affiliate Program**:
   - Recruit 50–100 micro-creators (Linux YouTubers with 2k–25k subs, homelab bloggers, Steam Deck creators, privacy Substack writers). Offer **50% commission on initial upfront sales (£17–£24 payout per annual sale) + 25% recurring**. Zero upfront risk to your £10/day budget!

## 4. Revenue Reinvestment Flywheel Protocol

Use the executable simulator script to model and govern your weekly ad budget increases based on actual net revenue collected:

```powershell
node .agents/skills/vpn-growth-and-cro/scripts/reinvestment_simulator.mjs --base-daily 10 --reinvest-rate 0.65 --months 6
```
