package com.neo.assistant;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NeoNativeRouterPlugin.class);
        super.onCreate(savedInstanceState);
        /* Apply UA / cookies before first paint so the initial request to server.url is not stuck with "; wv". */
        configureWebViewForVoice();
        /*
         * Do NOT auto-request RECORD_AUDIO here. Any runtime permission sheet can sit on top of
         * Google's Credential Manager and surface as "The user canceled the sign-in flow."
         * Mic is requested when the user actually uses voice / speech features (or grant from system Settings).
         */
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
         * Do not start RECORD_AUDIO (or other) permission flows here — returning from Google Sign-In
         * runs onResume; overlapping dialogs surface as "The user canceled the sign-in flow."
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

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    private void maybeStopWakeService() {
        Intent service = new Intent(this, WakeWordForegroundService.class);
        service.setAction(WakeWordForegroundService.ACTION_STOP);
        startService(service);
    }
}
