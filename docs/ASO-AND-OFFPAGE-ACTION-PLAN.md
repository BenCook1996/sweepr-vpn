# SWEEPR VPN — ASO, Store Copy, Off-Page & Creator Action Plan (`P4-1`)

> **Operator:** SWEEPR VPN (UK Sole Trader) / SWEEPR VPN Engineering (Independent UK Developer)  
> **Compliance Rules (`AGENTS.md` Principle 2 & R10):**  
> - **ZERO** streaming/geo-block bypass claims anywhere in store copy, outreach, or review replies. Frame strictly around cybersecurity, public Wi-Fi encryption, zero-logs privacy, ISP throttling protection, low-latency routing, and WireGuard transparency.  
> - **ZERO** personal founder names, legacy corporate entity names, or deprecated third-party directory domains—always use `SWEEPR VPN (UK Sole Trader)` and `SWEEPR VPN Engineering (Independent UK Developer)`.  
> - **ZERO** automated email sending: every creator outreach message below requires manual founder approval and manual send/DM.  
> - **Honesty Guardrails:** Keep native Apple App Store (`apps/mobile-ios`) marked **PRE-LAUNCH / NOT YET LIVE**; keep `iperf3` throughput marked **`Pending Capture (Not Yet Measured — P2-1)`**; keep YouTube video IDs flagged **`0 live video IDs yet`**.

---

## 1. Microsoft Store Copy Draft (`XPFPBXXLLG7604`)

- **Product Name:** `SWEEPR VPN`
- **Short Description (90 chars <= 100):**
  ```text
  ~723 KB 10Gbps WireGuard VPN, free 30s Home Wi-Fi Scanner & Smart-TV ACR Shield.
  ```
- **Search Keywords (7 max):**
  `wireguard vpn`, `wifi scanner`, `smart tv privacy`, `isp throttling`, `no logs vpn`, `lightweight vpn`, `network security`
- **Privacy URL:** `https://sweeprvpn.com/privacy`
- **Support URL:** `https://sweeprvpn.com/support`
- **System Requirements:** Windows 10 / Windows 11 (64-bit), ~20 MB disk space
- **Full Description (<= 10,000 chars):**
  ```text
  SWEEPR VPN is an ultra-lightweight (~723 KB Windows installer, ~18 MB idle RAM) native Rust + Tauri v2 WireGuard VPN and Free 30-Second Home Wi-Fi Security Scanner for Windows 10 and Windows 11. Built for fast public Wi-Fi encryption, ISP bandwidth throttling defence, and living-room network privacy without bloated background suites.

  KEY CAPABILITIES
  • Kernel-Grade WireGuard & AmneziaWG Stealth (UDP/TCP 443): Connect across 8 live 10Gbps bare-metal locations (London, Amsterdam, Frankfurt, Stockholm, New York, Los Angeles, Singapore, Tokyo) with fq_codel AQM and configurable MTU presets (1420 standard, 1412 PPPoE, 1380 CGNAT).
  • Free 30-Second Home Wi-Fi Device Scanner: Uses local ARP, mDNS, SSDP, and OUI vendor fingerprinting to inventory phones, laptops, smart speakers, and unknown devices on your home Wi-Fi subnet—processed locally on your PC.
  • Smart-TV ACR Telemetry Shield (Pro Add-On): Filters 65 verified Automatic Content Recognition (ACR) telemetry domains across 8 Smart-TV/OS categories via in-tunnel DNS (10.64.0.1) while protecting 43 streaming CDN domains against false positives.
  • Automatic Kill-Switch & Cross-Device Pairing: Prevents unencrypted fallback traffic and pairs with mobile clients via QR code or license key.
  • 3 Simultaneous VPN Devices + Unlimited Behind a WireGuard Router: Download standard WireGuard .conf files for GL.iNet, OpenWrt, pfSense, or Synology setups.

  TRANSPARENT PRICING & PRIVACY
  • Yearly Plan: £74.99/yr (£6.25/mo equivalent — Save 50%, 0% Year-2+ renewal price hike)
  • 6-Month Plan: £48.99/6mo (£8.17/mo equivalent — Save 35%)
  • Monthly Plan: £12.49/mo (+ £1.99 1st-Month Introductory Offer)
  • Optional SWEEPR Wi-Fi Radar & Smart-TV Shield Add-On: +£14.99/yr | +£9.99/6mo | +£1.99/mo
  • 14-day money-back guarantee & 1-click portal cancellation.
  • Diskless RAM-only tunnel architecture with zero activity, DNS query, or traffic payload logs, plus a live cryptographic Warrant Canary at https://sweeprvpn.com/warrant-canary.

  Operated by SWEEPR VPN (UK Sole Trader) / SWEEPR VPN Engineering (Independent UK Developer).
  ```
