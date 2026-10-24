package com.sweepr.vpn.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.NetworkInterface
import java.net.URL
import java.net.URLDecoder
import java.util.Collections

data class AndroidVpnServer(
    val code: String,
    val country: String,
    val city: String,
    val flag: String,
    val pingMs: Int = 15,
    val online: Boolean = true
)

@Composable
fun SweeprVpnScreen(
    deviceId: String,
    initialEmail: String = "",
    initialLicenseKey: String = ""
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val prefs = remember { context.getSharedPreferences("sweepr_vpn_prefs", Context.MODE_PRIVATE) }

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
    var isConnected by remember { mutableStateOf(false) }
    var isConnecting by remember { mutableStateOf(false) }
    var lanBypass by remember { mutableStateOf(prefs.getBoolean("lan_bypass", false)) }
    var userEmail by remember {
        mutableStateOf(initialEmail.ifBlank { prefs.getString("user_email", "") ?: "" })
    }
    var licenseKey by remember {
        mutableStateOf(initialLicenseKey.ifBlank { prefs.getString("license_key", "") ?: "" })
    }
    var isPro by remember { mutableStateOf(licenseKey.isNotBlank()) }
    var deviceCount by remember { mutableStateOf(1) }
    var deviceLimit by remember { mutableStateOf(3) }
    var assignedAddress by remember { mutableStateOf("") }
    var provisionedConf by remember { mutableStateOf("") }
    var egressSummary by remember { mutableStateOf("Checking network…") }
    var statusBanner by remember { mutableStateOf("Ready to protect your Android device") }
    var showQrSheet by remember { mutableStateOf(false) }
    var showLicenseSheet by remember { mutableStateOf(false) }
    var qrPayloadInput by remember { mutableStateOf("") }
    var keyInput by remember { mutableStateOf(licenseKey) }
    var emailInput by remember { mutableStateOf(userEmail) }

    val currentServer = servers.firstOrNull { it.code == selectedServerCode } ?: servers.first()

    fun isSystemTunInterfaceActive(): Boolean {
        return try {
            val ifaces = Collections.list(NetworkInterface.getNetworkInterfaces())
            ifaces.any { iface ->
                iface.isUp && (iface.name.startsWith("tun") || iface.name.startsWith("wg") || iface.name.startsWith("sweepr"))
            }
        } catch (_: Exception) {
            false
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
                                val probe = obj.optInt("probe_ms", -1)
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

    LaunchedEffect(Unit) {
        isConnected = isSystemTunInterfaceActive()
        refreshServers()
        refreshEgressStatus()
    }

    suspend fun activateLicenseKey() {
        val cleanKey = keyInput.trim().uppercase()
        val cleanEmail = emailInput.trim().lowercase()
        if (cleanKey.length < 6) {
            statusBanner = "Please enter a valid SWEEPR license key or 6-digit code."
            return
        }
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/activate").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
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
                    userEmail = json.optString("email", cleanEmail)
                    deviceCount = json.optInt("devices_used", 1)
                    deviceLimit = json.optInt("max_devices", 3)
                    isPro = true
                    prefs.edit()
                        .putString("license_key", licenseKey)
                        .putString("user_email", userEmail)
                        .apply()
                    showLicenseSheet = false
                    statusBanner = "SWEEPR Pro unlocked ($deviceCount/$deviceLimit devices active)"
                } else {
                    statusBanner = json.optString("message", "Invalid or expired license key.")
                }
            } catch (_: Exception) {
                statusBanner = "Could not reach SWEEPR activation server."
            }
        }
    }

    suspend fun connectWireGuardTunnel(serverCode: String = selectedServerCode) {
        if (!isPro || licenseKey.isBlank()) {
            showLicenseSheet = true
            return
        }
        isConnecting = true
        statusBanner = "Provisioning WireGuard peer on ${currentServer.city}…"
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/wireguard-config").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 12000
                    readTimeout = 12000
                }
                val payload = JSONObject().apply {
                    put("server_code", serverCode)
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
                val confText = json.optString("config_text", "")
                if (!json.optBoolean("ok", false) || !confText.contains("[Interface]")) {
                    isConnecting = false
                    isConnected = false
                    statusBanner = json.optString("message", "Could not generate WireGuard configuration.")
                    return@withContext
                }

                provisionedConf = confText
                assignedAddress = json.optString("address", "10.64.0.2/32")
                val confFile = File(context.filesDir, "sweepr0.conf")
                confFile.writeText(confText, Charsets.UTF_8)

                withContext(Dispatchers.Main) {
                    val prepIntent = VpnService.prepare(context)
                    var startedNativeService = false
                    if (prepIntent == null) {
                        try {
                            val svcIntent = Intent().apply {
                                setClassName(context.packageName, "com.sweepr.vpn.SweeprWireGuardVpnService")
                                putExtra("wg_config", confText)
                                putExtra("server_code", serverCode)
                                putExtra("address", assignedAddress)
                            }
                            context.startService(svcIntent)
                            startedNativeService = true
                        } catch (_: Exception) {}
                    }

                    if (!startedNativeService) {
                        try {
                            val wgIntent = Intent("com.wireguard.android.action.SET_TUNNEL_UP").apply {
                                putExtra("tunnel", "sweepr0")
                            }
                            context.sendBroadcast(wgIntent)
                        } catch (_: Exception) {}
                    }

                    val activeNow = startedNativeService || isSystemTunInterfaceActive()
                    isConnected = activeNow
                    isConnecting = false
                    if (activeNow) {
                        statusBanner = "Protected via ${currentServer.city} ($assignedAddress)"
                    } else {
                        val cb = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                        cb?.setPrimaryClip(ClipData.newPlainText("SWEEPR WireGuard Config", confText))
                        statusBanner = "Peer active on ${currentServer.city} ($assignedAddress). Config saved & copied for WireGuard import."
                    }
                }
                refreshEgressStatus()
            } catch (_: Exception) {
                isConnecting = false
                isConnected = false
                statusBanner = "Could not reach SWEEPR WireGuard provisioning server."
            }
        }
    }

    suspend fun disconnectWireGuardTunnel() {
        try {
            val svcIntent = Intent().apply {
                setClassName(context.packageName, "com.sweepr.vpn.SweeprWireGuardVpnService")
                action = "STOP_VPN"
            }
            context.stopService(svcIntent)
        } catch (_: Exception) {}
        isConnected = false
        isConnecting = false
        statusBanner = "VPN protection paused"
        refreshEgressStatus()
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
                    put("device_id", deviceId)
                    put("device_name", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                    put("os", "Android")
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false)) {
                    licenseKey = json.optString("license_key", licenseKey)
                    keyInput = licenseKey
                    userEmail = json.optString("email", userEmail)
                    deviceCount = json.optInt("device_count", 1)
                    deviceLimit = json.optInt("device_limit", 3)
                    isPro = true
                    prefs.edit()
                        .putString("license_key", licenseKey)
                        .putString("user_email", userEmail)
                        .apply()
                    showQrSheet = false
                    statusBanner = "Linked via QR ($deviceCount/$deviceLimit devices active)"
                } else {
                    statusBanner = json.optString("message", "QR pairing token expired or 3-device limit reached.")
                }
            } catch (e: Exception) {
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
                    put("code", licenseKey)
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false)) {
                    deviceCount = json.optInt("device_count", deviceCount)
                    deviceLimit = json.optInt("device_limit", 3)
                    showQrSheet = false
                    statusBanner = "Desktop App unlocked! ($deviceCount/$deviceLimit devices active)"
                } else {
                    statusBanner = json.optString("message", "Could not approve Desktop QR challenge.")
                }
            } catch (e: Exception) {
                statusBanner = "Network error while approving Desktop QR code."
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
            else -> statusBanner = "Unrecognised QR code. Scan the QR code on your SWEEPR Portal or Desktop App."
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("SWEEPR VPN", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.ExtraBold)
                Text(
                    if (isPro) "Pro Active • $deviceCount/$deviceLimit Devices" else "Free Wi-Fi Diagnostic Mode",
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { showLicenseSheet = true }) {
                    Text(if (isPro) "Key" else "Activate")
                }
                Button(onClick = { showQrSheet = true }) {
                    Text("Scan QR")
                }
            }
        }

        Text(statusBanner, style = MaterialTheme.typography.bodySmall)
        Text("Egress: $egressSummary", style = MaterialTheme.typography.labelSmall)

        // 8-Country Server Picker
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Select VPN Country (8 Locations)", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                servers.forEach { srv ->
                    val selected = srv.code == selectedServerCode
                    Surface(
                        tonalElevation = if (selected) 4.dp else 0.dp,
                        shape = MaterialTheme.shapes.small,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                selectedServerCode = srv.code
                                prefs.edit().putString("selected_server", srv.code).apply()
                                if (isConnected || (isPro && licenseKey.isNotBlank())) {
                                    scope.launch { connectWireGuardTunnel(srv.code) }
                                }
                            }
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("${srv.flag} ${srv.country} — ${srv.city}", style = MaterialTheme.typography.bodyMedium, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal)
                            Text("${srv.pingMs} ms", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Local LAN Bypass (Chromecast & Printers)", style = MaterialTheme.typography.bodySmall)
            Switch(
                checked = lanBypass,
                onCheckedChange = { enabled ->
                    lanBypass = enabled
                    prefs.edit().putBoolean("lan_bypass", enabled).apply()
                    if (isConnected) {
                        scope.launch { connectWireGuardTunnel(selectedServerCode) }
                    }
                }
            )
        }

        Button(
            onClick = {
                scope.launch {
                    if (!isPro) {
                        showLicenseSheet = true
                    } else if (isConnected) {
                        disconnectWireGuardTunnel()
                    } else {
                        connectWireGuardTunnel(selectedServerCode)
                    }
                }
            },
            enabled = !isConnecting,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                when {
                    isConnecting -> "Connecting WireGuard to ${currentServer.city}…"
                    isConnected -> "Protected via ${currentServer.city} — Tap to Pause"
                    else -> "Connect to ${currentServer.city}"
                }
            )
        }

        if (showLicenseSheet) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Text("Activate SWEEPR Pro", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    OutlinedTextField(
                        value = keyInput,
                        onValueChange = { keyInput = it },
                        label = { Text("License Key (SWEEPR-PRO-...)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    OutlinedTextField(
                        value = emailInput,
                        onValueChange = { emailInput = it },
                        label = { Text("Purchase Email (optional)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { scope.launch { activateLicenseKey() } },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Activate Key")
                        }
                        TextButton(onClick = { showLicenseSheet = false }) {
                            Text("Close")
                        }
                    }
                }
            }
        }

        if (showQrSheet) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text("Link via QR Code", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(
                        "Scan the QR code on your Customer Portal (/dashboard) to activate this phone, or scan an unactivated Desktop App's QR code to sign it in instantly.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    OutlinedTextField(
                        value = qrPayloadInput,
                        onValueChange = { qrPayloadInput = it },
                        label = { Text("QR Link or Token (ptk_... / chk_...)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { scope.launch { handleScannedQrPayload(qrPayloadInput) } },
                            modifier = Modifier.weight(1f)
                        ) {
                            Text("Link Device")
                        }
                        TextButton(onClick = { showQrSheet = false }) {
                            Text("Close")
                        }
                    }
                }
            }
        }
    }
}
