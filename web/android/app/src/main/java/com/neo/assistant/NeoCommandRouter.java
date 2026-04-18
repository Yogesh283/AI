package com.neo.assistant;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.ContactsContract;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import androidx.core.content.ContextCompat;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class NeoCommandRouter {
    private static TextToSpeech tts;
    private static boolean ttsReady = false;
    private static String pendingSpeech;
    private static final Handler busyAckHandler = new Handler(Looper.getMainLooper());
    private static Runnable pendingBusyRunnable;

    private NeoCommandRouter() {}

    static boolean execute(Context context, String raw) {
        busyAckHandler.removeCallbacksAndMessages(null);
        pendingBusyRunnable = null;

        String text = normalize(raw);
        if (text.isEmpty()) return false;
        if (isReadMessagesIntent(text)) {
            speak(context, explainCantReadMessages());
            return true;
        }
        String digits = extractDigits(text);

        if (isTimeIntent(text)) {
            speakTimeCalm(context, raw);
            return true;
        }

        if (isVolumeIntent(text)) {
            return handleVolumeIntent(context, text);
        }

        if (isContactsIntent(text)) {
            speakThen(
                context,
                calmOpenContactsPhrase(raw),
                1400,
                () -> openContactsApp(context));
            return true;
        }

        if (isYouTubeMusicLaunchIntent(text)) {
            if (context.getPackageManager().getLaunchIntentForPackage("com.google.android.apps.youtube.music") != null) {
                speakThen(
                    context,
                    calmOpenMusicPhrase(raw),
                    1450,
                    () -> {
                        Intent launch =
                            context.getPackageManager()
                                .getLaunchIntentForPackage("com.google.android.apps.youtube.music");
                        if (launch != null) {
                            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            try {
                                context.startActivity(launch);
                            } catch (ActivityNotFoundException ignored) {
                            }
                        }
                    });
                return true;
            }
        }

        String ytQuery = extractYouTubeQuery(text);
        if (ytQuery != null) {
            final String q = ytQuery;
            speakThen(
                context,
                calmOpenYouTubePhrase(raw),
                1500,
                () ->
                    openPreferredAppThenStore(
                        context,
                        new String[] {"com.google.android.youtube"},
                        Uri.parse("vnd.youtube:results?search_query=" + Uri.encode(q)),
                        "com.google.android.youtube"));
            return true;
        }

        if (isWhatsAppIntent(text)) {
            Uri appUri =
                digits != null
                    ? Uri.parse("whatsapp://send?phone=" + digits)
                    : Uri.parse("whatsapp://send");
            speakThen(
                context,
                calmOpenWhatsAppPhrase(raw),
                1550,
                () ->
                    openPreferredAppThenStore(
                        context,
                        new String[] {"com.whatsapp", "com.whatsapp.w4b"},
                        appUri,
                        "com.whatsapp"));
            return true;
        }

        if (isTelegramIntent(text)) {
            Uri appUri =
                digits != null
                    ? Uri.parse("tg://resolve?phone=%2B" + digits)
                    : Uri.parse("tg://");
            speakThen(
                context,
                calmOpenTelegramPhrase(raw),
                1550,
                () ->
                    openPreferredAppThenStore(
                        context,
                        new String[] {"org.telegram.messenger", "org.thunderdog.challegram"},
                        appUri,
                        "org.telegram.messenger"));
            return true;
        }

        String tel = extractTel(text);
        if (tel != null) {
            final String telUri = tel;
            speakThen(
                context,
                calmCallPhrase(raw),
                1250,
                () -> startTelIntent(context, telUri));
            return true;
        }

        return false;
    }

    private static void startTelIntent(Context context, String tel) {
        Intent callIntent;
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE)
            == PackageManager.PERMISSION_GRANTED) {
            callIntent = new Intent(Intent.ACTION_CALL, Uri.parse(tel));
        } else {
            callIntent = new Intent(Intent.ACTION_DIAL, Uri.parse(tel));
        }
        callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(callIntent);
        } catch (ActivityNotFoundException ignored) {
        }
    }

    private static boolean preferHindiVoice(String raw) {
        if (raw == null) return "hi".equals(Locale.getDefault().getLanguage());
        return "hi".equals(Locale.getDefault().getLanguage())
            || raw.matches("(?s).*[\\u0900-\\u097F].*");
    }

    private static void speakTimeCalm(Context context, String raw) {
        String t = formatTimeNow();
        boolean hi = preferHindiVoice(raw);
        String msg =
            hi
                ? "जी, आपके फोन पर अभी का समय " + t + " है।"
                : "Alright — right now, the time is " + t + ".";
        speak(context, msg);
    }

    private static String calmOpenWhatsAppPhrase(String raw) {
        return preferHindiVoice(raw)
            ? "जी, व्हाट्सऐप आपके लिए खोल रहे हैं — एक छोटा सा पल।"
            : "Sure — I am opening WhatsApp for you, just a moment.";
    }

    private static String calmOpenTelegramPhrase(String raw) {
        return preferHindiVoice(raw)
            ? "जी, टेलीग्राम खोल रहे हैं — एक पल।"
            : "Sure — opening Telegram for you, one moment.";
    }

    private static String calmOpenYouTubePhrase(String raw) {
        return preferHindiVoice(raw)
            ? "जी, यूट्यूब खोल रहे हैं — एक पल।"
            : "Sure — opening YouTube for you, one moment.";
    }

    private static String calmOpenContactsPhrase(String raw) {
        return preferHindiVoice(raw)
            ? "जी, संपर्क खोल रहे हैं — एक पल।"
            : "Sure — opening contacts for you, one moment.";
    }

    private static String calmOpenMusicPhrase(String raw) {
        return preferHindiVoice(raw)
            ? "जी, म्यूजिक ऐप खोल रहे हैं — एक पल।"
            : "Sure — opening your music app, one moment.";
    }

    private static String calmCallPhrase(String raw) {
        return preferHindiVoice(raw)
            ? "जी, कॉल शुरू कर रहे हैं — एक पल।"
            : "Sure — starting the call for you, one moment.";
    }

    private static void speakThen(Context context, String phrase, long delayMs, Runnable action) {
        speak(context, phrase);
        pendingBusyRunnable =
            () -> {
                pendingBusyRunnable = null;
                try {
                    action.run();
                } catch (Exception ignored) {
                }
            };
        busyAckHandler.postDelayed(pendingBusyRunnable, delayMs);
    }

    private static void applyNeoTtsCalmProfile() {
        if (tts != null && ttsReady) {
            try {
                tts.setSpeechRate(0.76f);
                tts.setPitch(0.94f);
            } catch (Exception ignored) {
            }
        }
    }

    static void shutdown() {
        busyAckHandler.removeCallbacksAndMessages(null);
        pendingBusyRunnable = null;
        if (tts != null) {
            try {
                tts.stop();
                tts.shutdown();
            } catch (Exception ignored) {
            }
        }
        tts = null;
        ttsReady = false;
        pendingSpeech = null;
    }

    private static boolean isTimeIntent(String t) {
        return t.matches(".*\\b(time|what(?:'s| is)? the time|time now|current time)\\b.*")
            || t.contains("समय")
            || t.contains("टाइम");
    }

    private static String formatTimeNow() {
        java.text.SimpleDateFormat fmt = new java.text.SimpleDateFormat("h:mm a", Locale.getDefault());
        return fmt.format(new java.util.Date());
    }

    private static boolean isVolumeIntent(String t) {
        return t.matches(".*\\b(volume|sound|mute|unmute|louder|softer)\\b.*")
            || t.contains("वॉल्यूम")
            || t.contains("आवाज")
            || t.contains("आवाज़");
    }

    /**
     * Voice volume commands: use flag 0 (no UI) so OEMs do not play the system “tun” / slider sound on each change.
     */
    private static boolean handleVolumeIntent(Context context, String t) {
        AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return false;
        int stream = AudioManager.STREAM_MUSIC;
        int max = Math.max(1, am.getStreamMaxVolume(stream));
        int current = am.getStreamVolume(stream);
        final int silent = 0;

        if (t.matches(".*\\b(mute|silent|volume\\s*off)\\b.*") || t.contains("म्यूट")) {
            am.setStreamVolume(stream, 0, silent);
            return true;
        }

        if (t.matches(".*\\b(unmute|volume\\s*on)\\b.*")) {
            int target = Math.max(1, Math.round(max * 0.35f));
            am.setStreamVolume(stream, target, silent);
            return true;
        }

        Matcher percent = Pattern.compile("(\\d{1,3})\\s*%").matcher(t);
        Matcher numeric = Pattern.compile("\\b(?:to|set|at)\\s*(\\d{1,3})\\b").matcher(t);
        Integer level = null;
        if (percent.find()) {
            level = Integer.parseInt(percent.group(1));
        } else if (numeric.find()) {
            level = Integer.parseInt(numeric.group(1));
        }
        if (level != null) {
            int clamped = Math.max(0, Math.min(100, level));
            int target = Math.round((clamped / 100f) * max);
            am.setStreamVolume(stream, target, silent);
            return true;
        }

        if (t.matches(".*\\b(volume\\s*(up|increase|high)|louder|raise)\\b.*")
            || t.contains("बढ़ा")) {
            am.adjustStreamVolume(stream, AudioManager.ADJUST_RAISE, silent);
            return true;
        }

        if (t.matches(".*\\b(volume\\s*(down|decrease|low)|softer|lower)\\b.*")
            || t.contains("कम")) {
            am.adjustStreamVolume(stream, AudioManager.ADJUST_LOWER, silent);
            return true;
        }

        am.setStreamVolume(stream, current, silent);
        return true;
    }

    /** Open the YouTube Music app when user asks for music (not a YouTube-only phrase). */
    private static boolean isYouTubeMusicLaunchIntent(String t) {
        if (t.contains("youtube") || t.contains("you tube") || t.contains("यूट्यूब")) {
            return false;
        }
        return t.matches(".*\\b(open|play|launch|start)\\b.*\\bmusic\\b.*")
            || t.matches(".*\\bmusic\\b.*\\b(open|play|launch|start)\\b.*")
            || t.matches(".*\\bmy\\s+music\\b.*");
    }

    private static String extractYouTubeQuery(String t) {
        boolean asksYouTube = t.contains("youtube")
            || t.contains("you tube")
            || t.contains("यूट्यूब")
            || t.contains("song")
            || t.contains("music")
            || t.contains("singer")
            || t.contains("गाना")
            || t.contains("म्यूजिक")
            || t.contains("सिंगर");
        if (!asksYouTube) return null;

        String q = t
            .replaceAll("\\b(hello|hey|hi|neo)\\b", "")
            .replaceAll("\\b(play|listen|start|open|on|in|youtube|you\\s*tube|song|music|by singer|singer)\\b", "")
            .replaceAll("यूट्यूब|गाना|म्यूजिक|सिंगर", "")
            .replaceAll("\\s+", " ")
            .trim();
        if (q.isEmpty()) q = "latest songs";
        return q;
    }

    private static String extractDigits(String t) {
        Matcher m = Pattern.compile("(\\+\\d[\\d\\s\\-.]{8,}\\d|\\d{10,})").matcher(t);
        if (!m.find()) return null;
        String digits = m.group(1).replaceAll("\\D", "");
        if (digits.length() == 10) digits = "91" + digits;
        if (digits.length() < 11) return null;
        return digits;
    }

    private static String normalize(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private static boolean isReadMessagesIntent(String t) {
        boolean msgCtx =
            t.contains("message")
                || t.contains("मैसेज")
                || t.contains("sms")
                || t.contains("notification")
                || t.contains("notif")
                || t.contains("whatsapp")
                || t.contains("telegram")
                || t.contains("व्हाट्स")
                || t.contains("टेली");
        if (!msgCtx) return false;
        boolean readish =
            t.contains("read")
                || t.contains("padho")
                || t.contains("पढ़")
                || t.contains("dikhao")
                || t.contains("दिखा")
                || t.contains("whose")
                || t.contains("what did")
                || t.contains("kya bola")
                || t.contains("क्या बोल")
                || t.contains("kis ka")
                || t.contains("किस का")
                || t.contains("kaun sa")
                || t.contains("कौन सा")
                || t.contains("last message")
                || t.matches(".*\\bcheck\\b.*\\b(message|messages|sms|notification|notif)\\b.*")
                || t.matches(".*\\b(message|messages|sms)\\b.*\\bcheck\\b.*");
        boolean openOnly =
            (t.contains("open") || t.contains("launch") || t.contains("start") || t.contains("खोल"))
                && (t.contains("whatsapp") || t.contains("telegram"));
        return readish && !openOnly;
    }

    private static String explainCantReadMessages() {
        if ("hi".equals(Locale.getDefault().getLanguage())) {
            return "व्हाट्सऐप या टेलीग्राम के अंदर के मैसेज की पूरी डिटेल यहाँ से नहीं पढ़ सकते। बोलिए: नियो, व्हाट्सऐप खोलो — फिर ऐप में देखें।";
        }
        return "I can't read full WhatsApp or Telegram message text from here. Say Neo, open WhatsApp — then read inside the app.";
    }

    private static boolean isWhatsAppIntent(String t) {
        boolean hasWord = t.contains("whatsapp")
            || t.contains("व्हाट्सएप")
            || t.contains("वाट्सऐप")
            || t.contains("व्हाट्सऐप");
        if (!hasWord) return false;
        return t.matches(".*\\b(open|launch|start|show)\\b.*")
            || t.matches(".*\\bmy\\s+whatsapp\\b.*")
            || t.contains("ओपन")
            || t.contains("खोलो")
            || t.contains("खोल");
    }

    private static boolean isTelegramIntent(String t) {
        boolean hasWord = t.contains("telegram")
            || t.contains("टेलीग्राम")
            || t.contains("टेलिग्राम");
        if (!hasWord) return false;
        return t.matches(".*\\b(open|launch|start|show)\\b.*")
            || t.matches(".*\\bmy\\s+telegram\\b.*")
            || t.contains("ओपन")
            || t.contains("खोलो")
            || t.contains("खोल");
    }

    private static boolean isContactsIntent(String t) {
        if (t.contains("play store") || t.contains("playstore") || t.contains("app store")) {
            return false;
        }
        return t.matches(".*\\b(open|launch|show|start)\\b.*\\b(contact|contacts|phonebook|phone book|address book)\\b.*")
            || t.matches(".*\\b(contact|contacts|phonebook|phone book)\\b.*\\b(open|launch|show|start)\\b.*")
            || t.matches(".*\\b(my\\s+contact|mycontact|my\\s+contacts)\\b.*")
            || t.contains("संपर्क खोल")
            || t.contains("फोन बुक खोल")
            || t.matches(".*\\b(खोल|open)\\b.*\\b(संपर्क|फोन\\s*बुक)\\b.*");
    }

    private static void openContactsApp(Context context) {
        Intent view = new Intent(Intent.ACTION_VIEW);
        view.setData(Uri.parse("content://com.android.contacts/contacts"));
        view.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(view);
            return;
        } catch (ActivityNotFoundException ignored) {
        }
        Intent main = new Intent(Intent.ACTION_MAIN);
        main.addCategory(Intent.CATEGORY_APP_CONTACTS);
        main.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(main);
            return;
        } catch (ActivityNotFoundException ignored) {
        }
        Intent pick = new Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI);
        pick.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(pick);
        } catch (ActivityNotFoundException ignored) {
        }
    }

    private static String extractTel(String t) {
        if (!(t.matches(".*\\b(call|dial|phone|ring)\\b.*")
            || t.contains("कॉल")
            || t.contains("फोन"))) {
            return null;
        }
        Matcher m = Pattern.compile("(\\+\\d[\\d\\s\\-.]{8,}\\d|\\d{10,})").matcher(t);
        if (!m.find()) return null;
        String digits = m.group(1).replaceAll("\\D", "");
        if (digits.length() == 10) digits = "91" + digits;
        if (digits.length() < 11) return null;
        return "tel:+" + digits;
    }

    /**
     * Open deep link in an installed package variant (e.g. WhatsApp + WhatsApp Business), then chooser, then launcher,
     * then Play Store. Requires {@code <queries>} in the manifest on API 31+ or {@code getLaunchIntentForPackage} stays null.
     */
    private static void openPreferredAppThenStore(
        Context context,
        String[] candidatePkgs,
        Uri appUri,
        String playStorePackageId
    ) {
        PackageManager pm = context.getPackageManager();

        for (String pkg : candidatePkgs) {
            if (pm.getLaunchIntentForPackage(pkg) == null) {
                continue;
            }
            Intent viewPkg = new Intent(Intent.ACTION_VIEW, appUri);
            viewPkg.setPackage(pkg);
            viewPkg.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                context.startActivity(viewPkg);
                return;
            } catch (ActivityNotFoundException ignored) {
            }
            Intent launch = pm.getLaunchIntentForPackage(pkg);
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    context.startActivity(launch);
                    return;
                } catch (ActivityNotFoundException ignored) {
                }
            }
        }

        Intent viewNoPkg = new Intent(Intent.ACTION_VIEW, appUri);
        viewNoPkg.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (viewNoPkg.resolveActivity(pm) != null) {
            try {
                context.startActivity(viewNoPkg);
                return;
            } catch (ActivityNotFoundException ignored) {
            }
        }

        Uri storeUri = Uri.parse("market://details?id=" + playStorePackageId);
        Intent storeIntent = new Intent(Intent.ACTION_VIEW, storeUri);
        storeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(storeIntent);
        } catch (ActivityNotFoundException ignored) {
            try {
                Intent storeWebIntent = new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=" + playStorePackageId)
                );
                storeWebIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(storeWebIntent);
            } catch (ActivityNotFoundException ignored2) {
            }
        }
    }

    private static void speak(Context context, String text) {
        if (text == null || text.trim().isEmpty()) return;
        if (tts == null) {
            pendingSpeech = text;
            tts = new TextToSpeech(context.getApplicationContext(), status -> {
                if (status == TextToSpeech.SUCCESS && tts != null) {
                    ttsReady = true;
                    tts.setLanguage(Locale.getDefault());
                    applyNeoTtsCalmProfile();
                    if (pendingSpeech != null) {
                        tts.speak(pendingSpeech, TextToSpeech.QUEUE_FLUSH, null, "neo-time");
                        pendingSpeech = null;
                    }
                }
            });
            return;
        }
        if (ttsReady) {
            applyNeoTtsCalmProfile();
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "neo-speech");
        } else {
            pendingSpeech = text;
        }
    }
}
