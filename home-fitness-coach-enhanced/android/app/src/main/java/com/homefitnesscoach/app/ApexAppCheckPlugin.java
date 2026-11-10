package com.homefitnesscoach.app;

import android.content.Context;
import android.content.pm.ApplicationInfo;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.appcheck.FirebaseAppCheck;
import com.google.firebase.appcheck.debug.DebugAppCheckProviderFactory;
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory;

/**
 * Firebase App Check for the Android app. Release builds attest with Play Integrity; debuggable
 * builds use the debug provider (its secret is printed to Logcat and must be allow-listed in the
 * Firebase console). The web layer asks for a token here and passes it to the Firebase JS SDK.
 */
@CapacitorPlugin(name = "ApexAppCheck")
public class ApexAppCheckPlugin extends Plugin {

    /** Call once from MainActivity.onCreate, before any Firebase request is made. */
    public static void install(Context context) {
        try {
            FirebaseApp.initializeApp(context);
            boolean debuggable = (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
            FirebaseAppCheck.getInstance().installAppCheckProviderFactory(
                debuggable ? DebugAppCheckProviderFactory.getInstance() : PlayIntegrityAppCheckProviderFactory.getInstance()
            );
        } catch (Exception ignored) {
            // App Check stays off; the app keeps working while enforcement is off.
        }
    }

    @PluginMethod
    public void getToken(PluginCall call) {
        try {
            FirebaseAppCheck.getInstance().getAppCheckToken(false)
                .addOnSuccessListener(t -> {
                    JSObject r = new JSObject();
                    r.put("token", t.getToken());
                    r.put("expireTimeMillis", t.getExpireTimeMillis());
                    call.resolve(r);
                })
                .addOnFailureListener(e -> call.reject("App Check token failed: " + e.getMessage()));
        } catch (Exception e) {
            call.reject("App Check unavailable: " + e.getMessage());
        }
    }
}
