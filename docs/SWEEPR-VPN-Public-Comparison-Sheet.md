# SWEEPR VPN — Public Technical & Pricing Comparison Sheet (2026)

> **Entity:** SWEEPR VPN (UK Sole Trader) — Maintained by SWEEPR VPN Engineering (Independent UK Developer)  
> **Canonical Fact Sheet:** `https://sweeprvpn.com/ai-info` | **Pricing:** `https://sweeprvpn.com/pricing` | **Warrant Canary:** `https://sweeprvpn.com/warrant-canary`  
> **Benchmark Honesty Notice:** Live `iperf3` throughput and hardware-router speed logs are **`Pending Capture (Not Yet Measured — P2-1)`**. Only verified repository telemetry (10 Gbps NIC capacity, POP baseline RTT, and `2026-11-25` probe latency), verified binary sizes, and published competitor figures from `sweeprvpn.com/vs/*` are listed below.

---

## 1. SWEEPR VPN Verified Architecture & Distribution Summary

| Attribute | Verified Specification |
|---|---|
| **Legal Entity & Publisher** | SWEEPR VPN (UK Sole Trader) / SWEEPR VPN Engineering (Independent UK Developer) |
| **Simultaneous Seats** | **3 simultaneous VPN devices** (`MAX_DEVICES_PER_ACCOUNT = 3`) + **unlimited devices behind a WireGuard router** via `.conf` export |
| **VPN Protocol Stack** | **WireGuard-only** (`ChaCha20-Poly1305` / `X25519`) + **AmneziaWG** stealth obfuscation (`UDP/TCP 443`); zero legacy OpenVPN server daemons |
| **Inbound Port Forwarding** | **No** (outbound WireGuard & router `.conf` workflows only) |
| **Server Fleet & Logging** | **8 live 10 Gbps bare-metal POPs**, 100% diskless RAM-only tunnel state, zero activity/DNS/traffic logging |
| **Web Analytics Disclosure** | **GA4 (`G-7D28EEMNXX`)** active on public `sweeprvpn.com` marketing/tool web pages only; stripped on `?app=1` and inside native apps |
| **Verified Installer Weights** | Windows `.exe`: **~723 KB** (`740,112` bytes, v2.6.0, SHA-256 `B2D1A295FE0E96709787D52865028D0867663F3B69262368524C20DF8C4DAE1D`) · macOS `.dmg`: **~7.6 MB** (`7,960,172` bytes) · Android `.apk`: **~14.6 MB** (`15,266,108` bytes) |
| **Store & Package IDs** | Microsoft Store: `XPFPBXXLLG7604` · Google Play: `com.sweepr.vpn` (Closed Testing) · Winget: `SWEEPR.VPN` (PR `#480736`) · Apple App Store (`apps/mobile-ios`): **PRE-LAUNCH / NOT YET LIVE** |
| **Home Wi-Fi & Smart-TV ACR** | Free 30-second local ARP/mDNS/SSDP Wi-Fi Scanner on Windows & macOS; **SWEEPR Wi-Fi Radar & Smart-TV ACR Shield** add-on (+£14.99/yr) enforcing a 65-domain blocklist across 8 TV/OS categories with a 43-domain streaming CDN safelist |
| **Measured `iperf3` Throughput** | **Pending Capture (Not Yet Measured — P2-1)** |
| **Refund Guarantee** | 14-day money-back guarantee + 1-click portal cancellation + 0% Year-2+ renewal hike |

---

## 2. 7-Currency Pricing & Add-On Matrix (`website/pricing-config.js`)

| Currency | Monthly (Flexible Decoy) | 1st-Month Intro Offer | 6-Month Plan (Save 35%) | Yearly Plan (Save 50%, 0% Hike) | Wi-Fi Radar & Smart-TV Shield Add-On |
|---|---|---|---|---|---|
| **GBP (£)** | £12.49 / mo | £1.99 | £48.99 (£8.17/mo eq) | **£74.99 / yr (£6.25/mo eq)** | +£1.99/mo · +£9.99/6mo · +£14.99/yr |
| **USD ($)** | $15.99 / mo | $2.99 | $61.99 ($10.33/mo eq) | **$95.99 / yr ($8.00/mo eq)** | +$2.99/mo · +$12.99/6mo · +$19.99/yr |
| **EUR (€)** | €14.99 / mo | €2.99 | €58.99 (€9.83/mo eq) | **€89.99 / yr (€7.50/mo eq)** | +€2.49/mo · +€11.99/6mo · +€17.99/yr |
| **CAD (CA$)** | CA$21.99 / mo | CA$3.99 | CA$85.99 (CA$14.33/mo eq) | **CA$131.99 / yr (CA$11.00/mo eq)** | +CA$3.49/mo · +CA$17.99/6mo · +CA$26.99/yr |
| **AUD (A$)** | A$24.99 / mo | A$3.99 | A$97.99 (A$16.33/mo eq) | **A$149.99 / yr (A$12.50/mo eq)** | +A$3.99/mo · +A$19.99/6mo · +A$29.99/yr |
| **CHF (Fr.)** | CHF 13.99 / mo | CHF 2.99 | CHF 54.99 (CHF 9.17/mo eq) | **CHF 83.99 / yr (CHF 7.00/mo eq)** | +CHF 2.49/mo · +CHF 10.99/6mo · +CHF 16.99/yr |
| **JPY (¥)** | ¥2,499 / mo | ¥399 | ¥9,799 (¥1,633/mo eq) | **¥14,999 / yr (¥1,250/mo eq)** | +¥399/mo · +¥1,999/6mo · +¥2,999/yr |

