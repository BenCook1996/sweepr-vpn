import SwiftUI
import NetworkExtension
import AVFoundation
import UIKit
import Security
import CryptoKit

enum SweeprKeychain {
    private static let service = "com.sweepr.vpn"

    static func save(_ value: String, for account: String) {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
        var addQuery = query
        addQuery[kSecValueData as String] = data
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(addQuery as CFDictionary, nil)
    }

    static func load(_ account: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
}

enum SweeprEd25519Verifier {
    // Master Ed25519 public key (matches Rust SWEEPR_LICENSE_PUBLIC_KEY_B64URL)
    private static let pubKeyHex = "f25ef871bd7d3ec2fc44b1972409fb3c4076cd334d397eb9e0d3d48543d09f74"

    private static func b64UrlDecode(_ str: String) -> Data? {
        var b64 = str.replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        let rem = b64.count % 4
        if rem > 0 { b64 += String(repeating: "=", count: 4 - rem) }
        return Data(base64Encoded: b64)
    }

    static func verifyToken(_ token: String) -> Bool {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return false }
        let signingInput = Data("\(parts[0]).\(parts[1])".utf8)
        guard let sigData = b64UrlDecode(String(parts[2])), sigData.count == 64 else { return false }
        var keyBytes = [UInt8]()
        var idx = pubKeyHex.startIndex
        while idx < pubKeyHex.endIndex {
            let next = pubKeyHex.index(idx, offsetBy: 2)
            if let b = UInt8(pubKeyHex[idx..<next], radix: 16) { keyBytes.append(b) }
            idx = next
        }
        guard let pubKey = try? Curve25519.Signing.PublicKey(rawRepresentation: Data(keyBytes)) else { return false }
        return pubKey.isValidSignature(sigData, for: signingInput)
    }
}

struct VpnServerNode: Identifiable, Decodable, Equatable {
    var id: String { code }
    let code: String
    let country: String
    let city: String
    let flag: String
    var online: Bool?
    var probe_ms: Int?
}

struct VpnServersListResponse: Decodable {
    let ok: Bool
    let servers: [VpnServerNode]?
}

struct VpnActivateResponse: Decodable {
    let ok: Bool
    let valid: Bool?
    let email: String?
    let licenseKey: String?
    let license_key: String?
    let token: String?
    let devices_used: Int?
    let max_devices: Int?
    let message: String?
}

struct WireGuardConfigResponse: Decodable {
    let ok: Bool
    let server_code: String?
    let endpoint: String?
    let address: String?
    let dns: String?
    let server_public_key: String?
    let config_text: String?
    let filename: String?
    let message: String?
}

struct NetworkCheckResponse: Decodable {
    let ip: String?
    let country: String?
    let city: String?
    let isp: String?
    let is_sweepr_vpn: Bool?
}

struct PairingRedeemResponse: Decodable {
    let ok: Bool
    let email: String?
    let license_key: String?
    let token: String?
    let device_count: Int?
    let device_limit: Int?
    let error: String?
    let message: String?
}

struct PairingApproveResponse: Decodable {
    let ok: Bool
    let status: String?
    let device_count: Int?
    let device_limit: Int?
    let error: String?
    let message: String?
}

@MainActor
final class SweeprVpnViewModel: ObservableObject {
    @Published var servers: [VpnServerNode] = [
        VpnServerNode(code: "UK-LON-01", country: "United Kingdom", city: "London", flag: "🇬🇧", online: true, probe_ms: 8),
        VpnServerNode(code: "SE-STO-01", country: "Sweden", city: "Stockholm", flag: "🇸🇪", online: true, probe_ms: 19),
        VpnServerNode(code: "NL-AMS-01", country: "Netherlands", city: "Amsterdam", flag: "🇳🇱", online: true, probe_ms: 12),
        VpnServerNode(code: "DE-FRA-01", country: "Germany", city: "Frankfurt", flag: "🇩🇪", online: true, probe_ms: 15),
        VpnServerNode(code: "US-NYC-01", country: "United States", city: "New York", flag: "🇺🇸", online: true, probe_ms: 68),
        VpnServerNode(code: "US-LAX-01", country: "United States", city: "Los Angeles", flag: "🇺🇸", online: true, probe_ms: 112),
        VpnServerNode(code: "SG-SIN-01", country: "Singapore", city: "Singapore", flag: "🇸🇬", online: true, probe_ms: 148),
        VpnServerNode(code: "JP-TYO-01", country: "Japan", city: "Tokyo", flag: "🇯🇵", online: true, probe_ms: 162)
    ]
    @Published var isConnected: Bool = false
    @Published var isConnecting: Bool = false
    @Published var isPro: Bool = false
    @Published var lanBypass: Bool = false
    @Published var userEmail: String = ""
    @Published var licenseKey: String = ""
    @Published var authToken: String = ""
    @Published var selectedServerCode: String = "UK-LON-01"
    @Published var assignedTunnelIp: String = ""
    @Published var activeEndpoint: String = ""
    @Published var provisionedWgConf: String = ""
    @Published var egressIpSummary: String = "Checking network…"
    @Published var deviceCount: Int = 1
    @Published var deviceLimit: Int = 3
    @Published var statusBanner: String = "Ready to protect your iPhone"
    @Published var showActivationSheet: Bool = false
    @Published var showQrScannerSheet: Bool = false
    @Published var showProfileExportSheet: Bool = false
    @Published var pendingDesktopChallengeId: String? = nil
    @Published var manualQrTokenInput: String = ""
    @Published var licenseInputKey: String = ""
    @Published var licenseInputEmail: String = ""