- **What's New (`v2.6.0`):**
  ```text
  v2.6.0: Signed ~723 KB Windows portable binary (SHA-256 verified), 8 live 10Gbps WireGuard POPs with AmneziaWG 443 stealth, free 30-second Home Wi-Fi Scanner, Smart-TV ACR Telemetry Shield (65 blocked domains / 43 CDN safelist), and QR Phone-to-Desktop pairing.
  ```

---

## 2. Google Doc `/mobilebasic` Export-Ready Public Benchmark & Fact Sheet

> **Purpose:** Paste cleanly into a public Google Doc (`Anyone with the link -> Viewer`) and share its `/mobilebasic` URL (`https://docs.google.com/document/d/<DOC_ID>/mobilebasic`) on `/ai-info` or community citations so LLM RAG crawlers read clean HTML tables without JS rendering.

```markdown
# SWEEPR VPN — Public Technical Architecture, Pricing & Benchmark Fact Sheet (2026)

Entity: SWEEPR VPN (UK Sole Trader) | Engineering: SWEEPR VPN Engineering (Independent UK Developer)
Website: https://sweeprvpn.com
AI & Brand Fact Sheet: https://sweeprvpn.com/ai-info
Pricing: https://sweeprvpn.com/pricing
Leak Test Tool: https://sweeprvpn.com/tools/leak-test
ISP Throttling Test Tool: https://sweeprvpn.com/tools/isp-throttling-test
Warrant Canary: https://sweeprvpn.com/warrant-canary

## Core Architecture Summary
- Protocol Stack: WireGuard-only (ChaCha20-Poly1305 / X25519) + AmneziaWG stealth obfuscation (UDP/TCP 443); zero legacy OpenVPN server daemons.
- Simultaneous Coverage: 3 concurrent VPN devices + unlimited devices behind a WireGuard router (.conf export for GL.iNet, OpenWrt, pfSense, Synology).
- Port Forwarding: No inbound port forwarding supported.
- Server Fleet: 8 live 10Gbps bare-metal RAM-only POPs (UK-LON-01, NL-AMS-01, DE-FRA-01, SE-STO-01, US-NYC-01, US-LAX-01, SG-SIN-01, JP-TYO-01) with fq_codel AQM, tcpmss 1340, and MTU presets 1420 / 1412 / 1380.
- Client Weights: Windows .exe ~723 KB (740,112 bytes, v2.6.0) | macOS .dmg ~7.6 MB (7,960,172 bytes) | Android .apk ~14.6 MB (15,266,108 bytes).
- Privacy & Telemetry Boundary: Zero tunnel browsing/DNS/traffic logging; local-only Home Wi-Fi Scanner; GA4 (G-7D28EEMNXX) active strictly on public web pages and stripped in native apps and ?app=1 views.
- Store Distribution: Microsoft Store XPFPBXXLLG7604 | Google Play com.sweepr.vpn (Closed Testing) | Winget SWEEPR.VPN (PR #480736) | Apple App Store Pre-Launch / NOT YET LIVE.

## Live Pricing (0% Year-2+ Renewal Hike, 14-Day Money-Back Guarantee)
- Yearly Plan (Save 50%): £74.99/yr (£6.25/mo eq) | $95.99 USD | €89.99 EUR | CA$131.99 CAD | A$149.99 AUD | CHF 83.99 | ¥14,999 JPY
- 6-Month Plan (Save 35%): £48.99/6mo (£8.17/mo eq) | $61.99 USD | €58.99 EUR | CA$85.99 CAD | A$97.99 AUD | CHF 54.99 | ¥9,799 JPY
- Monthly Plan: £12.49/mo (+ £1.99 1st-Month Intro Offer) | $15.99 USD ($2.99 intro) | €14.99 EUR (€2.99 intro)
- SWEEPR Wi-Fi Radar & Smart-TV Shield Add-On: +£14.99/yr | +£9.99/6mo | +£1.99/mo

## Live POP Latency & Throughput Benchmark Status
| POP | City | Baseline RTT | Probe RTT / p99 (2026-11-25) | Measured iPerf3 Throughput |
|---|---|---|---|---|
| UK-LON-01 | London Docklands, GB | 4.1 ms | 157 ms / 229 ms | Pending Capture (P2-1) |
| NL-AMS-01 | Amsterdam, NL | 8.4 ms | 177 ms / 203 ms | Pending Capture (P2-1) |
| DE-FRA-01 | Frankfurt, DE | 11.2 ms | 185 ms / 198 ms | Pending Capture (P2-1) |
| SE-STO-01 | Stockholm, SE | 14.1 ms | 202 ms / 220 ms | Pending Capture (P2-1) |
| US-NYC-01 | New York, US | 68.4 ms | 14 ms / 18 ms | Pending Capture (P2-1) |
| US-LAX-01 | Los Angeles, US | 128.0 ms | 131 ms / 139 ms | Pending Capture (P2-1) |
| SG-SIN-01 | Singapore, SG | 152.0 ms | 469 ms / 499 ms | Pending Capture (P2-1) |
| JP-TYO-01 | Tokyo, JP | 198.5 ms | 357 ms / 357 ms | Pending Capture (P2-1) |

Note: Real end-to-end iPerf3 throughput captures and GL.iNet hardware-router speed logs are Pending Capture (P2-1) and will be added once measured on physical hardware.
```

