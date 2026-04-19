package com.neo.assistant;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int REQ_MIC = 2101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NeoNativeRouterPlugin.class);
        super.onCreate(savedInstanceState);
        /* Apply UA / cookies before first paint so the initial request to server.url is not stuck with "; wv". */
        configureWebViewForVoice();
        /*
         * Defer mic so it never stacks on Credential Manager / "Continue with Google".
         * 2s was still too early for slow networks; 15s keeps login/register usable first.
         * Voice / SpeechRecognition still request mic when the user opens those flows.
         */
        getWindow().getDecorView().postDelayed(this::ensureMicPermission, 15000);
        maybeStopWakeService();
        // Bridge may exist before first resume — allow media playback ASAP for TTS MP3.
        View decor = getWindow().getDecorView();
        decor.post(this::configureWebViewForVoice);
        decor.postDelayed(this::configureWebViewForVoice, 300);
    }

    @Override
    public void onResume() {
        super.onResume();
        /*
         * Do NOT call ensureMicPermission() here. Returning from Google Sign-In / Credential Manager
         * runs onResume; starting RECORD_AUDIO requestPermissions() again can interrupt that flow and
         * surface as "The user canceled the sign-in flow." Mic is requested once from onCreate.
         */
        /* Do not stop wake here — onResume runs after unlock; killing wake prevented lock-screen Hello Neo. */
        // WebView: allow TTS / Web Audio without an extra user gesture (fixes silent voice on many APK builds).
        View decor = getWindow().getDecorView();
        decor.post(this::configureWebViewForVoice);
        decor.postDelayed(this::configureWebViewForVoice, 400);
    }

    /** TTS (no gesture) + Google Sign-In iframe (accounts.google.com cookies in WebView). */
    private void configureWebViewForVoice() {
        try {
            Bridge bridge = getBridge();
            if (bridge == null) return;
            WebView wv = bridge.getWebView();
            if (wv == null) return;
            WebSettings s = wv.getSettings();
            s.setMediaPlaybackRequiresUserGesture(false);
            s.setDomStorageEnabled(true);
            s.setCacheMode(WebSettings.LOAD_DEFAULT);
            /* GIS / OAuth: child windows often open Chrome and strand the user on accounts.google.com/gsi/tr */
            s.setSupportMultipleWindows(false);
            CookieManager cm = CookieManager.getInstance();
            cm.setAcceptCookie(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                cm.setAcceptThirdPartyCookies(wv, true);
            }
            /* GIS “Sign in with Google” often skips renderButton when UA contains “; wv” (embedded WebView marker). */
            String ua = s.getUserAgentString();
            if (ua != null && ua.contains("; wv")) {
                s.setUserAgentString(ua.replace("; wv", ""));
            }
        } catch (Throwable ignored) {
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        /*
         * Default: stop native wake when leaving the activity (other app / lock) — avoids pocket noise.
         * If user enabled “listen when screen is off”, keep the foreground wake service running while locked.
         */
        if (!NeoPrefs.isWakeListenScreenOff(this)) {
            maybeStopWakeService();
        }
    }

    private void ensureMicPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.RECORD_AUDIO },
                REQ_MIC
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_MIC) return;
        /* Mic permission does not auto-start background wake listener (see onPause). */
    }

    private void maybeStopWakeService() {
        Intent service = new Intent(this, WakeWordForegroundService.class);
        service.setAction(WakeWordForegroundService.ACTION_STOP);
        startService(service);
    }
}
