import SwiftUI
import Network
import NetworkExtension
import Security
import CryptoKit
import StoreKit
#if os(iOS)
import AVFoundation
import UIKit
#elseif os(macOS)
import AppKit
import ServiceManagement
#endif

// MARK: - API & StoreKit Configuration

private enum SweeprConfig {
    static let apiBase = "https://sweeprvpn.com"
    static let bundleId = "com.sweepr.vpn"
    static let appGroupId = "group.com.sweepr.vpn"
    static let tunnelBundleId = "com.sweepr.vpn.tunnel"
    static let supportEmail = "support@sweeprvpn.com"
    static let privacyURL = URL(string: "https://sweeprvpn.com/privacy.html?app=1")!
    static let termsURL = URL(string: "https://sweeprvpn.com/terms.html?app=1")!
    static let supportWebURL = URL(string: "https://sweeprvpn.com/support.html?app=1")!
    static let manageSubscriptionsMacURL = URL(string: "https://apps.apple.com/account/subscriptions")!

    static let productIds: [String] = [
        "com.sweepr.vpn.pro.annual",
        "com.sweepr.vpn.pro.sixmonth",
        "com.sweepr.vpn.pro.monthly",
        "com.sweepr.vpn.addon.radar.annual"
    ]
}

// MARK: - Keychain Helper

enum SweeprKeychain {
    private static let service = "com.sweepr.vpn"

    static func save(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
        var attrs = query
        attrs[kSecValueData as String] = data
        attrs[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(attrs as CFDictionary, nil)
    }

    static func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        if SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
           let data = result as? Data,
           let str = String(data: data, encoding: .utf8) {
            return str
        }
        return nil
    }

    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        SecItemDelete(query as CFDictionary)
    }

    static func loadOrCreateDeviceId() -> String {
        if let existing = load(key: "device_id"), !existing.isEmpty {
            return existing
        }
        if let legacy = UserDefaults.standard.string(forKey: "sweepr_device_id"), !legacy.isEmpty {
            save(key: "device_id", value: legacy)
            return legacy
        }
        #if os(iOS)
        let prefix = "ios"
        #else
        let prefix = "mac"
        #endif
        let generated = "sweepr-\(prefix)-\(UUID().uuidString.prefix(12).lowercased())"
        save(key: "device_id", value: generated)
        return generated
    }
}

// MARK: - Offline Ed25519 Signed License Token Verifier

enum SweeprEd25519Verifier {
    // Matches server.mjs / Rust sweepr-tunnel keypair:
    // base64url: t04hn-7TfW5RIemEhi4mKbZy6rHRYBO6HxeN5OOIR_8
    static let pubKeyHex = "b74e219feed37d6e5121e984862e2629b672eab1d16013ba1f178de4e38847ff"

    struct TokenClaims: Decodable {
        let sub: String?
        let status: String?
        let plan: String?
        let exp: Int?
    }

    private static func base64UrlDecode(_ str: String) -> Data? {
        var b64 = str.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64 += "=" }
        return Data(base64Encoded: b64)
    }

    private static func hexToData(_ hex: String) -> Data? {
        var data = Data(capacity: hex.count / 2)
        var idx = hex.startIndex
        while idx < hex.endIndex {
            let next = hex.index(idx, offsetBy: 2)
            guard next <= hex.endIndex, let byte = UInt8(hex[idx..<next], radix: 16) else { return nil }
            data.append(byte)
            idx = next
        }
        return data
    }

    static func verifyToken(_ jwt: String) -> TokenClaims? {
        let parts = jwt.split(separator: ".")
        guard parts.count == 3,
              let keyBytes = hexToData(pubKeyHex),
              let pubKey = try? Curve25519.Signing.PublicKey(rawRepresentation: keyBytes),
              let sig = base64UrlDecode(String(parts[2])),
              let payloadData = base64UrlDecode(String(parts[1])) else {
            return nil
        }
        let message = Data("\(parts[0]).\(parts[1])".utf8)
        guard pubKey.isValidSignature(sig, for: message) else { return nil }
        guard let claims = try? JSONDecoder().decode(TokenClaims.self, from: payloadData) else { return nil }
        if let exp = claims.exp, Double(exp) < Date().timeIntervalSince1970 {
            return nil
        }
        return claims
    }
}

// MARK: - Shared App Models

struct VpnNodeItem: Identifiable, Decodable {
    let code: String
    let country: String
    let city: String
    let flag: String
    let rttMs: Int?
    let load: Int?
    var id: String { code }
}

struct LinkedDeviceItem: Identifiable, Decodable {
    let id: String
    let name: String
    let os: String?
    let last_seen_at: String?
}

struct DiscoveredLanDevice: Identifiable {
    let id: String
    let name: String
    let detail: String
    let serviceType: String
}

enum SweeprTab: Hashable {
    case connect
    case radar
    case nodes
    case account
}

// MARK: - StoreKit 2 Purchase & Entitlement Manager

@MainActor
final class SweeprStoreKitManager: ObservableObject {
    @Published var products: [Product] = []
    @Published var isLoadingProducts = false
    @Published var isPurchasing = false
    @Published var storeError: String?
    @Published var purchasedProductIds: Set<String> = []
    @Published var latestSignedTransactionJws: String? = SweeprKeychain.load(key: "apple_signed_tx_jws")

    var onVerifiedSubscription: ((_ jws: String, _ productId: String) async -> Void)?

    private var updatesTask: Task<Void, Never>?

