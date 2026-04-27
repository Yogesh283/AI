package com.neo.assistant;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Toast;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

    /** Voice / plugin: navigate the WebView to this path on the current origin (e.g. {@code /profile}). */
    public static final String EXTRA_NEO_NAV_PATH = "neo_nav_path";

    /**
     * Wake / FGS path: {@link NeoCommandRouter} cannot start other apps from a {@link android.app.Service} on
     * Android 14+ (BAL). Spec is consumed in {@link #onResume} so the deep link runs from a resumed activity.
     */
    public static final String EXTRA_VOICE_EXTERNAL_SPEC = "neo_voice_external_spec";
    /** Android allows only one runtime permission sheet at a time. */
    private boolean permissionPromptInFlight = false;

    /**
     * Parsed once from {@code assets/capacitor.config.json}. When true, do not auto-start
     * {@link WakeWordForegroundService} from {@link #onResume} — the Web bundle calls
     * {@code syncNativeWakeBridge} after load. Avoids FGS + {@link android.media.AudioRecord} racing WebView/EGL
     * teardown on the Capacitor {@code error.html} path (FORTIFY / destroyed mutex on some Mali builds).
     */
    private Boolean localCapacitorServer;

    /** One-shot delayed check: still on Capacitor error page while using local server.url → logcat + debug toast. */
    private boolean neoDevHelpProbeScheduled;
    private boolean neoDevHelpAlreadySignaled;

    private static final String TAG_DEV_HELP = "NeoDevHelp";

    /** Queue opening WA/TG/etc. from the foreground activity (BAL-safe). {@code spec} keys are owned by {@link NeoCommandRouter}. */
    public static void requestVoiceExternalLaunch(Context from, Bundle spec) {
        if (from == null || spec == null) {
            return;
        }
        Intent i = new Intent(from, MainActivity.class);
        i.putExtra(EXTRA_VOICE_EXTERNAL_SPEC, spec);
        i.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        i.setPackage(from.getPackageName());
        try {
            from.startActivity(i);
        } catch (Throwable ignored) {
        }
    }

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
        /* Do not stop wake here — onCreate runs on cold start and on activity recreate. Stop from onStop / plugin. */
        // Bridge may exist before first resume — allow media playback ASAP for TTS MP3.
        View decor = getWindow().getDecorView();
        decor.post(this::configureWebViewForVoice);
        decor.postDelayed(this::configureWebViewForVoice, 300);
        scheduleNeoDevHelpProbeOnce(decor);
    }

    private void scheduleNeoDevHelpProbeOnce(View decor) {
        if (neoDevHelpProbeScheduled) {
            return;
        }
        neoDevHelpProbeScheduled = true;
        decor.postDelayed(this::maybeLogNeoDevServerUnreachable, 4500);
    }

    private void maybeLogNeoDevServerUnreachable() {
        if (neoDevHelpAlreadySignaled) {
            return;
        }
        if (isFinishing()) {
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && isDestroyed()) {
            return;
        }
        if (!usesLocalCapacitorServer()) {
            return;
        }
        try {
            Bridge bridge = getBridge();
            if (bridge == null) {
                return;
            }
            WebView wv = bridge.getWebView();
            if (wv == null) {
                return;
            }
            String u = wv.getUrl();
            if (u == null) {
                return;
            }
            if (!u.contains("error.html") && !u.contains("chrome-error")) {
                return;
            }
            neoDevHelpAlreadySignaled = true;
            Log.e(
                    TAG_DEV_HELP,
                    "WebView still on Capacitor error page — PC dev server not reached at server.url. "
                        + "Fix: (1) PC cd web && npm run dev — leave running. "
                        + "(2) USB adb reverse tcp:3000 tcp:3000 (re-run after cable replug). "
                        + "(3) From web: npm run android:local or cap:sync:android:local then Rebuild. "
                        + "(4) Wi-Fi: npm run android:local:wifi — same LAN, firewall allow Node:3000. "
                        + "Filter: adb logcat -s NeoDevHelp:E");
            if (BuildConfig.DEBUG) {
                Toast.makeText(
                                this,
                                "Dev server unreachable — filter logcat: NeoDevHelp",
                                Toast.LENGTH_LONG)
                        .show();
            }
        } catch (Throwable ignored) {
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        /*
         * Voice → WhatsApp/Telegram is queued via EXTRA_VOICE_EXTERNAL_SPEC while this activity is already
         * foreground (singleTop). onResume may not re-run before the user expects the app to open — consume here.
         */
        NeoCommandRouter.consumeVoiceExternalLaunchSpec(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        NeoCommandRouter.consumeVoiceExternalLaunchSpec(this);
        flushVoiceNavigationPath();
        /*
         * Do not start RECORD_AUDIO (or other) permission flows here — returning from Google Sign-In
         * runs onResume; overlapping dialogs surface as "The user canceled the sign-in flow."
         */
        /* Wake restart is gated by Profile + WebView bridge; foreground rules apply (see onStop). */
        // WebView: allow TTS / Web Audio without an extra user gesture (fixes silent voice on many APK builds).
        View decor = getWindow().getDecorView();
        decor.post(this::configureWebViewForVoice);
        decor.postDelayed(this::configureWebViewForVoice, 400);
        /*
         * Do not auto-pop runtime permission sheets on resume.
         * Request READ_CONTACTS / CALL_PHONE only when the user invokes features that need them.
         * This avoids pause/resume churn and WebView bridge instability on startup.
         */
        /*
         * Bring wake listener back whenever app returns to foreground (after opening WhatsApp/Telegram/etc).
         * Local dev server (127.0.0.1 / localhost in capacitor.config): never auto-start here — the loaded app
         * calls NeoNativeRouter.startWakeListener via neoWakeNative. Starting FGS + mic while WebView is still on
         * error.html or failing EGL init correlates with libc FORTIFY / destroyed mutex on some devices.
         */
        Runnable startWake = this::maybeStartWakeServiceForForeground;
        if (usesLocalCapacitorServer()) {
            /* Wake starts from JS after Next.js (or production) actually loads. */
        } else if (BuildConfig.DEBUG) {
            decor.postDelayed(startWake, 2800);
        } else {
            decor.post(startWake);
        }
    }

    private boolean usesLocalCapacitorServer() {
        if (localCapacitorServer != null) {
            return localCapacitorServer;
        }
        boolean local = false;
        try (InputStream in = getAssets().open("capacitor.config.json")) {
            byte[] buf = new byte[8192];
            int n = in.read(buf);
            if (n > 0) {
                String s = new String(buf, 0, n, StandardCharsets.UTF_8);
                local =
                    s.contains("127.0.0.1")
                        || s.contains("localhost")
                        || s.contains("10.0.2.2");
            }
        } catch (Throwable ignored) {
        }
        localCapacitorServer = local;
        return local;
    }

    private void maybeRequestReadContactsOnce() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return;
        }
        if (permissionPromptInFlight) {
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
        permissionPromptInFlight = true;
        ActivityCompat.requestPermissions(this, new String[] {Manifest.permission.READ_CONTACTS}, 4401);
    }

    private void maybeRequestCallPhoneOnce() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return;
        }
        if (permissionPromptInFlight) {
            return;
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE)
                == PackageManager.PERMISSION_GRANTED) {
            return;
        }
        if (NeoPrefs.hasPromptedCallPhone(this)) {
            return;
        }
        NeoPrefs.setPromptedCallPhone(this, true);
        permissionPromptInFlight = true;
        ActivityCompat.requestPermissions(this, new String[] {Manifest.permission.CALL_PHONE}, 4402);
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
            /* Local dev: software layer avoids Mali/ANGLE eglCreateSync teardown crashes with error.html. */
            if (usesLocalCapacitorServer()) {
                wv.setLayerType(View.LAYER_TYPE_SOFTWARE, null);
            }
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
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        /*
         * User deliberately left Neo (Home, Recents, switch app) — never listen in the background.
         */
        maybeStopWakeService();
    }

    @Override
    public void onStop() {
        super.onStop();
        /*
         * Screen off / keyguard while Neo was open does not always fire onUserLeaveHint. If the user enabled
         * screen-off listen or wake voice-chat, keep the foreground wake service so “Hello Neo” voice chat can
         * still run after the wake word. Otherwise stop — no pocket / idle listening without that contract.
         */
        if (!NeoPrefs.isWakeListenScreenOff(this) && !NeoPrefs.isWakeVoiceChatModeEnabled(this)) {
            maybeStopWakeService();
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == 4401 || requestCode == 4402) {
            permissionPromptInFlight = false;
            View decor = getWindow().getDecorView();
            /* Chain pending one-time prompts after the current sheet closes. */
            decor.postDelayed(this::maybeRequestReadContactsOnce, 250);
            decor.postDelayed(this::maybeRequestCallPhoneOnce, 500);
        }
    }

    private void maybeStopWakeService() {
        Intent service = new Intent(this, WakeWordForegroundService.class);
        service.setAction(WakeWordForegroundService.ACTION_STOP);
        startService(service);
    }

    private void maybeStartWakeServiceForForeground() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        Intent service = new Intent(this, WakeWordForegroundService.class);
        service.setAction(WakeWordForegroundService.ACTION_START);
        /* Respect settings: screen-off wake only when user enabled it in the app. */
        service.putExtra(
            WakeWordForegroundService.EXTRA_SCREEN_OFF_LISTEN, NeoPrefs.isWakeListenScreenOff(this));
        service.putExtra(
            WakeWordForegroundService.EXTRA_VOICE_CHAT_MODE,
            NeoPrefs.isWakeVoiceChatModeEnabled(this));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(this, service);
        } else {
            startService(service);
        }
    }
}
