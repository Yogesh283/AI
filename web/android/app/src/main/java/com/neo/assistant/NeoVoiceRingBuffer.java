package com.neo.assistant;

/**
 * Thread-safe ring of mono PCM16 samples with a monotonic write counter so consumers can read sequentially
 * or copy absolute ranges (e.g. pre-roll before wake).
 */
final class NeoVoiceRingBuffer {
    private final int capacity;
    private final short[] data;
    private long totalWritten;

    NeoVoiceRingBuffer(int capacitySamples) {
        if (capacitySamples < 1024) {
            throw new IllegalArgumentException("capacity too small");
        }
        this.capacity = capacitySamples;
        this.data = new short[capacitySamples];
        this.totalWritten = 0L;
    }

    synchronized long getTotalWritten() {
        return totalWritten;
    }

    /** Append samples from mic read; overwrites oldest when full. */
    synchronized void append(short[] src, int offset, int len) {
        if (len <= 0) {
            return;
        }
        for (int i = 0; i < len; i++) {
            long w = totalWritten + i;
            data[(int) (w % capacity)] = src[offset + i];
        }
        totalWritten += len;
    }

    /**
     * Copy absolute sample range {@code [start, end)} into {@code out} at {@code outOff}.
     * Indices may be negative if history was overwritten; missing samples are filled as silence.
     *
     * @return number of samples written into {@code out}
     */
    synchronized int copyAbsoluteRange(long start, long end, short[] out, int outOff) {
        if (end <= start || out == null || outOff < 0) {
            return 0;
        }
        int n = (int) Math.min(end - start, Integer.MAX_VALUE / 2);
        if (out.length - outOff < n) {
            n = out.length - outOff;
        }
        for (int i = 0; i < n; i++) {
            long idx = start + i;
            if (idx < 0 || idx >= totalWritten) {
                out[outOff + i] = 0;
                continue;
            }
            long lag = totalWritten - idx;
            if (lag > capacity) {
                out[outOff + i] = 0;
                continue;
            }
            out[outOff + i] = data[(int) (idx % capacity)];
        }
        return n;
    }

    /**
     * Advance {@code cursor[0]} and fill {@code frame} with the next {@code frameLen} samples.
     *
     * @return {@code frameLen} if a full frame was available, otherwise 0
     */
    synchronized int readAdvance(long[] cursor, short[] frame, int frameLen) {
        if (cursor == null || cursor.length < 1 || frame == null || frameLen <= 0 || frame.length < frameLen) {
            return 0;
        }
        long c = cursor[0];
        long available = totalWritten - c;
        if (available < frameLen) {
            return 0;
        }
        for (int i = 0; i < frameLen; i++) {
            long idx = c + i;
            frame[i] = data[(int) (idx % capacity)];
        }
        cursor[0] = c + frameLen;
        return frameLen;
    }
}
