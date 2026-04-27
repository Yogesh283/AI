package com.neo.assistant;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Foreground “Hello Neo” wake: single {@link android.media.AudioRecord} pipeline ({@link NeoVoicePipeline}) with
 * Picovoice Porcupine + ring buffer + Whisper (no {@link android.speech.SpeechRecognizer}).
 * Voice command execution is on-screen only.
 */
public class WakeWordForegroundService extends Service {
    public static final String ACTION_START = "com.neo.assistant.action.START_WAKE";
    public static final String ACTION_STOP = "com.neo.assistant.action.STOP_WAKE";
    /** Extra boolean: when true, keep listening after screen off (more battery / OEM quirks possible). */
    public static final String EXTRA_SCREEN_OFF_LISTEN = "screen_off_listen";
    /** Extra boolean: separate wake voice-chat mode (OpenAI reply via TTS), independent from command routing. */
    public static final String EXTRA_VOICE_CHAT_MODE = "voice_chat_mode";

    private static final String CHANNEL_ID = "neo_wake_channel_silent_v2";
    private static final int NOTIFICATION_ID = 9001;
    private static final String TAG = "NeoWakeService";

    private boolean shouldListen = false;
    /** When false, pause mic when display is off (default). When true, try to keep wake for lock-screen use. */
    private boolean listenScreenOff = false;
    private NeoVoicePipeline voicePipeline;
    private PowerManager.WakeLock wakeLock;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private BroadcastReceiver screenReceiver;
    /** Ignore duplicate final transcripts (screen-off partial quirks / echo). */
    private long lastHandledCommandMs;
    private String lastHandledCommandKey = "";
    /**
     * Return value from {@link #consumeVoiceTranscript(String)}: do not schedule STT restart here —
     * {@link NeoCommandRouter} will run {@link #resumeListeningRunnable} when TTS ends.
     */
    private static final int RELISTEN_DEFERRED = -1;
    private static final int RELISTEN_MS_QUICK = 260;
    private static final int RELISTEN_MS_ERROR = 520;
    /** Wake heard with no command tail — brief pause so the user can finish the phrase (Alexa-like beat). */
    private static final int RELISTEN_MS_AFTER_WAKE_ONLY = 1200;
    /** Screen-off voice mode should feel snappier than the default wake-only pause. */
    private static final int RELISTEN_MS_AFTER_WAKE_ONLY_SCREEN_OFF = 650;
    /** If other app audio/video is active, stay idle and retry later. */
    private static final int MEDIA_ACTIVE_RECHECK_MS = 3000;
    private static final int MEDIA_ACTIVE_RECHECK_MAX_MS = 5200;
    private boolean wakeKeywordAvailable = true;
    /**
     * Best-effort silent mode:
     * Repeated request/abandon of transient-exclusive audio focus can trigger OEM mic/focus cues ("tun").
     * Keep disabled by default; we already guard by media-active detection + delayed relistens.
     */
    private static final boolean ENABLE_MIC_AUDIO_FOCUS = false;

    private int mediaBackoffMs = MEDIA_ACTIVE_RECHECK_MS;
    private AudioManager audioManager;
    private AudioFocusRequest micAudioFocusRequest;
    private volatile boolean voiceChatMode = false;
    private volatile boolean chatRequestInFlight = false;
    /** Set when Porcupine fires for the clip that produced the next Whisper transcript (speech-first path leaves false). */
    private final AtomicBoolean porcupineWakeForNextTranscript = new AtomicBoolean(false);
    private static final int CHAT_CONNECT_TIMEOUT_MS = 3000;
    private static final int CHAT_READ_TIMEOUT_MS = 5200;
    /** Same-origin Next proxy as the WebView — not bare {@code /api/chat} on the public host. */
    private static final String CHAT_API_FALLBACK = "https://myneoxai.com/neo-api/api/chat";
    private static volatile boolean runningNow = false;
    private static volatile boolean runningScreenOffListen = false;
    private static volatile boolean runningVoiceChatMode = false;

    static boolean isRunningNow() {
        return runningNow;
    }

    static boolean isRunningScreenOffListen() {
        return runningScreenOffListen;
    }

