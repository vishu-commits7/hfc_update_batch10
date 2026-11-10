package com.homefitnesscoach.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

/**
 * Sends JavaScript errors to Firebase Crashlytics as non-fatal reports. Native crashes are captured by
 * the Crashlytics SDK on its own. No personal data is attached: only the message, where it happened,
 * the app version and a trimmed JS stack.
 */
@CapacitorPlugin(name = "ApexCrash")
public class ApexCrashPlugin extends Plugin {

    @PluginMethod
    public void record(PluginCall call) {
        try {
            String message = trim(call.getString("message", "unknown"), 300);
            String where = trim(call.getString("where", "app"), 80);
            String stack = trim(call.getString("stack", ""), 3000);
            String version = trim(call.getString("version", ""), 40);
            FirebaseCrashlytics c = FirebaseCrashlytics.getInstance();
            c.setCustomKey("js_where", where);
            c.setCustomKey("js_version", version);
            if (!stack.isEmpty()) c.log("JS stack: " + stack);
            // The exception text is what groups reports in the console, so keep it stable per error.
            c.recordException(new RuntimeException("JS " + where + ": " + message));
            call.resolve();
        } catch (Exception e) {
            call.resolve(); // reporting must never break the app
        }
    }

    private static String trim(String s, int max) {
        if (s == null) return "";
        return s.length() > max ? s.substring(0, max) : s;
    }
}
