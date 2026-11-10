package com.homefitnesscoach.app;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Google Play Billing for the Pro subscription. This plugin only talks to Play; it never decides who
 * is Pro. The web layer sends the purchase token to the server (verifyPurchase), which asks Google.
 */
@CapacitorPlugin(name = "ApexBilling")
public class ApexBillingPlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient client;
    private final Map<String, ProductDetails> details = new HashMap<>();
    private PluginCall purchaseCall;

    private interface Ready { void run(); }

    private void withClient(PluginCall call, Ready ready) {
        if (client != null && client.isReady()) { ready.run(); return; }
        if (client == null) {
            client = BillingClient.newBuilder(getContext())
                .setListener(this)
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        }
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(@NonNull BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) ready.run();
                else call.reject("Google Play Billing isn't available: " + r.getDebugMessage(), String.valueOf(r.getResponseCode()));
            }
            @Override public void onBillingServiceDisconnected() { /* auto reconnect is enabled */ }
        });
    }

    /** { productId } -> { offers: [{ offerToken, basePlanId, price, period }] } */
    @PluginMethod
    public void getProducts(PluginCall call) {
        final String productId = call.getString("productId");
        if (productId == null) { call.reject("productId required"); return; }
        withClient(call, () -> {
            QueryProductDetailsParams params = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(
                    QueryProductDetailsParams.Product.newBuilder().setProductId(productId).setProductType(BillingClient.ProductType.SUBS).build()))
                .build();
            client.queryProductDetailsAsync(params, (result, queryResult) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject(result.getDebugMessage(), String.valueOf(result.getResponseCode())); return; }
                JSArray offers = new JSArray();
                List<ProductDetails> list = queryResult.getProductDetailsList();
                for (ProductDetails pd : list) {
                    details.put(pd.getProductId(), pd);
                    List<ProductDetails.SubscriptionOfferDetails> offs = pd.getSubscriptionOfferDetails();
                    if (offs == null) continue;
                    for (ProductDetails.SubscriptionOfferDetails o : offs) {
                        List<ProductDetails.PricingPhase> phases = o.getPricingPhases().getPricingPhaseList();
                        if (phases.isEmpty()) continue;
                        ProductDetails.PricingPhase last = phases.get(phases.size() - 1); // the recurring price
                        // a free trial is a first phase that costs nothing (e.g. P7D); "" when the offer has none
                        String trial = "";
                        if (phases.size() > 1 && phases.get(0).getPriceAmountMicros() == 0) trial = phases.get(0).getBillingPeriod();
                        offers.put(new JSObject()
                            .put("offerToken", o.getOfferToken())
                            .put("basePlanId", o.getBasePlanId())
                            .put("price", last.getFormattedPrice())
                            .put("period", last.getBillingPeriod())
                            .put("priceMicros", last.getPriceAmountMicros())
                            .put("currency", last.getPriceCurrencyCode())
                            .put("trial", trial));
                    }
                }
                call.resolve(new JSObject().put("offers", offers));
            });
        });
    }

    /** { productId, offerToken } -> { purchaseToken, productId } once the user completes the Play sheet. */
    @PluginMethod
    public void purchase(PluginCall call) {
        final String productId = call.getString("productId");
        final String offerToken = call.getString("offerToken");
        ProductDetails pd = productId == null ? null : details.get(productId);
        if (pd == null || offerToken == null) { call.reject("Load products first."); return; }
        if (getActivity() == null) { call.reject("No activity"); return; }
        withClient(call, () -> {
            BillingFlowParams flow = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(pd).setOfferToken(offerToken).build()))
                .build();
            purchaseCall = call;
            bridge.saveCall(call);
            BillingResult r = client.launchBillingFlow(getActivity(), flow);
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                purchaseCall = null;
                call.reject(r.getDebugMessage(), String.valueOf(r.getResponseCode()));
            }
        });
    }

    @Override
    public void onPurchasesUpdated(@NonNull BillingResult r, @Nullable List<Purchase> purchases) {
        PluginCall call = purchaseCall;
        purchaseCall = null;
        if (call == null) return;
        if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED && !p.getProducts().isEmpty()) {
                    call.resolve(new JSObject().put("purchaseToken", p.getPurchaseToken()).put("productId", p.getProducts().get(0)));
                    return;
                }
            }
            call.reject("Your purchase is pending. You'll get Pro as soon as Google Play confirms the payment.", "PENDING");
            return;
        }
        if (r.getResponseCode() == BillingClient.BillingResponseCode.USER_CANCELED) call.reject("Cancelled", "CANCELED");
        else call.reject(r.getDebugMessage(), String.valueOf(r.getResponseCode()));
    }

    /** Active subscriptions on this Google account, for restore and for refreshing after a renewal. */
    @PluginMethod
    public void getPurchases(PluginCall call) {
        withClient(call, () -> client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(),
            (result, list) -> {
                if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject(result.getDebugMessage(), String.valueOf(result.getResponseCode())); return; }
                JSArray arr = new JSArray();
                List<Purchase> safe = list == null ? new ArrayList<>() : list;
                for (Purchase p : safe) {
                    if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED && !p.getProducts().isEmpty()) {
                        arr.put(new JSObject().put("purchaseToken", p.getPurchaseToken()).put("productId", p.getProducts().get(0)));
                    }
                }
                call.resolve(new JSObject().put("purchases", arr));
            }));
    }
}
