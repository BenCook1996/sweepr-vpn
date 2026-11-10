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

