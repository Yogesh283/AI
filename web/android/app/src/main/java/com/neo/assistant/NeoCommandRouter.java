package com.neo.assistant;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.ContactsContract;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class NeoCommandRouter {
    private static TextToSpeech tts;
    private static boolean ttsReady = false;
    private static String pendingSpeech;
    private static final Handler busyAckHandler = new Handler(Looper.getMainLooper());
    private static Runnable pendingBusyRunnable;
    /** While assistant TTS is playing — wake / voice layers must ignore mic input (no speaker→mic loop). */
    private static volatile boolean isAISpeaking = false;
    /** Posted when the last queued utterance finishes (or errors). Wake listener resumes STT without extra mic churn. */
    private static volatile Runnable assistantSpeechEndedRunnable;

    private NeoCommandRouter() {}

    /** @return true while Neo voice acknowledgement / reply TTS is active */
    public static boolean isAISpeaking() {
        return isAISpeaking;
    }

    /**
     * Wake / foreground listener registers this to resume {@link android.speech.SpeechRecognizer} after TTS.
     * Do not perform heavy work on this runnable’s thread.
     */
    public static void setAssistantSpeechEndedRunnable(Runnable r) {
        assistantSpeechEndedRunnable = r;
    }

    private static void notifyAssistantSpeechEnded() {
        isAISpeaking = false;
        Runnable r = assistantSpeechEndedRunnable;
        if (r != null) {
            busyAckHandler.post(r);
        }
    }

    /** Wake heard with no command tail — short, assistant-style prompt (Alexa-like: brief + one beat to speak). */
    public static void speakWakeListeningAck(Context context, String rawHeard) {
        boolean hi = preferHindiVoice(rawHeard);
        String msg =
            hi
                ? "जी, बोलिए। क्या चाहिए—YouTube, WhatsApp, कॉल, या कोई ऐप?"
                : "I'm listening. What would you like? You can ask for music, WhatsApp, a call, or any app.";
        speak(context, msg);
    }

    static boolean execute(Context context, String raw) {
        busyAckHandler.removeCallbacksAndMessages(null);
        pendingBusyRunnable = null;

        String text = normalize(raw);
        if (text.isEmpty()) return false;
        if (isReadMessagesIntent(text)) {
            if (tryReadWhatsAppFromNotification(context, text, raw)) {
                return true;
            }
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

        if (isGenericOpenAppIntent(text)) {
            String appName = extractOpenAppName(text);
            if (appName != null && !appName.isEmpty()) {
                boolean launched = openInstalledAppByLabel(context, appName);
                if (launched) {
                    speak(context, preferHindiVoice(raw)
                        ? "ठीक है, " + appName + " खोल रहा हूँ।"
                        : "Sure — opening " + appName + " now.");
                } else {
                    speak(context, preferHindiVoice(raw)
                        ? "वह ऐप फोन पर नहीं मिला। थोड़ा साफ नाम बोलकर फिर कोशिश करिए।"
                        : "I don't see that app on this phone. Try saying the app name a bit more clearly.");
                }
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
                ? "अभी समय " + t + " है।"
                : "Right now it's " + t + ".";
        speak(context, msg);
    }

    private static String calmOpenWhatsAppPhrase(String raw) {
        return preferHindiVoice(raw)
            ? "ठीक है, WhatsApp खोल रहा हूँ।"
            : "Got it — opening WhatsApp.";
    }

    private static String calmOpenTelegramPhrase(String raw) {
        return preferHindiVoice(raw)
            ? "ठीक है, Telegram खोल रहा हूँ।"
            : "Got it — opening Telegram.";
    }

    private static String calmOpenYouTubePhrase(String raw) {
        return preferHindiVoice(raw)
            ? "ठीक है, YouTube खोल रहा हूँ।"
            : "Got it — opening YouTube.";
    }

    private static String calmOpenContactsPhrase(String raw) {
        return preferHindiVoice(raw)
            ? "ठीक है, संपर्क खोल रहा हूँ।"
            : "Got it — opening contacts.";
    }

    private static String calmOpenMusicPhrase(String raw) {
        return preferHindiVoice(raw)
            ? "ठीक है, म्यूजिक ऐप खोल रहा हूँ।"
            : "Got it — opening your music app.";
    }

    private static String calmCallPhrase(String raw) {
        return preferHindiVoice(raw)
            ? "ठीक है, कॉल लगा रहा हूँ।"
            : "Got it — placing the call.";
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

    /**
     * Human, assistant-style delivery: near-conversation speed, slight warmth, and the clearest installed
     * voice for the current locale (higher quality / neural when the engine exposes it).
     */
    private static void applyNeoAssistantVoiceProfile() {
        if (tts == null || !ttsReady) return;
        try {
            tts.setSpeechRate(0.86f);
            tts.setPitch(1.0f);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                Voice v = pickBestAssistantVoice(tts, Locale.getDefault());
                if (v != null && tts.setVoice(v) == TextToSpeech.SUCCESS) {
                    return;
                }
            }
            tts.setLanguage(Locale.getDefault());
        } catch (Exception ignored) {
        }
    }

    /** Prefer same language as the phone, then highest engine quality (often neural / network voices). */
    private static Voice pickBestAssistantVoice(TextToSpeech engine, Locale preferred) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return null;
        try {
            Set<Voice> voices = engine.getVoices();
            if (voices == null || voices.isEmpty()) return null;
            String wantLang = preferred.getLanguage();
            ArrayList<Voice> candidates = new ArrayList<>();
            for (Voice v : voices) {
                if (v == null) continue;
                Locale l = v.getLocale();
                if (l == null) continue;
                if (wantLang.equals(l.getLanguage())) {
                    candidates.add(v);
                }
            }
            if (candidates.isEmpty()) {
                for (Voice v : voices) {
                    if (v == null) continue;
                    Locale l = v.getLocale();
                    if (l != null && "en".equals(l.getLanguage())) {
                        candidates.add(v);
                    }
                }
            }
            if (candidates.isEmpty()) return null;
            Collections.sort(
                candidates,
                (a, b) -> {
                    int qa = a.getQuality();
                    int qb = b.getQuality();
                    if (qa != qb) {
                        return Integer.compare(qb, qa);
                    }
                    boolean na = a.isNetworkConnectionRequired();
                    boolean nb = b.isNetworkConnectionRequired();
                    if (na != nb) {
                        /* Prefer cloud / neural voices when quality ties. */
                        return Boolean.compare(nb, na);
                    }
                    return 0;
                });
            return candidates.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    static void shutdown() {
        busyAckHandler.removeCallbacksAndMessages(null);
        pendingBusyRunnable = null;
        assistantSpeechEndedRunnable = null;
        isAISpeaking = false;
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

    private static void attachUtteranceListener() {
        if (tts == null) return;
        try {
            tts.setOnUtteranceProgressListener(
                new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        /* Flag is set synchronously in speakInternal before speak(); this confirms engine started. */
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        notifyAssistantSpeechEnded();
                    }

                    @Override
                    public void onError(String utteranceId) {
                        notifyAssistantSpeechEnded();
                    }
                });
        } catch (Exception ignored) {
        }
    }

    private static void speakInternal(String text) {
        if (tts == null || !ttsReady) return;
        applyNeoAssistantVoiceProfile();
        attachUtteranceListener();
        isAISpeaking = true;
        String uttId = "neo-utt-" + System.nanoTime();
        int code = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, uttId);
        if (code == TextToSpeech.ERROR) {
            notifyAssistantSpeechEnded();
        }
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
            return "पूरा चैट इनबॉक्स यहाँ से नहीं खोल सकते। सेटिंग्स में Neo के लिए नोटिफिकेशन एक्सेस चालू करें — तब लेटेस्ट व्हाट्सऐप नोटिफिकेशन का टेक्स्ट बता सकता हूँ। वरना बोलिए: व्हाट्सऐप खोलो।";
        }
        return "I can't open full chats here. Enable Notification access for Neo in Android settings — then I can read your latest WhatsApp notification text. Or say open WhatsApp.";
    }

    /** Uses {@link NeoPrefs} snapshot from {@link NeoNotificationListenerService} when user granted notification access. */
    private static boolean tryReadWhatsAppFromNotification(Context context, String text, String raw) {
        boolean wa =
            text.contains("whatsapp")
                || text.contains("व्हाट्स")
                || text.contains("वाट्स")
                || text.contains("व्हाट्सऐप");
        if (!wa) {
            return false;
        }
        String snap = NeoPrefs.getLastWhatsAppNotification(context);
        if (snap == null || snap.trim().isEmpty()) {
            return false;
        }
        final String snippet = snap.trim();
        speakThen(
            context,
            preferHindiVoice(raw)
                ? "लास्ट व्हाट्सऐप नोटिफिकेशन: " + snippet
                : "Your last WhatsApp notification said: " + snippet,
            2000,
            () ->
                openPreferredAppThenStore(
                    context,
                    new String[] {"com.whatsapp", "com.whatsapp.w4b"},
                    Uri.parse("whatsapp://send"),
                    "com.whatsapp"));
        return true;
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

    private static boolean isGenericOpenAppIntent(String t) {
        if (!(t.matches(".*\\b(open|launch|start|show)\\b.*") || t.contains("खोल") || t.contains("ओपन"))) {
            return false;
        }
        if (isWhatsAppIntent(t) || isTelegramIntent(t) || isContactsIntent(t) || isYouTubeMusicLaunchIntent(t)) {
            return false;
        }
        if (t.contains("youtube") || t.contains("you tube") || t.contains("यूट्यूब")) return false;
        if (t.contains("call") || t.contains("dial") || t.contains("फोन") || t.contains("कॉल")) return false;
        return true;
    }

    private static String extractOpenAppName(String t) {
        String cleaned = t
            .replaceAll("\\b(hello|hey|hi|neo)\\b", " ")
            .replaceAll("\\b(open|launch|start|show|my|the|app|application|please|now)\\b", " ")
            .replaceAll("ओपन|खोलो|खोल|ऐप|एप|मेरा|मेरी|कृपया|अभी", " ")
            .replaceAll("\\s+", " ")
            .trim();
        if (cleaned.isEmpty()) return null;
        return cleaned;
    }

    private static boolean openInstalledAppByLabel(Context context, String rawName) {
        PackageManager pm = context.getPackageManager();
        String q = rawName.toLowerCase(Locale.ROOT).trim();
        List<ApplicationInfo> apps = pm.getInstalledApplications(PackageManager.GET_META_DATA);
        ApplicationInfo best = null;
        int bestScore = -1;
        for (ApplicationInfo ai : apps) {
            Intent li = pm.getLaunchIntentForPackage(ai.packageName);
            if (li == null) continue;
            CharSequence labelCs = pm.getApplicationLabel(ai);
            if (labelCs == null) continue;
            String label = labelCs.toString().toLowerCase(Locale.ROOT).trim();
            if (label.isEmpty()) continue;
            int score = -1;
            if (label.equals(q)) score = 100;
            else if (label.startsWith(q)) score = 80;
            else if (label.contains(q)) score = 60;
            else if (q.contains(label) && label.length() >= 3) score = 40;
            if (score > bestScore) {
                bestScore = score;
                best = ai;
            }
        }
        if (best == null || bestScore < 40) {
            return false;
        }
        Intent launch = pm.getLaunchIntentForPackage(best.packageName);
        if (launch == null) return false;
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(launch);
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        }
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
            tts =
                new TextToSpeech(
                    context.getApplicationContext(),
                    status -> {
                        if (status == TextToSpeech.SUCCESS && tts != null) {
                            ttsReady = true;
                            tts.setLanguage(Locale.getDefault());
                            attachUtteranceListener();
                            applyNeoAssistantVoiceProfile();
                            if (pendingSpeech != null) {
                                speakInternal(pendingSpeech);
                                pendingSpeech = null;
                            }
                        }
                    });
            return;
        }
        if (ttsReady) {
            speakInternal(text);
        } else {
            pendingSpeech = text;
        }
    }
}