    let apiBase = "https://sweeprvpn.com"
    private var vpnObserver: NSObjectProtocol?

    var deviceId: String {
        if let saved = UserDefaults.standard.string(forKey: "sweepr_device_id"), !saved.isEmpty {
            return saved
        }
        let fresh = "ios_" + UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(16).lowercased()
        UserDefaults.standard.set(fresh, forKey: "sweepr_device_id")
        return fresh
    }

    var currentServer: VpnServerNode {
        servers.first(where: { $0.code == selectedServerCode }) ?? servers[0]
    }

    init() {
        self.userEmail = UserDefaults.standard.string(forKey: "sweepr_email") ?? ""
        if let kcKey = SweeprKeychain.load("sweepr_license_key"), !kcKey.isEmpty {
            self.licenseKey = kcKey
        } else if let legacyKey = UserDefaults.standard.string(forKey: "sweepr_license_key"), !legacyKey.isEmpty {
            self.licenseKey = legacyKey
            SweeprKeychain.save(legacyKey, for: "sweepr_license_key")
            UserDefaults.standard.removeObject(forKey: "sweepr_license_key")
        }
        if let kcTok = SweeprKeychain.load("sweepr_token"), !kcTok.isEmpty {
            self.authToken = kcTok
        } else if let legacyTok = UserDefaults.standard.string(forKey: "sweepr_token"), !legacyTok.isEmpty {
            self.authToken = legacyTok
            SweeprKeychain.save(legacyTok, for: "sweepr_token")
            UserDefaults.standard.removeObject(forKey: "sweepr_token")
        }
        self.selectedServerCode = UserDefaults.standard.string(forKey: "sweepr_server_code") ?? "UK-LON-01"
        self.lanBypass = UserDefaults.standard.object(forKey: "sweepr_lan_bypass") as? Bool ?? false
        self.isPro = !self.licenseKey.isEmpty
        self.licenseInputKey = self.licenseKey
        self.licenseInputEmail = self.userEmail

        vpnObserver = NotificationCenter.default.addObserver(
            forName: .NEVPNStatusDidChange,
            object: nil,
            queue: .main
        ) { [weak self] note in
            guard let self = self,
                  let conn = note.object as? NEVPNConnection else { return }
            Task { @MainActor in
                switch conn.status {
                case .connected:
                    self.isConnected = true
                    self.isConnecting = false
                    self.statusBanner = "Protected via \(self.currentServer.city) (\(self.assignedTunnelIp.isEmpty ? "WireGuard" : self.assignedTunnelIp))"
                    await self.refreshEgressIp()
                case .connecting, .reasserting:
                    self.isConnecting = true
                    self.statusBanner = "Connecting WireGuard tunnel to \(self.currentServer.city)…"
                case .disconnected, .invalid:
                    self.isConnected = false
                    self.isConnecting = false
                case .disconnecting:
                    self.isConnecting = true
                @unknown default:
                    break
                }
            }
        }

        Task {
            await syncSystemTunnelStatus()
            await refreshLiveServers()
            await refreshEgressIp()
        }
    }

    func selectServer(_ code: String) async {
        selectedServerCode = code
        UserDefaults.standard.set(code, forKey: "sweepr_server_code")
        if isConnected || (isPro && !licenseKey.isEmpty) {
            await connectTunnel()
        }
    }

    func syncSystemTunnelStatus() async {
        do {
            let managers = try await NETunnelProviderManager.loadAllFromPreferences()
            if let mgr = managers.first {
                let status = mgr.connection.status
                self.isConnected = (status == .connected)
                self.isConnecting = (status == .connecting || status == .reasserting)
            }
        } catch {
            self.isConnected = false
        }
    }

