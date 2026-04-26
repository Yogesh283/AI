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
  const assistantActive = readNeoAssistantActive();
  const alexaListen = readNeoAlexaListen();
  const screenOff = readWakeListenScreenOffStorage();
  const pageVisible =
    typeof document === "undefined" ? true : document.visibilityState === "visible";
  try {
    const { NeoNativeRouter } = await import("@/lib/neoNativeRouter");
    const voiceChatMode = !!(await NeoNativeRouter.getWakeVoiceChatMode()).enabled;
    /*
     * Keep wake service running while:
     * - page is visible (screen ON command mode), or
     * - screen-off listening is explicitly enabled, or
     * - wake voice-chat mode is enabled (screen OFF Hello Neo -> OpenAI chat).
     */
    if (assistantActive && alexaListen && (screenOff || pageVisible || voiceChatMode)) {
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
