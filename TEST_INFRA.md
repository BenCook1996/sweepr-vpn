# SWEEPR VPN — E2E Testing Infrastructure (`TEST_INFRA.md`)

## 1. Overview & Test Philosophy

This document defines the architecture, execution model, feature mapping, and verification criteria for the SWEEPR VPN Google Search Console (GSC) Root-Cause Turnaround end-to-end (E2E) testing suite.

### 1.1 Core Testing Principles
1. **Zero External NPM Dependencies**:
   The entire test infrastructure is built using native Node.js ESM modules (`>= 24.0.0`). Standard built-in modules (`node:net`, `node:http`, `node:child_process`, `node:fs`, `node:path`, `node:crypto`) and the native global `fetch` API are used exclusively. No Jest, Mocha, Playwright, or external dependencies are required.
2. **Opaque-Box Verification**:
   Tests evaluate the system from an external perspective: HTTP status codes (200, 301, 404), HTTP headers (`Location`, `X-Content-Type-Options`), DOM and XML structure, and CLI process exit codes. Implementation details remain decoupled from test assertions.
3. **Dynamic Ephemeral Port Allocation**:
   `website/server.mjs:20` contains `const PORT = Number(process.env.PORT) || 8080`. In JavaScript, `Number('0')` evaluates to `0`, which is falsy and triggers the `8080` fallback. The test harness employs a pre-allocated dynamic ephemeral port mechanism via `net.createServer().listen(0, '127.0.0.1')`, ensuring zero port collisions and full concurrency safety.
4. **Guaranteed Child Process Lifecycle Teardown**:
   The test runner spawns `node website/server.mjs` on an allocated ephemeral port, monitors stdout/health for readiness, and registers process-level exit hooks (`SIGINT`, `SIGTERM`, `exit`, `uncaughtException`) with cross-platform termination (`taskkill /pid <pid> /T /F` on Windows) to prevent orphan background processes.
5. **Progressive Testability & Anti-Facade Integrity**:
   Tests assert genuine specifications derived from authoritative requirements. No dummy facades or hardcoded pass shortcuts are permitted.

---

## 2. Directory Layout & Module Responsibilities

```
tests/e2e/
├── helpers.mjs              # Shared utility module (assertions, ephemeral port, server lifecycle, HTTP, DOM, 5-gram)
├── runner.mjs               # Standalone test runner CLI with filtering, self-test mode, and summary reporting
├── tier1-features.mjs       # Tier 1: 110 primary functional test cases (F1–F22, 5 tests per feature)
├── tier2-boundaries.mjs     # Tier 2: 110 boundary, limit, and corner test cases (F1–F22, 5 tests per feature)
├── tier3-cross-feature.mjs  # Tier 3: 22 pairwise interaction test cases (P01–P22)
└── tier4-scenarios.mjs      # Tier 4: 11 real-world user & bot workflow scenario tests (S01–S11)
```

### Module Responsibilities

| File | Purpose | Test Count | Key Exports |
|---|---|:---:|---|
| `helpers.mjs` | Reusable utilities & assertions | — | `getFreePort()`, `startServer()`, `stopServer()`, `fetchOpaque()`, `calculate5GramOverlap()`, `validateSitemapXml()`, assertions |
| `runner.mjs` | Test harness & CLI runner | — | CLI interface, runner engine, summary tables, `--self-test` harness |
| `tier1-features.mjs` | Primary functional coverage | 110 | `tier1Tests` array (F1–F22, 5 tests/feature) |
| `tier2-boundaries.mjs` | Boundaries & negative cases | 110 | `tier2Tests` array (F1–F22, 5 tests/feature) |
| `tier3-cross-feature.mjs`| Cross-feature interactions | 22 | `tier3Tests` array (P01–P22) |
| `tier4-scenarios.mjs` | End-to-end workflows | 11 | `tier4Scenarios` array (S01–S11) |
| **Total** | | **253** | |

---

## 3. Test Runner CLI Interface (`tests/e2e/runner.mjs`)

The test runner provides a comprehensive command-line interface supporting targeted execution, verbose logging, summary tables, and self-testing.

### 3.1 CLI Arguments

| Flag | Argument | Description | Example |
|---|---|---|---|
| `--tier` | Comma-separated tiers (`1,2,3,4`) | Restrict execution to specific tiers | `node tests/e2e/runner.mjs --tier=1,3` |
| `--feature` | Comma-separated IDs (`F1..F22`) | Restrict execution to specific features | `node tests/e2e/runner.mjs --feature=F1,F4` |
| `--verbose` | None | Enable verbose per-test logs, timing, and error stacks | `node tests/e2e/runner.mjs --verbose` |
| `--summary` | None | Display tabular breakdown by tier and feature | `node tests/e2e/runner.mjs --summary` |
| `--self-test`| None | Validate registry counts, syntax, and helpers (no server needed) | `node tests/e2e/runner.mjs --self-test` |
| `--baseUrl` | Server URL | Target an external running server instead of spawning a local child | `node tests/e2e/runner.mjs --baseUrl=http://127.0.0.1:8080` |
| `--help` | None | Show command-line options and usage examples | `node tests/e2e/runner.mjs --help` |