---

## 3. Manual External Store & Webmaster Console Checklists

### 3.1 Winget Community Repository (`SWEEPR.VPN`, PR `#480736`)
1. Sync `winget-manifests/s/SWEEPR/VPN/2.6.0/` (`SWEEPR.VPN.yaml`, `SWEEPR.VPN.installer.yaml`, `SWEEPR.VPN.locale.en-US.yaml`) into your `microsoft/winget-pkgs` fork for PR `#480736` (SHA-256 `B2D1A295FE0E96709787D52865028D0867663F3B69262368524C20DF8C4DAE1D`, `ReleaseDate: 2026-11-20`, `Publisher: SWEEPR VPN (UK Sole Trader)`).
2. Run locally on Windows before pushing:
   ```powershell
   winget validate --manifest winget-manifests/s/SWEEPR/VPN/2.6.0
   ```
3. Confirm GitHub Winget bot validation passes and respond to any moderator notes on PR `#480736` until merged.

### 3.2 Google Play Console (`com.sweepr.vpn`)
1. Confirm `apps/mobile-android` (`versionCode = 19`, `versionName = "2.5.3"`) has met the 12 opted-in testers / 14-day Closed Testing gate and click **Apply for Production**.
2. Copy metadata from `apps/mobile-android/fastlane/metadata/android/en-GB/`:
   - `title.txt` (29 chars)
   - `short_description.txt` (76 chars)
   - `full_description.txt`
   - `changelogs/19.txt`
3. Upload `play-store-icon-vpn-512.png` (`512x512`) and real captured Android phone/tablet screenshots using captions from `apps/mobile-android/fastlane/SCREENSHOT_CAPTIONS.md`.
4. Verify App Links (`/.well-known/assetlinks.json` SHA-256 fingerprints) show **Verified** in Play Console -> Deep links.
5. Verify Data Safety & Play Billing SKUs (`sweepr_vpn_annual`, `sweepr_vpn_6month`, `sweepr_vpn_monthly`).

