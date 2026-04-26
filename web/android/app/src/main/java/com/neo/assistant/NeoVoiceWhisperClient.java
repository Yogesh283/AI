package com.neo.assistant;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.json.JSONObject;

/** POSTs WAV bytes to backend Whisper proxy ({@code /api/voice/transcribe}). */
final class NeoVoiceWhisperClient {

    static final String DEFAULT_TRANSCRIBE_URL = "https://myneoxai.com/api/voice/transcribe";

    private NeoVoiceWhisperClient() {}

    static String transcribeWav(byte[] wavBytes, String url) {
        if (wavBytes == null || wavBytes.length < 200) {
            return "";
        }
        String endpoint = url == null || url.trim().isEmpty() ? DEFAULT_TRANSCRIBE_URL : url.trim();
        HttpURLConnection conn = null;
        try {
            String boundary = "----NeoBoundary" + UUID.randomUUID();
            conn = (HttpURLConnection) new URL(endpoint).openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(9000);
            conn.setReadTimeout(60000);
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            conn.setRequestProperty("Accept", "application/json");
            byte[] partHeader =
                ("--" + boundary + "\r\n"
                        + "Content-Disposition: form-data; name=\"audio\"; filename=\"audio.wav\"\r\n"
                        + "Content-Type: audio/wav\r\n\r\n")
                    .getBytes(StandardCharsets.UTF_8);
            byte[] partFooter = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(partHeader);
                os.write(wavBytes);
                os.write(partFooter);
            }
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                return "";
            }
            StringBuilder sb = new StringBuilder();
            try (BufferedReader br =
                    new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) {
                    sb.append(line);
                }
            }
            JSONObject json = new JSONObject(sb.toString());
            return json.optString("text", "").trim();
        } catch (Exception ignored) {
            return "";
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}
