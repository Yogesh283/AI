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
    return window.localStorage.getItem(NEO_WAKE_SCREEN_OFF_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeWakeListenScreenOffStorage(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(NEO_WAKE_SCREEN_OFF_KEY, "1");
    else window.localStorage.removeItem(NEO_WAKE_SCREEN_OFF_KEY);
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

/** Start/stop native foreground wake from current localStorage flags. */
export async function syncNativeWakeBridge(): Promise<void> {
  if (!isNativeCapacitor()) return;
  const assistantActive = readNeoAssistantActive();
  const alexaListen = readNeoAlexaListen();
  const screenOff = readWakeListenScreenOffStorage();
  try {
    const { NeoNativeRouter } = await import("@/lib/neoNativeRouter");
    if (assistantActive && alexaListen) {
      await NeoNativeRouter.startWakeListener({ screenOffListen: screenOff });
    } else {
      await NeoNativeRouter.stopWakeListener();
    }
  } catch {
    /* ignore */
  }
}

export async function persistWakeScreenOffNative(enabled: boolean): Promise<void> {
  writeWakeListenScreenOffStorage(enabled);
  if (!isNativeCapacitor()) return;
  await syncNativeWakeBridge();
}
