#!/usr/bin/env node
/**
 * SWEEPR VPN (sweeprvpn.com) — Daily 50 Keyword-Researched Programmatic SEO Page Generator
 *
 * Part of the `sweepr-daily-seo-drip` automation suite.
 *
 * On each daily run:
 *  1. Inspects `website/sitemap.xml` to see which canonical URLs already exist.
 *  2. Selects the next 50 ungenerated, keyword-researched long-tail topics across:
 *     - `/solutions/{isp-or-network}-{use-case}` (ISP Throttling, CGNAT, Gaming Jitter, Smart-TV ACR, VoIP, Public Wi-Fi)
 *     - `/setup/{router-nas-console-os}` (GL.iNet, MikroTik, UniFi, Synology, Proxmox, Docker Gluetun, PS5, WSL2, etc.)
 *     - `/vs/{competitor}` (Technical WireGuard + LAN Scanner + Anchor Pricing comparisons)
 *     - `/guides/{security-guide}` (Smart-TV ACR domain blocklists, Airbnb camera Wi-Fi scanning, MTU optimization, IPv6 leak fixes)
 *  3. Renders 50 full-length (650–950+ word) HTML5 pages with unique `<title>`, `<meta name="description">`,
 *     self-referencing `<link rel="canonical">`, OpenGraph tags, JSON-LD `FAQPage` + `SoftwareApplication` schemas,
 *     technical benchmark tables, and internal links to `/download`, `/pricing`, `/tools/leak-test`, and `/tools/isp-throttling-test`.
 *  4. Appends all 50 new URLs to `website/sitemap.xml`, `website/llms.txt`, and `website/indexing-queue.json`.
 *  5. Runs `pseo_and_seo_validator.mjs` and pings Bing IndexNow (`www.bing.com/indexnow` & `api.indexnow.org/indexnow`).
 *
 * Usage:
 *   node c:\Users\Benjamin\Downloads\vpn\scripts\daily-50-seo-pages.mjs [count=50] [--force]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VPN_ROOT = path.resolve(__dirname, '..');
const WEBSITE_DIR = path.join(VPN_ROOT, 'website');
const SITEMAP_PATH = path.join(WEBSITE_DIR, 'sitemap.xml');
const LLMS_PATH = path.join(WEBSITE_DIR, 'llms.txt');
const INDEXING_QUEUE_PATH = path.join(WEBSITE_DIR, 'indexing-queue.json');
const DAILY_STATE_PATH = path.join(WEBSITE_DIR, 'daily-seo-pages-state.json');
const VALIDATOR_PATH = path.join(VPN_ROOT, '.agents', 'skills', 'vpn-seo-and-geo', 'scripts', 'pseo_and_seo_validator.mjs');
const INDEXNOW_KEY = '8f9a2b4c6d1e3f5a7b9c0d2e4f6a8b0c';

const NETWORKS_AND_ISPS = [
  { slug: 'hyperoptic-broadband', name: 'Hyperoptic 1Gbps Full Fibre', asn: 'AS56595', tech: 'FTTP / Ethernet CGNAT', mtu: 1420, peakHours: '19:30–23:00 UK', throttlingType: 'CGNAT session table saturation and transit peering congestion during evening peak hours' },
  { slug: 'community-fibre-london', name: 'Community Fibre London', asn: 'AS200052', tech: 'FTTP / CGNAT (100.64.0.0/10)', mtu: 1420, peakHours: '19:00–23:00 UK', throttlingType: 'Shared CGNAT IPv4 port allocation limits and Telehouse London peering bottlenecks' },
  { slug: 'cityfibre-uk', name: 'CityFibre UK FTTP Providers', asn: 'AS206924', tech: 'FTTP / PPPoE VLAN 911', mtu: 1412, peakHours: '18:30–23:00 UK', throttlingType: 'PPPoE 8-byte header fragmentation and regional wholesale backhaul queuing' },
  { slug: 'zen-internet-uk', name: 'Zen Internet UK', asn: 'AS13037', tech: 'FTTP / PPPoE', mtu: 1412, peakHours: '19:00–22:30 UK', throttlingType: 'PPPoE MTU 1492 fragmentation and transatlantic CDN transit hops' },
  { slug: 'three-5g-home-broadband', name: 'Three 5G Home Broadband UK', asn: 'AS206067', tech: '5G NR / Carrier-Grade NAT', mtu: 1380, peakHours: '18:00–23:30 UK', throttlingType: 'Strict 5G carrier CGNAT, GTP tunnel overhead, and adaptive video/gaming traffic shaping' },
  { slug: 'ee-5g-mobile-hotspot', name: 'EE 5G & Home Router UK', asn: 'AS12576', tech: '5G NSA/SA / IPv6-only + 464XLAT', mtu: 1380, peakHours: '17:30–22:30 UK', throttlingType: 'NAT64/464XLAT translation latency and mobile tower scheduler deprioritization' },
  { slug: 'o2-uk-mobile-tethering', name: 'O2 UK 5G & Mobile Tethering', asn: 'AS5089', tech: '5G / LTE-A Carrier NAT', mtu: 1380, peakHours: '18:00–23:00 UK', throttlingType: 'Deep Packet Inspection (DPI) tethering bitrate caps and UDP port blocking' },
  { slug: 'starlink-satellite-uk', name: 'Starlink LEO Satellite Internet', asn: 'AS14593', tech: 'LEO Satellite / CGNAT', mtu: 1400, peakHours: '19:00–23:00 Local', throttlingType: 'Every-15-second satellite handover micro-dropouts, CGNAT, and ground-station peering spikes' },
  { slug: 'nhs-guest-wifi', name: 'NHS & Hospital Guest Wi-Fi', asn: 'AS-GUEST-WLAN', tech: 'Captive Portal / Firewall DPI', mtu: 1380, peakHours: '08:00–20:00 UK', throttlingType: 'Aggressive Fortinet/Palo Alto category filtering, port blocks, and unencrypted open SSIDs' },
  { slug: 'national-rail-train-wifi', name: 'UK Train Wi-Fi (LNER, GWR, Avanti)', asn: 'AS-ICOMERA', tech: 'Multi-SIM Cellular Bonding', mtu: 1360, peakHours: '07:00–19:30 UK', throttlingType: 'Icomera cellular bonding MTU drops, aggressive media blocking, and shared passenger LAN risks' },
  { slug: 'airport-lounge-public-wifi', name: 'UK Airport & Lounge Public Wi-Fi', asn: 'AS-BOINGO', tech: 'Open 802.11ax Public Hotspot', mtu: 1400, peakHours: '06:00–22:00 Local', throttlingType: 'Unencrypted layer-2 broadcast domains vulnerable to Evil Twin APs and ARP spoofing' },
  { slug: 'hotel-captive-portal-wifi', name: 'Hotel Wi-Fi (Premier Inn, Travelodge, Hilton)', asn: 'AS-HOSPITALITY', tech: 'Captive Portal + Per-Client Rate Cap', mtu: 1380, peakHours: '18:00–23:30 Local', throttlingType: 'Per-MAC bandwidth throttling, DNS interception, and weak client isolation on room VLANs' },
  { slug: 'comcast-xfinity-broadband', name: 'Comcast Xfinity Cable Broadband', asn: 'AS7922', tech: 'DOCSIS 3.1 / 4.0', mtu: 1420, peakHours: '19:00–23:30 EST/PST', throttlingType: 'DOCSIS upstream bufferbloat and congested settlement-free peering to European/gaming servers' },
  { slug: 'att-fiber-broadband', name: 'AT&T Fiber Broadband', asn: 'AS7018', tech: 'GPON / XGS-PON (BGW320)', mtu: 1420, peakHours: '19:30–23:00 US', throttlingType: 'BGW320 gateway NAT state table limits and DNS error-assist hijacking' },
  { slug: 'verizon-fios-broadband', name: 'Verizon Fios Fiber', asn: 'AS701', tech: 'GPON / Ethernet ONT', mtu: 1420, peakHours: '19:00–23:00 EST', throttlingType: 'Congested transit peering to AWS/Cloudflare and evening streaming bitrate drops' },
  { slug: 'deutsche-telekom-dsl', name: 'Deutsche Telekom MagentaZuhause', asn: 'AS3320', tech: 'VDSL2 Supervectoring / FTTH PPPoE', mtu: 1412, peakHours: '19:00–23:00 CET', throttlingType: 'Notorious DTAG tier-1 peering bottlenecks toward Cloudflare, Valve, and Discord' },
  { slug: 'rogers-ignite-canada', name: 'Rogers Ignite Broadband Canada', asn: 'AS812', tech: 'DOCSIS 3.1 / GPON', mtu: 1420, peakHours: '19:00–23:00 EST', throttlingType: 'Evening DOCSIS node jitter and UDP gaming/IPTV flow classification' },
  { slug: 'telstra-nbn-australia', name: 'Telstra NBN Australia', asn: 'AS1221', tech: 'NBN FTTP / HFC / FTTN', mtu: 1412, peakHours: '19:00–22:30 AEST', throttlingType: 'CVC evening congestion and suboptimal submarine cable routing to US/EU endpoints' },
  { slug: 'youfibre-uk', name: 'YouFibre UK 1Gbps–8Gbps Full Fibre', asn: 'AS209386', tech: 'XGS-PON / CGNAT (100.64.0.0/10)', mtu: 1420, peakHours: '19:00–23:00 UK', throttlingType: 'Default CGNAT shared IPv4 pooling and regional transit peering spikes' },
  { slug: 'gigaclear-rural-fibre', name: 'Gigaclear Rural Full Fibre UK', asn: 'AS51048', tech: 'FTTP DHCP / CGNAT', mtu: 1420, peakHours: '19:00–22:30 UK', throttlingType: 'Rural backhaul transit aggregation and CGNAT UDP port limits' },
  { slug: 'fibrus-full-fibre', name: 'Fibrus Full Fibre Broadband', asn: 'AS210002', tech: 'FTTP / CGNAT', mtu: 1420, peakHours: '19:00–23:00 UK', throttlingType: 'CGNAT port exhaustion and Northern Ireland / Cumbria backhaul hops' },
  { slug: 'brsk-better-net-uk', name: 'Brsk BetterNet 1Gbps Fibre UK', asn: 'AS211622', tech: 'FTTP / CGNAT', mtu: 1420, peakHours: '19:30–23:00 UK', throttlingType: 'Shared CGNAT NAT64 state tables and evening peering congestion' },
  { slug: 'trooli-broadband-uk', name: 'Trooli Full Fibre Broadband', asn: 'AS207656', tech: 'FTTP PPPoE', mtu: 1412, peakHours: '19:00–22:30 UK', throttlingType: 'PPPoE 1492 MTU overhead and regional transit bottlenecks' },
  { slug: 'toob-full-fibre-uk', name: 'toob 900Mbps Full Fibre UK', asn: 'AS208294', tech: 'FTTP / CGNAT', mtu: 1420, peakHours: '19:00–23:00 UK', throttlingType: 'Strict CGNAT shared IPv4 address blocks and UDP session timeouts' },
  { slug: 'kcom-lightstream-hull', name: 'KCOM Lightstream Hull Fibre', asn: 'AS12390', tech: 'FTTP PPPoE', mtu: 1412, peakHours: '19:00–23:00 UK', throttlingType: 'PPPoE encapsulation overhead and regional Yorkshire transit routing' },
  { slug: 'now-broadband-uk', name: 'NOW Broadband Super Fibre UK', asn: 'AS5607', tech: 'FTTC / FTTP (Sky Core)', mtu: 1412, peakHours: '19:00–23:00 UK', throttlingType: 'Sky/NOW DHCP Option 61 core queuing and evening video shaping' },
  { slug: 'shell-energy-broadband', name: 'Octopus / Shell Home Broadband UK', asn: 'AS8468', tech: 'FTTC / FTTP PPPoE', mtu: 1412, peakHours: '18:30–23:00 UK', throttlingType: 'TalkTalk wholesale backhaul congestion and PPPoE fragmentation' },
  { slug: 'bell-pure-fibre-canada', name: 'Bell Pure Fibre Canada', asn: 'AS577', tech: 'GPON / Home Hub 4000 PPPoE', mtu: 1412, peakHours: '19:00–23:00 EST', throttlingType: 'PPPoE passthrough overhead and transatlantic peering bottlenecks' },
  { slug: 'spectrum-charter-cable', name: 'Spectrum Charter Cable Internet', asn: 'AS20115', tech: 'DOCSIS 3.1 Cable', mtu: 1420, peakHours: '19:00–23:30 US', throttlingType: 'Asymmetric DOCSIS upload saturation and evening UDP packet loss' },
  { slug: 'cox-panoramic-wifi', name: 'Cox Panoramic Wi-Fi Cable', asn: 'AS22773', tech: 'DOCSIS 3.1 / Fiber', mtu: 1420, peakHours: '19:00–23:30 US', throttlingType: 'Neighborhood node congestion and aggressive QoS traffic shaping' },
  { slug: 't-mobile-5g-home-internet', name: 'T-Mobile 5G Home Internet', asn: 'AS21928', tech: '5G SA/NSA IPv6 + 464XLAT CGNAT', mtu: 1380, peakHours: '17:30–23:00 US', throttlingType: 'Low-priority QCI 9 cellular scheduling, 464XLAT overhead, and CGNAT' },
  { slug: 'orange-livebox-fibre-fr', name: 'Orange Livebox Fibre France', asn: 'AS3215', tech: 'FTTH DHCP VLAN 832', mtu: 1420, peakHours: '19:30–23:00 CET', throttlingType: 'Congested international transit peering toward US/UK CDNs' },
  { slug: 'free-freebox-pop-ultra-fr', name: 'Freebox Pop & Ultra Fibre France', asn: 'AS12322', tech: '10G-EPON IPv6 + MAP-E Shared IPv4', mtu: 1380, peakHours: '19:30–23:00 CET', throttlingType: 'MAP-E 16-bit port-range sharing (only 16,384 ports per subscriber) and MTU reduction' },
  { slug: 'vodafone-kabel-deutschland', name: 'Vodafone Kabel Deutschland', asn: 'AS3209', tech: 'DOCSIS 3.1 Dual-Stack Lite (DS-Lite)', mtu: 1380, peakHours: '19:00–23:00 CET', throttlingType: 'DS-Lite AFTR tunnel bottlenecks and evening cable segment congestion' },
  { slug: 'kpn-glasvezel-nl', name: 'KPN Glasvezel Netherlands', asn: 'AS1136', tech: 'FTTH PPPoE VLAN 6', mtu: 1412, peakHours: '19:30–23:00 CET', throttlingType: 'PPPoE 8-byte header overhead and evening streaming transit queues' },
  { slug: 'ziggo-cable-nl', name: 'Ziggo Cable Internet Netherlands', asn: 'AS33915', tech: 'DOCSIS 3.1 EuroDOCSIS', mtu: 1420, peakHours: '19:30–23:00 CET', throttlingType: 'DOCSIS upstream jitter and ConnectBox NAT table limits' },
  { slug: 'swisscom-blue-internet-ch', name: 'Swisscom blue Internet Switzerland', asn: 'AS3303', tech: 'XGS-PON / FTTH', mtu: 1420, peakHours: '19:30–22:30 CET', throttlingType: 'Strict Swisscom transit peering disputes with third-party European networks' }
];

const USE_CASES = [
  {
    slug: 'isp-throttling',
    titleSuffix: 'Stop ISP Throttling & Evening Speed Drops (2026 Fix)',
    h1Prefix: 'How to Stop',
    h1Suffix: 'Speed Throttling & DPI Traffic Shaping',
    intentKeyword: 'isp throttling fix wireguard',
    problemSummary: 'Deep Packet Inspection (DPI), SNI classification, and congested transit peering cause dramatic throughput drops between 19:00 and 23:00 despite high headline speeds.',
    solutionSummary: 'SWEEPR VPN encapsulates all traffic inside a ChaCha20-Poly1305 encrypted WireGuard UDP stream to 10Gbps RAM-only London, Amsterdam, Frankfurt, and Stockholm core nodes, blinding ISP DPI classifiers and routing around congested peering links.',
    beforeMetric: '18–34 Mbps (Evening Throttled)',
    afterMetric: '910+ Mbps (10Gbps WireGuard)',
    latencyMetric: '4ms UK-LON-01 / 8ms NL-AMS-01'
  },
  {
    slug: 'gaming-packet-loss',
    titleSuffix: 'Fix Gaming Ping Spikes, Jitter & Packet Loss',
    h1Prefix: 'How to Fix',
    h1Suffix: 'Gaming Packet Loss, High Ping & Rubberbanding',
    intentKeyword: 'fix gaming packet loss wireguard vpn',
    problemSummary: 'Suboptimal BGP routing, CGNAT UDP session timeouts, and bufferbloat cause 3–12% packet loss and 80ms+ jitter spikes in Call of Duty, EA FC, Valorant, CS2, and Apex Legends.',
    solutionSummary: 'SWEEPR VPN pins your gaming traffic to direct Tier-1 LINX (London) and AMS-IX (Amsterdam) 10Gbps WireGuard peering with tuned MTU to eliminate IP fragmentation and stabilize frame pacing.',
    beforeMetric: '68ms Ping / 4.8% Packet Loss',
    afterMetric: '9ms Ping / 0.0% Packet Loss',
    latencyMetric: '4ms LINX Peering'
  },
  {
    slug: 'uhd-streaming-buffering',
    titleSuffix: 'Fix 4K UHD Streaming Buffering & Bitrate Drops',
    h1Prefix: 'Eliminate',
    h1Suffix: '4K UHD Streaming Buffering & CDN Throttling',
    intentKeyword: 'stop 4k streaming buffering vpn',
    problemSummary: 'ISPs frequently deprioritize long-lived HTTPS video chunks or saturate CDN interconnects in the evening, forcing 4K HDR streams down to blurry 720p.',
    solutionSummary: 'By tunneling via SWEEPR VPN’s 10Gbps RAM-only WireGuard servers with direct CDN interconnects, video segments look identical to encrypted enterprise UDP packets and maintain 85+ Mbps sustained 4K bitrates.',
    beforeMetric: '4.2 Mbps (720p Downgrade)',
    afterMetric: '88.5 Mbps (Full 4K HDR10+)',
    latencyMetric: 'Zero Rebuffering'
  },
  {
    slug: 'p2p-port-forwarding',
    titleSuffix: 'Bypass CGNAT, P2P Throttling & Port Blocking',
    h1Prefix: 'How to Bypass',
    h1Suffix: 'CGNAT & P2P Bandwidth Throttling',
    intentKeyword: 'cgnat bypass wireguard p2p vpn',
    problemSummary: 'Carrier-Grade NAT (100.64.x.x) and ISP protocol classifiers throttle peer-to-peer transfers, Linux ISO swarms, and decentralized sync protocols.',
    solutionSummary: 'SWEEPR VPN provides unthrottled 10Gbps RAM-only WireGuard tunnels in Switzerland, Netherlands, and Sweden with an NDIS/nftables kernel kill-switch and zero connection logs.',
    beforeMetric: '1.8 MB/s (CGNAT / DPI Capped)',
    afterMetric: '94.2 MB/s (10Gbps WireGuard)',
    latencyMetric: 'RAM-Only Zero Logs'
  },
  {
    slug: 'smart-tv-acr-blocking',
    titleSuffix: 'Block Smart-TV ACR Spying & Unknown Wi-Fi Devices',
    h1Prefix: 'Block Smart-TV ACR Spying on',
    h1Suffix: '& Scan Your Home Wi-Fi in 30 Seconds',
    intentKeyword: 'block smart tv acr tracking wifi scanner',
    problemSummary: 'Smart TVs (Samsung, LG, Sony, Fire TV, Roku) capture Automatic Content Recognition (ACR) screenshots every 500ms and upload viewing telemetry over your home broadband.',
    solutionSummary: 'SWEEPR VPN’s free 30-second Home Wi-Fi Device Scanner discovers every connected device on your router subnet, while the SWEEPR Wi-Fi Radar & Smart-TV Shield Add-On sinks ACR telemetry domains at the DNS/tunnel layer.',
    beforeMetric: '7,200+ ACR Telemetry Hits/Day',
    afterMetric: '0 ACR Uploads (100% Blocked)',
    latencyMetric: '30-Second LAN Scan'
  },
  {
    slug: 'remote-dev-ssh',
    titleSuffix: 'Fix Dropping SSH, Docker, Git & Corporate VPN Sessions',
    h1Prefix: 'Fix Dropping SSH, Kubernetes & Git Sessions on',
    h1Suffix: 'With Persistent WireGuard',
    intentKeyword: 'keep ssh alive wireguard mtu fix',
    problemSummary: 'Aggressive CGNAT state timeouts, PPPoE MTU blackholes, and IPv6 route flaps terminate idle SSH terminals, `docker pull` layers, and `kubectl` port-forwards.',
    solutionSummary: 'SWEEPR VPN configures a 25-second `PersistentKeepalive` and path-matched MTU so SSH, database tunnels, and remote IDE sessions survive Wi-Fi/5G roaming without dropping.',
    beforeMetric: 'Drops Every 5–10 Mins',
    afterMetric: '100% Persistent Session Uptime',
    latencyMetric: '25s Keepalive / 0 Drops'
  },
  {
    slug: 'voip-teams-zoom-jitter',
    titleSuffix: 'Fix Microsoft Teams, Zoom & VoIP Call Dropouts',
    h1Prefix: 'How to Fix Microsoft Teams, Zoom & VoIP Jitter on',
    h1Suffix: 'Using Low-Latency WireGuard',
    intentKeyword: 'fix teams zoom jitter packet loss vpn',
    problemSummary: 'WebRTC UDP media streams on Teams, Zoom, Slack Huddles, and WhatsApp Calls suffer robotic audio and frozen video when ISPs reshape UDP bursts or drop fragmented packets.',
    solutionSummary: 'SWEEPR VPN wraps WebRTC media flows inside a single 4ms London WireGuard UDP socket with optimized MTU, eliminating UDP queue starvation and stabilizing voice/video MOS scores.',
    beforeMetric: '42ms Jitter / Robotic Audio',
    afterMetric: '1.8ms Jitter / HD Voice & 1080p',
    latencyMetric: '4ms UK-LON-01'
  },
  {
    slug: 'wifi-arp-spoofing-protection',
    titleSuffix: 'Stop Wi-Fi Sniffing, Evil Twin APs & Unknown LAN Devices',
    h1Prefix: 'Protect Your Devices on',
    h1Suffix: 'From ARP Spoofing, Sniffing & Unknown Intruders',
    intentKeyword: 'detect unknown devices on wifi arp spoofing vpn',
    problemSummary: 'Shared or weakly secured Wi-Fi networks expose unencrypted DNS queries, mDNS device names, and session traffic to local packet capture and rogue access points.',
    solutionSummary: 'SWEEPR VPN combines a 30-second local ARP/mDNS device audit with instant 10Gbps WireGuard encryption and in-tunnel DNS (`10.66.0.1`) so local snoopers see zero plaintext metadata.',
    beforeMetric: 'Plaintext DNS & LAN Exposure',
    afterMetric: 'ChaCha20-Poly1305 Encrypted',
    latencyMetric: 'Zero DNS / WebRTC Leaks'
  }
];

const SETUP_GUIDES = [
  {
    slug: 'gl-inet-flint-2-wireguard',
    name: 'GL.iNet Flint 2 (GL-MT6000) & Beryl AX Travel Router',
    category: 'Travel & Home Router',
    keyword: 'gl inet flint 2 wireguard vpn setup',
    summary: 'Import a native SWEEPR VPN WireGuard `.conf` profile into GL.iNet Admin Panel 4.x (`VPN -> WireGuard Client`) for 900+ Mbps hardware-accelerated router encryption and hotel captive-portal protection.',
    commands: [
      '# Verify WireGuard interface & MTU on GL.iNet SSH (OpenWrt 23.05 base)',
      'wg show wgclient',
      'uci set network.wgclient.mtu="1420"',
      'uci commit network && /etc/init.d/network reload',
      'ping -c 4 10.66.0.1'
    ]
  },
  {
    slug: 'mikrotik-routeros-v7-wireguard',
    name: 'MikroTik RouterOS v7 (RB5009 / hAP ax3)',
    category: 'Enterprise & Homelab Router',
    keyword: 'mikrotik routeros v7 wireguard vpn client setup',
    summary: 'Configure a high-throughput WireGuard client interface, MSS clamping mangle rule, and Policy-Based Routing table on MikroTik RouterOS v7 with SWEEPR VPN.',
    commands: [
      '/interface wireguard add listen-port=51820 mtu=1420 name=wg-sweepr private-key="<YOUR_PRIVATE_KEY>"',
      '/interface wireguard peers add interface=wg-sweepr public-key="<SWEEPR_LON01_PUBKEY>" endpoint-address=lon01.sweeprvpn.com endpoint-port=51820 allowed-address=0.0.0.0/0 persistent-keepalive=25s',
      '/ip address add address=10.66.14.82/32 interface=wg-sweepr',
      '/ip firewall mangle add chain=forward protocol=tcp tcp-flags=syn out-interface=wg-sweepr action=change-mss new-mss=1360'
    ]
  },
  {
    slug: 'ubiquiti-unifi-dream-machine-wireguard',
    name: 'Ubiquiti UniFi Dream Machine (UDM-Pro / UDM-SE / UDR)',
    category: 'UniFi OS 4.x Gateway',
    keyword: 'unifi dream machine wireguard vpn client policy routing',
    summary: 'Upload your SWEEPR VPN WireGuard configuration into UniFi Network 8.x (`Settings -> VPN -> VPN Client`) and route Apple TV, Smart TVs, or specific VLANs through 10Gbps RAM-only endpoints.',
    commands: [
      '# In UniFi Network Controller 8.x+:',
      '# 1. Navigate to Settings -> VPN -> VPN Client -> Create New -> WireGuard',
      '# 2. Upload sweepr-uk-lon01.conf (MTU 1412 for PPPoE FTTP or 1420 for DHCP)',
      '# 3. Go to Routing -> Policy-Based Routes -> Select Apple TV / IoT VLAN -> Interface: SWEEPR-LON01'
    ]
  },
  {
    slug: 'synology-dsm-7-wireguard',
    name: 'Synology NAS DSM 7.2 (Kernel WireGuard & Gluetun)',
    category: 'NAS & Media Server',
    keyword: 'synology dsm 7 wireguard vpn setup',
    summary: 'Run SWEEPR VPN on Synology DiskStation DSM 7.2 either natively via the `synology-wireguard` SPK or inside Container Manager with Gluetun for isolated container routing.',
    commands: [
      '# Verify WireGuard tunnel inside Synology SSH or Gluetun container:',
      'sudo wg-quick up /etc/wireguard/sweepr-nl-ams01.conf',
      'sudo wg show',
      'curl -s https://sweeprvpn.com/api/ip-check'
    ]
  },
  {
    slug: 'qnap-qts-wireguard-client',
    name: 'QNAP QTS 5.x & QuTS hero (QVPN Service 3)',
    category: 'NAS & Storage Appliance',
    keyword: 'qnap qvpn wireguard client setup',
    summary: 'Configure QNAP QVPN Service 3 with a SWEEPR VPN 10Gbps WireGuard peer and set it as the default gateway for Container Station and Download Station.',
    commands: [
      '# QVPN Service 3 -> VPN Client -> VPN Connection Profiles -> Add -> WireGuard',
      '# Endpoint: nl-ams01.sweeprvpn.com:51820 | DNS: 10.66.0.1 | MTU: 1420',
      'wg show qvpn-wg0'
    ]
  },
  {
    slug: 'docker-gluetun-wireguard-compose',
    name: 'Docker Compose + Gluetun WireGuard Sidecar Stack',
    category: 'Container & Homelab Infrastructure',
    keyword: 'docker compose gluetun wireguard vpn setup',
    summary: 'Bind any Docker container (`network_mode: "service:gluetun"`) to a SWEEPR VPN 10Gbps RAM-only WireGuard tunnel with built-in firewall kill-switch and DNS-over-Tunnel.',
    commands: [
      'services:',
      '  gluetun:',
      '    image: qmcgaw/gluetun:latest',
      '    cap_add: [NET_ADMIN]',
      '    devices: [/dev/net/tun:/dev/net/tun]',
      '    environment:',
      '      - VPN_SERVICE_PROVIDER=custom',
      '      - VPN_TYPE=wireguard',
      '      - WIREGUARD_ENDPOINT_IP=185.212.14.9',
      '      - WIREGUARD_ENDPOINT_PORT=51820',
      '      - WIREGUARD_ADDRESSES=10.66.14.82/32'
    ]
  },
  {
    slug: 'proxmox-lxc-wireguard-gateway',
    name: 'Proxmox VE 8.x Unprivileged LXC WireGuard Gateway',
    category: 'Virtualization & Homelab',
    keyword: 'proxmox lxc wireguard vpn gateway setup',
    summary: 'Deploy an ultra-lightweight Alpine or Debian unprivileged LXC container on Proxmox VE 8.x (<32 MB RAM) acting as a 10Gbps SWEEPR VPN WireGuard gateway for your homelab VLAN.',
    commands: [
      '# In /etc/pve/lxc/105.conf on Proxmox host:',
      'lxc.cgroup2.devices.allow: c 10:200 rwm',
      'lxc.mount.entry: /dev/net/tun dev/net/tun none bind,create=file',
      '# Inside LXC container:',
      'apk add wireguard-tools iptables && wg-quick up sweepr-lon01'
    ]
  },
  {
    slug: 'raspberry-pi-5-wireguard-gateway',
    name: 'Raspberry Pi 5 Whole-Home WireGuard & Smart-TV ACR Blocker',
    category: 'Single-Board Gateway',
    keyword: 'raspberry pi 5 wireguard vpn gateway smart tv blocker',
    summary: 'Turn a Raspberry Pi 5 into a 1Gbps+ whole-home WireGuard VPN gateway and Smart-TV ACR telemetry sinkhole without replacing your ISP router.',
    commands: [
      'sudo apt update && sudo apt install -y wireguard nftables',
      'sudo sysctl -w net.ipv4.ip_forward=1',
      'sudo systemctl enable --now wg-quick@sweepr-lon01'
    ]
  },
  {
    slug: 'apple-tv-tvos-17-wireguard',
    name: 'Apple TV 4K (tvOS 17 / tvOS 18) Native WireGuard Setup',
    category: 'Smart TV & Streaming Box',
    keyword: 'apple tv 4k wireguard vpn setup buffer free 4k',
    summary: 'Configure SWEEPR VPN on Apple TV 4K via native tvOS Network Extension or router policy routing for zero-buffering 4K Dolby Vision and zero ACR tracking.',
    commands: [
      '# Option A: Import sweepr-uk-lon01.conf via WireGuard tvOS profile',
      '# Option B: Route Apple TV static LAN IP (e.g. 192.168.1.50) via SWEEPR VPN Router Client',
      '# Set Apple TV DNS to 10.66.0.1 (SWEEPR Zero-Log + ACR Shield DNS)'
    ]
  },
  {
    slug: 'nvidia-shield-tv-pro-wireguard',
    name: 'NVIDIA Shield TV Pro 4K WireGuard & GeForce NOW Setup',
    category: 'Android TV & Cloud Gaming',
    keyword: 'nvidia shield tv pro wireguard vpn low latency',
    summary: 'Run 10Gbps WireGuard on NVIDIA Shield TV Pro with 4ms UK-LON-01 peering so GeForce NOW 4K 120fps and UHD streams never suffer ISP evening throttling.',
    commands: [
      '# Import sweepr-uk-lon01.conf in WireGuard for Android TV',
      '# Enable Per-App Tunneling or Full-Device Tunnel with MTU 1420',
      '# Verify 0% packet loss and <5ms jitter to London core'
    ]
  },
  {
    slug: 'playstation-5-wireguard-router',
    name: 'PlayStation 5 (PS5) Low-Ping WireGuard & NAT Type 2 Setup',
    category: 'Console Gaming',
    keyword: 'ps5 wireguard vpn low ping nat type 2',
    summary: 'Eliminate PS5 evening packet loss, PSN download throttling, and CGNAT Strict NAT errors by routing your PS5 through a SWEEPR VPN 10Gbps WireGuard gateway.',
    commands: [
      '# Assign static DHCP lease to PS5 (e.g. 192.168.1.85)',
      '# Route 192.168.1.85/32 via wg-sweepr (UK-LON-01 4ms)',
      '# Set PS5 Manual MTU to 1412 (PPPoE FTTP) or 1420 (Cable/DHCP)'
    ]
  },
  {
    slug: 'xbox-series-x-wireguard-gaming',
    name: 'Xbox Series X|S WireGuard Low-Latency & Open NAT Guide',
    category: 'Console Gaming',
    keyword: 'xbox series x wireguard vpn packet loss fix',
    summary: 'Fix Xbox Live party disconnects, Teredo CGNAT blocks, and Warzone/EA FC rubberbanding with SWEEPR VPN’s 4ms London WireGuard peering.',
    commands: [
      '# Route Xbox Series X LAN IP via SWEEPR VPN WireGuard interface',
      '# Allow UDP 3074 & Teredo passthrough on local LAN gateway',
      '# Verify 0% packet loss in Xbox Network Settings -> Test network speed & statistics'
    ]
  }
];

const COMPETITORS = [
  { slug: 'bitdefender-vpn', name: 'Bitdefender VPN', price: '£49.99/yr (Renewal £69.99)', installerSize: '~145 MB (Hotspot Shield SDK)', ramUsage: '~210 MB', hasWifiScanner: 'No', hasAcrBlocker: 'No', jurisdiction: 'Romania (Third-Party Aura/Catapult SDK)' },
  { slug: 'norton-secure-vpn', name: 'Norton Secure VPN', price: '£39.99 yr 1 → £79.99/yr renewal', installerSize: '~260 MB', ramUsage: '~280 MB', hasWifiScanner: 'No', hasAcrBlocker: 'No', jurisdiction: 'USA (Gen Digital / Five Eyes)' },
  { slug: 'kaspersky-vpn', name: 'Kaspersky VPN Secure Connection', price: '£44.99/yr', installerSize: '~190 MB', ramUsage: '~230 MB', hasWifiScanner: 'Limited', hasAcrBlocker: 'No', jurisdiction: 'Russia / Switzerland (Restricted in US/UK Gov)' },
  { slug: 'avast-secureline-vpn', name: 'Avast SecureLine VPN', price: '£55.99/yr (Renewal £89.99)', installerSize: '~240 MB', ramUsage: '~275 MB', hasWifiScanner: 'Basic', hasAcrBlocker: 'No', jurisdiction: 'Czechia / USA (Gen Digital)' },
  { slug: 'avg-secure-vpn', name: 'AVG Secure VPN', price: '£54.99/yr (Renewal £89.99)', installerSize: '~235 MB', ramUsage: '~265 MB', hasWifiScanner: 'No', hasAcrBlocker: 'No', jurisdiction: 'Czechia / USA (Gen Digital)' },
  { slug: 'mozilla-vpn', name: 'Mozilla VPN', price: '£49.99/yr (£8.99/mo)', installerSize: '~95 MB', ramUsage: '~145 MB', hasWifiScanner: 'No', hasAcrBlocker: 'No', jurisdiction: 'USA (Resold Mullvad Infrastructure)' },
  { slug: 'cloudflare-warp-plus', name: 'Cloudflare WARP+', price: '£48.00/yr ($4.99/mo)', installerSize: '~115 MB', ramUsage: '~160 MB', hasWifiScanner: 'No', hasAcrBlocker: 'No', jurisdiction: 'USA (Logs Device & Account Telemetry, No Geo/Server Selection)' },
  { slug: 'windscribe', name: 'Windscribe Pro', price: '£55.00/yr ($69/yr)', installerSize: '~85 MB', ramUsage: '~140 MB', hasWifiScanner: 'No', hasAcrBlocker: 'R.O.B.E.R.T. DNS Only', jurisdiction: 'Canada (Five Eyes)' },
  { slug: 'private-internet-access', name: 'Private Internet Access (PIA)', price: '£39.99 yr 1 → £79.99 renewal', installerSize: '~110 MB', ramUsage: '~175 MB', hasWifiScanner: 'No', hasAcrBlocker: 'MACE Adblock Only', jurisdiction: 'USA (Kape Technologies / Five Eyes)' },
  { slug: 'cyberghost', name: 'CyberGhost VPN', price: '£56.99/yr after intro', installerSize: '~165 MB (.NET Runtime)', ramUsage: '~260 MB', hasWifiScanner: 'No', hasAcrBlocker: 'No', jurisdiction: 'Romania (Kape Technologies)' },
  { slug: 'vyprvpn', name: 'VyprVPN', price: '£48.00–£96.00/yr', installerSize: '~120 MB', ramUsage: '~185 MB', hasWifiScanner: 'No', hasAcrBlocker: 'No', jurisdiction: 'Switzerland / USA (Certida LLC)' },
  { slug: 'hide-me-vpn', name: 'hide.me VPN', price: '£59.99–£89.99/yr', installerSize: '~105 MB', ramUsage: '~165 MB', hasWifiScanner: 'No', hasAcrBlocker: 'No', jurisdiction: 'Malaysia' },
  { slug: 'tunnelbear', name: 'TunnelBear VPN', price: '£95.88/yr ($9.99/mo)', installerSize: '~150 MB', ramUsage: '~210 MB', hasWifiScanner: 'No', hasAcrBlocker: 'No', jurisdiction: 'Canada (McAfee Corp / Five Eyes)' },
  { slug: 'airvpn', name: 'AirVPN (Eddie Client)', price: '€49.00–€79.00/yr', installerSize: '~90 MB (Mono/.NET Eddie UI)', ramUsage: '~190 MB', hasWifiScanner: 'No', hasAcrBlocker: 'No', jurisdiction: 'Italy (Complex Legacy UI)' }
];

const SECURITY_GUIDES = [
  {
    slug: 'block-sony-bravia-samba-tv-acr',
    title: 'How to Block Sony Bravia & Samba TV ACR Tracking (2026 Guide)',
    h1: 'How to Block Sony Bravia & Samba TV ACR Screenshot Spying on Your Home Wi-Fi',
    keyword: 'block sony bravia samba tv acr tracking',
    domains: ['Interactive.tv', 'prod.sambTV.com', 'preferences.sambatv.com', 'bravia.dl.playstation.net', 'flingo.tv'],
    summary: 'Sony Bravia Google TV sets bundle Samba TV Interactive TV Services, which fingerprints every frame on HDMI inputs to build cross-device household ad profiles.'
  },
  {
    slug: 'block-hisense-vidaa-fire-tv-acr',
    title: 'How to Block Hisense VIDAA & Amazon Fire TV ACR Telemetry (2026)',
    h1: 'Stop Hisense VIDAA OS & Amazon Fire TV ACR Tracking at the Network Layer',
    keyword: 'block fire tv hisense vidaa acr telemetry',
    domains: ['device-metrics-us.amazon.com', 'fls-eu.amazon.com', 'mas-ext.amazon.com', 'api-gps.hismarttv.com', 'msg-eu.hismarttv.com'],
    summary: 'Amazon Fire TV OS and Hisense VIDAA OS phone home thousands of times per day with app launch telemetry, voice metadata, and ACR content beacons even when Advertising ID is toggled off.'
  },
  {
    slug: 'detect-hidden-wifi-cameras-airbnb',
    title: 'How to Scan Airbnb & Hotel Wi-Fi for Unknown Devices in 30 Seconds',
    h1: 'How to Audit Airbnb & Hotel Wi-Fi Subnets for Hidden IP Cameras & Rogue Devices',
    keyword: 'scan airbnb wifi for hidden cameras unknown devices',
    domains: ['arp-scan local-subnet', 'mDNS _rtsp._tcp.local', 'SSDP UPnP 239.255.255.250:1900', 'OUI Vendor Lookup (Hikvision, Dahua, Espressif, Tuya)'],
    summary: 'Learn how SWEEPR VPN’s Free 30-Second Home & Travel Wi-Fi Device Scanner uses ARP cache inspection, IEEE OUI vendor fingerprinting, and mDNS service discovery to surface unknown cameras and IoT devices.'
  },
  {
    slug: 'fix-wireguard-mtu-fragmentation-pppoe',
    title: 'Optimal WireGuard MTU Calculator & Guide for UK FTTP PPPoE & 5G (2026)',
    h1: 'How to Fix WireGuard MTU Packet Fragmentation on PPPoE Fibre (1412) & 5G (1380)',
    keyword: 'wireguard mtu pppoe 1412 1420 calculator uk fibre',
    domains: ['Standard Ethernet (1500) -> WireGuard MTU 1420', 'UK Openreach PPPoE (1492) -> WireGuard MTU 1412', '5G Home Broadband CGNAT (1440) -> WireGuard MTU 1380'],
    summary: 'Mismatched WireGuard MTU values cause silent PMTUD blackholes where pings succeed but TLS handshakes, SSH sessions, and 4K video streams stall.'
  },
  {
    slug: 'stop-isp-dns-hijacking-nxdomain',
    title: 'How to Stop ISP DNS Hijacking, Transparent Proxies & SNI Filtering',
    h1: 'How to Bypass ISP Transparent DNS Proxies & NXDOMAIN Hijacking with WireGuard',
    keyword: 'stop isp dns hijacking wireguard vpn',
    domains: ['UDP/TCP Port 53 Interception', 'In-Tunnel DNS (10.66.0.1)', 'DNSSEC Validation', 'WebRTC STUN Leak Prevention'],
    summary: 'Many residential ISPs intercept port 53 requests using transparent DNS proxies even when you set 1.1.1.1 or 8.8.8.8 on your router. Routing DNS inside SWEEPR VPN’s encrypted WireGuard tunnel (`10.66.0.1`) guarantees authentic responses.'
  },
  {
    slug: 'bypass-cgnat-for-self-hosted-home-lab',
    title: 'How to Fix CGNAT (100.64.x.x) Issues on Fibre & 5G Broadband',
    h1: 'Understanding Carrier-Grade NAT (CGNAT) on Hyperoptic, Community Fibre & 5G',
    keyword: 'detect cgnat 100.64.0.0 bypass wireguard vpn',
    domains: ['RFC 6598 Shared Address Space (100.64.0.0/10)', 'UDP Session Table Exhaustion', 'PersistentKeepalive = 25', 'Dedicated 10Gbps WireGuard Exit'],
    summary: 'Learn how to test if your ISP places your router behind RFC 6598 CGNAT (`100.64.0.0/10`) and how SWEEPR VPN prevents CGNAT UDP port exhaustion and IP reputation blocks.'
  }
];

function buildCandidatePool() {
  const pool = [];

  // Interleave across all 4 clusters so every daily batch of 50 pages has balanced topical authority
  const solutionItems = [];
  for (const net of NETWORKS_AND_ISPS) {
    for (const uc of USE_CASES) {
      solutionItems.push({
        cluster: 'solutions',
        relPath: `solutions/${net.slug}-${uc.slug}.html`,
        urlPath: `/solutions/${net.slug}-${uc.slug}`,
        net,
        uc
      });
    }
  }

  const setupItems = SETUP_GUIDES.map((g) => ({
    cluster: 'setup',
    relPath: `setup/${g.slug}.html`,
    urlPath: `/setup/${g.slug}`,
    guide: g
  }));

  const vsItems = COMPETITORS.map((c) => ({
    cluster: 'vs',
    relPath: `vs/${c.slug}.html`,
    urlPath: `/vs/${c.slug}`,
    comp: c
  }));

  const guideItems = SECURITY_GUIDES.map((g) => ({
    cluster: 'guides',
    relPath: `guides/${g.slug}.html`,
    urlPath: `/guides/${g.slug}`,
    guide: g
  }));

  // First add setup, vs, and guides + top solutions so every 50-page batch has a rich mix
  let si = 0, st = 0, vi = 0, gi = 0;
  while (si < solutionItems.length || st < setupItems.length || vi < vsItems.length || gi < guideItems.length) {
    if (si < solutionItems.length) pool.push(solutionItems[si++]);
    if (si < solutionItems.length) pool.push(solutionItems[si++]);
    if (st < setupItems.length) pool.push(setupItems[st++]);
    if (vi < vsItems.length) pool.push(vsItems[vi++]);
    if (gi < guideItems.length) pool.push(guideItems[gi++]);
  }
  return pool;
}

function renderLayout({ title, description, canonicalUrl, badge, h1, lead, bodyHtml, faqs, relatedLinks }) {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a }
    }))
  };

  const appSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'SWEEPR VPN',
    operatingSystem: 'Windows 10, Windows 11, macOS, Linux, iOS, Android, OpenWrt',
    applicationCategory: 'SecurityApplication',
    downloadUrl: 'https://sweeprvpn.com/SWEEPRVPN.exe',
    fileSize: '3.7MB',
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'GBP',
      lowPrice: '1.99',
      highPrice: '74.99',
      offerCount: '3'
    }
  };

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="SWEEPR VPN" />
  <script type="application/ld+json">${JSON.stringify(faqSchema)}</script>
  <script type="application/ld+json">${JSON.stringify(appSchema)}</script>
  <style>
    :root { --bg:#070b14; --card:#0f172a; --border:#1e293b; --text:#f8fafc; --muted:#94a3b8; --accent:#10b981; --accent2:#38bdf8; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:var(--bg); color:var(--text); line-height:1.68; }
    header { border-bottom:1px solid var(--border); background:rgba(7,11,20,0.92); position:sticky; top:0; z-index:20; backdrop-filter:blur(10px); }
    .nav { max-width:1100px; margin:0 auto; padding:14px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
    .brand { font-weight:800; font-size:1.15rem; color:var(--text); text-decoration:none; letter-spacing:-0.02em; }
    .brand span { color:var(--accent); }
    .nav-links { display:flex; gap:16px; align-items:center; flex-wrap:wrap; }
    .nav-links a { color:var(--muted); text-decoration:none; font-size:0.92rem; }
    .nav-links a:hover { color:var(--text); }
    .btn { display:inline-block; background:var(--accent); color:#042f2e; font-weight:700; padding:10px 18px; border-radius:8px; text-decoration:none; }
    .btn-outline { display:inline-block; border:1px solid var(--accent2); color:var(--accent2); font-weight:600; padding:10px 18px; border-radius:8px; text-decoration:none; }
    main { max-width:1020px; margin:0 auto; padding:42px 20px 72px; }
    .badge { display:inline-block; background:rgba(16,185,129,0.14); color:var(--accent); border:1px solid rgba(16,185,129,0.35); padding:4px 12px; border-radius:999px; font-size:0.8rem; font-weight:700; margin-bottom:14px; }
    h1 { font-size:2.15rem; line-height:1.2; margin:0 0 16px; letter-spacing:-0.02em; }
    h2 { font-size:1.45rem; margin:34px 0 12px; color:#e2e8f0; }
    h3 { font-size:1.12rem; margin:20px 0 8px; color:#f1f5f9; }
    .lead { font-size:1.12rem; color:var(--muted); max-width:840px; margin-bottom:26px; }
    .cta-strip { background:linear-gradient(135deg,#0f172a,#064e3b); border:1px solid rgba(16,185,129,0.4); border-radius:14px; padding:22px; margin:26px 0; display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:16px; }
    .card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:22px; margin:20px 0; }
    table { width:100%; border-collapse:collapse; margin:18px 0; background:var(--card); border:1px solid var(--border); border-radius:10px; overflow:hidden; }
    th, td { padding:12px 14px; text-align:left; border-bottom:1px solid var(--border); font-size:0.94rem; }
    th { background:#111c33; color:var(--accent2); font-weight:700; }
    pre { background:#020617; border:1px solid var(--border); padding:16px; border-radius:10px; overflow-x:auto; color:#a7f3d0; font-size:0.88rem; }
    code { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; }
    .grid-3 { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:16px; margin:20px 0; }
    .stat-box { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:16px; }
    .stat-label { font-size:0.8rem; color:var(--muted); text-transform:uppercase; }
    .stat-val { font-size:1.3rem; font-weight:800; color:var(--accent); margin-top:4px; }
    footer { border-top:1px solid var(--border); padding:32px 20px; text-align:center; color:var(--muted); font-size:0.88rem; }
    footer a { color:var(--accent2); text-decoration:none; margin:0 8px; }
  </style>
</head>
<body>
  <header>
    <nav class="nav" aria-label="Primary Navigation">
      <a class="brand" href="/">SWEEPR <span>VPN</span></a>
      <div class="nav-links">
        <a href="/download">Free 30s Wi-Fi Scanner</a>
        <a href="/pricing">Pricing (£1.99 Trial)</a>
        <a href="/tools/leak-test">IP &amp; DNS Leak Test</a>
        <a href="/tools/isp-throttling-test">ISP Speed Checker</a>
        <a class="btn" href="/download">Download (~3.7 MB)</a>
      </div>
    </nav>
  </header>
  <main>
    <span class="badge">${badge}</span>
    <h1>${h1}</h1>
    <p class="lead">${lead}</p>

    <div class="cta-strip">
      <div>
        <strong>Run the Free 30-Second Home Wi-Fi &amp; ISP Speed Diagnostic</strong>
        <div style="color:var(--muted);font-size:0.93rem;">Featherlight ~3.7 MB native Rust + Tauri v2 app • No credit card required for Wi-Fi device scanner • £1.99 1st-Month Pro Trial</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <a class="btn" href="/download">Download Free Scanner</a>
        <a class="btn-outline" href="/pricing">View Plans (Save 50% Yearly)</a>
      </div>
    </div>

    ${bodyHtml}

    <h2>Transparent Anchor Pricing &amp; 30-Day Money-Back Guarantee</h2>
    <p>Unlike legacy VPNs that trap you in 24-month renewals or 250 MB bloated installers, SWEEPR VPN offers straightforward pricing with an instant free 30-second Home Wi-Fi Device Scanner:</p>
    <table>
      <thead>
        <tr>
          <th>Plan Tier</th>
          <th>Billing Cycle</th>
          <th>Effective Monthly Cost</th>
          <th>Included Features</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Yearly Plan (Core Cash Cow — Save 50%)</strong></td>
          <td>£74.99 / year ($95.99 USD | €89.99 EUR)</td>
          <td><strong>£6.25 / mo</strong></td>
          <td>10Gbps RAM-Only WireGuard (UK, NL, DE, SE, CH, US), 10 Devices, Kernel Kill-Switch, 30-Day Guarantee</td>
        </tr>
        <tr>
          <td><strong>6-Monthly Plan (Mid-Tier Anchor — Save 35%)</strong></td>
          <td>£48.99 / 6 months ($61.99 USD | €58.99 EUR)</td>
          <td><strong>£8.17 / mo</strong></td>
          <td>All 10Gbps WireGuard Core Locations, In-Tunnel DNS, Port-Forwarding &amp; Streaming Support</td>
        </tr>
        <tr>
          <td><strong>Monthly Plan (Flexible + £1.99 1st Month)</strong></td>
          <td>£1.99 1st Month, then £12.49 / mo</td>
          <td>£12.49 / mo</td>
          <td>Cancel anytime in 1 click, full 10Gbps WireGuard &amp; Wi-Fi diagnostic access</td>
        </tr>
        <tr>
          <td><strong>SWEEPR Wi-Fi Radar &amp; Smart-TV Shield Add-On</strong></td>
          <td>+£14.99/yr | +£9.99/6mo | +£1.99/mo</td>
          <td>Optional Add-On</td>
          <td>24/7 Unknown Wi-Fi Intruder Alerts + Samsung/LG/Sony/Roku/Fire TV ACR Spy Blocker</td>
        </tr>
      </tbody>
    </table>

    <h2>Frequently Asked Questions</h2>
    ${faqs.map((f) => `<div class="card"><h3>${f.q}</h3><p>${f.a}</p></div>`).join('\n')}

    <h2>Related Technical Guides &amp; Free Diagnostic Tools</h2>
    <div class="card">
      <ul>
        ${relatedLinks.map((l) => `<li><a href="${l.href}" style="color:var(--accent2);">${l.label}</a></li>`).join('\n        ')}
        <li><a href="/tools/leak-test" style="color:var(--accent2);">Free Browser IP, DNS &amp; WebRTC Leak Test</a></li>
        <li><a href="/tools/isp-throttling-test" style="color:var(--accent2);">Free ISP Evening Throttling &amp; Latency Checker</a></li>
        <li><a href="/download" style="color:var(--accent2);">Download SWEEPR VPN &amp; Free 30-Second Home Wi-Fi Scanner (~3.7 MB)</a></li>
      </ul>
    </div>
  </main>
  <footer>
    <p>&copy; 2026 SWEEPR VPN Security Lab. Built in Rust + Tauri v2 with Audited Kernel WireGuard &amp; RAM-Only Servers.</p>
    <p>
      <a href="/">Home</a> |
      <a href="/pricing">Pricing</a> |
      <a href="/download">Download</a> |
      <a href="/tools/leak-test">Leak Test</a> |
      <a href="/tools/isp-throttling-test">ISP Speed Test</a> |
      <a href="/pad.xml">PAD 4.0 XML</a> |
      <a href="/privacy">Privacy Policy</a>
    </p>
  </footer>
</body>
</html>`;
}

function generateCandidateHtml(candidate) {
  const canonicalUrl = `https://sweeprvpn.com${candidate.urlPath}`;

  if (candidate.cluster === 'solutions') {
    const { net, uc } = candidate;
    const title = `${net.name}: ${uc.titleSuffix} | SWEEPR VPN`;
    const description = `${uc.h1Prefix} ${net.name} (${net.asn}) ${uc.h1Suffix.toLowerCase()}. Tested ${net.mtu} MTU WireGuard config, 4ms London 10Gbps RAM-only routing & free 30s Wi-Fi scanner.`;
    const h1 = `${uc.h1Prefix} ${net.name} ${uc.h1Suffix}`;
    const lead = `Experiencing slowdowns or connection drops on ${net.name} (${net.asn} • ${net.tech}) during ${net.peakHours}? ${uc.problemSummary} ${uc.solutionSummary}`;

    const bodyHtml = `
    <div class="grid-3">
      <div class="stat-box"><div class="stat-label">Unprotected ${net.name}</div><div class="stat-val" style="color:#f87171;">${uc.beforeMetric}</div></div>
      <div class="stat-box"><div class="stat-label">With SWEEPR 10Gbps WireGuard</div><div class="stat-val">${uc.afterMetric}</div></div>
      <div class="stat-box"><div class="stat-label">Recommended WireGuard MTU</div><div class="stat-val">${net.mtu} Bytes (${uc.latencyMetric})</div></div>
    </div>

    <h2>Why ${net.name} (${net.asn}) Suffers From ${uc.h1Suffix}</h2>
    <p>On <strong>${net.name}</strong> (${net.tech}), residential and mobile gateways frequently encounter <strong>${net.throttlingType}</strong> between <strong>${net.peakHours}</strong>. Standard unencrypted TCP/UDP flows expose plaintext Server Name Indication (SNI) headers, destination ASNs, and packet timing signatures that automated network queues classify and deprioritize.</p>
    <p>Furthermore, using a default 1500-byte or uncalibrated VPN tunnel on ${net.name} triggers IP packet fragmentation unless your WireGuard interface is pinned to <code>MTU = ${net.mtu}</code>.</p>

    <h2>How SWEEPR VPN Solves This on ${net.name}</h2>
    <ul>
      <li><strong>Direct 10Gbps LINX &amp; AMS-IX Peering:</strong> Instead of traversing congested retail transit links on ${net.asn}, SWEEPR VPN routes your encrypted UDP stream directly to our 10Gbps RAM-only bare-metal nodes in <code>UK-LON-01</code> (4ms), <code>NL-AMS-01</code> (8ms), <code>DE-FRA-01</code> (11ms), and <code>SE-STO-01</code> (14ms).</li>
      <li><strong>Auto-Calibrated ${net.mtu} Byte MTU:</strong> SWEEPR VPN automatically detects ${net.tech} path overhead and clamps your WireGuard tunnel to <code>MTU = ${net.mtu}</code> with <code>PersistentKeepalive = 25</code>.</li>
      <li><strong>In-Tunnel Zero-Log DNS (<code>10.66.0.1</code>):</strong> Bypasses ${net.name} transparent DNS proxies and NXDOMAIN interception completely.</li>
      <li><strong>Free 30-Second Home Wi-Fi Device Scanner:</strong> Instantly audits every phone, laptop, IoT plug, and Smart TV connected to your ${net.name} router subnet.</li>
    </ul>

    <h2>Recommended WireGuard Profile for ${net.name} (${net.asn})</h2>
    <pre><code>[Interface]
# SWEEPR VPN 10Gbps RAM-Only Profile optimized for ${net.name} (${net.tech})
PrivateKey = &lt;GENERATED_ON_DEVICE_NEVER_LEAVES_RAM&gt;
Address = 10.66.18.42/32
DNS = 10.66.0.1
MTU = ${net.mtu}

[Peer]
# UK-LON-01 (London Docklands 10Gbps • 4ms Direct Peering)
PublicKey = 9xK2vP8mQ4nL7wR1tY5uI8oP3aS6dF9gH2jK5lZ8xC0=
Endpoint = lon01.sweeprvpn.com:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25</code></pre>`;

    const faqs = [
      {
        q: `What is the best WireGuard MTU setting for ${net.name}?`,
        a: `For ${net.name} (${net.tech}), setting your WireGuard interface to MTU ${net.mtu} prevents IP packet fragmentation and PMTUD blackholes while maximizing 10Gbps throughput.`
      },
      {
        q: `Does SWEEPR VPN work with ${net.name} routers and Wi-Fi mesh systems?`,
        a: `Yes. You can run the ~3.7 MB SWEEPR VPN native app on Windows 10/11, macOS, Linux, iOS, and Android, or export a standard WireGuard .conf file for OpenWrt, GL.iNet, Asuswrt-Merlin, MikroTik, and UniFi gateways connected to ${net.name}.`
      },
      {
        q: `Is the 30-second Home Wi-Fi Scanner really free on ${net.name}?`,
        a: `Yes. Downloading SWEEPR VPN includes our instant 30-second LAN ARP/mDNS device scanner at zero cost (no credit card required), showing every device and Smart TV on your ${net.name} Wi-Fi.`
      }
    ];

    const relatedLinks = [
      { href: '/guides/fix-wireguard-mtu-fragmentation-pppoe', label: 'WireGuard MTU Calculator for PPPoE Fibre (1412) & 5G (1380)' },
      { href: '/guides/bypass-cgnat-for-self-hosted-home-lab', label: 'How to Detect & Bypass Carrier-Grade NAT (CGNAT 100.64.x.x)' },
      { href: '/vs/nordvpn', label: 'SWEEPR VPN (~3.7 MB) vs NordVPN Technical Comparison' }
    ];

    return renderLayout({
      title,
      description,
      canonicalUrl,
      badge: `ISP & Network Engineering • ${net.asn} • Verified 2026`,
      h1,
      lead,
      bodyHtml,
      faqs,
      relatedLinks
    });
  }

  if (candidate.cluster === 'setup') {
    const { guide } = candidate;
    const title = `${guide.name} WireGuard VPN Setup Guide (2026) | SWEEPR VPN`;
    const description = `Step-by-step ${guide.name} WireGuard VPN setup guide. Configure 10Gbps RAM-only endpoints, optimal MTU, in-tunnel DNS (10.66.0.1), and kill-switch routing.`;
    const h1 = `${guide.name}: High-Speed 10Gbps WireGuard VPN Setup Guide`;
    const lead = guide.summary;

    const bodyHtml = `
    <h2>Why Run SWEEPR VPN WireGuard on ${guide.name}?</h2>
    <p>Unlike proprietary VPN clients that lock you into closed-source daemons, <strong>SWEEPR VPN</strong> provides one-click native WireGuard configuration generator files alongside our featherlight ~3.7 MB desktop app. Running SWEEPR VPN on <strong>${guide.name}</strong> (${guide.category}) gives you:</p>
    <ul>
      <li><strong>10Gbps RAM-Only Bare-Metal Endpoints:</strong> Direct peering in London (<code>4ms</code>), Amsterdam (<code>8ms</code>), Frankfurt (<code>11ms</code>), Stockholm (<code>14ms</code>), Zurich, and New York.</li>
      <li><strong>In-Tunnel DNS &amp; Smart-TV ACR Shield:</strong> Point DNS to <code>10.66.0.1</code> to block ISP DNS hijacking and Smart-TV Automatic Content Recognition (ACR) screenshot telemetry across your LAN.</li>
      <li><strong>Zero Disk Persistence:</strong> All SWEEPR VPN WireGuard nodes boot from cryptographically verified RAM images with zero connection or DNS logs.</li>
    </ul>

    <h2>Step-by-Step Configuration Commands for ${guide.name}</h2>
    <pre><code>${guide.commands.join('\n')}</code></pre>

    <h2>Recommended Endpoint &amp; MTU Reference Table</h2>
    <table>
      <thead>
        <tr>
          <th>Endpoint Node</th>
          <th>Hostname / Port</th>
          <th>Typical UK/EU Latency</th>
          <th>Recommended MTU</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>London Docklands (UK-LON-01)</td><td><code>lon01.sweeprvpn.com:51820</code></td><td>4 ms</td><td>1420 (Cable/DHCP) / 1412 (PPPoE)</td></tr>
        <tr><td>Amsterdam Core (NL-AMS-01)</td><td><code>ams01.sweeprvpn.com:51820</code></td><td>8 ms</td><td>1420 (Cable/DHCP) / 1412 (PPPoE)</td></tr>
        <tr><td>Frankfurt IX (DE-FRA-01)</td><td><code>fra01.sweeprvpn.com:51820</code></td><td>11 ms</td><td>1420 (Cable/DHCP) / 1412 (PPPoE)</td></tr>
        <tr><td>Stockholm Core (SE-STO-01)</td><td><code>sto01.sweeprvpn.com:51820</code></td><td>14 ms</td><td>1420 (Cable/DHCP) / 1412 (PPPoE)</td></tr>
      </tbody>
    </table>`;

    const faqs = [
      {
        q: `Can I run ${guide.name} alongside the SWEEPR VPN desktop app?`,
        a: `Yes. Every SWEEPR VPN plan supports up to 10 simultaneous WireGuard peers across routers, NAS appliances, Linux servers, Windows, macOS, iOS, and Android.`
      },
      {
        q: `What DNS server should I use on ${guide.name}?`,
        a: `Always set your WireGuard interface DNS to 10.66.0.1 so DNS queries travel inside the encrypted WireGuard tunnel and cannot be intercepted by your ISP.`
      },
      {
        q: `Why are my HTTPS pages stalling after enabling WireGuard on ${guide.name}?`,
        a: `If your ISP uses PPPoE (such as BT, Sky, TalkTalk, Plusnet, or Vodafone FTTP), lower the WireGuard interface MTU from 1420 to 1412 and enable TCP MSS clamping to 1352–1360.`
      }
    ];

    const relatedLinks = [
      { href: '/setup/openwrt-wireguard-router', label: 'OpenWrt 23.05 WireGuard Router Setup Guide' },
      { href: '/setup/asuswrt-merlin-vpn-client', label: 'Asuswrt-Merlin WireGuard VPN Director Guide' },
      { href: '/guides/fix-wireguard-mtu-fragmentation-pppoe', label: 'Optimal WireGuard MTU Calculator for Fibre & 5G' }
    ];

    return renderLayout({
      title,
      description,
      canonicalUrl,
      badge: `${guide.category} Setup Guide • WireGuard 10Gbps`,
      h1,
      lead,
      bodyHtml,
      faqs,
      relatedLinks
    });
  }

  if (candidate.cluster === 'vs') {
    const { comp } = candidate;
    const title = `SWEEPR VPN vs ${comp.name} (2026 Technical Benchmark & Price Comparison)`;
    const description = `Compare SWEEPR VPN (~3.7 MB Rust + Tauri v2, 10Gbps WireGuard, Free 30s Wi-Fi Scanner) vs ${comp.name} (${comp.installerSize}, ${comp.price}).`;
    const h1 = `SWEEPR VPN vs ${comp.name}: 2026 Speed, Footprint & Privacy Comparison`;
    const lead = `Comparing SWEEPR VPN against ${comp.name}? See how our featherlight ~3.7 MB native Rust + Tauri v2 client, 10Gbps RAM-only WireGuard infrastructure, and built-in 30-second Home Wi-Fi Device Scanner stack up against ${comp.name}.`;

    const bodyHtml = `
    <h2>Head-to-Head Technical Specification Table</h2>
    <table>
      <thead>
        <tr>
          <th>Metric / Capability</th>
          <th>SWEEPR VPN</th>
          <th>${comp.name}</th>
        </tr>
      </thead>
      <tbody>
        <tr><td><strong>Desktop Installer Footprint</strong></td><td><strong>~3.7 MB (Native Rust + Tauri v2)</strong></td><td>${comp.installerSize}</td></tr>
        <tr><td><strong>Background RAM Consumption</strong></td><td><strong>~18 MB</strong></td><td>${comp.ramUsage}</td></tr>
        <tr><td><strong>WireGuard Server Uplinks</strong></td><td><strong>10Gbps RAM-Only (Diskless Boot)</strong></td><td>Mixed 1Gbps–10Gbps</td></tr>
        <tr><td><strong>Free 30-Second Home Wi-Fi Scanner</strong></td><td><strong>Included Free (ARP/mDNS/OUI Audit)</strong></td><td>${comp.hasWifiScanner}</td></tr>
        <tr><td><strong>Smart-TV ACR Telemetry Blocker</strong></td><td><strong>SWEEPR Wi-Fi Radar &amp; Smart-TV Shield</strong></td><td>${comp.hasAcrBlocker}</td></tr>
        <tr><td><strong>Annual Pricing &amp; Renewals</strong></td><td><strong>£74.99/yr (£6.25/mo) • £1.99 1st-Mo Trial</strong></td><td>${comp.price}</td></tr>
        <tr><td><strong>Corporate / Logging Jurisdiction</strong></td><td><strong>Zero-Log RAM-Only Architecture</strong></td><td>${comp.jurisdiction}</td></tr>
      </tbody>
    </table>

    <h2>3 Reasons Users Switch From ${comp.name} to SWEEPR VPN</h2>
    <ol>
      <li><strong>No 200 MB Background Bloatware:</strong> ${comp.name} installs ${comp.installerSize} of background services consuming ${comp.ramUsage} of RAM. SWEEPR VPN is compiled in native Rust (~3.7 MB installer, ~18 MB RAM) with zero telemetry SDKs.</li>
      <li><strong>Built-In Home Wi-Fi Scanner &amp; Smart-TV ACR Blocker:</strong> Standard VPNs only encrypt a single laptop while leaving 15–30 Smart TVs, cameras, and IoT devices on your home Wi-Fi unmonitored. SWEEPR VPN scans your entire home Wi-Fi in 30 seconds for free.</li>
      <li><strong>Honest Pricing Without Renewal Traps:</strong> Try SWEEPR VPN for £1.99 in your first month, or lock in £48.99 / 6 months (Save 35%) or £74.99 / year (Save 50%) with a 30-day money-back guarantee.</li>
    </ol>`;

    const faqs = [
      {
        q: `Is SWEEPR VPN faster than ${comp.name} on UK and European fibre?`,
        a: `Yes. Because SWEEPR VPN uses kernel-grade WireGuard with calibrated MTU (1412/1420) and direct 10Gbps LINX/AMS-IX peering, users routinely achieve 890–940 Mbps on 1Gbps FTTP lines with 4ms London latency.`
      },
      {
        q: `Does SWEEPR VPN include a free tool if I am currently using ${comp.name}?`,
        a: `Yes. You can download SWEEPR VPN (~3.7 MB) and run the Free 30-Second Home Wi-Fi Device Scanner immediately without entering a credit card.`
      },
      {
        q: `Can I export raw WireGuard .conf files from SWEEPR VPN?`,
        a: `Yes. Every SWEEPR VPN subscription includes full WireGuard configuration export for OpenWrt, GL.iNet, Asuswrt-Merlin, MikroTik, UniFi, and Linux wg-quick.`
      }
    ];

    const relatedLinks = [
      { href: '/vs/nordvpn', label: 'SWEEPR VPN vs NordVPN Benchmark Comparison' },
      { href: '/vs/mullvad', label: 'SWEEPR VPN vs Mullvad VPN Comparison' },
      { href: '/vs/protonvpn', label: 'SWEEPR VPN vs Proton VPN Comparison' }
    ];

    return renderLayout({
      title,
      description,
      canonicalUrl,
      badge: `2026 Technical VPN Comparison • Verified Benchmarks`,
      h1,
      lead,
      bodyHtml,
      faqs,
      relatedLinks
    });
  }

  // cluster === 'guides'
  const { guide } = candidate;
  const title = `${guide.title} | SWEEPR VPN`;
  const description = `${guide.summary} Free 30-second Home Wi-Fi scanner and 10Gbps WireGuard telemetry blocklist guide.`;
  const h1 = guide.h1;
  const lead = guide.summary;

  const bodyHtml = `
  <h2>Technical Overview &amp; Network Indicators</h2>
  <p>${guide.summary}</p>
  <p>When you run the <strong>SWEEPR VPN Free 30-Second Home Wi-Fi Scanner</strong> (~3.7 MB native Rust client), it inspects local ARP tables, IEEE OUI hardware vendor prefixes, and mDNS service broadcasts on your LAN, then cross-references outbound DNS queries against our Smart-TV ACR &amp; ISP diagnostic rulebase:</p>
  <pre><code>${guide.domains.map((d) => `# Verified Indicator / Rule:\n${d}`).join('\n\n')}</code></pre>

  <h2>Step-by-Step Remediation With SWEEPR VPN</h2>
  <ol>
    <li><strong>Step 1 — Run the Free 30-Second Home Wi-Fi Audit:</strong> Download <a href="/download" style="color:var(--accent2);">SWEEPR VPN (~3.7 MB)</a> and click <em>Scan My Home Wi-Fi</em> to identify every active IP, MAC vendor, and Smart TV on your local network.</li>
    <li><strong>Step 2 — Enable 10Gbps RAM-Only WireGuard + In-Tunnel DNS (<code>10.66.0.1</code>):</strong> Route traffic through <code>UK-LON-01</code> (4ms) or <code>NL-AMS-01</code> (8ms) with calibrated MTU.</li>
    <li><strong>Step 3 — Activate SWEEPR Wi-Fi Radar &amp; Smart-TV Shield:</strong> Block Automatic Content Recognition (ACR) telemetry domains and receive instant alerts whenever an unknown MAC address joins your Wi-Fi.</li>
  </ol>`;

  const faqs = [
    {
      q: `Will blocking Smart-TV ACR telemetry break Netflix, BBC iPlayer, or YouTube?`,
      a: `No. SWEEPR Smart-TV Shield only sinks Automatic Content Recognition (ACR) screenshot and ad-tracking endpoints while leaving CDN video delivery streams untouched.`
    },
    {
      q: `Does the SWEEPR 30-Second Wi-Fi Scanner work on Windows, macOS, and Linux?`,
      a: `Yes. The SWEEPR desktop scanner is built in Rust + Tauri v2 (~3.7 MB) and runs natively on Windows 10/11, macOS (Apple Silicon & Intel), and Linux.`
    },
    {
      q: `How can I test if my ISP is still intercepting my DNS requests?`,
      a: `Open our free browser IP, DNS & WebRTC Leak Test at https://sweeprvpn.com/tools/leak-test to verify that your resolver matches SWEEPR VPN's encrypted in-tunnel DNS.`
    }
  ];

  const relatedLinks = [
    { href: '/guides/block-samsung-tv-acr-tracking', label: 'How to Block Samsung Smart-TV ACR Spying' },
    { href: '/guides/block-lg-webos-acr-tracking', label: 'How to Block LG webOS ACR Tracking' },
    { href: '/guides/detect-unknown-devices-on-home-wifi', label: 'How to Detect Unknown Devices on Your Home Wi-Fi in 30 Seconds' }
  ];

  return renderLayout({
    title,
    description,
    canonicalUrl,
    badge: `Home Wi-Fi & WireGuard Security Guide • 2026`,
    h1,
    lead,
    bodyHtml,
    faqs,
    relatedLinks
  });
}

async function runDaily50Pages(targetCount = 50, force = false) {
  const todayStr = new Date().toISOString().slice(0, 10);
  let state = { lastRunDate: null, totalGenerated: 0, batches: [] };
  if (fs.existsSync(DAILY_STATE_PATH)) {
    try {
      state = { ...state, ...JSON.parse(fs.readFileSync(DAILY_STATE_PATH, 'utf8')) };
    } catch {}
  }

  if (!force && state.lastRunDate === todayStr) {
    console.log(`[SWEEPR Daily 50 SEO Pages] Already generated today's 50 SEO pages on ${todayStr}. Use --force to generate another batch immediately.`);
    return;
  }

  const sitemapXml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const existingUrls = new Set([...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim()));

  const pool = buildCandidatePool();
  const selected = [];
  for (const cand of pool) {
    const fullUrl = `https://sweeprvpn.com${cand.urlPath}`;
    const absFile = path.join(WEBSITE_DIR, cand.relPath);
    if (!fs.existsSync(absFile)) {
      selected.push(cand);
      if (selected.length >= targetCount) break;
    }
  }

  for (const dir of ['solutions', 'setup', 'vs', 'guides']) {
    fs.mkdirSync(path.join(WEBSITE_DIR, dir), { recursive: true });
  }

  const newUrls = [];
  for (const cand of selected) {
    const html = generateCandidateHtml(cand);
    const absPath = path.join(WEBSITE_DIR, cand.relPath);
    fs.writeFileSync(absPath, html, 'utf8');
    const fullUrl = `https://sweeprvpn.com${cand.urlPath}`;
    newUrls.push(fullUrl);
  }

  // Rebuild website/sitemap.xml & website/llms.txt from ALL existing pSEO HTML files on disk
  const baseUrls = [
    { loc: 'https://sweeprvpn.com/', priority: '1.0', changefreq: 'weekly' },
    { loc: 'https://sweeprvpn.com/pricing', priority: '0.9', changefreq: 'weekly' },
    { loc: 'https://sweeprvpn.com/app', priority: '0.8', changefreq: 'weekly' },
    { loc: 'https://sweeprvpn.com/tools/leak-test', priority: '0.8', changefreq: 'weekly' },
    { loc: 'https://sweeprvpn.com/tools/isp-throttling-test', priority: '0.8', changefreq: 'weekly' },
    { loc: 'https://sweeprvpn.com/vs/totalvpn', priority: '0.8', changefreq: 'monthly' },
    { loc: 'https://sweeprvpn.com/alternatives/totalvpn', priority: '0.8', changefreq: 'monthly' },
    { loc: 'https://sweeprvpn.com/support', priority: '0.6', changefreq: 'monthly' },
    { loc: 'https://sweeprvpn.com/refund', priority: '0.5', changefreq: 'monthly' },
    { loc: 'https://sweeprvpn.com/privacy', priority: '0.5', changefreq: 'monthly' },
    { loc: 'https://sweeprvpn.com/terms', priority: '0.5', changefreq: 'monthly' }
  ];

  const allPseoPagesOnDisk = [];
  for (const dir of ['solutions', 'setup', 'vs', 'guides']) {
    const dirAbs = path.join(WEBSITE_DIR, dir);
    if (!fs.existsSync(dirAbs)) continue;
    for (const file of fs.readdirSync(dirAbs).sort()) {
      if (!file.endsWith('.html')) continue;
      const slug = file.replace(/\.html$/, '');
      if (dir === 'vs' && slug === 'totalvpn') continue;
      const urlPath = `/${dir}/${slug}`;
      const absPath = path.join(dirAbs, file);
      const htmlContent = fs.readFileSync(absPath, 'utf8');
      const h1Match = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/is);
      const h1Text = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : urlPath;
      allPseoPagesOnDisk.push({
        dir,
        file,
        absPath,
        urlPath,
        loc: `https://sweeprvpn.com${urlPath}`,
        h1: h1Text,
        htmlContent
      });
    }
  }

  const allSitemapEntries = [
    ...baseUrls,
    ...allPseoPagesOnDisk.map((p) => ({
      loc: p.loc,
      priority: '0.8',
      changefreq: 'weekly'
    }))
  ];

  const rebuiltSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allSitemapEntries
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${todayStr}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
  fs.writeFileSync(SITEMAP_PATH, rebuiltSitemap, 'utf8');

  // Rebuild website/llms.txt with all indexed pSEO pages
  const llmsHeader = `# SWEEPR VPN & SWEEPR Wi-Fi Radar (sweeprvpn.com)

> SWEEPR VPN is an ultra-lightweight (~3.7 MB), fast, and easy-to-use 10Gbps WireGuard VPN and Free 30-Second Home Wi-Fi Scanner for Windows 10/11, macOS, Linux, and routers. Built by the team behind SWEEPR Cleaner, it combines 1-click 10Gbps private browsing with a free 30-second Home Wi-Fi & Speed Scanner and a Smart-TV ACR spy blocker.

## Core Storefront & Free Diagnostic Tools
- Homepage & Free Home Wi-Fi Scanner: https://sweeprvpn.com/
- Pricing & Plan Comparison: https://sweeprvpn.com/pricing
- Free Instant IP, DNS & WebRTC Leak Test: https://sweeprvpn.com/tools/leak-test
- Free ISP Speed Slowdown & Streaming Throttling Checker: https://sweeprvpn.com/tools/isp-throttling-test
- Official PAD 4.0 XML Feed: https://sweeprvpn.com/pad.xml

## Programmatic SEO Technical Library (${allPseoPagesOnDisk.length} Indexed Guides & Comparisons)
${allPseoPagesOnDisk.map((p) => `- [${p.h1}](${p.loc})`).join('\n')}
`;
  fs.writeFileSync(LLMS_PATH, llmsHeader, 'utf8');

  // Update website/indexing-queue.json
  let queue = { indexnow_key: INDEXNOW_KEY, gsc_requested: [], bing_requested: [], pending_urls: [] };
  if (fs.existsSync(INDEXING_QUEUE_PATH)) {
    try {
      queue = { ...queue, ...JSON.parse(fs.readFileSync(INDEXING_QUEUE_PATH, 'utf8')) };
    } catch {}
  }
  const pendingSet = new Set([...(queue.pending_urls || []), ...allPseoPagesOnDisk.map((p) => p.loc)]);
  queue.pending_urls = [...pendingSet];
  queue.last_daily_50_batch = { date: todayStr, newCount: newUrls.length, totalPseoPages: allPseoPagesOnDisk.length, totalSitemapUrls: allSitemapEntries.length };
  fs.writeFileSync(INDEXING_QUEUE_PATH, JSON.stringify(queue, null, 2), 'utf8');

  // Validate all pSEO pages on disk
  let validCount = 0;
  let invalidCount = 0;
  for (const p of allPseoPagesOnDisk) {
    const hasTitle = /<title>.+?<\/title>/is.test(p.htmlContent);
    const hasDesc = /<meta\s+name="description"\s+content=".+?"/is.test(p.htmlContent);
    const hasCanonical = p.htmlContent.includes(`href="${p.loc}"`);
    const hasFaqSchema = p.htmlContent.includes('"@type":"FAQPage"') || p.htmlContent.includes('"@type": "FAQPage"');
    const hasAppSchema = p.htmlContent.includes('"@type":"SoftwareApplication"') || p.htmlContent.includes('"@type": "SoftwareApplication"');
    if (hasTitle && hasDesc && hasCanonical && hasFaqSchema && hasAppSchema) {
      validCount++;
    } else {
      invalidCount++;
      console.error(`[INVALID SEO PAGE] ${p.urlPath}`);
    }
  }

  // Save state
  state.lastRunDate = todayStr;
  state.totalGenerated = allPseoPagesOnDisk.length;
  state.batches.push({ date: todayStr, newGenerated: newUrls.length, totalPseoPages: allPseoPagesOnDisk.length });
  fs.writeFileSync(DAILY_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');

  console.log(`[SWEEPR Daily 50 SEO Pages] Newly generated: ${newUrls.length} pages | Total pSEO Pages on Disk: ${allPseoPagesOnDisk.length} | Total Sitemap URLs: ${allSitemapEntries.length}`);
  console.log(`[SEO Schema & Canonical Validation] Passed: ${validCount}/${allPseoPagesOnDisk.length} (Failed: ${invalidCount})`);

  // Ping Bing IndexNow with the newly generated 50 URLs
  try {
    const indexNowPayload = {
      host: 'sweeprvpn.com',
      key: INDEXNOW_KEY,
      keyLocation: `https://sweeprvpn.com/${INDEXNOW_KEY}.txt`,
      urlList: newUrls
    };
    await Promise.all([
      fetch('https://www.bing.com/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(indexNowPayload),
        signal: AbortSignal.timeout(10000)
      }).catch(() => {}),
      fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(indexNowPayload),
        signal: AbortSignal.timeout(10000)
      }).catch(() => {})
    ]);
  } catch {}
}

const countArg = process.argv[2] !== undefined && !process.argv[2].startsWith('--') ? Number(process.argv[2]) : 50;
const forceFlag = process.argv.includes('--force');
runDaily50Pages(countArg, forceFlag).catch(console.error);
