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

public class WakeWordForegroundService extends Service {
    public static final String ACTION_START = "com.neo.assistant.action.START_WAKE";
    public static final String ACTION_STOP = "com.neo.assistant.action.STOP_WAKE";

    private static final String CHANNEL_ID = "neo_wake_channel_silent_v2";
    private static final int NOTIFICATION_ID = 9001;

    private SpeechRecognizer recognizer;
    private Intent recognizerIntent;
    private boolean shouldListen = false;
    private PowerManager.WakeLock wakeLock;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private BroadcastReceiver screenReceiver;

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
        acquirePartialWakeLock();
        initRecognizer();
        registerScreenStateReceiver();
    }

    /** While display is off, do not run speech recognition — avoids OEM “beep” / tun-tun on each start cycle in pocket. */
    private boolean isDeviceInteractive() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        return pm == null || pm.isInteractive();
    }

    private void registerScreenStateReceiver() {
        screenReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                if (Intent.ACTION_SCREEN_OFF.equals(intent.getAction())) {
                    stopListeningSilently();
                } else if (Intent.ACTION_SCREEN_ON.equals(intent.getAction()) && shouldListen) {
                    restartWithDelay(500);
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
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = buildNotification();
        startForeground(NOTIFICATION_ID, notification);
        shouldListen = true;
        startListeningSafe();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        shouldListen = false;
        mainHandler.removeCallbacksAndMessages(null);
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
                if (!isDeviceInteractive()) return;
                restartWithDelay(450);
            }

            @Override
            public void onResults(android.os.Bundle results) {
                handleResults(results);
                if (!shouldListen || !isDeviceInteractive()) return;
                restartWithDelay(120);
            }

            @Override
            public void onPartialResults(android.os.Bundle partialResults) {
                if (!isDeviceInteractive()) return;
                handleResults(partialResults);
            }
        });

        recognizerIntent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 700L);
        recognizerIntent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 500L);
    }

    private void handleResults(android.os.Bundle bundle) {
        if (!isDeviceInteractive()) return;
        if (bundle == null) return;
        ArrayList<String> matches = bundle.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if (matches == null || matches.isEmpty()) return;
        String said = normalize(matches.get(0));
        if (said.isEmpty()) return;

        String command = extractWakeCommand(said);
        if (command == null) return;

        if (command.isEmpty()) {
            return;
        }

        NeoCommandRouter.execute(this, command);
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
        if (!isDeviceInteractive()) return;
        try {
            recognizer.startListening(recognizerIntent);
        } catch (Exception ignored) {
            if (isDeviceInteractive()) {
                restartWithDelay(700);
            }
        }
    }

    private void restartWithDelay(long ms) {
        mainHandler.removeCallbacksAndMessages(null);
        mainHandler.postDelayed(() -> {
            if (!shouldListen) return;
            if (!isDeviceInteractive()) return;
            startListeningSafe();
        }, ms);
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