    func refreshLiveServers() async {
        guard let url = URL(string: "\(apiBase)/api/vpn/servers") else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let decoded = try JSONDecoder().decode(VpnServersListResponse.self, from: data)
            if decoded.ok, let liveList = decoded.servers, !liveList.isEmpty {
                for live in liveList {
                    if let idx = servers.firstIndex(where: { $0.code == live.code }) {
                        servers[idx].online = live.online ?? true
                        if let ms = live.probe_ms {
                            servers[idx].probe_ms = ms
                        }
                    }
                }
            }
        } catch {}
    }

    func refreshEgressIp() async {
        guard let url = URL(string: "\(apiBase)/api/tools/network-check") else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            let info = try JSONDecoder().decode(NetworkCheckResponse.self, from: data)
            if let ip = info.ip {
                let loc = [info.city, info.country].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
                self.egressIpSummary = loc.isEmpty ? ip : "\(ip) • \(loc)"
            }
        } catch {
            self.egressIpSummary = isConnected ? "Protected via \(currentServer.city)" : "Standard ISP Connection"
        }
    }

    func activateLicenseKey() async {
        let cleanKey = licenseInputKey.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let cleanEmail = licenseInputEmail.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard cleanKey.count >= 6 else {
            statusBanner = "Please enter a valid SWEEPR license key or 6-digit activation code."
            return
        }
        guard let url = URL(string: "\(apiBase)/api/vpn/activate") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "key": cleanKey,
            "activation_code": cleanKey,
            "otp": cleanKey,
            "email": cleanEmail,
            "device_id": deviceId,
            "device_name": UIDevice.current.name,
            "os": "ios",
            "project_id": "vpn"
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            let decoded = try JSONDecoder().decode(VpnActivateResponse.self, from: data)
            if decoded.ok && (decoded.valid ?? false) {
                if let tok = decoded.token, !tok.isEmpty, !SweeprEd25519Verifier.verifyToken(tok) {
                    self.statusBanner = "License signature verification failed."
                    return
                }
                let resolvedKey = decoded.licenseKey ?? decoded.license_key ?? cleanKey
                self.licenseKey = resolvedKey
                self.userEmail = decoded.email ?? cleanEmail
                self.authToken = decoded.token ?? ""
                self.deviceCount = decoded.devices_used ?? 1
                self.deviceLimit = decoded.max_devices ?? 3
                self.isPro = true
                UserDefaults.standard.set(self.userEmail, forKey: "sweepr_email")
                SweeprKeychain.save(self.licenseKey, for: "sweepr_license_key")
                SweeprKeychain.save(self.authToken, for: "sweepr_token")
                UserDefaults.standard.removeObject(forKey: "sweepr_license_key")
                UserDefaults.standard.removeObject(forKey: "sweepr_token")
                self.showActivationSheet = false
                self.statusBanner = "SWEEPR Pro unlocked (\(self.deviceCount)/\(self.deviceLimit) devices active)"
            } else {
                self.statusBanner = decoded.message ?? "Invalid or expired license key."
            }
        } catch {
            self.statusBanner = "Could not reach SWEEPR activation server."
        }
    }

    func toggleConnection() async {
        guard isPro && !licenseKey.isEmpty else {
            showActivationSheet = true
            return
        }
        if isConnected {
            await disconnectTunnel()
        } else {
            await connectTunnel()
        }
    }

    func connectTunnel() async {
        guard !isConnecting else { return }
        isConnecting = true
        statusBanner = "Provisioning WireGuard peer on \(currentServer.city)…"

        guard let url = URL(string: "\(apiBase)/api/vpn/wireguard-config") else {
            isConnecting = false
            return
        }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "activation_code": licenseKey,
            "license_key": licenseKey,
            "email": userEmail,
            "server_code": selectedServerCode,
            "lan_bypass": lanBypass,
            "device_id": deviceId
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            let wg = try JSONDecoder().decode(WireGuardConfigResponse.self, from: data)
            guard wg.ok, let conf = wg.config_text, !conf.isEmpty else {
                isConnecting = false
                isConnected = false
                statusBanner = wg.message ?? "Could not provision WireGuard configuration."
                return
            }

            self.provisionedWgConf = conf
            self.assignedTunnelIp = wg.address ?? "10.64.0.2/32"
            self.activeEndpoint = wg.endpoint ?? ""

            // Configure and start iOS NetworkExtension Packet Tunnel Provider
            do {
                let managers = try await NETunnelProviderManager.loadAllFromPreferences()
                let manager = managers.first ?? NETunnelProviderManager()
                let proto = NETunnelProviderProtocol()
                proto.providerBundleIdentifier = "com.sweepr.vpn.tunnel"
                proto.serverAddress = wg.endpoint ?? currentServer.city
                proto.providerConfiguration = [
                    "wgQuickConfig": conf,
                    "serverCode": selectedServerCode,
                    "address": wg.address ?? "",
                    "dns": wg.dns ?? "1.1.1.1, 1.0.0.1",
                    "serverPublicKey": wg.server_public_key ?? ""
                ]
                proto.disconnectOnSleep = false
                manager.protocolConfiguration = proto
                manager.localizedDescription = "SWEEPR VPN (\(currentServer.city))"
                manager.isEnabled = true
                try await manager.saveToPreferences()
                try await manager.loadFromPreferences()
                try manager.connection.startVPNTunnel()
                self.isConnecting = false
                self.isConnected = true
                self.statusBanner = "Protected via \(currentServer.city) (\(self.assignedTunnelIp))"
                await refreshEgressIp()
            } catch {
                // If running without the embedded PacketTunnel extension entitlement, present native Apple .mobileconfig / WireGuard handoff
                self.isConnecting = false
                self.isConnected = false
                self.showProfileExportSheet = true
                self.statusBanner = "Peer active on \(currentServer.city) (\(self.assignedTunnelIp)). Install iOS profile to route traffic."
            }
        } catch {
            isConnecting = false
            isConnected = false
            statusBanner = "Could not reach SWEEPR WireGuard server."
        }
    }

    func disconnectTunnel() async {
        do {
            let managers = try await NETunnelProviderManager.loadAllFromPreferences()
            if let mgr = managers.first {
                mgr.connection.stopVPNTunnel()
            }
        } catch {}
        isConnected = false
        isConnecting = false
        statusBanner = "VPN protection paused"
        await refreshEgressIp()
    }

    func requestAppleMobileConfigUrl() async -> URL? {
        guard let url = URL(string: "\(apiBase)/api/vpn/apple-mobileconfig-ticket") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: Any] = [
            "key": licenseKey,
            "email": userEmail,
            "server_code": selectedServerCode,
            "device_id": deviceId
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let relPath = obj["url"] as? String {
                return URL(string: "\(apiBase)\(relPath)")
            }
        } catch {}
        return nil
    }

    /// Handles scanned QR URLs (`https://sweeprvpn.com/pair?t=ptk_...` or `?c=chk_...` or `sweeprvpn://pair?...`)
    func handleScannedQrPayload(_ raw: String, requireConfirmForChallenge: Bool = false) async {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: trimmed),
           let comps = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            if let t = comps.queryItems?.first(where: { $0.name == "t" })?.value, t.hasPrefix("ptk_") {
                await redeemPairingToken(t)
                return
            }
            if let c = comps.queryItems?.first(where: { $0.name == "c" })?.value, c.hasPrefix("chk_") {
                if requireConfirmForChallenge {
                    self.pendingDesktopChallengeId = c
                } else {
                    await approveDesktopChallenge(c)
                }
                return
            }
        }
        if trimmed.hasPrefix("ptk_") {
            await redeemPairingToken(trimmed)
        } else if trimmed.hasPrefix("chk_") {
            if requireConfirmForChallenge {
                self.pendingDesktopChallengeId = trimmed
            } else {
                await approveDesktopChallenge(trimmed)
            }
        } else {
            statusBanner = "Unrecognised QR code. Scan the QR code on your SWEEPR Portal or Desktop App."
        }
    }

    /// Flow A: Redeem a one-time pairing token (`ptk_...`) generated on Customer Portal or Desktop App
    func redeemPairingToken(_ token: String) async {
        guard let url = URL(string: "\(apiBase)/api/vpn/pair/redeem") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: String] = [
            "pair_token": token,
            "device_id": deviceId,
            "device_name": UIDevice.current.name,
            "os": "iOS"
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            let decoded = try JSONDecoder().decode(PairingRedeemResponse.self, from: data)
            if decoded.ok, let key = decoded.license_key {
                self.licenseKey = key
                self.licenseInputKey = key
                self.userEmail = decoded.email ?? self.userEmail
                self.authToken = decoded.token ?? ""
                self.deviceCount = decoded.device_count ?? 1
                self.deviceLimit = decoded.device_limit ?? 3
                self.isPro = true
                UserDefaults.standard.set(self.userEmail, forKey: "sweepr_email")
                SweeprKeychain.save(self.licenseKey, for: "sweepr_license_key")
                SweeprKeychain.save(self.authToken, for: "sweepr_token")
                UserDefaults.standard.removeObject(forKey: "sweepr_license_key")
                UserDefaults.standard.removeObject(forKey: "sweepr_token")
                self.showQrScannerSheet = false
                self.showActivationSheet = false
                self.statusBanner = "Linked via QR (\(self.deviceCount)/\(self.deviceLimit) devices active)"
            } else {
                self.statusBanner = decoded.message ?? "QR pairing token expired or device limit (3) reached."
            }
        } catch {
            self.statusBanner = "Could not reach SWEEPR pairing server."
        }
    }

    /// Flow B: Approve an unactivated Desktop App's reverse-QR challenge (`chk_...`) using this phone's active subscription
    func approveDesktopChallenge(_ challengeId: String) async {
        guard !licenseKey.isEmpty else {
            statusBanner = "Activate SWEEPR Pro on this iPhone first, or enter your license key on the pairing page."
            return
        }
        guard let url = URL(string: "\(apiBase)/api/vpn/pair/approve") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let body: [String: String] = [
            "challenge_id": challengeId,
            "email": userEmail,
            "code": licenseKey
        ]
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)

        do {
            let (data, _) = try await URLSession.shared.data(for: req)
            let decoded = try JSONDecoder().decode(PairingApproveResponse.self, from: data)
            if decoded.ok {
                self.deviceCount = decoded.device_count ?? self.deviceCount
                self.deviceLimit = decoded.device_limit ?? 3
                self.showQrScannerSheet = false
                self.statusBanner = "Desktop App unlocked! (\(self.deviceCount)/\(self.deviceLimit) devices active)"
            } else {
                self.statusBanner = decoded.message ?? "Could not approve Desktop QR challenge."
            }
        } catch {
            self.statusBanner = "Network error while approving Desktop QR code."
        }
    }
}

