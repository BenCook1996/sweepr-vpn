import Foundation
import NetworkExtension
import os.log
#if canImport(WireGuardKit)
import WireGuardKit
#endif

/// Native Apple NEPacketTunnelProvider supporting WireGuardKit on both iOS/iPadOS and sandboxed macOS,
/// with DNS64/NAT64 hostname resolution via `getaddrinfo` for Apple App Review IPv6-only networks.
final class PacketTunnelProvider: NEPacketTunnelProvider {
    private let log = Logger(subsystem: "com.sweepr.vpn.tunnel", category: "PacketTunnel")
    #if canImport(WireGuardKit)
    private lazy var adapter: WireGuardAdapter = {
        WireGuardAdapter(with: self) { [weak self] _, message in
            self?.log.debug("\(message, privacy: .public)")
        }
    }()
    #endif

    override func startTunnel(options: [String: NSObject]?, completionHandler: @escaping (Error?) -> Void) {
        guard let proto = protocolConfiguration as? NETunnelProviderProtocol,
              let configMap = proto.providerConfiguration,
              let wgQuickConfig = configMap["wgQuickConfig"] as? String else {
            completionHandler(NSError(domain: "com.sweepr.vpn.tunnel", code: -1, userInfo: [NSLocalizedDescriptionKey: "Missing WireGuard configuration"]))
            return
        }

        let resolvedWgQuick = resolveEndpointForDns64IfNeeded(wgQuickConfig)

        #if canImport(WireGuardKit)
        let privateKeyB64 = (configMap["privateKey"] as? String) ?? extractWgField("PrivateKey", in: resolvedWgQuick) ?? ""
        let serverPubB64 = (configMap["serverPublicKey"] as? String) ?? extractWgField("PublicKey", in: resolvedWgQuick) ?? ""
        let addressStr = (configMap["address"] as? String) ?? extractWgField("Address", in: resolvedWgQuick) ?? ""
        let dnsCsv = (configMap["dns"] as? String) ?? extractWgField("DNS", in: resolvedWgQuick) ?? "10.64.0.1, 1.1.1.1"
        let allowedIpsCsv = (configMap["allowedIps"] as? String) ?? extractWgField("AllowedIPs", in: resolvedWgQuick) ?? "0.0.0.0/0"
        let endpointStr = extractWgField("Endpoint", in: resolvedWgQuick) ?? (configMap["endpoint"] as? String) ?? ""

        guard let privKey = PrivateKey(base64Key: privateKeyB64),
              let pubKey = PublicKey(base64Key: serverPubB64),
              let endpoint = Endpoint(from: endpointStr) else {
            completionHandler(NSError(domain: "com.sweepr.vpn.tunnel", code: -3, userInfo: [NSLocalizedDescriptionKey: "Invalid WireGuard keys or endpoint configuration."]))
            return
        }

        var iface = InterfaceConfiguration(privateKey: privKey)
        iface.addresses = addressStr.split(separator: ",").compactMap { IPAddressRange(from: $0.trimmingCharacters(in: .whitespaces)) }
        iface.dns = dnsCsv.split(separator: ",").compactMap { DNSServer(from: $0.trimmingCharacters(in: .whitespaces)) }
        iface.mtu = 1380

        guard !iface.addresses.isEmpty else {
            completionHandler(NSError(domain: "com.sweepr.vpn.tunnel", code: -4, userInfo: [NSLocalizedDescriptionKey: "Missing WireGuard interface address."]))
            return
        }

        var peer = PeerConfiguration(publicKey: pubKey)
        peer.endpoint = endpoint
        peer.allowedIPs = allowedIpsCsv.split(separator: ",").compactMap { IPAddressRange(from: $0.trimmingCharacters(in: .whitespaces)) }
        peer.persistentKeepAlive = 25

        let tunnelConfig = TunnelConfiguration(name: "SWEEPR VPN", interface: iface, peers: [peer])
        adapter.start(tunnelConfiguration: tunnelConfig) { error in
            if let error {
                self.log.error("WireGuardKit start failed: \(error.localizedDescription, privacy: .public)")
            }
            completionHandler(error)
        }
        #else
        log.error("WireGuardKit framework is not linked; refusing unencrypted tunnel stub.")
        completionHandler(NSError(domain: "com.sweepr.vpn.tunnel", code: -2, userInfo: [NSLocalizedDescriptionKey: "WireGuardKit is not linked in this build."]))
        #endif
    }

