package com.neo.assistant;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/** Builds a minimal WAV (PCM16 LE mono) for HTTP upload. */
final class NeoVoiceWavUtil {

    private NeoVoiceWavUtil() {}

    static byte[] pcm16MonoToWavBytes(short[] samples, int len, int sampleRate) throws IOException {
        if (len <= 0 || sampleRate <= 0) {
            return new byte[0];
        }
        int dataBytes = len * 2;
        int riffChunkSize = 36 + dataBytes;
        ByteArrayOutputStream bos = new ByteArrayOutputStream(44 + dataBytes);
        ByteBuffer hdr = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN);
        hdr.put("RIFF".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        hdr.putInt(riffChunkSize);
        hdr.put("WAVE".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        hdr.put("fmt ".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        hdr.putInt(16);
        hdr.putShort((short) 1);
        hdr.putShort((short) 1);
        hdr.putInt(sampleRate);
        hdr.putInt(sampleRate * 2);
        hdr.putShort((short) 2);
        hdr.putShort((short) 16);
        hdr.put("data".getBytes(java.nio.charset.StandardCharsets.US_ASCII));
        hdr.putInt(dataBytes);
        bos.write(hdr.array());
        ByteBuffer body = ByteBuffer.allocate(dataBytes).order(ByteOrder.LITTLE_ENDIAN);
        for (int i = 0; i < len; i++) {
            body.putShort(samples[i]);
        }
        bos.write(body.array());
        return bos.toByteArray();
    }
}
