package com.neo.assistant;

import android.util.Log;
import java.util.Locale;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.json.JSONObject;

/**
 * POSTs WAV bytes to the same origin path the WebView uses: Next {@code /neo-api/*} → FastAPI
 * {@code /api/voice/transcribe}. Hitting {@code /api/...} directly on the public host returns 404 (Next “Server action
 * not found”).
 */
final class NeoVoiceWhisperClient {

    private static final String TAG = "NeoWhisper";
    private static volatile String forcedLanguage = null;

    static final String DEFAULT_TRANSCRIBE_URL = "https://myneoxai.com/neo-api/api/voice/transcribe";

    private NeoVoiceWhisperClient() {}

    static void setForcedLanguage(String lang) {
        if ("en".equalsIgnoreCase(lang)) {
            forcedLanguage = "en";
            return;
        }
        if ("hi".equalsIgnoreCase(lang)) {
            forcedLanguage = "hi";
            return;
        }
        forcedLanguage = null;
    }

    private static String readStreamLimited(InputStream is, int maxChars) throws java.io.IOException {
        if (is == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null && sb.length() < maxChars) {
                sb.append(line);
            }
        }
        return sb.toString();
    }

    static String transcribeWav(byte[] wavBytes, String url) {
        if (wavBytes == null || wavBytes.length < 200) {
            Log.w(TAG, "transcribe: WAV too small (" + (wavBytes == null ? "null" : wavBytes.length) + " bytes)");
            return "";
        }
        String endpoint = url == null || url.trim().isEmpty() ? DEFAULT_TRANSCRIBE_URL : url.trim();
        HttpURLConnection conn = null;
        try {
            String boundary = "----NeoBoundary" + UUID.randomUUID();
            conn = (HttpURLConnection) new URL(endpoint).openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(3200);
            conn.setReadTimeout(12000);
            /* Default Java HttpURLConnection user-agent is often blocked by CDNs / WAFs. */
            conn.setRequestProperty(
                    "User-Agent",
                    "NeoAssistant-Android/" + BuildConfig.VERSION_NAME + " (voice-transcribe)");
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            conn.setRequestProperty("Accept", "application/json");
            String lang = forcedLanguage;
            if (!"hi".equals(lang) && !"en".equals(lang)) {
                String localeLang = Locale.getDefault().getLanguage();
                lang = "hi".equalsIgnoreCase(localeLang) ? "hi" : "en";
            }
            boolean sendLang = "hi".equals(lang) || "en".equals(lang);
            byte[] langPart =
                    sendLang
                            ? ("--" + boundary + "\r\n"
                                            + "Content-Disposition: form-data; name=\"language\"\r\n\r\n"
                                            + lang
                                            + "\r\n")
                                    .getBytes(StandardCharsets.UTF_8)
                            : null;
            byte[] partHeader =
                ("--" + boundary + "\r\n"
                        + "Content-Disposition: form-data; name=\"audio\"; filename=\"audio.wav\"\r\n"
                        + "Content-Type: audio/wav\r\n\r\n")
                    .getBytes(StandardCharsets.UTF_8);
            byte[] partFooter = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                if (langPart != null) {
                    os.write(langPart);
                }
                os.write(partHeader);
                os.write(wavBytes);
                os.write(partFooter);
            }
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                String err =
                        readStreamLimited(
                                code >= 400 ? conn.getErrorStream() : conn.getInputStream(), 800);
                Log.e(TAG, "transcribe HTTP " + code + " @ " + endpoint + " body=" + err);
                return "";
            }
            String body = readStreamLimited(conn.getInputStream(), 65536);
            JSONObject json = new JSONObject(body);
            String errKey = json.optString("error", "").trim();
            if (!errKey.isEmpty()) {
                String hint = json.optString("hint", "").trim();
                if ("transcription_failed".equals(errKey)) {
                    Log.w(
                            TAG,
                            "transcribe server returned no text (likely short wake-only utterance)"
                                    + (hint.isEmpty() ? "" : " hint=" + hint));
                } else {
                    Log.e(TAG, "transcribe server error=" + errKey + (hint.isEmpty() ? "" : " hint=" + hint));
                }
            }
            String text = json.optString("text", "").trim();
            if (text.isEmpty() && errKey.isEmpty()) {
                Log.w(TAG, "transcribe: empty text in 200 response (wavBytes=" + wavBytes.length + ")");
            }
            return text;
        } catch (Exception e) {
            Log.e(TAG, "transcribe failed: " + endpoint, e);
            return "";
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }
}
