package com.neo.assistant;

import ai.picovoice.porcupine.Porcupine;
import ai.picovoice.porcupine.PorcupineException;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import java.io.IOException;
import java.util.Arrays;

/**
 * Single {@link AudioRecord} + ring buffer + Porcupine wake + VAD capture + Whisper transcription.
 * No {@link android.speech.SpeechRecognizer}. Rhino is optional via {@link NeoVoiceRhinoEngine} (stub until wired).
 */
final class NeoVoicePipeline implements Runnable {
    private static final String TAG = "NeoVoicePipeline";
    private static boolean loggedMissingPorcupineConfig = false;
    private boolean wakeWordEnabled = true;

    /** ~500 ms pre-roll at 16 kHz (adjust if sample rate differs). */
    private static final int PREROLL_SAMPLES = 8000;
    private static final int MAX_CAPTURE_SAMPLES = 16000 * 22;
    private static final long MIN_CAPTURE_SAMPLES = 4800;
    private static final long SILENCE_END_MS = 480;
    private static final long WAKE_DEBOUNCE_MS = 1200L;

    public interface Host {
        boolean shouldRun();

        boolean mayUseMic();

        boolean mediaBlocking();

        boolean chatBusy();

        boolean ttsPlaying();

        void onTranscript(String raw);

        void requestRelistenMs(int ms);
    }

    private enum VoiceState {
        IDLE_WAKE,
        CAPTURE
    }

    private final android.content.Context appCtx;
    private final Host host;
    private final Handler mainHandler;

    private volatile boolean running;
    private volatile boolean threadStarted;
    private Thread worker;

    private Porcupine porcupine;
    private AudioRecord audioRecord;
    private int sampleRate;
    private int frameLen;
    private NeoVoiceRingBuffer ring;
    private final long[] porcupineCursor = new long[1];
    private short[] frameScratch;

    private volatile VoiceState state = VoiceState.IDLE_WAKE;
    private short[] captureBuf;
    private int captureLen;
    private long silenceAccumMs;
    private long speechAccumMs;
    private long lastWakeMs;

    NeoVoicePipeline(android.content.Context context, Host host) {
        this.appCtx = context.getApplicationContext();
        this.host = host;
        this.mainHandler = new Handler(Looper.getMainLooper());
    }

    synchronized void start() {
        if (threadStarted) {
            return;
        }
        wakeWordEnabled = PorcupineStreamWake.canInit(appCtx);
        if (!wakeWordEnabled && !loggedMissingPorcupineConfig) {
            loggedMissingPorcupineConfig = true;
            Log.i(TAG, "Wake keyword unavailable (missing Porcupine config). Using speech-first fallback.");
        }
        running = true;
        threadStarted = true;
        worker = new Thread(this, "neo-voice-pipeline");
        worker.start();
    }

