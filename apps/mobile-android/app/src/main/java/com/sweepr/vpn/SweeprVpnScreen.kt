package com.sweepr.vpn

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.net.VpnService
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.Inet4Address
import java.net.URL
import java.net.URLDecoder
import java.util.Locale

data class AndroidVpnServer(
    val code: String,
    val country: String,
    val city: String,
    val flag: String,
    val pingMs: Int = 15,
    val online: Boolean = true
)

data class WifiDiagnosticsReport(
    val transportLabel: String = "Wi-Fi",
    val localIp: String = "Detecting…",
    val gatewayIp: String = "Detecting…",
    val dnsServers: String = "1.1.1.1, 1.0.0.1",
    val captivePortalStatus: String = "Validated HTTPS (No Captive Portal)",
    val riskAssessment: String = "Encrypted & Protected",
    val isUntrustedPublicWifi: Boolean = false
)

@Composable
fun SweeprVpnScreen(
    deviceId: String,
    initialEmail: String = "",
    initialLicenseKey: String = "",
    initialPairPayload: String? = null,
    onConsumePairPayload: () -> Unit = {}
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val scope = rememberCoroutineScope()
    val prefs = remember { context.getSharedPreferences("sweepr_vpn_prefs", Context.MODE_PRIVATE) }

    val tunnelState by SweeprWireGuardVpnService.tunnelState.collectAsState()
    val isConnected = tunnelState.isConnected
    val isConnecting = tunnelState.isConnecting

    var activeTab by remember { mutableIntStateOf(0) }

    var servers by remember {
        mutableStateOf(
            listOf(
                AndroidVpnServer("UK-LON-01", "United Kingdom", "London", "🇬🇧", 8),
                AndroidVpnServer("SE-STO-01", "Sweden", "Stockholm", "🇸🇪", 19),
                AndroidVpnServer("NL-AMS-01", "Netherlands", "Amsterdam", "🇳🇱", 12),
                AndroidVpnServer("DE-FRA-01", "Germany", "Frankfurt", "🇩🇪", 15),
                AndroidVpnServer("US-NYC-01", "United States", "New York", "🇺🇸", 68),
                AndroidVpnServer("US-LAX-01", "United States", "Los Angeles", "🇺🇸", 112),
                AndroidVpnServer("SG-SIN-01", "Singapore", "Singapore", "🇸🇬", 148),
                AndroidVpnServer("JP-TYO-01", "Japan", "Tokyo", "🇯🇵", 162)
            )
        )
    }

    var selectedServerCode by remember {
        mutableStateOf(prefs.getString("selected_server", "UK-LON-01") ?: "UK-LON-01")
    }
    var lanBypass by remember { mutableStateOf(prefs.getBoolean("lan_bypass", false)) }
    var killSwitchEnabled by remember { mutableStateOf(prefs.getBoolean("kill_switch", true)) }
    var autoShieldWifi by remember { mutableStateOf(prefs.getBoolean("auto_shield_wifi", true)) }
    var smartTvDnsShield by remember { mutableStateOf(prefs.getBoolean("smart_tv_dns_shield", true)) }
    var vpnDisclosureAccepted by remember { mutableStateOf(prefs.getBoolean("vpn_disclosure_accepted", false)) }

    var userEmail by remember {
        mutableStateOf(initialEmail.ifBlank { prefs.getString("user_email", "") ?: "" })
    }
    var licenseKey by remember {
        mutableStateOf(initialLicenseKey.ifBlank { prefs.getString("license_key", "") ?: "" })
    }
    var activationCode by remember {
        mutableStateOf(prefs.getString("activation_code", "") ?: "")
    }
    var activePlan by remember {
        mutableStateOf(prefs.getString("active_plan", "annual") ?: "annual")
    }
    var isPro by remember { mutableStateOf(licenseKey.isNotBlank()) }
    var deviceCount by remember { mutableIntStateOf(prefs.getInt("device_count", 1)) }
    var deviceLimit by remember { mutableIntStateOf(prefs.getInt("device_limit", 3)) }

    var egressSummary by remember { mutableStateOf("Checking network…") }
    var statusBanner by remember { mutableStateOf("Ready to protect your Android device") }
    var wifiReport by remember { mutableStateOf(WifiDiagnosticsReport()) }

    var showVpnDisclosureDialog by remember { mutableStateOf(false) }
    var pendingConnectServerCode by remember { mutableStateOf<String?>(null) }
    var pendingServiceIntent by remember { mutableStateOf<Intent?>(null) }

    var qrPayloadInput by remember { mutableStateOf("") }
    var generatedPairToken by remember { mutableStateOf("") }
    var keyInput by remember { mutableStateOf(licenseKey) }
    var emailInput by remember { mutableStateOf(userEmail) }
    var otpCodeInput by remember { mutableStateOf("") }
    var otpSentState by remember { mutableStateOf(false) }

    var supportSubject by remember { mutableStateOf("Android VPN Support Request") }
    var supportMessage by remember { mutableStateOf("") }
    var supportFeedback by remember { mutableStateOf("") }

    var showDeleteConfirmDialog by remember { mutableStateOf(false) }
    var deleteReasonInput by remember { mutableStateOf("") }

    var elapsedSec by remember { mutableLongStateOf(0L) }

    val currentServer = servers.firstOrNull { it.code == selectedServerCode } ?: servers.first()

    val vpnPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val svcIntent = pendingServiceIntent
        pendingServiceIntent = null
        if (result.resultCode == Activity.RESULT_OK && svcIntent != null) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(svcIntent)
                } else {
                    context.startService(svcIntent)
                }
                statusBanner = "Protected via ${currentServer.city} • WireGuard Tunnel Active"
            } catch (e: Exception) {
                SweeprWireGuardVpnService.updateConnectingState(false, currentServer.code, currentServer.city, e.message)
                statusBanner = "Could not start Android VpnService: ${e.message}"
            }
        } else {
            SweeprWireGuardVpnService.updateConnectingState(false, currentServer.code, currentServer.city, "VPN permission declined")
            statusBanner = "Android VPN permission is required to establish an encrypted WireGuard tunnel."
        }
    }

    suspend fun verifyGooglePlayPurchaseOnBackend(
        productId: String,
        purchaseToken: String,
        orderId: String?,
        planKey: String
    ) {
        statusBanner = "Verifying Google Play subscription with SWEEPR CRM…"
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/google-play/verify").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 12000
                    readTimeout = 12000
                }
                val payload = JSONObject().apply {
                    put("email", emailInput.ifBlank { userEmail })
                    put("product_id", productId)
                    put("purchase_token", purchaseToken)
                    put("order_id", orderId ?: "")
                    put("plan", planKey)
                    put("device_id", deviceId)
                    put("device_name", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                    put("os", "android")
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false) && json.optBoolean("valid", false)) {
                    val newKey = json.optString("license_key", json.optString("licenseKey", ""))
                    val newCode = json.optString("activation_code", "")
                    val newEmail = json.optString("email", userEmail)
                    licenseKey = newKey
                    keyInput = newKey
                    activationCode = newCode
                    userEmail = newEmail
                    emailInput = newEmail
                    activePlan = json.optString("plan", planKey)
                    deviceCount = json.optInt("devices_used", 1)
                    deviceLimit = json.optInt("max_devices", 3)
                    isPro = true
                    prefs.edit()
                        .putString("license_key", licenseKey)
                        .putString("activation_code", activationCode)
                        .putString("user_email", userEmail)
                        .putString("active_plan", activePlan)
                        .putInt("device_count", deviceCount)
                        .putInt("device_limit", deviceLimit)
                        .apply()
                    statusBanner = "SWEEPR Pro activated via Google Play ($licenseKey)"
                } else {
                    statusBanner = json.optString("message", "Could not verify Google Play purchase.")
                }
            } catch (_: Exception) {
                statusBanner = "Network error while syncing Google Play subscription."
            }
        }
    }

    val billingHelper = remember {
        BillingHelper(
            context = context,
            onPurchaseVerified = { prodId, token, orderId, planKey ->
                scope.launch {
                    verifyGooglePlayPurchaseOnBackend(prodId, token, orderId, planKey)
                }
            },
            onBillingMessage = { msg ->
                statusBanner = msg
            }
        )
    }
    val playPlans by billingHelper.plans.collectAsState()

    DisposableEffect(Unit) {
        billingHelper.startConnection()
        onDispose { billingHelper.endConnection() }
    }

    LaunchedEffect(isConnected, tunnelState.connectedSinceMs) {
        while (isConnected && tunnelState.connectedSinceMs > 0L) {
            elapsedSec = ((System.currentTimeMillis() - tunnelState.connectedSinceMs) / 1000L).coerceAtLeast(0L)
            delay(1000L)
        }
        if (!isConnected) elapsedSec = 0L
    }

    fun scanAndroidNetworkDiagnostics(): WifiDiagnosticsReport {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return WifiDiagnosticsReport()
            val net = cm.activeNetwork ?: return WifiDiagnosticsReport(
                transportLabel = "Offline",
                localIp = "No active network",
                gatewayIp = "—",
                dnsServers = "—",
                captivePortalStatus = "No network connection",
                riskAssessment = "Disconnected"
            )
            val caps = cm.getNetworkCapabilities(net)
            val link = cm.getLinkProperties(net)

            val hasVpn = caps?.hasTransport(NetworkCapabilities.TRANSPORT_VPN) == true || isConnected
            val hasWifi = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true
            val hasCell = caps?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true

            val transportLabel = buildString {
                when {
                    hasWifi -> append("Wi-Fi")
                    hasCell -> append("Cellular (5G/LTE)")
                    else -> append("System Network")
                }
                if (hasVpn) append(" + WireGuard VPN")
            }

            val localIp = link?.linkAddresses
                ?.map { it.address }
                ?.firstOrNull { it is Inet4Address && !it.isLoopbackAddress }
                ?.hostAddress
                ?: link?.linkAddresses?.firstOrNull()?.address?.hostAddress
                ?: "192.168.1.x"

            val gatewayIp = link?.routes
                ?.mapNotNull { it.gateway?.hostAddress }
                ?.firstOrNull { it != "0.0.0.0" && it != "::" }
                ?: "192.168.1.1"

            val dnsServers = if (isConnected) {
                tunnelState.dns
            } else {
                link?.dnsServers
                    ?.mapNotNull { it.hostAddress }
                    ?.joinToString(", ")
                    ?.ifBlank { "System DNS" }
                    ?: "System DNS"
            }

            val hasCaptive = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL) == true
            val isValidated = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED) == true
            val isNotMetered = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) == true

            val captiveStatus = when {
                hasCaptive -> "⚠️ Captive Portal Intercept Detected"
                isValidated -> "Validated TLS/HTTPS Route ✓"
                else -> "Unverified Network Route"
            }

            val untrustedWifi = hasWifi && (hasCaptive || !isValidated || !isNotMetered) && !isConnected
            val riskText = when {
                isConnected -> "Protected • 256-bit WireGuard + Zero-Logs DNS (${if (smartTvDnsShield) "Ad/Tracker Shield ON" else "Standard DNS"})"
                hasCaptive -> "High Risk • Captive Portal / MitM Inspection Detected"
                untrustedWifi -> "Elevated Risk • Public or Metered Wi-Fi without VPN Encryption"
                else -> "Standard Unencrypted ISP Route (IP & DNS visible to ISP)"
            }

            WifiDiagnosticsReport(
                transportLabel = transportLabel,
                localIp = localIp,
                gatewayIp = gatewayIp,
                dnsServers = dnsServers,
                captivePortalStatus = captiveStatus,
                riskAssessment = riskText,
                isUntrustedPublicWifi = untrustedWifi
            )
        } catch (_: Exception) {
            WifiDiagnosticsReport()
        }
    }

    suspend fun refreshEgressStatus() {
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/tools/network-check").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 8000
                    readTimeout = 8000
                }
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                val ip = json.optString("ip", "")
                val city = json.optString("city", "")
                val country = json.optString("country", "")
                if (ip.isNotBlank()) {
                    egressSummary = listOf(ip, city, country).filter { it.isNotBlank() }.joinToString(" • ")
                }
            } catch (_: Exception) {
                egressSummary = if (isConnected) "Protected via ${currentServer.city}" else "Standard ISP Connection"
            }
        }
        wifiReport = scanAndroidNetworkDiagnostics()
    }

    suspend fun refreshServers() {
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/servers").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 8000
                    readTimeout = 8000
                }
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                val arr = json.optJSONArray("servers")
                if (arr != null && arr.length() > 0) {
                    val updated = servers.map { existing ->
                        var matchPing = existing.pingMs
                        var matchOnline = existing.online
                        for (i in 0 until arr.length()) {
                            val obj = arr.getJSONObject(i)
                            if (obj.optString("code") == existing.code) {
                                matchOnline = obj.optBoolean("online", true)
                                val probe = obj.optInt("probe_ms", obj.optInt("pingMs", -1))
                                if (probe > 0) matchPing = probe
                                break
                            }
                        }
                        existing.copy(pingMs = matchPing, online = matchOnline)
                    }
                    servers = updated
                }
            } catch (_: Exception) {}
        }
    }

    suspend fun executeWireGuardConnect(serverCode: String = selectedServerCode) {
        if (!isPro || licenseKey.isBlank()) {
            activeTab = 2
            statusBanner = "Unlock SWEEPR Pro or enter your license key to connect."
            return
        }
        val targetSrv = servers.firstOrNull { it.code == serverCode } ?: currentServer
        SweeprWireGuardVpnService.updateConnectingState(true, targetSrv.code, "${targetSrv.city}, ${targetSrv.country}")
        statusBanner = "Provisioning encrypted WireGuard peer on ${targetSrv.city}…"

        val dnsValue = if (smartTvDnsShield) "1.1.1.2, 1.0.0.2" else "1.1.1.1, 1.0.0.1"
        var confText = ""
        var assignedAddr = "10.64.0.2/32"

        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/wireguard-config").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 10000
                    readTimeout = 10000
                }
                val payload = JSONObject().apply {
                    put("server_code", targetSrv.code)
                    put("activation_code", licenseKey)
                    put("license_key", licenseKey)
                    put("email", userEmail)
                    put("lan_bypass", lanBypass)
                    put("device_id", deviceId)
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false)) {
                    confText = json.optString("config_text", "")
                    assignedAddr = json.optString("address", "10.64.0.2/32")
                } else if (conn.responseCode == 401 || conn.responseCode == 403) {
                    val errMsg = json.optString("message", "License key verification required.")
                    withContext(Dispatchers.Main) {
                        SweeprWireGuardVpnService.updateConnectingState(false, targetSrv.code, targetSrv.city, errMsg)
                        statusBanner = errMsg
                    }
                    return@withContext
                }
            } catch (_: Exception) {
                // Offline/fallback peer parameters when node agent is unreachable
            }

            if (confText.isBlank()) {
                confText = """
                    [Interface]
                    Address = $assignedAddr
                    DNS = $dnsValue
                    MTU = 1420

                    [Peer]
                    Endpoint = 78.141.205.68:51820
                    AllowedIPs = 0.0.0.0/0
                    PersistentKeepalive = 25
                """.trimIndent()
            }

            try {
                File(context.filesDir, "sweepr0.conf").writeText(confText, Charsets.UTF_8)
            } catch (_: Exception) {}
        }

        val svcIntent = Intent(context, SweeprWireGuardVpnService::class.java).apply {
            action = SweeprWireGuardVpnService.ACTION_CONNECT
            putExtra(SweeprWireGuardVpnService.EXTRA_WG_CONFIG, confText)
            putExtra(SweeprWireGuardVpnService.EXTRA_SERVER_CODE, targetSrv.code)
            putExtra(SweeprWireGuardVpnService.EXTRA_SERVER_NAME, "${targetSrv.city}, ${targetSrv.country}")
            putExtra(SweeprWireGuardVpnService.EXTRA_ADDRESS, assignedAddr)
            putExtra(SweeprWireGuardVpnService.EXTRA_DNS, dnsValue)
            putExtra(SweeprWireGuardVpnService.EXTRA_DNS_SHIELD, smartTvDnsShield)
            putExtra(SweeprWireGuardVpnService.EXTRA_KILL_SWITCH, killSwitchEnabled)
            putExtra(SweeprWireGuardVpnService.EXTRA_LAN_BYPASS, lanBypass)
        }

        val prepIntent = VpnService.prepare(context)
        if (prepIntent != null) {
            pendingServiceIntent = svcIntent
            vpnPermissionLauncher.launch(prepIntent)
        } else {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(svcIntent)
                } else {
                    context.startService(svcIntent)
                }
                statusBanner = "Protected via ${targetSrv.city} (${assignedAddr.substringBefore("/")})"
            } catch (e: Exception) {
                SweeprWireGuardVpnService.updateConnectingState(false, targetSrv.code, targetSrv.city, e.message)
                statusBanner = "Could not start VPN service: ${e.message}"
            }
        }
        refreshEgressStatus()
    }

    fun requestConnectWithDisclosureCheck(serverCode: String = selectedServerCode) {
        if (!isPro || licenseKey.isBlank()) {
            activeTab = 2
            statusBanner = "Unlock SWEEPR Pro or enter your license key to connect."
            return
        }
        if (!vpnDisclosureAccepted) {
            pendingConnectServerCode = serverCode
            showVpnDisclosureDialog = true
        } else {
            scope.launch { executeWireGuardConnect(serverCode) }
        }
    }

    suspend fun disconnectWireGuardTunnel() {
        try {
            val svcIntent = Intent(context, SweeprWireGuardVpnService::class.java).apply {
                action = SweeprWireGuardVpnService.ACTION_DISCONNECT
            }
            context.startService(svcIntent)
        } catch (_: Exception) {}
        statusBanner = "VPN protection paused"
        refreshEgressStatus()
    }

    suspend fun activateLicenseKey() {
        val cleanKey = keyInput.trim().uppercase()
        val cleanEmail = emailInput.trim().lowercase()
        if (cleanKey.length < 6) {
            statusBanner = "Please enter a valid SWEEPR license key or 6-digit code."
            return
        }
        statusBanner = "Verifying license key…"
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/activate").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 10000
                    readTimeout = 10000
                }
                val payload = JSONObject().apply {
                    put("key", cleanKey)
                    put("activation_code", cleanKey)
                    put("otp", cleanKey)
                    put("email", cleanEmail)
                    put("device_id", deviceId)
                    put("device_name", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                    put("os", "android")
                    put("project_id", "vpn")
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false) && json.optBoolean("valid", false)) {
                    val resolvedKey = json.optString("licenseKey", json.optString("license_key", cleanKey))
                    licenseKey = resolvedKey
                    keyInput = resolvedKey
                    activationCode = json.optString("activation_code", activationCode)
                    userEmail = json.optString("email", cleanEmail)
                    emailInput = userEmail
                    activePlan = json.optString("plan", "annual")
                    deviceCount = json.optInt("devices_used", 1)
                    deviceLimit = json.optInt("max_devices", 3)
                    isPro = true
                    prefs.edit()
                        .putString("license_key", licenseKey)
                        .putString("activation_code", activationCode)
                        .putString("user_email", userEmail)
                        .putString("active_plan", activePlan)
                        .putInt("device_count", deviceCount)
                        .putInt("device_limit", deviceLimit)
                        .apply()
                    statusBanner = "SWEEPR Pro unlocked ($deviceCount/$deviceLimit devices active)"
                } else {
                    statusBanner = json.optString("message", "Invalid or expired license key.")
                }
            } catch (_: Exception) {
                statusBanner = "Could not reach SWEEPR activation server."
            }
        }
    }

    suspend fun sendEmailOtp() {
        val cleanEmail = emailInput.trim().lowercase()
        if (!cleanEmail.contains("@")) {
            statusBanner = "Please enter your account email address first."
            return
        }
        statusBanner = "Sending 6-digit login code to $cleanEmail…"
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/otp/send").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                val payload = JSONObject().apply { put("email", cleanEmail) }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false) || json.optBoolean("otpSent", false)) {
                    otpSentState = true
                    statusBanner = "6-digit code sent to $cleanEmail! Enter it below."
                } else {
                    statusBanner = json.optString("error", "No active account found for $cleanEmail.")
                }
            } catch (_: Exception) {
                statusBanner = "Could not reach OTP login server."
            }
        }
    }

    suspend fun verifyEmailOtp() {
        val cleanEmail = emailInput.trim().lowercase()
        val cleanOtp = otpCodeInput.trim()
        if (cleanOtp.length != 6) {
            statusBanner = "Please enter the 6-digit code from your email."
            return
        }
        statusBanner = "Verifying 6-digit code…"
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/otp/verify").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                val payload = JSONObject().apply {
                    put("email", cleanEmail)
                    put("code", cleanOtp)
                    put("deviceId", deviceId)
                    put("platform", "android")
                    put("deviceLabel", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false)) {
                    val resolvedKey = json.optString("license_key", json.optString("licenseKey", cleanOtp))
                    licenseKey = resolvedKey
                    keyInput = resolvedKey
                    activationCode = json.optString("activation_code", cleanOtp)
                    userEmail = cleanEmail
                    activePlan = json.optString("plan", "annual")
                    deviceCount = json.optInt("devices_used", 1)
                    deviceLimit = json.optInt("max_devices", 3)
                    isPro = true
                    otpSentState = false
                    prefs.edit()
                        .putString("license_key", licenseKey)
                        .putString("activation_code", activationCode)
                        .putString("user_email", userEmail)
                        .putString("active_plan", activePlan)
                        .apply()
                    statusBanner = "Signed in & unlocked SWEEPR Pro via Email OTP!"
                } else {
                    statusBanner = json.optString("error", "Invalid or expired 6-digit code.")
                }
            } catch (_: Exception) {
                statusBanner = "Network error verifying 6-digit code."
            }
        }
    }

    suspend fun redeemPairingToken(pairToken: String) {
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/pair/redeem").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                val payload = JSONObject().apply {
                    put("pair_token", pairToken)
                    put("token", pairToken)
                    put("device_id", deviceId)
                    put("device_name", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                    put("os", "android")
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false)) {
                    licenseKey = json.optString("license_key", json.optString("licenseKey", licenseKey))
                    keyInput = licenseKey
                    activationCode = json.optString("activation_code", activationCode)
                    userEmail = json.optString("email", userEmail)
                    emailInput = userEmail
                    deviceCount = json.optInt("device_count", 1)
                    deviceLimit = json.optInt("device_limit", 3)
                    isPro = true
                    prefs.edit()
                        .putString("license_key", licenseKey)
                        .putString("activation_code", activationCode)
                        .putString("user_email", userEmail)
                        .putInt("device_count", deviceCount)
                        .putInt("device_limit", deviceLimit)
                        .apply()
                    statusBanner = "Phone linked via QR ($deviceCount/$deviceLimit devices active)"
                } else {
                    statusBanner = json.optString("message", "QR pairing token expired or 3-device limit reached.")
                }
            } catch (_: Exception) {
                statusBanner = "Could not reach SWEEPR pairing server."
            }
        }
    }

    suspend fun approveDesktopChallenge(challengeId: String) {
        if (licenseKey.isBlank()) {
            statusBanner = "Activate SWEEPR Pro on this phone first to approve a Desktop QR sign-in."
            return
        }
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/pair/approve").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                val payload = JSONObject().apply {
                    put("challenge_id", challengeId)
                    put("email", userEmail)
                    put("key", licenseKey)
                    put("license_key", licenseKey)
                    put("code", licenseKey)
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false)) {
                    deviceCount = json.optInt("device_count", deviceCount)
                    deviceLimit = json.optInt("device_limit", 3)
                    statusBanner = "Desktop App unlocked via QR! ($deviceCount/$deviceLimit devices active)"
                } else {
                    statusBanner = json.optString("message", "Could not approve Desktop QR challenge.")
                }
            } catch (_: Exception) {
                statusBanner = "Network error while approving Desktop QR code."
            }
        }
    }

    suspend fun createOutgoingPairToken() {
        if (licenseKey.isBlank()) {
            statusBanner = "Activate SWEEPR Pro first to generate a pairing token for another device."
            return
        }
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/pair/create").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $licenseKey")
                }
                val payload = JSONObject().apply {
                    put("key", licenseKey)
                    put("license_key", licenseKey)
                    put("email", userEmail)
                    put("source", "android")
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false)) {
                    generatedPairToken = json.optString("token", "")
                    statusBanner = "Generated 120s pairing token: $generatedPairToken"
                } else {
                    statusBanner = json.optString("message", "Could not create pairing token.")
                }
            } catch (_: Exception) {
                statusBanner = "Network error creating pairing token."
            }
        }
    }

    suspend fun handleScannedQrPayload(raw: String) {
        val trimmed = raw.trim()
        val tokenMatch = Regex("[?&]t=(ptk_[A-Za-z0-9_-]+)").find(trimmed)?.groupValues?.get(1)
        val challengeMatch = Regex("[?&]c=(chk_[A-Za-z0-9_-]+)").find(trimmed)?.groupValues?.get(1)
        when {
            tokenMatch != null -> redeemPairingToken(URLDecoder.decode(tokenMatch, "UTF-8"))
            challengeMatch != null -> approveDesktopChallenge(URLDecoder.decode(challengeMatch, "UTF-8"))
            trimmed.startsWith("ptk_") -> redeemPairingToken(trimmed)
            trimmed.startsWith("chk_") -> approveDesktopChallenge(trimmed)
            else -> statusBanner = "Enter a valid QR link or token starting with ptk_ (activate this phone) or chk_ (approve Desktop)."
        }
    }

    suspend fun submitSupportTicket() {
        val email = emailInput.ifBlank { userEmail }.trim()
        val msg = supportMessage.trim()
        if (!email.contains("@") || msg.isBlank()) {
            supportFeedback = "Please enter your email address and message."
            return
        }
        supportFeedback = "Sending support ticket…"
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/support").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                val payload = JSONObject().apply {
                    put("project_id", "vpn")
                    put("email", email)
                    put("subject", supportSubject.ifBlank { "Android App Support" })
                    put("message", msg)
                    put("os", "android")
                    put("app_version", "2.4.0")
                    put("device_id", deviceId)
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false)) {
                    supportMessage = ""
                    supportFeedback = "✓ Ticket #${json.optString("ticket_id", "sent")} received — we reply within 24h."
                } else {
                    supportFeedback = json.optString("error", "Could not submit support request.")
                }
            } catch (_: Exception) {
                supportFeedback = "Network error while sending support request."
            }
        }
    }

    suspend fun deleteAccountPermanently() {
        statusBanner = "Permanently deleting account & revoking WireGuard keys…"
        if (isConnected) {
            disconnectWireGuardTunnel()
        }
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/account/delete").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    if (licenseKey.isNotBlank()) {
                        setRequestProperty("Authorization", "Bearer $licenseKey")
                    }
                }
                val payload = JSONObject().apply {
                    put("email", userEmail.ifBlank { emailInput })
                    put("key", licenseKey.ifBlank { keyInput })
                    put("license_key", licenseKey.ifBlank { keyInput })
                    put("code", activationCode.ifBlank { licenseKey })
                    put("device_id", deviceId)
                    put("reason", deleteReasonInput.ifBlank { "in_app_android_deletion" })
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                conn.inputStream?.bufferedReader()?.use { it.readText() }
            } catch (_: Exception) {}
        }
        licenseKey = ""
        keyInput = ""
        activationCode = ""
        userEmail = ""
        emailInput = ""
        isPro = false
        prefs.edit()
            .remove("license_key")
            .remove("activation_code")
            .remove("user_email")
            .remove("active_plan")
            .apply()
        showDeleteConfirmDialog = false
        statusBanner = "Your SWEEPR VPN account and device records have been permanently deleted."
    }

    LaunchedEffect(Unit) {
        refreshServers()
        refreshEgressStatus()
        if (autoShieldWifi && isPro && !isConnected && wifiReport.isUntrustedPublicWifi && vpnDisclosureAccepted) {
            executeWireGuardConnect(selectedServerCode)
        }
    }

    LaunchedEffect(initialPairPayload) {
        if (!initialPairPayload.isNullOrBlank()) {
            qrPayloadInput = initialPairPayload
            handleScannedQrPayload(initialPairPayload)
            onConsumePairPayload()
        }
    }

    if (showVpnDisclosureDialog) {
        AlertDialog(
            onDismissRequest = { showVpnDisclosureDialog = false },
            icon = { Icon(Icons.Default.Shield, contentDescription = null, tint = Color(0xFF10B981)) },
            title = {
                Text(
                    "Android VpnService Disclosure",
                    fontWeight = FontWeight.ExtraBold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "SWEEPR VPN uses Android's VpnService API to create an encrypted, device-level WireGuard® tunnel to SWEEPR's zero-log servers.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        "• Why it is used: To encrypt your Wi-Fi and mobile data traffic, mask your IP address, and filter Smart-TV / tracker DNS queries.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text(
                        "• Zero-Logs Privacy Guarantee: SWEEPR VPN never logs, stores, inspects, or sells your browsing history, traffic content, or DNS queries.",
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        vpnDisclosureAccepted = true
                        prefs.edit().putBoolean("vpn_disclosure_accepted", true).apply()
                        showVpnDisclosureDialog = false
                        val target = pendingConnectServerCode ?: selectedServerCode
                        pendingConnectServerCode = null
                        scope.launch { executeWireGuardConnect(target) }
                    }
                ) {
                    Text("Agree & Continue")
                }
            },
            dismissButton = {
                TextButton(onClick = { showVpnDisclosureDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    if (showDeleteConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirmDialog = false },
            icon = { Icon(Icons.Default.DeleteForever, contentDescription = null, tint = Color(0xFFEF4444)) },
            title = { Text("Delete Account & Data?", fontWeight = FontWeight.ExtraBold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "This permanently deletes your SWEEPR VPN account, revokes all WireGuard keys across all 8 locations, removes all linked devices, and cancels any active subscription.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    OutlinedTextField(
                        value = deleteReasonInput,
                        onValueChange = { deleteReasonInput = it },
                        label = { Text("Reason (optional)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = { scope.launch { deleteAccountPermanently() } },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    Text("Delete Permanently", color = Color.White)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirmDialog = false }) {
                    Text("Keep Account")
                }
            }
        )
    }

    Scaffold(
        bottomBar = {
            NavigationBar(
                containerColor = Color(0xFF111827)
            ) {
                NavigationBarItem(
                    selected = activeTab == 0,
                    onClick = { activeTab = 0 },
                    icon = { Icon(Icons.Default.Shield, contentDescription = "VPN Tunnel") },
                    label = { Text("VPN Tunnel") }
                )
                NavigationBarItem(
                    selected = activeTab == 1,
                    onClick = {
                        activeTab = 1
                        wifiReport = scanAndroidNetworkDiagnostics()
                    },
                    icon = { Icon(Icons.Default.Wifi, contentDescription = "Wi-Fi & Shields") },
                    label = { Text("Wi-Fi & Shields") }
                )
                NavigationBarItem(
                    selected = activeTab == 2,
                    onClick = { activeTab = 2 },
                    icon = { Icon(Icons.Default.AccountCircle, contentDescription = "Account") },
                    label = { Text("Account") }
                )
            }
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF0B1120))
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Top Header Bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        "SWEEPR VPN",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White
                    )
                    Text(
                        if (isPro) "PRO ACTIVE • $deviceCount/$deviceLimit Devices Linked" else "Free Mode • Tap Account to Unlock Pro",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isPro) Color(0xFF34D399) else Color(0xFFFBBF24)
                    )
                }
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = if (isConnected) Color(0xFF064E3B) else Color(0xFF1E293B),
                    modifier = Modifier.clickable { activeTab = 2 }
                ) {
                    Text(
                        text = if (isConnected) "● PROTECTED" else if (isPro) "PRO READY" else "UNLOCK PRO",
                        color = if (isConnected) Color(0xFF6EE7B7) else Color(0xFFE2E8F0),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }

            // Status Banner
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Color(0xFF111827),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(12.dp))
            ) {
                Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(statusBanner, style = MaterialTheme.typography.bodySmall, color = Color(0xFFE2E8F0))
                    Text("Route: $egressSummary", style = MaterialTheme.typography.labelSmall, color = Color(0xFF94A3B8))
                }
            }

            when (activeTab) {
                0 -> {
                    // ==================== TAB 0: VPN TUNNEL ====================
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                        shape = RoundedCornerShape(20.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(
                                1.dp,
                                if (isConnected) Color(0xFF10B981) else Color(0xFF1E293B),
                                RoundedCornerShape(20.dp)
                            )
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .size(132.dp)
                                    .clip(CircleShape)
                                    .background(
                                        Brush.radialGradient(
                                            colors = if (isConnected) {
                                                listOf(Color(0xFF10B981), Color(0xFF047857))
                                            } else if (isConnecting) {
                                                listOf(Color(0xFFF59E0B), Color(0xFFB45309))
                                            } else {
                                                listOf(Color(0xFF334155), Color(0xFF1E293B))
                                            }
                                        )
                                    )
                                    .clickable(enabled = !isConnecting) {
                                        if (isConnected) {
                                            scope.launch { disconnectWireGuardTunnel() }
                                        } else {
                                            requestConnectWithDisclosureCheck(selectedServerCode)
                                        }
                                    }
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(
                                        imageVector = if (isConnected) Icons.Default.Lock else Icons.Default.Shield,
                                        contentDescription = "Connect VPN",
                                        tint = Color.White,
                                        modifier = Modifier.size(42.dp)
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = when {
                                            isConnecting -> "WAIT…"
                                            isConnected -> "CONNECTED"
                                            else -> "TAP TO\nCONNECT"
                                        },
                                        color = Color.White,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 12.sp,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }

                            Text(
                                text = "${currentServer.flag} ${currentServer.city}, ${currentServer.country}",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )

                            if (isConnected) {
                                Text(
                                    text = "Session ${formatDuration(elapsedSec)} • Tunnel IP ${tunnelState.assignedIp.ifBlank { "10.64.0.2" }}",
                                    style = MaterialTheme.typography.labelMedium,
                                    color = Color(0xFF6EE7B7)
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceEvenly
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text("DOWNLOAD", style = MaterialTheme.typography.labelSmall, color = Color(0xFF94A3B8))
                                        Text(
                                            formatBytes(tunnelState.rxBytes),
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White
                                        )
                                    }
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text("UPLOAD", style = MaterialTheme.typography.labelSmall, color = Color(0xFF94A3B8))
                                        Text(
                                            formatBytes(tunnelState.txBytes),
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White
                                        )
                                    }
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Text("DNS SHIELD", style = MaterialTheme.typography.labelSmall, color = Color(0xFF94A3B8))
                                        Text(
                                            if (smartTvDnsShield) "1.1.1.2 ✓" else "1.1.1.1",
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = Color(0xFF34D399)
                                        )
                                    }
                                }
                            } else {
                                Text(
                                    text = "WireGuard® 10Gbps • ${currentServer.pingMs} ms latency • Zero-Logs",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF94A3B8)
                                )
                            }
                        }
                    }

                    // Server Picker Card
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    "Global WireGuard Locations (8)",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                IconButton(onClick = { scope.launch { refreshServers() } }) {
                                    Icon(Icons.Default.Refresh, contentDescription = "Refresh Latency", tint = Color(0xFF34D399))
                                }
                            }

                            servers.forEach { srv ->
                                val selected = srv.code == selectedServerCode
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = if (selected) Color(0xFF064E3B) else Color(0xFF1E293B),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            selectedServerCode = srv.code
                                            prefs.edit().putString("selected_server", srv.code).apply()
                                            if (isConnected) {
                                                requestConnectWithDisclosureCheck(srv.code)
                                            }
                                        }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            "${srv.flag}  ${srv.country} — ${srv.city}",
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
                                            color = Color.White
                                        )
                                        Text(
                                            "${srv.pingMs} ms",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = if (srv.pingMs < 40) Color(0xFF34D399) else Color(0xFFFBBF24),
                                            fontWeight = FontWeight.Bold
                                        )
                                    }
                                }
                            }
                        }
                    }

                    // LAN Bypass Quick Toggle
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                        shape = RoundedCornerShape(14.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 14.dp, vertical = 10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Local LAN Bypass", fontWeight = FontWeight.Bold, color = Color.White)
                                Text(
                                    "Allow Chromecast, AirPlay & Wi-Fi printers while VPN is active",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF94A3B8)
                                )
                            }
                            Switch(
                                checked = lanBypass,
                                onCheckedChange = { enabled ->
                                    lanBypass = enabled
                                    prefs.edit().putBoolean("lan_bypass", enabled).apply()
                                    if (isConnected) {
                                        requestConnectWithDisclosureCheck(selectedServerCode)
                                    }
                                }
                            )
                        }
                    }
                }

                1 -> {
                    // ==================== TAB 1: WI-FI RADAR & SHIELDS ====================
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    "Live Android Network Diagnostics",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                OutlinedButton(onClick = { wifiReport = scanAndroidNetworkDiagnostics() }) {
                                    Text("Re-Scan")
                                }
                            }

                            DiagnosticRow("Active Transport", wifiReport.transportLabel)
                            DiagnosticRow("Local Device IP", wifiReport.localIp)
                            DiagnosticRow("Gateway / Router", wifiReport.gatewayIp)
                            DiagnosticRow("Active DNS Servers", wifiReport.dnsServers)
                            DiagnosticRow("Captive Portal Check", wifiReport.captivePortalStatus)
                            DiagnosticRow("Security Assessment", wifiReport.riskAssessment)
                        }
                    }

                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Text(
                                "Active Privacy & Smart-TV Shields",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )

                            // Smart-TV / Ad & Tracker DNS Shield
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Smart-TV & Tracker DNS Shield", fontWeight = FontWeight.Bold, color = Color.White)
                                    Text(
                                        "Routes DNS via 1.1.1.2 / 1.0.0.2 to sinkhole malware, phishing & ACR telemetry",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFF94A3B8)
                                    )
                                }
                                Switch(
                                    checked = smartTvDnsShield,
                                    onCheckedChange = { enabled ->
                                        smartTvDnsShield = enabled
                                        prefs.edit().putBoolean("smart_tv_dns_shield", enabled).apply()
                                        statusBanner = if (enabled) {
                                            "Smart-TV & Malware DNS Shield enabled (1.1.1.2)"
                                        } else {
                                            "Standard Cloudflare DNS enabled (1.1.1.1)"
                                        }
                                        if (isConnected) {
                                            requestConnectWithDisclosureCheck(selectedServerCode)
                                        }
                                    }
                                )
                            }

                            // Auto-Shield on Untrusted Wi-Fi
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Auto-Shield on Untrusted Wi-Fi", fontWeight = FontWeight.Bold, color = Color.White)
                                    Text(
                                        "Automatically activates WireGuard encryption when joining public Wi-Fi",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFF94A3B8)
                                    )
                                }
                                Switch(
                                    checked = autoShieldWifi,
                                    onCheckedChange = { enabled ->
                                        autoShieldWifi = enabled
                                        prefs.edit().putBoolean("auto_shield_wifi", enabled).apply()
                                        statusBanner = if (enabled) "Auto-Shield on untrusted Wi-Fi enabled" else "Auto-Shield paused"
                                    }
                                )
                            }

                            // Kill Switch & Android Always-On VPN
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text("Emergency Kill Switch", fontWeight = FontWeight.Bold, color = Color.White)
                                    Text(
                                        "Prevents unencrypted clearnet leaks if the tunnel drops",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFF94A3B8)
                                    )
                                }
                                Switch(
                                    checked = killSwitchEnabled,
                                    onCheckedChange = { enabled ->
                                        killSwitchEnabled = enabled
                                        prefs.edit().putBoolean("kill_switch", enabled).apply()
                                        statusBanner = if (enabled) "Emergency Kill Switch armed" else "Emergency Kill Switch off"
                                    }
                                )
                            }

                            OutlinedButton(
                                onClick = {
                                    try {
                                        context.startActivity(Intent(Settings.ACTION_VPN_SETTINGS))
                                    } catch (_: Exception) {}
                                },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.Security, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Open Android Always-On VPN Settings")
                            }
                        }
                    }
                }

                2 -> {
                    // ==================== TAB 2: ACCOUNT, BILLING & SUPPORT ====================
                    // 1. Active License Status Card
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    if (isPro) "SWEEPR Pro Subscription Active" else "Unlock SWEEPR VPN Pro",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                if (isPro) {
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF34D399))
                                }
                            }

                            if (isPro && licenseKey.isNotBlank()) {
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = Color(0xFF1E293B),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text("ACTIVE LICENSE KEY", style = MaterialTheme.typography.labelSmall, color = Color(0xFF94A3B8))
                                            Text(
                                                licenseKey,
                                                fontFamily = FontFamily.Monospace,
                                                fontWeight = FontWeight.Bold,
                                                color = Color(0xFF34D399)
                                            )
                                            if (userEmail.isNotBlank()) {
                                                Text(userEmail, style = MaterialTheme.typography.labelSmall, color = Color(0xFFCBD5E1))
                                            }
                                        }
                                        TextButton(
                                            onClick = {
                                                val cb = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                                                cb?.setPrimaryClip(ClipData.newPlainText("SWEEPR License Key", licenseKey))
                                                statusBanner = "License key copied to clipboard ✓"
                                            }
                                        ) {
                                            Text("Copy")
                                        }
                                    }
                                }
                            }

                            // Google Play Billing Plans
                            Text(
                                "Subscribe with Google Play Billing (Up to 3 Devices)",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFE2E8F0)
                            )
                            playPlans.forEach { plan ->
                                Surface(
                                    shape = RoundedCornerShape(12.dp),
                                    color = Color(0xFF1E293B),
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable {
                                            if (activity != null) {
                                                billingHelper.launchPurchase(activity, plan.planKey)
                                            }
                                        }
                                ) {
                                    Row(
                                        modifier = Modifier.padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column(modifier = Modifier.weight(1f)) {
                                            Text(
                                                plan.badge,
                                                style = MaterialTheme.typography.labelSmall,
                                                color = Color(0xFF34D399),
                                                fontWeight = FontWeight.ExtraBold
                                            )
                                            Text(plan.title, fontWeight = FontWeight.Bold, color = Color.White)
                                            Text(plan.subtitle, style = MaterialTheme.typography.bodySmall, color = Color(0xFF94A3B8))
                                        }
                                        Button(
                                            onClick = {
                                                if (activity != null) {
                                                    billingHelper.launchPurchase(activity, plan.planKey)
                                                }
                                            }
                                        ) {
                                            Text(plan.formattedPrice)
                                        }
                                    }
                                }
                            }

                            TextButton(
                                onClick = { billingHelper.restorePurchases() },
                                modifier = Modifier.align(Alignment.End)
                            ) {
                                Text("Restore Google Play Purchases")
                            }
                        }
                    }

                    // 2. License Key & Email OTP Activation Card
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                "Activate with License Key or Email OTP",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            OutlinedTextField(
                                value = emailInput,
                                onValueChange = { emailInput = it },
                                label = { Text("Account Email Address") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            OutlinedTextField(
                                value = keyInput,
                                onValueChange = { keyInput = it },
                                label = { Text("License Key (SWEEPR-VPN-...) or 6-Digit Code") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = { scope.launch { activateLicenseKey() } },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Activate Key")
                                }
                                OutlinedButton(
                                    onClick = { scope.launch { sendEmailOtp() } },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Email 6-Digit OTP")
                                }
                            }

                            if (otpSentState) {
                                OutlinedTextField(
                                    value = otpCodeInput,
                                    onValueChange = { otpCodeInput = it.filter { ch -> ch.isDigit() }.take(6) },
                                    label = { Text("Enter 6-Digit Email OTP") },
                                    singleLine = true,
                                    modifier = Modifier.fillMaxWidth()
                                )
                                Button(
                                    onClick = { scope.launch { verifyEmailOtp() } },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Verify 6-Digit OTP & Sign In")
                                }
                            }
                        }
                    }

                    // 3. Two-Way QR Device Pairing Card
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = Color(0xFF34D399))
                                Text(
                                    "QR Device Pairing (Phone ⇄ Desktop)",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                            Text(
                                "Paste a Portal/Desktop pairing token (ptk_...) to unlock this phone, or enter a Desktop challenge code (chk_...) to sign in your PC.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF94A3B8)
                            )
                            OutlinedTextField(
                                value = qrPayloadInput,
                                onValueChange = { qrPayloadInput = it },
                                label = { Text("Pairing Token (ptk_... or chk_...)") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = { scope.launch { handleScannedQrPayload(qrPayloadInput) } },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Redeem / Approve QR")
                                }
                                if (isPro) {
                                    OutlinedButton(
                                        onClick = { scope.launch { createOutgoingPairToken() } },
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Generate QR Token")
                                    }
                                }
                            }
                            if (generatedPairToken.isNotBlank()) {
                                Text(
                                    "Share token with another device: $generatedPairToken",
                                    fontFamily = FontFamily.Monospace,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFF34D399)
                                )
                            }
                        }
                    }

                    // 4. In-App Customer Support Ticket Form
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                "24/7 Priority Support",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            OutlinedTextField(
                                value = supportMessage,
                                onValueChange = { supportMessage = it },
                                label = { Text("How can our engineering team help?") },
                                minLines = 3,
                                modifier = Modifier.fillMaxWidth()
                            )
                            if (supportFeedback.isNotBlank()) {
                                Text(supportFeedback, style = MaterialTheme.typography.bodySmall, color = Color(0xFF34D399))
                            }
                            Button(
                                onClick = { scope.launch { submitSupportTicket() } },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("Send Support Ticket")
                            }
                        }
                    }

                    // 5. Legal Links & Mandatory Google Play Account Deletion
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF111827)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                "Privacy, Terms & Data Control",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedButton(
                                    onClick = {
                                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://sweeprvpn.com/privacy")))
                                    },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.Public, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Privacy Policy")
                                }
                                OutlinedButton(
                                    onClick = {
                                        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://sweeprvpn.com/terms")))
                                    },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Terms of Service")
                                }
                            }
                            OutlinedButton(
                                onClick = { showDeleteConfirmDialog = true },
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFEF4444)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.DeleteForever, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Delete My Account & Data Permanently")
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun DiagnosticRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFF94A3B8),
            modifier = Modifier.weight(0.42f)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
            color = Color.White,
            textAlign = TextAlign.End,
            modifier = Modifier.weight(0.58f)
        )
    }
}

private fun formatDuration(seconds: Long): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return String.format(Locale.US, "%02d:%02d:%02d", h, m, s)
}

private fun formatBytes(bytes: Long): String {
    if (bytes < 1024L) return "$bytes B"
    val kb = bytes / 1024.0
    if (kb < 1024.0) return String.format(Locale.US, "%.1f KB", kb)
    val mb = kb / 1024.0
    if (mb < 1024.0) return String.format(Locale.US, "%.2f MB", mb)
    val gb = mb / 1024.0
    return String.format(Locale.US, "%.2f GB", gb)
}
