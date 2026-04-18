package com.neo.assistant;

import android.content.Context;

/** Shared prefs read by MainActivity + WakeWordForegroundService (wake / screen-off mode). */
public final class NeoPrefs {
    public static final String FILE = "neo_prefs";
    public static final String KEY_WAKE_SCREEN_OFF = "wake_listen_screen_off";

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
}
