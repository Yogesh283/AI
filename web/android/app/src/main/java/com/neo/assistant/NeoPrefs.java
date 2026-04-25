package com.neo.assistant;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;

/** Shared prefs read by MainActivity + WakeWordForegroundService (wake / screen-off mode). */
public final class NeoPrefs {
    public static final String FILE = "neo_prefs";
    public static final String KEY_WAKE_SCREEN_OFF = "wake_listen_screen_off";
    /** When true and Picovoice assets + PV_ACCESS_KEY are present, wake uses AudioRecord + Porcupine. */
    public static final String KEY_WAKE_PORCUPINE_STREAM = "wake_porcupine_stream";
    /** Separate wake voice chat mode (OpenAI reply over TTS) independent of command router mode. */
    public static final String KEY_WAKE_VOICE_CHAT_MODE = "wake_voice_chat_mode";
    /** Latest WhatsApp notification line (title + text) when {@link NeoNotificationListenerService} is enabled. */
    public static final String KEY_LAST_WA_SNIPPET = "last_wa_notif_snippet";
    /** Ring buffer JSON: [{app,title,text,ts}, …] newest first — WhatsApp + Telegram previews for voice “read for …”. */
    public static final String KEY_MSG_NOTIF_LOG = "messenger_notif_log_v1";
    private static final int MSG_NOTIF_LOG_MAX = 24;
    /** Last voice-selected chat target for “इसे संदेश भेजो …” (digits only, country code included, no +). */
    public static final String KEY_VOICE_COMPOSE_APP = "voice_compose_app";
    public static final String KEY_VOICE_COMPOSE_PHONE = "voice_compose_phone_digits";
    public static final String KEY_VOICE_COMPOSE_LABEL = "voice_compose_label";
    /** Last app context from voice flow (e.g. wa/tg/contacts/youtube) for short follow-up commands. */
    public static final String KEY_LAST_VOICE_APP_CONTEXT = "last_voice_app_context";
    /** One-time runtime prompt for {@link android.Manifest.permission#READ_CONTACTS} (call-by-name from voice). */
    public static final String KEY_PROMPTED_READ_CONTACTS = "prompted_read_contacts";
    /** Relative to assets/ (Picovoice Console → Android keyword). */
    public static final String KEY_PORCUPINE_KEYWORD_ASSET = "porcupine_keyword_asset";

    private NeoPrefs() {}

    public static boolean isWakeListenScreenOff(Context c) {
        /* Screen-on-only voice policy: default OFF for screen-off listening. */
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
            /*
             * Default ON: AudioRecord + Porcupine keeps a steadier wake path than repeated SpeechRecognizer
             * relistens, reducing OEM mic "tun" cues on many devices.
             */
            .getBoolean(KEY_WAKE_PORCUPINE_STREAM, true);
    }

    public static void setWakePorcupineStreamEnabled(Context c, boolean on) {
        c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_WAKE_PORCUPINE_STREAM, on)
            .apply();
    }

    public static boolean isWakeVoiceChatModeEnabled(Context c) {
        return c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getBoolean(KEY_WAKE_VOICE_CHAT_MODE, true);
    }

    public static void setWakeVoiceChatModeEnabled(Context c, boolean on) {
        c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_WAKE_VOICE_CHAT_MODE, on)
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

    public static boolean hasPromptedReadContacts(Context c) {
        return c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getBoolean(KEY_PROMPTED_READ_CONTACTS, false);
    }

    public static void setPromptedReadContacts(Context c, boolean prompted) {
        c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_PROMPTED_READ_CONTACTS, prompted)
            .apply();
    }

    public static JSONArray getMessengerNotifLog(Context c) {
        try {
            String s =
                c.getApplicationContext()
                    .getSharedPreferences(FILE, Context.MODE_PRIVATE)
                    .getString(KEY_MSG_NOTIF_LOG, "[]");
            return new JSONArray(s);
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    /** Append newest-first ring buffer for WhatsApp ({@code wa}) and Telegram ({@code tg}) notification previews. */
    public static void appendMessengerNotif(Context c, String app, CharSequence title, CharSequence text) {
        if (app == null || app.isEmpty()) {
            return;
        }
        String t = title == null ? "" : title.toString().trim();
        String x = text == null ? "" : text.toString().trim();
        SharedPreferences p = c.getApplicationContext().getSharedPreferences(FILE, Context.MODE_PRIVATE);
        try {
            JSONArray arr = new JSONArray(p.getString(KEY_MSG_NOTIF_LOG, "[]"));
            JSONObject o = new JSONObject();
            o.put("app", app);
            o.put("title", t);
            o.put("text", x);
            o.put("ts", System.currentTimeMillis());
            JSONArray next = new JSONArray();
            next.put(o);
            for (int i = 0; i < arr.length() && i < MSG_NOTIF_LOG_MAX - 1; i++) {
                next.put(arr.getJSONObject(i));
            }
            p.edit().putString(KEY_MSG_NOTIF_LOG, next.toString()).apply();
        } catch (Exception ignored) {
        }
        if ("wa".equals(app)) {
            StringBuilder sb = new StringBuilder();
            if (!t.isEmpty()) {
                sb.append(t);
            }
            if (!x.isEmpty()) {
                if (sb.length() > 0) sb.append(" — ");
                sb.append(x);
            }
            String line = sb.toString().trim();
            if (line.length() > 400) {
                line = line.substring(0, 397) + "...";
            }
            if (!line.isEmpty()) {
                setLastWhatsAppNotification(c, line);
            }
        }
    }

    public static void setVoiceComposeTarget(Context c, String app, String phoneDigits, String label) {
        if (app == null) {
            app = "";
        }
        if (phoneDigits == null) {
            phoneDigits = "";
        }
        if (label == null) {
            label = "";
        }
        c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_VOICE_COMPOSE_APP, app)
            .putString(KEY_VOICE_COMPOSE_PHONE, phoneDigits.replaceAll("\\D", ""))
            .putString(KEY_VOICE_COMPOSE_LABEL, label.trim())
            .apply();
    }

    public static void clearVoiceComposeTarget(Context c) {
        setVoiceComposeTarget(c, "", "", "");
    }

    public static String getVoiceComposeApp(Context c) {
        return c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getString(KEY_VOICE_COMPOSE_APP, "");
    }

    public static String getVoiceComposePhoneDigits(Context c) {
        return c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getString(KEY_VOICE_COMPOSE_PHONE, "");
    }

    public static String getVoiceComposeLabel(Context c) {
        return c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getString(KEY_VOICE_COMPOSE_LABEL, "");
    }

    public static void setLastVoiceAppContext(Context c, String appContext) {
        if (appContext == null) {
            appContext = "";
        }
        c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_VOICE_APP_CONTEXT, appContext.trim())
            .apply();
    }

    public static String getLastVoiceAppContext(Context c) {
        return c.getApplicationContext()
            .getSharedPreferences(FILE, Context.MODE_PRIVATE)
            .getString(KEY_LAST_VOICE_APP_CONTEXT, "");
    }
}
