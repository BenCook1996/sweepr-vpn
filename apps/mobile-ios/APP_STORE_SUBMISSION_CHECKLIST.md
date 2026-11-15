# SWEEPR VPN — Apple App Store & Mac App Store Submission Checklist

## 1. Already Done / Automated Without a Mac

1. **Production App Review Demo Account on Railway**:
   - `APP_REVIEW_DEMO_EMAIL` (`appreview@sweeprvpn.com`) and high-entropy `APP_REVIEW_DEMO_KEY` are provisioned on Railway service `sweepr-vpn` (`production`), activating a 25-device concurrent App Review cap.
2. **Cloud-Mac XcodeGen, Build & TestFlight Workflow**:
   - [`.github/workflows/build-apple-appstore.yml`](../../.github/workflows/build-apple-appstore.yml) installs `xcodegen` and `go` (`WireGuardKitGo` dependency) on GitHub Actions `macos-15`, runs `xcodegen generate` inside `apps/mobile-ios/`, compiles iOS & macOS targets, runs a headless iOS Simulator smoke test, and uploads signed `.ipa` & `.pkg` builds when signing secrets are added.
   - Multiplatform entitlements are configured in `project.yml` (`SweeprVPN.entitlements`, `SweeprVPNMac.entitlements`, `TunnelExtension/TunnelExtension.entitlements`, `TunnelExtension/TunnelExtensionMac.entitlements`).
3. **12 Live UI Screenshots Generated & Flattened (Opaque RGB `colorType=2`)**:
   - Saved in `apps/mobile-ios/fastlane/screenshots/en-GB/` by `node scripts/generate-appstore-screenshots.mjs`:
     - **iPhone 6.9"/6.7" (`1290x2796`)**: `iphone-6.9-01-connected.png` .. `04-account.png`
     - **iPad Pro 13" (`2048x2732`)**: `ipad-13-01-connected.png` .. `04-account.png`
     - **macOS Retina 16:10 (`2880x1800`)**: `macos-01-connected.png` .. `04-account.png`
4. **App Store Connect REST API Subscription Sync CLI**:
   - `scripts/sync-appstore-connect.mjs` syncs Subscription Group `SWEEPR VPN Pro`, all 4 product IDs from `SweeprVPN.storekit`, `en-GB`/`en-US` localizations, and App Review metadata directly from Windows once `.p8` API credentials are supplied.
5. **Privacy Manifests & Export Declaration In Repo**:
   - `Info.plist` sets `ITSAppUsesNonExemptEncryption = true` (ChaCha20-Poly1305 & X25519 WireGuard cryptography).
   - `PrivacyInfo.xcprivacy` & `TunnelExtension/PrivacyInfo.xcprivacy` declare `NSPrivacyTracking = false` and `CA92.1` UserDefaults usage.

---

## 2. Remaining Browser-Only Steps on Windows (`appstoreconnect.apple.com` & GitHub)

### A. Commit & Push `main` (Activates Railway Backend + Cloud-Mac Build)
1. Review your changes, commit, and push `main` so:
   - **Railway (`sweepr-vpn`)** deploys the updated `website/server.mjs` with `APP_REVIEW_DEMO_KEY`, StoreKit 2 JWS verification, and `/api/webhooks/apple`.
   - **GitHub Actions** runs `.github/workflows/build-apple-appstore.yml` on `macos-15`.
2. *(For automated `.ipa` / `.pkg` upload from GitHub Actions)* Add these Repository Secrets in GitHub -> Settings -> Secrets and variables -> Actions:
   - `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY_P8`, `APPLE_TEAM_ID`
   - `APPLE_DIST_CERT_P12_BASE64`, `APPLE_DIST_CERT_PASSWORD`
   - `IOS_APP_PROVISION_PROFILE_BASE64`, `IOS_TUNNEL_PROVISION_PROFILE_BASE64`
   - `MAC_APP_PROVISION_PROFILE_BASE64`, `MAC_TUNNEL_PROVISION_PROFILE_BASE64`

