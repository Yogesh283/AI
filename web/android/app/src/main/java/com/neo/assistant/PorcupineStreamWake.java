package com.neo.assistant;

import ai.picovoice.porcupine.Porcupine;
import ai.picovoice.porcupine.PorcupineException;
import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.util.Log;
import java.io.IOException;

/**
 * Continuous {@link AudioRecord} at Porcupine’s sample rate, feeding frames to Picovoice Porcupine.
 * Custom “Hello Neo” must be trained in Picovoice Console and placed under {@code assets/porcupine/*.ppn}.
 * While {@link NeoCommandRouter#isAISpeaking()} is true, detections are ignored (no extra mic session).
 */
public final class PorcupineStreamWake {
    private static final String TAG = "PorcupineStreamWake";

    public interface Listener {
        void onHelloNeoKeyword();
    }

    private final Context appCtx;
    private final Listener listener;

    private Porcupine porcupine;
    private AudioRecord audioRecord;
    private Thread worker;
    private volatile boolean runningRequested;
    private volatile boolean workerRunning;

    private long lastKeywordMs;

    public PorcupineStreamWake(Context context, Listener listener) {
        this.appCtx = context.getApplicationContext();
        this.listener = listener;
    }

    /** Requires {@link BuildConfig#PV_ACCESS_KEY} and at least one {@code .ppn} under {@code assets/porcupine/}. */
    public static boolean canInit(Context context) {
        if (BuildConfig.PV_ACCESS_KEY == null || BuildConfig.PV_ACCESS_KEY.trim().isEmpty()) {
            return false;
        }
        try {
            String[] list = context.getAssets().list("porcupine");
            if (list == null) {
                return false;
            }
            for (String name : list) {
                if (name.endsWith(".ppn")) {
                    return true;
                }
            }
        } catch (IOException ignored) {
            return false;
        }
        return false;
    }

    public synchronized void ensureStarted() {
        runningRequested = true;
        if (worker != null && worker.isAlive()) {
            return;
        }
        startWorkerLocked();
    }

    /** Releases mic + Porcupine (e.g. before {@link android.speech.SpeechRecognizer#startListening}). */
    public synchronized void stopRelease() {
        runningRequested = false;
        workerRunning = false;
        if (audioRecord != null) {
            try {
                audioRecord.stop();
            } catch (Exception ignored) {
            }
        }
        Thread w = worker;
        worker = null;
        if (w != null) {
            try {
                w.join(5000L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        releaseAudioLocked();
        releasePorcupineLocked();
    }

    public synchronized void shutdown() {
        stopRelease();
    }

    private void startWorkerLocked() {
        try {
            porcupine =
                new Porcupine.Builder()
                    .setAccessKey(BuildConfig.PV_ACCESS_KEY.trim())
                    .setKeywordPath(NeoPrefs.getPorcupineKeywordAssetPath(appCtx))
                    .setSensitivity(0.55f)
                    .build(appCtx);
        } catch (PorcupineException e) {
            Log.e(TAG, "Porcupine build failed", e);
            return;
        }
        int sampleRate = porcupine.getSampleRate();
        int frameLen = porcupine.getFrameLength();
        int minBuf =
            AudioRecord.getMinBufferSize(
                sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (minBuf <= 0) {
            Log.e(TAG, "Invalid min buffer size");
            releasePorcupineLocked();
            return;
        }
        int bufSize = Math.max(minBuf, frameLen * 2 * 4);
        try {
            audioRecord =
                new AudioRecord(
                    MediaRecorder.AudioSource.VOICE_RECOGNITION,
                    sampleRate,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufSize);
        } catch (Exception e) {
            Log.e(TAG, "AudioRecord ctor failed", e);
            releasePorcupineLocked();
            return;
        }
        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "AudioRecord not initialized");
            releaseAudioLocked();
            releasePorcupineLocked();
            return;
        }
        workerRunning = true;
        worker = new Thread(() -> runLoop(frameLen), "neo-porcupine-wake");
        worker.start();
    }

    private void runLoop(int frameLen) {
        short[] frame = new short[frameLen];
        try {
            audioRecord.startRecording();
        } catch (Exception e) {
            Log.e(TAG, "startRecording failed", e);
            workerRunning = false;
            return;
        }
        while (workerRunning && runningRequested) {
            if (audioRecord.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
                break;
            }
            int offset = 0;
            while (offset < frameLen && workerRunning && runningRequested) {
                int r = audioRecord.read(frame, offset, frameLen - offset);
                if (r < 0) {
                    offset = -1;
                    break;
                }
                offset += r;
            }
            if (offset < 0 || offset < frameLen) {
                break;
            }
            try {
                int idx = porcupine.process(frame);
                if (idx >= 0) {
                    if (NeoCommandRouter.isAISpeaking()) {
                        continue;
                    }
                    long now = System.currentTimeMillis();
                    if (now - lastKeywordMs < 900L) {
                        continue;
                    }
                    lastKeywordMs = now;
                    listener.onHelloNeoKeyword();
                }
            } catch (PorcupineException e) {
                Log.e(TAG, "Porcupine process failed", e);
                break;
            }
        }
        workerRunning = false;
        try {
            if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                audioRecord.stop();
            }
        } catch (Exception ignored) {
        }
    }

    private void releaseAudioLocked() {
        if (audioRecord != null) {
            try {
                audioRecord.release();
            } catch (Exception ignored) {
            }
        }
        audioRecord = null;
    }

    private void releasePorcupineLocked() {
        if (porcupine != null) {
            try {
                porcupine.delete();
            } catch (Exception ignored) {
            }
        }
        porcupine = null;
    }
}
