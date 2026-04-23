package com.neo.assistant;

import android.content.Context;

/** Shared prefs read by MainActivity + WakeWordForegroundService (wake / screen-off mode). */
public final class NeoPrefs {
    public static final String FILE = "neo_prefs";
    public static final String KEY_WAKE_SCREEN_OFF = "wake_listen_screen_off";
    /** When true and Picovoice assets + PV_ACCESS_KEY are present, wake uses AudioRecord + Porcupine. */
    public static final String KEY_WAKE_PORCUPINE_STREAM = "wake_porcupine_stream";
    /** Latest WhatsApp notification line (title + text) when {@link NeoNotificationListenerService} is enabled. */
    public static final String KEY_LAST_WA_SNIPPET = "last_wa_notif_snippet";
    /** Relative to assets/ (Picovoice Console → Android keyword). */
    public static final String KEY_PORCUPINE_KEYWORD_ASSET = "porcupine_keyword_asset";

    private NeoPrefs() {}

    public static boolean isWakeListenScreenOff(Context c) {
        return c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getBoolean(KEY_WAKE_SCREEN_OFF, false);
    }

    public static void setWakeListenScreenOff(Context c, boolean on) {
        c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_WAKE_SCREEN_OFF, on)
            .apply();
    }

    public static boolean isWakePorcupineStreamEnabled(Context c) {
        return c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getBoolean(KEY_WAKE_PORCUPINE_STREAM, false);
    }

    public static void setWakePorcupineStreamEnabled(Context c, boolean on) {
        c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_WAKE_PORCUPINE_STREAM, on)
            .apply();
    }

    /** Default {@code porcupine/hello_neo.ppn}; override via prefs if you ship multiple keywords. */
    public static String getPorcupineKeywordAssetPath(Context c) {
        String p =
            c.getApplicationContext()
                .getSharedPreferences(FILE, Context.MODE_PRIVATE)
                .getString(KEY_PORCUPINE_KEYWORD_ASSET, null);
        if (p != null && !p.trim().isEmpty()) {
            return p.trim();
        }
        return "porcupine/hello_neo.ppn";
    }

    public static void setPorcupineKeywordAssetPath(Context c, String relativeAssetPath) {
        c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_PORCUPINE_KEYWORD_ASSET, relativeAssetPath == null ? "" : relativeAssetPath.trim())
            .apply();
    }

    public static void setLastWhatsAppNotification(Context c, String line) {
        if (line == null) line = "";
        c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_WA_SNIPPET, line)
            .apply();
    }

    public static String getLastWhatsAppNotification(Context c) {
        return c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getString(KEY_LAST_WA_SNIPPET, "");
    }
}
