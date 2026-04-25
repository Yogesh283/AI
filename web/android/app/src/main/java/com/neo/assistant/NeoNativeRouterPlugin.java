package com.neo.assistant;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.PermissionState;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "NeoNativeRouter",
    permissions = {
        @Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO}),
        @Permission(alias = "contacts", strings = {Manifest.permission.READ_CONTACTS})
    }
)
public class NeoNativeRouterPlugin extends Plugin {

    @PluginMethod
    public void setWakeScreenOffListen(PluginCall call) {
        Boolean on = call.getBoolean("enabled", false);
        NeoPrefs.setWakeListenScreenOff(getContext(), Boolean.TRUE.equals(on));
        call.resolve();
    }

    @PluginMethod
    public void getWakeScreenOffListen(PluginCall call) {
        JSObject o = new JSObject();
        o.put("enabled", NeoPrefs.isWakeListenScreenOff(getContext()));
        call.resolve(o);
    }

    @PluginMethod
    public void setWakePorcupineStream(PluginCall call) {
        Boolean on = call.getBoolean("enabled", false);
        NeoPrefs.setWakePorcupineStreamEnabled(getContext(), Boolean.TRUE.equals(on));
        call.resolve();
    }

    @PluginMethod
    public void getWakePorcupineStream(PluginCall call) {
        JSObject o = new JSObject();
        o.put("enabled", NeoPrefs.isWakePorcupineStreamEnabled(getContext()));
        call.resolve(o);
    }

    @PluginMethod
    public void setWakeVoiceChatMode(PluginCall call) {
        Boolean on = call.getBoolean("enabled", false);
        NeoPrefs.setWakeVoiceChatModeEnabled(getContext(), Boolean.TRUE.equals(on));
        call.resolve();
    }

    @PluginMethod
    public void getWakeVoiceChatMode(PluginCall call) {
        JSObject o = new JSObject();
        o.put("enabled", NeoPrefs.isWakeVoiceChatModeEnabled(getContext()));
        call.resolve(o);
    }

