package com.neo.assistant;

import android.Manifest;
import android.app.Activity;
import android.app.ActivityManager;
import android.app.SearchManager;
import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.media.AudioManager;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.ContactsContract;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import androidx.core.content.ContextCompat;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

public final class NeoCommandRouter {
    /** Assistant replies are always Hindi; TTS uses this locale (voices may still fall back if missing). */
    private static final Locale ASSISTANT_TTS_LOCALE = new Locale("hi", "IN");

    private static TextToSpeech tts;
    private static boolean ttsReady = false;
    private static String pendingSpeech;
    private static final Handler busyAckHandler = new Handler(Looper.getMainLooper());
    private static Runnable pendingBusyRunnable;
    /** While assistant TTS is playing — wake / voice layers must ignore mic input (no speaker→mic loop). */
    private static volatile boolean isAISpeaking = false;
    /** Posted when the last queued utterance finishes (or errors). Wake listener resumes STT without extra mic churn. */
    private static volatile Runnable assistantSpeechEndedRunnable;

    /**
     * {@link WakeWordForegroundService} wraps {@link #execute} with this so background wake routing has
     * <strong>no TTS</strong> (no wake hint, no errors spoken, no “opening…” lines). Actions still pause STT via
     * {@link #isAISpeaking} during delayed execution. OEM mic / focus sounds are not fully controllable from app code.
     */
    private static final ThreadLocal<Boolean> SILENT_WAKE_ROUTING = new ThreadLocal<>();

    public static void beginSilentWakeRouting() {
        SILENT_WAKE_ROUTING.set(Boolean.TRUE);
    }

    public static void endSilentWakeRouting() {
        SILENT_WAKE_ROUTING.remove();
    }

    private static boolean isSilentWakeRouting() {
        return Boolean.TRUE.equals(SILENT_WAKE_ROUTING.get());
    }

    private NeoCommandRouter() {}