    private func extractWgField(_ fieldName: String, in wgQuick: String) -> String? {
        let target = fieldName.lowercased()
        for line in wgQuick.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            guard let eqIdx = trimmed.firstIndex(of: "=") else { continue }
            let key = trimmed[..<eqIdx].trimmingCharacters(in: .whitespaces).lowercased()
            if key == target {
                let val = trimmed[trimmed.index(after: eqIdx)...].trimmingCharacters(in: .whitespaces)
                if !val.isEmpty { return val }
            }
        }
        return nil
    }

    override func stopTunnel(with reason: NEProviderStopReason, completionHandler: @escaping () -> Void) {
        #if canImport(WireGuardKit)
        adapter.stop { _ in
            completionHandler()
        }
        #else
        completionHandler()
        #endif
    }

    /// Resolves Endpoint hostnames using POSIX `getaddrinfo` so Apple DNS64/NAT64 IPv6-only networks
    /// synthesize valid IPv6 addresses automatically even if upstream infrastructure only advertises IPv4 A records.
    private func resolveEndpointForDns64IfNeeded(_ wgQuick: String) -> String {
        var lines = wgQuick.components(separatedBy: .newlines)
        for i in lines.indices {
            let trimmed = lines[i].trimmingCharacters(in: .whitespaces)
            guard trimmed.lowercased().hasPrefix("endpoint") else { continue }
            guard let eqIdx = trimmed.firstIndex(of: "=") else { continue }
            let val = trimmed[trimmed.index(after: eqIdx)...].trimmingCharacters(in: .whitespaces)
            guard let colonIdx = val.lastIndex(of: ":") else { continue }
            let host = String(val[..<colonIdx]).trimmingCharacters(in: CharacterSet(charactersIn: "[]"))
            let port = String(val[val.index(after: colonIdx)...])
            if let resolvedIp = resolvePreferredSocketAddress(host: host, port: port) {
                let formatted = resolvedIp.contains(":") ? "[\(resolvedIp)]:\(port)" : "\(resolvedIp):\(port)"
                lines[i] = "Endpoint = \(formatted)"
            }
        }
        return lines.joined(separator: "\n")
    }

    private func resolvePreferredSocketAddress(host: String, port: String) -> String? {
        var hints = addrinfo()
        hints.ai_family = AF_UNSPEC
        hints.ai_socktype = SOCK_DGRAM
        hints.ai_protocol = IPPROTO_UDP
        var res: UnsafeMutablePointer<addrinfo>?
        guard getaddrinfo(host, port, &hints, &res) == 0, let first = res else { return nil }
        defer { freeaddrinfo(res) }

        var ptr: UnsafeMutablePointer<addrinfo>? = first
        var ipv4Fallback: String?
        while let current = ptr {
            let info = current.pointee
            var hostBuf = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            if let addr = info.ai_addr,
               getnameinfo(addr, socklen_t(info.ai_addrlen), &hostBuf, socklen_t(hostBuf.count), nil, 0, NI_NUMERICHOST) == 0 {
                let ip = String(cString: hostBuf)
                if info.ai_family == AF_INET6 {
                    return ip
                } else if ipv4Fallback == nil && info.ai_family == AF_INET {
                    ipv4Fallback = ip
                }
            }
            ptr = info.ai_next
        }
        return ipv4Fallback
    }
}