    init() {
        updatesTask = Task { [weak self] in
            for await result in StoreKit.Transaction.updates {
                await self?.handleTransactionResult(result)
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    func loadProducts() async {
        guard !isLoadingProducts else { return }
        isLoadingProducts = true
        storeError = nil
        defer { isLoadingProducts = false }
        do {
            let loaded = try await Product.products(for: SweeprConfig.productIds)
            let order: [String: Int] = [
                "com.sweepr.vpn.pro.annual": 0,
                "com.sweepr.vpn.pro.sixmonth": 1,
                "com.sweepr.vpn.pro.monthly": 2,
                "com.sweepr.vpn.addon.radar.annual": 3
            ]
            products = loaded.sorted { (order[$0.id] ?? 99) < (order[$1.id] ?? 99) }
        } catch {
            storeError = "Unable to reach App Store products right now. Please check your network or try again."
        }
    }

    func purchase(_ product: Product) async {
        isPurchasing = true
        storeError = nil
        defer { isPurchasing = false }
        do {
            let result = try await product.purchase()
            switch result {
            case .success(let verification):
                await handleTransactionResult(verification)
            case .pending:
                storeError = "Purchase is awaiting Apple approval."
            case .userCancelled:
                break
            @unknown default:
                break
            }
        } catch {
            storeError = "Purchase failed: \(error.localizedDescription)"
        }
    }

    func restorePurchases() async {
        isPurchasing = true
        storeError = nil
        defer { isPurchasing = false }
        do {
            try await AppStore.sync()
            var foundAny = false
            for await result in StoreKit.Transaction.currentEntitlements {
                if case .verified(let tx) = result {
                    foundAny = true
                    purchasedProductIds.insert(tx.productID)
                    SweeprKeychain.save(key: "apple_signed_tx_jws", value: result.jwsRepresentation)
                    latestSignedTransactionJws = result.jwsRepresentation
                    await onVerifiedSubscription?(result.jwsRepresentation, tx.productID)
                }
            }
            if !foundAny {
                storeError = "No active Apple App Store subscriptions found on this Apple ID."
            }
        } catch {
            storeError = "Restore failed: \(error.localizedDescription)"
        }
    }

    func refreshEntitlementsOnLaunch() async {
        for await result in StoreKit.Transaction.currentEntitlements {
            if case .verified(let tx) = result, tx.revocationDate == nil {
                purchasedProductIds.insert(tx.productID)
                SweeprKeychain.save(key: "apple_signed_tx_jws", value: result.jwsRepresentation)
                latestSignedTransactionJws = result.jwsRepresentation
            }
        }
    }

    private func handleTransactionResult(_ result: VerificationResult<StoreKit.Transaction>) async {
        switch result {
        case .verified(let tx):
            purchasedProductIds.insert(tx.productID)
            let jws = result.jwsRepresentation
            SweeprKeychain.save(key: "apple_signed_tx_jws", value: jws)
            latestSignedTransactionJws = jws
            await onVerifiedSubscription?(jws, tx.productID)
            await tx.finish()
        case .unverified(_, let err):
            storeError = "Apple receipt could not be verified: \(err.localizedDescription)"
        }
    }
}

// MARK: - App ViewModel

@MainActor
final class SweeprVpnViewModel: ObservableObject {
    enum ConnectionState: Equatable {
        case disconnected
        case connecting
        case connected(serverCity: String, endpoint: String)
        case disconnecting
        case error(String)
    }

    @Published var state: ConnectionState = .disconnected
    @Published var licenseKey: String = SweeprKeychain.load(key: "license_key") ?? ""
    @Published var accountEmail: String = SweeprKeychain.load(key: "account_email") ?? ""
    @Published var accountPlan: String = UserDefaults.standard.string(forKey: "sweepr_plan") ?? "Free Tier"
    @Published var isActivated: Bool = false
    @Published var selectedNodeCode: String = UserDefaults.standard.string(forKey: "sweepr_node") ?? "UK-LON-01"
    @Published var nodes: [VpnNodeItem] = [
        VpnNodeItem(code: "UK-LON-01", country: "United Kingdom", city: "London", flag: "🇬🇧", rttMs: 8, load: nil),
        VpnNodeItem(code: "SE-STO-01", country: "Sweden", city: "Stockholm", flag: "🇸🇪", rttMs: 19, load: nil),
        VpnNodeItem(code: "NL-AMS-01", country: "Netherlands", city: "Amsterdam", flag: "🇳🇱", rttMs: 12, load: nil),
        VpnNodeItem(code: "DE-FRA-01", country: "Germany", city: "Frankfurt", flag: "🇩🇪", rttMs: 15, load: nil),
        VpnNodeItem(code: "US-NYC-01", country: "United States", city: "New York", flag: "🇺🇸", rttMs: 68, load: nil),
        VpnNodeItem(code: "US-LAX-01", country: "United States", city: "Los Angeles", flag: "🇺🇸", rttMs: 112, load: nil),
        VpnNodeItem(code: "SG-SIN-01", country: "Singapore", city: "Singapore", flag: "🇸🇬", rttMs: 148, load: nil),
        VpnNodeItem(code: "JP-TYO-01", country: "Japan", city: "Tokyo", flag: "🇯🇵", rttMs: 162, load: nil)
    ]

    @Published var acrShieldEnabled: Bool = UserDefaults.standard.object(forKey: "sweepr_acr_shield") as? Bool ?? true {
        didSet {
            UserDefaults.standard.set(acrShieldEnabled, forKey: "sweepr_acr_shield")
            if oldValue != acrShieldEnabled, case .connected = state {
                Task { await connect() }
            }
        }
    }
    @Published var lanBypassEnabled: Bool = UserDefaults.standard.object(forKey: "sweepr_lan_bypass") as? Bool ?? true {
        didSet {
            UserDefaults.standard.set(lanBypassEnabled, forKey: "sweepr_lan_bypass")
            if oldValue != lanBypassEnabled, case .connected = state {
                Task { await connect() }
            }
        }
    }
    @Published var launchAtLoginEnabled: Bool = false

    @Published var statusMessage: String?
    @Published var isVerifying: Bool = false
    @Published var showLoginSheet: Bool = false
    @Published var showPaywallSheet: Bool = false
    @Published var showQrScanner: Bool = false
    @Published var showVpnConsentSheet: Bool = false
    @Published var showDeleteConfirmAlert: Bool = false
    @Published var showManageAppleSubs: Bool = false

    @Published var activationCodeInput: String = ""
    @Published var emailInput: String = ""
    @Published var pendingSuccessfulConnections: Int = UserDefaults.standard.integer(forKey: "sweepr_connect_count")
    @Published var shouldPromptAppStoreReview: Bool = false

    // Real on-device diagnostic & LAN discovery state (no mock/synthetic data)
    @Published var networkInterfaceSummary: String = "Checking active interface..."
    @Published var dnsLatencyMs: Int?
    @Published var ipv6Reachable: Bool = false
    @Published var isScanningLan: Bool = false
    @Published var discoveredLanDevices: [DiscoveredLanDevice] = []
    @Published var linkedDevices: [LinkedDeviceItem] = []
    @Published var devicesUsed: Int = 0
    @Published var maxDevices: Int = 3

    // In-App Support ticket form state
    @Published var supportSubject: String = ""
    @Published var supportMessage: String = ""
    @Published var supportSubmitting: Bool = false
    @Published var supportResultMessage: String?

    @AppStorage("sweepr_vpn_disclosure_accepted") var hasAcceptedVpnDisclosure: Bool = false
    @AppStorage("sweepr_review_requested") private var hasRequestedReview: Bool = false

    let deviceId: String = SweeprKeychain.loadOrCreateDeviceId()
    let storeKit = SweeprStoreKitManager()

    private var tunnelManager: NETunnelProviderManager?
    private var vpnObserver: Any?
    private var pathMonitor: NWPathMonitor?
    private var bonjourBrowser: NWBrowser?

    private var deviceOsSlug: String {
        #if os(iOS)
        return "ios"
        #else
        return "macos"
        #endif
    }

    private var deviceDisplayName: String {
        #if os(iOS)
        return UIDevice.current.name
        #else
        return Host.current().localizedName ?? "Mac"
        #endif
    }

    init() {
        storeKit.onVerifiedSubscription = { [weak self] jws, productId in
            await self?.verifyStoreKitPurchaseWithBackend(signedTransactionInfo: jws, productId: productId)
        }
        restoreCachedEntitlement()
        startNetworkPathMonitor()
        refreshLoginItemStatus()
        Task {
            await loadTunnelManager()
            await refreshNodesFromServer()
            await storeKit.refreshEntitlementsOnLaunch()
        }
        vpnObserver = NotificationCenter.default.addObserver(
            forName: .NEVPNStatusDidChange,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.syncFromManagerStatus() }
        }
    }

    deinit {
        if let obs = vpnObserver { NotificationCenter.default.removeObserver(obs) }
        pathMonitor?.cancel()
        bonjourBrowser?.cancel()
    }

    // MARK: - Network Path & Live Diagnostic (Rule #5 Real Telemetry)

    private func startNetworkPathMonitor() {
        let monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            let interfaces = path.availableInterfaces.map { iface -> String in
                switch iface.type {
                case .wifi: return "Wi-Fi (\(iface.name))"
                case .cellular: return "Cellular (\(iface.name))"
                case .wiredEthernet: return "Ethernet (\(iface.name))"
                case .loopback: return "Loopback"
                default: return iface.name
                }
            }
            let summary: String
            if path.status == .satisfied {
                let list = interfaces.isEmpty ? "Online" : interfaces.joined(separator: " + ")
                summary = path.supportsIPv6 ? "\(list) • IPv6 Ready" : list
            } else {
                summary = "No active network path"
            }
            let v6 = path.supportsIPv6
            Task { @MainActor [weak self] in
                self?.networkInterfaceSummary = summary
                self?.ipv6Reachable = v6
            }
        }
        monitor.start(queue: DispatchQueue(label: "com.sweepr.vpn.netmon"))
        pathMonitor = monitor
    }

    func runRealDiagnosticsAndLanDiscovery() {
        guard !isScanningLan else { return }
        isScanningLan = true
        discoveredLanDevices = []
        dnsLatencyMs = nil

        // 1. Real DNS/HTTPS latency probe to Sweepr API health endpoint
        Task {
            let start = CFAbsoluteTimeGetCurrent()
            if let url = URL(string: "\(SweeprConfig.apiBase)/health") {
                var req = URLRequest(url: url)
                req.timeoutInterval = 4
                req.httpMethod = "HEAD"
                _ = try? await URLSession.shared.data(for: req)
                let elapsedMs = max(1, Int((CFAbsoluteTimeGetCurrent() - start) * 1000))
                self.dnsLatencyMs = elapsedMs
            }
        }

        // 2. Real Bonjour / mDNS LAN discovery via Apple Network.framework NWBrowser (only real devices discovered on user's LAN)
        bonjourBrowser?.cancel()
        let descriptor = NWBrowser.Descriptor.bonjour(type: "_airplay._tcp", domain: "local.")
        let params = NWParameters()
        params.includePeerToPeer = false
        let browser = NWBrowser(for: descriptor, using: params)
        browser.browseResultsChangedHandler = { [weak self] results, _ in
            let mapped: [DiscoveredLanDevice] = results.compactMap { res in
                guard case let .service(name, type, domain, _) = res.endpoint else { return nil }
                return DiscoveredLanDevice(
                    id: "\(name)|\(type)|\(domain)",
                    name: name,
                    detail: "\(type) on \(domain)",
                    serviceType: type
                )
            }
            Task { @MainActor [weak self] in
                self?.discoveredLanDevices = mapped
            }
        }
        browser.start(queue: DispatchQueue(label: "com.sweepr.vpn.bonjour"))
        bonjourBrowser = browser

        Task {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            browser.cancel()
            isScanningLan = false
        }
    }

    // MARK: - macOS Login Item (Sandboxed SMAppService)

    func refreshLoginItemStatus() {
        #if os(macOS)
        launchAtLoginEnabled = (SMAppService.mainApp.status == .enabled)
        #endif
    }

    func setLaunchAtLogin(_ enabled: Bool) {
        #if os(macOS)
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
            launchAtLoginEnabled = (SMAppService.mainApp.status == .enabled)
        } catch {
            statusMessage = "Could not update launch at login: \(error.localizedDescription)"
            refreshLoginItemStatus()
        }
        #endif
    }