    static boolean isRunningVoiceChatMode() {
        return runningVoiceChatMode;
    }

    private final Runnable resumeListeningRunnable =
        () -> {
            if (!shouldListen) return;
            if (!mayUseMicNow()) return;
            if (NeoCommandRouter.isAISpeaking()) return;
            if (chatRequestInFlight) return;
            if (isMediaPlaybackActive()) {
                schedulePassiveRelisten(nextMediaBackoffMs());
                return;
            }
            mediaBackoffMs = MEDIA_ACTIVE_RECHECK_MS;
            resumePassiveMic();
        };

    @Override
    public void onCreate() {
        super.onCreate();
        runningNow = true;
        NeoVoiceWhisperClient.setForcedLanguage(NeoPrefs.getVoiceCommandLanguage(this));
        wakeKeywordAvailable = PorcupineStreamWake.canInit(this);
        createChannel();
        acquirePartialWakeLock();
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        voicePipeline =
            new NeoVoicePipeline(
                getApplicationContext(),
                new NeoVoicePipeline.Host() {
                    @Override
                    public boolean shouldRun() {
                        return shouldListen;
                    }

                    @Override
                    public boolean mayUseMic() {
                        return WakeWordForegroundService.this.mayUseMicNow();
                    }

                    @Override
                    public boolean mediaBlocking() {
                        return isMediaPlaybackActive();
                    }

                    @Override
                    public boolean chatBusy() {
                        return chatRequestInFlight;
                    }

                    @Override
                    public boolean ttsPlaying() {
                        return NeoCommandRouter.isAISpeaking();
                    }

                    @Override
                    public void onTranscript(String raw) {
                        WakeWordForegroundService.this.onVoicePipelineTranscript(raw);
                    }

                    @Override
                    public void requestRelistenMs(int ms) {
                        schedulePassiveRelisten(ms);
                    }

                    @Override
                    public boolean allowFallbackHotCapture() {
                        /*
                         * Off-screen + wake voice-chat: never run speech-first capture (no Porcupine gate).
                         * Avoids Whisper → chat / TTS from ambient speech before a real "Hello Neo" hotword.
                         */
                        if (voiceChatMode && !isScreenInteractive()) {
                            return false;
                        }
                        return true;
                    }

                    @Override
                    public void onPorcupineHotword() {
                        porcupineWakeForNextTranscript.set(true);
                    }
                });
        NeoCommandRouter.setAssistantSpeechEndedRunnable(
            () -> {
                if (!shouldListen) return;
                if (!mayUseMicNow()) return;
                if (NeoCommandRouter.isAISpeaking()) return;
                schedulePassiveRelisten(RELISTEN_MS_QUICK);
            });
        registerScreenStateReceiver();
    }

    /**
     * Mic policy:
     * - on-screen: always allow
     * - off-screen: allow only for wake voice-chat mode (Hello Neo -> chat)
     */
    private boolean mayUseMicNow() {
        if (isScreenInteractive()) return true;
        return voiceChatMode;
    }

