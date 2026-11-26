# SWEEPR VPN — Safe Read-Only / Draft-Only Scheduled Automations

These three automation scripts implement the Section 4 `CREATE NEW` specifications from `sweeprvpn-master-seo-audit.html` (`R7`, `P3-3`).

## Zero-Mutation Guarantees
- All 3 scripts are **strictly read-only** on `website/`, `scripts/`, and git history.
- They **never** edit HTML files, **never** modify `website/sitemap.xml`, and **never** run `git commit` or `git push`.
- Running with `--dry-run` performs **zero disk writes** and prints the full markdown report to `stdout`.
- Running without `--dry-run` writes **only** a markdown brief into `--out-dir` (default: `artifacts/`).

---

## 1. Weekly GSC Query-Mining & 1-Hour Refresh Brief
- **Script**: `scripts/automations/weekly-gsc-refresh-brief.mjs`
- **Schedule**: Every Monday `07:00 Europe/London`
- **Output**: `artifacts/weekly-gsc-refresh-brief.md`
- **CLI Usage**:
  ```bash
  node scripts/automations/weekly-gsc-refresh-brief.mjs --dry-run
  node scripts/automations/weekly-gsc-refresh-brief.mjs --live --out-dir artifacts
  ```
- **Prompt Spec**:
  ```text
  /automation Create a safe READ-ONLY weekly Antigravity scheduled task running every Monday at 07:00 Europe/London in the SWEEPR VPN repository workspace:
  1. Permissions: Read-only repository & read-only GSC/GA4 snapshot inspection ONLY. Strictly FORBIDDEN from editing website/*.html, running git commit, or publishing pages.
  2. Pull the latest 90-day Search Analytics data for sc-domain:sweeprvpn.com (or fall back to website/gsc-ga4-latest-snapshot.json if offline).
  3. Output a markdown brief highlighting:
     - Top Position > 5 queries sorted by clicks & pos 4-15 highest-impression CTR candidates
     - Any sitemap URL dropping in clicks/impressions or sitting >50 after 60+ days (1-Word URL + 301 candidates)
     - Up to 3 ready-to-paste surgical <title>/<h2> refresh drafts obeying UK Sole Trader wording and zero unshipped feature claims.
  4. Save the report cleanly inside the artifacts directory and notify me for manual approval.
  ```

## 2. Weekly Technical, Spec-Alignment, Zero-Hypocrisy Privacy & 2 MB Guardrail
- **Script**: `scripts/automations/weekly-spec-privacy-guardrail.mjs`
- **Schedule**: Every Wednesday `07:00 Europe/London`
- **Output**: `artifacts/weekly-spec-privacy-guardrail.md`
- **CLI Usage**:
  ```bash
  node scripts/automations/weekly-spec-privacy-guardrail.mjs --dry-run
  node scripts/automations/weekly-spec-privacy-guardrail.mjs --strict --live-curl --out-dir artifacts
  ```
- **Prompt Spec**:
  ```text
  /automation Create a safe READ-ONLY weekly technical & privacy sentinel running every Wednesday at 07:00 Europe/London in the SWEEPR VPN repository workspace:
  1. Permissions: Read-only inspection ONLY. Strictly FORBIDDEN from modifying production files or pushing commits.
  2. Run a read-only Node check against all HTML files in website/ and website/server.mjs verifying:
     - Zero occurrences of "sitepatent.com", unconsented ad pixels, "SWEEPR VPN Inc.", or personal founder names in copy
     - Zero claims pitching iOS App Store as already shipped or 5-device VPN limits
     - Max uncompressed HTML size < 1800 KB (2 MB Googlebot safety threshold) and 0 Base64 images / >5 KB SVGs
     - Valid HSTS, XCTO, Referrer-Policy, Permissions-Policy, and strict CSP without unsafe-eval or dead CDNs
     - Robots.txt permits OAI-SearchBot, Claude-SearchBot & PerplexityBot; sitemap.xml contains zero 410/noindex URLs
     - Mobile hamburger nav links exist in initial raw HTML
  3. Run node scripts/ci-seo-quality-gate.mjs and summarize PASS/FAIL findings into an artifact report.
  ```

## 3. Monthly SEO Colony Internal Link Rotation & Benchmark Freshness Digest
- **Script**: `scripts/automations/monthly-colony-freshness-digest.mjs`
- **Schedule**: 1st of every month `08:00 Europe/London`
- **Output**: `artifacts/monthly-colony-freshness-digest.md`
- **CLI Usage**:
  ```bash
  node scripts/automations/monthly-colony-freshness-digest.mjs --dry-run
  node scripts/automations/monthly-colony-freshness-digest.mjs --out-dir artifacts
  ```
- **Prompt Spec**:
  ```text
  /automation Create a safe READ-ONLY monthly SEO Colony & Benchmark Freshness digest running on the 1st of every month at 08:00 Europe/London in the SWEEPR VPN repository workspace:
  1. Permissions: Read-only audit & draft proposals ONLY. Never modify production files directly.
  2. Check GSC & website/seo-strategy-performance-ledger.json for:
     - Money pages stabilized in Top 3 positions (ready to graduate so /faq/ SEO Colony links rotate to the next highest-impression pos 4-15 BOFU target)
     - Tier-1 pages whose "Last Speed-Tested" date or iPerf3/WebRTC benchmark capture is >30 days old
     - Clean referring-domain delta vs the prior month's CRM backlink ledger
  3. Produce a concise checklist of exact /faq/ link swap recommendations and benchmark re-tests to execute manually.
  ```