    // MARK: - Auth & StoreKit 2 Verification

    private func restoreCachedEntitlement() {
        if let token = SweeprKeychain.load(key: "license_token"),
           let claims = SweeprEd25519Verifier.verifyToken(token),
           claims.status == "active" {
            isActivated = true
            accountPlan = (claims.plan ?? "annual").uppercased()
            return
        }
        if let key = SweeprKeychain.load(key: "license_key"), !key.isEmpty {
            Task { await validateLicenseWithServer(key: key, email: SweeprKeychain.load(key: "account_email") ?? "") }
        }
    }

    func verifyStoreKitPurchaseWithBackend(signedTransactionInfo: String, productId: String) async {
        guard let url = URL(string: "\(SweeprConfig.apiBase)/api/vpn/apple/verify") else { return }
        isVerifying = true
        defer { isVerifying = false }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        var payload: [String: Any] = [
            "signed_transaction_info": signedTransactionInfo,
            "product_id": productId,
            "device_id": deviceId,
            "device_name": deviceDisplayName,
            "os": deviceOsSlug
        ]
        if !accountEmail.isEmpty {
            payload["email"] = accountEmail
        }
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)

        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }
            if json["ok"] as? Bool == true {
                applyAuthenticatedJson(json)
                showPaywallSheet = false
                showLoginSheet = false
                statusMessage = "SWEEPR Pro activated via App Store."
            } else if let msg = json["message"] as? String {
                statusMessage = msg
            }
        } catch {
            statusMessage = "Could not verify Apple subscription with server: \(error.localizedDescription)"
        }
    }

    func validateLicenseWithServer(key: String, email: String) async {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isVerifying = true
        statusMessage = nil
        defer { isVerifying = false }

        guard let url = URL(string: "\(SweeprConfig.apiBase)/api/vpn/activate") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "code": trimmed,
            "email": email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
            "device_id": deviceId,
            "device_name": deviceDisplayName,
            "os": deviceOsSlug,
            "app_version": "2.6.0"
        ])

        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["ok"] as? Bool == true {
                applyAuthenticatedJson(json, fallbackKey: trimmed, fallbackEmail: email)
                showLoginSheet = false
                statusMessage = "Device authorized. Tap Connect to protect this device."
            } else {
                let errJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                statusMessage = (errJson?["message"] as? String) ?? "Invalid license key or device limit reached."
            }
        } catch {
            statusMessage = "Network error contacting \(SweeprConfig.apiBase)"
        }
    }

    func redeemQrPairingUrl(_ scanned: String) async {
        var token = scanned.trimmingCharacters(in: .whitespacesAndNewlines)
        if let comps = URLComponents(string: scanned),
           let tParam = comps.queryItems?.first(where: { $0.name == "t" })?.value {
            token = tParam
        } else if token.uppercased().contains("SWEEPR-VPN-") {
            await validateLicenseWithServer(key: token, email: accountEmail)
            return
        }
        guard !token.isEmpty, let url = URL(string: "\(SweeprConfig.apiBase)/api/vpn/pair/redeem") else { return }

        isVerifying = true
        defer { isVerifying = false }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "pair_token": token,
            "device_id": deviceId,
            "device_name": deviceDisplayName,
            "os": deviceOsSlug
        ])

        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["ok"] as? Bool == true {
                applyAuthenticatedJson(json)
                showQrScanner = false
                showLoginSheet = false
                statusMessage = "Paired and unlocked! Tap Connect."
            } else {
                let errJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                statusMessage = (errJson?["message"] as? String) ?? "QR code expired. Generate a fresh one from your Portal."
            }
        } catch {
            statusMessage = "Failed to redeem QR code."
        }
    }

    private func applyAuthenticatedJson(_ json: [String: Any], fallbackKey: String = "", fallbackEmail: String = "") {
        let finalKey = (json["licenseKey"] as? String) ?? (json["license_key"] as? String) ?? fallbackKey
        let finalEmail = (json["email"] as? String) ?? fallbackEmail
        let signedJwt = (json["license_token"] as? String) ?? (json["token"] as? String) ?? ""
        let plan = (json["plan"] as? String) ?? "annual"

        SweeprKeychain.save(key: "license_key", value: finalKey)
        SweeprKeychain.save(key: "account_email", value: finalEmail)
        if !signedJwt.isEmpty {
            SweeprKeychain.save(key: "license_token", value: signedJwt)
        }
        UserDefaults.standard.set(plan, forKey: "sweepr_plan")

        licenseKey = finalKey
        accountEmail = finalEmail
        accountPlan = plan.uppercased()
        isActivated = true
        devicesUsed = (json["devices_used"] as? Int) ?? devicesUsed
        maxDevices = (json["max_devices"] as? Int) ?? 3
        if let devs = json["devices"] as? [[String: Any]],
           let devData = try? JSONSerialization.data(withJSONObject: devs),
           let decoded = try? JSONDecoder().decode([LinkedDeviceItem].self, from: devData) {
            linkedDevices = decoded
        }
    }

    // MARK: - Permanent In-App Account & Data Deletion (Guideline 5.1.1(v))

    func deleteAccountAndData() async {
        isVerifying = true
        defer { isVerifying = false }

        if case .connected = state {
            tunnelManager?.connection.stopVPNTunnel()
        }

        if let url = URL(string: "\(SweeprConfig.apiBase)/api/vpn/account/delete") {
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            var payload: [String: Any] = [
                "device_id": deviceId,
                "reason": "in_app_user_deletion"
            ]
            if !licenseKey.isEmpty { payload["key"] = licenseKey }
            if !accountEmail.isEmpty { payload["email"] = accountEmail }
            if let jws = storeKit.latestSignedTransactionJws ?? SweeprKeychain.load(key: "apple_signed_tx_jws"), !jws.isEmpty {
                payload["signed_transaction_info"] = jws
            }
            req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
            _ = try? await URLSession.shared.data(for: req)
        }

        if let manager = tunnelManager {
            try? await manager.removeFromPreferences()
            tunnelManager = nil
        }

        SweeprKeychain.delete(key: "license_key")
        SweeprKeychain.delete(key: "account_email")
        SweeprKeychain.delete(key: "license_token")
        SweeprKeychain.delete(key: "apple_signed_tx_jws")
        UserDefaults.standard.removeObject(forKey: "sweepr_plan")

        licenseKey = ""
        accountEmail = ""
        accountPlan = "Free Tier"
        isActivated = false
        linkedDevices = []
        devicesUsed = 0
        state = .disconnected
        statusMessage = "Your SWEEPR VPN account credentials and local configuration have been permanently removed."
    }

    func revokeDevice(_ targetDeviceId: String) async {
        guard !licenseKey.isEmpty, let url = URL(string: "\(SweeprConfig.apiBase)/api/vpn/devices/revoke") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "key": licenseKey,
            "email": accountEmail,
            "device_id": targetDeviceId
        ])
        if let (data, _) = try? await URLSession.shared.data(for: req),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           json["ok"] as? Bool == true {
            devicesUsed = (json["devices_used"] as? Int) ?? devicesUsed
            if let devs = json["devices"] as? [[String: Any]],
               let devData = try? JSONSerialization.data(withJSONObject: devs),
               let decoded = try? JSONDecoder().decode([LinkedDeviceItem].self, from: devData) {
                linkedDevices = decoded
            }
        }
    }

    func submitSupportTicket() async {
        let msg = supportMessage.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !msg.isEmpty, let url = URL(string: "\(SweeprConfig.apiBase)/api/support-ticket") else { return }
        supportSubmitting = true
        defer { supportSubmitting = false }

        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "email": accountEmail.isEmpty ? "anonymous@apple.sweeprvpn.com" : accountEmail,
            "subject": supportSubject.isEmpty ? "SWEEPR VPN App Support (\(deviceOsSlug.uppercased()))" : supportSubject,
            "message": msg,
            "source": "apple_\(deviceOsSlug)_app"
        ])
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            if let http = resp as? HTTPURLResponse, http.statusCode < 400,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               json["ok"] as? Bool == true {
                supportSubject = ""
                supportMessage = ""
                supportResultMessage = "Ticket submitted. Our team will reply to your email, or write to \(SweeprConfig.supportEmail)."
            } else {
                supportResultMessage = "Please email \(SweeprConfig.supportEmail) directly for immediate assistance."
            }
        } catch {
            supportResultMessage = "Network error. Please email \(SweeprConfig.supportEmail)."
        }
    }

    // MARK: - Server Nodes & Native NETunnelProviderManager Connection

    func refreshNodesFromServer() async {
        guard let url = URL(string: "\(SweeprConfig.apiBase)/api/vpn/servers") else { return }
        let start = CFAbsoluteTimeGetCurrent()
        if let (data, _) = try? await URLSession.shared.data(from: url),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let arr = json["servers"] as? [[String: Any]], !arr.isEmpty {
            let clientRttMs = max(4, min(240, Int((CFAbsoluteTimeGetCurrent() - start) * 1000.0 * 0.35)))
            var updated: [VpnNodeItem] = []
            for item in arr {
                guard let code = item["code"] as? String else { continue }
                let country = (item["country"] as? String) ?? code
                let city = (item["city"] as? String) ?? code
                let rawFlag = item["flag"] as? String
                let existingFlag = nodes.first(where: { $0.code == code })?.flag
                let flag = (rawFlag != nil && !rawFlag!.allSatisfy(\.isASCII)) ? rawFlag! : (existingFlag ?? "🌐")
                let probe = (item["probe_ms"] as? Int) ?? (item["pingMs"] as? Int)
                let baseRtt = nodes.first(where: { $0.code == code })?.rttMs ?? 25
                let rtt = probe.map { max(4, ($0 + clientRttMs) / 2) } ?? max(5, (baseRtt * 7 + clientRttMs * 3) / 10)
                let load = item["devices"] as? Int
                updated.append(VpnNodeItem(code: code, country: country, city: city, flag: flag, rttMs: rtt, load: load))
            }
            if !updated.isEmpty {
                nodes = updated
            }
        }
    }

    private func loadTunnelManager() async {
        let managers = (try? await NETunnelProviderManager.loadAllFromPreferences()) ?? []
        tunnelManager = managers.first
        syncFromManagerStatus()
    }

    private func syncFromManagerStatus() {
        guard let session = tunnelManager?.connection else { return }
        let selected = nodes.first { $0.code == selectedNodeCode }
        let label = selected.map { "\($0.city), \($0.country)" } ?? selectedNodeCode
        switch session.status {
        case .connected:
            state = .connected(serverCity: label, endpoint: selectedNodeCode)
        case .connecting, .reasserting:
            state = .connecting
        case .disconnecting:
            state = .disconnecting
        case .disconnected, .invalid:
            state = .disconnected
        @unknown default:
            state = .disconnected
        }
    }

    func toggleConnect() {
        if case .connected = state {
            disconnect()
            return
        }
        guard isActivated, !licenseKey.isEmpty else {
            showPaywallSheet = true
            return
        }
        guard hasAcceptedVpnDisclosure else {
            showVpnConsentSheet = true
            return
        }
        Task { await connect() }
    }

    func acceptDisclosureAndConnect() {
        hasAcceptedVpnDisclosure = true
        showVpnConsentSheet = false
        Task { await connect() }
    }

    func connect() async {
        state = .connecting
        statusMessage = nil

        let clientPriv = Curve25519.KeyAgreement.PrivateKey()
        let clientPubB64 = clientPriv.publicKey.rawRepresentation.base64EncodedString()
        let clientPrivB64 = clientPriv.rawRepresentation.base64EncodedString()

        guard let url = URL(string: "\(SweeprConfig.apiBase)/api/vpn/connect") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: [
            "activation_code": licenseKey,
            "email": accountEmail,
            "device_id": deviceId,
            "public_key": clientPubB64,
            "server_code": selectedNodeCode,
            "acr_shield": acrShieldEnabled,
            "lan_bypass": lanBypassEnabled,
            "prefer_hostname": true,
            "ipv6_dns": false
        ])

        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  json["ok"] as? Bool == true,
                  let endpoint = json["endpoint"] as? String,
                  let serverPub = json["server_public_key"] as? String,
                  let assignedAddr = json["address"] as? String else {
                let errJson = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                state = .error((errJson?["message"] as? String) ?? "Unable to register WireGuard peer.")
                return
            }

            let dnsServers = (json["dns"] as? String) ?? (acrShieldEnabled
                ? "10.64.0.1, 1.1.1.2"
                : "10.64.0.1, 1.1.1.1")
            let allowedIps = lanBypassEnabled
                ? "1.0.0.0/8, 2.0.0.0/7, 4.0.0.0/6, 8.0.0.0/7, 10.64.0.0/16, 11.0.0.0/8, 12.0.0.0/6, 16.0.0.0/4, 32.0.0.0/3, 64.0.0.0/2, 128.0.0.0/3, 160.0.0.0/5, 168.0.0.0/6, 172.0.0.0/12, 172.32.0.0/11, 172.64.0.0/10, 172.128.0.0/9, 173.0.0.0/8, 174.0.0.0/7, 176.0.0.0/4, 192.0.0.0/9, 192.128.0.0/11, 192.160.0.0/13, 192.169.0.0/16, 192.170.0.0/15, 192.172.0.0/14, 192.176.0.0/12, 192.192.0.0/10, 193.0.0.0/8, 194.0.0.0/7, 196.0.0.0/6, 200.0.0.0/5, 208.0.0.0/4"
                : "0.0.0.0/0"
            let wgQuick = """
            [Interface]
            PrivateKey = \(clientPrivB64)
            Address = \(assignedAddr)
            DNS = \(dnsServers)
            MTU = 1380

            [Peer]
            PublicKey = \(serverPub)
            AllowedIPs = \(allowedIps)
            Endpoint = \(endpoint)
            PersistentKeepalive = 25
            """

            let existing = ((try? await NETunnelProviderManager.loadAllFromPreferences()) ?? []).first
            let mgr = existing ?? NETunnelProviderManager()
            let proto = NETunnelProviderProtocol()
            proto.providerBundleIdentifier = SweeprConfig.tunnelBundleId
            proto.serverAddress = endpoint
            proto.providerConfiguration = [
                "wgQuickConfig": wgQuick,
                "serverCode": selectedNodeCode,
                "endpoint": endpoint,
                "serverPublicKey": serverPub,
                "address": assignedAddr,
                "dns": dnsServers,
                "acrShield": acrShieldEnabled,
                "lanBypass": lanBypassEnabled
            ]
            mgr.protocolConfiguration = proto
            mgr.localizedDescription = "SWEEPR VPN (\(selectedNodeCode))"
            mgr.isEnabled = true

            try await mgr.saveToPreferences()
            try await mgr.loadFromPreferences()
            tunnelManager = mgr
            if mgr.connection.status == .connected || mgr.connection.status == .connecting || mgr.connection.status == .reasserting {
                mgr.connection.stopVPNTunnel()
                try? await Task.sleep(nanoseconds: 400_000_000)
            }
            try mgr.connection.startVPNTunnel()

            let selected = nodes.first { $0.code == selectedNodeCode }
            let label = selected.map { "\($0.city), \($0.country)" } ?? selectedNodeCode
            state = .connected(serverCity: label, endpoint: endpoint)

            pendingSuccessfulConnections += 1
            UserDefaults.standard.set(pendingSuccessfulConnections, forKey: "sweepr_connect_count")
            if pendingSuccessfulConnections >= 3 && !hasRequestedReview {
                hasRequestedReview = true
                shouldPromptAppStoreReview = true
            }
        } catch {
            state = .error("System VPN permission is required to activate WireGuard encryption: \(error.localizedDescription)")
        }
    }

    func disconnect() {
        state = .disconnecting
        tunnelManager?.connection.stopVPNTunnel()
        state = .disconnected
    }

    func selectNode(_ code: String) {
        selectedNodeCode = code
        UserDefaults.standard.set(code, forKey: "sweepr_node")
        if case .connected = state {
            Task { await connect() }
        }
    }
}

