package com.sweepr.vpn

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.core.content.ContextCompat
import java.util.UUID

private val SweeprDarkColors = darkColorScheme(
    primary = Color(0xFF10B981),
    onPrimary = Color(0xFF042F2E),
    primaryContainer = Color(0xFF064E3B),
    onPrimaryContainer = Color(0xFFA7F3D0),
    secondary = Color(0xFF38BDF8),
    background = Color(0xFF0B1120),
    surface = Color(0xFF111827),
    surfaceVariant = Color(0xFF1E293B),
    onBackground = Color(0xFFF8FAFC),
    onSurface = Color(0xFFF1F5F9),
    onSurfaceVariant = Color(0xFF94A3B8),
    error = Color(0xFFEF4444)
)

class MainActivity : ComponentActivity() {

    private var deepLinkPairPayload by mutableStateOf<String?>(null)
    private var deepLinkLicenseKey by mutableStateOf<String?>(null)

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        val prefs = getSharedPreferences("sweepr_vpn_prefs", Context.MODE_PRIVATE)
        var deviceId = prefs.getString("device_id", null)
        if (deviceId.isNullOrBlank()) {
            deviceId = "dev_vpn_and_" + UUID.randomUUID().toString().replace("-", "").take(12)
            prefs.edit().putString("device_id", deviceId).apply()
        }

        extractDeepLink(intent)

        setContent {
            MaterialTheme(colorScheme = SweeprDarkColors) {
                SweeprVpnScreen(
                    deviceId = deviceId,
                    initialEmail = prefs.getString("user_email", "") ?: "",
                    initialLicenseKey = deepLinkLicenseKey ?: (prefs.getString("license_key", "") ?: ""),
                    initialPairPayload = deepLinkPairPayload,
                    onConsumePairPayload = { deepLinkPairPayload = null }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        extractDeepLink(intent)
    }

    private fun extractDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        val scheme = data.scheme?.lowercase() ?: return
        val host = data.host?.lowercase() ?: ""
        val isCustomScheme = scheme == "sweeprvpn"
        val isHttpsLink = (scheme == "https" || scheme == "http") &&
            (host == "sweeprvpn.com" || host == "www.sweeprvpn.com")
        if (isCustomScheme || isHttpsLink) {
            val token = data.getQueryParameter("t") ?: data.getQueryParameter("token")
            val challenge = data.getQueryParameter("c") ?: data.getQueryParameter("challenge_id")
            val key = data.getQueryParameter("key") ?: data.getQueryParameter("code")
            when {
                !token.isNullOrBlank() -> deepLinkPairPayload = token
                !challenge.isNullOrBlank() -> deepLinkPairPayload = challenge
                !key.isNullOrBlank() -> deepLinkLicenseKey = key.trim().uppercase()
            }
        }
    }
}