### B. App Store Connect Portal (Windows Browser)
1. **Business -> Agreements, Tax, and Banking**: Accept the **Paid Apps Agreement (Schedule 2)** and confirm bank/tax forms show `Active`.
2. **Subscriptions**: Run `ASC_ISSUER_ID=... ASC_KEY_ID=... ASC_PRIVATE_KEY_PATH=.../AuthKey.p8 node scripts/sync-appstore-connect.mjs` from Windows (or verify in the browser) that all 4 IDs exist:
   - `com.sweepr.vpn.pro.annual` (£74.99 / $95.99 / €89.99 per year)
   - `com.sweepr.vpn.pro.sixmonth` (£48.99 / $61.99 / €58.99 per 6 months)
   - `com.sweepr.vpn.pro.monthly` (£12.49 / $15.99 / €14.99 per month + £1.99 / $2.99 / €2.99 1st-Month Introductory Offer)
   - `com.sweepr.vpn.addon.radar.annual` (£14.99 / yr Wi-Fi Shield Add-On)
3. **App Information -> App Store Server Notifications V2**:
   - Production Server URL: `https://sweeprvpn.com/api/webhooks/apple`
   - Sandbox Server URL: `https://sweeprvpn.com/api/webhooks/apple`
   - Notification Version: **Version 2**
4. **App Privacy Questionnaire** (must match `PrivacyInfo.xcprivacy`):
   - **Tracking**: **No** (does not link user/device data with third-party data for advertising or share with data brokers).
   - **Data Linked to the User -> Purpose: App Functionality only**:
     - Contact Info -> **Email Address**
     - Purchases -> **Purchase History**
     - Identifiers -> **Device ID**
   - Uncheck all Advertising, Analytics, and Third-Party SDK categories.
5. **Screenshots & Metadata**:
   - App Name: `SWEEPR VPN` (<= 30 chars, zero keyword stuffing — Guideline 2.3.7).
   - Upload screenshots from `apps/mobile-ios/fastlane/screenshots/en-GB/` (`iphone-6.9-*.png`, `ipad-13-*.png`, `macos-*.png`).
   - Frame copy strictly around cybersecurity, public Wi-Fi encryption, zero-logs privacy, ISP throttling protection, and open-source WireGuard transparency.
   - Support URL: `https://sweeprvpn.com/support.html?app=1` | Privacy Policy URL: `https://sweeprvpn.com/privacy.html?app=1`.
6. **Export Compliance** (on build submission):
   - Uses encryption? **Yes** (matches `ITSAppUsesNonExemptEncryption = true`).
   - Type of encryption: **Both** / **Standard encryption algorithms** (WireGuard ChaCha20-Poly1305 & X25519 + TLS/HTTPS) — qualify under BIS exemption / upload annual self-classification report as required.
7. **App Review Information -> Sign-In & Notes**:
   - Check **Sign-in required**:
     - User name / Demo Email: `appreview@sweeprvpn.com`
     - Password / Demo License Key: `<YOUR_APP_REVIEW_DEMO_KEY_FROM_RAILWAY>`
     - Contact Email: `support@sweeprvpn.com`
   - Walkthrough Notes: Open Connect tab -> Sign in with Demo License Key (or subscribe in StoreKit Sandbox) -> Review Pre-Consent VPN Data Disclosure sheet -> Grant system VPN permission -> Toggle Smart-TV & Tracker DNS Shield -> Verify live Bonjour / Latency diagnostic -> Verify Account -> Delete Account & Data.

---

## 3. Optional Interactive Device Check (Non-Blocking)
- Interactive checkout clicks in Xcode's local `SweeprVPN.storekit` sheet or macOS Internet Sharing NAT64 Wi-Fi can be exercised later via **TestFlight Sandbox** on any physical iPhone/iPad/Mac once `.github/workflows/build-apple-appstore.yml` uploads a signed build (automated DNS64/NAT64 hostname resolution and StoreKit 2 Sandbox JWS verification already pass in `verify-appstore-compliance.mjs`).
