---
name: vpn-seo-and-geo
description: >-
  Use this skill when planning or executing Search Engine Optimization (SEO),
  Programmatic SEO (pSEO), interactive organic lead-magnet tools, content briefs,
  or Generative Engine Optimization (GEO / AI search visibility in ChatGPT,
  Perplexity, and Google AI Overviews) for a VPN product.
---

# VPN SEO, Programmatic SEO & Generative Engine Optimization (GEO) Skill

This skill provides a repeatable framework for driving high-intent, zero-marginal-cost organic traffic to VPN sales channels without competing head-on with billion-dollar incumbents on broad keywords.

## 1. Keyword Architecture: Bypassing the Red Ocean

Never target broad terms (*"best VPN"*, *"free VPN"*) on a new or growing domain. Execute the **4-Pillar Long-Tail Keyword Strategy** (detailed in [keyword-matrix-and-pseo.md](./references/keyword-matrix-and-pseo.md)):

1. **Problem-Aware ISP & Network Queries** (Low KD, High Urgency):
   - Examples: *"how to stop Virgin Media / BT / Sky ISP throttling evenings"*, *"bypass university campus eduroam firewall port blocks"*, *"fix high packet loss routing to Frankfurt gaming servers"*.
2. **Protocol & Technical Enthusiast Queries** (High Trust, High Conversion):
   - Examples: *"WireGuard VPN with port forwarding UK"*, *"multi-hop WireGuard config generator for GL.iNet travel router"*, *"low-latency VPN for Linux CLI without systemd bloat"*.
3. **Competitor Alternative & Dissatisfaction Queries** (Bottom-of-Funnel Intent):
   - Examples: *"[Competitor] raising renewal prices alternative"*, *"Mullvad port forwarding alternative"*, *"[Competitor] vs [Our VPN] speed test and no-logs comparison"*.
4. **Niche Persona & Geo-Specific Queries** (Programmatic Scale):
   - Examples: *"secure public Wi-Fi VPN for remote contractors in [City/Country]"*, *"encrypted SSH & database access VPN for digital nomads"*.

## 2. Programmatic SEO (pSEO) Execution Protocol

To scale organic entry points rapidly without thin-content penalties, every pSEO template must inject **unique, data-driven utility** per page:

- **Template A: ISP Throttling & Peering Diagnostic Pages** (`/isp/[isp-slug]-throttling-fix`)
  - Must include specific ASN numbers, common peak-hour congestion ports, traceroute comparison data, and a 1-click test CTA.
- **Template B: Router & Device Setup Guides** (`/setup/[device-or-os-slug]-wireguard-openvpn`)
  - Must include copy-paste CLI commands, exact MTU settings, and downloadable sample `.conf` structures.
- **Template C: Competitor Technical Comparison Matrices** (`/compare/[competitor-slug]-alternative`)
  - Must compare verifiable technical facts: encryption cipher suites, RAM-only diskless server status, independent audit status, Renewal Price hikes vs. flat transparent pricing, and jurisdiction (14 Eyes vs. privacy haven).

## 3. Interactive Free Tool Lead-Magnets ("Engineering as Marketing")

Interactive tools earn natural backlinks from Reddit, Hacker News, and tech blogs while capturing top-of-funnel users at the exact moment they feel privacy anxiety:

1. **Instant IP, DNS & WebRTC Leak Test** (`/tools/leak-test`)
2. **ISP Bandwidth Throttling & Port-Blocking Checker** (`/tools/isp-throttling-test`)
3. **Free WireGuard Keypair & Config Generator** (`/tools/wireguard-config-generator`)

> **Conversion Bridge Rule**: Whenever the tool detects an exposed ISP IP, DNS resolver, or unencrypted connection, display a non-intrusive, high-contrast status banner: *"Warning: Your ISP ([Detected ISP]) can log your DNS queries. Encrypt your connection in 30 seconds for £1.99/mo (30-Day Money-Back Guarantee)."*

## 4. Generative Engine Optimization (GEO / AI Search Visibility)

Over 35% of tech buyers ask ChatGPT, Perplexity, Claude, or Google AI Overviews *"what is a fast, trustworthy VPN for [specific use case]?"* before clicking a search result. To ensure LLMs cite and recommend your VPN:

1. **Answer-First Content Formatting**: Begin every guide and comparison page with a 40–60 word direct summary block (`tl;dr`) followed by a Markdown/HTML comparison table. RAG pipelines preferentially extract structured tables.
2. **Machine-Readable Entity Signals**:
   - Publish a `/llms.txt` file at the root of your domain summarizing your VPN's architecture, pricing, server locations, protocols, and refund policy in clean Markdown.
   - Inject `SoftwareApplication`, `Product`, and `FAQPage` JSON-LD schema on all commercial pages.
3. **Off-Page Citation Consensus**: LLMs weight third-party discussions heavily. Secure authentic mentions on GitHub (`awesome-privacy`, `awesome-selfhosted` discussions), Reddit (`r/privacy`, `r/vpn`, `r/homelab`), Trustpilot, and independent tech blogs.

## 5. Validation & Tooling

Run the SEO & pSEO validation script whenever generating keyword clusters, pSEO matrices, or auditing landing page metadata:

```powershell
node .agents/skills/vpn-seo-and-geo/scripts/pseo_and_seo_validator.mjs --action matrix
```