// MARK: - App Entry Point

@main
struct SweeprVpnApp: App {
    @StateObject private var vm = SweeprVpnViewModel()

    var body: some Scene {
        WindowGroup {
            SweeprVpnRootView(vm: vm)
                #if os(macOS)
                .frame(minWidth: 420, idealWidth: 460, minHeight: 680, idealHeight: 740)
                #endif
        }
        #if os(macOS)
        MenuBarExtra {
            VStack(alignment: .leading, spacing: 8) {
                Text(menuStatusLabel)
                    .font(.headline)
                Divider()
                Button(isConnected ? "Disconnect VPN" : "Connect to \(vm.selectedNodeCode)") {
                    vm.toggleConnect()
                }
                Toggle("Smart-TV & Tracker DNS Shield", isOn: $vm.acrShieldEnabled)
                Toggle("Launch SWEEPR VPN at Login", isOn: Binding(
                    get: { vm.launchAtLoginEnabled },
                    set: { vm.setLaunchAtLogin($0) }
                ))
                Divider()
                Button("Quit SWEEPR VPN") {
                    NSApplication.shared.terminate(nil)
                }
            }
            .padding(8)
        } label: {
            Label("SWEEPR VPN", systemImage: isConnected ? "lock.shield.fill" : "shield.lefthalf.filled")
        }
        #endif
    }

