package com.neo.assistant;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

public class MainActivity extends BridgeActivity {

    /** Voice / plugin: navigate the WebView to this path on the current origin (e.g. {@code /profile}). */
    public static final String EXTRA_NEO_NAV_PATH = "neo_nav_path";

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
        /* Do not stop wake here — onCreate runs on cold start and on activity recreate; stopping killed voice before
         * the WebView could call NeoNativeRouter.startWakeListener again. Stop only from onPause policy or plugin. */
        // Bridge may exist before first resume — allow media playback ASAP for TTS MP3.
        View decor = getWindow().getDecorView();
        decor.post(this::configureWebViewForVoice);
        decor.postDelayed(this::configureWebViewForVoice, 300);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        flushVoiceNavigationPath();
        /*
         * Do not start RECORD_AUDIO (or other) permission flows here — returning from Google Sign-In
         * runs onResume; overlapping dialogs surface as "The user canceled the sign-in flow."
         */
        /* Do not stop wake here — onResume runs after unlock; killing wake prevented lock-screen Hello Neo. */
        // WebView: allow TTS / Web Audio without an extra user gesture (fixes silent voice on many APK builds).
        View decor = getWindow().getDecorView();
        decor.post(this::configureWebViewForVoice);
        decor.postDelayed(this::configureWebViewForVoice, 400);
        /* READ_CONTACTS: delayed so it does not stack on top of Google Sign-In on cold start; one prompt only. */
        decor.postDelayed(this::maybeRequestReadContactsOnce, 1600);
    }

    private void maybeRequestReadContactsOnce() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return;
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS)
                == PackageManager.PERMISSION_GRANTED) {
            return;
        }
        if (NeoPrefs.hasPromptedReadContacts(this)) {
            return;
        }
        NeoPrefs.setPromptedReadContacts(this, true);
        ActivityCompat.requestPermissions(this, new String[] {Manifest.permission.READ_CONTACTS}, 4401);
    }

    /** Applies {@link #EXTRA_NEO_NAV_PATH} from the launch intent (voice “open my profile”). */
    private void flushVoiceNavigationPath() {
        Intent i = getIntent();
        if (i == null) return;
        String path = i.getStringExtra(EXTRA_NEO_NAV_PATH);
        if (path == null || path.trim().isEmpty()) return;
        i.removeExtra(EXTRA_NEO_NAV_PATH);
        String p = path.trim();
        if (!p.startsWith("/")) {
            p = "/" + p;
        }
        if (!p.matches("^/[a-zA-Z0-9/_-]+$")) {
            p = "/profile";
        }
        final String dest = p;
        View decor = getWindow().getDecorView();
        Runnable go =
            () -> {
                try {
                    Bridge bridge = getBridge();
                    if (bridge == null) return;
                    WebView wv = bridge.getWebView();
                    if (wv == null) return;
                    String q = org.json.JSONObject.quote(dest);
                    wv.evaluateJavascript(
                        "(function(){try{var p="
                            + q
                            + ";window.location.assign(window.location.origin+p);}catch(e){}})();",
                        null
                    );
                } catch (Throwable ignored) {
                }
            };
        decor.post(go);
        decor.postDelayed(go, 450);
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
            attachWebRtcMicChromeClient(wv, bridge);
        } catch (Throwable ignored) {
        }
    }

    /**
     * WebView getUserMedia (OpenAI Live / WebRTC): if RECORD_AUDIO is already granted, grant the
     * WebView permission immediately. Otherwise Capacitor’s launcher flow runs (can stall if
     * another system dialog was showing — common on APK right after Google Sign-In).
     */
    private void attachWebRtcMicChromeClient(WebView wv, Bridge bridge) {
        if (wv.getWebChromeClient() instanceof NeoBridgeWebChromeClient) {
            return;
        }
        wv.setWebChromeClient(new NeoBridgeWebChromeClient(bridge));
    }

    private final class NeoBridgeWebChromeClient extends BridgeWebChromeClient {

        NeoBridgeWebChromeClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) {
                request.deny();
                return;
            }
            for (String res : request.getResources()) {
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(res)) {
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                            == PackageManager.PERMISSION_GRANTED) {
                        request.grant(request.getResources());
                        return;
                    }
                }
            }
            super.onPermissionRequest(request);
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
