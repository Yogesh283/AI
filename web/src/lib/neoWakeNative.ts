/**
 * Android APK: keep `WakeWordForegroundService` in sync with Profile toggles (assistant, Hello Neo wake, screen-off).
 * Web + non-native: storage only (no-op for native calls).
 */

import { isNativeCapacitor } from "@/lib/nativeAppLinks";
import {
  readNeoAlexaListen,
  readNeoAssistantActive,
} from "@/lib/neoAssistantActive";

export const NEO_WAKE_SCREEN_OFF_KEY = "neo-wake-screen-off";

const WAKE_SCREEN_OFF_CHANGED = "neo-wake-screen-off-changed";

export function readWakeListenScreenOffStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(NEO_WAKE_SCREEN_OFF_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
    /* Policy: voice command module is active only while screen is ON. */
    if (isNativeCapacitor()) return false;
    return false;
  } catch {
    return false;
  }
}

export function writeWakeListenScreenOffStorage(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(NEO_WAKE_SCREEN_OFF_KEY, "1");
    else window.localStorage.setItem(NEO_WAKE_SCREEN_OFF_KEY, "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(WAKE_SCREEN_OFF_CHANGED));
}

export function subscribeNeoWakeScreenOffListen(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => onChange();
  const onStorage = (e: StorageEvent) => {
    if (e.key === NEO_WAKE_SCREEN_OFF_KEY) onChange();
  };
  window.addEventListener(WAKE_SCREEN_OFF_CHANGED, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(WAKE_SCREEN_OFF_CHANGED, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

let wakeBridgeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

async function runWakeBridgeSyncOnce(): Promise<void> {
  if (!isNativeCapacitor()) return;
  /*
   * Android 14+ microphone FGS eligibility is strict while app is background/hidden.
   * Avoid start/stop churn from hidden WebView ticks; MainActivity foreground lifecycle
   * remains the source of truth for keeping/stopping wake.
   */
  if (typeof document !== "undefined" && document.visibilityState !== "visible") {
    return;
  }
  const assistantActive = readNeoAssistantActive();
  const alexaListen = readNeoAlexaListen();
  const screenOff = readWakeListenScreenOffStorage();
  try {
    const { NeoNativeRouter } = await import("@/lib/neoNativeRouter");
    const voiceChatPageActive =
      typeof window !== "undefined" &&
      typeof window.location?.pathname === "string" &&
      window.location.pathname.startsWith("/voice");
    /*
     * Hard lock:
     * Voice chat mode is page-scoped only. If user is not on /voice, force it OFF so
     * app-open voice commands never drift into chat behavior.
     */
    await NeoNativeRouter.setWakeVoiceChatMode({ enabled: voiceChatPageActive });
    const voiceChatMode = voiceChatPageActive;
    /*
     * MainActivity.onUserLeaveHint stops wake when the user leaves Neo for another app.
     * WebView visibility becomes hidden on screen-off / lock even while wake should stay up — do not treat
     * that as “background” when voice-chat / screen-off / assistant+wake toggles expect native listening.
     */
    const ignoreWebVisibilityWhen =
      voiceChatMode || screenOff || (assistantActive && alexaListen);
    const webSaysVisible = true;
    const appVisible = ignoreWebVisibilityWhen || webSaysVisible;
    /** Keep wake running for command mode, voice-chat page mode, or explicit screen-off listening mode. */
    const shouldRunWake = appVisible && (voiceChatMode || screenOff || (assistantActive && alexaListen));
    if (shouldRunWake) {
      await NeoNativeRouter.startWakeListener({ screenOffListen: screenOff || voiceChatMode });
    } else {
      await NeoNativeRouter.stopWakeListener();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Coalesce rapid Profile toggles so Android doesn’t get overlapping start/stop foreground-service calls.
 * @param immediate skip debounce (e.g. screen-off toggle should apply now)
 */
export async function syncNativeWakeBridge(immediate = false): Promise<void> {
  if (!isNativeCapacitor()) return;
  if (immediate) {
    if (wakeBridgeDebounceTimer) {
      clearTimeout(wakeBridgeDebounceTimer);
      wakeBridgeDebounceTimer = null;
    }
    await runWakeBridgeSyncOnce();
    return;
  }
  return new Promise<void>((resolve) => {
    if (wakeBridgeDebounceTimer) clearTimeout(wakeBridgeDebounceTimer);
    wakeBridgeDebounceTimer = setTimeout(async () => {
      wakeBridgeDebounceTimer = null;
      try {
        await runWakeBridgeSyncOnce();
      } finally {
        resolve();
      }
    }, 300);
  });
}

export async function persistWakeScreenOffNative(enabled: boolean): Promise<void> {
  writeWakeListenScreenOffStorage(enabled);
  if (!isNativeCapacitor()) return;
  await syncNativeWakeBridge(true);
}

/** Separate wake voice-chat mode toggle (OpenAI chat replies over TTS after Hello Neo). */
export async function setNativeWakeVoiceChatMode(enabled: boolean): Promise<void> {
  if (!isNativeCapacitor()) return;
  try {
    const { NeoNativeRouter } = await import("@/lib/neoNativeRouter");
    await NeoNativeRouter.setWakeVoiceChatMode({ enabled });
    /*
     * Critical: apply mode change immediately to WakeWordForegroundService start/stop policy.
     * Without this, screen-off "Hello Neo" may stay stale until some unrelated bridge sync runs.
     */
    await syncNativeWakeBridge(true);
  } catch {
    /* ignore */
  }
}

/**
 * Voice chat mode is page-scoped: true only while `/voice` page is open in app.
 * Screen-off chat remains available via native policy, independent of this flag.
 */
export async function setNativeVoiceChatPageActive(active: boolean): Promise<void> {
  await setNativeWakeVoiceChatMode(active);
}

export async function getNativeWakeVoiceChatMode(): Promise<boolean> {
  if (!isNativeCapacitor()) return false;
  try {
    const { NeoNativeRouter } = await import("@/lib/neoNativeRouter");
    const r = await NeoNativeRouter.getWakeVoiceChatMode();
    return !!r.enabled;
  } catch {
    return false;
  }
}
