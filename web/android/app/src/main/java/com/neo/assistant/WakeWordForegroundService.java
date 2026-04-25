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
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Foreground “Hello Neo” wake listener: one {@link SpeechRecognizer}, short relisten delays, no per-phrase
 * destroy/recreate. Commands run only after wake phrase + tail (see {@link #consumeRecognizerResults}).
 * While {@link NeoCommandRouter} TTS plays, {@link NeoCommandRouter#isAISpeaking()} blocks feedback.
 * Background routing uses {@link NeoCommandRouter#beginSilentWakeRouting()} — no assistant TTS; OEM mic/UI sounds
 * are not fully suppressible from app code.
 * Optional {@link PorcupineStreamWake} path: raw {@link android.media.AudioRecord} + Picovoice Porcupine
 * (see {@link NeoPrefs#isWakePorcupineStreamEnabled}); command tail still uses one {@link SpeechRecognizer} pass.
 */
public class WakeWordForegroundService extends Service {
    public static final String ACTION_START = "com.neo.assistant.action.START_WAKE";
    public static final String ACTION_STOP = "com.neo.assistant.action.STOP_WAKE";
    /** Extra boolean: when true, keep listening after screen off (more battery / OEM quirks possible). */
    public static final String EXTRA_SCREEN_OFF_LISTEN = "screen_off_listen";

    private static final String CHANNEL_ID = "neo_wake_channel_silent_v2";
    private static final int NOTIFICATION_ID = 9001;
    private static final String TAG = "NeoWakeService";

    private SpeechRecognizer recognizer;
    private Intent recognizerIntent;
    private boolean shouldListen = false;
    /** When false, pause mic when display is off (default). When true, try to keep wake for lock-screen use. */
    private boolean listenScreenOff = false;
    private PorcupineStreamWake porcupineWake;
    private boolean porcupineMode;
    /** After Porcupine fires, one {@link SpeechRecognizer} pass captures the command tail. */
    private boolean capturingAfterPorcupineWake;
    private long lastPorcupineKeywordMs;
    private PowerManager.WakeLock wakeLock;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private BroadcastReceiver screenReceiver;
    /** Ignore duplicate final transcripts (screen-off partial quirks / echo). */
    private long lastHandledCommandMs;
    private String lastHandledCommandKey = "";
    /**
     * Return value from {@link #consumeRecognizerResults(android.os.Bundle)}: do not schedule STT restart here —
     * {@link NeoCommandRouter} will run {@link #resumeListeningRunnable} when TTS ends.
     */
    private static final int RELISTEN_DEFERRED = -1;
    /**
     * Gap before the next {@link SpeechRecognizer#startListening}. Too aggressive → OEM “tun” / audio-focus churn on
     * many devices; one recognizer is still reused (no destroy/create per phrase).
     */
    /** Wider gaps → fewer back‑to‑back {@code startListening} calls on OEM devices (“tun” / focus cues). */
    private static final int RELISTEN_MS_QUICK = 1650;
    private static final int RELISTEN_MS_ERROR = 2200;
    /** Wake heard with no command tail — brief pause so the user can finish the phrase (Alexa-like beat). */
    private static final int RELISTEN_MS_AFTER_WAKE_ONLY = 2600;
    /** After Porcupine releases {@link AudioRecord}, wait before {@link SpeechRecognizer} grabs mic (one handoff). */
    private static final int STT_AFTER_PORCUPINE_STOP_MS = 720;
    /** Hard guard: never hit back-to-back {@link SpeechRecognizer#startListening} calls. */
    private static final long MIN_MS_BETWEEN_STT_STARTS = 1800L;
    /** If other app audio/video is active, stay idle and retry later. */
    private static final int MEDIA_ACTIVE_RECHECK_MS = 3000;
    private static final int MEDIA_ACTIVE_RECHECK_MAX_MS = 5200;

    /** True after {@link RecognitionListener#onReadyForSpeech}; prevents duplicate starts. */
    private volatile boolean isListening = false;
    /** True between startListening() call and callback state transition. */
    private volatile boolean startInFlight = false;
    private long lastStartListeningMs = 0L;
    private int mediaBackoffMs = MEDIA_ACTIVE_RECHECK_MS;
    private AudioManager audioManager;
    private AudioFocusRequest micAudioFocusRequest;

    private final Runnable resumeListeningRunnable =
        () -> {
            if (!shouldListen) return;
            if (!mayUseMicNow()) return;
            if (NeoCommandRouter.isAISpeaking()) return;
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
        createChannel();
        acquirePartialWakeLock();
        audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
        initRecognizer();
        /*
         * Mic-on-demand policy:
         * Prefer passive low-power Porcupine wake in all cases where available.
         * This keeps SpeechRecognizer off unless wake is detected and command tail must be captured.
         */
        porcupineMode = PorcupineStreamWake.canInit(this) && NeoPrefs.isWakePorcupineStreamEnabled(this);
        if (porcupineMode) {
            porcupineWake =
                new PorcupineStreamWake(
                    getApplicationContext(),
                    () -> mainHandler.post(this::onPorcupineKeywordMain));
        }
        NeoCommandRouter.setAssistantSpeechEndedRunnable(
            () -> {
                if (!shouldListen) return;
                if (!mayUseMicNow()) return;
                if (NeoCommandRouter.isAISpeaking()) return;
                schedulePassiveRelisten(RELISTEN_MS_QUICK);
            });
        registerScreenStateReceiver();
    }

    /** When {@link #listenScreenOff} is false, skip work while display is off (pocket / OEM beeps). */
    private boolean mayUseMicNow() {
        if (listenScreenOff) return true;
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        return pm == null || pm.isInteractive();
    }

    private void registerScreenStateReceiver() {
        screenReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                    if (!listenScreenOff) {
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
        clearRecognizerListeningState();
        releaseMicAudioFocus();
        try {
            if (recognizer != null) {
                recognizer.stopListening();
            }
        } catch (Exception ignored) {
        }
        if (porcupineMode && porcupineWake != null && !capturingAfterPorcupineWake) {
            porcupineWake.stopRelease();
        }
    }

    private void resumePassiveMic() {
        if (porcupineMode) {
            if (capturingAfterPorcupineWake) {
                return;
            }
            if (porcupineWake != null) {
                porcupineWake.ensureStarted();
            }
            return;
        }
        startListeningSafe();
    }

    private void onPorcupineKeywordMain() {
        if (!shouldListen || !mayUseMicNow()) {
            return;
        }
        if (NeoCommandRouter.isAISpeaking()) {
            return;
        }
        if (isMediaPlaybackActive()) {
            schedulePassiveRelisten(nextMediaBackoffMs());
            return;
        }
        mediaBackoffMs = MEDIA_ACTIVE_RECHECK_MS;
        if (capturingAfterPorcupineWake) {
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastPorcupineKeywordMs < 1200L) {
            return;
        }
        lastPorcupineKeywordMs = now;
        capturingAfterPorcupineWake = true;
        if (porcupineWake != null) {
            porcupineWake.stopRelease();
        }
        mainHandler.postDelayed(
            () -> {
                if (!shouldListen || !mayUseMicNow()) {
                    capturingAfterPorcupineWake = false;
                    return;
                }
                if (!capturingAfterPorcupineWake) {
                    return;
                }
                startListeningSafe();
            },
            STT_AFTER_PORCUPINE_STOP_MS);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent != null && intent.hasExtra(EXTRA_SCREEN_OFF_LISTEN)) {
            listenScreenOff = intent.getBooleanExtra(EXTRA_SCREEN_OFF_LISTEN, true);
        } else {
            listenScreenOff = NeoPrefs.isWakeListenScreenOff(this);
        }
        /*
         * Policy rule: wake-word detection stays active for both screen ON/OFF.
         * Command capture mic still opens only after wake phrase detection.
         */
        listenScreenOff = true;
        NeoPrefs.setWakeListenScreenOff(this, true);

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
        resumePassiveMic();
        return START_STICKY;
    }

    private boolean hasRecordAudioPermission() {
        return ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO)
            == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onDestroy() {
        shouldListen = false;
        NeoCommandRouter.setAssistantSpeechEndedRunnable(null);
        mainHandler.removeCallbacks(resumeListeningRunnable);
        mainHandler.removeCallbacksAndMessages(null);
        if (porcupineWake != null) {
            porcupineWake.shutdown();
            porcupineWake = null;
        }
        try {
            if (screenReceiver != null) {
                unregisterReceiver(screenReceiver);
            }
        } catch (Exception ignored) {
        }
        screenReceiver = null;
        clearRecognizerListeningState();
        releaseMicAudioFocus();
        try {
            if (recognizer != null) {
                recognizer.stopListening();
                recognizer.cancel();
                recognizer.destroy();
            }
        } catch (Exception ignored) {
        }
        recognizer = null;
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

    private void initRecognizer() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) return;
        /* Single recognizer for the foreground lifetime — only startListening again after each final result / error. */
        recognizer = SpeechRecognizer.createSpeechRecognizer(this);
        recognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(android.os.Bundle params) {
                isListening = true;
                startInFlight = false;
                mediaBackoffMs = MEDIA_ACTIVE_RECHECK_MS;
            }
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override
            public void onEndOfSpeech() {
                isListening = false;
                startInFlight = false;
                releaseMicAudioFocus();
            }
            @Override public void onEvent(int eventType, android.os.Bundle params) {}

            @Override
            public void onError(int error) {
                clearRecognizerListeningState();
                releaseMicAudioFocus();
                if (!shouldListen) return;
                if (porcupineMode && capturingAfterPorcupineWake) {
                    capturingAfterPorcupineWake = false;
                    if (!mayUseMicNow()) return;
                    if (NeoCommandRouter.isAISpeaking()) return;
                    if (isMediaPlaybackActive()) {
                        schedulePassiveRelisten(nextMediaBackoffMs());
                        return;
                    }
                    schedulePassiveRelisten(RELISTEN_MS_ERROR);
                    return;
                }
                if (!mayUseMicNow()) return;
                if (NeoCommandRouter.isAISpeaking()) return;
                if (isMediaPlaybackActive()) {
                    schedulePassiveRelisten(nextMediaBackoffMs());
                    return;
                }
                schedulePassiveRelisten(RELISTEN_MS_ERROR);
            }

            @Override
            public void onResults(android.os.Bundle results) {
                clearRecognizerListeningState();
                releaseMicAudioFocus();
                if (!shouldListen || !mayUseMicNow()) return;
                if (NeoCommandRouter.isAISpeaking()) {
                    if (porcupineMode) {
                        capturingAfterPorcupineWake = false;
                    }
                    /* Drop finals captured while assistant TTS is playing (feedback loop). */
                    return;
                }
                if (porcupineMode) {
                    capturingAfterPorcupineWake = false;
                }
                int delayMs = consumeRecognizerResults(results);
                if (!shouldListen || !mayUseMicNow()) return;
                if (NeoCommandRouter.isAISpeaking()) return;
                if (isMediaPlaybackActive()) {
                    schedulePassiveRelisten(nextMediaBackoffMs());
                    return;
                }
                mediaBackoffMs = MEDIA_ACTIVE_RECHECK_MS;
                if (delayMs != RELISTEN_DEFERRED) {
                    schedulePassiveRelisten(delayMs);
                }
            }

            @Override
            public void onPartialResults(android.os.Bundle partialResults) {
                /* Do not route commands from partials — each update re-fired TTS (“on it…”) and felt broken. */
            }
        });

        recognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        /* Slightly longer end windows reduce rapid stop/start of the same session (fewer focus beeps on some devices). */
        /* Longer end-of-speech windows → fewer stop/start cycles and less OEM mic “tun” on many phones. */
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2200L);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 1550L);
    }

    /**
     * Parses wake + command and runs {@link NeoCommandRouter#execute}.
     *
     * @return ms to wait before {@link #startListeningSafe}, or {@link #RELISTEN_DEFERRED} if TTS owns the next start.
     */
    private int consumeRecognizerResults(android.os.Bundle bundle) {
        if (!mayUseMicNow()) return RELISTEN_MS_QUICK;
        if (bundle == null) return RELISTEN_MS_QUICK;
        ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return RELISTEN_MS_QUICK;
        String rawForTts = matches.get(0);
        String said = normalize(rawForTts);
        if (said.isEmpty()) return RELISTEN_MS_QUICK;

        String command = extractWakeCommand(said);
        if (command == null) {
            return RELISTEN_MS_QUICK;
        }

        if (command.isEmpty()) {
            /* Wake only — no TTS in background listener (silent operation; no speaker→mic overlap). */
            return RELISTEN_MS_AFTER_WAKE_ONLY;
        }

        String key = command.trim().toLowerCase(Locale.ROOT);
        long now = System.currentTimeMillis();
        if (key.equals(lastHandledCommandKey) && (now - lastHandledCommandMs) < 3200) {
            return RELISTEN_MS_QUICK;
        }
        lastHandledCommandKey = key;
        lastHandledCommandMs = now;

        boolean handled;
        NeoCommandRouter.beginSilentWakeRouting();
        try {
            handled = NeoCommandRouter.execute(this, command);
        } finally {
            NeoCommandRouter.endSilentWakeRouting();
        }
        if (!handled) {
            Log.v(TAG, "wake command unmatched");
        }
        if (NeoCommandRouter.isAISpeaking()) {
            return RELISTEN_DEFERRED;
        }
        return RELISTEN_MS_QUICK;
    }

    private String extractWakeCommand(String said) {
        int i = indexOfWake(said);
        if (i < 0) return null;
        int end = endOfWake(said, i);
        String rest = said.substring(Math.min(end, said.length())).trim();
        if (rest.startsWith(",") || rest.startsWith(".")) {
            rest = rest.substring(1).trim();
        }
        return rest;
    }

    private int indexOfWake(String s) {
        String[] wakes = new String[] {"hello neo", "hello new", "neo", "नियो", "हेलो नियो"};
        int best = -1;
        for (String w : wakes) {
            Pattern p = Pattern.compile("(^|\\s|[,.!?])" + Pattern.quote(w) + "(\\s|[,.!?]|$)");
            Matcher m = p.matcher(s);
            if (m.find()) {
                int i = m.start();
                if (best < 0 || i < best) best = i;
            }
        }
        return best;
    }

    private int endOfWake(String s, int start) {
        String[] wakes = new String[] {"hello neo", "hello new", "neo", "नियो", "हेलो नियो"};
        int bestEnd = start;
        for (String w : wakes) {
            if (s.startsWith(w, start)) {
                int e = start + w.length();
                if (e > bestEnd) bestEnd = e;
            }
        }
        return bestEnd;
    }

    private String normalize(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private void startListeningSafe() {
        if (!shouldListen || recognizer == null || recognizerIntent == null) return;
        if (!mayUseMicNow()) return;
        if (isListening || startInFlight) return;
        if (isMediaPlaybackActive()) {
            schedulePassiveRelisten(nextMediaBackoffMs());
            return;
        }
        long now = System.currentTimeMillis();
        long elapsed = now - lastStartListeningMs;
        if (elapsed < MIN_MS_BETWEEN_STT_STARTS) {
            schedulePassiveRelisten((int) (MIN_MS_BETWEEN_STT_STARTS - elapsed));
            return;
        }
        if (!requestMicAudioFocus()) {
            schedulePassiveRelisten(nextMediaBackoffMs());
            return;
        }
        try {
            startInFlight = true;
            lastStartListeningMs = now;
            recognizer.startListening(recognizerIntent);
        } catch (Exception ignored) {
            clearRecognizerListeningState();
            releaseMicAudioFocus();
            if (mayUseMicNow()) {
                schedulePassiveRelisten(1400);
            }
        }
    }

    /** One debounced “open mic again” pass — same {@link SpeechRecognizer} instance, no destroy/recreate. */
    private void schedulePassiveRelisten(long ms) {
        mainHandler.removeCallbacks(resumeListeningRunnable);
        mainHandler.postDelayed(resumeListeningRunnable, ms);
    }

    private void clearRecognizerListeningState() {
        isListening = false;
        startInFlight = false;
    }

    private int nextMediaBackoffMs() {
        int out = mediaBackoffMs;
        mediaBackoffMs = Math.min(MEDIA_ACTIVE_RECHECK_MAX_MS, mediaBackoffMs + 650);
        return out;
    }

    private boolean isMediaPlaybackActive() {
        AudioManager am = audioManager;
        if (am == null) return false;
        try {
            return am.isMusicActive();
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean requestMicAudioFocus() {
        AudioManager am = audioManager;
        if (am == null) return true;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioFocusRequest req =
                    new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
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
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE);
            return r == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        } catch (Exception ignored) {
            return false;
        }
    }

    private void releaseMicAudioFocus() {
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
