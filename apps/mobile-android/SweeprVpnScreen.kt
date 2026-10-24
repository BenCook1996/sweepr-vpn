package com.sweepr.vpn.ui

import android.os.Build
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLDecoder

@Composable
fun SweeprVpnScreen(
    deviceId: String,
    initialEmail: String = "",
    initialLicenseKey: String = ""
) {
    val scope = rememberCoroutineScope()
    var isConnected by remember { mutableStateOf(false) }
    var isPro by remember { mutableStateOf(initialLicenseKey.isNotBlank()) }
    var userEmail by remember { mutableStateOf(initialEmail) }
    var licenseKey by remember { mutableStateOf(initialLicenseKey) }
    var deviceCount by remember { mutableStateOf(1) }
    var deviceLimit by remember { mutableStateOf(10) }
    var statusBanner by remember { mutableStateOf("Ready to protect your Android device") }
    var showQrSheet by remember { mutableStateOf(false) }
    var qrPayloadInput by remember { mutableStateOf("") }

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
                    userEmail = json.optString("email", userEmail)
                    deviceCount = json.optInt("device_count", 1)
                    deviceLimit = json.optInt("device_limit", 10)
                    isPro = true
                    showQrSheet = false
                    statusBanner = "Linked via QR ($deviceCount/$deviceLimit devices active)"
                } else {
                    statusBanner = json.optString("message", "QR pairing token expired or 10-device limit reached.")
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
                    deviceLimit = json.optInt("device_limit", 10)
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
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
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
            Button(onClick = { showQrSheet = true }) {
                Text("Scan QR")
            }
        }

        Text(statusBanner, style = MaterialTheme.typography.bodySmall)

        Button(
            onClick = {
                if (isPro) isConnected = !isConnected else showQrSheet = true
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (isConnected) "Protected — Tap to Pause" else "Enable VPN Protection")
        }

        OutlinedButton(
            onClick = { showQrSheet = true },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Scan QR from Portal or Desktop")
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
