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
        do {
            let tunnelConfig = try TunnelConfiguration(fromWgQuickConfig: resolvedWgQuick, called: "SWEEPR VPN")
            adapter.start(tunnelConfiguration: tunnelConfig) { error in
                if let error {
                    self.log.error("WireGuardKit start failed: \(error.localizedDescription, privacy: .public)")
                }
                completionHandler(error)
            }
        } catch {
            completionHandler(error)
        }
        #else
        // Fallback network settings when compiling skeleton without WireGuardKit package linked yet
        let rawAddr = (configMap["address"] as? String) ?? "10.64.0.2/32"
        let clientIp = rawAddr.split(separator: "/").first.map(String.init) ?? "10.64.0.2"
        let dnsCsv = (configMap["dns"] as? String) ?? "1.1.1.1, 1.0.0.1"
        let dnsServers = dnsCsv.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }

        let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: (configMap["endpoint"] as? String)?.split(separator: ":").first.map(String.init) ?? "127.0.0.1")
        let ipv4 = NEIPv4Settings(addresses: [clientIp], subnetMasks: ["255.255.255.255"])
        ipv4.includedRoutes = [NEIPv4Route.default()]
        settings.ipv4Settings = ipv4

        let ipv6 = NEIPv6Settings(addresses: ["fd00::2"], networkPrefixLengths: [128])
        ipv6.includedRoutes = [NEIPv6Route.default()]
        settings.ipv6Settings = ipv6

        settings.dnsSettings = NEDNSSettings(servers: dnsServers)
        settings.mtu = NSNumber(value: 1280)
        setTunnelNetworkSettings(settings, completionHandler: completionHandler)
        #endif
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
