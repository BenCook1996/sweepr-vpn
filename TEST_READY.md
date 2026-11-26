# E2E Test Suite Ready

## Test Runner

- **Self-Test Command**: `node tests/e2e/runner.mjs --self-test`
- **Full Suite Command**: `node tests/e2e/runner.mjs --summary`
- **Targeted Filtering**: `node tests/e2e/runner.mjs --tier=1,2,3,4 --feature=F1..F28 --verbose`
- **Isolation Guarantee**: `tests/e2e/helpers.mjs:startServer()` allocates an ephemeral localhost port via `getFreePort()` and a unique temporary `SWEEPR_STATE_DIR` (`os.tmpdir()/sweepr-e2e-state-*`) removed in `stopServer()`, keeping `website/data/` and all tracked repository files untouched.

## Coverage Summary

| Tier | Scope | Tests | Passed | Failed | Duration |
|---|---|---:|---:|---:|---:|
| Tier 1 (`tests/e2e/tier1-features.mjs`) | Primary Feature Coverage (`F1`–`F28`, 5 per feature) | 140 | 140 | 0 | 50.98s |
| Tier 2 (`tests/e2e/tier2-boundaries.mjs`) | Boundary, Negative & Adversarial Cases (`F1`–`F28`, 5 per feature) | 140 | 140 | 0 | 63.14s |
| Tier 3 (`tests/e2e/tier3-cross-feature.mjs`) | Pairwise Cross-Feature Interactions (`P01`–`P28`) | 28 | 28 | 0 | 25.88s |
| Tier 4 (`tests/e2e/tier4-scenarios.mjs`) | End-to-End Real-World User & Bot Scenarios (`S01`–`S14`) | 14 | 14 | 0 | 12.20s |
| **Total** | **Full Opaque-Box E2E Suite (`F1`–`F28`)** | **322** | **322** | **0** | **154.15s** |

- **Self-Test Verification**: `node tests/e2e/runner.mjs --self-test` — `ALL SELF-TEST CHECKS PASSED (0 failures)` (verified `140` T1 + `140` T2 + `28` T3 + `14` T4 = `322` tests, `F1`–`F28` >= 5 T1 & >= 5 T2 each, unique IDs, helper unit checks).
- **Repo & State Isolation**: `git status --porcelain` diff across non-owned files = `0` changes; `website/data/` untouched.

## Feature Checklist