    synchronized void shutdown() {
        running = false;
        Thread w = worker;
        worker = null;
        threadStarted = false;
        if (w != null) {
            try {
                w.join(6000L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
        releaseAudio();
        releasePorcupine();
    }

    @Override
    public void run() {
        if (wakeWordEnabled) {
            try {
                porcupine =
                    new Porcupine.Builder()
                        .setAccessKey(BuildConfig.PV_ACCESS_KEY.trim())
                        .setKeywordPath(NeoPrefs.getPorcupineKeywordAssetPath(appCtx))
                        .setSensitivity(0.55f)
                        .build(appCtx);
            } catch (PorcupineException e) {
                Log.e(TAG, "Porcupine build failed; switching to speech-first fallback.", e);
                wakeWordEnabled = false;
            }
        }
        sampleRate = wakeWordEnabled && porcupine != null ? porcupine.getSampleRate() : 16000;
        frameLen = wakeWordEnabled && porcupine != null ? porcupine.getFrameLength() : 512;
        frameScratch = new short[frameLen];
        ring = new NeoVoiceRingBuffer(sampleRate * 15);

        int minBuf =
            AudioRecord.getMinBufferSize(
                sampleRate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (minBuf <= 0) {
            Log.e(TAG, "Invalid AudioRecord min buffer");
            releasePorcupine();
            return;
        }
        int bufSize = Math.max(minBuf, frameLen * 6);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                AudioFormat fmt =
                    new AudioFormat.Builder()
                        .setSampleRate(sampleRate)
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
                        .build();
                audioRecord =
                    new AudioRecord.Builder()
                        .setAudioFormat(fmt)
                        .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                        .setBufferSizeInBytes(bufSize)
                        .build();
            } else {
                audioRecord =
                    new AudioRecord(
                        MediaRecorder.AudioSource.VOICE_RECOGNITION,
                        sampleRate,
                        AudioFormat.CHANNEL_IN_MONO,
                        AudioFormat.ENCODING_PCM_16BIT,
                        bufSize);
            }
        } catch (Exception e) {
            Log.e(TAG, "AudioRecord create failed", e);
            releasePorcupine();
            return;
        }
        if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
            Log.e(TAG, "AudioRecord not initialized");
            releaseAudio();
            releasePorcupine();
            return;
        }
        try {
            audioRecord.startRecording();
        } catch (Exception e) {
            Log.e(TAG, "startRecording failed", e);
            releaseAudio();
            releasePorcupine();
            return;
        }

        short[] readFrame = new short[frameLen];
        while (running && host.shouldRun()) {
            if (!host.mayUseMic()) {
                pauseAudioIfSupported();
                sleepQuiet(90);
                continue;
            }
            resumeAudioIfSupported();

            if (host.mediaBlocking()) {
                sleepQuiet(220);
                continue;
            }

            int n = audioRecord.read(readFrame, 0, frameLen);
            if (n <= 0) {
                sleepQuiet(40);
                continue;
            }
            ring.append(readFrame, 0, n);

            if (wakeWordEnabled) {
                drainPorcupineOnRing();
            } else if (state == VoiceState.IDLE_WAKE && !host.ttsPlaying() && !host.chatBusy()) {
                /*
                 * Fallback when Porcupine is unavailable: detect speech onset and capture directly.
                 * Command routing still runs in service-level policy.
                 */
                if (meanAbs(readFrame, n) > 700.0) {
                    beginCaptureAtRingEnd();
                }
            }

            if (state == VoiceState.CAPTURE) {
                processCaptureFrame(readFrame, n);
            }
        }
        try {
            if (audioRecord.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) {
                audioRecord.stop();
            }
        } catch (Exception ignored) {
        }
        releaseAudio();
        releasePorcupine();
    }

    private void drainPorcupineOnRing() {
        if (porcupine == null) {
            return;
        }
        while (true) {
            int r = ring.readAdvance(porcupineCursor, frameScratch, frameLen);
            if (r < frameLen) {
                break;
            }
            try {
                int kw = porcupine.process(frameScratch);
                if (kw >= 0
                    && state == VoiceState.IDLE_WAKE
                    && !host.ttsPlaying()
                    && !host.chatBusy()) {
                    long now = System.currentTimeMillis();
                    if (now - lastWakeMs >= WAKE_DEBOUNCE_MS) {
                        lastWakeMs = now;
                        beginCaptureAtRingEnd();
                    }
                }
            } catch (PorcupineException e) {
                Log.e(TAG, "Porcupine process failed", e);
                break;
            }
        }
    }

    private void beginCaptureAtRingEnd() {
        long end = ring.getTotalWritten();
        long start = Math.max(0L, end - PREROLL_SAMPLES);
        captureBuf = new short[MAX_CAPTURE_SAMPLES];
        captureLen = ring.copyAbsoluteRange(start, end, captureBuf, 0);
        state = VoiceState.CAPTURE;
        silenceAccumMs = 0L;
        speechAccumMs = 0L;
    }

    private void processCaptureFrame(short[] frame, int len) {
        if (captureBuf == null) {
            state = VoiceState.IDLE_WAKE;
            return;
        }
        long frameMs = (len * 1000L) / sampleRate;
        double meanAbs = meanAbs(frame, len);
        boolean speechy = meanAbs > 550.0;
        if (speechy) {
            speechAccumMs += frameMs;
            silenceAccumMs = 0L;
        } else {
            silenceAccumMs += frameMs;
        }
        if (captureLen + len > captureBuf.length) {
            finalizeCaptureAndTranscribe();
            return;
        }
        System.arraycopy(frame, 0, captureBuf, captureLen, len);
        captureLen += len;

        if (speechAccumMs >= 120 && silenceAccumMs >= SILENCE_END_MS && captureLen >= MIN_CAPTURE_SAMPLES) {
            finalizeCaptureAndTranscribe();
        } else if (captureLen >= MAX_CAPTURE_SAMPLES - frameLen) {
            finalizeCaptureAndTranscribe();
        }
    }

    private static double meanAbs(short[] s, int len) {
        if (len <= 0) {
            return 0;
        }
        long sum = 0;
        for (int i = 0; i < len; i++) {
            sum += Math.abs((int) s[i]);
        }
        return sum / (double) len;
    }

    private void finalizeCaptureAndTranscribe() {
        state = VoiceState.IDLE_WAKE;
        final short[] pcm = Arrays.copyOf(captureBuf, captureLen);
        captureBuf = null;
        captureLen = 0;
        silenceAccumMs = 0L;
        speechAccumMs = 0L;
        if (pcm.length < MIN_CAPTURE_SAMPLES) {
            return;
        }
        new Thread(() -> transcribeAndDeliver(pcm), "neo-whisper").start();
    }

    private void transcribeAndDeliver(short[] pcm) {
        NeoVoiceRhinoEngine.Result rhino = NeoVoiceRhinoEngine.infer(appCtx, pcm, pcm.length, sampleRate);
        String text = "";
        if (rhino != null && rhino.isUnderstood()) {
            text = mapRhinoToText(rhino);
        }
        if (text.isEmpty()) {
            try {
                byte[] wav = NeoVoiceWavUtil.pcm16MonoToWavBytes(pcm, pcm.length, sampleRate);
                text = NeoVoiceWhisperClient.transcribeWav(wav, null);
            } catch (IOException ignored) {
                text = "";
            }
        }
        final String out = text == null ? "" : text.trim();
        if (out.isEmpty()) {
            mainHandler.post(() -> host.requestRelistenMs(1800));
            return;
        }
        mainHandler.post(() -> host.onTranscript(out));
    }

    /** Map Rhino intent/slots to a phrase {@link NeoCommandRouter} can parse; extend when Rhino is enabled. */
    private static String mapRhinoToText(NeoVoiceRhinoEngine.Result r) {
        if (r == null) {
            return "";
        }
        return "";
    }

    private void pauseAudioIfSupported() {
        if (audioRecord == null) {
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= 24) {
                AudioRecord.class.getMethod("pause").invoke(audioRecord);
            }
        } catch (Exception ignored) {
        }
    }

    private void resumeAudioIfSupported() {
        if (audioRecord == null) {
            return;
        }
        try {
            if (Build.VERSION.SDK_INT >= 24) {
                AudioRecord.class.getMethod("resume").invoke(audioRecord);
            }
        } catch (Exception ignored) {
        }
    }

    private static void sleepQuiet(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void releaseAudio() {
        if (audioRecord != null) {
            try {
                audioRecord.release();
            } catch (Exception ignored) {
            }
        }
        audioRecord = null;
    }

    private void releasePorcupine() {
        if (porcupine != null) {
            try {
                porcupine.delete();
            } catch (Exception ignored) {
            }
        }
        porcupine = null;
    }
}
