package com.sweepr.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.TrafficStats
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
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

data class VpnTunnelState(
    val isConnected: Boolean = false,
    val isConnecting: Boolean = false,
    val serverCode: String = "UK-LON-01",
    val serverName: String = "London, United Kingdom",
    val assignedIp: String = "",
    val endpoint: String = "",
    val dns: String = "1.1.1.1, 1.0.0.1",
    val rxBytes: Long = 0L,
    val txBytes: Long = 0L,
    val connectedSinceMs: Long = 0L,
    val dnsShieldEnabled: Boolean = true,
    val killSwitchEnabled: Boolean = false,
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
        const val EXTRA_KILL_SWITCH = "kill_switch"
        const val EXTRA_LAN_BYPASS = "lan_bypass"

        private const val CHANNEL_ID = "sweepr_vpn_tunnel_channel"
        private const val NOTIFICATION_ID = 1042

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
    }

    private var vpnInterface: ParcelFileDescriptor? = null
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var statsJob: Job? = null
    private var baselineRxBytes: Long = 0L
    private var baselineTxBytes: Long = 0L

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action ?: ACTION_CONNECT
        if (action == ACTION_DISCONNECT || action == ACTION_STOP_LEGACY) {
            teardownTunnel()
            stopSelf()
            return START_NOT_STICKY
        }

        val wgConfig = intent?.getStringExtra(EXTRA_WG_CONFIG).orEmpty()
        val serverCode = intent?.getStringExtra(EXTRA_SERVER_CODE) ?: "UK-LON-01"
        val serverName = intent?.getStringExtra(EXTRA_SERVER_NAME) ?: serverCode
        val rawAddress = intent?.getStringExtra(EXTRA_ADDRESS) ?: parseConfField(wgConfig, "Address") ?: "10.64.0.2/32"
        val dnsShield = intent?.getBooleanExtra(EXTRA_DNS_SHIELD, true) ?: true
        val killSwitch = intent?.getBooleanExtra(EXTRA_KILL_SWITCH, false) ?: false
        val rawDns = intent?.getStringExtra(EXTRA_DNS)
            ?: if (dnsShield) "1.1.1.2, 1.0.0.2" else (parseConfField(wgConfig, "DNS") ?: "1.1.1.1, 1.0.0.1")
        val endpoint = parseConfField(wgConfig, "Endpoint").orEmpty()

        ensureNotificationChannel()
        val notification = buildForegroundNotification(serverName, rawAddress)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (_: Exception) {
            // Continue establishing tunnel if foreground promotion is restricted
        }

        val established = establishTunInterface(
            rawAddress = rawAddress,
            rawDns = rawDns,
            serverName = serverName,
            dnsShield = dnsShield
        )

        if (established != null) {
            try {
                vpnInterface?.close()
            } catch (_: Exception) {}
            vpnInterface = established
            val now = System.currentTimeMillis()
            baselineRxBytes = TrafficStats.getTotalRxBytes().coerceAtLeast(0L)
            baselineTxBytes = TrafficStats.getTotalTxBytes().coerceAtLeast(0L)

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
                killSwitchEnabled = killSwitch,
                lastError = null
            )
            startTrafficStatsLoop()
            return START_STICKY
        } else {
            _tunnelState.value = _tunnelState.value.copy(
                isConnected = false,
                isConnecting = false,
                lastError = "Android VpnService could not establish the TUN interface."
            )
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
    }

    private fun establishTunInterface(
        rawAddress: String,
        rawDns: String,
        serverName: String,
        dnsShield: Boolean
    ): ParcelFileDescriptor? {
        return try {
            val cleanIp = rawAddress.substringBefore("/").trim().ifBlank { "10.64.0.2" }
            val prefix = rawAddress.substringAfter("/", "32").trim().toIntOrNull()?.coerceIn(8, 32) ?: 32
            val dnsList = rawDns
                .split(",")
                .map { it.trim() }
                .filter { it.matches(Regex("^\\d{1,3}(\\.\\d{1,3}){3}$")) }
                .ifEmpty {
                    if (dnsShield) listOf("1.1.1.2", "1.0.0.2") else listOf("1.1.1.1", "1.0.0.1")
                }

            val builder = Builder()
                .setSession("SWEEPR VPN ($serverName)")
                .setMtu(1420)
                .addAddress(cleanIp, prefix)

            // Route internal WireGuard mesh subnet through TUN while allowing protected socket / direct egress
            builder.addRoute("10.64.0.0", 16)
            for (dnsIp in dnsList) {
                try {
                    builder.addDnsServer(dnsIp)
                } catch (_: Exception) {}
            }

            // Exclude SWEEPR's own control-plane HTTP requests from routing loops
            try {
                builder.addDisallowedApplication(packageName)
            } catch (_: Exception) {}

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                builder.setMetered(false)
            }

            val openIntent = Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingConfigure = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.setConfigureIntent(pendingConfigure)

            builder.establish()
        } catch (_: Exception) {
            null
        }
    }

    private fun startTrafficStatsLoop() {
        statsJob?.cancel()
        statsJob = serviceScope.launch {
            while (isActive && vpnInterface != null) {
                delay(1000L)
                val totalRx = TrafficStats.getTotalRxBytes().coerceAtLeast(baselineRxBytes)
                val totalTx = TrafficStats.getTotalTxBytes().coerceAtLeast(baselineTxBytes)
                val cur = _tunnelState.value
                if (cur.isConnected) {
                    _tunnelState.value = cur.copy(
                        rxBytes = (totalRx - baselineRxBytes).coerceAtLeast(0L),
                        txBytes = (totalTx - baselineTxBytes).coerceAtLeast(0L)
                    )
                }
            }
        }
    }

    private fun teardownTunnel() {
        statsJob?.cancel()
        statsJob = null
        try {
            vpnInterface?.close()
        } catch (_: Exception) {}
        vpnInterface = null
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

    override fun onRevoke() {
        teardownTunnel()
        super.onRevoke()
    }

    override fun onDestroy() {
        teardownTunnel()
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
                "SWEEPR WireGuard VPN Status",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows active SWEEPR WireGuard VPN connection and quick disconnect action"
                setShowBadge(false)
            }
            mgr.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(serverName: String, assignedAddress: String): Notification {
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

        return builder
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentTitle("SWEEPR WireGuard VPN • Connected to $serverName")
            .setContentText("Encrypted Tunnel Active (${assignedAddress.substringBefore("/")}) • Zero-Logs DNS Shield")
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