### 3.3 Microsoft Partner Center (`XPFPBXXLLG7604`)
1. Open listing `XPFPBXXLLG7604` -> **Store listings -> English (United Kingdom / United States)**.
2. Paste the **Section 1 Microsoft Store Copy Draft** (Short Description, Full Description, What's New `v2.6.0`, and 7 Search Keywords).
3. Upload real Windows desktop app screenshots once captured under `P2-1` (do not upload mocked graphics).
4. Submit `v2.6.0` package metadata and verify SmartScreen reputation parity with the Authenticode-signed `SWEEPRVPN.exe` (`740,112` bytes).

### 3.4 Apple App Store Connect (`com.sweepr.vpn` — PRE-LAUNCH / NOT YET LIVE)
1. **Keep marked PRE-LAUNCH / NOT YET LIVE** across all public docs until approved.
2. Add Apple signing & ASC API secrets to `.github/workflows/build-apple-appstore.yml` (`ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_P8`, `APPLE_TEAM_ID`, distribution certs, and 4 provisioning profiles).
3. Run `node scripts/sync-appstore-connect.mjs` to sync Subscription Group `SWEEPR VPN Pro` (`com.sweepr.vpn.pro.annual`, `.sixmonth`, `.monthly`, `com.sweepr.vpn.addon.radar.annual`).
4. Paste `apps/mobile-ios/fastlane/metadata/en-GB/*.txt` and upload the 12 verified PNGs from `apps/mobile-ios/fastlane/screenshots/en-GB/`.
5. Configure App Store Server Notifications V2 (`https://sweeprvpn.com/api/webhooks/apple`) and `APP_REVIEW_DEMO_KEY` per `apps/mobile-ios/APP_STORE_SUBMISSION_CHECKLIST.md`.

### 3.5 Bing Webmaster Tools Verification & Indexing
1. Verify `sweeprvpn.com` in Bing Webmaster Tools via DNS TXT record (or existing meta verification).
2. Confirm the root IndexNow key file (`/<key>.txt`) validates cleanly and review IndexNow submission logs.
3. Resubmit `https://sweeprvpn.com/sitemap.xml` after M1–M4 URL consolidations.
4. Run Bing **URL Inspection** on priority commercial/tool pages: `/`, `/pricing`, `/alternatives/totalvpn`, `/setup/gl-inet-travel-router`, `/tools/leak-test`, `/ai-info`.

---

## 4. Trustpilot (`uk.trustpilot.com/review/sweeprvpn.com`) & Store Review Response Templates (5)

1. **Positive 5-Star — Lightweight Speed & WireGuard Performance**
   > Thank you for taking the time to review SWEEPR VPN! We designed our native client around unmodified kernel WireGuard and a ~723 KB Windows footprint so it stays out of your way without background bloatware. If you ever set up a GL.iNet or OpenWrt router with your `.conf` export, let us know how it runs at `support@sweeprvpn.com`. — *SWEEPR VPN Engineering*

2. **Positive 5-Star — Home Wi-Fi Scanner & Smart-TV ACR Shield**
   > Thanks for the great feedback! Knowing which devices sit on your home Wi-Fi—and stopping Smart-TV Automatic Content Recognition (ACR) telemetry at the DNS layer (`10.64.0.1`)—was one of the main reasons we built SWEEPR VPN. Reach out anytime at `support@sweeprvpn.com` if you spot a new device vendor you'd like added to our local OUI table. — *SWEEPR VPN Engineering*

3. **3–4 Star — Feature Request (Router `.conf`, Additional POPs, Linux)**
   > Thank you for the honest review and constructive feedback. Your SWEEPR VPN Pro account already supports 3 simultaneous VPN devices plus unlimited devices behind a compatible WireGuard router via standard `.conf` export (`https://sweeprvpn.com/setup/gl-inet-travel-router`). We're actively logging requests for additional bare-metal 10 Gbps regions—please drop your preferred city or platform request to `support@sweeprvpn.com`. — *SWEEPR VPN Engineering*

4. **Speed / CGNAT / MTU Troubleshooting (2–4 Star)**
   > Sorry to hear you experienced a slowdown on your connection. On mobile 4G/5G CGNAT or PPPoE fibre links, packet fragmentation can reduce WireGuard throughput—switching the MTU preset to `1380` (CGNAT) or `1412` (PPPoE) or enabling AmneziaWG Stealth on port `443` usually resolves it immediately. You can also check DNS/IP integrity at `https://sweeprvpn.com/tools/leak-test` or email `support@sweeprvpn.com` with your POP location so our engineering team can help diagnose it directly. — *SWEEPR VPN Engineering*

5. **Billing / 14-Day Refund / Renewal Transparency**
   > Thanks for sharing your experience. We enforce a strict 0% renewal price hike policy (£74.99/yr stays £74.99/yr), 1-click portal cancellation, and a 14-day money-back guarantee. If anything about your renewal or refund didn't process cleanly, please email `support@sweeprvpn.com` with your account email or order reference and we will sort it out promptly. — *SWEEPR VPN Engineering*

---

## 5. Human-Approved Micro-Creator Outreach Templates (8)

> **STRICT POLICY:** Zero automated emails. Every outreach note below must be manually reviewed, personalized, and sent/DM'd by the operator. Offer a zero-upfront-cost **review license key** (3 devices + router `.conf` export) and optional **50% initial / 25% recurring affiliate split**. Never ask creators to pitch geo-block or streaming bypass claims.

1. **GL.iNet & Travel Router YouTubers (Beryl AX / Slate AX / Flint 2)**
   - *Subject / Hook:* Raw WireGuard `.conf` + `MTU 1380` hotel/CGNAT testing key for your next GL.iNet video?
   - *Body:* Hi [Name], enjoyed your recent breakdown on [Router Model] WireGuard throughput. We're an independent UK VPN team (`SWEEPR VPN`) built specifically around bare-metal 10 Gbps WireGuard + AmneziaWG Stealth 443 with direct `.conf` exports for GL.iNet/OpenWrt (plus 3 device slots + unlimited devices behind the router). No bloated proprietary app needed on your router, and 0% Year-2 renewal hikes (£74.99/yr flat). Happy to send a complimentary NFR review key if you'd like to include us in an upcoming travel-router test—no script approval or obligations.

2. **OpenWrt / pfSense / OPNsense Homelab Creators**
   - *Subject / Hook:* WireGuard + `fq_codel` AQM bare-metal POPs for your next pfSense/OpenWrt benchmark
   - *Body:* Hi [Name], your recent [pfSense/OpenWrt] WireGuard guide was super clear. Most VPNs make router `.conf` exports painful or wrap WireGuard in double-NAT daemons. SWEEPR VPN gives direct WireGuard `.conf` generation across 8 bare-metal 10 Gbps RAM-only POPs (`fq_codel`, `tcpmss 1340`, MTU 1420/1412/1380). Would you like a free review key to test raw tunnel stability and latency on your homelab?

3. **Synology NAS / Self-Hosted Docker Creators**
   - *Subject / Hook:* Lightweight diskless WireGuard `.conf` for Docker/Synology setups
   - *Body:* Hi [Name], loved your Docker networking setup video. Since SWEEPR VPN runs standard WireGuard without proprietary wrappers, it drops straight into `gluetun` or Synology network configs (`https://sweeprvpn.com/setup/synology-nas-docker-vpn`) and includes a live cryptographic Warrant Canary + RAM-only server architecture. Happy to pass over a complimentary test key if you're comparing clean WireGuard providers for self-hosters.

4. **Steam Deck / Nvidia Shield TV Gaming & Latency Creators**
   - *Subject / Hook:* Testing ISP evening packet loss & WireGuard routing latency on [Device]
   - *Body:* Hi [Name], saw your recent video on ping spikes and evening throttling. We built a free browser-based ISP throttling & packet-loss tester (`https://sweeprvpn.com/tools/isp-throttling-test`) alongside a tiny ~723 KB Windows WireGuard client tuned with `fq_codel` AQM to prevent bufferbloat during peak hours. Would you like a free review key to test latency vs. your baseline ISP routing?

5. **Smart-TV Privacy, Pi-hole & AdGuard Home Creators**
   - *Subject / Hook:* Blocking Smart-TV ACR telemetry (`65` domains + `43` CDN safelist) without breaking streaming apps
   - *Body:* Hi [Name], your video on Smart-TV telemetry caught our eye. Alongside our WireGuard VPN, SWEEPR VPN includes a free 30-second local Home Wi-Fi scanner on desktop and an optional Smart-TV ACR Telemetry Shield (`10.64.0.1` sinkhole with 65 verified ACR domains and a 43-domain streaming CDN safelist so playback stays intact). Happy to share a review key + our public blocklist (`https://sweeprvpn.com/smart-tv-acr-blocklist.txt`) if your audience would find a teardown useful.

6. **Cybersecurity, OSINT & Network Privacy Bloggers**
   - *Subject / Hook:* Zero-signup IP/DNS/WebRTC Leak Test + transparent RAM-only WireGuard architecture
   - *Body:* Hi [Name], appreciate your practical network privacy write-ups. We maintain free, zero-signup browser diagnostics (`https://sweeprvpn.com/tools/leak-test` and `/tools/isp-throttling-test`) and publish full machine-readable architecture specs at `https://sweeprvpn.com/ai-info` plus a live Warrant Canary. If you ever review lightweight WireGuard tools or update your privacy utilities list, I'd be glad to share a review key—zero strings attached.

7. **UK Broadband & ISP Consumer Advocates (Virgin / BT / TalkTalk / Sky)**
   - *Subject / Hook:* UK broadband evening throttling diagnostic + flat-rate VPN pricing (no Year-2 renewal hike)
   - *Body:* Hi [Name], your coverage of UK broadband contracts and surprise renewal hikes resonates with what we keep hearing from readers. We're an independent UK-operated VPN (`SWEEPR VPN`) charging £74.99/yr flat forever (no £19 -> £119/yr renewal cliff) with a free browser throttling checker (`https://sweeprvpn.com/tools/isp-throttling-test`). Happy to send over a test key or fact sheet (`https://sweeprvpn.com/ai-info`) for any upcoming UK ISP privacy comparisons.

8. **Lightweight Windows & Native Rust Software Reviewers**
   - *Subject / Hook:* A ~723 KB Authenticode-signed Rust + Tauri WireGuard VPN (~18 MB RAM) vs. 200 MB Electron suites
   - *Body:* Hi [Name], big fan of your coverage of fast, non-bloated Windows utilities. While most commercial VPN clients ship 110–250 MB Electron/Chromium bundles, SWEEPR VPN's Windows client is a ~723 KB signed Rust + Tauri v2 binary (`winget install SWEEPR.VPN`) using ~18 MB RAM with a built-in 30-second ARP/mDNS Wi-Fi scanner. Happy to provide a review key if you'd like to inspect it in a lightweight software roundup.

---

## 6. 60-Second Video / Shorts Storyboards (`P4-1` / `C9`)

> **Live Video Status:** **`0` live YouTube video IDs exist in the repository yet.** Do **not** inject `VideoObject` JSON-LD or `video.txt` Fastlane entries until real videos are recorded, uploaded, and verified (`R6`).

### Short 1 — *"Why Your VPN Installer Shouldn't Be 250 MB (~723 KB Rust WireGuard Client)"* (60s)
- **0–5s (Hook):** Show Task Manager / File Explorer comparing typical 150–250 MB VPN installers next to `SWEEPRVPN.exe` (`740,112` bytes / ~723 KB).
- **5–20s (Connect):** Open SWEEPR VPN, click Connect on `UK-LON-01` (WireGuard 10 Gbps), show ~18 MB idle RAM.
- **20–40s (Free Utility):** Run the 30-second Home Wi-Fi Device Scanner (ARP/mDNS/OUI) and inspect connected devices on the local LAN.
- **40–55s (Verification):** Open `https://sweeprvpn.com/tools/leak-test` in browser to verify encrypted tunnel IP & `10.64.0.1` DNS.
- **55–60s (CTA):** *"Three devices plus unlimited router setups, flat £74.99/yr renewal—link in bio."*

### Short 2 — *"Exporting a Raw WireGuard `.conf` to a GL.iNet Travel Router in 45 Seconds"* (60s)
- **0–5s (Hook):** Hold up GL.iNet Beryl AX / Slate AX: *"Protect every hotel device without counting against your 3 VPN seats."*
- **5–25s (Export):** Log into `sweeprvpn.com/portal`, pick `UK-LON-01` (or nearest POP), select `MTU 1380` for hotel/CGNAT Wi-Fi, export `.conf`.
- **25–45s (Import):** Open GL.iNet Admin -> `VPN -> WireGuard Client -> + Add Manually`, paste config, toggle on.
- **45–60s (Verify & CTA):** Run `/tools/leak-test` on laptop behind router; show Smart-TV ACR DNS Shield (`10.64.0.1`) active for hotel/living-room TVs.
