/**
 * Definitions for all 5 SWEEPR VPN 1080p technical proof videos.
 * Strictly aligned with AGENTS.md (zero geo-unblocking or streaming-bypass claims;
 * privacy, ACR telemetry sinkholing, MTU engineering, WireGuard CLI, and leak checks only).
 */

export const VIDEOS = [
  {
    id: '01',
    slug: '01-smart-tv-acr-blocklist',
    title: 'Stop Samsung & LG Smart-TV ACR Tracking (Free 65-Domain Blocklist)',
    tags: [
      'Smart TV ACR',
      'Samsung Tizen privacy',
      'LG webOS LivePlus',
      'Pi-hole Smart TV blocklist',
      'gpm.samsungqbe.com',
      'WireGuard DNS sinkhole',
      'AdGuard Home blocklist',
      'SWEEPR VPN'
    ],
    thumbnail: {
      kicker: 'FREE 65-DOMAIN BLOCKLIST',
      headline: 'STOP SMART-TV ACR SPYING',
      subline: 'Samsung Tizen • LG webOS • Roku • Vizio • Sony Samba TV',
      metricBadge: '0.0.0.0 DNS SINKHOLE // CC-BY 4.0'
    },
    intro: {
      badge: 'SMART-TV TELEMETRY AUDIT',
      title: 'Stop Smart-TV ACR Tracking Across Every HDMI Input',
      subtitle:
        'Why menu opt-outs reset after firmware updates—and how a 65-domain CC-BY 4.0 DNS blocklist silences ACR beacons without breaking streaming apps.',
      url: 'https://sweeprvpn.com/tools/smart-tv-tracking-check',
      stats: [
        { label: 'Sinkholed Hosts', value: '65 Verified Domains' },
        { label: 'TV Ecosystems', value: '8 Vendors Covered' },
        { label: 'License', value: 'Free CC-BY 4.0' }
      ]
    },
    outro: {
      title: 'Copy the 65-Domain ACR Blocklist or Automate It at the Gateway',
      subtitle:
        'Import the plain-text hosts file straight into Pi-hole, AdGuard Home, or OpenWrt dnsmasq, or pair your network with SWEEPR In-Tunnel DNS.',
      links: [
        { label: 'Interactive Smart-TV ACR Checker', url: 'https://sweeprvpn.com/tools/smart-tv-tracking-check' },
        { label: 'Raw CC-BY 4.0 Pi-hole Adlist (.txt)', url: 'https://sweeprvpn.com/smart-tv-acr-blocklist.txt' },
        { label: 'Samsung Tizen ACR Guide', url: 'https://sweeprvpn.com/guides/stop-samsung-smart-tv-acr-tracking' },
        { label: 'LG webOS LivePlus Guide', url: 'https://sweeprvpn.com/guides/stop-lg-smart-tv-acr-spying' }
      ]
    },
    scenes: [
      {
        kind: 'intro',
        chapter: 'Why Menu Opt-Outs Are Not Enough',
        url: 'https://sweeprvpn.com/tools/smart-tv-tracking-check',
        narration:
          'Modern Smart TVs capture Automatic Content Recognition fingerprints across broadcast and HDMI inputs every few seconds. Even when you uncheck Viewing Information Services in settings, firmware updates frequently reset opt-outs. Here is how to inspect those exact telemetry domains and sinkhole all sixty-five hosts for free.'
      },
      {
        kind: 'web',
        chapter: 'Live Smart-TV ACR Domain Inspector',
        url: 'https://sweeprvpn.com/tools/smart-tv-tracking-check',
        label: '01 // ACR Domain Inspector',
        narration:
          'Start with the free Smart-TV ACR Telemetry Checker on sweeprvpn.com. Selecting Samsung Tizen highlights gpm dot samsungqbe dot com and samsungacr dot com, while switching to LG webOS LivePlus surfaces lgtvcommon dot com and ibs dot lgappstv dot com. The tool covers Roku, Vizio Inscape, Fire TV, and Sony Samba TV, and copies zero-dot-zero-dot-zero-dot-zero sinkhole rules in one click.',
        steps: [
          { type: 'wait', ms: 1500 },
          { type: 'select', selector: '#tvBrandSelect', value: 'lg', pauseMs: 2200 },
          { type: 'select', selector: '#tvBrandSelect', value: 'roku', pauseMs: 2200 },
          { type: 'select', selector: '#tvBrandSelect', value: 'sony', pauseMs: 2200 },
          { type: 'select', selector: '#tvBrandSelect', value: 'samsung', pauseMs: 1800 },
          { type: 'click', selector: '#copyAcrBtn', pauseMs: 2000 },
          { type: 'scroll', y: 420, durationMs: 2500 }
        ]
      },
      {
        kind: 'web',
        chapter: '65-Domain CC-BY 4.0 Pi-hole & AdGuard List',
        url: 'https://sweeprvpn.com/smart-tv-acr-blocklist.txt',
        label: '02 // 65-Domain CC-BY 4.0 Hosts List',
        isPlainText: true,
        narration:
          'For Pi-hole, AdGuard Home, or OpenWrt dnsmasq, use the raw smart-tv-acr-blocklist dot txt URL directly as an adlist. It groups sixty-five verified telemetry hosts across eight vendor ecosystems including Hisense VIDAA, TCL, and cross-vendor Samba TV and Alphonso SDKs, leaving CDN playback endpoints untouched.',
        steps: [
          { type: 'wait', ms: 2000 },
          { type: 'scroll', y: 780, durationMs: 5000 },
          { type: 'scroll', y: 1650, durationMs: 5000 }
        ]
      },
      {
        kind: 'web',
        chapter: 'Samsung Tizen Settings + DNS Sinkhole Verification',
        url: 'https://sweeprvpn.com/guides/stop-samsung-smart-tv-acr-tracking',
        label: '03 // Samsung Tizen Opt-Out + Sinkhole',
        narration:
          'On Samsung Tizen televisions, pair your router or SWEEPR ten-dot-sixty-four DNS sinkhole with disabling Viewing Information Services and Interest-Based Advertisements under Terms and Privacy. That ensures firmware updates cannot silently restore background beacons.',
        steps: [
          { type: 'wait', ms: 1600 },
          { type: 'scroll', y: 900, durationMs: 3600 },
          { type: 'scrollSelector', selector: '#turn-off-acr-samsung-tv-steps', durationMs: 3600 }
        ]
      },
      {
        kind: 'web',
        chapter: 'LG webOS LivePlus Telemetry Hardening',
        url: 'https://sweeprvpn.com/guides/stop-lg-smart-tv-acr-spying',
        label: '04 // LG webOS LivePlus Guide',
        narration:
          'The companion LG webOS guide walks through turning off LivePlus under Additional Settings while keeping cdpbeacon dot lgtvcommon dot com and ad dot lgappstv dot com sinkholed at the gateway.',
        steps: [
          { type: 'wait', ms: 1600 },
          { type: 'scroll', y: 880, durationMs: 3800 },
          { type: 'scroll', y: 1850, durationMs: 3800 }
        ]
      },
      {
        kind: 'outro',
        chapter: 'Resources & Raw Adlist Links',
        url: 'https://sweeprvpn.com/smart-tv-acr-blocklist.txt',
        narration:
          'All four links and the raw Pi-hole adlist URL are in the description below. Subscribe for the next walkthrough on GL.iNet MTU tuning and Docker WireGuard.'
      }
    ]
  },

  {
    id: '02',
    slug: '02-glinet-wireguard-mtu',
    title: 'GL.iNet Beryl AX WireGuard Setup: Fix Hotel Wi-Fi With MTU 1380',
    tags: [
      'GL.iNet Beryl AX',
      'GL-MT3000 WireGuard',
      'WireGuard MTU 1380',
      'PPPoE WireGuard MTU 1412',
      'Travel router VPN setup',
      'Hotel Wi-Fi WireGuard',
      'OpenWrt WireGuard',
      'SWEEPR VPN'
    ],
    thumbnail: {
      kicker: 'GL.INET TRAVEL ROUTER',
      headline: 'FIX STALLED WIREGUARD WITH MTU 1380',
      subline: 'Beryl AX / Slate AX .conf Import • PPPoE 1412 vs Hotel 1380',
      metricBadge: '45-SEC IMPORT // 10.64.0.1 DNS'
    },
    intro: {
      badge: 'TRAVEL ROUTER ARCHITECTURE',
      title: 'GL.iNet WireGuard Setup & Captive Hotel MTU Tuning',
      subtitle:
        'Import a standard .conf profile onto Beryl AX or Slate AX in 45 seconds—and fix silent TLS hangs on PPPoE and hotel Wi-Fi by dropping MTU from 1420 to 1380.',
      url: 'https://sweeprvpn.com/setup/gl-inet-travel-router',
      stats: [
        { label: 'Home / Direct MTU', value: '1420' },
        { label: 'PPPoE Fibre MTU', value: '1412' },
        { label: 'Hotel / Captive MTU', value: '1380' }
      ]
    },
    outro: {
      title: 'Tune Once on Your Travel Router, Protect Every Device Behind It',
      subtitle:
        'Check your baseline round-trip ping and jitter before travel, and pick 1420, 1412, or 1380 to eliminate packet fragmentation.',
      links: [
        { label: 'GL.iNet Travel Router Setup Guide', url: 'https://sweeprvpn.com/setup/gl-inet-travel-router' },
        { label: 'WireGuard MTU & PPPoE Guide', url: 'https://sweeprvpn.com/guides/fix-wireguard-mtu-fragmentation-pppoe' },
        { label: 'ISP RTT & Jitter Baseline Probe', url: 'https://sweeprvpn.com/tools/isp-throttling-test' }
      ]
    },
    scenes: [
      {
        kind: 'intro',
        chapter: 'Why WireGuard Hangs on Hotel Wi-Fi',
        url: 'https://sweeprvpn.com/setup/gl-inet-travel-router',
        narration:
          'When WireGuard completes a handshake on hotel Wi-Fi or PPPoE broadband but HTTPS pages spin forever, the culprit is almost always Path MTU blackholing. Here is how to deploy a native dot conf profile on GL.iNet routers and set the exact MTU that avoids silent fragmentation.'
      },
      {
        kind: 'web',
        chapter: 'GL.iNet .conf Profile & Hardware Throughput',
        url: 'https://sweeprvpn.com/setup/gl-inet-travel-router',
        label: '01 // GL.iNet Beryl AX WireGuard',
        narration:
          'Inside the GL.iNet WireGuard guide, you get a clean standard Interface and Peer block using ten-dot-sixty-four internal DNS, UDP port fifty-one eight-twenty, and PersistentKeepalive twenty-five for NAT traversal. A single router slot covers your laptop, phone, and Apple TV with three hundred plus megabits per second on Beryl AX.',
        steps: [
          { type: 'wait', ms: 1600 },
          { type: 'scroll', y: 480, durationMs: 3200 },
          { type: 'scroll', y: 1200, durationMs: 4200 },
          { type: 'scroll', y: 1950, durationMs: 4200 }
        ]
      },
      {
        kind: 'web',
        chapter: 'MTU 1420 vs PPPoE 1412 vs Hotel 1380 Overhead Math',
        url: 'https://sweeprvpn.com/guides/fix-wireguard-mtu-fragmentation-pppoe',
        label: '02 // WireGuard MTU Fragmentation Guide',
        narration:
          'WireGuard adds eighty bytes of IPv4 UDP and Noise header overhead. On standard fifteen-hundred-byte Ethernet, M T U fourteen-twenty fits cleanly. Over PPPoE fibre, subtract another eight bytes down to fourteen-twelve. On restrictive hotel or airport gateways dropping ICMP errors, set M T U to thirteen-eighty to restore instant loading.',
        steps: [
          { type: 'wait', ms: 1600 },
          { type: 'scroll', y: 800, durationMs: 4500 },
          { type: 'scroll', y: 1650, durationMs: 4500 }
        ]
      },
      {
        kind: 'web',
        chapter: 'Verify Baseline RTT & Jitter in Browser',
        url: 'https://sweeprvpn.com/tools/isp-throttling-test',
        label: '03 // Live RTT & Jitter Baseline Probe',
        narration:
          'Before connecting on unfamiliar Wi-Fi, run the five-sample TLS ping probe to baseline latency and jitter, then re-test through your tunnel endpoint.',
        steps: [
          { type: 'wait', ms: 2000 },
          { type: 'click', selector: '#runProbeBtn', pauseMs: 3600 },
          { type: 'scroll', y: 420, durationMs: 2800 }
        ]
      },
      {
        kind: 'outro',
        chapter: 'GL.iNet & MTU Reference Links',
        url: 'https://sweeprvpn.com/guides/fix-wireguard-mtu-fragmentation-pppoe',
        narration:
          'Copy the GL.iNet config snippet and MTU cheat sheet using the links in the description.'
      }
    ]
  },

  {
    id: '03',
    slug: '03-steam-deck-wireguard',
    title: 'Steam Deck WireGuard VPN in 60 Seconds (No RootFS Unlock Needed)',
    tags: [
      'Steam Deck VPN',
      'SteamOS WireGuard',
      'nmcli WireGuard import',
      'Steam Deck Desktop Mode',
      'Handheld gaming VPN',
      'Campus Wi-Fi gaming',
      'SWEEPR VPN'
    ],
    thumbnail: {
      kicker: 'STEAMOS 3.5+ // NO ROOT UNLOCK',
      headline: 'STEAM DECK WIREGUARD IN 60 SECONDS',
      subline: 'Two nmcli Commands • Survives SteamOS Updates • 4ms London IXP',
      metricBadge: 'NMCLI IMPORT // ZERO BLOATWARE'
    },
    intro: {
      badge: 'STEAMOS 3.5+ NETWORKMANAGER',
      title: 'Native WireGuard on Steam Deck Without Unlocking RootFS',
      subtitle:
        'Skip third-party Electron apps and immutable filesystem hacks—import your .conf profile straight into KDE NetworkManager with two terminal commands.',
      url: 'https://sweeprvpn.com/setup/steam-deck-vpn',
      stats: [
        { label: 'CLI Method', value: 'nmcli import' },
        { label: 'RootFS Unlock', value: 'Not Required' },
        { label: 'Tunnel MTU', value: '1420 / 1380' }
      ]
    },
    outro: {
      title: 'Persistent Across SteamOS Updates & Both Gaming + Desktop Modes',
      subtitle:
        'Once imported into NetworkManager, toggle the WireGuard tunnel from Desktop Mode before switching back into Gaming Mode.',
      links: [
        { label: 'Steam Deck & SteamOS WireGuard Guide', url: 'https://sweeprvpn.com/setup/steam-deck-vpn' },
        { label: 'Public Hotel & Airport Wi-Fi Guide', url: 'https://sweeprvpn.com/guides/public-hotel-airport-wifi-security' },
        { label: 'Browser IP, DNS & WebRTC Check', url: 'https://sweeprvpn.com/tools/leak-test' }
      ]
    },
    scenes: [
      {
        kind: 'intro',
        chapter: 'Keep Immutable SteamOS Clean',
        url: 'https://sweeprvpn.com/setup/steam-deck-vpn',
        narration:
          'Disabling read-only mode on SteamOS just to install a VPN daemon breaks cleanly on the next system update. Instead, SteamOS three-point-five and newer ships kernel WireGuard support directly inside NetworkManager.'
      },
      {
        kind: 'web',
        chapter: 'Two-Command nmcli Import on SteamOS',
        url: 'https://sweeprvpn.com/setup/steam-deck-vpn',
        label: '01 // SteamOS nmcli WireGuard Import',
        narration:
          'Switch to Desktop Mode, open Konsole, and run nmcli connection import type wireguard pointing to your dot conf file, then bring the connection up. Verify tunnel reachability by pinging ten-dot-sixty-four-dot-zero-dot-one. Because NetworkManager stores profiles in etc, your tunnel persists across SteamOS updates.',
        steps: [
          { type: 'wait', ms: 1600 },
          { type: 'scroll', y: 450, durationMs: 3600 },
          { type: 'scroll', y: 1200, durationMs: 4200 },
          { type: 'scroll', y: 1950, durationMs: 4200 }
        ]
      },
      {
        kind: 'web',
        chapter: 'Public Hotel & Airport Captive Portal Workflow',
        url: 'https://sweeprvpn.com/guides/public-hotel-airport-wifi-security',
        label: '02 // Public Hotel & Airport Wi-Fi',
        narration:
          'On captive hotel or airport networks, complete the browser portal login first, then activate the WireGuard tunnel so shared-subnet ARP sniffing and insecure HTTP traffic stay encrypted.',
        steps: [
          { type: 'wait', ms: 1600 },
          { type: 'scroll', y: 800, durationMs: 3800 },
          { type: 'scroll', y: 1600, durationMs: 3800 }
        ]
      },
      {
        kind: 'web',
        chapter: 'Verify Egress & WebRTC Inside Desktop Browser',
        url: 'https://sweeprvpn.com/tools/leak-test',
        label: '03 // Verify Tunnel IP in Browser',
        narration:
          'Before jumping into a session on public Wi-Fi, run the five-second leak check to confirm DNS routes inside the tunnel and no raw local WebRTC candidates leak.',
        steps: [
          { type: 'wait', ms: 2000 },
          { type: 'click', selector: '#retestBtn', pauseMs: 2800 },
          { type: 'scroll', y: 360, durationMs: 2400 }
        ]
      },
      {
        kind: 'outro',
        chapter: 'Copy the Exact SteamOS Commands',
        url: 'https://sweeprvpn.com/setup/steam-deck-vpn',
        narration:
          'Grab the exact copy-paste nmcli commands and captive portal checklist from the links in the description.'
      }
    ]
  },

  {
    id: '04',
    slug: '04-synology-docker-gluetun',
    title: 'Synology DSM 7.2 WireGuard VPN in Docker (Gluetun Kill-Switch)',
    tags: [
      'Synology WireGuard Docker',
      'Gluetun Synology DSM 7.2',
      'Docker Compose WireGuard',
      'Container Manager VPN',
      'Homelab VPN kill switch',
      '10.64.0.1 DNS',
      'SWEEPR VPN'
    ],
    thumbnail: {
      kicker: 'SYNOLOGY DSM 7.2 // DOCKER',
      headline: 'GLUETUN WIREGUARD + KILL SWITCH',
      subline: 'qmcgaw/gluetun:latest • Zero NAS Host Routing Conflict',
      metricBadge: 'NL-AMS-01 / SE-STO-01 // 10GBPS'
    },
    intro: {
      badge: 'HOMELAB CONTAINER NETWORKING',
      title: 'Synology DSM 7.2 WireGuard Inside Docker With Gluetun',
      subtitle:
        'Bind selected homelab containers to an isolated WireGuard tunnel with a built-in firewall kill switch—without touching DSM host routing or QuickConnect.',
      url: 'https://sweeprvpn.com/setup/synology-nas-docker-vpn',
      stats: [
        { label: 'Image', value: 'qmcgaw/gluetun' },
        { label: 'Kill Switch', value: 'Container Firewall' },
        { label: 'Resolver', value: '10.64.0.1 DNS' }
      ]
    },
    outro: {
      title: 'Zero Split-Tunnel Leaks, Zero DSM Host Disruption',
      subtitle:
        'Use custom provider variables in Synology Container Manager so only attached services route out via Amsterdam or Stockholm WireGuard.',
      links: [
        { label: 'Synology NAS Docker Gluetun Guide', url: 'https://sweeprvpn.com/setup/synology-nas-docker-vpn' },
        { label: 'IP, DNS & WebRTC Leak Test', url: 'https://sweeprvpn.com/tools/leak-test' },
        { label: 'Smart-TV & IoT DNS Sinkhole List', url: 'https://sweeprvpn.com/smart-tv-acr-blocklist.txt' }
      ]
    },
    scenes: [
      {
        kind: 'intro',
        chapter: 'Why Isolate VPN Routing Inside Gluetun',
        url: 'https://sweeprvpn.com/setup/synology-nas-docker-vpn',
        narration:
          'Putting a whole-host VPN on a Synology NAS often breaks local SMB shares or remote admin access. Running Gluetun inside Synology Container Manager isolates WireGuard purely to the containers you attach via network mode.'
      },
      {
        kind: 'web',
        chapter: 'Verified Gluetun Docker Compose Snippet',
        url: 'https://sweeprvpn.com/setup/synology-nas-docker-vpn',
        label: '01 // Synology Gluetun Compose',
        narration:
          'Use qmcgaw slash gluetun colon latest with NET_ADMIN capability and slash dev slash net slash tun. Set VPN_SERVICE_PROVIDER to custom, VPN_TYPE to wireguard, point WIREGUARD_ENDPOINT_IP to Amsterdam or Stockholm, and lock DNS_ADDRESS to ten-dot-sixty-four-dot-zero-dot-one so traffic drops immediately if a handshake fails.',
        steps: [
          { type: 'wait', ms: 1600 },
          { type: 'scroll', y: 460, durationMs: 3600 },
          { type: 'scroll', y: 1200, durationMs: 4200 },
          { type: 'scroll', y: 1950, durationMs: 4200 }
        ]
      },
      {
        kind: 'web',
        chapter: 'In-Tunnel DNS Sinkholing at 10.64.0.1 / 10.66.0.1',
        url: 'https://sweeprvpn.com/tools/smart-tv-tracking-check',
        label: '02 // Built-In DNS Blocklist Coverage',
        narration:
          'When Docker workloads or router clients resolve through the internal tunnel resolver, the same telemetry blocklist patterns can also inspect and drop known tracker hosts at DNS lookup time.',
        steps: [
          { type: 'wait', ms: 1500 },
          { type: 'select', selector: '#tvBrandSelect', value: 'samsung', pauseMs: 2200 },
          { type: 'select', selector: '#tvBrandSelect', value: 'lg', pauseMs: 2200 },
          { type: 'scroll', y: 400, durationMs: 2400 }
        ]
      },
      {
        kind: 'web',
        chapter: 'Verify Container Egress & DNS Privacy',
        url: 'https://sweeprvpn.com/tools/leak-test',
        label: '03 // Verify Egress & DNS Isolation',
        narration:
          'Validate public egress and WebRTC exposure in your browser or curl container check before leaving services running unattended.',
        steps: [
          { type: 'wait', ms: 1800 },
          { type: 'click', selector: '#retestBtn', pauseMs: 2600 }
        ]
      },
      {
        kind: 'outro',
        chapter: 'Copy the Gluetun Docker Compose Template',
        url: 'https://sweeprvpn.com/setup/synology-nas-docker-vpn',
        narration:
          'Find the full Docker Compose YAML, Amsterdam and Stockholm endpoint notes, and MTU defaults linked below.'
      }
    ]
  },

  {
    id: '05',
    slug: '05-webrtc-dns-isp-throttling-check',
    title: 'Check WebRTC, IPv6, DNS Leaks & ISP Throttling Free in 30 Seconds',
    tags: [
      'WebRTC leak test',
      'DNS leak test online',
      'IPv6 VPN leak fix',
      'ISP throttling test',
      'Chromium WebRTC leak',
      'SWEEPR VPN free tools'
    ],
    thumbnail: {
      kicker: 'FREE PRIVACY DIAGNOSTICS',
      headline: 'CHECK WEBRTC, DNS & ISP THROTTLING',
      subline: '5-Second ICE STUN Probe + 5-Sample TLS Latency Test',
      metricBadge: 'ZERO SIGNUP // 100% IN-BROWSER'
    },
    intro: {
      badge: 'BROWSER DIAGNOSTIC SUITE',
      title: 'Test IPv4/IPv6, WebRTC ICE & ISP Throttling in 30 Seconds',
      subtitle:
        'A VPN client saying "Connected" is not proof by itself—verify what STUN candidates, DNS resolvers, and peak-hour TLS jitter actually reveal.',
      url: 'https://sweeprvpn.com/tools/leak-test',
      stats: [
        { label: 'WebRTC Check', value: 'STUN ICE Probe' },
        { label: 'Shaping Probe', value: '5-Sample TLS RTT' },
        { label: 'Signup Required', value: 'None (Free)' }
      ]
    },
    outro: {
      title: 'Audit Before and After Connecting Your WireGuard Tunnel',
      subtitle:
        'Bookmark both browser diagnostics plus the Chromium, Firefox, Windows, and Linux leak hardening checklists.',
      links: [
        { label: 'Free IP, DNS & WebRTC Leak Test', url: 'https://sweeprvpn.com/tools/leak-test' },
        { label: 'Free ISP Speed & Throttling Probe', url: 'https://sweeprvpn.com/tools/isp-throttling-test' },
        { label: 'Fix WebRTC Leaks (Chrome/Firefox)', url: 'https://sweeprvpn.com/guides/prevent-webrtc-ip-leak-chromium-firefox' },
        { label: 'Fix IPv6 Leaks (Windows/Linux)', url: 'https://sweeprvpn.com/guides/disable-ipv6-leak-windows-linux' }
      ]
    },
    scenes: [
      {
        kind: 'intro',
        chapter: 'Why Connected Does Not Always Mean Private',
        url: 'https://sweeprvpn.com/tools/leak-test',
        narration:
          'Even when an operating system shows an active VPN interface, browser WebRTC STUN requests, fallback IPv6 routes, or unencrypted ISP DNS can leak your real network identity. Here are two instant zero-signup checks and the OS hardening steps to lock them down.'
      },
      {
        kind: 'web',
        chapter: 'Run the Browser IP, DNS & WebRTC Leak Probe',
        url: 'https://sweeprvpn.com/tools/leak-test',
        label: '01 // IP, DNS & WebRTC Leak Probe',
        narration:
          'Opening slash tools slash leak-test immediately inspects your visible IP address, region, STUN ICE candidates, and DNS exposure in under five seconds, using a masked demo address here for privacy. Run the check once off-VPN and once connected to confirm your endpoint changes.',
        steps: [
          { type: 'wait', ms: 2000 },
          { type: 'click', selector: '#retestBtn', pauseMs: 2600 },
          { type: 'scroll', y: 520, durationMs: 3200 }
        ]
      },
      {
        kind: 'web',
        chapter: 'Measure Ping Variance With the ISP Throttling Checker',
        url: 'https://sweeprvpn.com/tools/isp-throttling-test',
        label: '02 // 5-Sample RTT & Jitter Probe',
        narration:
          'Next, open the ISP Speed and Throttling Checker to sample five TLS round-trip pings and jitter. Compare evening baseline jitter against a WireGuard tunnel to spot whether deep packet inspection is shaping specific traffic.',
        steps: [
          { type: 'wait', ms: 2000 },
          { type: 'click', selector: '#runProbeBtn', pauseMs: 3600 },
          { type: 'scroll', y: 450, durationMs: 2600 }
        ]
      },
      {
        kind: 'web',
        chapter: 'Harden Chromium & Firefox WebRTC Policies',
        url: 'https://sweeprvpn.com/guides/prevent-webrtc-ip-leak-chromium-firefox',
        label: '03 // Browser WebRTC Hardening',
        narration:
          'If WebRTC flags a candidate leak, follow the Chromium and Firefox hardening guide to disable non-proxied UDP in Firefox media dot peerconnection settings or enforce Chromium IP handling policies.',
        steps: [
          { type: 'wait', ms: 1600 },
          { type: 'scroll', y: 900, durationMs: 4000 }
        ]
      },
      {
        kind: 'web',
        chapter: 'Stop Windows 11 & Linux IPv6 Dual-Stack Leaks',
        url: 'https://sweeprvpn.com/guides/disable-ipv6-leak-windows-linux',
        label: '04 // Windows & Linux IPv6 Leak Fix',
        narration:
          'Finally, if your ISP assigns dual-stack IPv6 alongside an IPv4-only route, follow the Windows and Linux guide to sinkhole or disable unrouted IPv6 interfaces cleanly.',
        steps: [
          { type: 'wait', ms: 1600 },
          { type: 'scroll', y: 900, durationMs: 4000 }
        ]
      },
      {
        kind: 'outro',
        chapter: 'Bookmark Both Free Tools & Hardening Guides',
        url: 'https://sweeprvpn.com/tools/leak-test',
        narration:
          'Both browser tools require zero account signup and are linked in the description along with the browser and IPv6 hardening guides.'
      }
    ]
  }
];
