package com.homefitnesscoach.app;

import android.os.Bundle;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.analytics.FirebaseAnalytics;

import java.util.Iterator;

/**
 * Sends product-analytics events to Firebase Analytics. Only well-formed event names and simple
 * parameters (text, numbers, true/false) are passed on; nothing personal is added here.
 */
@CapacitorPlugin(name = "ApexAnalytics")
public class ApexAnalyticsPlugin extends Plugin {

    @PluginMethod
    public void log(PluginCall call) {
        try {
            String name = call.getString("name", "");
            if (name == null || !name.matches("[a-zA-Z][a-zA-Z0-9_]{0,39}")) { call.resolve(); return; }
            Bundle b = new Bundle();
            JSObject params = call.getObject("params");
            if (params != null) {
                Iterator<String> keys = params.keys();
                int n = 0;
                while (keys.hasNext() && n++ < 20) {
                    String k = keys.next();
                    if (!k.matches("[a-zA-Z][a-zA-Z0-9_]{0,39}")) continue;
                    Object v = params.get(k);
                    if (v instanceof Boolean) b.putLong(k, ((Boolean) v) ? 1L : 0L);
                    else if (v instanceof Integer || v instanceof Long) b.putLong(k, ((Number) v).longValue());
                    else if (v instanceof Number) b.putDouble(k, ((Number) v).doubleValue());
                    else if (v instanceof String) b.putString(k, ((String) v).length() > 100 ? ((String) v).substring(0, 100) : (String) v);
                }
            }
            FirebaseAnalytics.getInstance(getContext()).logEvent(name, b);
        } catch (Exception ignored) {
            // analytics must never break the app
        }
        call.resolve();
    }
}
