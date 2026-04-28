package com.neo.assistant;

import android.app.Activity;
import android.os.Build;
import android.util.Log;
import android.view.WindowManager;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Some MediaTek + Mali builds abort with {@code FORTIFY: pthread_mutex_lock called on a destroyed mutex}
 * during early HWUI/EGL teardown — often worsened by "Wait for debugger". Disabling hardware acceleration
 * for the main window avoids that GLES path (see MainActivity comments on Mali / error.html).
 */
final class GpuWorkarounds {
    private static final String TAG = "NeoGpuWorkaround";

    /** Avoid duplicate INFO lines when {@link Activity#onCreate} applies before and after {@code super}. */
    private static volatile boolean loggedWindowPatch;

    private GpuWorkarounds() {}

    /**
     * Heuristic: MTK-class SoCs (common board id prefix {@code mt}) or explicit manufacturer string.
     */
    private static final Pattern HW_MT_NUM = Pattern.compile("(?i)mt[0-9]{3,}");

    static boolean shouldSoftwareRasterMainWindow() {
        String hw = Build.HARDWARE != null ? Build.HARDWARE.toLowerCase(Locale.ROOT) : "";
        String man = Build.MANUFACTURER != null ? Build.MANUFACTURER.toLowerCase(Locale.ROOT) : "";
        if (hw.startsWith("mt") || hw.contains("mediatek")) {
            return true;
        }
        if (man.contains("mediatek")) {
            return true;
        }
        /* Typical board strings: mt6833, xxx_mt6789_zxx */
        return HW_MT_NUM.matcher(hw).find();
    }

    /**
     * Call from {@link Activity#onCreate} <strong>before</strong> {@code super.onCreate} so the window never
     * enables GPU composition for this activity.
     */
    static void disableHardwareAccelerationForWindow(Activity activity) {
        if (activity == null || !shouldSoftwareRasterMainWindow()) {
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.HONEYCOMB) {
            return;
        }
        try {
            if (activity.getWindow() == null) {
                return;
            }
            activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
            if (!loggedWindowPatch) {
                loggedWindowPatch = true;
                Log.i(TAG, "Disabled FLAG_HARDWARE_ACCELERATED for this window (Mali/EGL mutex workaround).");
            }
        } catch (Throwable t) {
            Log.w(TAG, "Could not clear hardware acceleration flag", t);
        }
    }
}