    private boolean isScreenInteractive() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        return pm == null || pm.isInteractive();
    }

    private void registerScreenStateReceiver() {
        screenReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                    if (!voiceChatMode) {
                        stopListeningSilently();
                    }
                } else if (Intent.ACTION_SCREEN_ON.equals(intent.getAction()) && shouldListen) {
                    schedulePassiveRelisten(1900);
                }
            }
        };
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_SCREEN_OFF);
        filter.addAction(Intent.ACTION_SCREEN_ON);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                registerReceiver(screenReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                registerReceiver(screenReceiver, filter);
            }
        } catch (Exception ignored) {
            screenReceiver = null;
        }
    }

    private void stopListeningSilently() {
        releaseMicAudioFocus();
    }

    private void resumePassiveMic() {
        schedulePassiveRelisten(RELISTEN_MS_QUICK);
    }

    /** Whisper / pipeline delivered final user text on main thread. */
    private void onVoicePipelineTranscript(String raw) {
        if (!shouldListen || !mayUseMicNow()) {
            return;
        }
        if (NeoCommandRouter.isAISpeaking()) {
            return;
        }
        if (chatRequestInFlight) {
            return;
        }
        if (isMediaPlaybackActive()) {
            schedulePassiveRelisten(nextMediaBackoffMs());
            return;
        }
        mediaBackoffMs = MEDIA_ACTIVE_RECHECK_MS;
        int delayMs = consumeVoiceTranscript(raw);
        if (!shouldListen || !mayUseMicNow()) {
            return;
        }
        if (NeoCommandRouter.isAISpeaking()) {
            return;
        }
        if (chatRequestInFlight) {
            return;
        }
        if (isMediaPlaybackActive()) {
            schedulePassiveRelisten(nextMediaBackoffMs());
            return;
        }
        if (delayMs != RELISTEN_DEFERRED) {
            schedulePassiveRelisten(delayMs);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent != null && intent.hasExtra(EXTRA_SCREEN_OFF_LISTEN)) {
            listenScreenOff = intent.getBooleanExtra(EXTRA_SCREEN_OFF_LISTEN, false);
        } else {
            listenScreenOff = NeoPrefs.isWakeListenScreenOff(this);
        }
        runningScreenOffListen = listenScreenOff;
        if (intent != null && intent.hasExtra(EXTRA_VOICE_CHAT_MODE)) {
            voiceChatMode = intent.getBooleanExtra(EXTRA_VOICE_CHAT_MODE, false);
            NeoPrefs.setWakeVoiceChatModeEnabled(this, voiceChatMode);
        } else {
            voiceChatMode = NeoPrefs.isWakeVoiceChatModeEnabled(this);
        }
        runningVoiceChatMode = voiceChatMode;

        if (!hasRecordAudioPermission()) {
            shouldListen = false;
            Log.w(TAG, "Wake start skipped: RECORD_AUDIO not granted.");
            stopSelf();
            return START_NOT_STICKY;
        }
        Notification notification = buildNotification();
        try {
            startForeground(NOTIFICATION_ID, notification);
        } catch (SecurityException se) {
            /*
             * Android 14/15 can throw when microphone FGS is started while app isn't in eligible foreground state.
             * Avoid crash/restart loop; user can retry from app UI after bringing app to foreground.
             */
            shouldListen = false;
            Log.w(TAG, "Wake FGS start blocked by system eligibility; skipping restart loop.", se);
            stopSelf();
            return START_NOT_STICKY;
        }
        shouldListen = true;
        Log.i(
            TAG,
            "Wake listener started: screenOff="
                + listenScreenOff
                + " voiceChatMode="
                + voiceChatMode
                + " wakeKeywordAvailable="
                + wakeKeywordAvailable);
        if (voicePipeline != null) {
            voicePipeline.start();
        }
        resumePassiveMic();
        return START_STICKY;
    }

    private boolean hasRecordAudioPermission() {
        return ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO)
            == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onDestroy() {
        runningNow = false;
        runningScreenOffListen = false;
        runningVoiceChatMode = false;
        shouldListen = false;
        chatRequestInFlight = false;
        NeoCommandRouter.setAssistantSpeechEndedRunnable(null);
        mainHandler.removeCallbacks(resumeListeningRunnable);
        mainHandler.removeCallbacksAndMessages(null);
        if (voicePipeline != null) {
            voicePipeline.shutdown();
            voicePipeline = null;
        }
        try {
            if (screenReceiver != null) {
                unregisterReceiver(screenReceiver);
            }
        } catch (Exception ignored) {
        }
        screenReceiver = null;
        releaseMicAudioFocus();
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        NeoCommandRouter.shutdown();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /**
     * Parses wake + command and runs {@link NeoCommandRouter#execute}.
     *
     * @return ms to wait before relisten, or {@link #RELISTEN_DEFERRED} if TTS owns the next start.
     */
    private int consumeVoiceTranscript(String rawForTts) {
        if (!mayUseMicNow()) return RELISTEN_MS_QUICK;
        String said = normalize(rawForTts);
        if (said.isEmpty()) return RELISTEN_MS_QUICK;

        boolean porcupineHeard = porcupineWakeForNextTranscript.getAndSet(false);
        boolean screenOnNow = isScreenInteractive();
        String command = extractWakeCommand(said, screenOnNow);
        final boolean allowAssistantVoice = command != null || porcupineHeard;

        NeoCommandRouter.setAssistantTtsAllowed(allowAssistantVoice);
        try {
            if (command == null) {
                if (screenOnNow) {
                    /*
                     * On-screen assistant mode: allow direct commands without forcing wake phrase every turn.
                     * Off-screen path remains wake-gated ("Hello Neo").
                     */
                    command = said;
                } else if (isSpeechFirstFallbackMode()) {
                    /*
                     * Porcupine assets are unavailable in this build. Route transcript directly so multilingual
                     * wake mis-hears ("हलो/హలో/हैलो ...") still execute app commands or fall back to voice chat.
                     */
                    return RELISTEN_MS_QUICK;
                } else {
                    Log.i(
                        TAG,
                        "voiceCommand ignored: no wake phrase match (Porcupine="
                            + wakeKeywordAvailable
                            + ") len="
                            + said.length()
                            + " text="
                            + (said.length() > 160 ? said.substring(0, 160) + "..." : said));
                    return RELISTEN_MS_QUICK;
                }
            }

            if (command.isEmpty()) {
                /*
                 * User expectation: one "Hello Neo" should always produce an audible acknowledgment.
                 * Keep it short and let TTS completion drive the next relisten.
                 */
                NeoCommandRouter.speakWakeListeningAck(this, rawForTts);
                if (NeoCommandRouter.isAISpeaking()) {
                    return RELISTEN_DEFERRED;
                }
                if (!isScreenInteractive()) {
                    return RELISTEN_MS_AFTER_WAKE_ONLY_SCREEN_OFF;
                }
                return RELISTEN_MS_AFTER_WAKE_ONLY;
            }

            if (!isScreenInteractive()) {
                /*
                 * Off-screen voice chat mode should continue to accept wake+command even when
                 * generic screen-off command listening is disabled in preferences.
                 */
                if (!listenScreenOff && !voiceChatMode) {
                    return RELISTEN_MS_AFTER_WAKE_ONLY;
                }
                /* Screen off + user opted in: same Neo commands as screen on (may bring activity/UI to front). */
            }

            String key = command.trim().toLowerCase(Locale.ROOT);
            long now = System.currentTimeMillis();
            long dedupeWindowMs = isScreenInteractive() ? 1400L : 900L;
            if (key.equals(lastHandledCommandKey) && (now - lastHandledCommandMs) < dedupeWindowMs) {
                return RELISTEN_MS_QUICK;
            }
            lastHandledCommandKey = key;
            lastHandledCommandMs = now;

            if (!isScreenInteractive()) {
                /*
                 * Product rule: voice commands are on-screen only.
                 * Off-screen uses wake voice chat path (when enabled).
                 */
                if (voiceChatMode) {
                    handleWakeVoiceChat(command);
                    return RELISTEN_DEFERRED;
                }
                return RELISTEN_MS_AFTER_WAKE_ONLY;
            }

            boolean handled = NeoCommandRouter.execute(this, command);
            if (!handled) {
                /*
                 * Always give audible feedback so the user knows Neo heard them.
                 */
                NeoCommandRouter.speakCommandNotUnderstood(this, rawForTts);
                if (NeoCommandRouter.isAISpeaking()) {
                    return RELISTEN_DEFERRED;
                }
                return RELISTEN_MS_QUICK;
            }
            if (NeoCommandRouter.isAISpeaking()) {
                return RELISTEN_DEFERRED;
            }
            return RELISTEN_MS_QUICK;
        } finally {
            NeoCommandRouter.setAssistantTtsAllowed(true);
        }
    }

    /** Speech-first fallback when Porcupine keyword model is unavailable but wake voice-chat mode is on. */
    private boolean isSpeechFirstFallbackMode() {
        return !wakeKeywordAvailable && voiceChatMode;
    }

    /**
     * Separate wake chat mode: after "Hello Neo ...", send text to backend chat route and speak reply via TTS.
     * Keeps this mode independent from app-intent command router behavior.
     */
    private void handleWakeVoiceChat(String userText) {
        /* Safety guard: wake voice-chat belongs to screen-off flow only. */
        if (isScreenInteractive()) {
            return;
        }
        final String q = userText == null ? "" : userText.trim();
        if (q.isEmpty()) {
            return;
        }
        if (chatRequestInFlight) {
            return;
        }
        chatRequestInFlight = true;
        new Thread(
                () -> {
                    String reply = "";
                    try {
                        reply = requestVoiceChatReply(q);
                    } catch (Exception ignored) {
                    }
                    final String out = reply == null ? "" : reply.trim();
                    mainHandler.post(
                        () -> {
                            chatRequestInFlight = false;
                            if (!shouldListen || !mayUseMicNow()) return;
                            if (!out.isEmpty()) {
                                NeoCommandRouter.speakVoiceChatReply(this, out);
                                return;
                            }
                            /*
                             * Always respond audibly after wake+query, even on transient backend failures.
                             * Keeps the assistant feeling present and trustworthy.
                             */
                            NeoCommandRouter.speakVoiceChatReply(
                                this,
                                "मैं सुन रही हूँ। नेटवर्क थोड़ा धीमा है, कृपया एक बार फिर बोलिए।");
                            if (!NeoCommandRouter.isAISpeaking()) {
                                schedulePassiveRelisten(RELISTEN_MS_ERROR);
                            }
                        });
                },
                "neo-wake-chat")
            .start();
    }

    private String requestVoiceChatReply(String userText) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(CHAT_API_FALLBACK);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(CHAT_CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(CHAT_READ_TIMEOUT_MS);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("Accept", "application/json");

            JSONObject body = new JSONObject();
            JSONArray messages = new JSONArray();
            JSONObject user = new JSONObject();
            user.put("role", "user");
            user.put("content", userText);
            messages.put(user);
            body.put("messages", messages);
            body.put("source", "voice");
            body.put("use_web", false);
            body.put("speech_lang", Locale.getDefault().toLanguageTag());

            byte[] bytes = body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
            }

            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                return "";
            }
            StringBuilder sb = new StringBuilder();
            try (BufferedReader br =
                    new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line);
                }
            }
            JSONObject json = new JSONObject(sb.toString());
            return json.optString("reply", "");
        } catch (Exception e) {
            return "";
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    /**
     * Wake phrase + command tail. Uses one regex so delimiter offset bugs cannot clip the wake word
     * (older code used {@code m.start()} on a pattern that included a leading space, so {@code endOfWake}
     * often failed and the whole utterance was mis-parsed).
     *
     * <p>Includes common Whisper/ASR variants because Porcupine assets are often missing in dev APKs
     * ({@code wakeKeywordAvailable=false}).
     */
    private static final Pattern WAKE_IN_UTTERANCE =
        Pattern.compile(
            "(?:^|[\\s,.!?])(?:"
                + "hello\\s*neo|hello\\s*new|hello\\s*niyo|hello\\s*nio|"
                + "hey\\s*neo|hi\\s*neo|halo\\s*neo|helo\\s*neo|hallo\\s*neo|yellow\\s*neo|"
                + "हेलो\\s*नियो|हैलो\\s*नियो|नमस्ते\\s*नियो"
                + ")(?=[\\s,.!?]|$)",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private String extractWakeCommand(String said, boolean allowStandaloneFallback) {
        Matcher m = WAKE_IN_UTTERANCE.matcher(said);
        if (m.find()) {
            String rest = said.substring(m.end()).trim();
            if (rest.startsWith(",") || rest.startsWith(".")) {
                rest = rest.substring(1).trim();
            }
            return rest;
        }
        /*
         * Dev/sideload builds often ship without Porcupine ({@code wakeKeywordAvailable=false}). Still route
         * obvious short intents (contacts / YouTube / WhatsApp) without forcing “Hello Neo”.
         */
        if (allowStandaloneFallback && !wakeKeywordAvailable && looksLikeStandaloneNeoCommand(said)) {
            return said.trim();
        }
        return null;
    }

    /** Narrow imperative phrases — avoids treating random chat as a command when wake keyword is unavailable. */
    private boolean looksLikeStandaloneNeoCommand(String said) {
        if (said == null) return false;
        String s = said.trim();
        if (s.length() < 3 || s.length() > 220) return false;
        String lower = s.toLowerCase(Locale.ROOT);
        if (lower.matches(
                "(?is).*(?:^|\\s)(?:open|launch|start|show)\\s+(?:contact|contacts)\\b.*")) return true;
        if (lower.matches(
                "(?is).*(?:contact|contacts)\\b.*(?:^|\\s)(?:open|launch|start|show)\\b.*")) return true;
        if (lower.contains("youtube") || lower.contains("you tube")) return true;
        if (s.contains("यूट्यूब") || s.contains("यूटूब")) return true;
        if (lower.contains("whatsapp")) return true;
        if (s.contains("व्हाट्स")
                || s.contains("व्हाट्सऐप")
                || s.contains("वटसप")
                || s.contains("वॉट्सएप")
                || s.contains("వాట్సాప్")
                || s.contains("వర్చప్")) return true;
        if (lower.contains("telegram")) return true;
        if (s.contains("संपर्क") && (lower.contains("open") || s.contains("खोल"))) return true;
        if (lower.matches("(?is)^(open\\s+)?youtube\\s*$")) return true;
        return false;
    }

    private String normalize(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private void schedulePassiveRelisten(long ms) {
        mainHandler.removeCallbacks(resumeListeningRunnable);
        mainHandler.postDelayed(resumeListeningRunnable, ms);
    }

    private int nextMediaBackoffMs() {
        int out = mediaBackoffMs;
        mediaBackoffMs = Math.min(MEDIA_ACTIVE_RECHECK_MAX_MS, mediaBackoffMs + 650);
        return out;
    }

    private boolean isMediaPlaybackActive() {
        /*
         * On some OEM builds, isMusicActive() stays true while app is foreground, which
         * suppresses wake capture and feels like "Neo is not listening". For on-screen use,
         * prioritize voice commands and keep media-blocking only for background/lock-screen.
         */
        if (isScreenInteractive()) {
            return false;
        }
        AudioManager am = audioManager;
        if (am == null) return false;
        try {
            return am.isMusicActive();
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean requestMicAudioFocus() {
        if (!ENABLE_MIC_AUDIO_FOCUS) {
            return true;
        }
        AudioManager am = audioManager;
        if (am == null) return true;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioFocusRequest req =
                    new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                        .setAudioAttributes(
                            new AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_ASSISTANT)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build())
                        .setAcceptsDelayedFocusGain(false)
                        .setWillPauseWhenDucked(false)
                        .setOnAudioFocusChangeListener((change) -> {})
                        .build();
                int r = am.requestAudioFocus(req);
                if (r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    micAudioFocusRequest = req;
                    return true;
                }
                return false;
            }
            int r =
                am.requestAudioFocus(
                    null,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK);
            return r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void releaseMicAudioFocus() {
        if (!ENABLE_MIC_AUDIO_FOCUS) {
            micAudioFocusRequest = null;
            return;
        }
        AudioManager am = audioManager;
        if (am == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (micAudioFocusRequest != null) {
                    am.abandonAudioFocusRequest(micAudioFocusRequest);
                    micAudioFocusRequest = null;
                }
                return;
            }
            am.abandonAudioFocus(null);
        } catch (Exception ignored) {
        }
    }

    private Notification buildNotification() {
        Intent openApp = new Intent(this, MainActivity.class);
        PendingIntent openPending = PendingIntent.getActivity(
            this, 101, openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(this, WakeWordForegroundService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPending = PendingIntent.getService(
            this, 102, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.neo_wake_notification_title))
            .setContentText(getString(R.string.neo_wake_notification_text))
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setContentIntent(openPending)
            .addAction(0, getString(R.string.neo_wake_stop), stopPending)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.neo_wake_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.neo_wake_channel_desc));
        channel.enableVibration(false);
        channel.enableLights(false);
        channel.setSound(null, null);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(channel);
    }

    private void acquirePartialWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm == null) return;
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NeoAssistant:WakeWord");
            wakeLock.setReferenceCounted(false);
            /* Timed acquire was expiring (~10 min) while FGS still ran — mic/listen could feel “auto off”. Hold until onDestroy. */
            wakeLock.acquire();
        } catch (Exception ignored) {
        }
    }
}
