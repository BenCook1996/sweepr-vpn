import SwiftUI
import NetworkExtension
import AVFoundation

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
    @Published var isConnected: Bool = false
    @Published var isPro: Bool = false
    @Published var userEmail: String = ""
    @Published var licenseKey: String = ""
    @Published var authToken: String = ""
    @Published var selectedServerCode: String = "UK-LON-01"
    @Published var deviceCount: Int = 1
    @Published var deviceLimit: Int = 10
    @Published var statusBanner: String = "Ready to protect your iPhone"
    @Published var showActivationSheet: Bool = false
    @Published var showQrScannerSheet: Bool = false
    @Published var manualQrTokenInput: String = ""

    let apiBase = "https://sweeprvpn.com"

    var deviceId: String {
        if let saved = UserDefaults.standard.string(forKey: "sweepr_device_id"), !saved.isEmpty {
            return saved
        }
        let fresh = "ios_" + UUID().uuidString.replacingOccurrences(of: "-", with: "").prefix(16).lowercased()
        UserDefaults.standard.set(fresh, forKey: "sweepr_device_id")
        return fresh
    }

    init() {
        self.userEmail = UserDefaults.standard.string(forKey: "sweepr_email") ?? ""
        self.licenseKey = UserDefaults.standard.string(forKey: "sweepr_license_key") ?? ""
        self.authToken = UserDefaults.standard.string(forKey: "sweepr_token") ?? ""
        self.isPro = !self.licenseKey.isEmpty
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
                self.userEmail = decoded.email ?? self.userEmail
                self.authToken = decoded.token ?? ""
                self.deviceCount = decoded.device_count ?? 1
                self.deviceLimit = decoded.device_limit ?? 10
                self.isPro = true
                UserDefaults.standard.set(self.userEmail, forKey: "sweepr_email")
                UserDefaults.standard.set(self.licenseKey, forKey: "sweepr_license_key")
                UserDefaults.standard.set(self.authToken, forKey: "sweepr_token")
                self.showQrScannerSheet = false
                self.showActivationSheet = false
                self.statusBanner = "Linked via QR (\(self.deviceCount)/\(self.deviceLimit) devices active)"
            } else {
                self.statusBanner = decoded.message ?? "QR pairing token expired or device limit (10) reached."
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
                self.deviceLimit = decoded.device_limit ?? 10
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

struct SweeprVpnRootView: View {
    @StateObject private var vm = SweeprVpnViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 20) {
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

                Text(vm.statusBanner)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                Button {
                    if vm.isPro {
                        vm.isConnected.toggle()
                    } else {
                        vm.showActivationSheet = true
                    }
                } label: {
                    Text(vm.isConnected ? "Protected — Tap to Pause" : "Enable VPN Protection")
                        .font(.title3.weight(.bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                }
                .buttonStyle(.borderedProminent)
                .tint(vm.isConnected ? .green : .teal)
                .padding(.horizontal)

                Button("Scan QR from Portal or Desktop") {
                    vm.showQrScannerSheet = true
                }
                .font(.footnote.weight(.semibold))

                Spacer()
            }
            .padding(.top, 16)
            .sheet(isPresented: $vm.showQrScannerSheet) {
                VStack(spacing: 16) {
                    Image(systemName: "qrcode.viewfinder")
                        .font(.system(size: 44))
                        .foregroundStyle(.teal)
                    Text("Link via QR Code")
                        .font(.title3.weight(.bold))
                    Text("Point your iPhone camera at the QR code on your Customer Portal (/dashboard) to activate this phone, or scan an unactivated Desktop App's QR code to sign it in.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
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
                .presentationDetents([.medium])
            }
            .onOpenURL { url in
                Task {
                    await vm.handleScannedQrPayload(url.absoluteString)
                }
            }
        }
    }
}