### 3.2 Exit Code Semantics
- **Exit Code 0**: All executed test assertions passed successfully.
- **Exit Code 1**: One or more assertions failed or a fatal error occurred.

---

## 4. Helper Utilities Reference (`tests/e2e/helpers.mjs`)

### 4.1 Server Lifecycle
- `getFreePort()`: Allocates an ephemeral OS port (>1024) by opening and closing an ephemeral `net.Server`.
- `startServer(port, options)`: Spawns `node website/server.mjs` with `PORT: port`, verifies readiness via stdout/health check, and returns server controls.
- `stopServer(serverInstance)`: Gracefully terminates child process tree with `taskkill /pid <pid> /T /F` fallback.

### 4.2 Opaque HTTP Client
- `fetchOpaque(url, options)`: Pure ESM wrapper around global `fetch`. Defaults to `redirect: 'manual'` to capture 301/302 redirects, response headers, `Location`, duration, and response body.

### 4.3 Content Analysis & 5-Gram Shingles
- `calculate5GramOverlap(htmlA, htmlB)`:
  1. Strips HTML tags, `<header>`, `<footer>`, `<nav>`, `<details>`, `<script>`, `<style>`, and comments.
  2. Decodes HTML entities (`&amp;`, `&bull;`, `&mdash;`, `&#39;`).
  3. Tokenizes into lowercase alphanumeric words.
  4. Generates sliding 5-word shingles: $\{ (w_i, w_{i+1}, w_{i+2}, w_{i+3}, w_{i+4}) \}$.
  5. Computes Jaccard similarity: $\frac{|S_A \cap S_B|}{|S_A \cup S_B|} \times 100\%$.
  6. Handles edge cases: $<5$ tokens returns $0.0\%$, identical returns $100.0\%$.

### 4.4 DOM & Sitemap Parsers
- `extractMainContent(html)`: Extracts `<main>...</main>`.
- `extractCanonical(html)`: Extracts `<link rel="canonical" href="...">`.
- `extractRobots(html)`: Extracts `<meta name="robots" content="...">`.
- `extractLinks(html)`: Extracts all `<a href="..." rel="...">` elements.
- `validateSitemapXml(xmlContent)`: Validates `<urlset>` XML, extracts all `<loc>` URLs and `<lastmod>` dates.

---

## 5. Feature Coverage Matrix (F1 to F22)

All 22 project features are mapped across Tiers 1 through 3:

| Feature # | Feature Name | Target Scope | Tier 1 (Count) | Tier 2 (Count) | Tier 3 Pairs |
|---|---|---|:---:|:---:|---|
| **F1** | Git Pull Clean Baseline | Repo status, tracking branch, secrets | 5 | 5 | P17 |
| **F2** | Delete Zombie HTML Files | 0 `noindex` files in solutions, vs, setup, guides | 5 | 5 | P01, P18 |
| **F3** | Pattern 301 Redirect Resolver | Dynamic regex/prefix 301s in `server.mjs` | 5 | 5 | P01, P02, P15, P22 |
| **F4** | Tool & Competitor Alias 301s | `/leak-test`, `/isp-throttling-test`, `/tools/mtu-calculator`, `/vs/totalvpn` | 5 | 5 | P03, P04 |
| **F5** | Strip WireGuard Proof Section | Remove `#sweepr-live-wireguard-acr-proof` | 5 | 5 | P05 |
| **F6** | Strip ISP Master Matrix | Remove `#sweepr-isp-master-matrix` | 5 | 5 | P06 |
| **F7** | Disable Boilerplate Injection | Neutralize `enrich-pillars` & audit step 3 | 5 | 5 | P07 |
| **F8** | Lower 5-Gram Similarity | Diversify pillar text, pairwise < 25% (< 30% CI) | 5 | 5 | P05, P06, P20 |
| **F9** | Remove Footer Directory | Delete `<details id="sweepr-seo-directory">` | 5 | 5 | P08 |
| **F10** | Remove Rotator Bridge | Delete `<section id="sweepr-unindexed-guides-bridge">` | 5 | 5 | P09 |
| **F11** | Disable Audit Footer Injection | Remove lines 848–936 in audit script | 5 | 5 | P10 |
| **F12** | Static 12-Pillar Grid | Curated 12-pillar navigation grid + canary | 5 | 5 | P08, P09, P10 |
| **F13** | Neutralize Winner Lock Bug | Prevent dynamic resurrection in consolidation | 5 | 5 | P11 |
| **F14** | Strict Sitemap Pruning | Prune sitemap to strictly <= 95 URLs (~85 target) | 5 | 5 | P02, P11, P12, P19 |
| **F15** | Freeze `<lastmod>` on `<main>` | Hash only semantic `<main>` content | 5 | 5 | P12, P13, P14, P21 |
| **F16** | Deepen `leak-test.html` | STUN/TURN ICE table, WebRTC remediation, IPv6/DNSSEC | 5 | 5 | P03, P13 |
| **F17** | Deepen `isp-throttling-test.html` | DPI Port-Shaping table, WireGuard AEAD countermeasure | 5 | 5 | P04, P14 |
| **F18** | Prominent Links to Pillars & Canary | Direct crawlable links from `/` and `/download` | 5 | 5 | P15, P16 |
| **F19** | Lock Pipeline to Read-Only | Set `--limit=0`, disable live proof in CI workflow | 5 | 5 | P17 |
| **F20** | Enforce CI Assertions | CI guardrails: sitemap <= 95, 0 zombies, <30% overlap | 5 | 5 | P17, P18, P19, P20 |
| **F21** | Audit & Local Verification | Ensure audit and validator scripts pass cleanly | 5 | 5 | P07, P21 |
| **F22** | Production Deploy Hygiene | Secret exclusion, clean staging, sitemap resubmit | 5 | 5 | P16, P22 |
| **Totals**| | | **110** | **110** | **22 pairs** |

---

## 6. Tier 3 Pairwise Cross-Feature Interactions (22 Tests)

| ID | Pair | Interaction Description | Opaque-Box Test Stimulus |
|---|---|---|---|
| **P01** | F2 × F3 | Deleted Zombie File vs Pattern 301 Resolver | Request physically deleted ACR path -> returns 301 to guide, not 404 |
| **P02** | F3 × F14 | 301 Redirect Resolver vs Pruned Sitemap URLs | Verify zero sitemap URLs match 301 redirect patterns |
| **P03** | F4 × F16 | Tool Alias Redirect vs Deepened Leak Test Content | Follow `/leak-test` 301 -> destination contains ICE table |
| **P04** | F4 × F17 | MTU Calc Alias vs Deepened ISP Throttling Content | Follow `/tools/mtu-calculator` 301 -> destination contains DPI table |
| **P05** | F5 × F8 | Proof Removal vs 5-Gram Similarity | Stripping proof keeps top pillar pairwise overlap < 25% |
| **P06** | F6 × F8 | Matrix Removal vs 5-Gram Similarity | Stripping matrix keeps solutions pillars overlap < 25% |
| **P07** | F7 × F21 | Disabled Proof Injection vs Daily Audit Script | Audit execution does not re-inject proof or matrix |
| **P08** | F9 × F12 | Footer Directory Removal vs 12-Pillar Grid | Footer directory absent while curated grid present on index/pricing |
| **P09** | F10 × F12 | Rotator Bridge Removal vs 12-Pillar Grid | Rotator bridge absent while curated grid present on tool pages |
| **P10** | F11 × F12 | Disabled Audit Footer Injection vs 12-Pillar Grid | Audit run preserves curated grid without re-injecting directory |
| **P11** | F13 × F14 | Winner Lock Neutralization vs Sitemap Pruning | Consolidation with impressions does not bloat sitemap > 95 |
| **P12** | F14 × F15 | Pruned Sitemap vs Frozen `<lastmod>` on `<main>` | Consecutive audit runs leave sitemap lastmod dates identical |
| **P13** | F15 × F16 | Frozen `<lastmod>` vs Leak Test Deepening | Leak test has deepened content and valid lastmod format |
| **P14** | F15 × F17 | Frozen `<lastmod>` vs ISP Throttling Deepening | ISP throttling has deepened content and valid lastmod format |
| **P15** | F18 × F3 | Prominent Pillar Links vs 301 Redirect Resolver | Prominent links on homepage point directly to 200 OK canonicals |
| **P16** | F18 × F22 | Warrant Canary Links vs Live Canary Integrity | Homepage link to canary resolves to 200 OK with PGP signed block |
| **P17** | F19 × F20 | Pipeline Lock (`--limit=0`) vs CI Assertions | Workflow with `--limit=0` satisfies all CI guardrail assertions |
| **P18** | F20 × F2 | CI Assertions vs Zombie Cleanup Verification | CI assertion verifies strictly 0 zombie files across all clusters |
| **P19** | F20 × F14 | CI Assertions vs Sitemap URL Ceiling | CI assertion verifies sitemap count respects <= 95 ceiling |
| **P20** | F20 × F8 | CI Assertions vs 5-Gram Overlap Ceiling | CI assertion verifies overlap stays strictly below 30% ceiling |
| **P21** | F21 × F15 | Audit Script Execution vs Semantic Lastmod Stability | Audit script execution does not churn sitemap when main unchanged |
| **P22** | F3 × F22 | 301 Redirect Resolver vs Query String Preservation | 301 redirect preserves multi-parameter UTM tracking query strings |