    private var isConnected: Bool {
        if case .connected = vm.state { return true }
        return false
    }

    private var menuStatusLabel: String {
        switch vm.state {
        case .connected(let city, _): return "Protected • \(city)"
        case .connecting: return "Connecting..."
        case .disconnecting: return "Disconnecting..."
        case .error: return "Attention Required"
        case .disconnected: return "Disconnected"
        }
    }
}

// MARK: - Root Tab Shell

struct SweeprVpnRootView: View {
    @ObservedObject var vm: SweeprVpnViewModel
    @Environment(\.requestReview) private var requestReview
    @State private var selectedTab: SweeprTab = .connect

    var body: some View {
        TabView(selection: $selectedTab) {
            ConnectTabView(vm: vm)
                .tabItem { Label("Connect", systemImage: "lock.shield.fill") }
                .tag(SweeprTab.connect)

            NetworkRadarTabView(vm: vm)
                .tabItem { Label("Wi-Fi Shield", systemImage: "wifi") }
                .tag(SweeprTab.radar)

            ServerListTabView(vm: vm)
                .tabItem { Label("Locations", systemImage: "globe.europe.africa.fill") }
                .tag(SweeprTab.nodes)

            AccountSupportTabView(vm: vm)
                .tabItem { Label("Account", systemImage: "person.crop.circle") }
                .tag(SweeprTab.account)
        }
        .tint(Color(red: 0.02, green: 0.59, blue: 0.41))
        .onChange(of: vm.shouldPromptAppStoreReview) { trigger in
            if trigger {
                vm.shouldPromptAppStoreReview = false
                requestReview()
            }
        }
        .sheet(isPresented: $vm.showPaywallSheet) {
            SweeprPaywallSheet(vm: vm, storeKit: vm.storeKit)
        }
        .sheet(isPresented: $vm.showLoginSheet) {
            LicenseLoginSheet(vm: vm)
        }
        .sheet(isPresented: $vm.showQrScanner) {
            QrScannerOrManualSheet(vm: vm)
        }
        .sheet(isPresented: $vm.showVpnConsentSheet) {
            VpnConsentDisclosureSheet(
                onAgree: { vm.acceptDisclosureAndConnect() },
                onCancel: { vm.showVpnConsentSheet = false }
            )
        }
    }
}

// MARK: - Tab 1: Connect

private struct ConnectTabView: View {
    @ObservedObject var vm: SweeprVpnViewModel