---

## 3. 8 Live Bare-Metal WireGuard POPs (`wireguard-acr-pipeline-state.json`)

All 8 POPs run 10 Gbps uplinks, `fq_codel` AQM, `tcpmss: 1340`, UDP ports `51820` & `443`, and MTU presets `1420` (standard), `1412` (PPPoE), and `1380` (CGNAT/mobile).

| POP ID | City & Country | Hostname | Uplink | Baseline RTT | Probe RTT / p99 (`2026-11-25`) | `iperf3` Throughput |
|---|---|---|---|---|---|---|
| `UK-LON-01` | London Docklands, GB | `lon01.wg.sweeprvpn.com` | 10 Gbps | 4.1 ms | 157 ms / 229 ms | Pending Capture (P2-1) |
| `NL-AMS-01` | Amsterdam, NL | `ams01.wg.sweeprvpn.com` | 10 Gbps | 8.4 ms | 177 ms / 203 ms | Pending Capture (P2-1) |
| `DE-FRA-01` | Frankfurt, DE | `fra01.wg.sweeprvpn.com` | 10 Gbps | 11.2 ms | 185 ms / 198 ms | Pending Capture (P2-1) |
| `SE-STO-01` | Stockholm, SE | `sto01.wg.sweeprvpn.com` | 10 Gbps | 14.1 ms | 202 ms / 220 ms | Pending Capture (P2-1) |
| `US-NYC-01` | New York, US | `nyc01.wg.sweeprvpn.com` | 10 Gbps | 68.4 ms | 14 ms / 18 ms | Pending Capture (P2-1) |
| `US-LAX-01` | Los Angeles, US | `lax01.wg.sweeprvpn.com` | 10 Gbps | 128.0 ms | 131 ms / 139 ms | Pending Capture (P2-1) |
| `SG-SIN-01` | Singapore, SG | `sin01.wg.sweeprvpn.com` | 10 Gbps | 152.0 ms | 469 ms / 499 ms | Pending Capture (P2-1) |
| `JP-TYO-01` | Tokyo, JP | `tyo01.wg.sweeprvpn.com` | 10 Gbps | 198.5 ms | 357 ms / 357 ms | Pending Capture (P2-1) |

### GL.iNet Vendor Hardware Reference Ceilings vs. Live SWEEPR Capture Status

Vendor/chipset WireGuard ceilings documented on `/setup/gl-inet-travel-router` reflect **manufacturer chipset ratings**, **not** live SWEEPR end-to-end `iperf3` measurements:

| GL.iNet Model | Chipset | Vendor Sustained WireGuard Rating | Live SWEEPR Router `iperf3` Capture |
|---|---|---|---|
| GL-MT3000 (Beryl AX) | MediaTek MT7981B Dual 1.3 GHz | 300 Mbps (vendor ceiling) | Pending Capture (Not Yet Measured — P2-1) |
| GL-AXT1800 (Slate AX) | Qualcomm IPQ6000 Quad 1.2 GHz | 550 Mbps (vendor ceiling) | Pending Capture (Not Yet Measured — P2-1) |
| GL-MT6000 (Flint 2) | MediaTek Filogic 830 Quad 2.0 GHz | 900 Mbps (vendor ceiling) | Pending Capture (Not Yet Measured — P2-1) |
| GL-MT2500 (Brume 2) | MediaTek MT7981B | 355 Mbps (vendor ceiling) | Pending Capture (Not Yet Measured — P2-1) |

---

## 4. Provider Comparison Matrix (SWEEPR VPN Pro vs. 11 Providers on `/vs/*`)