    /**
     * Central place for {@code FLAG_ACTIVITY_NEW_TASK} (required from {@link android.app.Service}).
     * Package visibility for “open X” is fixed via MAIN/LAUNCHER {@code <queries>} in the manifest.
     */
    private static boolean startActivityCompat(Context context, Intent intent) {
        if (!canLaunchExternalUiNow(context)) {
            return false;
        }
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_NEW_TASK) == 0) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }
        try {
            context.startActivity(intent);
            return true;
        } catch (ActivityNotFoundException | SecurityException ignored) {
            return false;
        }
    }

    /**
     * Android 14/15 BAL policy: a foreground service without visible app UI cannot launch external activities.
     * Guard before startActivity to avoid repeated blocked-launch spam.
     */
    private static boolean canLaunchExternalUiNow(Context context) {
        try {
            ActivityManager.RunningAppProcessInfo info = new ActivityManager.RunningAppProcessInfo();
            ActivityManager.getMyMemoryState(info);
            int imp = info.importance;
            return imp == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                || imp == ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
        } catch (Exception ignored) {
            return false;
        }
    }

    /** When STT matched wake but no intent ran — short hint so the user knows to rephrase. */
    public static void speakCommandNotUnderstood(Context context, String rawHeard) {
        speak(
            context,
            "समझ नहीं आया। जैसे बोलिए: संपर्क सूची खोलो, व्हाट्सऐप खोलो, या यूट्यूब पर गाना चलाओ।");
    }

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
        speak(
            context,
            "जी, सुन रहा हूँ। व्हाट्सऐप खोलकर किसी को ढूंढना, संदेश पढ़ना, इसे संदेश भेजना, कॉल, या यूट्यूब—जो चाहिए बोलिए।");
    }

    /** Wake voice-chat mode: speak backend/OpenAI chat text reply via the same TTS channel. */
    public static void speakVoiceChatReply(Context context, String text) {
        if (text == null || text.trim().isEmpty()) {
            return;
        }
        speak(context, text.trim());
    }

    /** Mic is toggled in the UI; voice phrases must not trigger TTS or other routers (no “use the mic button” spam). */
    private static boolean isMicControlIntent(String t, String raw) {
        if (t == null) return false;
        if (t.matches(".*\\b(mic|microphone)\\b.*\\b(on|off|start|stop|mute|unmute)\\b.*")) return true;
        if (t.matches(".*\\b(on|off|start|stop|mute|unmute)\\b.*\\b(mic|microphone)\\b.*")) return true;
        String r = raw == null ? "" : raw;
        return r.matches("(?is).*(माइक|माइक्रोफोन).*(चालू|बंद|ऑन|ऑफ|शुरू|रोक|म्यूट|अनम्यूट).*");
    }

    static boolean execute(Context context, String raw) {
        busyAckHandler.removeCallbacksAndMessages(null);
        pendingBusyRunnable = null;

        String text = normalize(raw);
        if (text.isEmpty()) return false;
        /* UI-only — no TTS (avoids speaker→mic loop and “bar bar” prompts). */
        if (isMicControlIntent(text, raw)) {
            return true;
        }
        if (isReadMessagesIntent(text)) {
            if (tryReadMessengerNotification(context, text, raw)) {
                return true;
            }
            if (extractPersonHintForMessageRead(raw) != null) {
                speak(
                    context,
                    "उस नाम से मेल खाती हाल की सूचना नहीं मिली। सूचना आने के बाद फिर कोशिश करिए।");
                return true;
            }
            speak(context, explainCantReadMessages());
            return true;
        }
        String digits = extractDigits(text);

        if (handleMessengerFindContact(context, text, raw)) {
            return true;
        }
        if (handleDirectComposeByName(context, text, raw)) {
            return true;
        }
        if (handleVoiceComposeSendMessage(context, text, raw)) {
            return true;
        }

        if (handleCompoundContactsThenCall(context, text, raw)) {
            return true;
        }

        if (isTimeIntent(text)) {
            speakTimeCalm(context, raw);
            return true;
        }

        if (isVolumeIntent(text)) {
            return handleVolumeIntent(context, text);
        }

        if (isContactsIntent(text)) {
            NeoPrefs.setLastVoiceAppContext(context, "contacts");
            speakOpenAppWithFollowUp(
                context,
                raw,
                calmOpenContactsPhrase(raw),
                1000,
                () -> openContactsApp(context),
                afterContactsOpenedPrompt(raw));
            return true;
        }

        if (isOpenProfileOrAccountIntent(text)) {
            speakThen(
                context,
                "ठीक है, आपकी प्रोफ़ाइल खोल रहा हूँ।",
                700,
                () -> openInAppWebPath(context, "/profile"));
            return true;
        }

        if (isYouTubeMusicLaunchIntent(text)) {
            if (context.getPackageManager().getLaunchIntentForPackage("com.google.android.apps.youtube.music") != null) {
                NeoPrefs.setLastVoiceAppContext(context, "youtube");
                speakOpenAppWithFollowUp(
                    context,
                    raw,
                    calmOpenMusicPhrase(raw),
                    1300,
                    () -> {
                        Intent launch =
                            context.getPackageManager()
                                .getLaunchIntentForPackage("com.google.android.apps.youtube.music");
                        if (launch != null) {
                            startActivityCompat(context, launch);
                        }
                    },
                    afterMusicAppOpenedPrompt(raw));
                return true;
            }
        }

        if (isGenericOpenAppIntent(text)) {
            String appName = extractOpenAppName(text);
            if (appName != null && !appName.isEmpty()) {
                boolean launched = openInstalledAppByLabel(context, appName);
                if (launched) {
                    speak(context, "ठीक है, " + appName + " खोल रहा हूँ।");
                } else {
                    speak(
                        context,
                        "वह ऐप इस फ़ोन पर नहीं मिला। ऐप का नाम थोड़ा साफ़ बोलकर फिर कोशिश करिए।");
                }
                return true;
            }
        }

        String ytQuery = extractYouTubeQuery(text);
        if (ytQuery != null) {
            final String q = ytQuery;
            speakOpenAppWithFollowUp(
                context,
                raw,
                calmOpenYouTubePhrase(raw),
                1400,
                () -> openYouTubeSearchForPlayback(context, q),
                afterYouTubeOpenedPrompt(raw));
            return true;
        }

        if (isWhatsAppIntent(text)) {
            NeoPrefs.setLastVoiceAppContext(context, "wa");
            final String waDigits = digits;
            final boolean preferBiz = prefersWhatsAppBusiness(text);
            final String[] waPkgs =
                preferBiz
                    ? new String[] {"com.whatsapp.w4b", "com.whatsapp"}
                    : new String[] {"com.whatsapp", "com.whatsapp.w4b"};
            Uri appUri =
                waDigits != null
                    ? Uri.parse("whatsapp://send?phone=" + waDigits)
                    : Uri.parse("whatsapp://send");
            speakOpenAppWithFollowUp(
                context,
                raw,
                calmOpenWhatsAppPhrase(raw),
                1400,
                () -> {
                    openPreferredAppThenStore(
                        context,
                        waPkgs,
                        appUri,
                        "com.whatsapp");
                    if (waDigits != null && waDigits.length() >= 11) {
                        NeoPrefs.setVoiceComposeTarget(context, "wa", waDigits, "");
                    }
                },
                afterWhatsAppOpenedPrompt(raw));
            return true;
        }

        if (isTelegramIntent(text)) {
            NeoPrefs.setLastVoiceAppContext(context, "tg");
            final String tgDigits = digits;
            Uri appUri =
                tgDigits != null
                    ? Uri.parse("tg://resolve?phone=%2B" + tgDigits)
                    : Uri.parse("tg://");
            speakOpenAppWithFollowUp(
                context,
                raw,
                calmOpenTelegramPhrase(raw),
                1400,
                () -> {
                    openPreferredAppThenStore(
                        context,
                        new String[] {"org.telegram.messenger", "org.thunderdog.challegram"},
                        appUri,
                        "org.telegram.messenger");
                    if (tgDigits != null && tgDigits.length() >= 11) {
                        NeoPrefs.setVoiceComposeTarget(context, "tg", tgDigits, "");
                    }
                },
                afterTelegramOpenedPrompt(raw));
            return true;
        }

        if (isCallByNameIntent(text)) {
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS)
                    != PackageManager.PERMISSION_GRANTED) {
                speak(
                    context,
                    "नाम से कॉल के लिए एंड्रॉइड सेटिंग्स में नियो असिस्टेंट को संपर्क पढ़ने की अनुमति दें।");
                return true;
            }
            String name = extractCallName(text);
            if (name == null || name.length() < 2) {
                speak(context, "किस नाम से फ़ोन लगाना है? जैसे—विजय जी को कॉल करो।");
                return true;
            }
            String telUri = lookupDialStringForContactName(context, name);
            if (telUri == null) {
                speak(
                    context,
                    "यह नाम आपकी संपर्क सूची में नहीं मिला। जिस नाम से सेव है, वही बोलकर फिर कोशिश करिए।");
                return true;
            }
            final String dial = telUri;
            speakThen(context, calmCallPhrase(raw), 1250, () -> startTelIntent(context, dial));
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
        Uri uri = Uri.parse(tel);
        /*
         * Prefer direct call when CALL_PHONE is granted.
         * Fallback to dialer if permission is missing or blocked.
         */
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE)
                == PackageManager.PERMISSION_GRANTED) {
            Intent callIntent = new Intent(Intent.ACTION_CALL, uri);
            if (startActivityCompat(context, callIntent)) {
                return;
            }
        }
        Intent dialIntent = new Intent(Intent.ACTION_DIAL, uri);
        startActivityCompat(context, dialIntent);
    }

    /** In-app Web profile (/profile), same flags as {@link NeoNativeRouterPlugin#openAppPath}. */
    private static void openInAppWebPath(Context context, String path) {
        String p = path == null ? "/profile" : path.trim();
        if (p.isEmpty()) {
            p = "/profile";
        }
        if (!p.startsWith("/")) {
            p = "/" + p;
        }
        if (!p.matches("^/[a-zA-Z0-9/_-]+$")) {
            p = "/profile";
        }
        Intent i = new Intent(context, MainActivity.class);
        i.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        i.putExtra(MainActivity.EXTRA_NEO_NAV_PATH, p);
        i.setPackage(context.getPackageName());
        startActivityCompat(context, i);
    }

    private static boolean isOpenProfileOrAccountIntent(String t) {
        boolean hasWord =
            t.contains("profile")
                || t.matches(".*\\baccounts?\\b.*")
                || t.contains("प्रोफाइल")
                || t.contains("खाता")
                || t.contains("अकाउंट");
        if (!hasWord) {
            return false;
        }
        return t.matches(".*\\b(open|launch|start|show|go to|visit|display)\\b.*")
            || t.contains("can you")
            || t.contains("could you")
            || t.contains("please")
            || t.contains("खोल")
            || t.contains("ओपन")
            || t.contains("दिखा");
    }

    private static void speakTimeCalm(Context context, String raw) {
        String t = formatTimeNow();
        speak(context, "अभी समय " + t + " है।");
    }

    private static String calmOpenWhatsAppPhrase(String raw) {
        return "ठीक है, व्हाट्सऐप खोल रहा हूँ।";
    }

    private static String calmOpenTelegramPhrase(String raw) {
        return "ठीक है, टेलीग्राम खोल रहा हूँ।";
    }

    private static String calmOpenYouTubePhrase(String raw) {
        return "ठीक है, यूट्यूब खोल रहा हूँ।";
    }

    private static String calmOpenContactsPhrase(String raw) {
        return "ठीक है, आपकी संपर्क सूची खोल रहा हूँ।";
    }

    private static String calmOpenMusicPhrase(String raw) {
        return "ठीक है, संगीत ऐप खोल रहा हूँ।";
    }

    private static String calmCallPhrase(String raw) {
        return "ठीक है, कॉल लगा रहा हूँ।";
    }

    private static String afterContactsOpenedPrompt(String raw) {
        return "सर, संपर्क सूची खुल गई है। अब इसी में बताइए क्या करना है—किस नाम पर कॉल लगानी है, जैसे: अमन को कॉल करो।";
    }

    private static String afterWhatsAppOpenedPrompt(String raw) {
        return "सर, व्हाट्सऐप खुल गया है। अब इसी में बताइए क्या करना है—किसे मैसेज भेजना है या किसे कॉल करनी है।";
    }

    private static String afterTelegramOpenedPrompt(String raw) {
        return "सर, टेलीग्राम खुल गया है। अब इसी में बताइए क्या करना है—किसे मैसेज भेजना है।";
    }

    private static String afterYouTubeOpenedPrompt(String raw) {
        return "सर, यूट्यूब खुल गया है। अब इसी में बताइए क्या चलाना है—गाना, वीडियो, या सर्च क्वेरी बोलिए।";
    }

    private static String afterMusicAppOpenedPrompt(String raw) {
        return "सर, संगीत ऐप खुल गया है। अब इसी में बताइए क्या सुनना है।";
    }

    private static void speakThen(Context context, String phrase, long delayMs, Runnable action) {
        if (isSilentWakeRouting()) {
            isAISpeaking = true;
            /* Slightly longer than before so activity/audio focus settles before STT relisten (fewer OEM “tun”). */
            long d = Math.min(Math.max(delayMs, 0L), 900L);
            pendingBusyRunnable =
                () -> {
                    pendingBusyRunnable = null;
                    try {
                        action.run();
                    } catch (Exception ignored) {
                    } finally {
                        notifyAssistantSpeechEnded();
                    }
                };
            busyAckHandler.postDelayed(pendingBusyRunnable, d);
            return;
        }
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
     * Short acknowledgement + open target, then a second line after a pause (what the user can say next).
     * Keeps the same “open then coach” pattern for contacts, chat apps, and YouTube.
     */
    private static void speakOpenAppWithFollowUp(
        Context context,
        String raw,
        String shortLine,
        long delayMs,
        Runnable open,
        String followUp
    ) {
        if (isSilentWakeRouting()) {
            isAISpeaking = true;
            long d = Math.min(Math.max(delayMs, 0L), 900L);
            pendingBusyRunnable =
                () -> {
                    pendingBusyRunnable = null;
                    try {
                        open.run();
                    } catch (Exception ignored) {
                    } finally {
                        notifyAssistantSpeechEnded();
                    }
                };
            busyAckHandler.postDelayed(pendingBusyRunnable, d);
            return;
        }
        speakThen(
            context,
            shortLine,
            delayMs,
            () -> {
                try {
                    open.run();
                } catch (Exception ignored) {
                }
                if (followUp != null && !followUp.isEmpty()) {
                    busyAckHandler.postDelayed(() -> speak(context, followUp), 2350L);
                }
            });
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
                Voice v = pickBestAssistantVoice(tts, ASSISTANT_TTS_LOCALE);
                if (v != null && tts.setVoice(v) == TextToSpeech.SUCCESS) {
                    return;
                }
            }
            tts.setLanguage(ASSISTANT_TTS_LOCALE);
        } catch (Exception ignored) {
        }
    }

    /** Prefer highest-quality Hindi voice; no English fallback (assistant speaks Hindi only). */
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

    /**
     * “Open my contacts and call Aman” — resolve name from the contacts DB and open the dialer. Does not open the
     * contacts UI (lookup is in-memory). Returns false if this is not a contacts+call compound.
     */
    private static boolean handleCompoundContactsThenCall(Context context, String text, String raw) {
        if (text.contains("whatsapp")
            || text.contains("telegram")
            || text.contains("व्हाट्स")
            || text.contains("टेली")) {
            return false;
        }
        boolean wantsContacts =
            isContactsIntent(text)
                || text.contains("contact")
                || text.contains("phonebook")
                || text.contains("संपर्क")
                || text.contains("कॉन्टैक्ट")
                || text.contains("कांटेक्ट");
        boolean wantsCall =
            text.matches(".*\\b(call|dial|phone|ring)\\b.*") || text.contains("कॉल") || text.contains("फोन");
        if (!wantsContacts || !wantsCall) {
            return false;
        }
        String stripped =
            text.replaceAll("(?i)\\b(open|launch|show|start|please|my|the|list|and|then)\\b", " ")
                .replaceAll("(?i)\\b(contact|contacts|phonebook|phone book|address book)\\b", " ")
                .replaceAll("संपर्क|कॉन्टैक्ट|कांटेक्ट|फोन\\s*बुक|लिस्ट|सूची|खोल|खोलो|ओपन|और|फिर|then", " ")
                .replaceAll("\\s+", " ")
                .trim();
        String name = extractCallName(stripped);
        if (name == null || name.length() < 2) {
            name = extractCallName(text);
        }
        if (name == null || name.length() < 2) {
            return false;
        }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS)
                != PackageManager.PERMISSION_GRANTED) {
            return true;
        }
        String telUri = lookupDialStringForContactName(context, name);
        if (telUri == null) {
            return true;
        }
        final String dial = telUri;
        NeoPrefs.setLastVoiceAppContext(context, "contacts");
        speakThen(context, calmCallPhrase(raw), 200, () -> startTelIntent(context, dial));
        return true;
    }

    private static boolean isTimeIntent(String t) {
        return t.matches(".*\\b(time|what(?:'s| is)? the time|time now|current time)\\b.*")
            || t.contains("समय")
            || t.contains("टाइम");
    }

    private static String formatTimeNow() {
        java.text.SimpleDateFormat fmt = new java.text.SimpleDateFormat("h:mm a", ASSISTANT_TTS_LOCALE);
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

    /**
     * Hindi/Hinglish “गाना चलाओ …”, “चलाओ गाना …” — title after the trigger (no “यूट्यूब” word required).
     */
    private static boolean isLikelyYouTubeSongCommand(String t) {
        if (t == null || t.isEmpty()) return false;
        if (t.contains("यूट्यूब") || t.contains("youtube") || t.contains("you tube")) return true;
        boolean hasSongWord = t.contains("गाना") || t.contains("गाने") || t.contains("संगीत");
        boolean hasPlayVerb =
            t.contains("चलाओ")
                || t.contains("बजाओ")
                || t.contains("सुना")
                || t.contains("सुनाओ")
                || t.contains("भजाओ")
                || t.matches(".*\\bplay\\b.*");
        return hasSongWord && hasPlayVerb;
    }

    /** Prefer the substring after a Hindi play-song trigger so the search query is the real title/artist. */
    private static String extractHindiSongSearchTail(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        Matcher m1 =
            Pattern.compile(
                    "(?:गाना|गाने|संगीत)\\s+(?:चलाओ|चला\\s*दो|चला\\s*दीजिए|बजाओ|भजाओ|सुना\\s*दो|सुनाओ|खोलो|खोल)\\s+(.+)",
                    Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
                .matcher(s);
        if (m1.find()) {
            return m1.group(1).trim();
        }
        Matcher m2 =
            Pattern.compile(
                    "(?:चलाओ|चला\\s*दो|बजाओ|भजाओ|सुना\\s*दो|सुनाओ|खोलो|खोल)\\s+(?:गाना|गाने|संगीत)\\s+(.+)",
                    Pattern.CASE_INSENSITIVE | Pattern.DOTALL)
                .matcher(s);
        if (m2.find()) {
            return m2.group(1).trim();
        }
        Matcher m3 =
            Pattern.compile(
                    "(?:youtube|you\\s*tube|यूट्यूब)\\s+(?:पर\\s+)?(.+?)\\s+(?:चलाओ|बजाओ|चला|सुना|खोल)",
                    Pattern.CASE_INSENSITIVE)
                .matcher(s);
        if (m3.find()) {
            return m3.group(1).trim();
        }
        return null;
    }

    /**
     * Opens YouTube with {@link Intent#ACTION_SEARCH} first — on many builds the first result starts inline
     * (closest we can get to “auto play” without a Data API key). Falls back to {@code vnd.youtube:results}.
     */
    private static void openYouTubeSearchForPlayback(Context context, String query) {
        String q = query == null ? "" : query.trim();
        if (q.isEmpty()) q = "latest songs";
        final String ytPkg = "com.google.android.youtube";
        if (!canLaunchExternalUiNow(context)) {
            speak(
                context,
                "फोन स्क्रीन खोलकर नियो ऐप सामने रखें, तभी मैं दूसरे ऐप को खोल सकता हूँ।");
            return;
        }
        PackageManager pm = context.getPackageManager();
        if (pm.getLaunchIntentForPackage(ytPkg) != null) {
            Intent search = new Intent(Intent.ACTION_SEARCH);
            search.setPackage(ytPkg);
            search.putExtra("query", q);
            search.putExtra(SearchManager.QUERY, q);
            search.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (startActivityCompat(context, search)) {
                return;
            }
        }
        openPreferredAppThenStore(
            context,
            new String[] {ytPkg},
            Uri.parse("vnd.youtube:results?search_query=" + Uri.encode(q)),
            ytPkg);
    }

    private static String extractYouTubeQuery(String t) {
        boolean asksYouTube = t.contains("youtube")
            || t.contains("you tube")
            || t.contains("यूट्यूब")
            || t.contains("song")
            || t.contains("music")
            || t.contains("gaana")
            || t.contains("gana")
            || t.contains("singer")
            || t.contains("akhil")
            || t.contains("गाना")
            || t.contains("गाने")
            || t.contains("संगीत")
            || t.contains("म्यूजिक")
            || t.contains("सिंगर")
            || isLikelyYouTubeSongCommand(t);
        if (!asksYouTube) return null;

        String fromHindi = extractHindiSongSearchTail(t);
        String base = fromHindi != null && fromHindi.length() >= 1 ? fromHindi : t;

        String q = base
            .replaceAll("\\b(hello|hey|hi|neo)\\b", "")
            .replaceAll("\\b(play|listen|start|open|on|in|youtube|you\\s*tube|song|music|by singer|singer)\\b", "")
            .replaceAll("\\b(gaana|gana)\\b", "")
            .replaceAll(
                "यूट्यूब|गाना|गाने|संगीत|म्यूजिक|सिंगर|चलाओ|चला\\s*दो|चला\\s*दीजिए|बजाओ|भजाओ|सुना\\s*दो|सुनाओ|सुना\\s*ओ",
                "")
            .replaceAll("\\b(of|by|ka|ki|ke)\\b", "")
            .replaceAll("\\s+", " ")
            .trim();
        if (q.isEmpty()) q = "latest songs";
        return q;
    }

    private static boolean prefersWhatsAppBusiness(String t) {
        return t.contains("business")
            || t.contains("biz")
            || t.contains("बिजनेस")
            || t.contains("व्हाट्सएप बिजनेस")
            || t.contains("व्हाट्सऐप बिजनेस");
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
                || t.contains("संदेश")
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
                || t.contains("पढ़ो")
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
                || t.contains("सुनाओ")
                || t.contains("सुना")
                || t.matches(".*\\bcheck\\b.*\\b(message|messages|sms|notification|notif)\\b.*")
                || t.matches(".*\\b(message|messages|sms)\\b.*\\bcheck\\b.*")
                /* Hindi: “राज के लिए संदेश पढ़ो”, “नया संदेश सुनाओ” */
                || (t.contains("के लिए")
                    && (t.contains("संदेश") || t.contains("मैसेज"))
                    && (t.contains("पढ़")
                        || t.contains("पढ़ो")
                        || t.contains("सुन")
                        || t.contains("बताओ")))
                || (t.contains("नया") && (t.contains("संदेश") || t.contains("मैसेज")) && (t.contains("सुन") || t.contains("बताओ")));
        boolean openOnly =
            (t.contains("open") || t.contains("launch") || t.contains("start") || t.contains("खोल"))
                && (t.contains("whatsapp") || t.contains("telegram"));
        return readish && !openOnly;
    }

    private static String explainCantReadMessages() {
        return "पूरा चैट सीधे नहीं पढ़ सकते। सेटिंग्स में नियो के लिए Notification access चालू करें—तब नवीनतम WhatsApp/Telegram सूचना पढ़ सकता हूँ। फिर बोलिए: व्हाट्सऐप खोलो या टेलीग्राम खोलो।";
    }

    /**
     * Reads a matching notification line (WhatsApp / Telegram) when notification access is on. Optionally filters by
     * contact name spoken after “के लिए”.
     */
    private static boolean tryReadMessengerNotification(Context context, String text, String raw) {
        boolean wantWa =
            text.contains("whatsapp")
                || text.contains("व्हाट्स")
                || text.contains("वाट्स")
                || text.contains("व्हाट्सऐप");
        boolean wantTg = text.contains("telegram") || text.contains("टेली");
        if (!wantWa && !wantTg) {
            wantWa = true;
        }
        String personHint = extractPersonHintForMessageRead(raw);
        JSONObject hit = findMessengerNotifForHint(context, wantWa, wantTg, personHint);
        if (hit == null) {
            if (personHint != null && personHint.length() >= 2) {
                return false;
            }
            if (wantWa && !wantTg) {
                String snap = NeoPrefs.getLastWhatsAppNotification(context);
                if (snap != null && !snap.trim().isEmpty()) {
                    final String snippet = snap.trim();
                    speakThen(
                        context,
                        "आपकी आखिरी व्हाट्सऐप सूचना: " + snippet,
                        2000,
                        () ->
                            openPreferredAppThenStore(
                                context,
                                new String[] {"com.whatsapp", "com.whatsapp.w4b"},
                                Uri.parse("whatsapp://send"),
                                "com.whatsapp"));
                    return true;
                }
            }
            return false;
        }
        String title = hit.optString("title", "").trim();
        String body = hit.optString("text", "").trim();
        String app = hit.optString("app", "wa");
        String line = title.isEmpty() ? body : (body.isEmpty() ? title : title + " — " + body);
        if (line.length() > 520) {
            line = line.substring(0, 517) + "...";
        }
        final String speakLine = line;
        final boolean openWa = "wa".equals(app);
        speakThen(
            context,
            ("wa".equals(app) ? "व्हाट्सऐप" : "टेलीग्राम") + " की सूचना: " + speakLine,
            2200,
            () -> {
                if (openWa) {
                    openPreferredAppThenStore(
                        context,
                        new String[] {"com.whatsapp", "com.whatsapp.w4b"},
                        Uri.parse("whatsapp://send"),
                        "com.whatsapp");
                } else {
                    openPreferredAppThenStore(
                        context,
                        new String[] {"org.telegram.messenger", "org.thunderdog.challegram"},
                        Uri.parse("tg://"),
                        "org.telegram.messenger");
                }
            });
        return true;
    }

    private static String extractPersonHintForMessageRead(String raw) {
        if (raw == null) {
            return null;
        }
        Matcher m =
            Pattern.compile("(.+?)\\s+के\\s+लिए\\s+(?:नया\\s+)?(?:संदेश|मैसेज|मेसेज)", Pattern.CASE_INSENSITIVE)
                .matcher(raw.trim());
        if (!m.find()) {
            return null;
        }
        String h = sanitizeCallNameCandidate(m.group(1));
        if (h == null || h.length() < 2) {
            return null;
        }
        String low = h.toLowerCase(Locale.ROOT);
        if (low.matches("(?i)(इस|उस|this|that|the)(\\s+व्यक्ति)?")) {
            return null;
        }
        return h;
    }

    private static JSONObject findMessengerNotifForHint(
        Context context, boolean wantWa, boolean wantTg, String personHint) {
        JSONArray log = NeoPrefs.getMessengerNotifLog(context);
        if (log.length() == 0) {
            return null;
        }
        String hintNorm =
            personHint == null
                ? ""
                : personHint.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
        for (int i = 0; i < log.length(); i++) {
            try {
                JSONObject o = log.getJSONObject(i);
                String app = o.optString("app", "");
                if (wantWa && !wantTg && !"wa".equals(app)) {
                    continue;
                }
                if (wantTg && !wantWa && !"tg".equals(app)) {
                    continue;
                }
                if (wantWa && wantTg && !("wa".equals(app) || "tg".equals(app))) {
                    continue;
                }
                if (hintNorm.length() < 2) {
                    return o;
                }
                String title = o.optString("title", "").toLowerCase(Locale.ROOT);
                String tx = o.optString("text", "").toLowerCase(Locale.ROOT);
                if (title.contains(hintNorm)
                    || tx.contains(hintNorm)
                    || scoreContactNameMatch(title.replace(":", " "), hintNorm) >= 62) {
                    return o;
                }
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    /** Messenger + name (find/search/chat) → opens chat via deep link after contact lookup. */
    private static boolean handleMessengerFindContact(Context context, String text, String raw) {
        boolean findy =
            text.contains("ढूंढो")
                || text.contains("ढूंढ")
                || text.contains("dhundho")
                || text.contains("dhoondo")
                || text.contains("find ")
                || text.contains(" search")
                || text.contains("खोजो")
                || text.contains("खोज");
        boolean wa =
            text.contains("whatsapp")
                || text.contains("व्हाट्स")
                || text.contains("वाट्स")
                || text.replace(" ", "").contains("व्हाट्सएप");
        boolean tg =
            text.contains("telegram")
                || text.contains("टेली")
                || text.replace(" ", "").contains("टेलीग्राम");
        if (!wa && !tg) {
            String ctx = NeoPrefs.getLastVoiceAppContext(context);
            if ("wa".equals(ctx)) {
                wa = true;
            } else if ("tg".equals(ctx)) {
                tg = true;
            }
        }
        if (!wa && !tg) {
            return false;
        }
        String name = extractNameForMessengerFind(raw);
        boolean hasName = name != null && name.length() >= 2;
        if (!findy && !hasName) {
            return false;
        }
        boolean opens =
            text.contains("खोल")
                || text.contains("ओपन")
                || text.contains("open")
                || text.contains("launch")
                || text.contains("start");
        boolean hasMessageContext =
            text.contains("chat")
                || text.contains("चैट")
                || text.contains("message")
                || text.contains("मैसेज")
                || text.contains("संदेश");
        if (!opens && !findy && !hasMessageContext) {
            return false;
        }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS)
                != PackageManager.PERMISSION_GRANTED) {
            speak(
                context,
                "संपर्क से चैट खोलने के लिए सेटिंग्स में नियो को संपर्क पढ़ने की अनुमति दें।");
            return true;
        }
        if (name == null || name.length() < 2) {
            speak(context, "किस नाम से ढूंढना है? जैसे—व्हाट्सऐप खोलो और राज को ढूंढो।");
            return true;
        }
        String telUri = lookupDialStringForContactName(context, name);
        if (telUri == null) {
            speak(
                context,
                "यह नाम आपकी संपर्क सूची में नहीं मिला। जिस नाम से सेव है, वही बोलकर फिर कोशिश करिए।");
            return true;
        }
        String phoneDigits = telUri.replaceAll("[^0-9]", "");
        if (phoneDigits.startsWith("91") && phoneDigits.length() == 12) {
            /* ok */
        } else if (phoneDigits.length() >= 11) {
            /* ok */
        } else {
            speak(context, "फ़ोन नंबर पूरा नहीं मिला। कृपया संपर्क में नंबर जोड़कर फिर कोशिश करें।");
            return true;
        }
        NeoPrefs.setVoiceComposeTarget(context, wa ? "wa" : "tg", phoneDigits, name);
        NeoPrefs.setLastVoiceAppContext(context, wa ? "wa" : "tg");
        if (wa) {
            final Uri appUri = Uri.parse("whatsapp://send?phone=" + phoneDigits);
            speakOpenAppWithFollowUp(
                context,
                raw,
                "ठीक है, व्हाट्सऐप में " + name + " की चैट खोल रहा हूँ।",
                1400,
                () ->
                    openPreferredAppThenStore(
                        context,
                        new String[] {"com.whatsapp", "com.whatsapp.w4b"},
                        appUri,
                        "com.whatsapp"),
                "चैट खुल गई है। अब बोलिए—इसे ये संदेश भेजो, और अपना मैसेज बोल दीजिए। भेजने के लिए व्हाट्सऐप में भेजें दबाना पड़ सकता है।");
        } else {
            final Uri appUri = Uri.parse("tg://resolve?phone=%2B" + phoneDigits);
            speakOpenAppWithFollowUp(
                context,
                raw,
                "ठीक है, टेलीग्राम में " + name + " से जुड़ रहा हूँ।",
                1400,
                () ->
                    openPreferredAppThenStore(
                        context,
                        new String[] {"org.telegram.messenger", "org.thunderdog.challegram"},
                        appUri,
                        "org.telegram.messenger"),
                "टेलीग्राम खुल गया है। अब बोलिए—इसे ये संदेश भेजो, और अपना मैसेज बोल दीजिए।");
        }
        return true;
    }

    private static String extractNameForMessengerFind(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim();
        Matcher m0 =
            Pattern.compile(
                    "(?is)(?:whatsapp|telegram|व्हाट्स(?:ऐप|एप)?|टेली(?:ग्राम)?)\\s+(?:खोलो|ओपन|open)?\\s*(?:और|and)?\\s*(.+?)\\s+को\\b")
                .matcher(s);
        if (m0.find()) {
            return sanitizeCallNameCandidate(m0.group(1));
        }
        Matcher m1 = Pattern.compile("(?:और|and)\\s+(.+?)\\s+को\\s*(?:ढूंढो|ढूंढ|खोजो|खोज)", Pattern.CASE_INSENSITIVE).matcher(s);
        if (m1.find()) {
            return sanitizeCallNameCandidate(m1.group(1));
        }
        Matcher m1b =
            Pattern.compile("(?:whatsapp|telegram|व्हाट्स(?:ऐप|एप)?|टेली(?:ग्राम)?)\\s+(?:chat|चैट|message|मैसेज|संदेश)\\s+(.+)$", Pattern.CASE_INSENSITIVE)
                .matcher(s);
        if (m1b.find()) {
            return sanitizeCallNameCandidate(m1b.group(1));
        }
        Matcher m2 =
            Pattern.compile("(?:ढूंढो|ढूंढ|खोजो|खोज|find|search)\\s+(.+?)(?:\\s+please)?$", Pattern.CASE_INSENSITIVE)
                .matcher(s);
        if (m2.find()) {
            return sanitizeCallNameCandidate(m2.group(1));
        }
        Matcher m3 = Pattern.compile("(.+?)\\s+को\\s*(?:ढूंढो|ढूंढ|खोजो)", Pattern.CASE_INSENSITIVE).matcher(s);
        if (m3.find()) {
            return sanitizeCallNameCandidate(m3.group(1));
        }
        return null;
    }

    /** “इसे ये संदेश भेजो …” — opens compose with prefilled text (user may still tap Send in WhatsApp/Telegram). */
    private static boolean handleVoiceComposeSendMessage(Context context, String text, String raw) {
        boolean hasSavedChat = NeoPrefs.getVoiceComposePhoneDigits(context).length() >= 11;
        boolean looksCompose =
            text.contains("भेजो")
                || text.contains("भेजें")
                || text.contains("लिखो")
                || text.contains("टाइप")
                || text.contains("type")
                || raw.matches("(?is).*(इसे|उसे)\\s+(?:ये\\s+)?(?:संदेश|मैसेज|मेसेज).*भेज.*")
                || raw.matches("(?is).*\\bsend\\s+this\\s+message\\b.*")
                || raw.matches("(?is).*\\btext\\s+them\\b.*")
                || raw.matches("(?is).*\\btype\\b.*")
                || raw.matches("(?is).*\\b(?:message|text)\\s+(?:him|her|them|me)\\b.*")
                || (hasSavedChat
                    && (raw.matches("(?is).*\\bsend\\s+message\\s+.+")
                        || raw.matches("(?is)\\btype\\s+(.+)$")
                        || raw.matches("(?is)(?:लिखो|टाइप\\s+करो)\\s+(.+)$")));
        if (!looksCompose) {
            return false;
        }
        String body = extractVoiceComposeMessageBody(raw);
        if (body == null || body.length() < 1) {
            return false;
        }
        if (body.length() > 1500) {
            body = body.substring(0, 1500);
        }
        String app = NeoPrefs.getVoiceComposeApp(context);
        String phone = NeoPrefs.getVoiceComposePhoneDigits(context);
        if (phone == null || phone.length() < 11) {
            speak(
                context,
                "पहले किसी चैट को खोलें—जैसे व्हाट्सऐप खोलो और नाम को ढूंढो, या नंबर के साथ व्हाट्सऐप खोलें। फिर बोलिए, इसे ये संदेश भेजो।");
            return true;
        }
        if ("wa".equals(app)) {
            String enc = Uri.encode(body);
            final Uri appUri = Uri.parse("whatsapp://send?phone=" + phone + "&text=" + enc);
            speakOpenAppWithFollowUp(
                context,
                raw,
                "ठीक है, व्हाट्सऐप में टाइप कर रहा हूँ। भेजने के लिए ज़रूरत पड़ने पर आप भेजें दबा दीजिएगा।",
                1200,
                () ->
                    openPreferredAppThenStore(
                        context,
                        new String[] {"com.whatsapp", "com.whatsapp.w4b"},
                        appUri,
                        "com.whatsapp"),
                null);
            return true;
        }
        if ("tg".equals(app)) {
            String enc = Uri.encode(body);
            final Uri appUri = Uri.parse("tg://msg?text=" + enc + "&to=" + Uri.encode("+" + phone));
            speakOpenAppWithFollowUp(
                context,
                raw,
                "ठीक है, टेलीग्राम में मैसेज भर रहा हूँ। ज़रूरत पड़ने पर आप भेजें दबा दीजिएगा।",
                1200,
                () ->
                    openPreferredAppThenStore(
                        context,
                        new String[] {"org.telegram.messenger", "org.thunderdog.challegram"},
                        appUri,
                        "org.telegram.messenger"),
                null);
            return true;
        }
        speak(
            context,
            "पहले व्हाट्सऐप या टेलीग्राम में चैट खोलें, फिर इसे ये संदेश भेजो बोलिए।");
        return true;
    }

    private static String extractVoiceComposeMessageBody(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim();
        String[][] patterns =
            new String[][] {
                /* Hindi / Hinglish */
                {"(?is)(इसे|उसे)\\s+(?:ये\\s+)?(?:संदेश|मेसेज|मैसेज)\\s+(?:भेजो|भेजें)\\s+(.+)"},
                {"(?is)(?:ये\\s+)?(?:संदेश|मैसेज)\\s+(?:भेजो|भेजें)\\s+(.+)"},
                {"(?is)(?:इसे|उसे)\\s+(?:ये\\s+)?(?:लिखो|लिखकर\\s+भेजो)\\s+(.+)"},
                {"(?is)(?:लिखो|टाइप\\s+करो)\\s+(.+)"},
                /* English */
                {"(?is)\\b(?:send|text)\\s+(?:this\\s+)?(?:message|msg)\\s*(?:to\\s+them)?\\s*[:\\-]?\\s*(.+)"},
                {"(?is)\\bsend\\s+message\\s+(.+)"},
                {"(?is)\\b(?:message|text)\\s+(?:him|her|them|me)\\s+(.+)"},
                {"(?is)\\btype\\s+(.+)$"},
            };
        for (String[] row : patterns) {
            Matcher m = Pattern.compile(row[0]).matcher(s);
            if (m.find()) {
                String out = m.group(1).trim();
                out = out.replaceAll("[\\p{Cntrl}]", " ").replaceAll("\\s+", " ").trim();
                return out.isEmpty() ? null : out;
            }
        }
        return null;
    }

    private static boolean isWhatsAppIntent(String t) {
        boolean hasWord =
            t.contains("whatsapp")
                || t.contains("व्हाट्सएप")
                || t.contains("वाट्सऐप")
                || t.contains("व्हाट्सऐप")
                /* ASR often inserts a space: "व्हाट्स एप खोलो" */
                || t.replace(" ", "").contains("व्हाट्सएप")
                || t.replace(" ", "").contains("वाट्सऐप")
                || t.replace(" ", "").contains("व्हाट्सऐप");
        if (!hasWord) return false;
        String tr = t.trim();
        /* Follow-up turn: user often says only the app name. */
        if (tr.matches("(?i)whatsapp!?")
            || tr.replace(" ", "").equals("व्हाट्सएप")
            || tr.replace(" ", "").equals("वाट्सऐप")
            || tr.replace(" ", "").equals("व्हाट्सऐप")) {
            return true;
        }
        return t.matches(".*\\b(open|launch|start|show)\\b.*")
            || t.matches(".*\\bmy\\s+whatsapp\\b.*")
            || t.contains("ओपन")
            || t.contains("खोलो")
            || t.contains("खोल")
            || t.contains("चलाओ")
            || t.contains("चला")
            || t.contains("दिखाओ")
            || t.contains("दिखा")
            || t.contains("जाओ");
    }

    private static boolean isTelegramIntent(String t) {
        boolean hasWord =
            t.contains("telegram")
                || t.contains("टेलीग्राम")
                || t.contains("टेलिग्राम")
                || t.replace(" ", "").contains("टेलीग्राम")
                || t.replace(" ", "").contains("टेलिग्राम");
        if (!hasWord) return false;
        String tr = t.trim();
        if (tr.matches("(?i)telegram!?")
            || tr.replace(" ", "").equals("टेलीग्राम")
            || tr.replace(" ", "").equals("टेलिग्राम")) {
            return true;
        }
        return t.matches(".*\\b(open|launch|start|show)\\b.*")
            || t.matches(".*\\bmy\\s+telegram\\b.*")
            || t.contains("ओपन")
            || t.contains("खोलो")
            || t.contains("खोल")
            || t.contains("चलाओ")
            || t.contains("चला")
            || t.contains("दिखाओ")
            || t.contains("दिखा")
            || t.contains("जाओ");
    }

    private static boolean isContactsIntent(String t) {
        if (t.contains("play store") || t.contains("playstore") || t.contains("app store")) {
            return false;
        }
        /* Hinglish: "मेरी कॉन्टैक्ट लिस्ट खोलो" — avoid matching WhatsApp/Telegram "contacts" inside those apps. */
        boolean mentionsWaTg = t.contains("whatsapp") || t.contains("telegram") || t.contains("व्हाट्स") || t.contains("टेली");
        if (!mentionsWaTg
            && (t.contains("कॉन्टैक्ट")
                || t.contains("कांटेक्ट")
                || t.contains("contact list")
                || t.contains("contacts list"))) {
            if (t.contains("खोल")
                || t.contains("open")
                || t.contains("launch")
                || t.contains("show")
                || t.contains("start")
                || t.contains("दिखा")
                || t.contains("ओपन")
                || t.contains("लिस्ट")
                || t.contains("list")
                || t.contains("सूची")) {
                return true;
            }
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
        if (isOpenProfileOrAccountIntent(t)) {
            return false;
        }
        if (isLikelyYouTubeSongCommand(t)) {
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
        return startActivityCompat(context, launch);
    }

    private static void openContactsApp(Context context) {
        Intent view = new Intent(Intent.ACTION_VIEW);
        view.setData(Uri.parse("content://com.android.contacts/contacts"));
        if (startActivityCompat(context, view)) {
            return;
        }
        Intent main = new Intent(Intent.ACTION_MAIN);
        main.addCategory(Intent.CATEGORY_APP_CONTACTS);
        if (startActivityCompat(context, main)) {
            return;
        }
        Intent pick = new Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI);
        startActivityCompat(context, pick);
    }

    private static boolean isCallByNameIntent(String t) {
        if (!(t.matches(".*\\b(call|dial|phone|ring)\\b.*")
                || t.contains("कॉल")
                || t.contains("फोन"))) {
            return false;
        }
        if (extractTel(t) != null) {
            return false;
        }
        String name = extractCallName(t);
        return name != null && name.length() >= 2;
    }

    /**
     * Hindi/Hinglish: "राज को कॉल लगाओ", "विजय जी को फोन करो"; English: "call raj", "dial mom".
     * {@link #lookupDialStringForContactName} scores display names — extract a short spoken name, not filler words.
     */
    private static String extractCallName(String t) {
        if (t == null) {
            return null;
        }
        String s = t.trim();

        Matcher koCall =
            Pattern.compile(
                    "(.+?)\\s+को\\s+(कॉल|काल|फोन)(?:\\s+(लगा(?:ओ|एं|ें|ो|े|ों)|कर(?:ो|ें|दो)))?\\s*$",
                    Pattern.CASE_INSENSITIVE)
                .matcher(s);
        if (koCall.find()) {
            String name = sanitizeCallNameCandidate(koCall.group(1));
            if (name != null && name.length() >= 2) {
                return name;
            }
        }
        Matcher koCallFuture =
            Pattern.compile(
                    "(.+?)\\s+को\\s+(कॉल|काल|फोन)\\s+करना\\s+है\\s*$",
                    Pattern.CASE_INSENSITIVE)
                .matcher(s);
        if (koCallFuture.find()) {
            String name = sanitizeCallNameCandidate(koCallFuture.group(1));
            if (name != null && name.length() >= 2) {
                return name;
            }
        }
        Matcher mujheCall =
            Pattern.compile(
                    "(?:मुझे|mujhe|mje)\\s+(.+?)\\s+को\\s+(?:कॉल|काल|फोन|call|dial)\\s+(?:करना\\s+है|karna\\s+hai)\\s*$",
                    Pattern.CASE_INSENSITIVE)
                .matcher(s);
        if (mujheCall.find()) {
            String name = sanitizeCallNameCandidate(mujheCall.group(1));
            if (name != null && name.length() >= 2) {
                return name;
            }
        }

        Matcher lagaoFirst =
            Pattern.compile("(?:कॉल|काल|फोन)\\s+लगा(?:ओ|एं|ें|ो|े|ों)?\\s+(.+?)\\s+को\\s*$", Pattern.CASE_INSENSITIVE)
                .matcher(s);
        if (lagaoFirst.find()) {
            String name = sanitizeCallNameCandidate(lagaoFirst.group(1));
            if (name != null && name.length() >= 2) {
                return name;
            }
        }

        Matcher enCall =
            Pattern.compile(
                    "\\b(call|dial|phone|ring)\\s+(.+?)(?:\\s+please|\\s+now)?\\s*$", Pattern.CASE_INSENSITIVE)
                .matcher(s);
        if (enCall.find()) {
            String tail = sanitizeCallNameCandidate(enCall.group(2));
            if (tail != null && tail.length() >= 2) {
                return tail;
            }
        }
        Matcher enCallKaro =
            Pattern.compile(
                    "\\b(call|dial|phone|ring)\\s+(?:karo|kro|karo\\s+na|karna)\\s+(.+?)\\s*$",
                    Pattern.CASE_INSENSITIVE)
                .matcher(s);
        if (enCallKaro.find()) {
            String tail = sanitizeCallNameCandidate(enCallKaro.group(2));
            if (tail != null && tail.length() >= 2) {
                return tail;
            }
        }
        Matcher nameKoCall =
            Pattern.compile(
                    "(.+?)\\s+ko\\s+\\b(call|dial|phone|ring)\\b(?:\\s+(?:karo|kro|please|now))?\\s*$",
                    Pattern.CASE_INSENSITIVE)
                .matcher(s);
        if (nameKoCall.find()) {
            String tail = sanitizeCallNameCandidate(nameKoCall.group(1));
            if (tail != null && tail.length() >= 2) {
                return tail;
            }
        }

        String n =
            s.replaceAll(
                    "(?iu)\\b(hello|hey|hi|neo|new|please|now|can you|could you|want to|need to|have to|will you)\\b",
                    " ")
                .replaceAll("(?iu)\\b(call|dial|phone|ring|mobile|cell|give|make|place|put)\\b", " ")
                .replaceAll("(?iu)\\b(a|an|the|to|for|on|me|my|up|out)\\b", " ")
                .replaceAll("(?iu)\\b(sir|madam|saab|sirji|uncle|aunty)\\b", " ")
                .replaceAll("(?:^|\\s)(मेरे|मेरी|मेरा|मुझे|इसे|उसे|को|कॉल|फोन|लगाओ|लगा|करो|करें|करदो)(?:\\s|$)", " ")
                .replaceAll("(?iu)\\b(ko|karo|kro|krdo|kr do|kar do|karna|lagao|laga)\\b", " ")
                .replaceAll("(?:^|\\s)(है|हूं|हूँ|था|थी|करना|करना है|करना है\\s*)", " ")
                .replaceAll("(?iu)\\b(hai|hu|hoon|hun|tha|thi|karna|karna hai)\\b", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return n.isEmpty() ? null : n;
    }

    private static String sanitizeCallNameCandidate(String raw) {
        if (raw == null) {
            return null;
        }
        String n =
            raw.replaceAll(
                    "(?iu)\\b(hello|hey|hi|neo|new|please|now|can you|could you|want to|need to|have to|will you)\\b",
                    " ")
                .replaceAll("(?iu)\\b(call|dial|phone|ring|mobile|cell|give|make|place|put)\\b", " ")
                .replaceAll("(?iu)\\b(a|an|the|to|for|on|me|my|up|out)\\b", " ")
                .replaceAll("(?iu)\\b(sir|madam|saab|sirji|uncle|aunty)\\b", " ")
                .replaceAll("(?:^|\\s)(मेरे|मेरी|मेरा|मुझे|इसे|उसे)(?:\\s|$)", " ")
                .replaceAll("(?iu)\\b(ko|karo|kro|krdo|kr do|kar do|karna|ko call|ko phone)\\b", " ")
                .replaceAll("(?:^|\\s)(है|हूं|हूँ|था|थी|करना|करना है|चाहिए)(?:\\s|$)", " ")
                .replaceAll("(?iu)\\b(hai|hu|hoon|hun|tha|thi|karna|karna hai|chahiye)\\b", " ")
                .replaceAll("\\s+", " ")
                .trim();
        /* Trailing honorific (विजय जी → विजय) */
        n = n.replaceAll("(?iu)\\s+(जी|ji)\\s*$", "").trim();
        return n.isEmpty() ? null : n;
    }

    /** One-shot command: resolve name from contacts + open prefilled compose in WhatsApp/Telegram. */
    private static boolean handleDirectComposeByName(Context context, String text, String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return false;
        }
        boolean wa =
            text.contains("whatsapp")
                || text.contains("व्हाट्स")
                || text.contains("वाट्स")
                || text.replace(" ", "").contains("व्हाट्सएप");
        boolean tg =
            text.contains("telegram")
                || text.contains("टेली")
                || text.replace(" ", "").contains("टेलीग्राम");
        if (!wa && !tg) {
            String ctx = NeoPrefs.getLastVoiceAppContext(context);
            if ("wa".equals(ctx)) {
                wa = true;
            } else if ("tg".equals(ctx)) {
                tg = true;
            }
        }
        if (!wa && !tg) {
            return false;
        }
        Matcher m =
            Pattern.compile(
                    "(?is)(.+?)\\s+(?:ko|को)\\s+(?:message|msg|text|मैसेज|मेसेज|संदेश)\\s+(?:bhejo|भेजो|भेजें|send)\\s+(.+)$")
                .matcher(raw.trim());
        if (!m.find()) {
            m =
                Pattern.compile(
                        "(?is)(?:send|text)\\s+(?:message\\s+)?(?:to\\s+)?(.+?)\\s*[:\\-]?\\s+(.+)$")
                    .matcher(raw.trim());
            if (!m.find()) {
                return false;
            }
        }
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS)
                != PackageManager.PERMISSION_GRANTED) {
            speak(context, "इस काम के लिए संपर्क अनुमति चाहिए। सेटिंग्स में नियो को Contacts अनुमति दें।");
            return true;
        }
        String name = sanitizeCallNameCandidate(m.group(1));
        String body = m.group(2) == null ? "" : m.group(2).trim().replaceAll("\\s+", " ");
        if (name == null || name.length() < 2 || body.isEmpty()) {
            return false;
        }
        if (body.length() > 1500) {
            body = body.substring(0, 1500);
        }
        final String messageBody = body;
        String telUri = lookupDialStringForContactName(context, name);
        if (telUri == null) {
            speak(context, "यह नाम संपर्क सूची में नहीं मिला। जैसे सेव है, वैसा नाम बोलें।");
            return true;
        }
        String phoneDigits = telUri.replaceAll("[^0-9]", "");
        if (phoneDigits.length() < 11) {
            speak(context, "संपर्क का नंबर पूरा नहीं मिला। नंबर अपडेट करके फिर कोशिश करें।");
            return true;
        }
        NeoPrefs.setVoiceComposeTarget(context, wa ? "wa" : "tg", phoneDigits, name);
        NeoPrefs.setLastVoiceAppContext(context, wa ? "wa" : "tg");
        if (wa) {
            final Uri appUri =
                Uri.parse("whatsapp://send?phone=" + phoneDigits + "&text=" + Uri.encode(messageBody));
            speakOpenAppWithFollowUp(
                context,
                raw,
                "ठीक है, " + name + " को व्हाट्सऐप संदेश तैयार कर रहा हूँ।",
                1200,
                () ->
                    openPreferredAppThenStore(
                        context,
                        new String[] {"com.whatsapp", "com.whatsapp.w4b"},
                        appUri,
                        "com.whatsapp"),
                "मैसेज भर दिया है। भेजने के लिए जरूरत हो तो Send दबा दीजिए।");
            return true;
        }
        final Uri appUri =
            Uri.parse("tg://msg?text=" + Uri.encode(messageBody) + "&to=" + Uri.encode("+" + phoneDigits));
        speakOpenAppWithFollowUp(
            context,
            raw,
            "ठीक है, " + name + " को टेलीग्राम संदेश तैयार कर रहा हूँ।",
            1200,
            () ->
                openPreferredAppThenStore(
                    context,
                    new String[] {"org.telegram.messenger", "org.thunderdog.challegram"},
                    appUri,
                    "org.telegram.messenger"),
            "मैसेज तैयार है। भेजने के लिए जरूरत हो तो Send दबा दीजिए।");
        return true;
    }

    /**
     * Scores how well a contact display name matches a voice query. Favours matching surnames so STT errors
     * in the first name (e.g. “Kuro” vs “Kuldeep”) still find “… Jaswant”.
     */
    private static int scoreContactNameMatch(String displayNorm, String queryNorm) {
        if (queryNorm == null || queryNorm.isEmpty()) {
            return 0;
        }
        if (displayNorm.equals(queryNorm)) {
            return 100;
        }
        if (displayNorm.startsWith(queryNorm)) {
            return 93;
        }
        if (displayNorm.contains(queryNorm)) {
            return 86;
        }

        String[] qTok = queryNorm.split("\\s+");
        String[] dTok = displayNorm.split("\\s+");

        if (qTok.length > 0 && dTok.length > 0) {
            String qLast = qTok[qTok.length - 1];
            String dLast = dTok[dTok.length - 1];
            if (qLast.length() >= 2 && qLast.equals(dLast)) {
                return 90;
            }
            if (qLast.length() >= 3 && dLast.contains(qLast)) {
                return 87;
            }
            if (qLast.length() >= 4 && dLast.length() >= 4) {
                int prefix = 0;
                int lim = Math.min(qLast.length(), dLast.length());
                for (int i = 0; i < lim; i++) {
                    if (qLast.charAt(i) == dLast.charAt(i)) {
                        prefix++;
                    } else {
                        break;
                    }
                }
                if (prefix >= Math.min(4, qLast.length() - 1)) {
                    return 80;
                }
            }
        }

        int sigHits = 0;
        for (String q : qTok) {
            if (q.length() < 3) {
                continue;
            }
            if (displayNorm.contains(q)) {
                sigHits++;
            }
        }
        if (sigHits >= 2) {
            return 82;
        }
        if (sigHits == 1 && qTok.length >= 2) {
            return 74;
        }
        if (sigHits == 1) {
            return 68;
        }

        if (qTok.length > 0) {
            String ql = qTok[qTok.length - 1];
            if (ql.length() >= 3 && displayNorm.contains(ql)) {
                return 70;
            }
        }
        return 0;
    }

    private static String normalizePhoneFieldToTelUri(String phoneField) {
        if (phoneField == null) {
            return null;
        }
        String trimmed = phoneField.trim();
        if (trimmed.startsWith("+")) {
            String d = trimmed.replaceAll("[^+\\d]", "");
            return d.length() >= 8 ? "tel:" + d : null;
        }
        String digits = trimmed.replaceAll("\\D", "");
        if (digits.length() == 10) {
            digits = "91" + digits;
        }
        if (digits.length() < 11) {
            return null;
        }
        return "tel:+" + digits;
    }

    private static String lookupDialStringForContactName(Context context, String nameQuery) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS)
                != PackageManager.PERMISSION_GRANTED) {
            return null;
        }
        String q = nameQuery.toLowerCase(Locale.ROOT).trim();
        if (q.length() < 2) {
            return null;
        }
        ContentResolver cr = context.getContentResolver();
        Uri uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI;
        String[] proj =
            new String[] {
                ContactsContract.CommonDataKinds.Phone.NUMBER,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY
            };
        try (Cursor c =
                cr.query(
                    uri,
                    proj,
                    null,
                    null,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY + " ASC")) {
            if (c == null) {
                return null;
            }
            String bestUri = null;
            int bestScore = 0;
            while (c.moveToNext()) {
                String num = c.getString(0);
                String disp = c.getString(1);
                if (num == null || disp == null) {
                    continue;
                }
                String d = disp.toLowerCase(Locale.ROOT);
                int score = scoreContactNameMatch(d, q);
                if (score <= bestScore) {
                    continue;
                }
                String telCandidate = normalizePhoneFieldToTelUri(num);
                if (telCandidate == null) {
                    continue;
                }
                bestScore = score;
                bestUri = telCandidate;
            }
            if (bestScore < 62 || bestUri == null) {
                return null;
            }
            return bestUri;
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

    private static final String VOICE_EXT_PKGS = "neo_ext_pkgs";
    private static final String VOICE_EXT_URI = "neo_ext_uri";
    private static final String VOICE_EXT_STORE = "neo_ext_store";

    /**
     * {@link MainActivity#onResume()} — runs a deferred WA/TG/etc. launch from an {@link Activity} (Android 14+ BAL).
     */
    public static void consumeVoiceExternalLaunchSpec(Activity activity) {
        if (activity == null) {
            return;
        }
        Intent intent = activity.getIntent();
        if (intent == null) {
            return;
        }
        Bundle spec = intent.getBundleExtra(MainActivity.EXTRA_VOICE_EXTERNAL_SPEC);
        if (spec == null) {
            return;
        }
        intent.removeExtra(MainActivity.EXTRA_VOICE_EXTERNAL_SPEC);
        String[] pkgs = spec.getStringArray(VOICE_EXT_PKGS);
        String uriStr = spec.getString(VOICE_EXT_URI);
        String store = spec.getString(VOICE_EXT_STORE);
        if (pkgs == null || uriStr == null || store == null) {
            return;
        }
        openPreferredAppThenStoreInternal(activity, pkgs, Uri.parse(uriStr), store);
    }

    /**
     * Open deep link in an installed package variant (e.g. WhatsApp + WhatsApp Business), then chooser, then launcher,
     * then Play Store. Requires {@code <queries>} in the manifest on API 31+ or {@code getLaunchIntentForPackage} stays null.
     *
     * <p>When {@code context} is not an {@link Activity} (wake {@link android.app.Service} path), queues
     * {@link MainActivity#requestVoiceExternalLaunch} so the system does not block the activity start (BAL).
     */
    private static void openPreferredAppThenStore(
        Context context,
        String[] candidatePkgs,
        Uri appUri,
        String playStorePackageId
    ) {
        if (!(context instanceof Activity)) {
            Bundle spec = new Bundle();
            spec.putStringArray(VOICE_EXT_PKGS, candidatePkgs);
            spec.putString(VOICE_EXT_URI, appUri.toString());
            spec.putString(VOICE_EXT_STORE, playStorePackageId);
            MainActivity.requestVoiceExternalLaunch(context, spec);
            return;
        }
        openPreferredAppThenStoreInternal(context, candidatePkgs, appUri, playStorePackageId);
    }

    private static void openPreferredAppThenStoreInternal(
        Context context,
        String[] candidatePkgs,
        Uri appUri,
        String playStorePackageId
    ) {
        if (!canLaunchExternalUiNow(context)) {
            speak(
                context,
                "फोन स्क्रीन खोलकर नियो ऐप सामने रखें, तभी मैं दूसरे ऐप को खोल सकता हूँ।");
            return;
        }
        PackageManager pm = context.getPackageManager();

        for (String pkg : candidatePkgs) {
            if (pm.getLaunchIntentForPackage(pkg) == null) {
                continue;
            }
            Intent viewPkg = new Intent(Intent.ACTION_VIEW, appUri);
            viewPkg.setPackage(pkg);
            if (startActivityCompat(context, viewPkg)) {
                return;
            }
            Intent launch = pm.getLaunchIntentForPackage(pkg);
            if (launch != null && startActivityCompat(context, launch)) {
                return;
            }
        }

        Intent viewNoPkg = new Intent(Intent.ACTION_VIEW, appUri);
        if (viewNoPkg.resolveActivity(pm) != null && startActivityCompat(context, viewNoPkg)) {
            return;
        }

        Uri storeUri = Uri.parse("market://details?id=" + playStorePackageId);
        Intent storeIntent = new Intent(Intent.ACTION_VIEW, storeUri);
        if (!startActivityCompat(context, storeIntent)) {
            Intent storeWebIntent =
                new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=" + playStorePackageId));
            startActivityCompat(context, storeWebIntent);
        }
    }

    private static void speak(Context context, String text) {
        if (text == null || text.trim().isEmpty()) return;
        if (isSilentWakeRouting()) {
            return;
        }
        if (tts == null) {
            pendingSpeech = text;
            tts =
                new TextToSpeech(
                    context.getApplicationContext(),
                    status -> {
                        if (status == TextToSpeech.SUCCESS && tts != null) {
                            ttsReady = true;
                            tts.setLanguage(ASSISTANT_TTS_LOCALE);
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
