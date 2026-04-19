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
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.util.ArrayList;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Foreground “Hello Neo” wake listener: one {@link SpeechRecognizer}, short relisten delays, no per-phrase
 * destroy/recreate. Commands run only after wake phrase + tail (see {@link #consumeRecognizerResults}).
 * While {@link NeoCommandRouter} TTS plays, {@link NeoCommandRouter#isAISpeaking()} blocks feedback.
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
    /** Short gap before the next {@link SpeechRecognizer#startListening} — keeps one recognizer, avoids long “dead air”. */
    private static final int RELISTEN_MS_QUICK = 100;
    private static final int RELISTEN_MS_ERROR = 260;
    /** Wake heard with no command tail — brief pause so the user can finish the phrase. */
    private static final int RELISTEN_MS_AFTER_WAKE_ONLY = 420;

    private final Runnable resumeListeningRunnable =
        () -> {
            if (!shouldListen) return;
            if (!mayUseMicNow()) return;
            if (NeoCommandRouter.isAISpeaking()) return;
            resumePassiveMic();
        };

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        acquirePartialWakeLock();
        initRecognizer();
        porcupineMode = NeoPrefs.isWakePorcupineStreamEnabled(this) && PorcupineStreamWake.canInit(this);
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
                    schedulePassiveRelisten(420);
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
        if (capturingAfterPorcupineWake) {
            return;
        }
        long now = System.currentTimeMillis();
        if (now - lastPorcupineKeywordMs < 900L) {
            return;
        }
        lastPorcupineKeywordMs = now;
        capturingAfterPorcupineWake = true;
        if (porcupineWake != null) {
            porcupineWake.stopRelease();
        }
        startListeningSafe();
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
            NeoPrefs.setWakeListenScreenOff(this, listenScreenOff);
        } else {
            listenScreenOff = NeoPrefs.isWakeListenScreenOff(this);
        }

        Notification notification = buildNotification();
        startForeground(NOTIFICATION_ID, notification);
        shouldListen = true;
        resumePassiveMic();
        return START_STICKY;
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
            @Override public void onReadyForSpeech(android.os.Bundle params) {}
            @Override public void onBeginningOfSpeech() {}
            @Override public void onRmsChanged(float rmsdB) {}
            @Override public void onBufferReceived(byte[] buffer) {}
            @Override public void onEndOfSpeech() {}
            @Override public void onEvent(int eventType, android.os.Bundle params) {}

            @Override
            public void onError(int error) {
                if (!shouldListen) return;
                if (porcupineMode && capturingAfterPorcupineWake) {
                    capturingAfterPorcupineWake = false;
                    if (!mayUseMicNow()) return;
                    if (NeoCommandRouter.isAISpeaking()) return;
                    schedulePassiveRelisten(RELISTEN_MS_ERROR);
                    return;
                }
                if (!mayUseMicNow()) return;
                if (NeoCommandRouter.isAISpeaking()) return;
                schedulePassiveRelisten(RELISTEN_MS_ERROR);
            }

            @Override
            public void onResults(android.os.Bundle results) {
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
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1100L);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 750L);
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
        String said = normalize(matches.get(0));
        if (said.isEmpty()) return RELISTEN_MS_QUICK;

        String command = extractWakeCommand(said);
        if (command == null) {
            return RELISTEN_MS_QUICK;
        }

        if (command.isEmpty()) {
            /* Wake heard (e.g. "hello neo") with no command tail — brief pause before passive listen resumes. */
            return RELISTEN_MS_AFTER_WAKE_ONLY;
        }

        String key = command.trim().toLowerCase(Locale.ROOT);
        long now = System.currentTimeMillis();
        if (key.equals(lastHandledCommandKey) && (now - lastHandledCommandMs) < 3200) {
            return RELISTEN_MS_QUICK;
        }
        lastHandledCommandKey = key;
        lastHandledCommandMs = now;

        NeoCommandRouter.execute(this, command);
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
        try {
            recognizer.startListening(recognizerIntent);
        } catch (Exception ignored) {
            if (mayUseMicNow()) {
                schedulePassiveRelisten(700);
            }
        }
    }

    /** One debounced “open mic again” pass — same {@link SpeechRecognizer} instance, no destroy/recreate. */
    private void schedulePassiveRelisten(long ms) {
        mainHandler.removeCallbacks(resumeListeningRunnable);
        mainHandler.postDelayed(resumeListeningRunnable, ms);
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
            wakeLock.acquire(10 * 60 * 1000L);
        } catch (Exception ignored) {
        }
    }
}
