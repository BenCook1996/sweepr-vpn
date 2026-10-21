# SWEEPR VPN — Master Design System (`design-system/MASTER.md`)

Generated with **`ui-ux-pro-max`** design intelligence and harmonized 1:1 with the **SWEEPR Cleaner** ("Technical Topography + Bento Grid") design language.

---

## 1. Visual Direction & Aesthetic Persona

- **Style Name**: **Technical Topography & Soft Bento Grid** (Holographic Pearl Light Mode + Deep Slate Dark Mode)
- **Brand Alignment**: Matches **SWEEPR Cleaner** (`sweepr-desktop`) so all SWEEPR desktop (Windows 10/11, macOS, and Linux) applications share one unified product family aesthetic.
- **Background Surface**: Cool alabaster slate (`#f4f7f9` / `#f8fafc`) overlaid with a subtle isometric diamond grid and flowing topographic contour curves (`topography.svg`, `opacity: 0.28`).
- **Elevation & Cards**: Soft frosted white Bento cards (`rgba(255, 255, 255, 0.92)`, `backdrop-filter: blur(20px)`, `border-radius: 22px`, `border: 1px solid rgba(226, 232, 240, 0.9)`, `box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.04)`).

---

## 2. Color Palette

| Token | Light Mode | Dark Mode | Usage |
| :--- | :--- | :--- | :--- |
| `--bg` | `#f4f7f9` | `#0f172a` | Root window background beneath topographic SVG |
| `--panel` | `rgba(255, 255, 255, 0.92)` | `rgba(30, 41, 59, 0.90)` | Bento cards and floating top navigation bar |
| `--panel-2` | `#f8fafc` | `#1e293b` | Secondary inner wells, device rows, and pill controls |
| `--border` | `rgba(226, 232, 240, 0.90)` | `rgba(51, 65, 85, 0.85)` | Card & input hairlines (1px solid) |
| `--text` | `#0f172a` | `#f8fafc` | Primary headings & metrics (minimum 12:1 contrast) |
| `--muted` | `#64748b` | `#94a3b8` | Subtitles, descriptions, and secondary metadata |
| `--accent` | `#059669` | `#10b981` | Primary brand emerald, active states, gauges |
| `--accent-grad` | `linear-gradient(135deg, #059669 0%, #10b981 100%)` | `linear-gradient(135deg, #059669 0%, #34d399 100%)` | Primary pill CTA buttons & brand icon |
| `--accent-soft` | `#dcfce7` / `rgba(16, 185, 129, 0.13)` | `rgba(16, 185, 129, 0.18)` | Active nav tab pill, `RECOMMENDED` / `SECURE` / `TOTAL` badges |
| `--pro-bg` / `--pro-text` | `#fef3c7` / `#b45309` | `rgba(245, 158, 11, 0.16)` / `#fbbf24` | `PRO` and `FREE` tier pills (`border: 1px solid rgba(245, 158, 11, 0.35)`) |
| `--info-soft` / `--info` | `#eff6ff` / `#3b82f6` | `rgba(59, 130, 246, 0.16)` / `#60a5fa` | Network / DNS / Smart-TV category icon bubbles |
| `--danger` | `#ef4444` | `#f87171` | Exposed IP / Unidentified Wi-Fi device alerts |

---

## 3. Typography & Hierarchy

- **Font Stack**: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI Variable", "Segoe UI", Roboto, sans-serif`
- **Monospace Stack** (IPs, MAC OUI, WireGuard keys, 6-digit Activation Key): `"JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace`
- **Scale**:
  - **Hero Greeting (`Welcome back!`)**: `28px` (`1.75rem`), `font-weight: 800`, `letter-spacing: -0.03em`
  - **Gauge Center Metric (`100%` / `4 ms`)**: `40px` (`2.5rem`), `font-weight: 800`, `color: #059669`
  - **Bento Section Header (`SECURITY & PRIVACY CHECKS`)**: `12px`, `font-weight: 800`, `text-transform: uppercase`, `letter-spacing: 0.08em`, `color: #64748b`
  - **Card Item Title**: `14px`, `font-weight: 700`, `color: #0f172a`
  - **Body / Description**: `12.5px–13.5px`, `line-height: 1.45`, `color: #64748b`

---

## 4. Layout & Component Architecture

### A. Desktop Window (`1080×720` default, responsive Bento Grid)
1. **Floating Top Pill Navigation Bar**:
   - Left: Rounded-xl emerald icon + `SWEEPR` (**bold dark**) `VPN` (**bold emerald**)
   - Center: 2 Pill tabs (`Dashboard`, `Wi-Fi Radar & Auto-Shield`) with SVG stroke icons; active tab uses `background: #dcfce7; color: #047857` (Server Locations are integrated directly as a dropdown in the Dashboard)
   - Right: Region/Currency selector (`GB - EN ▾`), `FREE` / `PRO` amber/emerald pill badge, and circular settings gear button (Light/Dark theme switch)
2. **Dashboard View (3-Column Bento Grid + 3 Bottom Horizontal Summary Cards)**:
   - **Column 1 (`PRIVACY RECOMMENDATIONS`)**: 3 actionable privacy items with pastel rounded-xl icons (`40×40px`), descriptions, `PRO` badges, and a full-width bottom action pill (`FIX 2 PRIVACY RISKS (PRO)`).
   - **Column 2 (`ENCRYPTED TUNNEL`)**: Semi-circular SVG arc gauge (`180°` arch) showing live protection score / latency, **interactive Server Location Dropdown (`#desktopServerSelect` — 8 global 10Gbps RAM-only nodes)** right inside the Dashboard card, primary emerald gradient pill CTA (`1-CLICK CONNECT`), and zero-logs reassurance line.
   - **Column 3 (`HOME WI-FI RADAR` & `TUNNEL SPEED & LATENCY`)**: Found devices count (`4 Devices`), segmented bar chart (`Trusted`, `Smart-TV/IoT`, `Gateway`), interactive LAN device list, divider, and live Ping/Throughput metrics with `SCAN` action.
   - **Bottom Row (3 Compact Horizontal Cards)**:
     - `SMART-TV SPY BLOCKER` (`142 Trackers Found` · `REVIEW`)
     - `WIFI DEVICES` (`4 Active on home LAN` · `DETECTED`)
     - `LIFETIME ENCRYPTED` (`18.40 GB (0 leaks)` · `TOTAL`)
3. **Wi-Fi Radar & Auto-Shield View (2-Column Split matching Cleaner's Schedule Tab)**:
   - **Left Card**: Background watcher toggle switch, scan frequency segmented control (`Real-Time | Every 15m | Hourly`), protocol selector (`WireGuard 10Gbps | AmneziaWG Stealth`), and selectable action cards with emerald border + `RECOMMENDED` badge.
   - **Right Card (`PROTECTION SHIELDS INCLUDED`)**: Scrollable checklist of 4 security shields (Samsung/LG ACR blocker, Roku/Vizio sinkhole, Router UPnP port check, Kernel Kill Switch) with green checkmarks and `PRO` pills.

---

## 5. UX Anti-Patterns Avoided (vs. Old UI)
- ❌ **Removed** harsh dark navy header bar clashing with stark white rectangular boxes.
- ❌ **Removed** raw `1px solid #999` monospace `<textarea>`/`<select>` dump for Wi-Fi scanner output.
- ❌ **Removed** inline raw HTML email/code inputs cluttering the primary connection card (moved to a clean modal & Account tab).
- ✅ **Added** SVG semi-circular arc gauge, pastel icon bubbles, segmented progress bars, and tactile pill buttons matching **SWEEPR Cleaner**.
