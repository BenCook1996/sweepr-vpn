import SwiftUI
import NetworkExtension
import AVFoundation
import UIKit

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
        self.licenseKey = UserDefaults.standard.string(forKey: "sweepr_license_key") ?? ""
        self.authToken = UserDefaults.standard.string(forKey: "sweepr_token") ?? ""
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
                let resolvedKey = decoded.licenseKey ?? decoded.license_key ?? cleanKey
                self.licenseKey = resolvedKey
                self.userEmail = decoded.email ?? cleanEmail
                self.authToken = decoded.token ?? ""
                self.deviceCount = decoded.devices_used ?? 1
                self.deviceLimit = decoded.max_devices ?? 3
                self.isPro = true
                UserDefaults.standard.set(self.userEmail, forKey: "sweepr_email")
                UserDefaults.standard.set(self.licenseKey, forKey: "sweepr_license_key")
                UserDefaults.standard.set(self.authToken, forKey: "sweepr_token")
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

    func appleMobileConfigUrl() -> URL? {
        var comps = URLComponents(string: "\(apiBase)/api/vpn/apple-mobileconfig")
        comps?.queryItems = [
            URLQueryItem(name: "key", value: licenseKey),
            URLQueryItem(name: "server_code", value: selectedServerCode)
        ]
        return comps?.url
    }

    /// Handles scanned QR URLs (`https://sweeprvpn.com/pair?t=ptk_...` or `?c=chk_...` or `sweeprvpn://pair?...`)
    func handleScannedQrPayload(_ raw: String) async {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if let url = URL(string: trimmed),
           let comps = URLComponents(url: url, resolvingAgainstBaseURL: false) {
            if let t = comps.queryItems?.first(where: { $0.name == "t" })?.value, t.hasPrefix("ptk_") {
                await redeemPairingToken(t)
                return
            }
            if let c = comps.queryItems?.first(where: { $0.name == "c" })?.value, c.hasPrefix("chk_") {
                await approveDesktopChallenge(c)
                return
            }
        }
        if trimmed.hasPrefix("ptk_") {
            await redeemPairingToken(trimmed)
        } else if trimmed.hasPrefix("chk_") {
            await approveDesktopChallenge(trimmed)
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
                UserDefaults.standard.set(self.licenseKey, forKey: "sweepr_license_key")
                UserDefaults.standard.set(self.authToken, forKey: "sweepr_token")
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

/// Real AVCaptureSession camera QR scanner for iOS
struct QrCameraScannerView: UIViewControllerRepresentable {
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

    func makeUIViewController(context: Context) -> UIViewController {
        let vc = UIViewController()
        let session = AVCaptureSession()
        if let device = AVCaptureDevice.default(for: .video),
           let input = try? AVCaptureDeviceInput(device: device),
           session.canAddInput(input) {
            session.addInput(input)
            let output = AVCaptureMetadataOutput()
            if session.canAddOutput(output) {
                session.addOutput(output)
                output.setMetadataObjectsDelegate(context.coordinator, queue: .main)
                output.metadataObjectTypes = [.qr]
            }
            let preview = AVCaptureVideoPreviewLayer(session: session)
            preview.frame = CGRect(x: 0, y: 0, width: 280, height: 200)
            preview.videoGravity = .resizeAspectFill
            vc.view.layer.addSublayer(preview)
            DispatchQueue.global(qos: .userInitiated).async {
                session.startRunning()
            }
        }
        return vc
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

struct SweeprVpnRootView: View {
    @StateObject private var vm = SweeprVpnViewModel()
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 18) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("SWEEPR VPN")
                                .font(.headline.weight(.heavy))
                            Text(vm.isPro ? "Pro Active • \(vm.deviceCount)/\(vm.deviceLimit) Devices" : "Free Wi-Fi Diagnostic Mode")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button {
                            vm.showQrScannerSheet = true
                        } label: {
                            Label("Scan QR", systemImage: "qrcode.viewfinder")
                                .font(.subheadline.weight(.bold))
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding(.horizontal)

                    VStack(spacing: 6) {
                        Text(vm.statusBanner)
                            .font(.footnote.weight(.medium))
                            .multilineTextAlignment(.center)
                        Text("Egress: \(vm.egressIpSummary)")
                            .font(.caption2.monospaced())
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal)

                    // Country / Server Location Picker
                    VStack(alignment: .leading, spacing: 8) {
                        Text("VPN Server Location")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.secondary)
                        ForEach(vm.servers) { srv in
                            Button {
                                Task { await vm.selectServer(srv.code) }
                            } label: {
                                HStack {
                                    Text(srv.flag)
                                        .font(.title3)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("\(srv.country) — \(srv.city)")
                                            .font(.subheadline.weight(.semibold))
                                            .foregroundStyle(.primary)
                                        Text("\(srv.code) • \(srv.probe_ms ?? 15) ms • 10 Gbps WireGuard")
                                            .font(.caption2)
                                            .foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    if vm.selectedServerCode == srv.code {
                                        Image(systemName: vm.isConnected ? "checkmark.shield.fill" : "checkmark.circle.fill")
                                            .foregroundStyle(vm.isConnected ? .green : .teal)
                                    }
                                }
                                .padding(12)
                                .background(
                                    RoundedRectangle(cornerRadius: 12)
                                        .fill(vm.selectedServerCode == srv.code ? Color.teal.opacity(0.12) : Color(.secondarySystemBackground))
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal)

                    Toggle("Local LAN Bypass (AirPlay & Printers)", isOn: $vm.lanBypass)
                        .font(.footnote.weight(.semibold))
                        .padding(.horizontal)
                        .onChange(of: vm.lanBypass) { newVal in
                            UserDefaults.standard.set(newVal, forKey: "sweepr_lan_bypass")
                            if vm.isConnected {
                                Task { await vm.connectTunnel() }
                            }
                        }

                    Button {
                        Task { await vm.toggleConnection() }
                    } label: {
                        Text(vm.isConnecting ? "Connecting WireGuard…" : (vm.isConnected ? "Protected via \(vm.currentServer.city) — Tap to Pause" : "Connect to \(vm.currentServer.city)"))
                            .font(.title3.weight(.bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(vm.isConnected ? .green : .teal)
                    .disabled(vm.isConnecting)
                    .padding(.horizontal)

                    HStack(spacing: 12) {
                        Button("Enter License Key") {
                            vm.showActivationSheet = true
                        }
                        .font(.footnote.weight(.semibold))

                        Button("Scan QR Code") {
                            vm.showQrScannerSheet = true
                        }
                        .font(.footnote.weight(.semibold))
                    }
                }
                .padding(.vertical, 16)
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
                }
                .padding(24)
                .presentationDetents([.medium])
            }
            .sheet(isPresented: $vm.showProfileExportSheet) {
                VStack(spacing: 16) {
                    Text("Install WireGuard Tunnel Profile")
                        .font(.title3.weight(.bold))
                    Text("Your encrypted peer (\(vm.assignedTunnelIp)) is registered on \(vm.currentServer.city). Install the native Apple VPN profile or copy the WireGuard configuration.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                    if let mobileConfigUrl = vm.appleMobileConfigUrl() {
                        Button {
                            openURL(mobileConfigUrl)
                        } label: {
                            Text("Install Apple iOS .mobileconfig Profile")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    Button {
                        UIPasteboard.general.string = vm.provisionedWgConf
                        vm.statusBanner = "Copied \(vm.selectedServerCode) WireGuard config to clipboard"
                        vm.showProfileExportSheet = false
                    } label: {
                        Text("Copy WireGuard .conf to Clipboard")
                            .font(.subheadline.weight(.semibold))
                    }
                }
                .padding(24)
                .presentationDetents([.medium])
            }
            .sheet(isPresented: $vm.showQrScannerSheet) {
                VStack(spacing: 14) {
                    Text("Link via QR Code")
                        .font(.title3.weight(.bold))
                    QrCameraScannerView { scanned in
                        Task { await vm.handleScannedQrPayload(scanned) }
                    }
                    .frame(width: 280, height: 180)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    TextField("Or paste pairing link / token (ptk_... or chk_...)", text: $vm.manualQrTokenInput)
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
                }
                .padding(24)
                .presentationDetents([.medium, .large])
            }
            .onOpenURL { url in
                Task {
                    await vm.handleScannedQrPayload(url.absoluteString)
                }
            }
        }
    }
}