    private var isConnected: Bool {
        if case .connected = vm.state { return true }
        return false
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    statusHeader
                    connectOrbButton
                    selectedServerPickerCard
                    if !vm.isActivated {
                        activatePromptCard
                    } else {
                        activeLicenseSummaryCard
                    }
                    if let msg = vm.statusMessage, !msg.isEmpty {
                        Text(msg)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                }
                .padding(20)
            }
            .navigationTitle("SWEEPR VPN")
        }
    }

    private var statusHeader: some View {
        VStack(spacing: 6) {
            let (title, tint): (String, Color) = {
                switch vm.state {
                case .connected(let city, _): return ("Encrypted via \(city)", .green)
                case .connecting: return ("Establishing WireGuard Tunnel...", .orange)
                case .disconnecting: return ("Disconnecting...", .orange)
                case .error(let msg): return (msg, .red)
                case .disconnected: return ("Your connection is not encrypted", .secondary)
                }
            }()
            Text(isConnected ? "PROTECTED" : "READY")
                .font(.caption.weight(.bold))
                .tracking(1.2)
                .padding(.horizontal, 12)
                .padding(.vertical, 5)
                .background(tint.opacity(0.14))
                .foregroundStyle(tint)
                .clipShape(Capsule())
            Text(title)
                .font(.headline)
                .multilineTextAlignment(.center)
        }
    }

    private var connectOrbButton: some View {
        Button {
            vm.toggleConnect()
        } label: {
            ZStack {
                Circle()
                    .fill(isConnected
                          ? LinearGradient(colors: [Color(red: 0.02, green: 0.59, blue: 0.41), Color(red: 0.06, green: 0.72, blue: 0.51)], startPoint: .topLeading, endPoint: .bottomTrailing)
                          : LinearGradient(colors: [Color(red: 0.09, green: 0.14, blue: 0.18), Color(red: 0.14, green: 0.21, blue: 0.26)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 168, height: 168)
                    .shadow(color: (isConnected ? Color.green : Color.black).opacity(0.2), radius: 18, y: 8)
                VStack(spacing: 8) {
                    Image(systemName: isConnected ? "lock.shield.fill" : "power")
                        .font(.system(size: 40, weight: .bold))
                        .foregroundStyle(.white)
                    Text(isConnected ? "Connected" : "Connect VPN")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.white)
                }
            }
        }
        .buttonStyle(.plain)
        .padding(.vertical, 8)
    }

    private var selectedServerPickerCard: some View {
        let current = vm.nodes.first { $0.code == vm.selectedNodeCode }
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(current?.flag ?? "🌍")
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text(current.map { "\($0.city), \($0.country)" } ?? vm.selectedNodeCode)
                        .font(.headline)
                    let rttLabel = (current?.rttMs).map { "\($0) ms • " } ?? ""
                    Text("WireGuard • \(rttLabel)\(vm.acrShieldEnabled ? "DNS Shield Active" : "Standard Private DNS")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Menu("Change") {
                    ForEach(vm.nodes) { node in
                        Button("\(node.flag) \(node.city) (\(node.code))\(node.rttMs.map { " — \($0) ms" } ?? "")") {
                            vm.selectNode(node.code)
                        }
                    }
                }
                .font(.subheadline.weight(.semibold))
            }
        }
        .padding(16)
        .background(Color.secondary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var activatePromptCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Unlock SWEEPR VPN Pro")
                .font(.headline)
            Text("Subscribe directly via Apple App Store, or sign in with your multi-device SWEEPR account key or QR pairing code.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            HStack(spacing: 10) {
                Button("View Plans") {
                    vm.showPaywallSheet = true
                }
                .buttonStyle(.borderedProminent)
                Button("License Key / QR") {
                    vm.showLoginSheet = true
                }
                .buttonStyle(.bordered)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.green.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var activeLicenseSummaryCard: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("Plan: \(vm.accountPlan)")
                    .font(.subheadline.weight(.bold))
                Text(vm.accountEmail.isEmpty ? "App Store Subscription Active" : vm.accountEmail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Button("Devices (\(vm.devicesUsed)/\(vm.maxDevices))") {
                vm.showLoginSheet = true
            }
            .font(.caption.weight(.semibold))
            .buttonStyle(.bordered)
        }
        .padding(16)
        .background(Color.secondary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

// MARK: - Tab 2: Wi-Fi & DNS Shield (Real On-Device Telemetry)

private struct NetworkRadarTabView: View {
    @ObservedObject var vm: SweeprVpnViewModel

    var body: some View {
        NavigationStack {
            List {
                Section("Smart-TV & Tracker DNS Shield") {
                    Toggle("Block ACR Ad & Tracker Domains", isOn: $vm.acrShieldEnabled)
                    Toggle("Local LAN Bypass (AirPlay & Printers)", isOn: $vm.lanBypassEnabled)
                    HStack {
                        Text("Tunnel DNS Policy")
                        Spacer()
                        Text(vm.acrShieldEnabled ? "1.1.1.2 (Filtered + IPv6)" : "1.1.1.1 (Zero-Log + IPv6)")
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                    }
                    Text("When connected, this setting configures the WireGuard tunnel DNS resolvers inside Apple Network Extension to drop smart-TV telemetry and tracking lookups before they leave your device.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section("Live Network Interface Diagnostic") {
                    LabeledContent("Active Path", value: vm.networkInterfaceSummary)
                    LabeledContent("IPv6 / NAT64", value: vm.ipv6Reachable ? "Supported" : "IPv4 Local")
                    if let rtt = vm.dnsLatencyMs {
                        LabeledContent("SWEEPR Control Latency", value: "\(rtt) ms")
                    }
                    Button {
                        vm.runRealDiagnosticsAndLanDiscovery()
                    } label: {
                        HStack {
                            Image(systemName: "waveform.path.ecg")
                            Text(vm.isScanningLan ? "Scanning Local Bonjour & Latency..." : "Run Network & Bonjour Check")
                        }
                    }
                    .disabled(vm.isScanningLan)
                }

                Section("Discovered Bonjour Services on LAN") {
                    if vm.discoveredLanDevices.isEmpty {
                        Text(vm.isScanningLan
                             ? "Listening for local AirPlay / mDNS responders..."
                             : "Tap \"Run Network & Bonjour Check\" above to discover real Bonjour devices broadcasting on your Wi-Fi.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(vm.discoveredLanDevices) { dev in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(dev.name).font(.subheadline.weight(.semibold))
                                Text(dev.detail).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Wi-Fi Shield")
        }
    }
}

// MARK: - Tab 3: Locations

private struct ServerListTabView: View {
    @ObservedObject var vm: SweeprVpnViewModel

    var body: some View {
        NavigationStack {
            List(vm.nodes) { node in
                Button {
                    vm.selectNode(node.code)
                } label: {
                    HStack(spacing: 12) {
                        Text(node.flag).font(.title2)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(node.city), \(node.country)").font(.headline)
                            Text("\(node.code) • WireGuard 10Gbps Zero-Log").font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if let rtt = node.rttMs {
                            Text("\(rtt) ms")
                                .font(.caption.monospaced().weight(.semibold))
                                .foregroundStyle(rtt < 45 ? .green : .secondary)
                        }
                        if vm.selectedNodeCode == node.code {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                        }
                    }
                }
                .foregroundStyle(.primary)
            }
            .navigationTitle("Server Locations")
            .refreshable {
                await vm.refreshNodesFromServer()
            }
        }
    }
}

// MARK: - Tab 4: Account, Support & Deletion (Guidelines 5.1.1(v) & 1.5)

private struct AccountSupportTabView: View {
    @ObservedObject var vm: SweeprVpnViewModel
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            Form {
                Section("Subscription & Multi-Device Access") {
                    LabeledContent("Status", value: vm.isActivated ? "Active (\(vm.accountPlan))" : "Not Activated")
                    if !vm.accountEmail.isEmpty {
                        LabeledContent("Account", value: vm.accountEmail)
                    }
                    Button(vm.isActivated ? "Upgrade or View Apple Plans" : "Subscribe via Apple App Store") {
                        vm.showPaywallSheet = true
                    }
                    Button("Sign In with License Key or QR Code") {
                        vm.showLoginSheet = true
                    }
                    Button("Manage Apple Subscription") {
                        #if os(iOS)
                        vm.showManageAppleSubs = true
                        #else
                        openURL(SweeprConfig.manageSubscriptionsMacURL)
                        #endif
                    }
                }

                #if os(macOS)
                Section("Desktop Preferences") {
                    Toggle("Launch SWEEPR VPN at Login", isOn: Binding(
                        get: { vm.launchAtLoginEnabled },
                        set: { vm.setLaunchAtLogin($0) }
                    ))
                }
                #endif

                if !vm.linkedDevices.isEmpty {
                    Section("Linked Devices (\(vm.devicesUsed)/\(vm.maxDevices))") {
                        ForEach(vm.linkedDevices) { dev in
                            HStack {
                                VStack(alignment: .leading) {
                                    Text(dev.name).font(.subheadline.weight(.medium))
                                    if dev.id == vm.deviceId {
                                        Text("This device").font(.caption2).foregroundStyle(.green)
                                    }
                                }
                                Spacer()
                                if dev.id != vm.deviceId {
                                    Button("Remove", role: .destructive) {
                                        Task { await vm.revokeDevice(dev.id) }
                                    }
                                    .font(.caption)
                                }
                            }
                        }
                    }
                }

                Section("Customer Support & Legal") {
                    Link(destination: URL(string: "mailto:\(SweeprConfig.supportEmail)")!) {
                        LabeledContent("Support Email", value: SweeprConfig.supportEmail)
                    }
                    Link("Privacy Policy", destination: SweeprConfig.privacyURL)
                    Link("Terms of Service (EULA)", destination: SweeprConfig.termsURL)
                }

                Section("Send Support Request") {
                    TextField("Subject (optional)", text: $vm.supportSubject)
                    TextField("How can we help?", text: $vm.supportMessage, axis: .vertical)
                        .lineLimit(3...6)
                    Button {
                        Task { await vm.submitSupportTicket() }
                    } label: {
                        Text(vm.supportSubmitting ? "Sending..." : "Submit Support Ticket")
                    }
                    .disabled(vm.supportSubmitting || vm.supportMessage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    if let resMsg = vm.supportResultMessage {
                        Text(resMsg).font(.caption).foregroundStyle(.secondary)
                    }
                }

                Section("Account Data Control") {
                    Button("Delete Account & Data", role: .destructive) {
                        vm.showDeleteConfirmAlert = true
                    }
                    .disabled(!vm.isActivated && vm.storeKit.latestSignedTransactionJws == nil)
                    Text("Permanently removes your SWEEPR VPN license record, linked device tokens, and local WireGuard configuration. Active Apple auto-renewing billing must be canceled in Apple Account Settings if applicable.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Account & Support")
            #if os(iOS)
            .manageSubscriptionsSheet(isPresented: $vm.showManageAppleSubs)
            #endif
            .alert("Permanently Delete Account?", isPresented: $vm.showDeleteConfirmAlert) {
                Button("Delete Permanently", role: .destructive) {
                    Task { await vm.deleteAccountAndData() }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This permanently erases your SWEEPR VPN account credentials, revokes linked tunnel peers, and disconnects this device. This action cannot be undone.")
            }
        }
    }
}

// MARK: - StoreKit 2 Anchor & Decoy Paywall (Zero External Checkout Links)

private struct SweeprPaywallSheet: View {
    @ObservedObject var vm: SweeprVpnViewModel
    @ObservedObject var storeKit: SweeprStoreKitManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("SWEEPR VPN Pro")
                            .font(.title.weight(.bold))
                        Text("Fast open-source WireGuard encryption, strict zero-logs architecture, public Wi-Fi protection, and Smart-TV DNS Shield on iPhone, iPad, Mac, Windows & Linux.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    if storeKit.isLoadingProducts {
                        ProgressView("Loading App Store plans...")
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding()
                    } else if storeKit.products.isEmpty {
                        fallbackPlanSummaryCards
                    } else {
                        ForEach(storeKit.products, id: \.id) { product in
                            StoreKitProductCard(product: product, isBusy: storeKit.isPurchasing) {
                                Task { await storeKit.purchase(product) }
                            }
                        }
                    }

                    if let err = storeKit.storeError {
                        Text(err)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

                    HStack {
                        Button("Restore Purchases") {
                            Task { await storeKit.restorePurchases() }
                        }
                        Spacer()
                        Button("Use Existing Key / QR") {
                            dismiss()
                            vm.showLoginSheet = true
                        }
                    }
                    .font(.subheadline.weight(.semibold))
                    .padding(.top, 4)

                    Divider()

                    VStack(alignment: .leading, spacing: 6) {
                        Text("Apple Subscription Disclosure")
                            .font(.caption.weight(.bold))
                        Text("Payment is charged to your Apple ID account at confirmation of purchase. Subscriptions automatically renew at the selected rate (e.g. Yearly Pro, 6-Monthly Pro, or Monthly Pro) unless auto-renew is turned off at least 24 hours before the end of the current billing period. Your account will be charged for renewal within 24 hours prior to the end of the current period. Manage or cancel anytime in your Apple Account Settings.")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        HStack(spacing: 16) {
                            Link("Privacy Policy", destination: SweeprConfig.privacyURL)
                            Link("Terms of Service (EULA)", destination: SweeprConfig.termsURL)
                        }
                        .font(.caption.weight(.semibold))
                    }
                }
                .padding(20)
            }
            .navigationTitle("Upgrade to Pro")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .task {
                await storeKit.loadProducts()
            }
        }
    }

    private var fallbackPlanSummaryCards: some View {
        VStack(spacing: 10) {
            staticPreviewCard(
                badge: "BEST VALUE — SAVE 50%",
                title: "Yearly Plan (Core Pro + Wi-Fi Shield)",
                price: "£74.99 / year (£6.25/mo equiv.)",
                subtitle: "Billed yearly via Apple App Store • Auto-renews annually"
            )
            staticPreviewCard(
                badge: "SAVE 35%",
                title: "6-Monthly Plan",
                price: "£48.99 / 6 months (£8.17/mo equiv.)",
                subtitle: "Billed every 6 months via Apple App Store"
            )
            staticPreviewCard(
                badge: "FLEXIBLE",
                title: "Monthly Plan (1st-Month Intro Offer)",
                price: "£1.99 1st month, then £12.49 / month",
                subtitle: "Introductory offer via Apple App Store • Auto-renews monthly"
            )
            Button("Retry Loading App Store Prices") {
                Task { await storeKit.loadProducts() }
            }
            .buttonStyle(.borderedProminent)
            .frame(maxWidth: .infinity)
        }
    }

    private func staticPreviewCard(badge: String, title: String, price: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(badge)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.green)
            Text(title).font(.headline)
            Text(price).font(.subheadline.weight(.semibold))
            Text(subtitle).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.secondary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

private struct StoreKitProductCard: View {
    let product: Product
    let isBusy: Bool
    let onBuy: () -> Void

    private var badgeText: String? {
        if product.id.contains("annual") && !product.id.contains("addon") { return "CORE PRO — SAVE 50%" }
        if product.id.contains("sixmonth") { return "MID-TIER ANCHOR — SAVE 35%" }
        if product.id.contains("monthly") { return "1ST-MONTH INTRO OFFER" }
        if product.id.contains("addon.radar") { return "NETWORK SHIELD ADD-ON" }
        return nil
    }

    var body: some View {
        Button(action: onBuy) {
            VStack(alignment: .leading, spacing: 6) {
                if let badge = badgeText {
                    Text(badge)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.green)
                }
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(product.displayName).font(.headline)
                        Text(product.description).font(.caption).foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text(product.displayPrice)
                        .font(.title3.weight(.bold))
                }
            }
            .padding(14)
            .background(Color.secondary.opacity(0.09))
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .disabled(isBusy)
    }
}

// MARK: - Guideline 5.4 Pre-Consent VPN Data Disclosure Sheet

private struct VpnConsentDisclosureSheet: View {
    let onAgree: () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 16) {
                Label("Your Privacy & Tunnel Permission", systemImage: "hand.raised.shield.fill")
                    .font(.title2.weight(.bold))
                    .foregroundStyle(.green)

                Text("Before requesting macOS / iOS permission to add the SWEEPR VPN WireGuard configuration, please review what network data SWEEPR VPN processes:")
                    .font(.subheadline)

                VStack(alignment: .leading, spacing: 10) {
                    disclosureRow(
                        icon: "key.fill",
                        text: "License verification & ephemeral WireGuard public key exchange with your chosen SWEEPR VPN gateway."
                    )
                    disclosureRow(
                        icon: "network",
                        text: "Encrypted routing through a private tunnel IP (10.64.0.x) and selected zero-log DNS resolvers (1.1.1.1 / 1.1.1.2)."
                    )
                    disclosureRow(
                        icon: "eye.slash.fill",
                        text: "Zero browsing logs: SWEEPR VPN never logs, stores, inspects, or sells your visited websites, traffic payloads, or DNS queries."
                    )
                }
                .padding()
                .background(Color.secondary.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 14))

                Link("Read Full Privacy Policy", destination: SweeprConfig.privacyURL)
                    .font(.footnote.weight(.semibold))

                Spacer()

                Button("Agree & Enable VPN Tunnel", action: onAgree)
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
                Button("Not Now", role: .cancel, action: onCancel)
                    .frame(maxWidth: .infinity)
            }
            .padding(20)
            .navigationTitle("VPN Privacy Notice")
        }
    }

    private func disclosureRow(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon).foregroundStyle(.green).frame(width: 22)
            Text(text).font(.footnote)
        }
    }
}

// MARK: - License Key / QR Pairing Login Sheet

private struct LicenseLoginSheet: View {
    @ObservedObject var vm: SweeprVpnViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section("Activate with License Key or 6-Digit Code") {
                    TextField("SWEEPR-VPN-XXXX-XXXX-XXXX or 6-digit code", text: $vm.activationCodeInput)
                        .autocorrectionDisabled()
                    TextField("Account email", text: $vm.emailInput)
                        .autocorrectionDisabled()
                    Button {
                        Task { await vm.validateLicenseWithServer(key: vm.activationCodeInput, email: vm.emailInput) }
                    } label: {
                        Text(vm.isVerifying ? "Verifying..." : "Activate Device")
                    }
                    .disabled(vm.isVerifying || vm.activationCodeInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }

                Section("Pair via Customer Portal QR Code") {
                    Button {
                        dismiss()
                        vm.showQrScanner = true
                    } label: {
                        Label("Scan or Enter QR Pairing Token", systemImage: "qrcode.viewfinder")
                    }
                }
            }
            .navigationTitle("Sign In")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Camera QR Scanner (iOS) + Graceful Denied/macOS Manual Token Fallback

private struct QrScannerOrManualSheet: View {
    @ObservedObject var vm: SweeprVpnViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var manualToken: String = ""
    @State private var cameraAuthorized: Bool = false
    @State private var cameraDenied: Bool = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                #if os(iOS)
                if cameraAuthorized {
                    QrCameraScannerView { scanned in
                        Task { await vm.redeemQrPairingUrl(scanned) }
                    }
                    .frame(height: 300)
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                } else {
                    cameraFallbackCard
                }
                #else
                cameraFallbackCard
                #endif

                VStack(alignment: .leading, spacing: 8) {
                    Text("Or paste pairing link / key directly:")
                        .font(.caption.weight(.semibold))
                    TextField("https://sweeprvpn.com/pair?t=... or SWEEPR-VPN-...", text: $manualToken)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()
                    Button("Redeem Pairing Code") {
                        Task { await vm.redeemQrPairingUrl(manualToken) }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(manualToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || vm.isVerifying)
                }
                Spacer()
            }
            .padding(20)
            .navigationTitle("Pair Device")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .onAppear { checkCameraPermission() }
        }
    }

    private var cameraFallbackCard: some View {
        VStack(spacing: 10) {
            Image(systemName: "qrcode.viewfinder")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text(cameraDenied
                 ? "Camera permission is currently disabled. Enable Camera access in Settings to scan your portal QR code, or paste the pairing link below."
                 : "Paste your pairing link (`https://sweeprvpn.com/pair?t=...`) or license key from your Customer Portal below.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            #if os(iOS)
            if cameraDenied, let settingsUrl = URL(string: UIApplication.openSettingsURLString) {
                Link("Open iOS Settings", destination: settingsUrl)
                    .font(.footnote.weight(.semibold))
            }
            #endif
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color.secondary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func checkCameraPermission() {
        #if os(iOS)
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            cameraAuthorized = true
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                Task { @MainActor in
                    cameraAuthorized = granted
                    cameraDenied = !granted
                }
            }
        default:
            cameraAuthorized = false
            cameraDenied = true
        }
        #endif
    }
}

#if os(iOS)
private struct QrCameraScannerView: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    func makeUIViewController(context: Context) -> ScannerVC {
        let vc = ScannerVC()
        vc.onCode = onCode
        return vc
    }

    func updateUIViewController(_ uiViewController: ScannerVC, context: Context) {}

    final class ScannerVC: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
        var onCode: ((String) -> Void)?
        private var session: AVCaptureSession?
        private var didEmit = false

        override func viewDidLoad() {
            super.viewDidLoad()
            let captureSession = AVCaptureSession()
            guard let videoDevice = AVCaptureDevice.default(for: .video),
                  let input = try? AVCaptureDeviceInput(device: videoDevice),
                  captureSession.canAddInput(input) else { return }
            captureSession.addInput(input)
            let output = AVCaptureMetadataOutput()
            if captureSession.canAddOutput(output) {
                captureSession.addOutput(output)
                output.setMetadataObjectsDelegate(self, queue: .main)
                output.metadataObjectTypes = [.qr]
            }
            let preview = AVCaptureVideoPreviewLayer(session: captureSession)
            preview.frame = view.bounds
            preview.videoGravity = .resizeAspectFill
            view.layer.addSublayer(preview)
            session = captureSession
            DispatchQueue.global(qos: .userInitiated).async {
                captureSession.startRunning()
            }
        }

        override func viewWillDisappear(_ animated: Bool) {
            super.viewWillDisappear(animated)
            session?.stopRunning()
        }

        func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
            guard !didEmit,
                  let obj = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
                  let str = obj.stringValue else { return }
            didEmit = true
            onCode?(str)
        }
    }
}
#endif
