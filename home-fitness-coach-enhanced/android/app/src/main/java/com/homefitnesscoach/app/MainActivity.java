package com.homefitnesscoach.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before super.onCreate().
        registerPlugin(ApexNativePlugin.class);
        registerPlugin(ApexHealthPlugin.class);
        registerPlugin(ApexBillingPlugin.class);
        super.onCreate(savedInstanceState);
        // Follow the system font size (Settings > Display > Font size), capped so layouts stay usable.
        float fs = getResources().getConfiguration().fontScale;
        getBridge().getWebView().getSettings().setTextZoom(Math.round(Math.max(1f, Math.min(fs, 1.3f)) * 100));
    }
}