/// Real AVCaptureSession camera QR scanner for iOS with dynamic preview bounds & torch toggle
final class ScannerHostViewController: UIViewController {
    var previewLayer: AVCaptureVideoPreviewLayer?
    var captureDevice: AVCaptureDevice?
    var captureSession: AVCaptureSession?

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        previewLayer?.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if captureSession?.isRunning == true {
            DispatchQueue.global(qos: .userInitiated).async { [weak self] in
                self?.captureSession?.stopRunning()
            }
        }
    }
}

struct QrCameraScannerView: UIViewControllerRepresentable {
    var isTorchOn: Bool = false
    var onCodeScanned: (String) -> Void

    final class Coordinator: NSObject, AVCaptureMetadataOutputObjectsDelegate {
        var parent: QrCameraScannerView
        var hasScanned = false

        init(parent: QrCameraScannerView) {
            self.parent = parent
        }

        func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
            guard !hasScanned,
                  let obj = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
                  obj.type == .qr,
                  let str = obj.stringValue, !str.isEmpty else { return }
            hasScanned = true
            parent.onCodeScanned(str)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeUIViewController(context: Context) -> ScannerHostViewController {
        let vc = ScannerHostViewController()
        let session = AVCaptureSession()
        vc.captureSession = session
        if let device = AVCaptureDevice.default(for: .video),
           let input = try? AVCaptureDeviceInput(device: device),
           session.canAddInput(input) {
            vc.captureDevice = device
            session.addInput(input)
            let output = AVCaptureMetadataOutput()
            if session.canAddOutput(output) {
                session.addOutput(output)
                output.setMetadataObjectsDelegate(context.coordinator, queue: .main)
                output.metadataObjectTypes = [.qr]
            }
            let preview = AVCaptureVideoPreviewLayer(session: session)
            preview.frame = vc.view.bounds
            preview.videoGravity = .resizeAspectFill
            vc.view.layer.addSublayer(preview)
            vc.previewLayer = preview
            DispatchQueue.global(qos: .userInitiated).async {
                session.startRunning()
            }
        }
        return vc
    }

