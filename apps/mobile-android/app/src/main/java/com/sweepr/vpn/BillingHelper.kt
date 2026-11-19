package com.sweepr.vpn

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
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
import java.lang.ref.WeakReference
import kotlin.math.roundToInt

data class PlayPlanListing(
    val planKey: String,
    val productId: String,
    val title: String,
    val subtitle: String,
    val formattedPrice: String,
    val badge: String,
    val productDetails: ProductDetails
)

class BillingHelper(
    context: Context,
    private val onPurchaseVerified: (
        productId: String,
        purchaseToken: String,
        orderId: String?,
        planKey: String,
        isAcknowledged: Boolean
    ) -> Unit,
    private val onBillingMessage: (String) -> Unit
) : PurchasesUpdatedListener {

    companion object {
        const val PRODUCT_MONTHLY = "sweepr_vpn_monthly"
        const val PRODUCT_SIX_MONTH = "sweepr_vpn_6month"
        const val PRODUCT_ANNUAL = "sweepr_vpn_annual"

        private val PLAN_ORDER = listOf(
            PRODUCT_ANNUAL to "annual",
            PRODUCT_MONTHLY to "monthly",
            PRODUCT_SIX_MONTH to "six_month"
        )
    }

    private val appContext = context.applicationContext
    private val _plans = MutableStateFlow<List<PlayPlanListing>>(emptyList())
    val plans: StateFlow<List<PlayPlanListing>> = _plans.asStateFlow()

    private val _isLoadingPlans = MutableStateFlow(true)
    val isLoadingPlans: StateFlow<Boolean> = _isLoadingPlans.asStateFlow()

    private val _billingUnavailable = MutableStateFlow(false)
    val billingUnavailable: StateFlow<Boolean> = _billingUnavailable.asStateFlow()

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
    private var pendingPurchaseRequest: Pair<WeakReference<Activity>, String>? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    private fun postBillingMessage(msg: String) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            onBillingMessage(msg)
        } else {
            mainHandler.post { onBillingMessage(msg) }
        }
    }

    private fun postPurchaseVerified(
        productId: String,
        purchaseToken: String,
        orderId: String?,
        planKey: String,
        isAcknowledged: Boolean
    ) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            onPurchaseVerified(productId, purchaseToken, orderId, planKey, isAcknowledged)
        } else {
            mainHandler.post {
                onPurchaseVerified(productId, purchaseToken, orderId, planKey, isAcknowledged)
            }
        }
    }

    fun retryConnection() {
        _isLoadingPlans.value = true
        _billingUnavailable.value = false
        startConnection()
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
        _isLoadingPlans.value = true
        try {
            billingClient.startConnection(object : BillingClientStateListener {
                override fun onBillingSetupFinished(result: BillingResult) {
                    if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                        _isBillingReady.value = true
                        _billingUnavailable.value = false
                        querySubscriptionProducts()
                        if (pendingManualRestore) {
                            pendingManualRestore = false
                            restorePurchases()
                        } else {
                            syncOwnedPurchasesOnStartup()
                        }
                    } else {
                        _isBillingReady.value = false
                        _isLoadingPlans.value = false
                        _billingUnavailable.value = true
                        val failedPurchase = pendingPurchaseRequest
                        pendingPurchaseRequest = null
                        if (pendingManualRestore || failedPurchase != null) {
                            pendingManualRestore = false
                            postBillingMessage(
                                "Google Play Store billing is unavailable on this device. Please ensure you are signed in to Google Play and try again."
                            )
                        }
                    }
                }

                override fun onBillingServiceDisconnected() {
                    _isBillingReady.value = false
                }
            })
        } catch (_: Exception) {
            _isBillingReady.value = false
            _isLoadingPlans.value = false
            _billingUnavailable.value = true
        }
    }

    private fun syncOwnedPurchasesOnStartup() {
        val params = QueryPurchasesParams.newBuilder()
            .setProductType(BillingClient.ProductType.SUBS)
            .build()
        billingClient.queryPurchasesAsync(params) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases.isNotEmpty()) {
                for (purchase in purchases) {
                    if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
                        handlePurchase(purchase)
                    }
                }
            }
        }
    }

    /**
     * Deterministically selects the best eligible offer for a subscription product:
     * prefers an eligible promotional/intro offer (lowest upfront phase price), falling
     * back to the base plan (`offerId == null`) or first available offer.
     */
    private fun selectBestOffer(details: ProductDetails): ProductDetails.SubscriptionOfferDetails? {
        val offers = details.subscriptionOfferDetails.orEmpty()
        if (offers.isEmpty()) return null
        val promoOffers = offers.filter { !it.offerId.isNullOrBlank() }
        if (promoOffers.isNotEmpty()) {
            return promoOffers.minByOrNull { offer ->
                offer.pricingPhases.pricingPhaseList.firstOrNull()?.priceAmountMicros ?: Long.MAX_VALUE
            }
        }
        return offers.firstOrNull { it.offerId.isNullOrBlank() } ?: offers.firstOrNull()
    }

    private fun formatBillingPeriod(isoPeriod: String): String {
        return when (isoPeriod.uppercase()) {
            "P1W" -> "week"
            "P2W" -> "2 weeks"
            "P1M" -> "month"
            "P3M" -> "3 months"
            "P6M" -> "6 months"
            "P1Y" -> "year"
            else -> {
                val body = isoPeriod.uppercase().removePrefix("P")
                when {
                    body.endsWith("D") -> {
                        val n = body.dropLast(1).toIntOrNull() ?: 1
                        if (n == 1) "day" else "$n days"
                    }
                    body.endsWith("W") -> {
                        val n = body.dropLast(1).toIntOrNull() ?: 1
                        if (n == 1) "week" else "$n weeks"
                    }
                    body.endsWith("M") -> {
                        val n = body.dropLast(1).toIntOrNull() ?: 1
                        if (n == 1) "month" else "$n months"
                    }
                    body.endsWith("Y") -> {
                        val n = body.dropLast(1).toIntOrNull() ?: 1
                        if (n == 1) "year" else "$n years"
                    }
                    else -> "period"
                }
            }
        }
    }

    private fun querySubscriptionProducts() {
        _isLoadingPlans.value = true
        val productList = PLAN_ORDER.map { (prodId, _) ->
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
                val monthlyBaseMicros = byId[PRODUCT_MONTHLY]
                    ?.let { selectBestOffer(it) }
                    ?.pricingPhases
                    ?.pricingPhaseList
                    ?.lastOrNull()
                    ?.priceAmountMicros
                    ?: 0L

                val mappedPlans = PLAN_ORDER.mapNotNull { (prodId, planKey) ->
                    val match = byId[prodId] ?: return@mapNotNull null
                    val bestOffer = selectBestOffer(match) ?: return@mapNotNull null
                    val phases = bestOffer.pricingPhases.pricingPhaseList
                    val firstPhase = phases.firstOrNull() ?: return@mapNotNull null
                    val lastPhase = phases.lastOrNull() ?: firstPhase

                    val firstPeriod = formatBillingPeriod(firstPhase.billingPeriod)
                    val recurringPeriod = formatBillingPeriod(lastPhase.billingPeriod)

                    val title = when (planKey) {
                        "annual" -> "Annual Pro Plan"
                        "six_month" -> "6-Month Pro Plan"
                        else -> if (phases.size >= 2) "Monthly Pro (Intro Offer)" else "Monthly Pro Plan"
                    }

                    val subtitle = when {
                        phases.size >= 2 && firstPhase.priceAmountMicros == 0L ->
                            "Free for $firstPeriod, then ${lastPhase.formattedPrice}/$recurringPeriod • Up to 3 devices"
                        phases.size >= 2 ->
                            "${firstPhase.formattedPrice} first $firstPeriod, then ${lastPhase.formattedPrice}/$recurringPeriod • Up to 3 devices"
                        else ->
                            "${lastPhase.formattedPrice} per $recurringPeriod • Cancel anytime • Up to 3 devices"
                    }

                    val savingsPct: Int = if (monthlyBaseMicros > 0L && lastPhase.priceAmountMicros > 0L) {
                        val monthsInPlan = when (planKey) {
                            "annual" -> 12.0
                            "six_month" -> 6.0
                            else -> 1.0
                        }
                        if (monthsInPlan > 1.0) {
                            val baselineMicros = monthlyBaseMicros * monthsInPlan
                            (((baselineMicros - lastPhase.priceAmountMicros) / baselineMicros) * 100.0)
                                .roundToInt()
                                .coerceIn(0, 90)
                        } else 0
                    } else 0

                    val badge = when {
                        phases.size >= 2 && firstPhase.priceAmountMicros == 0L -> "FREE TRIAL"
                        phases.size >= 2 -> "INTRO • ${firstPhase.formattedPrice}"
                        planKey == "annual" && savingsPct > 0 -> "BEST VALUE • SAVE $savingsPct%"
                        planKey == "annual" -> "BEST VALUE"
                        planKey == "six_month" && savingsPct > 0 -> "SAVE $savingsPct%"
                        planKey == "six_month" -> "6 MONTHS"
                        else -> "FLEXIBLE"
                    }

                    val ctaPrice = if (firstPhase.priceAmountMicros == 0L) "Start Trial" else firstPhase.formattedPrice

                    PlayPlanListing(
                        planKey = planKey,
                        productId = prodId,
                        title = title,
                        subtitle = subtitle,
                        formattedPrice = ctaPrice,
                        badge = badge,
                        productDetails = match
                    )
                }

                _plans.value = mappedPlans
                _isLoadingPlans.value = false
                _billingUnavailable.value = mappedPlans.isEmpty()

                val queued = pendingPurchaseRequest
                if (queued != null && mappedPlans.isNotEmpty()) {
                    pendingPurchaseRequest = null
                    val act = queued.first.get()
                    if (act != null && !act.isFinishing && !act.isDestroyed) {
                        act.runOnUiThread {
                            launchPurchase(act, queued.second)
                        }
                    }
                }
            } else {
                _plans.value = emptyList()
                _isLoadingPlans.value = false
                _billingUnavailable.value = true
                val failedReq = pendingPurchaseRequest
                pendingPurchaseRequest = null
                if (failedReq != null) {
                    postBillingMessage(
                        "Google Play subscription plans could not be loaded. Please check your Google Play connection and try again."
                    )
                }
            }
        }
    }

    fun launchPurchase(activity: Activity, planKey: String): Boolean {
        val currentPlans = _plans.value
        val plan = currentPlans.firstOrNull { it.planKey == planKey } ?: currentPlans.firstOrNull()
        if (!billingClient.isReady || plan == null) {
            pendingPurchaseRequest = WeakReference(activity) to planKey
            retryConnection()
            postBillingMessage("Connecting to Google Play Store…")
            return false
        }
        val details = plan.productDetails
        val offerToken = selectBestOffer(details)?.offerToken
        if (offerToken.isNullOrBlank()) {
            postBillingMessage("This subscription offer is currently unavailable in Google Play for your region.")
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
                postBillingMessage("Google Play Billing: ${result.debugMessage.ifBlank { "Could not complete purchase." }}")
            }
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        val productId = purchase.products.firstOrNull() ?: PRODUCT_ANNUAL
        val planKey = when {
            productId.contains("6", ignoreCase = true) || productId.contains("six", ignoreCase = true) -> "six_month"
            productId.contains("month", ignoreCase = true) -> "monthly"
            else -> "annual"
        }
        postPurchaseVerified(
            productId = productId,
            purchaseToken = purchase.purchaseToken,
            orderId = purchase.orderId,
            planKey = planKey,
            isAcknowledged = purchase.isAcknowledged
        )
    }

    /**
     * Acknowledge a Google Play purchase ONLY after SWEEPR backend verification succeeds.
     */
    fun acknowledgePurchase(purchaseToken: String, onDone: (Boolean) -> Unit = {}) {
        if (!billingClient.isReady || purchaseToken.isBlank()) {
            mainHandler.post { onDone(false) }
            return
        }
        val ackParams = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchaseToken)
            .build()
        billingClient.acknowledgePurchase(ackParams) { result ->
            val ok = result.responseCode == BillingClient.BillingResponseCode.OK
            mainHandler.post { onDone(ok) }
        }
    }

    fun endConnection() {
        try {
            billingClient.endConnection()
        } catch (_: Exception) {}
    }
}
