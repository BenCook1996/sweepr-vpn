---
name: sweepr-wireguard-and-lan-radar
description: >-
  Use this skill when building or modifying the SWEEPR VPN desktop (Windows, macOS,
  Linux via Rust + Tauri v2) and mobile (iOS, Android) applications, the WireGuard
  / AmneziaWG tunnel engine, the Free Home Wi-Fi Diagnostic Scanner, or the paid
  SWEEPR Wi-Fi Radar & Smart-TV ACR Telemetry Shield add-on.
---

# SWEEPR VPN & Home Wi-Fi Radar Engineering Skill

This skill defines the technical architecture for **SWEEPR VPN** and its high-margin paid add-on, **SWEEPR Wi-Fi Radar & Smart-TV Shield**, built in memory-safe **Rust + Tauri v2** to match the <15 MB footprint and Holographic Pearl aesthetic of **SWEEPR Cleaner**.

## 1. Core Workspace & Crate Structure

```text
sweepr-vpn/
├── crates/
│   ├── sweepr-tunnel/        # WireGuard (boringtun / wireguard-nt) & AmneziaWG obfuscation
│   ├── sweepr-killswitch/    # OS firewall rules (Windows WFP, macOS pf, Linux nftables)
│   ├── sweepr-wifi-radar/    # ARP/mDNS/SSDP LAN scanner, OUI vendor lookup, router port check
│   ├── sweepr-dns-shield/    # Encrypted DoH proxy + Smart-TV ACR & ad/tracker sinkhole
│   └── sweepr-entitlements/  # Cloudflare D1 / Stripe JWT license & 16-digit token verifier
├── apps/
│   ├── desktop-tauri/        # Tauri v2 app for Windows 10/11, macOS, Linux (<14 MB installer)
│   └── mobile-clients/       # iOS (NEPacketTunnelProvider) & Android (VpnService) bindings
└── website/                  # Cloudflare Pages + Workers storefront & 1-page Stripe checkout
```

## 2. The Free Diagnostic Hook (`sweepr-wifi-radar`)

To convert cold users without requiring elevated permissions on initial launch, the **Free Diagnostic Scan** executes three parallel non-privileged probes in under 30 seconds:

1. **Local Wi-Fi Device Enumeration (`scan_lan_devices`)**:
   - Reads the OS ARP/neighbor cache (`GetIpNetTable2` on Windows, `sysctl NET_RT_FLAGS` on macOS/iOS, `/proc/net/arp` or netlink on Linux/Android) after a fast asynchronous UDP/mDNS (`_services._dns-sd._udp.local`) and SSDP (`239.255.255.250:1900`) broadcast sweep across the local `/24` subnet.
   - Resolves each MAC address prefix against an embedded IEEE OUI binary lookup table (`oui.bin`) to classify devices (*Smart TV*, *Security Camera*, *Phone*, *Router*, *PC*).
   - Marks devices with randomized/unrecognized OUI prefixes or anomalous open ports as **"Unidentified Connections"**.
2. **Router Gateway Vulnerability Check (`audit_gateway`)**:
   - Inspects the default gateway IP for exposed UPnP IGD WAN port forwards, unencrypted HTTP (`:80`) admin portals, exposed Telnet (`:23`), TR-069 CWMP (`:7547`), and DNS hijacking.
3. **ISP DNS Throttling Benchmark (`probe_isp_throttling`)**:
   - Compares lookup latency and NXDOMAIN hijacking between the system's default ISP DNS resolver and SWEEPR's encrypted DNS-over-HTTPS (DoH) / WireGuard DNS resolvers (`10.64.0.1`).

## 3. Paid Add-On: SWEEPR Wi-Fi Radar & Smart-TV Shield (`sweepr-dns-shield`)

When the user activates the **SWEEPR Wi-Fi Radar & Smart-TV Shield** add-on (`entitlement.addons.includes("wifi_radar")`):

1. **Real-Time New Device Watcher**:
   - Runs a lightweight background listener on ARP/mDNS announcements. When a never-before-seen MAC address joins the home Wi-Fi BSSID, triggers a native OS notification: *"⚠️ New Device Joined Your Wi-Fi: [Vendor/Hostname] ([IP])"*.
2. **Smart-TV ACR Screenshot Telemetry Blocker**:
   - Blocks Automatic Content Recognition (ACR) and ad-tracking endpoints at the DNS/tunnel layer without breaking Netflix, YouTube, Disney+, or Prime Video playback:
     - **LG WebOS ACR:** `lgtvcommon.com`, `ibs.lgappstv.com`, `ad.lgappstv.com`, `yumenetworks.com`
     - **Samsung Tizen ACR:** `samsungacr.com`, `samsungads.com`, `samsungcloudsolution.net`, `gpm.samsungqbe.com`
     - **Roku ACR:** `scribe.logs.roku.com`, `cooper.logs.roku.com`, `ads.roku.com`
     - **Vizio Inscape ACR:** `tvinteractive.tv`, `inscape.tv`, `cognitivetv.com`
     - **Sony / Fire TV / Google TV Telemetry:** `flingo.tv`, `device-metrics-us.amazon.com`
3. **1-Click Anti-Throttling DNS Optimizer**:
   - Routes all DNS queries through low-latency encrypted WireGuard/DoH resolvers with EDNS Client Subnet (ECS) privacy stripping so ISPs cannot throttle streaming CDNs via DNS inspection.