    func updateUIViewController(_ uiViewController: ScannerHostViewController, context: Context) {
        guard let device = uiViewController.captureDevice, device.hasTorch else { return }
        let desiredMode: AVCaptureDevice.TorchMode = isTorchOn ? .on : .off
        if device.torchMode != desiredMode {
            try? device.lockForConfiguration()
            device.torchMode = desiredMode
            device.unlockForConfiguration()
        }
    }
}

struct SweeprVpnRootView: View {
    @StateObject private var vm = SweeprVpnViewModel()
    @Environment(\.openURL) private var openURL
    @State private var selectedTab: Int = 0
    @State private var showServerPickerSheet: Bool = false
    @State private var isTorchOn: Bool = false
    @AppStorage("sweepr_ios_acr_shield") private var acrShieldEnabled: Bool = true
    @AppStorage("sweepr_ios_doorbell") private var doorbellModeEnabled: Bool = true
    @AppStorage("sweepr_ios_bedtime") private var bedtimePauseEnabled: Bool = false

    private func isoBadge(for code: String) -> String {
        String(code.prefix(2)).uppercased()
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            // TAB 0: TUNNEL
            NavigationStack {
                VStack(spacing: 0) {
                    ScrollView {
                        VStack(spacing: 14) {
                            // Instrumentation Strip
                            HStack {
                                HStack(spacing: 6) {
                                    Circle()
                                        .fill(Color(red: 0.02, green: 0.59, blue: 0.41))
                                        .frame(width: 7, height: 7)
                                    Text("TUNNEL // WIREGUARD 10GBPS")
                                        .font(.caption2.monospaced().weight(.bold))
                                        .foregroundStyle(.primary)
                                }
                                Spacer()
                                Text("ACR 10.66.0.1")
                                    .font(.caption2.monospaced().weight(.semibold))
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color(.separator).opacity(0.45), lineWidth: 1)
                            )
                            .padding(.horizontal)

                            // Header
                            HStack {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text("SWEEPR VPN")
                                        .font(.headline.weight(.bold))
                                    Text(vm.isPro ? "Pro Active • \(vm.deviceCount)/\(vm.deviceLimit) Devices" : "Free Wi-Fi Diagnostic Mode")
                                        .font(.caption.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Button {
                                    vm.showQrScannerSheet = true
                                } label: {
                                    Label("Scan QR", systemImage: "qrcode.viewfinder")
                                        .font(.caption.weight(.bold))
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(Color(red: 0.02, green: 0.59, blue: 0.41))
                            }
                            .padding(.horizontal)

                            // Status & Egress Telemetry Card
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text(vm.isConnected ? "PROTECTED ROUTE" : (vm.isConnecting ? "HANDSHAKE IN PROGRESS" : "STANDBY"))
                                        .font(.caption2.monospaced().weight(.bold))
                                        .foregroundStyle(vm.isConnected ? Color(red: 0.02, green: 0.59, blue: 0.41) : .secondary)
                                    Spacer()
                                    Text("\(vm.currentServer.probe_ms ?? 15) ms")
                                        .font(.caption.monospaced().monospacedDigit().weight(.bold))
                                        .foregroundStyle(Color(red: 0.02, green: 0.59, blue: 0.41))
                                }
                                Text(vm.statusBanner)
                                    .font(.subheadline.weight(.medium))
                                Text("Egress: \(vm.egressIpSummary)")
                                    .font(.caption2.monospaced().monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(Color(.secondarySystemBackground))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(vm.isConnected ? Color(red: 0.02, green: 0.59, blue: 0.41).opacity(0.6) : Color(.separator).opacity(0.4), lineWidth: 1)
                            )
                            .padding(.horizontal)

                            // Selected Server + Quick-Pick ISO POP Pills
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Text("SELECTED WIREGUARD POP")
                                        .font(.caption2.monospaced().weight(.bold))
                                        .foregroundStyle(.secondary)
                                    Spacer()
                                    Button("All \(vm.servers.count) ›") {
                                        showServerPickerSheet = true
                                    }
                                    .font(.caption.monospacedDigit().weight(.bold))
                                    .tint(Color(red: 0.02, green: 0.59, blue: 0.41))
                                }

                                Button {
                                    showServerPickerSheet = true
                                } label: {
                                    HStack(spacing: 12) {
                                        Text(isoBadge(for: vm.currentServer.code))
                                            .font(.caption.monospaced().weight(.bold))
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 5)
                                            .background(Color(red: 0.02, green: 0.59, blue: 0.41).opacity(0.14))
                                            .foregroundStyle(Color(red: 0.02, green: 0.59, blue: 0.41))
                                            .clipShape(RoundedRectangle(cornerRadius: 6))
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("\(vm.currentServer.country) — \(vm.currentServer.city)")
                                                .font(.subheadline.weight(.semibold))
                                                .foregroundStyle(.primary)
                                            Text("\(vm.currentServer.code) • \(vm.currentServer.probe_ms ?? 15) ms • 10 Gbps WireGuard")
                                                .font(.caption2.monospaced().monospacedDigit())
                                                .foregroundStyle(.secondary)
                                        }
                                        Spacer()
                                        Image(systemName: "chevron.right")
                                            .font(.caption.weight(.semibold))
                                            .foregroundStyle(.secondary)
                                    }
                                    .padding(12)
                                    .background(Color(.secondarySystemBackground))
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color(.separator).opacity(0.45), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)

                                ScrollView(.horizontal, showsIndicators: false) {
                                    HStack(spacing: 8) {
                                        ForEach(vm.servers.prefix(4)) { srv in
                                            let isSelected = vm.selectedServerCode == srv.code
                                            Button {
                                                Task { await vm.selectServer(srv.code) }
                                            } label: {
                                                HStack(spacing: 5) {
                                                    Text(isoBadge(for: srv.code))
                                                        .font(.caption2.monospaced().weight(.bold))
                                                    Text("\(srv.probe_ms ?? 15)ms")
                                                        .font(.caption2.monospacedDigit())
                                                        .foregroundStyle(.secondary)
                                                }
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 7)
                                                .background(isSelected ? Color(red: 0.02, green: 0.59, blue: 0.41).opacity(0.16) : Color(.secondarySystemBackground))
                                                .foregroundStyle(isSelected ? Color(red: 0.02, green: 0.59, blue: 0.41) : .primary)
                                                .clipShape(RoundedRectangle(cornerRadius: 8))
                                                .overlay(
                                                    RoundedRectangle(cornerRadius: 8)
                                                        .stroke(isSelected ? Color(red: 0.02, green: 0.59, blue: 0.41) : Color(.separator).opacity(0.4), lineWidth: 1)
                                                )
                                            }
                                            .buttonStyle(.plain)
                                        }
                                    }
                                }
                            }
                            .padding(.horizontal)

