# SWEEPR VPN — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit Log

Daily automated operational verification for the SWEEPR WireGuard 10Gbps server fleet, MTU optimization presets, Smart-TV ACR sinkhole blocklist integrity, and strict streaming playback CDN safety.

## 2026-11-04 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-04T23:13:00.809Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `17`
- **Storefront Reachability**: HTTP `200` (`555ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `214ms` | `214ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `171ms` | `171ms` | `5` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `178ms` | `178ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `119ms` | `119ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `189ms` | `189ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `19ms` | `19ms` | `4` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `330ms` | `330ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `476ms` | `476ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-05 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-05T06:01:25.418Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `17`
- **Storefront Reachability**: HTTP `200` (`541ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `234ms` | `234ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `158ms` | `159ms` | `5` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `187ms` | `188ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `114ms` | `123ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `188ms` | `188ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `19ms` | `23ms` | `4` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `318ms` | `352ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `480ms` | `524ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-06 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-06T06:01:39.691Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `17`
- **Storefront Reachability**: HTTP `200` (`547ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `211ms` | `242ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `156ms` | `171ms` | `5` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `189ms` | `196ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `149ms` | `151ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `190ms` | `201ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `20ms` | `20ms` | `4` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `326ms` | `1212ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `485ms` | `509ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-07 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-07T18:19:05.021Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `17`
- **Storefront Reachability**: HTTP `200` (`1691ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `228ms` | `228ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `159ms` | `170ms` | `5` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `187ms` | `187ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `110ms` | `110ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `176ms` | `176ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `21ms` | `22ms` | `4` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `316ms` | `335ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `454ms` | `494ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-08 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-08T05:01:45.605Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `17`
- **Storefront Reachability**: HTTP `200` (`419ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `226ms` | `228ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `162ms` | `170ms` | `5` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `177ms` | `187ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `114ms` | `131ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `186ms` | `201ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `18ms` | `23ms` | `4` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `367ms` | `367ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `471ms` | `494ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-09 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-09T06:01:17.847Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `17`
- **Storefront Reachability**: HTTP `200` (`665ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `217ms` | `239ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `162ms` | `162ms` | `5` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `189ms` | `189ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `148ms` | `148ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `204ms` | `204ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `19ms` | `19ms` | `4` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `323ms` | `337ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `487ms` | `487ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-10 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-10T13:12:56.572Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `17`
- **Storefront Reachability**: HTTP `200` (`340ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `230ms` | `230ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `158ms` | `158ms` | `5` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `178ms` | `178ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `118ms` | `118ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `194ms` | `194ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `21ms` | `21ms` | `4` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `334ms` | `334ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `483ms` | `483ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-11 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-11T12:23:26.698Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `17`
- **Storefront Reachability**: HTTP `200` (`278ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `228ms` | `228ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `157ms` | `157ms` | `5` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `178ms` | `178ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `113ms` | `113ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `180ms` | `180ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `18ms` | `18ms` | `4` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `312ms` | `312ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `462ms` | `462ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-12 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-12T13:29:56.965Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `17`
- **Storefront Reachability**: HTTP `200` (`584ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `196ms` | `199ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `157ms` | `161ms` | `5` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `181ms` | `183ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `126ms` | `134ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `177ms` | `177ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `21ms` | `23ms` | `4` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `330ms` | `330ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `446ms` | `452ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-13 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-13T12:48:42.750Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `17`
- **Storefront Reachability**: HTTP `200` (`245ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `199ms` | `199ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `177ms` | `177ms` | `5` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `183ms` | `183ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `136ms` | `136ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `177ms` | `177ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `31ms` | `31ms` | `4` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `326ms` | `326ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `477ms` | `477ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-14 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-14T11:54:26.686Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `18`
- **Storefront Reachability**: HTTP `200` (`160ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `213ms` | `234ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `158ms` | `160ms` | `6` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `192ms` | `192ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `118ms` | `144ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `207ms` | `207ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `18ms` | `22ms` | `4` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `323ms` | `352ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `451ms` | `483ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-15 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-15T12:27:56.593Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `19`
- **Storefront Reachability**: HTTP `200` (`386ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `214ms` | `214ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `172ms` | `172ms` | `6` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `179ms` | `179ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `111ms` | `111ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `173ms` | `173ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `19ms` | `19ms` | `5` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `318ms` | `318ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `480ms` | `480ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-16 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-16T13:19:06.840Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `20`
- **Storefront Reachability**: HTTP `200` (`327ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `198ms` | `198ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `160ms` | `160ms` | `7` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `194ms` | `194ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `123ms` | `123ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `191ms` | `191ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `19ms` | `19ms` | `5` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `308ms` | `308ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `506ms` | `506ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-17 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-17T15:38:06.492Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `20`
- **Storefront Reachability**: HTTP `200` (`1112ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `199ms` | `211ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `163ms` | `163ms` | `7` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `178ms` | `178ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `129ms` | `129ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `179ms` | `179ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `21ms` | `22ms` | `5` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `332ms` | `332ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `449ms` | `449ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-18 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-18T13:38:23.206Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `20`
- **Storefront Reachability**: HTTP `200` (`301ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `185ms` | `247ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `161ms` | `161ms` | `7` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `177ms` | `196ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `122ms` | `136ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `185ms` | `205ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `18ms` | `20ms` | `5` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `324ms` | `344ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `458ms` | `512ms` | `3` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands (Telehouse North) | `lon01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **UK-MAN-02** | Manchester (Equinix MA1) | `man02.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `6.4ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam (Equinix AM7) | `ams01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt (DE-CIX Interconnect) | `fra01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `14.3ms` | `1420` / `1412` / `1380` |
| **CH-ZRH-01** | Zurich (SwissIX Privacy Core) | `zrh01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `17.8ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York / Secaucus (NY4) | `nyc01.wg.sweeprvpn.com` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-20 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-20T06:14:35.384Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `8`
- **Storefront Reachability**: HTTP `200` (`1037ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `cd2066c8a7c0`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `200ms` | `249ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `156ms` | `158ms` | `1` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `188ms` | `188ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `117ms` | `117ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `188ms` | `188ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `15ms` | `15ms` | `1` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `309ms` | `315ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `459ms` | `478ms` | `1` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands | `78.141.205.68` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam | `95.179.181.53` | `51820, 443` | 10 Gbps | `8.4ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt | `80.240.20.239` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **SE-STO-01** | Stockholm | `70.34.208.107` | `51820, 443` | 10 Gbps | `14.1ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York | `45.77.109.112` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |
| **US-LAX-01** | Los Angeles | `45.32.85.162` | `51820, 443` | 10 Gbps | `128ms` | `1420` / `1412` / `1380` |
| **JP-TYO-01** | Tokyo | `104.156.239.162` | `51820, 443` | 10 Gbps | `198.5ms` | `1420` / `1412` / `1380` |
| **SG-SIN-01** | Singapore | `149.28.157.142` | `51820, 443` | 10 Gbps | `152ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

## 2026-11-22 — Daily WireGuard Node Health & Smart-TV ACR Blocklist Audit

- **Timestamp**: `2026-11-22T01:16:04.975Z`
- **WireGuard Production Fleet Health**: **8/8 POPs Online (100%)** | Active Devices: `9`
- **Storefront Reachability**: HTTP `200` (`290ms` RTT)
- **Smart-TV ACR Sinkhole Blocklist**: `65` Verified Domains across `8` OS families (SHA-1: `9526d5e56139`)
- **Strict Compliance Rules**:
  - `NEVER BLOCK STREAMING PLAYBACK CDNs`: **PASS** (0 false positives; Netflix, BBC, ITV, Channel 4, YouTube, Disney+, Prime Video unblocked)
  - `DO NOT SEND EMAILS`: **PASS** (0 emails dispatched)

### Live WireGuard Production POPs
| POP Code | City | Country | Online Status | Probe Latency | p99 Latency | Connected Devices |
|:---|:---|:---:|:---:|:---:|:---:|:---:|
| **SE-STO-01** | Stockholm | Sweden (SE) | 🟢 Online | `230ms` | `237ms` | `1` |
| **UK-LON-01** | London | United Kingdom (GB) | 🟢 Online | `161ms` | `161ms` | `1` |
| **DE-FRA-01** | Frankfurt | Germany (DE) | 🟢 Online | `186ms` | `199ms` | `1` |
| **US-LAX-01** | Los Angeles | United States (US) | 🟢 Online | `123ms` | `124ms` | `1` |
| **NL-AMS-01** | Amsterdam | Netherlands (NL) | 🟢 Online | `169ms` | `205ms` | `1` |
| **US-NYC-01** | New York | United States (US) | 🟢 Online | `15ms` | `16ms` | `2` |
| **JP-TYO-01** | Tokyo | Japan (JP) | 🟢 Online | `313ms` | `355ms` | `1` |
| **SG-SIN-01** | Singapore | Singapore (SG) | 🟢 Online | `481ms` | `1468ms` | `1` |

### Core Bare-Metal 10Gbps Reference Configurations & MTU Presets
| POP ID | City | Endpoint | Ports | Capacity | Baseline RTT | MTU Presets (Std / PPPoE / CGNAT) |
|:---|:---|:---|:---:|:---:|:---:|:---:|
| **UK-LON-01** | London Docklands | `78.141.205.68` | `51820, 443` | 10 Gbps | `4.1ms` | `1420` / `1412` / `1380` |
| **NL-AMS-01** | Amsterdam | `95.179.181.53` | `51820, 443` | 10 Gbps | `8.4ms` | `1420` / `1412` / `1380` |
| **DE-FRA-01** | Frankfurt | `80.240.20.239` | `51820, 443` | 10 Gbps | `11.2ms` | `1420` / `1412` / `1380` |
| **SE-STO-01** | Stockholm | `70.34.208.107` | `51820, 443` | 10 Gbps | `14.1ms` | `1420` / `1412` / `1380` |
| **US-NYC-01** | New York | `45.77.109.112` | `51820, 443` | 10 Gbps | `68.4ms` | `1420` / `1412` / `1380` |
| **US-LAX-01** | Los Angeles | `45.32.85.162` | `51820, 443` | 10 Gbps | `128ms` | `1420` / `1412` / `1380` |
| **JP-TYO-01** | Tokyo | `104.156.239.162` | `51820, 443` | 10 Gbps | `198.5ms` | `1420` / `1412` / `1380` |
| **SG-SIN-01** | Singapore | `149.28.157.142` | `51820, 443` | 10 Gbps | `152ms` | `1420` / `1412` / `1380` |

### Smart-TV ACR & IoT Telemetry Categories Verified
1. **Samsung Tizen SmartHub & ACR Frame Fingerprinting** (`gpm.samsungqbe.com`, `ACR0.samsungcloudsolution.com`, etc.)
2. **LG webOS LivePlus ACR & Home Screen Ad Beacons** (`ibs.lgappstv.com`, `cdpbeacon.lgtvcommon.com`, etc.)
3. **Roku OS Automated Content Recognition & Ad Beacons** (`cooper.logs.roku.com`, `traces.sr.roku.com`, etc.)
4. **Vizio SmartCast (Inscape ACR) & Viewing Data Telemetry** (`tvinteractive.tv`, `inscape.tv`, etc.)
5. **Amazon Fire TV (FireOS) ACR & Marketing Telemetry** (`device-metrics-us.amazon.com`, `aax-us-east.amazon-adsystem.com`, etc.)
6. **Sony Bravia / Google TV / Android TV Interactive ACR** (`sonyselect.tv`, `agn.fe.ca.sambatv.com`, etc.)
7. **Hisense VIDAA & TCL Smart-TV Telemetry** (`msg.vidaahub.com`, `tcllauncher.tclclouds.com`, etc.)
8. **Cross-Vendor Samba TV, Alphonso & Gracenote ACR SDKs** (`api.cid.samba.tv`, `alphonso.tv`, `acr.gracenote.com`, etc.)