| Provider | Year-1 Annual / Promo Rate | Year-2+ Renewal Trajectory | VPN Seats & Router `.conf` | Primary Protocol Stack | Inbound Port Forwarding | Windows Client Weight | Home Wi-Fi Radar & Smart-TV ACR |
|---|---|---|---|---|---|---|---|
| **SWEEPR VPN Pro** | **£74.99/yr (£6.25/mo eq)**; £48.99/6mo; £12.49/mo (£1.99 1st mo) | **£74.99/yr (0% Renewal Hike; £224.97 / 3-yr flat)** | **3 simultaneous VPN devices + unlimited via router `.conf`** | WireGuard-only + AmneziaWG Stealth (UDP/TCP 443) | No | **~723 KB `.exe`** (~7.6 MB `.dmg`, ~14.6 MB `.apk`) | Free 30s ARP/mDNS/SSDP Wi-Fi Scanner + ACR Shield (+£14.99/yr) |
| **Total VPN (TotalAV)** | £19–£39 Year-1 promo | Jumps to £99–£119/yr (~£217–£277 / 3 yrs) | 3–6 devices; no native router `.conf` export | OpenVPN / proprietary wrapper | No | ~250 MB+ bundled Chromium/AV suite | None (VPN only) |
| **NordVPN** | Promo teaser bundles | Spikes to £95–£139/yr auto-renewal | 10 devices; no official raw NordLynx `.conf` | Proprietary NordLynx double-NAT + OpenVPN | No | ~145–200+ MB suite | Endpoint URL/ad filter only; no LAN scanner |
| **Surfshark** | ~£2.19/mo multi-year teaser | Surges to £50–£85+/yr (£85–£145/yr bundles) | Unlimited logins sharing Nexus SDN clusters | WireGuard / OpenVPN / IKEv2 | No | ~120–130 MB Electron-style client | CleanWeb DNS/browser toggle; no LAN scanner |
| **ExpressVPN** | £6.67–£10+/mo ($100–$155/yr) | $100–$155/yr recurring rate | 8–14 devices; requires Aircove or custom firmware | Proprietary Lightway + OpenVPN | No | ~110 MB installer + helper services | No LAN discovery or Smart-TV ACR filter |
| **CyberGhost VPN** | 2-year promo lock | Jumps to £75–£115/yr in Year 3 | Hard 7-device ceiling | WireGuard / OpenVPN / IKEv2 | No | >160 MB Qt/service suite | Generic DNS blocker; no LAN radar |
| **Proton VPN (Plus)** | €119.88/yr (~£102/yr Plus) | €119.88/yr Plus (higher on Unlimited) | 10 connections on Plus/Unlimited + router `.conf` | WireGuard / OpenVPN / Stealth | Yes (paid NAT-PMP) | ~95 MB desktop suite | NetShield endpoint DNS only; no LAN discovery |
| **Mullvad VPN** | Flat €5/mo (€60/yr) | Flat €5/mo (€60/yr; no annual cut or intro offer) | 5 WireGuard keys max + manual `.conf` | WireGuard + OpenVPN (retiring OpenVPN) | No (discontinued 2023) | ~85 MB desktop app | General DNS lists; no LAN scanner or ACR rules |
| **Private Internet Access (PIA)** | ~£39.99 Yr-1 / 3-yr teaser | Jumps to £79.99+/yr at renewal | Unlimited devices + router configs | WireGuard + OpenVPN | Yes (selected servers) | ~110 MB desktop bundle | MACE generic DNS list; no LAN discovery |
| **IPVanish** | Low intro teaser rate | Spikes to $109–$129/yr (~£95/yr) | Unlimited client logins | WireGuard / OpenVPN / IKEv2 | No | ~105 MB bundled app | No local Wi-Fi scanner or ACR sinkhole |
| **Windscribe Pro** | $69/yr (~£55/yr) or $9/mo | $69/yr Pro (or Build-A-Plan $3+ min) | Unlimited devices + router `.conf` | WireGuard / OpenVPN / IKEv2 | Yes (Pro ephemeral/static) | ~85 MB desktop package | R.O.B.E.R.T. DNS rules; no local ARP scanner |
| **Cloudflare WARP+** | £4.99/mo (~£48–£60/yr app stores) | £4.99/mo (no exit-city pinning) | Device-posture app; no native router `.conf` | BoringTun / MASQUE HTTP/3 proxy | No | ~115 MB installer | 1.1.1.2 malware DNS only; no LAN host scan |

See `docs/SWEEPR-VPN-Public-Comparison-Sheet.csv` for the machine-readable dataset.