                            // LAN Bypass Toggle
                            Toggle("Local LAN Bypass (AirPlay & Printers)", isOn: $vm.lanBypass)
                                .font(.footnote.weight(.semibold))
                                .padding(12)
                                .background(Color(.secondarySystemBackground))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .padding(.horizontal)
                                .onChange(of: vm.lanBypass) { newVal in
                                    UserDefaults.standard.set(newVal, forKey: "sweepr_lan_bypass")
                                    if vm.isConnected {
                                        Task { await vm.connectTunnel() }
                                    }
                                }
                        }
                        .padding(.vertical, 14)
                    }

                    // Thumb-Zone Sticky Primary Connect Control
                    VStack(spacing: 8) {
                        Button {
                            Task { await vm.toggleConnection() }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: vm.isConnected ? "lock.shield.fill" : "shield.lefthalf.filled")
                                Text(vm.isConnecting ? "Connecting WireGuard…" : (vm.isConnected ? "Protected via \(vm.currentServer.city) — Tap to Pause" : "Connect to \(vm.currentServer.city)"))
                            }
                            .font(.headline.weight(.bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(vm.isConnected ? Color(red: 0.02, green: 0.59, blue: 0.41) : Color(red: 0.06, green: 0.46, blue: 0.35))
                        .disabled(vm.isConnecting)
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 10)
                    .background(.ultraThinMaterial)
                }
                .navigationTitle("Tunnel")
                .navigationBarTitleDisplayMode(.inline)
            }
            .tabItem {
                Label("Tunnel", systemImage: "shield.lefthalf.filled")
            }
            .tag(0)

            // TAB 1: WI-FI SHIELD
            NavigationStack {
                ScrollView {
                    VStack(spacing: 14) {
                        HStack {
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(acrShieldEnabled ? Color(red: 0.02, green: 0.59, blue: 0.41) : Color.gray)
                                    .frame(width: 7, height: 7)
                                Text("DNS SINKHOLE // 10.66.0.1 \(acrShieldEnabled ? "ACTIVE" : "PAUSED")")
                                    .font(.caption2.monospaced().weight(.bold))
                            }
                            Spacer()
                            Text("ON-DEVICE SCAN")
                                .font(.caption2.monospaced())
                                .foregroundStyle(.secondary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 9)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color(.separator).opacity(0.45), lineWidth: 1)
                        )
                        .padding(.horizontal)

                        VStack(spacing: 12) {
                            Toggle("Smart-TV ACR Telemetry Shield", isOn: $acrShieldEnabled)
                                .font(.subheadline.weight(.semibold))
                            Divider()
                            Toggle("Wi-Fi Doorbell Intruder Alerts", isOn: $doorbellModeEnabled)
                                .font(.subheadline.weight(.semibold))
                            Divider()
                            Toggle("Kids Console Bedtime Pause", isOn: $bedtimePauseEnabled)
                                .font(.subheadline.weight(.semibold))
                        }
                        .padding(14)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal)

                        VStack(alignment: .leading, spacing: 8) {
                            Text("LOCAL TUNNEL & DNS READOUT")
                                .font(.caption2.monospaced().weight(.bold))
                                .foregroundStyle(.secondary)
                            HStack {
                                Text("Assigned WireGuard IP")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(vm.assignedTunnelIp.isEmpty ? "10.64.0.2" : vm.assignedTunnelIp)
                                    .font(.footnote.monospaced().monospacedDigit().weight(.semibold))
                            }
                            HStack {
                                Text("Active ACR Resolver")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(acrShieldEnabled ? "10.66.0.1 (Filtered)" : "1.1.1.1 (Unfiltered)")
                                    .font(.footnote.monospaced().monospacedDigit().weight(.semibold))
                                    .foregroundStyle(acrShieldEnabled ? Color(red: 0.02, green: 0.59, blue: 0.41) : .secondary)
                            }
                            HStack {
                                Text("Route Summary")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text(vm.egressIpSummary)
                                    .font(.caption.monospaced().monospacedDigit())
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(14)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal)
                    }
                    .padding(.vertical, 14)
                }
                .navigationTitle("Wi-Fi Shield")
                .navigationBarTitleDisplayMode(.inline)
            }
            .tabItem {
                Label("Wi-Fi Shield", systemImage: "wifi.router")
            }
            .tag(1)

            // TAB 2: DEVICES
            NavigationStack {
                ScrollView {
                    VStack(spacing: 14) {
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text("LINKED DEVICE SLOTS")
                                    .font(.caption2.monospaced().weight(.bold))
                                    .foregroundStyle(.secondary)
                                Spacer()
                                Text("\(vm.deviceCount) / \(vm.deviceLimit) Slots Active")
                                    .font(.caption.monospaced().monospacedDigit().weight(.bold))
                                    .foregroundStyle(Color(red: 0.02, green: 0.59, blue: 0.41))
                            }
                            HStack(spacing: 6) {
                                ForEach(0..<max(1, vm.deviceLimit), id: \.self) { slotIdx in
                                    RoundedRectangle(cornerRadius: 3)
                                        .fill(slotIdx < vm.deviceCount ? Color(red: 0.02, green: 0.59, blue: 0.41) : Color(.tertiarySystemFill))
                                        .frame(height: 8)
                                }
                            }
                            Text(vm.isPro ? "SWEEPR Pro active on this device. Install WireGuard on your Apple profile or scan another device QR code below." : "Activate with a 1-tap camera QR scan from sweeprvpn.com/login or enter your SWEEPR license key.")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        .padding(14)
                        .background(Color(.secondarySystemBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal)

                        VStack(spacing: 10) {
                            Button {
                                vm.showQrScannerSheet = true
                            } label: {
                                Label("Scan Pairing QR Code", systemImage: "qrcode.viewfinder")
                                    .font(.subheadline.weight(.bold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color(red: 0.02, green: 0.59, blue: 0.41))

                            Button {
                                vm.showActivationSheet = true
                            } label: {
                                Label("Enter License Key", systemImage: "key.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                            }
                            .buttonStyle(.bordered)

                            Button {
                                vm.showProfileExportSheet = true
                            } label: {
                                Label("Apple .mobileconfig & WireGuard Export", systemImage: "doc.badge.gearshape")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 8)
                            }
                            .buttonStyle(.bordered)
                        }
                        .padding(.horizontal)
                    }
                    .padding(.vertical, 14)
                }
                .navigationTitle("Devices")
                .navigationBarTitleDisplayMode(.inline)
            }
            .tabItem {
                Label("Devices", systemImage: "laptopcomputer.and.iphone")
            }
            .tag(2)
        }
        .sheet(isPresented: $showServerPickerSheet) {
            NavigationStack {
                List(vm.servers) { srv in
                    Button {
                        Task { await vm.selectServer(srv.code) }
                        showServerPickerSheet = false
                    } label: {
                        HStack(spacing: 12) {
                            Text(isoBadge(for: srv.code))
                                .font(.caption.monospaced().weight(.bold))
                                .padding(.horizontal, 7)
                                .padding(.vertical, 4)
                                .background(Color(red: 0.02, green: 0.59, blue: 0.41).opacity(0.14))
                                .foregroundStyle(Color(red: 0.02, green: 0.59, blue: 0.41))
                                .clipShape(RoundedRectangle(cornerRadius: 6))
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(srv.country) — \(srv.city)")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundStyle(.primary)
                                Text(srv.code)
                                    .font(.caption2.monospaced())
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text("\(srv.probe_ms ?? 15) ms")
                                .font(.caption.monospaced().monospacedDigit().weight(.bold))
                                .foregroundStyle((srv.probe_ms ?? 15) < 40 ? Color(red: 0.02, green: 0.59, blue: 0.41) : .orange)
                            if vm.selectedServerCode == srv.code {
                                Image(systemName: vm.isConnected ? "checkmark.shield.fill" : "checkmark.circle.fill")
                                    .foregroundStyle(Color(red: 0.02, green: 0.59, blue: 0.41))
                            }
                        }
                    }
                }
                .navigationTitle("Select WireGuard POP")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Close") { showServerPickerSheet = false }
                    }
                }
            }
            .presentationDetents([.medium, .large])
        }
        .sheet(isPresented: $vm.showActivationSheet) {
            VStack(spacing: 16) {
                Text("Activate SWEEPR Pro")
                    .font(.title3.weight(.bold))
                Text("Enter your license key (up to 3 desktop or mobile devices) or scan a pairing QR code.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                TextField("License Key (SWEEPR-PRO-...)", text: $vm.licenseInputKey)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.characters)
                TextField("Purchase Email (optional)", text: $vm.licenseInputEmail)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                Button {
                    Task { await vm.activateLicenseKey() }
                } label: {
                    Text("Activate Key")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.02, green: 0.59, blue: 0.41))
            }
            .padding(24)
            .presentationDetents([.medium])
        }
        .sheet(isPresented: $vm.showProfileExportSheet) {
            VStack(alignment: .leading, spacing: 14) {
                Text("Install WireGuard Tunnel Profile")
                    .font(.title3.weight(.bold))
                Text("Peer \(vm.assignedTunnelIp) registered on \(vm.currentServer.city).")
                    .font(.caption.monospaced().monospacedDigit())
                    .foregroundStyle(.secondary)

                VStack(alignment: .leading, spacing: 6) {
                    Text("1. Download Apple On-Demand .mobileconfig profile below.")
                    Text("2. Open Settings > Profile Downloaded > Install.")
                    Text("3. Enable On-Demand WireGuard in Settings > VPN.")
                }
                .font(.footnote)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10))

                Button {
                    Task {
                        if let mobileConfigUrl = await vm.requestAppleMobileConfigUrl() {
                            openURL(mobileConfigUrl)
                        }
                    }
                } label: {
                    Text("Install Apple iOS .mobileconfig Profile")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.02, green: 0.59, blue: 0.41))

                Button {
                    UIPasteboard.general.string = vm.provisionedWgConf
                    vm.statusBanner = "Copied \(vm.selectedServerCode) WireGuard config to clipboard"
                    vm.showProfileExportSheet = false
                } label: {
                    Text("Copy WireGuard .conf to Clipboard")
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
            }
            .padding(24)
            .presentationDetents([.medium])
        }
        .sheet(isPresented: $vm.showQrScannerSheet) {
            VStack(spacing: 14) {
                Text("Link via QR Code")
                    .font(.title3.weight(.bold))
                ZStack {
                    QrCameraScannerView(isTorchOn: isTorchOn) { scanned in
                        Task { await vm.handleScannedQrPayload(scanned) }
                    }
                    .frame(height: 210)
                    .clipShape(RoundedRectangle(cornerRadius: 14))

                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(style: StrokeStyle(lineWidth: 2, dash: [14, 18]))
                        .foregroundStyle(Color(red: 0.06, green: 0.72, blue: 0.51))
                        .frame(width: 144, height: 144)
                        .allowsHitTesting(false)
                }

                HStack(spacing: 10) {
                    Button {
                        isTorchOn.toggle()
                    } label: {
                        Label(isTorchOn ? "Torch On" : "Torch Off", systemImage: isTorchOn ? "flashlight.on.fill" : "flashlight.off.fill")
                            .font(.caption.weight(.bold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)

                    Button {
                        if let clip = UIPasteboard.general.string {
                            vm.manualQrTokenInput = clip
                        }
                    } label: {
                        Label("Paste Clipboard", systemImage: "doc.on.clipboard")
                            .font(.caption.weight(.bold))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                }

                TextField("Or paste pairing link or code", text: $vm.manualQrTokenInput)
                    .textFieldStyle(.roundedBorder)
                    .autocorrectionDisabled()
                    .textInputAutocapitalization(.never)
                Button {
                    Task {
                        await vm.handleScannedQrPayload(vm.manualQrTokenInput)
                    }
                } label: {
                    Text("Link Device Now")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                }
                .buttonStyle(.borderedProminent)
                .tint(Color(red: 0.02, green: 0.59, blue: 0.41))
            }
            .padding(24)
            .presentationDetents([.medium, .large])
        }
        .onOpenURL { url in
            Task {
                await vm.handleScannedQrPayload(url.absoluteString, requireConfirmForChallenge: true)
            }
        }
        .alert(
            "Approve Desktop Device Linking?",
            isPresented: Binding(
                get: { vm.pendingDesktopChallengeId != nil },
                set: { if !$0 { vm.pendingDesktopChallengeId = nil } }
            )
        ) {
            Button("Approve Device") {
                if let chId = vm.pendingDesktopChallengeId {
                    vm.pendingDesktopChallengeId = nil
                    Task { await vm.approveDesktopChallenge(chId) }
                }
            }
            Button("Cancel", role: .cancel) {
                vm.pendingDesktopChallengeId = nil
            }
        } message: {
            Text("Only approve this request if you just scanned a QR code displayed on your own computer. Approving links a desktop device to your active SWEEPR VPN subscription.")
        }
    }
}
