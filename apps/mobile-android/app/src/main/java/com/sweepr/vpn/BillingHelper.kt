package com.sweepr.vpn

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class PlayPlanListing(
    val planKey: String,
    val productId: String,
    val title: String,
    val subtitle: String,
    val formattedPrice: String,
    val badge: String,
    val productDetails: ProductDetails? = null
)

class BillingHelper(
    context: Context,
    private val onPurchaseVerified: (productId: String, purchaseToken: String, orderId: String?, planKey: String) -> Unit,
    private val onBillingMessage: (String) -> Unit
) : PurchasesUpdatedListener {

    companion object {
        const val PRODUCT_MONTHLY = "sweepr_vpn_monthly"
        const val PRODUCT_SIX_MONTH = "sweepr_vpn_6month"
        const val PRODUCT_ANNUAL = "sweepr_vpn_annual"

        val DEFAULT_PLANS = listOf(
            PlayPlanListing(
                planKey = "monthly",
                productId = PRODUCT_MONTHLY,
                title = "Monthly Plan (Intro Offer)",
                subtitle = "£1.99 first month, then £12.49/mo • Up to 3 devices",
                formattedPrice = "£1.99",
                badge = "POPULAR • £1.99 INTRO"
            ),
            PlayPlanListing(
                planKey = "annual",
                productId = PRODUCT_ANNUAL,
                title = "Annual Pro Plan",
                subtitle = "£74.99/yr (£6.25/mo) • Save 50% • Up to 3 devices",
                formattedPrice = "£74.99/yr",
                badge = "BEST VALUE • SAVE 50%"
            ),
            PlayPlanListing(
                planKey = "six_month",
                productId = PRODUCT_SIX_MONTH,
                title = "6-Month Pro Plan",
                subtitle = "£48.99 every 6 months • Save 35% • Up to 3 devices",
                formattedPrice = "£48.99/6mo",
                badge = "SAVE 35%"
            )
        )
    }

    private val appContext = context.applicationContext
    private val _plans = MutableStateFlow(DEFAULT_PLANS)
    val plans: StateFlow<List<PlayPlanListing>> = _plans.asStateFlow()

    private val _isBillingReady = MutableStateFlow(false)
    val isBillingReady: StateFlow<Boolean> = _isBillingReady.asStateFlow()

    private val billingClient: BillingClient = BillingClient.newBuilder(appContext)
        .setListener(this)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .enablePrepaidPlans()
                .build()
        )
        .build()

    private var pendingManualRestore: Boolean = false
    private var pendingPurchaseRequest: Pair<java.lang.ref.WeakReference<Activity>, String>? = null
    private val mainHandler = android.os.Handler(android.os.Looper.getMainLooper())

    private fun postBillingMessage(msg: String) {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            onBillingMessage(msg)
        } else {
            mainHandler.post { onBillingMessage(msg) }
        }
    }

    private fun postPurchaseVerified(productId: String, purchaseToken: String, orderId: String?, planKey: String) {
        if (android.os.Looper.myLooper() == android.os.Looper.getMainLooper()) {
            onPurchaseVerified(productId, purchaseToken, orderId, planKey)
        } else {
            mainHandler.post { onPurchaseVerified(productId, purchaseToken, orderId, planKey) }
        }
    }

    fun startConnection() {
        if (billingClient.isReady) {
            _isBillingReady.value = true
            querySubscriptionProducts()
            if (pendingManualRestore) {
                pendingManualRestore = false
                restorePurchases()
            } else {
                syncOwnedPurchasesOnStartup()
            }
            return
        }
        try {
            billingClient.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                        _isBillingReady.value = true
                        querySubscriptionProducts()
                        if (pendingManualRestore) {
                            pendingManualRestore = false
                            restorePurchases()
                        } else {
                            syncOwnedPurchasesOnStartup()
                        }
                    } else {
                        _isBillingReady.value = false
                        val failedPurchase = pendingPurchaseRequest
                        pendingPurchaseRequest = null
                        if (pendingManualRestore || failedPurchase != null) {
                            pendingManualRestore = false
                            postBillingMessage("Google Play Store is unavailable on this device. You can also subscribe at sweeprvpn.com/order.")
                        }
                    }
                }

                override fun onBillingServiceDisconnected() {
                    _isBillingReady.value = false
                }
            })
        } catch (_: Exception) {
            _isBillingReady.value = false
        }
    }

    private fun syncOwnedPurchasesOnStartup() {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        billingClient.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK && !purchases.isNullOrEmpty()) {
                for (purchase in purchases) {
                    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                        handlePurchase(purchase)
                    }
                }
            }
        }
    }

    private fun querySubscriptionProducts() {
        val productList = listOf(PRODUCT_MONTHLY, PRODUCT_ANNUAL, PRODUCT_SIX_MONTH).map { prodId ->
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(prodId)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        }
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(productList)
            .build()

        billingClient.queryProductDetailsAsync(params) { result, queryProductDetailsResult ->
            val detailsList = queryProductDetailsResult.productDetailsList
            if (result.responseCode == BillingClient.BillingResponseCode.OK && detailsList.isNotEmpty()) {
                val byId = detailsList.associateBy { it.productId }
                _plans.value = DEFAULT_PLANS.map { item ->
                    val match = byId[item.productId]
                    val phases = match?.subscriptionOfferDetails
                        ?.firstOrNull()
                        ?.pricingPhases
                        ?.pricingPhaseList
                        .orEmpty()
                    val firstPhase = phases.firstOrNull()
                    val lastPhase = phases.lastOrNull()
                    val periodLabel = when (item.planKey) {
                        "monthly" -> "month"
                        "six_month" -> "6 months"
                        else -> "year"
                    }
                    val dynamicSubtitle = when {
                        phases.size >= 2 && firstPhase != null && lastPhase != null ->
                            "${firstPhase.formattedPrice} first period, then ${lastPhase.formattedPrice}/$periodLabel • Up to 3 devices"
                        firstPhase != null ->
                            "${firstPhase.formattedPrice} billed every $periodLabel • Cancel anytime • Up to 3 devices"
                        else -> item.subtitle
                    }
                    val dynamicBadge = if (phases.size >= 2 && firstPhase != null) {
                        "POPULAR • ${firstPhase.formattedPrice} INTRO"
                    } else {
                        item.badge
                    }
                    item.copy(
                        subtitle = dynamicSubtitle,
                        formattedPrice = firstPhase?.formattedPrice ?: item.formattedPrice,
                        badge = dynamicBadge,
                        productDetails = match
                    )
                }
                val queued = pendingPurchaseRequest
                if (queued != null) {
                    pendingPurchaseRequest = null
                    val act = queued.first.get()
                    if (act != null && !act.isFinishing && !act.isDestroyed) {
                        act.runOnUiThread {
                            launchPurchase(act, queued.second)
                        }
                    }
                }
            } else {
                val failedReq = pendingPurchaseRequest
                pendingPurchaseRequest = null
                if (failedReq != null) {
                    postBillingMessage("Google Play subscription offers could not be loaded on this device. You can also subscribe at sweeprvpn.com/order.")
                }
            }
        }
    }

    fun launchPurchase(activity: Activity, planKey: String): Boolean {
        val plan = _plans.value.firstOrNull { it.planKey == planKey } ?: _plans.value.first()
        val details = plan.productDetails
        if (!billingClient.isReady || details == null) {
            pendingPurchaseRequest = java.lang.ref.WeakReference(activity) to planKey
            startConnection()
            postBillingMessage("Connecting to Google Play Billing… If Play Store is not signed in on this device, you can also complete checkout at sweeprvpn.com/order.")
            return false
        }
        val offerToken = details.subscriptionOfferDetails?.firstOrNull()?.offerToken
        if (offerToken.isNullOrBlank()) {
            postBillingMessage("Subscription offer unavailable in Play Store for this region.")
            return false
        }
        val productDetailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
            .setProductDetails(details)
            .setOfferToken(offerToken)
            .build()
        val flowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(productDetailsParams))
            .build()
        val res = billingClient.launchBillingFlow(activity, flowParams)
        return res.responseCode == BillingClient.BillingResponseCode.OK
    }

    fun restorePurchases() {
        if (!billingClient.isReady) {
            pendingManualRestore = true
            startConnection()
            postBillingMessage("Connecting to Google Play Store to check active subscriptions…")
            return
        }
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        billingClient.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases.isNotEmpty()) {
                var foundActive = false
                for (purchase in purchases) {
                    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                        foundActive = true
                        handlePurchase(purchase)
                    }
                }
                if (!foundActive) {
                    postBillingMessage("No active Google Play subscription found for this Google account.")
                }
            } else {
                postBillingMessage("No active Google Play subscription found for this Google account.")
            }
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                purchases?.forEach { purchase ->
                    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                        handlePurchase(purchase)
                    } else if (purchase.purchaseState == Purchase.PurchaseState.PENDING) {
                        postBillingMessage("Google Play purchase is pending payment confirmation.")
                    }
                }
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> {
                postBillingMessage("Google Play checkout cancelled.")
            }
            else -> {
                postBillingMessage("Google Play Billing message: ${result.debugMessage.ifBlank { "Could not complete purchase." }}")
            }
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        val productId = purchase.products.firstOrNull() ?: PRODUCT_ANNUAL
        val planKey = when {
            productId.contains("month", ignoreCase = true) && !productId.contains("6", ignoreCase = true) -> "monthly"
            productId.contains("6", ignoreCase = true) || productId.contains("six", ignoreCase = true) -> "six_month"
            else -> "annual"
        }
        if (!purchase.isAcknowledged) {
            val ackParams = AcknowledgePurchaseParams.newBuilder()
                .setPurchaseToken(purchase.purchaseToken)
                .build()
            billingClient.acknowledgePurchase(ackParams) {
                postPurchaseVerified(productId, purchase.purchaseToken, purchase.orderId, planKey)
            }
        } else {
            postPurchaseVerified(productId, purchase.purchaseToken, purchase.orderId, planKey)
        }
    }

    fun endConnection() {
        try {
            billingClient.endConnection()
        } catch (_: Exception) {}
    }
}
