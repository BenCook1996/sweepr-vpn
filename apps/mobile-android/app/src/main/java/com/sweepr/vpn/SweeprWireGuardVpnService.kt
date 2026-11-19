package com.sweepr.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import com.wireguard.android.backend.GoBackend
import com.wireguard.android.backend.Tunnel
import com.wireguard.config.Config
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.BufferedReader
import java.io.File
import java.io.StringReader

data class VpnTunnelState(
    val isConnected: Boolean = false,
    val isConnecting: Boolean = false,
    val serverCode: String = "UK-LON-01",
    val serverName: String = "London, United Kingdom",
    val assignedIp: String = "",
    val endpoint: String = "",
    val dns: String = "10.64.0.1, 1.1.1.2",
    val rxBytes: Long = 0L,
    val txBytes: Long = 0L,
    val connectedSinceMs: Long = 0L,
    val dnsShieldEnabled: Boolean = true,
    val lanBypassEnabled: Boolean = false,
    val lastError: String? = null
)

class SweeprWireGuardVpnService : VpnService() {

    companion object {
        const val ACTION_CONNECT = "com.sweepr.vpn.ACTION_CONNECT"
        const val ACTION_DISCONNECT = "com.sweepr.vpn.ACTION_DISCONNECT"
        const val ACTION_STOP_LEGACY = "STOP_VPN"

        const val EXTRA_WG_CONFIG = "wg_config"
        const val EXTRA_SERVER_CODE = "server_code"
        const val EXTRA_SERVER_NAME = "server_name"
        const val EXTRA_ADDRESS = "address"
        const val EXTRA_DNS = "dns"
        const val EXTRA_DNS_SHIELD = "dns_shield"
        const val EXTRA_LAN_BYPASS = "lan_bypass"

        private const val CHANNEL_ID = "sweepr_vpn_tunnel_channel"
        private const val NOTIFICATION_ID = 1042
        private const val TUNNEL_NAME = "sweepr0"

        // Full IPv4 public space + SWEEPR WireGuard mesh 10.64.0.0/16 (excludes private LAN 192.168/16, 172.16/12, rest of 10/8)
        private const val LAN_BYPASS_ALLOWED_IPS =
            "1.0.0.0/8, 2.0.0.0/7, 4.0.0.0/6, 8.0.0.0/7, 10.64.0.0/16, 11.0.0.0/8, 12.0.0.0/6, 16.0.0.0/4, " +
            "32.0.0.0/3, 64.0.0.0/2, 128.0.0.0/3, 160.0.0.0/5, 168.0.0.0/6, 172.0.0.0/12, 172.32.0.0/11, " +
            "172.64.0.0/10, 172.128.0.0/9, 173.0.0.0/8, 174.0.0.0/7, 176.0.0.0/4, 192.0.0.0/9, 192.128.0.0/11, " +
            "192.160.0.0/13, 192.169.0.0/16, 192.170.0.0/15, 192.172.0.0/14, 192.176.0.0/12, 192.192.0.0/10, " +
            "193.0.0.0/8, 194.0.0.0/7, 196.0.0.0/6, 200.0.0.0/5, 208.0.0.0/4"

        private val _tunnelState = MutableStateFlow(VpnTunnelState())
        val tunnelState: StateFlow<VpnTunnelState> = _tunnelState.asStateFlow()

        fun updateConnectingState(connecting: Boolean, serverCode: String, serverName: String, error: String? = null) {
            _tunnelState.value = _tunnelState.value.copy(
                isConnecting = connecting,
                serverCode = serverCode,
                serverName = serverName,
                lastError = error
            )
        }

        fun reconnectFromSavedConfig(context: Context) {
            val appCtx = context.applicationContext
            val prefs = appCtx.getSharedPreferences("sweepr_vpn_prefs", Context.MODE_PRIVATE)
            val savedKey = prefs.getString("license_key", "").orEmpty()
            val confFile = File(appCtx.filesDir, "sweepr0.conf")
            val savedConf = try {
                if (confFile.exists()) confFile.readText(Charsets.UTF_8) else ""
            } catch (_: Exception) {
                ""
            }
            if (savedKey.isBlank() || !savedConf.contains("PrivateKey")) return
            val serverCode = prefs.getString("selected_server", "UK-LON-01") ?: "UK-LON-01"
            val serverName = prefs.getString("selected_server_label", serverCode) ?: serverCode
            val rawAddress = prefs.getString("wg_cached_addr_$serverCode", null) ?: "10.64.0.2/32"
            val dnsShield = prefs.getBoolean("smart_tv_dns_shield", true)
            val lanBypass = prefs.getBoolean("lan_bypass", false)
            val dnsValue = if (dnsShield) "10.64.0.1, 1.1.1.2" else "10.64.0.1, 1.1.1.1"
            val intent = Intent(appCtx, SweeprWireGuardVpnService::class.java).apply {
                action = ACTION_CONNECT
                putExtra(EXTRA_WG_CONFIG, savedConf)
                putExtra(EXTRA_SERVER_CODE, serverCode)
                putExtra(EXTRA_SERVER_NAME, serverName)
                putExtra(EXTRA_ADDRESS, rawAddress)
                putExtra(EXTRA_DNS, dnsValue)
                putExtra(EXTRA_DNS_SHIELD, dnsShield)
                putExtra(EXTRA_LAN_BYPASS, lanBypass)
            }
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    appCtx.startForegroundService(intent)
                } else {
                    appCtx.startService(intent)
                }
            } catch (_: Exception) {}
        }
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val tunnelMutex = Mutex()
    private var backend: GoBackend? = null
    private var statsJob: Job? = null

    private val sweeprTunnel = object : Tunnel {
        override fun getName(): String = TUNNEL_NAME
        override fun onStateChange(newState: Tunnel.State) {
            if (newState == Tunnel.State.DOWN && _tunnelState.value.isConnected && !_tunnelState.value.isConnecting) {
                _tunnelState.value = _tunnelState.value.copy(
                    isConnected = false,
                    isConnecting = false,
                    rxBytes = 0L,
                    txBytes = 0L,
                    connectedSinceMs = 0L
                )
            }
        }
    }

    private fun getOrCreateBackend(): GoBackend {
        return backend ?: GoBackend(applicationContext).also { go ->
            try {
                GoBackend.setAlwaysOnCallback {
                    reconnectFromSavedConfig(applicationContext)
                }
            } catch (_: Exception) {}
            backend = go
        }
    }

    private fun promoteForegroundNotification(serverName: String, rawAddress: String, isConnecting: Boolean) {
        ensureNotificationChannel()
        val notification = buildForegroundNotification(serverName, rawAddress, isConnecting)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (_: Exception) {
            // Continue establishing tunnel if foreground promotion is restricted
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            val prefs = getSharedPreferences("sweepr_vpn_prefs", Context.MODE_PRIVATE)
            val savedKey = prefs.getString("license_key", "").orEmpty()
            val confFile = File(filesDir, "sweepr0.conf")
            val savedConf = try {
                if (confFile.exists()) confFile.readText(Charsets.UTF_8) else ""
            } catch (_: Exception) {
                ""
            }
            if (savedKey.isBlank() || !savedConf.contains("PrivateKey")) {
                stopSelf()
                return START_NOT_STICKY
            }
            val serverCode = prefs.getString("selected_server", "UK-LON-01") ?: "UK-LON-01"
            val serverName = prefs.getString("selected_server_label", serverCode) ?: serverCode
            val rawAddress = prefs.getString("wg_cached_addr_$serverCode", null)
                ?: parseConfField(savedConf, "Address")
                ?: "10.64.0.2/32"
            val dnsShield = prefs.getBoolean("smart_tv_dns_shield", true)
            val lanBypass = prefs.getBoolean("lan_bypass", false)
            val rawDns = if (dnsShield) "10.64.0.1, 1.1.1.2" else "10.64.0.1, 1.1.1.1"
            val endpoint = parseConfField(savedConf, "Endpoint").orEmpty()

            promoteForegroundNotification(serverName, rawAddress, isConnecting = true)
            serviceScope.launch {
                establishWireGuardTunnel(
                    wgConfig = savedConf,
                    serverCode = serverCode,
                    serverName = serverName,
                    rawAddress = rawAddress,
                    rawDns = rawDns,
                    endpoint = endpoint,
                    dnsShield = dnsShield,
                    lanBypass = lanBypass
                )
            }
            return START_STICKY
        }

        val action = intent.action ?: ACTION_CONNECT
        if (action == ACTION_DISCONNECT || action == ACTION_STOP_LEGACY) {
            serviceScope.launch {
                teardownTunnel()
                stopSelf()
            }
            return START_NOT_STICKY
        }

        val wgConfig = intent.getStringExtra(EXTRA_WG_CONFIG).orEmpty()
        val serverCode = intent.getStringExtra(EXTRA_SERVER_CODE) ?: "UK-LON-01"
        val serverName = intent.getStringExtra(EXTRA_SERVER_NAME) ?: serverCode
        val rawAddress = intent.getStringExtra(EXTRA_ADDRESS) ?: parseConfField(wgConfig, "Address") ?: "10.64.0.2/32"
        val dnsShield = intent.getBooleanExtra(EXTRA_DNS_SHIELD, true)
        val lanBypass = intent.getBooleanExtra(EXTRA_LAN_BYPASS, false)
        val rawDns = intent.getStringExtra(EXTRA_DNS)
            ?.takeIf { it.contains("10.64.0.1") }
            ?: if (dnsShield) "10.64.0.1, 1.1.1.2" else "10.64.0.1, 1.1.1.1"
        val endpoint = parseConfField(wgConfig, "Endpoint").orEmpty()

        promoteForegroundNotification(serverName, rawAddress, isConnecting = true)

        serviceScope.launch {
            establishWireGuardTunnel(
                wgConfig = wgConfig,
                serverCode = serverCode,
                serverName = serverName,
                rawAddress = rawAddress,
                rawDns = rawDns,
                endpoint = endpoint,
                dnsShield = dnsShield,
                lanBypass = lanBypass
            )
        }
        return START_STICKY
    }

    private suspend fun establishWireGuardTunnel(
        wgConfig: String,
        serverCode: String,
        serverName: String,
        rawAddress: String,
        rawDns: String,
        endpoint: String,
        dnsShield: Boolean,
        lanBypass: Boolean
    ) {
        tunnelMutex.withLock {
            try {
                if (wgConfig.isBlank() || !wgConfig.contains("PrivateKey")) {
                    throw IllegalArgumentException("Missing WireGuard configuration.")
                }

                val normalizedConf = normalizeWireGuardConfig(
                    rawConf = wgConfig,
                    dnsCsv = rawDns,
                    lanBypass = lanBypass,
                    excludedApp = packageName
                )
                val parsedConfig = Config.parse(BufferedReader(StringReader(normalizedConf)))
                val wgBackend = getOrCreateBackend()

                // Ensure clean teardown before bringing up a new country/peer
                try {
                    if (wgBackend.getState(sweeprTunnel) == Tunnel.State.UP) {
                        wgBackend.setState(sweeprTunnel, Tunnel.State.DOWN, null)
                    }
                } catch (_: Exception) {}

                val resultingState = wgBackend.setState(sweeprTunnel, Tunnel.State.UP, parsedConfig)
                if (resultingState != Tunnel.State.UP) {
                    throw IllegalStateException("WireGuard tunnel did not reach UP state.")
                }

                val prevConnectedSince = _tunnelState.value.connectedSinceMs
                val now = if (_tunnelState.value.isConnected && prevConnectedSince > 0L) {
                    prevConnectedSince
                } else {
                    System.currentTimeMillis()
                }

                _tunnelState.value = VpnTunnelState(
                    isConnected = true,
                    isConnecting = false,
                    serverCode = serverCode,
                    serverName = serverName,
                    assignedIp = rawAddress.substringBefore("/"),
                    endpoint = endpoint,
                    dns = rawDns,
                    rxBytes = 0L,
                    txBytes = 0L,
                    connectedSinceMs = now,
                    dnsShieldEnabled = dnsShield,
                    lanBypassEnabled = lanBypass,
                    lastError = null
                )
                // Only show "Connected" notification once WireGuard GoBackend reaches UP state
                try {
                    val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                    mgr?.notify(NOTIFICATION_ID, buildForegroundNotification(serverName, rawAddress, isConnecting = false))
                } catch (_: Exception) {}

                startTrafficStatsLoop()
            } catch (e: Exception) {
                _tunnelState.value = _tunnelState.value.copy(
                    isConnected = false,
                    isConnecting = false,
                    lastError = "Unable to connect: ${e.message ?: "WireGuard tunnel error."}"
                )
                try {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } catch (_: Exception) {}
                stopSelf()
            }
        }
    }

    /**
     * Normalizes WireGuard config across all 8 SWEEPR locations:
     * - Enforces MTU = 1380 (matches upgraded server wg0 MTU + bidirectional MSS clamping for high-RTT paths)
     * - Pins IPv4-only in-tunnel DNS (10.64.0.1 primary + 1.1.1.2/1.1.1.1 fallback) to prevent CDN tromboning & IPv6 Happy Eyeballs stalls
     * - Includes 10.64.0.0/16 when LAN bypass is enabled and strips unreachable IPv6 ::/0 or 2000::/3 blackholes on IPv4-only nodes
     * - Excludes SWEEPR's own package so control-plane API calls never deadlock
     */
    private fun normalizeWireGuardConfig(
        rawConf: String,
        dnsCsv: String,
        lanBypass: Boolean,
        excludedApp: String
    ): String {
        val cleanDns = dnsCsv
            .split(",")
            .map { it.trim() }
            .filter { it.matches(Regex("^\\d{1,3}(\\.\\d{1,3}){3}$")) }
            .ifEmpty { listOf("10.64.0.1", "1.1.1.1") }
            .joinToString(", ")

        val allowedIps = if (lanBypass) LAN_BYPASS_ALLOWED_IPS else "0.0.0.0/0"
        val out = StringBuilder()
        var inInterface = false
        var sawDns = false
        var sawMtu = false
        var sawExcluded = false
        var sawAllowed = false
        var sawKeepalive = false

        fun flushInterfaceDefaults() {
            if (!sawDns) {
                out.append("DNS = ").append(cleanDns).append('\n')
                sawDns = true
            }
            if (!sawMtu) {
                out.append("MTU = 1380\n")
                sawMtu = true
            }
            if (!sawExcluded && excludedApp.isNotBlank()) {
                out.append("ExcludedApplications = ").append(excludedApp).append('\n')
                sawExcluded = true
            }
        }

        for (rawLine in rawConf.lines()) {
            val trimmed = rawLine.trim()
            if (trimmed.isEmpty()) {
                if (inInterface) flushInterfaceDefaults()
                out.append('\n')
                continue
            }
            if (trimmed.startsWith("[")) {
                if (inInterface) flushInterfaceDefaults()
                inInterface = trimmed.equals("[Interface]", ignoreCase = true)
                out.append(trimmed).append('\n')
                continue
            }
            val key = trimmed.substringBefore("=", "").trim().lowercase()
            when {
                inInterface && key == "dns" -> {
                    if (!sawDns) {
                        out.append("DNS = ").append(cleanDns).append('\n')
                        sawDns = true
                    }
                }
                inInterface && key == "mtu" -> {
                    if (!sawMtu) {
                        out.append("MTU = 1380\n")
                        sawMtu = true
                    }
                }
                inInterface && key == "excludedapplications" -> {
                    if (!sawExcluded) {
                        val existingVal = trimmed.substringAfter("=", "").trim()
                        val merged = (existingVal.split(",").map { it.trim() }.filter { it.isNotEmpty() } + excludedApp)
                            .distinct()
                            .joinToString(", ")
                        out.append("ExcludedApplications = ").append(merged).append('\n')
                        sawExcluded = true
                    }
                }
                !inInterface && key == "allowedips" -> {
                    if (!sawAllowed) {
                        out.append("AllowedIPs = ").append(allowedIps).append('\n')
                        sawAllowed = true
                    }
                }
                !inInterface && key == "persistentkeepalive" -> {
                    if (!sawKeepalive) {
                        out.append("PersistentKeepalive = 25\n")
                        sawKeepalive = true
                    }
                }
                else -> out.append(trimmed).append('\n')
            }
        }
        if (inInterface) flushInterfaceDefaults()
        if (!sawAllowed) out.append("AllowedIPs = ").append(allowedIps).append('\n')
        if (!sawKeepalive) out.append("PersistentKeepalive = 25\n")
        return out.toString()
    }

    private fun startTrafficStatsLoop() {
        statsJob?.cancel()
        statsJob = serviceScope.launch {
            while (isActive) {
                val cur = _tunnelState.value
                if (!cur.isConnected) break
                val wgBackend = backend ?: break
                try {
                    val state = wgBackend.getState(sweeprTunnel)
                    if (state != Tunnel.State.UP) {
                        _tunnelState.value = cur.copy(
                            isConnected = false,
                            isConnecting = false,
                            rxBytes = 0L,
                            txBytes = 0L,
                            connectedSinceMs = 0L
                        )
                        break
                    }
                    val stats = wgBackend.getStatistics(sweeprTunnel)
                    val tunRx = stats.totalRx().coerceAtLeast(0L)
                    val tunTx = stats.totalTx().coerceAtLeast(0L)
                    val changed = tunRx != cur.rxBytes || tunTx != cur.txBytes
                    if (changed) {
                        _tunnelState.value = cur.copy(
                            rxBytes = tunRx,
                            txBytes = tunTx
                        )
                    }
                    delay(if (changed) 1000L else 2500L)
                } catch (_: Exception) {
                    delay(2500L)
                }
            }
        }
    }

    private suspend fun teardownTunnel() {
        tunnelMutex.withLock {
            statsJob?.cancel()
            statsJob = null
            try {
                backend?.setState(sweeprTunnel, Tunnel.State.DOWN, null)
            } catch (_: Exception) {}
            _tunnelState.value = _tunnelState.value.copy(
                isConnected = false,
                isConnecting = false,
                rxBytes = 0L,
                txBytes = 0L,
                connectedSinceMs = 0L
            )
            try {
                stopForeground(STOP_FOREGROUND_REMOVE)
            } catch (_: Exception) {}
        }
    }

    override fun onRevoke() {
        serviceScope.launch { teardownTunnel() }
        super.onRevoke()
    }

    override fun onDestroy() {
        statsJob?.cancel()
        try {
            backend?.setState(sweeprTunnel, Tunnel.State.DOWN, null)
        } catch (_: Exception) {}
        serviceScope.cancel()
        super.onDestroy()
    }

    private fun parseConfField(conf: String, key: String): String? {
        for (line in conf.lines()) {
            val trimmed = line.trim()
            if (trimmed.startsWith(key, ignoreCase = true)) {
                val afterEq = trimmed.substringAfter("=", "").trim()
                if (afterEq.isNotEmpty()) return afterEq
            }
        }
        return null
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SWEEPR VPN Status",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows active SWEEPR VPN tunnel connection and quick disconnect action"
                setShowBadge(false)
            }
            mgr.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(
        serverName: String,
        assignedAddress: String,
        isConnecting: Boolean
    ): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val openPending = PendingIntent.getActivity(
            this,
            1,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val disconnectIntent = Intent(this, SweeprWireGuardVpnService::class.java).apply {
            action = ACTION_DISCONNECT
        }
        val disconnectPending = PendingIntent.getService(
            this,
            2,
            disconnectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        val title = if (isConnecting) {
            "SWEEPR VPN • Connecting to $serverName…"
        } else {
            "SWEEPR VPN • Connected to $serverName"
        }
        val text = if (isConnecting) {
            "Establishing encrypted WireGuard® tunnel…"
        } else {
            "Protected (${assignedAddress.substringBefore("/")}) • Private DNS 10.64.0.1"
        }

        return builder
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(openPending)
            .setOngoing(true)
            .addAction(
                Notification.Action.Builder(
                    android.R.drawable.ic_media_pause,
                    "Disconnect",
                    disconnectPending
                ).build()
            )
            .build()
    }
}
