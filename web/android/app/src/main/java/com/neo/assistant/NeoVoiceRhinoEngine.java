package com.neo.assistant;

import android.content.Context;
import java.util.Map;

/**
 * Placeholder for Picovoice Rhino offline NLU. Rhino Android API/version must match the Porcupine line used in the
 * app; wire {@link #infer(Context, short[], int, int)} once a compatible {@code rhino-android} artifact and
 * {@code assets/rhino/*.rhn} context are added.
 */
final class NeoVoiceRhinoEngine {

    interface Result {
        boolean isUnderstood();

        String intent();

        Map<String, String> slots();
    }

    private NeoVoiceRhinoEngine() {}

    static boolean canInit(Context appCtx) {
        return false;
    }

    static Result infer(Context appCtx, short[] pcm, int len, int sampleRate) {
        return null;
    }
}
