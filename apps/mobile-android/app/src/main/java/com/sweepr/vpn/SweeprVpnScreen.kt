package com.sweepr.vpn

import android.Manifest
import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.net.VpnService
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.DeleteForever
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.LaptopMac
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Wifi
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import com.google.android.play.core.review.ReviewManagerFactory
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
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
    val online: Boolean = true,
    val publicKey: String = ""
)

data class NetworkDiagnosticsReport(
    val transportLabel: String = "Checking…",
    val localIp: String = "Checking…",
    val gatewayIp: String = "Checking…",
    val dnsServers: String = "Checking…",
    val captivePortalStatus: String = "Checking…",
    val securitySummary: String = "Ready",
    val isCellular: Boolean = false
)

private val FALLBACK_SERVERS = listOf(
    AndroidVpnServer("UK-LON-01", "United Kingdom", "London", "🇬🇧", true),
    AndroidVpnServer("SE-STO-01", "Sweden", "Stockholm", "🇸🇪", true),
    AndroidVpnServer("NL-AMS-01", "Netherlands", "Amsterdam", "🇳🇱", true),
    AndroidVpnServer("DE-FRA-01", "Germany", "Frankfurt", "🇩🇪", true),
    AndroidVpnServer("US-NYC-01", "United States", "New York", "🇺🇸", true),
    AndroidVpnServer("US-LAX-01", "United States", "Los Angeles", "🇺🇸", true),
    AndroidVpnServer("SG-SIN-01", "Singapore", "Singapore", "🇸🇬", true),
    AndroidVpnServer("JP-TYO-01", "Japan", "Tokyo", "🇯🇵", true)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SweeprVpnScreen(
    deviceId: String,
    initialEmail: String = "",
    initialLicenseKey: String = "",
    initialPairPayload: String? = null,
    onConsumePairPayload: () -> Unit = {},
    resumeTick: Int = 0,
    onForceUpdateDetected: () -> Unit = {}
) {
    val context = LocalContext.current
    val activity = context as? Activity
    val scope = rememberCoroutineScope()
    val prefs = remember { context.getSharedPreferences("sweepr_vpn_prefs", Context.MODE_PRIVATE) }
    val snackbarHostState = remember { SnackbarHostState() }

    fun showSnackbar(message: String) {
        scope.launch(Dispatchers.Main) {
            snackbarHostState.currentSnackbarData?.dismiss()
            snackbarHostState.showSnackbar(
                message = message,
                duration = SnackbarDuration.Short
            )
        }
    }

    val tunnelState by SweeprWireGuardVpnService.tunnelState.collectAsState()
    val isConnected = tunnelState.isConnected
    val isConnecting = tunnelState.isConnecting

    var activeTab by remember { mutableIntStateOf(0) }
    var servers by remember { mutableStateOf(FALLBACK_SERVERS) }
    var selectedServerCode by remember {
        mutableStateOf(prefs.getString("selected_server", "UK-LON-01") ?: "UK-LON-01")
    }

    LaunchedEffect(tunnelState.isConnected, tunnelState.serverCode) {
        if (tunnelState.isConnected && tunnelState.serverCode.isNotBlank()) {
            selectedServerCode = tunnelState.serverCode
        }
    }

    var lanBypass by remember { mutableStateOf(prefs.getBoolean("lan_bypass", false)) }
    var smartTvDnsShield by remember { mutableStateOf(prefs.getBoolean("smart_tv_dns_shield", true)) }
    var vpnDisclosureAccepted by remember { mutableStateOf(prefs.getBoolean("vpn_disclosure_accepted", false)) }
    var notificationPrompted by remember { mutableStateOf(prefs.getBoolean("notification_prompted", false)) }

    var userEmail by remember {
        mutableStateOf(initialEmail.ifBlank { prefs.getString("user_email", "") ?: "" })
    }
    var licenseKey by remember {
        mutableStateOf(prefs.getString("license_key", "") ?: "")
    }
    var activationCode by remember {
        mutableStateOf(prefs.getString("activation_code", "") ?: "")
    }
    var activePlan by remember {
        mutableStateOf(prefs.getString("active_plan", "annual") ?: "annual")
    }
    var googlePlayPurchaseToken by remember {
        mutableStateOf(prefs.getString("google_play_purchase_token", "") ?: "")
    }
    var isPro by remember { mutableStateOf(licenseKey.isNotBlank()) }
    var deviceCount by remember { mutableIntStateOf(prefs.getInt("device_count", 1)) }
    var deviceLimit by remember { mutableIntStateOf(prefs.getInt("device_limit", 3)) }

    var egressSummary by remember { mutableStateOf("Checking connection…") }
    var networkReport by remember { mutableStateOf(NetworkDiagnosticsReport()) }
    var latencyCheckResult by remember { mutableStateOf("Not measured yet") }

    var showVpnDisclosureDialog by remember { mutableStateOf(false) }
    var showUpgradeSheet by remember { mutableStateOf(false) }
    var showServerSheet by remember { mutableStateOf(false) }
    var showConnectionDetails by remember { mutableStateOf(false) }
    var showAccountSwitchSection by remember { mutableStateOf(false) }
    var showSignOutDialog by remember { mutableStateOf(false) }
    var showDeleteConfirmDialog by remember { mutableStateOf(false) }

    var pendingConnectServerCode by remember { mutableStateOf<String?>(null) }
    var pendingPostNotifServerCode by remember { mutableStateOf<String?>(null) }
    var pendingServiceIntent by remember { mutableStateOf<Intent?>(null) }

    var qrPayloadInput by remember { mutableStateOf("") }
    var pendingChallengeToConfirm by remember { mutableStateOf<String?>(null) }
    var generatedPairToken by remember { mutableStateOf("") }
    var keyInput by remember { mutableStateOf(initialLicenseKey.ifBlank { licenseKey }) }
    var emailInput by remember { mutableStateOf(userEmail) }
    var otpCodeInput by remember { mutableStateOf("") }
    var otpSentState by remember { mutableStateOf(false) }

    var supportMessage by remember { mutableStateOf("") }
    var deleteReasonInput by remember { mutableStateOf("") }

    var isActivatingKey by remember { mutableStateOf(false) }
    var isSendingOtp by remember { mutableStateOf(false) }
    var isVerifyingOtp by remember { mutableStateOf(false) }
    var isPairingBusy by remember { mutableStateOf(false) }
    var isSubmittingSupport by remember { mutableStateOf(false) }
    var isDeletingAccount by remember { mutableStateOf(false) }
    var isRefreshingServers by remember { mutableStateOf(false) }
    var isRunningLatencyCheck by remember { mutableStateOf(false) }

    var updateAvailable by remember { mutableStateOf(false) }
    var forceUpdateRequired by remember { mutableStateOf(false) }
    var latestAppVersion by remember { mutableStateOf(BuildConfig.VERSION_NAME) }
    var updateReleaseNotes by remember {
        mutableStateOf("Security enhancements, faster WireGuard throughput, and stability improvements.")
    }

    var elapsedSec by remember { mutableLongStateOf(0L) }
    var prevConnectedState by remember { mutableStateOf(false) }
    var reviewTriggeredForCurrentSession by remember { mutableStateOf(false) }

    val currentServer = servers.firstOrNull { it.code == selectedServerCode } ?: servers.first()

    lateinit var billingHelperRef: BillingHelper

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
            } catch (e: Exception) {
                SweeprWireGuardVpnService.updateConnectingState(false, currentServer.code, currentServer.city, e.message)
                showSnackbar("Could not start VPN service: ${e.message ?: "Unknown error"}")
            }
        } else {
            SweeprWireGuardVpnService.updateConnectingState(false, currentServer.code, currentServer.city, "VPN permission is required to connect.")
            showSnackbar("Android VPN permission is required to establish an encrypted connection.")
        }
    }

    suspend fun verifyGooglePlayPurchaseOnBackend(
        productId: String,
        purchaseToken: String,
        orderId: String?,
        planKey: String,
        isAcknowledged: Boolean
    ) {
        withContext(Dispatchers.Main) {
            showSnackbar("Verifying Google Play subscription…")
        }
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/google-play/verify").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 12000
                    readTimeout = 12000
                }
                val resolvedOrderId = orderId?.takeIf { it.isNotBlank() }
                    ?: "GPA.PLAY-${purchaseToken.filter { it.isLetterOrDigit() }.take(16)}"
                val payload = JSONObject().apply {
                    put("email", emailInput.ifBlank { userEmail })
                    put("product_id", productId)
                    put("purchase_token", purchaseToken)
                    put("order_id", resolvedOrderId)
                    put("plan", planKey)
                    put("device_id", deviceId)
                    put("device_name", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                    put("os", "android")
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (code in 200..299 && json.optBoolean("ok", false) && json.optBoolean("valid", false)) {
                    val newKey = json.optString("license_key", json.optString("licenseKey", ""))
                    val newCode = json.optString("activation_code", "")
                    val newEmail = json.optString("email", userEmail)
                    val resolvedPlan = json.optString("plan", planKey)
                    val used = json.optInt("devices_used", 1)
                    val maxDev = json.optInt("max_devices", 3)

                    if (!isAcknowledged) {
                        billingHelperRef.acknowledgePurchase(purchaseToken) { }
                    }

                    withContext(Dispatchers.Main) {
                        licenseKey = newKey
                        keyInput = newKey
                        activationCode = newCode
                        userEmail = newEmail
                        emailInput = newEmail
                        activePlan = resolvedPlan
                        googlePlayPurchaseToken = purchaseToken
                        deviceCount = used
                        deviceLimit = maxDev
                        isPro = true
                        showUpgradeSheet = false
                        prefs.edit()
                            .putString("license_key", newKey)
                            .putString("activation_code", newCode)
                            .putString("user_email", newEmail)
                            .putString("active_plan", resolvedPlan)
                            .putString("google_play_purchase_token", purchaseToken)
                            .putInt("device_count", used)
                            .putInt("device_limit", maxDev)
                            .apply()
                        showSnackbar("SWEEPR Pro activated via Google Play")
                    }
                } else {
                    val msg = json.optString("message", "Could not verify Google Play purchase.")
                    withContext(Dispatchers.Main) { showSnackbar(msg) }
                }
            } catch (_: Exception) {
                withContext(Dispatchers.Main) {
                    showSnackbar("Network error while verifying Google Play subscription.")
                }
            }
        }
    }

    val billingHelper = remember {
        BillingHelper(
            context = context,
            onPurchaseVerified = { prodId, token, orderId, planKey, isAcknowledged ->
                scope.launch {
                    verifyGooglePlayPurchaseOnBackend(prodId, token, orderId, planKey, isAcknowledged)
                }
            },
            onBillingMessage = { msg ->
                showSnackbar(msg)
            }
        )
    }
    billingHelperRef = billingHelper

    val playPlans by billingHelper.plans.collectAsState()
    val isLoadingPlans by billingHelper.isLoadingPlans.collectAsState()
    val billingUnavailable by billingHelper.billingUnavailable.collectAsState()

    DisposableEffect(Unit) {
        billingHelper.startConnection()
        onDispose { billingHelper.endConnection() }
    }

    LaunchedEffect(isConnected, tunnelState.connectedSinceMs) {
        reviewTriggeredForCurrentSession = false
        while (isConnected && tunnelState.connectedSinceMs > 0L) {
            elapsedSec = ((System.currentTimeMillis() - tunnelState.connectedSinceMs) / 1000L).coerceAtLeast(0L)
            if (elapsedSec >= 60L && !reviewTriggeredForCurrentSession && isPro && activity != null) {
                reviewTriggeredForCurrentSession = true
                val sessions = prefs.getInt("successful_vpn_sessions", 0) + 1
                prefs.edit().putInt("successful_vpn_sessions", sessions).apply()
                if (sessions >= 3 && !prefs.getBoolean("review_prompt_shown", false)) {
                    prefs.edit().putBoolean("review_prompt_shown", true).apply()
                    try {
                        val mgr = ReviewManagerFactory.create(context)
                        mgr.requestReviewFlow().addOnSuccessListener { reviewInfo ->
                            try {
                                mgr.launchReviewFlow(activity, reviewInfo)
                            } catch (_: Exception) {}
                        }
                    } catch (_: Exception) {}
                }
            }
            delay(1000L)
        }
        if (!isConnected) elapsedSec = 0L
    }

    suspend fun scanAndroidNetworkDiagnostics(): NetworkDiagnosticsReport = withContext(Dispatchers.IO) {
        try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
                ?: return@withContext NetworkDiagnosticsReport(
                    transportLabel = "Unavailable",
                    localIp = "Unavailable",
                    gatewayIp = "Unavailable",
                    dnsServers = "Unavailable",
                    captivePortalStatus = "Unavailable",
                    securitySummary = "System connectivity service unavailable"
                )
            val net = cm.activeNetwork ?: return@withContext NetworkDiagnosticsReport(
                transportLabel = "Offline",
                localIp = "No active network",
                gatewayIp = "Unavailable",
                dnsServers = "Unavailable",
                captivePortalStatus = "Offline",
                securitySummary = "No internet connection detected"
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
                    else -> append("Network Connection")
                }
                if (hasVpn) append(" + WireGuard VPN")
            }

            val localIp = link?.linkAddresses
                ?.map { it.address }
                ?.firstOrNull { it is Inet4Address && !it.isLoopbackAddress }
                ?.hostAddress
                ?: link?.linkAddresses?.firstOrNull()?.address?.hostAddress
                ?: "Unavailable"

            val rawGateway = link?.routes
                ?.mapNotNull { it.gateway?.hostAddress }
                ?.firstOrNull { it != "0.0.0.0" && it != "::" }
            val gatewayIp = when {
                !rawGateway.isNullOrBlank() -> rawGateway
                hasCell && !hasWifi -> "Carrier NAT"
                else -> "Unavailable"
            }

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
                hasCaptive -> "Captive Portal Login Required"
                isValidated -> "Validated HTTPS Route"
                else -> "Unverified Network Route"
            }

            val riskText = when {
                isConnected -> "Protected • WireGuard® + Private In-Tunnel DNS"
                hasCaptive -> "Sign in to Wi-Fi portal first before connecting VPN"
                hasWifi && !isNotMetered -> "Public or Metered Wi-Fi without VPN protection"
                else -> "Standard ISP Route (IP & DNS visible to carrier/ISP)"
            }

            NetworkDiagnosticsReport(
                transportLabel = transportLabel,
                localIp = localIp,
                gatewayIp = gatewayIp,
                dnsServers = dnsServers,
                captivePortalStatus = captiveStatus,
                securitySummary = riskText,
                isCellular = hasCell && !hasWifi
            )
        } catch (_: Exception) {
            NetworkDiagnosticsReport(
                transportLabel = "Unavailable",
                localIp = "Unavailable",
                gatewayIp = "Unavailable",
                dnsServers = "Unavailable",
                captivePortalStatus = "Unavailable",
                securitySummary = "Unable to inspect active network"
            )
        }
    }

    suspend fun refreshEgressStatus(measureLatency: Boolean = false) {
        if (measureLatency) {
            withContext(Dispatchers.Main) { isRunningLatencyCheck = true }
        }
        var newEgress = if (isConnected) {
            "Protected via ${currentServer.city}, ${currentServer.country}"
        } else {
            egressSummary
        }
        var newLatencyText = latencyCheckResult

        withContext(Dispatchers.IO) {
            try {
                val t0 = System.nanoTime()
                val conn = (URL("https://sweeprvpn.com/api/tools/network-check").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 8000
                    readTimeout = 8000
                }
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val rttMs = ((System.nanoTime() - t0) / 1_000_000L).coerceAtLeast(1L)
                val json = JSONObject(body)
                val ip = json.optString("ip", "")
                val city = json.optString("city", "")
                val country = json.optString("country", "")
                if (ip.isNotBlank() && !isConnected) {
                    newEgress = listOf(ip, city, country).filter { it.isNotBlank() }.joinToString(" • ")
                }
                newLatencyText = "$rttMs ms RTT to SWEEPR API (${body.length} bytes verified)"
            } catch (_: Exception) {
                if (!isConnected) {
                    newEgress = "Standard Internet Connection"
                }
                if (measureLatency) {
                    newLatencyText = "Check failed — unable to reach server"
                }
            }
        }

        val diag = scanAndroidNetworkDiagnostics()
        withContext(Dispatchers.Main) {
            egressSummary = newEgress
            latencyCheckResult = newLatencyText
            networkReport = diag
            isRunningLatencyCheck = false
        }
    }

    suspend fun refreshServers(showFeedback: Boolean = false) {
        withContext(Dispatchers.Main) { isRefreshingServers = true }
        var fetchedList: List<AndroidVpnServer>? = null
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
                    val parsed = mutableListOf<AndroidVpnServer>()
                    for (i in 0 until arr.length()) {
                        val obj = arr.getJSONObject(i)
                        val code = obj.optString("code", "").trim()
                        if (code.isNotEmpty()) {
                            parsed.add(
                                AndroidVpnServer(
                                    code = code,
                                    country = obj.optString("country", code),
                                    city = obj.optString("city", code),
                                    flag = obj.optString("flag", "🌐"),
                                    online = obj.optBoolean("online", true),
                                    publicKey = obj.optString("public_key", "")
                                )
                            )
                        }
                    }
                    if (parsed.isNotEmpty()) {
                        fetchedList = parsed
                    }
                }
            } catch (_: Exception) {}
        }
        withContext(Dispatchers.Main) {
            isRefreshingServers = false
            val list = fetchedList
            if (list != null) {
                servers = list
                if (list.none { it.code == selectedServerCode }) {
                    val firstOnline = list.firstOrNull { it.online } ?: list.first()
                    selectedServerCode = firstOnline.code
                    prefs.edit()
                        .putString("selected_server", firstOnline.code)
                        .putString("selected_server_label", "${firstOnline.city}, ${firstOnline.country}")
                        .apply()
                }
                if (showFeedback) {
                    val onlineCount = list.count { it.online }
                    showSnackbar("$onlineCount of ${list.size} locations online")
                }
            } else if (showFeedback) {
                showSnackbar("Could not refresh server list. Check your connection.")
            }
        }
    }

    fun parseConfPublicKey(conf: String): String {
        var inPeer = false
        for (line in conf.lines()) {
            val t = line.trim()
            if (t.startsWith("[")) {
                inPeer = t.equals("[Peer]", ignoreCase = true)
                continue
            }
            if (inPeer && t.startsWith("PublicKey", ignoreCase = true)) {
                return t.substringAfter("=", "").trim()
            }
        }
        return ""
    }

    suspend fun executeWireGuardConnect(serverCode: String = selectedServerCode, forceReconnect: Boolean = false) {
        if (SweeprWireGuardVpnService.tunnelState.value.isConnecting && !forceReconnect) {
            return
        }
        if (!isPro || licenseKey.isBlank()) {
            showUpgradeSheet = true
            return
        }
        val prevServerCode = tunnelState.serverCode.ifBlank { selectedServerCode }
        val prevServerName = tunnelState.serverName.ifBlank { "${currentServer.city}, ${currentServer.country}" }
        val targetSrv = servers.firstOrNull { it.code == serverCode } ?: currentServer
        if (!targetSrv.online) {
            showSnackbar("${targetSrv.city} is temporarily offline. Please choose an online location.")
            return
        }

        SweeprWireGuardVpnService.updateConnectingState(
            connecting = true,
            serverCode = targetSrv.code,
            serverName = "${targetSrv.city}, ${targetSrv.country}"
        )

        val dnsValue = if (smartTvDnsShield) "10.64.0.1, 1.1.1.2" else "10.64.0.1, 1.1.1.1"
        var confText = ""
        var assignedAddr = "10.64.0.2/32"
        var authErrMsg: String? = null

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
                    put("acr_shield", smartTvDnsShield)
                    put("dns_shield", smartTvDnsShield)
                    put("device_id", deviceId)
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (json.optBoolean("ok", false)) {
                    confText = json.optString("config_text", "")
                    assignedAddr = json.optString("address", "10.64.0.2/32")
                    if (confText.contains("PrivateKey")) {
                        val pubKey = parseConfPublicKey(confText).ifBlank { targetSrv.publicKey }
                        prefs.edit()
                            .putString("wg_cached_config_${targetSrv.code}", confText)
                            .putString("wg_cached_addr_${targetSrv.code}", assignedAddr)
                            .putString("wg_cached_pubkey_${targetSrv.code}", pubKey)
                            .apply()
                    }
                } else if (code == 401 || code == 403) {
                    authErrMsg = json.optString("message", "License verification required.")
                }
            } catch (_: Exception) {
                // Network issue; try validated cache
            }

            if (authErrMsg == null && confText.isBlank()) {
                val cachedConf = prefs.getString("wg_cached_config_${targetSrv.code}", "") ?: ""
                val cachedAddr = prefs.getString("wg_cached_addr_${targetSrv.code}", "10.64.0.2/32") ?: "10.64.0.2/32"
                val cachedPub = prefs.getString("wg_cached_pubkey_${targetSrv.code}", "") ?: ""
                val livePub = targetSrv.publicKey
                val keyMatches = livePub.isBlank() || cachedPub == livePub || cachedConf.contains(livePub)
                if (
                    keyMatches &&
                    cachedConf.contains("PrivateKey") &&
                    cachedConf.contains("MTU = 1380") &&
                    cachedConf.contains("10.64.0.1")
                ) {
                    confText = cachedConf
                    assignedAddr = cachedAddr
                }
            }

            if (confText.contains("PrivateKey")) {
                try {
                    File(context.filesDir, "sweepr0.conf").apply {
                        writeText(confText, Charsets.UTF_8)
                        setReadable(false, false)
                        setReadable(true, true)
                        setWritable(false, false)
                        setWritable(true, true)
                    }
                } catch (_: Exception) {}
            }
        }

        if (authErrMsg != null) {
            if (tunnelState.isConnected) selectedServerCode = prevServerCode
            SweeprWireGuardVpnService.updateConnectingState(false, prevServerCode, prevServerName, authErrMsg)
            showSnackbar(authErrMsg!!)
            return
        }

        if (confText.isBlank() || !confText.contains("PrivateKey")) {
            val errMsg = "Could not reach SWEEPR provisioning server. Check your internet connection."
            if (tunnelState.isConnected) selectedServerCode = prevServerCode
            SweeprWireGuardVpnService.updateConnectingState(false, prevServerCode, prevServerName, errMsg)
            showSnackbar(errMsg)
            return
        }

        prefs.edit()
            .putString("selected_server", targetSrv.code)
            .putString("selected_server_label", "${targetSrv.city}, ${targetSrv.country}")
            .apply()

        val svcIntent = Intent(context, SweeprWireGuardVpnService::class.java).apply {
            action = SweeprWireGuardVpnService.ACTION_CONNECT
            putExtra(SweeprWireGuardVpnService.EXTRA_WG_CONFIG, confText)
            putExtra(SweeprWireGuardVpnService.EXTRA_SERVER_CODE, targetSrv.code)
            putExtra(SweeprWireGuardVpnService.EXTRA_SERVER_NAME, "${targetSrv.city}, ${targetSrv.country}")
            putExtra(SweeprWireGuardVpnService.EXTRA_ADDRESS, assignedAddr)
            putExtra(SweeprWireGuardVpnService.EXTRA_DNS, dnsValue)
            putExtra(SweeprWireGuardVpnService.EXTRA_DNS_SHIELD, smartTvDnsShield)
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
            } catch (e: Exception) {
                SweeprWireGuardVpnService.updateConnectingState(false, targetSrv.code, targetSrv.city, e.message)
                showSnackbar("Could not start VPN service: ${e.message ?: "Unknown error"}")
            }
        }
    }

    val notificationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { _ ->
        val target = pendingPostNotifServerCode ?: selectedServerCode
        pendingPostNotifServerCode = null
        scope.launch { executeWireGuardConnect(target) }
    }

    fun requestConnectWithDisclosureCheck(serverCode: String = selectedServerCode, forceReconnect: Boolean = false) {
        if (!isPro || licenseKey.isBlank()) {
            showUpgradeSheet = true
            return
        }
        if (!vpnDisclosureAccepted) {
            pendingConnectServerCode = serverCode
            showVpnDisclosureDialog = true
            return
        }
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !notificationPrompted &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            notificationPrompted = true
            prefs.edit().putBoolean("notification_prompted", true).apply()
            pendingPostNotifServerCode = serverCode
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }
        scope.launch { executeWireGuardConnect(serverCode, forceReconnect = forceReconnect) }
    }

    suspend fun disconnectWireGuardTunnel() {
        try {
            val svcIntent = Intent(context, SweeprWireGuardVpnService::class.java).apply {
                action = SweeprWireGuardVpnService.ACTION_DISCONNECT
            }
            context.startService(svcIntent)
        } catch (_: Exception) {}
        showSnackbar("VPN disconnected")
        delay(300L)
        refreshEgressStatus()
    }

    LaunchedEffect(tunnelState.isConnected, tunnelState.lastError) {
        if (tunnelState.isConnected && !prevConnectedState) {
            prevConnectedState = true
            showSnackbar("Connected to ${tunnelState.serverName}")
            networkReport = scanAndroidNetworkDiagnostics()
        } else if (!tunnelState.isConnected && prevConnectedState) {
            prevConnectedState = false
            networkReport = scanAndroidNetworkDiagnostics()
        }
        if (!tunnelState.lastError.isNullOrBlank()) {
            showSnackbar(tunnelState.lastError!!)
        }
    }

    fun verifyEd25519LicenseTokenJwt(token: String): Boolean {
        val parts = token.trim().split(".")
        if (parts.size != 3) return false
        return try {
            val flags = android.util.Base64.URL_SAFE or android.util.Base64.NO_WRAP or android.util.Base64.NO_PADDING
            val headerJson = JSONObject(String(android.util.Base64.decode(parts[0], flags), Charsets.UTF_8))
            if (headerJson.optString("alg") != "EdDSA") return false
            val claimsJson = JSONObject(String(android.util.Base64.decode(parts[1], flags), Charsets.UTF_8))
            val status = claimsJson.optString("status")
            if (status != "active" && status != "trialing") return false
            val proj = claimsJson.optString("project_id", "vpn")
            if (proj.isNotBlank() && proj != "vpn") return false
            val exp = claimsJson.optLong("exp", 0L)
            if (exp > 0L && (System.currentTimeMillis() / 1000L) > exp + 300L) return false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val rawPub = android.util.Base64.decode("t04hn-7TfW5RIemEhi4mKbZy6rHRYBO6HxeN5OOIR_8", flags)
                val spkiPrefix = byteArrayOf(0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00)
                val spkiBytes = spkiPrefix + rawPub
                val kf = java.security.KeyFactory.getInstance("Ed25519")
                val pubKey = kf.generatePublic(java.security.spec.X509EncodedKeySpec(spkiBytes))
                val verifier = java.security.Signature.getInstance("Ed25519")
                verifier.initVerify(pubKey)
                verifier.update("${parts[0]}.${parts[1]}".toByteArray(Charsets.UTF_8))
                verifier.verify(android.util.Base64.decode(parts[2], flags))
            } else {
                android.util.Base64.decode(parts[2], flags).size == 64
            }
        } catch (_: Exception) {
            false
        }
    }

    suspend fun activateLicenseKey() {
        val cleanKey = keyInput.trim().uppercase().take(256)
        val cleanEmail = emailInput.trim().lowercase()
        val fullKeyRegex = Regex("^SWEEPR-[A-Z0-9]{2,8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$")
        if (!fullKeyRegex.matches(cleanKey)) {
            showSnackbar("Enter a valid SWEEPR-VPN-XXXX-XXXX-XXXX license key.")
            return
        }
        withContext(Dispatchers.Main) { isActivatingKey = true }
        var uiMessage = ""
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/activate").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 10000
                    readTimeout = 12000
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
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (code in 200..299 && json.optBoolean("ok", false) && json.optBoolean("valid", false)) {
                    val signedTok = json.optString("token", json.optString("license_token", ""))
                    if (signedTok.isBlank() || !verifyEd25519LicenseTokenJwt(signedTok)) {
                        uiMessage = "License response failed security verification."
                    } else {
                        val resolvedKey = json.optString("licenseKey", json.optString("license_key", cleanKey))
                        val resolvedAct = json.optString("activation_code", activationCode)
                        val resolvedEmail = json.optString("email", cleanEmail)
                        val resolvedPlan = json.optString("plan", "annual")
                        val used = json.optInt("devices_used", 1)
                        val maxDev = json.optInt("max_devices", 3)
                        withContext(Dispatchers.Main) {
                            licenseKey = resolvedKey
                            keyInput = resolvedKey
                            activationCode = resolvedAct
                            userEmail = resolvedEmail
                            emailInput = resolvedEmail
                            activePlan = resolvedPlan
                            deviceCount = used
                            deviceLimit = maxDev
                            isPro = true
                            showUpgradeSheet = false
                            showAccountSwitchSection = false
                            prefs.edit()
                                .putString("license_key", resolvedKey)
                                .putString("activation_code", resolvedAct)
                                .putString("user_email", resolvedEmail)
                                .putString("active_plan", resolvedPlan)
                                .putInt("device_count", used)
                                .putInt("device_limit", maxDev)
                                .apply()
                        }
                        uiMessage = "SWEEPR Pro activated ($used/$maxDev devices linked)"
                    }
                } else {
                    uiMessage = json.optString("message", "Invalid or expired license key.")
                }
            } catch (_: Exception) {
                uiMessage = "Could not reach SWEEPR activation server."
            }
        }
        withContext(Dispatchers.Main) {
            isActivatingKey = false
            if (uiMessage.isNotBlank()) showSnackbar(uiMessage)
        }
    }

    suspend fun sendEmailOtp() {
        val cleanEmail = emailInput.trim().lowercase()
        if (!cleanEmail.contains("@") || !cleanEmail.contains(".")) {
            showSnackbar("Enter your account email address first.")
            return
        }
        withContext(Dispatchers.Main) { isSendingOtp = true }
        var uiMessage = ""
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/otp/send").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 10000
                    readTimeout = 12000
                }
                val payload = JSONObject().apply { put("email", cleanEmail) }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (code in 200..299 && (json.optBoolean("ok", false) || json.optBoolean("otpSent", false))) {
                    withContext(Dispatchers.Main) { otpSentState = true }
                    uiMessage = "6-digit code sent to $cleanEmail"
                } else {
                    uiMessage = json.optString("error", "No active account found for $cleanEmail.")
                }
            } catch (_: Exception) {
                uiMessage = "Could not reach login server."
            }
        }
        withContext(Dispatchers.Main) {
            isSendingOtp = false
            if (uiMessage.isNotBlank()) showSnackbar(uiMessage)
        }
    }

    suspend fun verifyEmailOtp() {
        val cleanEmail = emailInput.trim().lowercase()
        val cleanOtp = otpCodeInput.trim()
        if (cleanOtp.length != 6) {
            showSnackbar("Enter the 6-digit code sent to your email.")
            return
        }
        withContext(Dispatchers.Main) { isVerifyingOtp = true }
        var uiMessage = ""
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/otp/verify").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 10000
                    readTimeout = 12000
                }
                val payload = JSONObject().apply {
                    put("email", cleanEmail)
                    put("code", cleanOtp)
                    put("deviceId", deviceId)
                    put("platform", "android")
                    put("deviceLabel", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (code in 200..299 && json.optBoolean("ok", false)) {
                    val signedTok = json.optString("token", json.optString("license_token", ""))
                    if (signedTok.isNotBlank() && !verifyEd25519LicenseTokenJwt(signedTok)) {
                        uiMessage = "Login token failed cryptographic signature verification."
                    } else {
                        val resolvedKey = json.optString("license_key", json.optString("licenseKey", ""))
                        val resolvedPlan = json.optString("plan", "annual")
                        val used = json.optInt("devices_used", 1)
                        val maxDev = json.optInt("max_devices", 3)
                        withContext(Dispatchers.Main) {
                            licenseKey = resolvedKey
                            keyInput = resolvedKey
                            activationCode = ""
                            userEmail = cleanEmail
                            activePlan = resolvedPlan
                            deviceCount = used
                            deviceLimit = maxDev
                            isPro = resolvedKey.isNotBlank()
                            otpSentState = false
                            otpCodeInput = ""
                            showUpgradeSheet = false
                            showAccountSwitchSection = false
                            prefs.edit()
                                .putString("license_key", resolvedKey)
                                .remove("activation_code")
                                .putString("user_email", cleanEmail)
                                .putString("active_plan", resolvedPlan)
                                .putInt("device_count", used)
                                .putInt("device_limit", maxDev)
                                .apply()
                        }
                        uiMessage = "Signed in to SWEEPR Pro ($used/$maxDev devices linked)"
                    }
                } else {
                    uiMessage = json.optString("error", "Invalid or expired 6-digit code.")
                }
            } catch (_: Exception) {
                uiMessage = "Network error verifying 6-digit code."
            }
        }
        withContext(Dispatchers.Main) {
            isVerifyingOtp = false
            if (uiMessage.isNotBlank()) showSnackbar(uiMessage)
        }
    }

    suspend fun redeemPairingToken(pairToken: String) {
        withContext(Dispatchers.Main) { isPairingBusy = true }
        var uiMessage = ""
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/pair/redeem").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 10000
                    readTimeout = 12000
                }
                val payload = JSONObject().apply {
                    put("pair_token", pairToken)
                    put("token", pairToken)
                    put("device_id", deviceId)
                    put("device_name", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
                    put("os", "android")
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (code in 200..299 && json.optBoolean("ok", false)) {
                    val newKey = json.optString("license_key", json.optString("licenseKey", licenseKey))
                    val newAct = json.optString("activation_code", activationCode)
                    val newEmail = json.optString("email", userEmail)
                    val used = json.optInt("device_count", 1)
                    val maxDev = json.optInt("device_limit", 3)
                    withContext(Dispatchers.Main) {
                        licenseKey = newKey
                        keyInput = newKey
                        activationCode = newAct
                        userEmail = newEmail
                        emailInput = newEmail
                        deviceCount = used
                        deviceLimit = maxDev
                        isPro = newKey.isNotBlank()
                        showUpgradeSheet = false
                        prefs.edit()
                            .putString("license_key", newKey)
                            .putString("activation_code", newAct)
                            .putString("user_email", newEmail)
                            .putInt("device_count", used)
                            .putInt("device_limit", maxDev)
                            .apply()
                    }
                    uiMessage = "Device linked ($used/$maxDev devices active)"
                } else {
                    uiMessage = json.optString("message", "Pairing code expired or 3-device limit reached.")
                }
            } catch (_: Exception) {
                uiMessage = "Could not reach SWEEPR pairing server."
            }
        }
        withContext(Dispatchers.Main) {
            isPairingBusy = false
            if (uiMessage.isNotBlank()) showSnackbar(uiMessage)
        }
    }

    suspend fun approveDesktopChallenge(challengeId: String) {
        if (licenseKey.isBlank()) {
            showSnackbar("Sign in to SWEEPR Pro on this phone first to approve a Desktop QR sign-in.")
            return
        }
        withContext(Dispatchers.Main) { isPairingBusy = true }
        var uiMessage = ""
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/pair/approve").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 10000
                    readTimeout = 12000
                }
                val payload = JSONObject().apply {
                    put("challenge_id", challengeId)
                    put("email", userEmail)
                    put("key", licenseKey)
                    put("license_key", licenseKey)
                    put("code", licenseKey)
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (code in 200..299 && json.optBoolean("ok", false)) {
                    val used = json.optInt("device_count", deviceCount)
                    val maxDev = json.optInt("device_limit", 3)
                    withContext(Dispatchers.Main) {
                        deviceCount = used
                        deviceLimit = maxDev
                        prefs.edit().putInt("device_count", used).putInt("device_limit", maxDev).apply()
                    }
                    uiMessage = "Desktop app signed in ($used/$maxDev devices active)"
                } else {
                    uiMessage = json.optString("message", "Could not approve Desktop QR code.")
                }
            } catch (_: Exception) {
                uiMessage = "Network error while approving Desktop QR code."
            }
        }
        withContext(Dispatchers.Main) {
            isPairingBusy = false
            if (uiMessage.isNotBlank()) showSnackbar(uiMessage)
        }
    }

    suspend fun createOutgoingPairToken() {
        if (licenseKey.isBlank()) {
            showSnackbar("Sign in to SWEEPR Pro first to create a pairing code.")
            return
        }
        withContext(Dispatchers.Main) { isPairingBusy = true }
        var uiMessage = ""
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/pair/create").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $licenseKey")
                    connectTimeout = 10000
                    readTimeout = 12000
                }
                val payload = JSONObject().apply {
                    put("key", licenseKey)
                    put("license_key", licenseKey)
                    put("email", userEmail)
                    put("source", "android")
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (code in 200..299 && json.optBoolean("ok", false)) {
                    val tok = json.optString("token", "")
                    withContext(Dispatchers.Main) { generatedPairToken = tok }
                    uiMessage = "Created 120-second pairing code"
                } else {
                    uiMessage = json.optString("message", "Could not create pairing code.")
                }
            } catch (_: Exception) {
                uiMessage = "Network error creating pairing code."
            }
        }
        withContext(Dispatchers.Main) {
            isPairingBusy = false
            if (uiMessage.isNotBlank()) showSnackbar(uiMessage)
        }
    }

    suspend fun handleScannedQrPayload(raw: String, requireConfirmForChallenge: Boolean = false) {
        val trimmed = raw.trim()
        val tokenMatch = Regex("[?&]t=(ptk_[A-Za-z0-9_-]+)").find(trimmed)?.groupValues?.get(1)
        val challengeMatch = Regex("[?&]c=(chk_[A-Za-z0-9_-]+)").find(trimmed)?.groupValues?.get(1)
        when {
            tokenMatch != null -> redeemPairingToken(URLDecoder.decode(tokenMatch, "UTF-8"))
            challengeMatch != null -> {
                val ch = URLDecoder.decode(challengeMatch, "UTF-8")
                if (requireConfirmForChallenge) pendingChallengeToConfirm = ch else approveDesktopChallenge(ch)
            }
            trimmed.startsWith("ptk_") -> redeemPairingToken(trimmed)
            trimmed.startsWith("chk_") -> {
                if (requireConfirmForChallenge) pendingChallengeToConfirm = trimmed else approveDesktopChallenge(trimmed)
            }
            else -> showSnackbar("Enter or scan a valid SWEEPR pairing code or link.")
        }
    }

    fun launchZeroPermissionQrScanner() {
        try {
            val options = GmsBarcodeScannerOptions.Builder()
                .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
                .build()
            val scanner = GmsBarcodeScanning.getClient(context, options)
            scanner.startScan()
                .addOnSuccessListener { barcode ->
                    val raw = barcode.rawValue.orEmpty().trim()
                    if (raw.isNotEmpty()) {
                        qrPayloadInput = raw
                        scope.launch { handleScannedQrPayload(raw, requireConfirmForChallenge = true) }
                    } else {
                        showSnackbar("QR code was empty.")
                    }
                }
                .addOnCanceledListener {
                    showSnackbar("QR scan cancelled.")
                }
                .addOnFailureListener {
                    showSnackbar("QR scanner unavailable on this device. Paste the pairing code below instead.")
                }
        } catch (_: Exception) {
            showSnackbar("QR scanner unavailable on this device. Paste the pairing code below instead.")
        }
    }

    suspend fun submitSupportTicket() {
        val email = emailInput.ifBlank { userEmail }.trim()
        val msg = supportMessage.trim()
        if (!email.contains("@") || msg.isBlank()) {
            showSnackbar("Please enter your email address and support message.")
            return
        }
        withContext(Dispatchers.Main) { isSubmittingSupport = true }
        var uiMessage = ""
        withContext(Dispatchers.IO) {
            try {
                val conn = (URL("https://sweeprvpn.com/api/vpn/support").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    connectTimeout = 10000
                    readTimeout = 12000
                }
                val payload = JSONObject().apply {
                    put("project_id", "vpn")
                    put("email", email)
                    put("subject", "Android App Support Request")
                    put("message", msg)
                    put("os", "android")
                    put("app_version", BuildConfig.VERSION_NAME)
                    put("device_id", deviceId)
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (code in 200..299 && json.optBoolean("ok", false)) {
                    withContext(Dispatchers.Main) { supportMessage = "" }
                    uiMessage = "Ticket #${json.optString("ticket_id", "sent")} received — we reply within 24h."
                } else {
                    uiMessage = json.optString("error", "Could not submit support request.")
                }
            } catch (_: Exception) {
                uiMessage = "Network error while sending support request."
            }
        }
        withContext(Dispatchers.Main) {
            isSubmittingSupport = false
            if (uiMessage.isNotBlank()) showSnackbar(uiMessage)
        }
    }

    suspend fun signOutLocally() {
        if (isConnected) {
            disconnectWireGuardTunnel()
        }
        try {
            File(context.filesDir, "sweepr0.conf").delete()
        } catch (_: Exception) {}
        licenseKey = ""
        keyInput = ""
        activationCode = ""
        userEmail = ""
        emailInput = ""
        googlePlayPurchaseToken = ""
        isPro = false
        showSignOutDialog = false
        prefs.edit()
            .remove("license_key")
            .remove("activation_code")
            .remove("user_email")
            .remove("active_plan")
            .remove("google_play_purchase_token")
            .apply()
        showSnackbar("Signed out on this device. Your cloud account was not deleted.")
    }

    suspend fun deleteAccountPermanently() {
        withContext(Dispatchers.Main) { isDeletingAccount = true }
        if (isConnected) {
            disconnectWireGuardTunnel()
        }
        var deletedOk = false
        var uiMessage = ""

        withContext(Dispatchers.IO) {
            try {
                val resolvedKey = licenseKey.ifBlank { keyInput }.trim()
                val conn = (URL("https://sweeprvpn.com/api/vpn/account/delete").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    if (resolvedKey.isNotBlank()) {
                        setRequestProperty("Authorization", "Bearer $resolvedKey")
                    }
                    connectTimeout = 10000
                    readTimeout = 12000
                }
                val payload = JSONObject().apply {
                    put("email", userEmail.ifBlank { emailInput })
                    put("key", resolvedKey)
                    put("license_key", resolvedKey)
                    put("code", activationCode.ifBlank { resolvedKey })
                    if (googlePlayPurchaseToken.isNotBlank()) {
                        put("purchase_token", googlePlayPurchaseToken)
                    }
                    put("device_id", deviceId)
                    put("reason", deleteReasonInput.ifBlank { "in_app_android_deletion" })
                }
                OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(payload.toString()) }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val body = stream?.bufferedReader()?.use { it.readText() } ?: "{}"
                val json = JSONObject(body)
                if (code in 200..299 && json.optBoolean("ok", false)) {
                    deletedOk = true
                    uiMessage = json.optString("message", "Your SWEEPR VPN account and keys have been permanently deleted.")
                } else {
                    uiMessage = json.optString("message", "Could not verify account deletion request.")
                }
            } catch (_: Exception) {
                uiMessage = "Network error while contacting deletion service. Account was not deleted."
            }
        }

        withContext(Dispatchers.Main) {
            isDeletingAccount = false
            if (deletedOk) {
                try {
                    File(context.filesDir, "sweepr0.conf").delete()
                } catch (_: Exception) {}
                licenseKey = ""
                keyInput = ""
                activationCode = ""
                userEmail = ""
                emailInput = ""
                googlePlayPurchaseToken = ""
                deleteReasonInput = ""
                isPro = false
                showDeleteConfirmDialog = false
                prefs.edit()
                    .remove("license_key")
                    .remove("activation_code")
                    .remove("user_email")
                    .remove("active_plan")
                    .remove("google_play_purchase_token")
                    .apply()
            }
            if (uiMessage.isNotBlank()) showSnackbar(uiMessage)
        }
    }

    fun openPlayStoreSubscriptions() {
        val pkg = context.packageName
        val url = "https://play.google.com/store/account/subscriptions?package=$pkg"
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
        } catch (_: Exception) {}
    }

    fun openPlayStoreForUpdate() {
        val pkg = context.packageName
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$pkg")).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
        } catch (_: Exception) {
            try {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$pkg")).apply { addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
            } catch (_: Exception) {}
        }
    }

    fun isSemverNewer(latest: String, current: String): Boolean {
        fun parseParts(v: String): List<Int> =
            v.trim().removePrefix("v").removePrefix("V").split(".", "-").take(3).map { it.toIntOrNull() ?: 0 }
        val l = parseParts(latest)
        val c = parseParts(current)
        val l0 = l.getOrElse(0) { 0 }; val c0 = c.getOrElse(0) { 0 }
        if (l0 != c0) return l0 > c0
        val l1 = l.getOrElse(1) { 0 }; val c1 = c.getOrElse(1) { 0 }
        if (l1 != c1) return l1 > c1
        val l2 = l.getOrElse(2) { 0 }; val c2 = c.getOrElse(2) { 0 }
        return l2 > c2
    }

    suspend fun checkBackendAppVersion() {
        withContext(Dispatchers.IO) {
            try {
                val curVer = BuildConfig.VERSION_NAME
                val url = "https://sweeprvpn.com/api/vpn/version?platform=android&current_version=$curVer"
                val conn = (URL(url).openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 8000
                    readTimeout = 8000
                }
                if (conn.responseCode in 200..299) {
                    val body = conn.inputStream.bufferedReader().use { it.readText() }
                    val json = JSONObject(body)
                    val srvLatest = json.optString("android_version", json.optString("latest_version", curVer))
                    val srvMin = json.optString("android_min_version", json.optString("min_version", curVer))
                    val notes = json.optString("notes", updateReleaseNotes)
                    val isNewer = json.optBoolean("update_available", false) || isSemverNewer(srvLatest, curVer)
                    val isForced = json.optBoolean("force_update", false) || isSemverNewer(srvMin, curVer)
                    withContext(Dispatchers.Main) {
                        latestAppVersion = srvLatest
                        updateReleaseNotes = notes
                        updateAvailable = isNewer
                        forceUpdateRequired = isForced
                        if (isForced) {
                            onForceUpdateDetected()
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    LaunchedEffect(resumeTick) {
        if (resumeTick > 0) {
            checkBackendAppVersion()
            networkReport = scanAndroidNetworkDiagnostics()
        }
    }

    LaunchedEffect(Unit) {
        checkBackendAppVersion()
        refreshServers(showFeedback = false)
        refreshEgressStatus(measureLatency = false)
    }

    LaunchedEffect(initialLicenseKey) {
        if (initialLicenseKey.isNotBlank() && initialLicenseKey != licenseKey) {
            keyInput = initialLicenseKey
            activateLicenseKey()
        }
    }

    LaunchedEffect(initialPairPayload) {
        if (!initialPairPayload.isNullOrBlank()) {
            qrPayloadInput = initialPairPayload
            handleScannedQrPayload(initialPairPayload, requireConfirmForChallenge = true)
            onConsumePairPayload()
        }
    }

    // ==================== DIALOGS & SHEETS ====================

    if (pendingChallengeToConfirm != null) {
        val chId = pendingChallengeToConfirm ?: ""
        AlertDialog(
            onDismissRequest = { pendingChallengeToConfirm = null },
            title = { Text("Approve Desktop Sign-In?", fontWeight = FontWeight.Bold) },
            text = {
                Text("Only approve this request if you scanned a QR code shown on your own computer (${chId.take(16)}…). This links the computer to your SWEEPR Pro account.")
            },
            confirmButton = {
                Button(
                    onClick = {
                        pendingChallengeToConfirm = null
                        scope.launch { approveDesktopChallenge(chId) }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    Text("Approve Device", color = Color(0xFF042F2E), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingChallengeToConfirm = null }) { Text("Cancel") }
            }
        )
    }

    if (forceUpdateRequired) {
        AlertDialog(
            onDismissRequest = {},
            properties = DialogProperties(dismissOnBackPress = false, dismissOnClickOutside = false),
            icon = { Icon(Icons.Default.Security, contentDescription = null, tint = Color(0xFF10B981)) },
            title = { Text("Update Required", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "A critical security and WireGuard® update (v$latestAppVersion) is required to continue using SWEEPR VPN.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(updateReleaseNotes, style = MaterialTheme.typography.bodySmall, color = Color(0xFF94A3B8))
                }
            },
            confirmButton = {
                Button(
                    onClick = { openPlayStoreForUpdate() },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    Text("Update on Google Play", color = Color(0xFF042F2E), fontWeight = FontWeight.Bold)
                }
            }
        )
    }

    if (showVpnDisclosureDialog) {
        AlertDialog(
            onDismissRequest = { showVpnDisclosureDialog = false },
            icon = { Icon(Icons.Default.Shield, contentDescription = null, tint = Color(0xFF10B981)) },
            title = { Text("VPN Permission Disclosure", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "SWEEPR VPN uses Android's VpnService API to create an encrypted, device-wide WireGuard® tunnel to SWEEPR's zero-log servers.",
                        style = MaterialTheme.typography.bodyMedium
                    )
                    Text(
                        "• Why it is used: To encrypt your Wi-Fi and mobile data traffic, protect your IP address, and route DNS privately inside the tunnel.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text(
                        "• Zero-Logs Privacy: SWEEPR VPN never logs, stores, inspects, or sells your browsing history, traffic content, or DNS queries.",
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
                        requestConnectWithDisclosureCheck(target)
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    Text("Agree & Continue", color = Color(0xFF042F2E), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showVpnDisclosureDialog = false }) { Text("Cancel") }
            }
        )
    }

    if (showSignOutDialog) {
        AlertDialog(
            onDismissRequest = { showSignOutDialog = false },
            icon = { Icon(Icons.Default.Logout, contentDescription = null, tint = Color(0xFF34D399)) },
            title = { Text("Sign Out on This Device?", fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    "This disconnects the VPN and removes your saved credentials from this phone. Your SWEEPR Pro account and subscription remain active.",
                    style = MaterialTheme.typography.bodySmall
                )
            },
            confirmButton = {
                Button(
                    onClick = { scope.launch { signOutLocally() } },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    Text("Sign Out", color = Color(0xFF042F2E), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutDialog = false }) { Text("Cancel") }
            }
        )
    }

    if (showDeleteConfirmDialog) {
        AlertDialog(
            onDismissRequest = { if (!isDeletingAccount) showDeleteConfirmDialog = false },
            icon = { Icon(Icons.Default.DeleteForever, contentDescription = null, tint = Color(0xFFEF4444)) },
            title = { Text("Delete Account & Data?", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "This permanently deletes your SWEEPR VPN account, linked device records, and WireGuard keys across all servers.",
                        style = MaterialTheme.typography.bodySmall
                    )
                    Text(
                        "Important: If you subscribed through Google Play, deleting your app account does not cancel recurring Google Play billing. Cancel recurring billing in Google Play Subscriptions.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFFBBF24)
                    )
                    OutlinedButton(
                        onClick = { openPlayStoreSubscriptions() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("Manage Google Play Subscriptions")
                    }
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
                    enabled = !isDeletingAccount,
                    onClick = { scope.launch { deleteAccountPermanently() } },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626))
                ) {
                    if (isDeletingAccount) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                    } else {
                        Text("Delete Permanently", color = Color.White)
                    }
                }
            },
            dismissButton = {
                TextButton(
                    enabled = !isDeletingAccount,
                    onClick = { showDeleteConfirmDialog = false }
                ) { Text("Keep Account") }
            }
        )
    }

    if (showServerSheet) {
        ModalBottomSheet(
            onDismissRequest = { showServerSheet = false },
            containerColor = Color(0xFF181B1F),
            contentColor = Color.White
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp)
                    .padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "Choose Location (${servers.size})",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    TextButton(
                        enabled = !isRefreshingServers,
                        onClick = { scope.launch { refreshServers(showFeedback = true) } }
                    ) {
                        if (isRefreshingServers) {
                            CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp, color = Color(0xFF34D399))
                        } else {
                            Text("Refresh", color = Color(0xFF34D399), fontWeight = FontWeight.Bold)
                        }
                    }
                }

                // Auto-select Recommended Online Location
                val recommendedSrv = servers.firstOrNull { it.online } ?: servers.first()
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFF242931),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFF10B981).copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                        .clickable {
                            selectedServerCode = recommendedSrv.code
                            prefs.edit()
                                .putString("selected_server", recommendedSrv.code)
                                .putString("selected_server_label", "${recommendedSrv.city}, ${recommendedSrv.country}")
                                .apply()
                            showServerSheet = false
                            if (isConnected) {
                                requestConnectWithDisclosureCheck(recommendedSrv.code, forceReconnect = true)
                            }
                        }
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                "Recommended Location",
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFF34D399),
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Text(
                                "${recommendedSrv.flag} ${recommendedSrv.country} — ${recommendedSrv.city}",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFFE2E8F0)
                            )
                        }
                        Text("Auto", color = Color(0xFF34D399), style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold)
                    }
                }

                HorizontalDivider(color = Color(0xFF242931))

                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 360.dp)
                        .verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    servers.forEach { srv ->
                        val selected = srv.code == selectedServerCode
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = when {
                                !srv.online -> Color(0xFF1E2025)
                                selected -> Color(0xFF064E3B)
                                else -> Color(0xFF242931)
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable(enabled = srv.online) {
                                    selectedServerCode = srv.code
                                    prefs.edit()
                                        .putString("selected_server", srv.code)
                                        .putString("selected_server_label", "${srv.city}, ${srv.country}")
                                        .apply()
                                    showServerSheet = false
                                    if (isConnected) {
                                        requestConnectWithDisclosureCheck(srv.code, forceReconnect = true)
                                    }
                                }
                        ) {
                            Row(
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Row(
                                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text(srv.flag, fontSize = 18.sp)
                                    Column {
                                        Text(
                                            "${srv.city}, ${srv.country}",
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                            color = if (srv.online) Color.White else Color(0xFF64748B),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        Text(
                                            srv.code,
                                            style = MaterialTheme.typography.labelSmall,
                                            fontFamily = FontFamily.Monospace,
                                            color = Color(0xFF94A3B8)
                                        )
                                    }
                                }
                                Surface(
                                    shape = RoundedCornerShape(999.dp),
                                    color = if (srv.online) Color(0xFF064E3B) else Color(0xFF3F1D1D)
                                ) {
                                    Text(
                                        text = if (srv.online) "Online" else "Offline",
                                        style = MaterialTheme.typography.labelSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = if (srv.online) Color(0xFF6EE7B7) else Color(0xFFFCA5A5),
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showUpgradeSheet) {
        ModalBottomSheet(
            onDismissRequest = { showUpgradeSheet = false },
            containerColor = Color(0xFF181B1F),
            contentColor = Color.White
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .padding(bottom = 28.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(Icons.Default.Shield, contentDescription = null, tint = Color(0xFF34D399), modifier = Modifier.size(26.dp))
                    Text(
                        "Unlock SWEEPR VPN Pro",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
                Text(
                    "Fast WireGuard® encryption across 8 global locations for up to 3 devices (Android, Windows, Mac & iOS) with strict zero-logs privacy.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFCBD5E1)
                )

                PlayBillingPlanList(
                    plans = playPlans,
                    isLoading = isLoadingPlans,
                    billingUnavailable = billingUnavailable,
                    onSelectPlan = { plan ->
                        if (activity != null) {
                            billingHelper.launchPurchase(activity, plan.planKey)
                        }
                    },
                    onRetry = { billingHelper.retryConnection() }
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = { billingHelper.restorePurchases() }) {
                        Text("Restore Purchases", color = Color(0xFF94A3B8))
                    }
                    TextButton(onClick = {
                        showUpgradeSheet = false
                        activeTab = 2
                    }) {
                        Text("Already have an account? Sign in", color = Color(0xFF34D399), fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }

    // ==================== MAIN SCAFFOLD ====================

    Scaffold(
        containerColor = Color(0xFF111315),
        contentWindowInsets = WindowInsets.statusBars,
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState)
        },
        bottomBar = {
            NavigationBar(
                containerColor = Color(0xFF181B1F)
            ) {
                NavigationBarItem(
                    selected = activeTab == 0,
                    onClick = { activeTab = 0 },
                    icon = { Icon(Icons.Default.Shield, contentDescription = "Protect") },
                    label = { Text("Protect") }
                )
                NavigationBarItem(
                    selected = activeTab == 1,
                    onClick = {
                        activeTab = 1
                        scope.launch { networkReport = scanAndroidNetworkDiagnostics() }
                    },
                    icon = { Icon(Icons.Default.Wifi, contentDescription = "Shields") },
                    label = { Text("Shields") }
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
                .background(Color(0xFF111315))
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            if (updateAvailable && !forceUpdateRequired) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFF064E3B),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFF10B981), RoundedCornerShape(12.dp))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "Update Available (v$latestAppVersion)",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                color = Color(0xFFA7F3D0)
                            )
                            Text(
                                "Update on Google Play for the latest security & speed fixes.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFFD1FAE5)
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Button(
                            onClick = { openPlayStoreForUpdate() },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981)),
                            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                        ) {
                            Text("Update", color = Color(0xFF042F2E), fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        "SWEEPR VPN",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        if (isPro) "Pro Active • $deviceCount of $deviceLimit devices" else "Free Plan",
                        style = MaterialTheme.typography.labelSmall,
                        color = if (isPro) Color(0xFF34D399) else Color(0xFF94A3B8)
                    )
                }
                Surface(
                    shape = RoundedCornerShape(999.dp),
                    color = when {
                        isConnected -> Color(0xFF064E3B)
                        isPro -> Color(0xFF1E293B)
                        else -> Color(0xFF059669)
                    },
                    modifier = Modifier.clickable {
                        if (!isPro) showUpgradeSheet = true else activeTab = 2
                    }
                ) {
                    Text(
                        text = when {
                            isConnected -> "Protected"
                            isPro -> "Pro Plan"
                            else -> "Upgrade"
                        },
                        color = Color.White,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }

            when (activeTab) {
                0 -> {
                    // ==================== TAB 0: PROTECT ====================
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
                        shape = RoundedCornerShape(22.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(
                                1.dp,
                                if (isConnected) Color(0xFF10B981) else Color(0xFF242931),
                                RoundedCornerShape(22.dp)
                            )
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Box(
                                contentAlignment = Alignment.Center,
                                modifier = Modifier
                                    .size(144.dp)
                                    .clip(CircleShape)
                                    .background(
                                        when {
                                            isConnected -> Color(0xFF059669)
                                            isConnecting -> Color(0xFFD97706)
                                            else -> Color(0xFF242931)
                                        }
                                    )
                                    .border(
                                        2.dp,
                                        when {
                                            isConnected -> Color(0xFF34D399)
                                            isConnecting -> Color(0xFFFBBF24)
                                            else -> Color(0xFF333B47)
                                        },
                                        CircleShape
                                    )
                                    .clickable(enabled = !isConnecting) {
                                        if (isConnected) {
                                            scope.launch { disconnectWireGuardTunnel() }
                                        } else {
                                            requestConnectWithDisclosureCheck(selectedServerCode)
                                        }
                                    }
                            ) {
                                if (isConnecting) {
                                    CircularProgressIndicator(
                                        modifier = Modifier.size(124.dp),
                                        color = Color(0xFFFDE68A),
                                        strokeWidth = 3.dp
                                    )
                                }
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(
                                        imageVector = if (isConnected) Icons.Default.Lock else Icons.Default.Shield,
                                        contentDescription = if (isConnected) "Disconnect VPN" else "Connect VPN",
                                        tint = Color.White,
                                        modifier = Modifier.size(44.dp)
                                    )
                                    Spacer(modifier = Modifier.height(6.dp))
                                    Text(
                                        text = when {
                                            isConnecting -> "CONNECTING"
                                            isConnected -> "TAP TO STOP"
                                            else -> "CONNECT"
                                        },
                                        color = Color.White,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 12.sp,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }

                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(4.dp)
                            ) {
                                Text(
                                    text = when {
                                        isConnecting -> "Establishing Encrypted Tunnel…"
                                        isConnected -> "Protected — ${currentServer.city}"
                                        else -> "Not Protected"
                                    },
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = if (isConnected) Color(0xFF6EE7B7) else Color.White,
                                    textAlign = TextAlign.Center
                                )
                                Text(
                                    text = if (isConnected) {
                                        "Session ${formatDuration(elapsedSec)} • Private DNS ${if (smartTvDnsShield) "On" else "Standard"}"
                                    } else {
                                        "WireGuard® Encryption • Zero-Logs"
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF94A3B8),
                                    textAlign = TextAlign.Center
                                )
                                if (!isConnected) {
                                    Text(
                                        text = "Current network: $egressSummary",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color(0xFF64748B),
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }

                            if (isConnected) {
                                HorizontalDivider(color = Color(0xFF242931))
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clickable { showConnectionDetails = !showConnectionDetails }
                                        .padding(vertical = 4.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = if (tunnelState.rxBytes > 0) "Encrypted Traffic Verified" else "Connection Details",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = Color(0xFFCBD5E1),
                                        fontWeight = FontWeight.SemiBold
                                    )
                                    Icon(
                                        imageVector = if (showConnectionDetails) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                        contentDescription = "Toggle connection details",
                                        tint = Color(0xFF94A3B8)
                                    )
                                }

                                AnimatedVisibility(visible = showConnectionDetails) {
                                    Column(
                                        modifier = Modifier.fillMaxWidth(),
                                        verticalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
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
                                        }
                                        DiagnosticRow("Tunnel IP", tunnelState.assignedIp.ifBlank { "10.64.0.2" })
                                        DiagnosticRow("In-Tunnel DNS", tunnelState.dns)
                                        DiagnosticRow("Protocol", "WireGuard® (MTU 1380)")
                                    }
                                }
                            }
                        }
                    }

                    // Single Location Selector Card
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, Color(0xFF242931), RoundedCornerShape(16.dp))
                            .clickable { showServerSheet = true }
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                Text(currentServer.flag, fontSize = 24.sp)
                                Column {
                                    Text(
                                        "Selected Location",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = Color(0xFF94A3B8)
                                    )
                                    Text(
                                        "${currentServer.city}, ${currentServer.country}",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Surface(
                                    shape = RoundedCornerShape(999.dp),
                                    color = if (currentServer.online) Color(0xFF064E3B) else Color(0xFF3F1D1D)
                                ) {
                                    Text(
                                        text = if (currentServer.online) "Online" else "Offline",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = if (currentServer.online) Color(0xFF6EE7B7) else Color(0xFFFCA5A5),
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                                    )
                                }
                                Icon(Icons.Default.ChevronRight, contentDescription = "Change Location", tint = Color(0xFF94A3B8))
                            }
                        }
                    }

                    if (!isPro) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .border(1.dp, Color(0xFF10B981).copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                                .clickable { showUpgradeSheet = true }
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    Text(
                                        "Start Protecting Your Connection",
                                        style = MaterialTheme.typography.titleSmall,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                    Text(
                                        "8 global WireGuard® locations • Up to 3 devices",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFF94A3B8)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Button(
                                    onClick = { showUpgradeSheet = true },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                                ) {
                                    Text("View Plans", color = Color(0xFF042F2E), fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                1 -> {
                    // ==================== TAB 1: SHIELDS & REAL DIAGNOSTICS ====================
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
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
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Icon(Icons.Default.Speed, contentDescription = null, tint = Color(0xFF34D399))
                                    Text(
                                        "Live Network Security Check",
                                        style = MaterialTheme.typography.titleMedium,
                                        fontWeight = FontWeight.Bold,
                                        color = Color.White
                                    )
                                }
                            }

                            Text(
                                "Real-time inspection of your active Android transport, DNS resolver, captive portal state, and measured SWEEPR server latency.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF94A3B8)
                            )

                            DiagnosticRow("Active Transport", networkReport.transportLabel)
                            DiagnosticRow("Local Device IP", networkReport.localIp)
                            DiagnosticRow("Router / Gateway", networkReport.gatewayIp)
                            DiagnosticRow("DNS Resolver", networkReport.dnsServers)
                            DiagnosticRow("Network Status", networkReport.captivePortalStatus)
                            DiagnosticRow("Security Assessment", networkReport.securitySummary)
                            DiagnosticRow("Measured Latency", latencyCheckResult)

                            Button(
                                enabled = !isRunningLatencyCheck,
                                onClick = { scope.launch { refreshEgressStatus(measureLatency = true) } },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669))
                            ) {
                                if (isRunningLatencyCheck) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Measuring Connection…", color = Color.White)
                                } else {
                                    Icon(Icons.Default.Refresh, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                                    Spacer(modifier = Modifier.width(8.dp))
                                    Text("Run Connection & Latency Check", color = Color.White, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }

                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            Text(
                                "Tunnel Privacy & Network Controls",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                                    Text("Malware-Blocking Fallback DNS", fontWeight = FontWeight.Bold, color = Color.White)
                                    Text(
                                        "Uses SWEEPR's private zero-logs resolver (10.64.0.1) inside the tunnel with Cloudflare Malware Blocking (1.1.1.2) fallback.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFF94A3B8)
                                    )
                                }
                                Switch(
                                    checked = smartTvDnsShield,
                                    onCheckedChange = { enabled ->
                                        smartTvDnsShield = enabled
                                        prefs.edit().putBoolean("smart_tv_dns_shield", enabled).apply()
                                        showSnackbar(
                                            if (enabled) "Private DNS + Malware-Blocking fallback (1.1.1.2) enabled"
                                            else "Private DNS + Standard fallback (1.1.1.1) enabled"
                                        )
                                        if (isConnected) {
                                            requestConnectWithDisclosureCheck(selectedServerCode, forceReconnect = true)
                                        }
                                    }
                                )
                            }

                            HorizontalDivider(color = Color(0xFF242931))

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f).padding(end = 12.dp)) {
                                    Text("Local Network (LAN) Bypass", fontWeight = FontWeight.Bold, color = Color.White)
                                    Text(
                                        "Allow Chromecast, AirPlay & Wi-Fi printers on your local subnet while the VPN is connected.",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Color(0xFF94A3B8)
                                    )
                                }
                                Switch(
                                    checked = lanBypass,
                                    onCheckedChange = { enabled ->
                                        lanBypass = enabled
                                        prefs.edit().putBoolean("lan_bypass", enabled).apply()
                                        showSnackbar(if (enabled) "LAN Bypass enabled" else "LAN Bypass disabled")
                                        if (isConnected) {
                                            requestConnectWithDisclosureCheck(selectedServerCode, forceReconnect = true)
                                        }
                                    }
                                )
                            }

                            HorizontalDivider(color = Color(0xFF242931))

                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                Text("System Kill Switch & Always-On Auto-Protect", fontWeight = FontWeight.Bold, color = Color.White)
                                Text(
                                    "To automatically encrypt every Wi-Fi & 5G network in the background and block unencrypted leaks, enable 'Always-on VPN' and 'Block connections without VPN' in Android Settings.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF94A3B8)
                                )
                                OutlinedButton(
                                    onClick = {
                                        try {
                                            context.startActivity(Intent(Settings.ACTION_VPN_SETTINGS))
                                        } catch (_: Exception) {
                                            showSnackbar("Open Android Settings → Network & internet → VPN to configure Always-On VPN.")
                                        }
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

                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.Top
                        ) {
                            Icon(Icons.Default.LaptopMac, contentDescription = null, tint = Color(0xFF34D399))
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    "Home Wi-Fi Radar on Desktop",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Text(
                                    "Full router-level LAN device identification and Smart-TV ACR telemetry blocking are included with your 3-device SWEEPR Pro subscription in the Windows & macOS apps.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF94A3B8)
                                )
                            }
                        }
                    }
                }

                2 -> {
                    // ==================== TAB 2: ACCOUNT, BILLING & SUPPORT ====================
                    if (isPro) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(
                                            "SWEEPR Pro Subscription",
                                            style = MaterialTheme.typography.titleMedium,
                                            fontWeight = FontWeight.Bold,
                                            color = Color.White
                                        )
                                        Text(
                                            "Plan: ${activePlan.replace("_", " ").replaceFirstChar { it.uppercase() }} • $deviceCount/$deviceLimit devices used",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = Color(0xFF34D399)
                                        )
                                    }
                                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF34D399))
                                }

                                if (licenseKey.isNotBlank()) {
                                    Surface(
                                        shape = RoundedCornerShape(10.dp),
                                        color = Color(0xFF242931),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Row(
                                            modifier = Modifier.padding(12.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Column(modifier = Modifier.weight(1f)) {
                                                Text("LICENSE KEY", style = MaterialTheme.typography.labelSmall, color = Color(0xFF94A3B8))
                                                Text(
                                                    licenseKey,
                                                    fontFamily = FontFamily.Monospace,
                                                    fontWeight = FontWeight.Bold,
                                                    color = Color(0xFF34D399),
                                                    fontSize = 13.sp
                                                )
                                                if (userEmail.isNotBlank()) {
                                                    Text(userEmail, style = MaterialTheme.typography.labelSmall, color = Color(0xFFCBD5E1))
                                                }
                                            }
                                            IconButton(
                                                onClick = {
                                                    val cb = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                                                    cb?.setPrimaryClip(ClipData.newPlainText("SWEEPR License Key", licenseKey))
                                                    showSnackbar("License key copied to clipboard")
                                                }
                                            ) {
                                                Icon(Icons.Default.ContentCopy, contentDescription = "Copy license key", tint = Color(0xFF34D399))
                                            }
                                        }
                                    }
                                }

                                OutlinedButton(
                                    onClick = { openPlayStoreSubscriptions() },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text("Manage Subscription in Google Play")
                                }

                                OutlinedButton(
                                    onClick = { showSignOutDialog = true },
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("Sign Out on This Device")
                                }
                            }
                        }
                    } else {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(
                                modifier = Modifier.padding(16.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                Text(
                                    "Subscribe with Google Play",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                Text(
                                    "Protect up to 3 devices (Android, Windows, Mac & iOS) with one SWEEPR Pro subscription.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF94A3B8)
                                )
                                PlayBillingPlanList(
                                    plans = playPlans,
                                    isLoading = isLoadingPlans,
                                    billingUnavailable = billingUnavailable,
                                    onSelectPlan = { plan ->
                                        if (activity != null) {
                                            billingHelper.launchPurchase(activity, plan.planKey)
                                        }
                                    },
                                    onRetry = { billingHelper.retryConnection() }
                                )
                                TextButton(
                                    onClick = { billingHelper.restorePurchases() },
                                    modifier = Modifier.align(Alignment.End)
                                ) {
                                    Text("Restore Google Play Purchases")
                                }
                            }
                        }
                    }

                    // License Key & Email OTP Card
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable(enabled = isPro) {
                                        showAccountSwitchSection = !showAccountSwitchSection
                                    },
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    if (isPro) "Switch Account or Re-Verify License" else "Sign In with Email or License Key",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                                if (isPro) {
                                    Icon(
                                        imageVector = if (showAccountSwitchSection) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                        contentDescription = "Expand sign in options",
                                        tint = Color(0xFF94A3B8)
                                    )
                                }
                            }

                            AnimatedVisibility(visible = !isPro || showAccountSwitchSection) {
                                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    OutlinedTextField(
                                        value = emailInput,
                                        onValueChange = { emailInput = it },
                                        label = { Text("Account Email Address") },
                                        singleLine = true,
                                        keyboardOptions = KeyboardOptions(
                                            keyboardType = KeyboardType.Email,
                                            imeAction = ImeAction.Next
                                        ),
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                    OutlinedTextField(
                                        value = keyInput,
                                        onValueChange = { keyInput = it },
                                        label = { Text("License Key (SWEEPR-VPN-XXXX-XXXX-XXXX)") },
                                        singleLine = true,
                                        keyboardOptions = KeyboardOptions(
                                            capitalization = KeyboardCapitalization.Characters,
                                            imeAction = ImeAction.Done
                                        ),
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        Button(
                                            enabled = !isActivatingKey && !isSendingOtp,
                                            onClick = { scope.launch { activateLicenseKey() } },
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            if (isActivatingKey) {
                                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color(0xFF042F2E))
                                            } else {
                                                Text("Activate Key")
                                            }
                                        }
                                        OutlinedButton(
                                            enabled = !isSendingOtp && !isActivatingKey,
                                            onClick = { scope.launch { sendEmailOtp() } },
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            if (isSendingOtp) {
                                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color(0xFF34D399))
                                            } else {
                                                Text("Email 6-Digit Code")
                                            }
                                        }
                                    }

                                    if (otpSentState) {
                                        OutlinedTextField(
                                            value = otpCodeInput,
                                            onValueChange = { otpCodeInput = it.filter { ch -> ch.isDigit() }.take(6) },
                                            label = { Text("Enter 6-Digit Email Code") },
                                            singleLine = true,
                                            keyboardOptions = KeyboardOptions(
                                                keyboardType = KeyboardType.Number,
                                                imeAction = ImeAction.Done
                                            ),
                                            modifier = Modifier.fillMaxWidth()
                                        )
                                        Button(
                                            enabled = !isVerifyingOtp,
                                            onClick = { scope.launch { verifyEmailOtp() } },
                                            modifier = Modifier.fillMaxWidth()
                                        ) {
                                            if (isVerifyingOtp) {
                                                CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color(0xFF042F2E))
                                            } else {
                                                Text("Verify Code & Sign In")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // QR Device Pairing Card (Zero-Permission Play Code Scanner + Manual Code)
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
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
                                    "Link Another Device (Phone ⇄ Desktop)",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold,
                                    color = Color.White
                                )
                            }
                            Text(
                                "Scan a Desktop QR code to link your computer, or enter a pairing code from sweeprvpn.com/login.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF94A3B8)
                            )
                            Button(
                                enabled = !isPairingBusy,
                                onClick = { launchZeroPermissionQrScanner() },
                                modifier = Modifier.fillMaxWidth(),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF059669))
                            ) {
                                Icon(Icons.Default.QrCodeScanner, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Scan Desktop QR Code", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                            OutlinedTextField(
                                value = qrPayloadInput,
                                onValueChange = { qrPayloadInput = it },
                                label = { Text("Or paste pairing code / link") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                OutlinedButton(
                                    enabled = !isPairingBusy,
                                    onClick = { scope.launch { handleScannedQrPayload(qrPayloadInput) } },
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Text("Redeem Code")
                                }
                                if (isPro) {
                                    OutlinedButton(
                                        enabled = !isPairingBusy,
                                        onClick = { scope.launch { createOutgoingPairToken() } },
                                        modifier = Modifier.weight(1f)
                                    ) {
                                        Text("Create Code")
                                    }
                                }
                            }
                            if (generatedPairToken.isNotBlank()) {
                                Surface(
                                    shape = RoundedCornerShape(8.dp),
                                    color = Color(0xFF242931),
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Row(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            "Code: $generatedPairToken",
                                            fontFamily = FontFamily.Monospace,
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Color(0xFF34D399),
                                            modifier = Modifier.weight(1f)
                                        )
                                        TextButton(
                                            onClick = {
                                                val cb = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                                                cb?.setPrimaryClip(ClipData.newPlainText("SWEEPR Pairing Code", generatedPairToken))
                                                showSnackbar("Pairing code copied")
                                            }
                                        ) {
                                            Text("Copy")
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Contact Support Card
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Column(
                            modifier = Modifier.padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                "Contact Support",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                "Need help connecting or managing devices? Our team replies within 24 hours.",
                                style = MaterialTheme.typography.bodySmall,
                                color = Color(0xFF94A3B8)
                            )
                            if (userEmail.isBlank()) {
                                OutlinedTextField(
                                    value = emailInput,
                                    onValueChange = { emailInput = it },
                                    label = { Text("Your Email Address") },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(
                                        keyboardType = KeyboardType.Email,
                                        imeAction = ImeAction.Next
                                    ),
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                            OutlinedTextField(
                                value = supportMessage,
                                onValueChange = { supportMessage = it },
                                label = { Text("Describe how we can help") },
                                minLines = 3,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Button(
                                enabled = !isSubmittingSupport,
                                onClick = { scope.launch { submitSupportTicket() } },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                if (isSubmittingSupport) {
                                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = Color(0xFF042F2E))
                                } else {
                                    Text("Send Support Message")
                                }
                            }
                        }
                    }

                    // Privacy, Terms & Account Deletion Card
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF181B1F)),
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
                                    Text("Terms")
                                }
                            }
                            OutlinedButton(
                                onClick = { showDeleteConfirmDialog = true },
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFEF4444)),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Icon(Icons.Default.DeleteForever, contentDescription = null, modifier = Modifier.size(18.dp))
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Delete Account & Data Permanently")
                            }
                            Text(
                                "SWEEPR VPN v${BuildConfig.VERSION_NAME} (Build ${BuildConfig.VERSION_CODE})",
                                style = MaterialTheme.typography.labelSmall,
                                color = Color(0xFF64748B),
                                textAlign = TextAlign.Center,
                                modifier = Modifier.fillMaxWidth()
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PlayBillingPlanList(
    plans: List<PlayPlanListing>,
    isLoading: Boolean,
    billingUnavailable: Boolean,
    onSelectPlan: (PlayPlanListing) -> Unit,
    onRetry: () -> Unit
) {
    when {
        isLoading -> {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 18.dp),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color(0xFF34D399), strokeWidth = 2.dp)
                Spacer(modifier = Modifier.width(10.dp))
                Text("Loading Google Play prices…", style = MaterialTheme.typography.bodySmall, color = Color(0xFF94A3B8))
            }
        }
        plans.isNotEmpty() -> {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                plans.forEach { plan ->
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = Color(0xFF242931),
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onSelectPlan(plan) }
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f).padding(end = 10.dp)) {
                                Text(
                                    plan.badge,
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Color(0xFF34D399),
                                    fontWeight = FontWeight.Bold
                                )
                                Text(plan.title, fontWeight = FontWeight.Bold, color = Color.White)
                                Text(plan.subtitle, style = MaterialTheme.typography.bodySmall, color = Color(0xFF94A3B8))
                            }
                            Button(onClick = { onSelectPlan(plan) }) {
                                Text(plan.formattedPrice)
                            }
                        }
                    }
                }
            }
        }
        else -> {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Color(0xFF242931),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        if (billingUnavailable) {
                            "Google Play plans are unavailable on this device right now. Sign in to Google Play Store to view localized pricing, or sign in below with an existing SWEEPR Pro account."
                        } else {
                            "Unable to load Google Play subscription plans."
                        },
                        style = MaterialTheme.typography.bodySmall,
                        color = Color(0xFFCBD5E1)
                    )
                    OutlinedButton(onClick = onRetry) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Retry Google Play Connection")
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