- [x] **F1**: Git baseline & secret hygiene (`.gcp-service-account.json`, `.env`, no conflict markers)
- [x] **F2**: Zero `noindex` zombie HTML files across `solutions/`, `vs/`, `setup/`, `guides/` & all `62` authoritative pSEO pillars preserved
- [x] **F3**: Pattern `301` redirect resolver (`smart-tv-acr-blocking`, non-pillar ISPs, retired antivirus `/vs/norton-secure-vpn`, UTM query preservation)
- [x] **F4**: Tool & competitor alias redirects (`/leak-test`, `/isp-throttling-test`, `/tools/mtu-calculator`, `/vs-totalvpn.html` -> `301 /vs/totalvpn`, live `/vs/totalvpn` & `/alternatives/totalvpn` `200 OK`)
- [x] **F5**: `#sweepr-live-wireguard-acr-proof` removed across `website/` (`talktalk-fibre-wireguard-cgnat.html` verified)
- [x] **F6**: `#sweepr-isp-master-matrix` removed across `website/solutions/` while preserving legitimate technical tables
- [x] **F7**: Deleted `scripts/enrich-pillars-with-live-proof.mjs` verified absent; zero boilerplate re-injection in `scripts/*.mjs`
- [x] **F8**: 5-gram shingle similarity `< 25%` top pairs / `< 30%` CI ceiling
- [x] **F9**: `#sweepr-seo-directory` removed across `website/`
- [x] **F10**: `#sweepr-unindexed-guides-bridge` removed while preserving `#sweepr-share-diagnostic-badge`
- [x] **F11**: Audit footer injection disabled; `--no-fix --no-ping` SHA-256 invariance on `index.html` & `sitemap.xml`
- [x] **F12**: Focused `<= 14`-link BOFU Hub footer + Google Preferred Sources badge (`https://www.google.com/preferences/source?q=sweeprvpn.com`) across core & indexable pages + `talktalk-p2p-port-forwarding` `301 -> talktalk-fibre-wireguard-cgnat`
- [x] **F13**: Winner Lock resurrection neutralized (verified via isolated temp sandbox execution of `consolidate-and-optimize-gsc.mjs`)
- [x] **F14**: Pruned `sitemap.xml` (`94 <= 95` URLs, `/vs/totalvpn` included, retired `/vs/norton` & `/vs/kaspersky` excluded)
- [x] **F15**: Frozen `<lastmod>` on semantic `<main>` content (per-URL `<lastmod>` equality & ISO `YYYY-MM-DD` format)
- [x] **F16**: Deepened `/tools/leak-test` (STUN/TURN ICE table, Firefox `media.peerconnection`, IPv6/DNSSEC, interactive DOM IDs)
- [x] **F17**: Deepened `/tools/isp-throttling-test` (DPI port-shaping table, WireGuard AEAD / MTU 1420/1412, refund script generator)
- [x] **F18**: Direct crawlable links without `nofollow` on `/` (`#homeToolsAndHubsStrip`, `/vs/totalvpn`, `/alternatives/totalvpn`), `/download?platform=picker` / `?picker=1` (`200 text/html` + `/warrant-canary`), `?platform=win`/`mac` attachment binaries, and `/warrant-canary` PGP block
- [x] **F19**: Daily workflow locked to `--json-only`, `--no-ctr-rewrite`, `ci-seo-quality-gate.mjs`, and `Abort on HTML Mutations` (read-only `--dry-run --offline --json-only` & `--verify-calibration`)
- [x] **F20**: CI quality gate assertions (`[50, 110]` sitemap, `0` zombies, `< 30%` 5-gram overlap, `<= 1800 KB` HTML, entity hygiene, static `#mobileNavDrawer`)
- [x] **F21**: Local audit & validator scripts (`daily-seo-pagespeed-audit.mjs --no-fix --no-ping`, `pseo_and_seo_validator.mjs`) pass with SHA-256 invariance
- [x] **F22**: Production deployment hygiene (`.gitignore`, no tracked credentials, `cloud-gsc-ga4-sync.mjs --dry-run --no-ctr-rewrite --skip-crm` read-only safety)
- [x] **F23 (R1)**: All `6/6` `website/assets/*.webp` served `200 image/webp`, valid `RIFF/WEBP`, `< 80 KB` (`fetchBinary` raw byte checks), `17/17` embedded `.webp` `<img>` attributes (`alt`, `width`, `height`, `loading="lazy"`, `decoding="async"`), `ETag`/`304`, `404` on missing `.webp`
- [x] **F24 (R2)**: `/ai-info` (`200`, 1-hop `301` from `/ai-info/`, `/ai-info.html`, `/AI-INFO`, `<article>`, `<dl>`, 8 POPs, `UK Sole Trader`, zero forbidden entities), `robots.txt` (`Claude-SearchBot` `Allow: /`, `Disallow: /welcome`, `Disallow: /uninstall`), `llms.txt` & `llms-full.txt`, `/privacy` (`#what-we-collect-vs-never-log`, `tmpfs`/`/dev/null`, GA4 `G-7D28EEMNXX`, iOS pre-launch), `33` pages with `<dl>/<dt>/<dd>`
- [x] **F25 (R3)**: `/faq` (`200`, 1-hop `301` from `/faq/`, `/faq.html`, `/FAQ`, `<article>`, `<dl>`, zero `FAQPage`/`HowTo`, Pos 4–15 `<main>` links all resolving `200`), `93/93` indexable footers `< 15` (`<= 14`) links + Google Preferred Sources, `<article>` on `62/62` pSEO + `9` core editorial pages
- [x] **F26 (R4)**: `/welcome` & `/uninstall` (`200`, `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store`, excluded from `sitemap.xml`, `/welcome/` & `/uninstall/` `301`, `.html` `200 noindex`), `POST /api/uninstall-feedback` (isolated `SWEEPR_STATE_DIR/uninstall-feedback.jsonl` without polluting `tool-telemetry.jsonl`, `400`, `413`, `405`, `{toString:null}` / `__proto__` safety, `429` rate limit in isolated server instance), `POST /api/telemetry` adversarial safety
- [x] **F27 (R5)**: `/solutions/hyperoptic-broadband-isp-throttling` (and `.html` / trailing-slash + UTM query) -> 1-hop `301 -> /solutions/talktalk-fibre-wireguard-cgnat` -> `200`, deleted file absent from disk & `sitemap.xml` (`94` URLs), `23/23` kept `/solutions/*.html` `200 OK`, `94/94` `sitemap.xml` URLs `200 OK`
- [x] **F28 (R6–R8)**: `ci-seo-quality-gate.mjs` exits `0`, `daily-wireguard-and-acr-pipeline.mjs --dry-run` asserts `8` POPs, `daily-seo-pagespeed-audit.mjs --no-fix --no-ping` read-only, `weekly-spec-privacy-guardrail.mjs --strict --dry-run` exits `0`, `verify-release-manifests.mjs` & `verify-appstore-compliance.mjs` exit `0`, `video-registry.json` (`5` entries, `youtubeVideoId: null`), zero HTML files `> 1800 KB`
