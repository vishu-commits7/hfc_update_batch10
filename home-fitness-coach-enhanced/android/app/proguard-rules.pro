# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile


# --- Keep rules for when minifyEnabled is turned on (currently off) ---
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod, SourceFile, LineNumberTable
# Capacitor finds plugins and their methods by annotation/reflection
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { @com.getcapacitor.annotation.PermissionCallback <methods>; @com.getcapacitor.ActivityCallback <methods>; @com.getcapacitor.PluginMethod public <methods>; }
-keep class com.homefitnesscoach.app.** { *; }
-keep class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**
# Health Connect and Play Billing call into these through their own APIs
-keep class androidx.health.connect.client.** { *; }
-keep class com.android.billingclient.** { *; }
