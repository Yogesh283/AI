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
    /* APK default: keep screen-off wake OFF to avoid OEM mic on/off chirps in background. */
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
    /*
     * Only keep native wake in background when user explicitly enables screen-off listening.
     * This reduces repeated mic start/stop and OEM "tun" sounds while other apps are in use.
     */
    if (assistantActive && alexaListen && (screenOff || pageVisible)) {
      await NeoNativeRouter.startWakeListener({ screenOffListen: screenOff });
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