    @PluginMethod
    public void startWakeListener(PluginCall call) {
        Boolean so = call.getBoolean("screenOffListen", false);
        NeoPrefs.setWakeListenScreenOff(getContext(), Boolean.TRUE.equals(so));
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "onMicPermissionForWake");
            return;
        }
        JSObject out = new JSObject();
        boolean started = startWakeService(Boolean.TRUE.equals(so));
        out.put("started", started);
        if (!started) out.put("reason", "fgs-start-blocked");
        call.resolve(out);
    }

    @PermissionCallback
    private void onMicPermissionForWake(PluginCall call) {
        JSObject out = new JSObject();
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            out.put("started", false);
            out.put("reason", "record-audio-permission-missing");
            call.resolve(out);
            return;
        }
        Boolean so = call.getBoolean("screenOffListen", false);
        NeoPrefs.setWakeListenScreenOff(getContext(), Boolean.TRUE.equals(so));
        boolean started = startWakeService(Boolean.TRUE.equals(so));
        out.put("started", started);
        if (!started) out.put("reason", "fgs-start-blocked");
        call.resolve(out);
    }

    private boolean startWakeService(boolean screenOffListen) {
        Intent i = new Intent(getContext(), WakeWordForegroundService.class);
        i.setAction(WakeWordForegroundService.ACTION_START);
        i.putExtra(WakeWordForegroundService.EXTRA_SCREEN_OFF_LISTEN, screenOffListen);
        i.putExtra(
            WakeWordForegroundService.EXTRA_VOICE_CHAT_MODE,
            NeoPrefs.isWakeVoiceChatModeEnabled(getContext()));
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(getContext(), i);
            } else {
                getContext().startService(i);
            }
            return true;
        } catch (SecurityException ignored) {
            return false;
        }
    }

    @PluginMethod
    public void stopWakeListener(PluginCall call) {
        Intent i = new Intent(getContext(), WakeWordForegroundService.class);
        i.setAction(WakeWordForegroundService.ACTION_STOP);
        getContext().startService(i);
        call.resolve();
    }

    @PluginMethod
    public void openAppPath(PluginCall call) {
        String path = call.getString("path", "/profile");
        if (path == null || path.trim().isEmpty()) {
            path = "/profile";
        }
        path = path.trim();
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        if (!path.matches("^/[a-zA-Z0-9/_-]+$")) {
            path = "/profile";
        }
        Intent i = new Intent(getContext(), MainActivity.class);
        i.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        i.putExtra(MainActivity.EXTRA_NEO_NAV_PATH, path);
        i.setPackage(getContext().getPackageName());
        getContext().startActivity(i);
        call.resolve();
    }

    /**
     * Opens {@code whatsapp://}, {@code tg://}, {@code tel:}, {@code content://…contacts…}, etc. via
     * {@link Intent#ACTION_VIEW}. WebView {@code window.location} to those schemes often shows “invalid link”.
     */
    @PluginMethod
    public void openDeepLink(PluginCall call) {
        String raw = call.getString("url");
        if (raw == null || raw.trim().isEmpty()) {
            call.reject("missing_url");
            return;
        }
        Uri uri;
        try {
            uri = Uri.parse(raw.trim());
        } catch (Exception e) {
            call.reject("bad_url", e);
            return;
        }
        if (!isAllowedExternalViewUri(uri)) {
            call.reject("disallowed_scheme");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        try {
            Activity act = getActivity();
            if (act != null) {
                act.startActivity(intent);
            } else {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            }
            JSObject out = new JSObject();
            out.put("opened", true);
            call.resolve(out);
        } catch (ActivityNotFoundException e) {
            JSObject out = new JSObject();
            out.put("opened", false);
            out.put("reason", "no_activity");
            call.resolve(out);
        } catch (SecurityException e) {
            JSObject out = new JSObject();
            out.put("opened", false);
            out.put("reason", "security");
            call.resolve(out);
        }
    }

    private static boolean isAllowedExternalViewUri(Uri u) {
        if (u == null) return false;
        String scheme = u.getScheme();
        if (scheme == null) return false;
        String s = scheme.toLowerCase();
        if ("whatsapp".equals(s) || "tg".equals(s) || "tel".equals(s) || "intent".equals(s)) {
            return true;
        }
        if ("vnd.youtube".equals(s)) {
            return true;
        }
        if ("content".equals(s)) {
            String auth = u.getAuthority();
            return auth != null && auth.contains("contacts");
        }
        return false;
    }

    @PluginMethod
    public void tryRouteCommand(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.trim().isEmpty()) {
            JSObject out = new JSObject();
            out.put("handled", false);
            call.resolve(out);
            return;
        }
        if (commandLikelyNeedsContacts(text) && getPermissionState("contacts") != PermissionState.GRANTED) {
            requestPermissionForAlias("contacts", call, "onContactsPermissionForRoute");
            return;
        }
        boolean handled = NeoCommandRouter.execute(getContext(), text);
        JSObject out = new JSObject();
        out.put("handled", handled);
        call.resolve(out);
    }

    @PermissionCallback
    private void onContactsPermissionForRoute(PluginCall call) {
        JSObject out = new JSObject();
        String text = call.getString("text", "");
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            out.put("handled", false);
            out.put("reason", "contacts-permission-missing");
            call.resolve(out);
            return;
        }
        boolean handled = NeoCommandRouter.execute(getContext(), text);
        out.put("handled", handled);
        call.resolve(out);
    }

    /**
     * Runtime permission gate for commands that resolve a person name from phone contacts.
     * Digits-only dial commands do not need contacts.
     */
    private boolean commandLikelyNeedsContacts(String raw) {
        if (raw == null) return false;
        String t = raw.toLowerCase().replaceAll("\\s+", " ").trim();
        if (t.isEmpty()) return false;
        boolean hasLongDigits = t.matches(".*\\d{5,}.*");
        boolean callByName =
            (t.matches(".*\\b(call|dial|phone|ring)\\b.*") || t.contains("कॉल") || t.contains("फोन"))
                && !hasLongDigits;
        boolean messengerByName =
            (t.contains("whatsapp")
                || t.contains("telegram")
                || t.contains("व्हाट्स")
                || t.contains("टेली")
                || t.contains("मैसेज")
                || t.contains("संदेश"))
                && (t.contains("ढूंढ")
                    || t.contains("खोज")
                    || t.contains("find")
                    || t.contains("search")
                    || t.contains("message")
                    || t.contains("send")
                    || t.contains("text")
                    || t.contains("को"));
        return callByName || messengerByName;
    }
}
