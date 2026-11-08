package com.homefitnesscoach.app;

import android.content.Context;
import android.content.Intent;
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
}
