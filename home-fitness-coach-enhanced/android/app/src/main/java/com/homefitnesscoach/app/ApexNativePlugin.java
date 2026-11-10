package com.homefitnesscoach.app;

import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.Uri;
import android.util.Base64;

import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Two things the stock WebView cannot do:
 *
 *  - share(): open the real Android share sheet with text, a link and/or an
 *    image. navigator.share is unreliable inside the Capacitor WebView, which
 *    is why "Share" used to silently copy text only.
 *  - googleSignIn(): native Google account picker (Credential Manager). It
 *    returns a Google ID token that the web layer exchanges for a Firebase
 *    session, so no firebaseapp.com handler page and no black screen.
 */
@CapacitorPlugin(name = "ApexNative")
public class ApexNativePlugin extends Plugin {

    @PluginMethod
    public void share(PluginCall call) {
        try {
            Context ctx = getContext();
            String title = call.getString("title", "");
            String text = call.getString("text", "");
            String url = call.getString("url", "");
            String fileBase64 = call.getString("fileBase64");
            String fileName = call.getString("fileName", "apex-share.png");
            String mime = call.getString("mimeType", "image/png");

            StringBuilder body = new StringBuilder();
            if (text != null && !text.isEmpty()) body.append(text);
            if (url != null && !url.isEmpty()) {
                if (body.length() > 0) body.append("\n");
                body.append(url);
            }

            Intent send = new Intent(Intent.ACTION_SEND);
            if (fileBase64 != null && !fileBase64.isEmpty()) {
                String clean = fileBase64;
                int comma = clean.indexOf(',');
                if (clean.startsWith("data:") && comma > 0) clean = clean.substring(comma + 1);
                byte[] bytes = Base64.decode(clean, Base64.DEFAULT);
                File dir = new File(ctx.getCacheDir(), "shared");
                if (!dir.exists()) dir.mkdirs();
                File out = new File(dir, fileName.replaceAll("[^A-Za-z0-9._-]", "_"));
                try (FileOutputStream fos = new FileOutputStream(out)) {
                    fos.write(bytes);
                }
                Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", out);
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                send.setType("text/plain");
            }
            if (body.length() > 0) send.putExtra(Intent.EXTRA_TEXT, body.toString());
            if (title != null && !title.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, title);

            Intent chooser = Intent.createChooser(send, title == null || title.isEmpty() ? "Share" : title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(chooser);
            call.resolve();
        } catch (Exception e) {
            call.reject("Share failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void googleSignIn(final PluginCall call) {
        final String serverClientId = call.getString("serverClientId");
        if (serverClientId == null || serverClientId.isEmpty()) {
            call.reject("missing-client-id");
            return;
        }
        try {
            GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(serverClientId).build();
            GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
            CredentialManager manager = CredentialManager.create(getContext());
            manager.getCredentialAsync(
                getActivity(),
                request,
                null,
                ContextCompat.getMainExecutor(getContext()),
                new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                    @Override
                    public void onResult(GetCredentialResponse result) {
                        Credential credential = result.getCredential();
                        if (credential instanceof CustomCredential
                            && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                            GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(credential.getData());
                            JSObject ret = new JSObject();
                            ret.put("idToken", google.getIdToken());
                            ret.put("email", google.getId());
                            ret.put("displayName", google.getDisplayName());
                            Uri pic = google.getProfilePictureUri();
                            ret.put("photoUrl", pic == null ? null : pic.toString());
                            call.resolve(ret);
                        } else {
                            call.reject("unsupported-credential");
                        }
                    }

                    @Override
                    public void onError(GetCredentialException e) {
                        if (e instanceof GetCredentialCancellationException) {
                            call.reject("cancelled");
                        } else {
                            call.reject(e.getType() + ": " + e.getMessage());
                        }
                    }
                }
            );
        } catch (Exception e) {
            call.reject("google-sign-in-failed: " + e.getMessage());
        }
    }

    // ---- voice coaching helpers ----------------------------------------------------------

    private AudioFocusRequest voiceFocusRequest;

    /**
     * Google Play in-app review. Play shows its own rating card over the app, or nothing at all if its quota
     * for this user is used up; the app is never told which, so this always resolves.
     */
    @PluginMethod
    public void requestReview(final PluginCall call) {
        try {
            final com.google.android.play.core.review.ReviewManager manager =
                com.google.android.play.core.review.ReviewManagerFactory.create(getContext());
            manager.requestReviewFlow().addOnCompleteListener(task -> {
                if (!task.isSuccessful() || getActivity() == null) { call.reject("Review is not available right now."); return; }
                manager.launchReviewFlow(getActivity(), task.getResult()).addOnCompleteListener(done -> call.resolve());
            });
        } catch (Exception e) {
            call.reject("Review is not available right now.");
        }
    }

    /**
     * App-scoped device id (ANDROID_ID): the same after a reinstall, different for every app signing key.
     * Used only so one phone cannot invite itself; the server stores a hash of it.
     */
    @PluginMethod
    public void deviceId(PluginCall call) {
        JSObject ret = new JSObject();
        String id = "";
        try {
            String v = android.provider.Settings.Secure.getString(getContext().getContentResolver(), android.provider.Settings.Secure.ANDROID_ID);
            if (v != null) id = v;
        } catch (Exception ignored) { }
        ret.put("id", id);
        call.resolve(ret);
    }

    /** True when the phone's ringer is on silent or vibrate, so the coach should stay quiet. */
    @PluginMethod
    public void audioState(PluginCall call) {
        JSObject ret = new JSObject();
        boolean silent = false;
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                int mode = am.getRingerMode();
                silent = mode == AudioManager.RINGER_MODE_SILENT || mode == AudioManager.RINGER_MODE_VIBRATE;
            }
        } catch (Exception ignored) { }
        ret.put("silent", silent);
        call.resolve(ret);
    }

    /** Asks other apps (music, podcasts) to lower their volume while the coach speaks, and gives it back after. */
    @PluginMethod
    public void voiceFocus(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                if (on) {
                    if (voiceFocusRequest == null) {
                        AudioAttributes attrs = new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build();
                        voiceFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                            .setAudioAttributes(attrs)
                            .setWillPauseWhenDucked(false)
                            .build();
                    }
                    am.requestAudioFocus(voiceFocusRequest);
                } else if (voiceFocusRequest != null) {
                    am.abandonAudioFocusRequest(voiceFocusRequest);
                }
            }
        } catch (Exception ignored) { }
        call.resolve();
    }
}