---

## 7. Tier 4 Real-World Application Scenarios (11 Scenarios)

| Scenario | Title | Actor / Stimulus | Verification Scope |
|---|---|---|---|
| **S01** | Googlebot Deep Crawl & Indexation Validation | Googlebot user-agent | `robots.txt` -> `sitemap.xml` (<= 95) -> sample 10 pages -> 200 OK, canonicals, no boilerplate |
| **S02** | Legacy User Arriving via Retired ACR Link | Web user from forum | Legacy ACR URL -> 301 with UTM -> stop-samsung guide -> CTA -> `/download` |
| **S03** | Privacy Researcher Warrant Canary & Leak Test Audit | Security researcher | Homepage -> `/warrant-canary` (PGP block) -> `/tools/leak-test` (ICE candidate table) |
| **S04** | Automated CI/CD Daily SEO Pipeline Simulation | CI automation | Run audit in verification mode -> Guardrails: sitemap <= 95, 0 zombies, < 30% overlap |
| **S05** | TotalVPN Competitor Comparison Journey | Consumer searching comparison | Legacy `/vs/totalvpn` -> 301 -> `/alternatives/totalvpn` -> 200 OK comparison -> Pricing CTA |
| **S06** | Network Engineer ISP Throttling Investigation | Network engineer | Legacy `/tools/mtu-calculator` -> 301 -> `/tools/isp-throttling-test` (DPI table) -> TalkTalk pillar |
| **S07** | Travel Router WireGuard Hardware Setup Journey | Remote worker | Router guide (`/setup/gl-inet-travel-router`) -> Clean prose -> Synology cross-link |
| **S08** | Bingbot Discovers Retired Non-Pillar Micro-ISP URL | Bingbot crawler | Request retired ACR URL -> 301 to guide -> Canonical indexed |
| **S09** | Webmaster Automated GSC/GA4 Sync & Resubmission | Automated cloud cron | Run sync script -> Sitemap target verified -> Sitemap <= 95 preserved |
| **S10** | Security Pre-Deployment Audit | Security linter | Git secret scan (no service accounts, no private keys) -> HTTP TRACE rejected |
| **S11** | Comprehensive E2E Regression Pass | Release gate | Complete test suite inventory check (110 T1 + 110 T2 + 22 T3 + 11 T4 = 253 tests) |

---

## 8. Coverage Thresholds

| Metric | Threshold | Actual Count | Status |
|---|:---:|:---:|:---:|
| Tier 1 Feature Tests (F1–F22) | $\ge 110$ (5 per feature) | **110** | **MEETS REQUIREMENT** |
| Tier 2 Boundary Tests (F1–F22) | $\ge 110$ (5 per feature) | **110** | **MEETS REQUIREMENT** |
| Tier 3 Pairwise Cross-Feature Tests | $\ge 22$ (P01–P22) | **22** | **MEETS REQUIREMENT** |
| Tier 4 Real-World Application Scenarios | $\ge 11$ (S01–S11) | **11** | **MEETS REQUIREMENT** |
| **Total Test Inventory** | $\ge 253$ | **253** | **MEETS REQUIREMENT** |

---

## 9. Verification Commands

```powershell
# 1. Run full harness self-test (checks test registry, syntax, and helpers without server)
node tests/e2e/runner.mjs --self-test

# 2. Run Tier 1 functional tests
node tests/e2e/runner.mjs --tier=1 --summary

# 3. Run Tier 2 boundary and corner cases
node tests/e2e/runner.mjs --tier=2 --summary

# 4. Run Tier 3 cross-feature interaction tests
node tests/e2e/runner.mjs --tier=3 --summary

# 5. Run Tier 4 end-to-end real-world scenarios
node tests/e2e/runner.mjs --tier=4 --summary

# 6. Run targeted feature tests (e.g. F1 and F4)
node tests/e2e/runner.mjs --feature=F1,F4 --verbose

# 7. Run complete suite with summary breakdown
node tests/e2e/runner.mjs --summary
```
