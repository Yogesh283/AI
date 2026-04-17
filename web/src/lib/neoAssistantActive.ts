/**
 * Neo voice assistant: master on/off from Profile (device). When inactive, no wake or mic.
 */

export const NEO_ASSISTANT_ACTIVE_KEY = "neo-assistant-active";

const CHANGED = "neo-assistant-active-changed";

/** Default: active (on). Stored "0" = inactive. */
export function readNeoAssistantActive(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(NEO_ASSISTANT_ACTIVE_KEY);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

export function writeNeoAssistantActive(active: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NEO_ASSISTANT_ACTIVE_KEY, active ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** Same-tab updates from Profile; also cross-tab via storage. */
export function subscribeNeoAssistantActive(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => onChange();
  const onStorage = (e: StorageEvent) => {
    if (e.key === NEO_ASSISTANT_ACTIVE_KEY) onChange();
  };
  window.addEventListener(CHANGED, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGED, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

/** Continuous mic while app is foreground (same key as before). */
export const NEO_ALEXA_LISTEN_KEY = "neo-alexa-listen";

const ALEXA_CHANGED = "neo-alexa-listen-changed";

export function readNeoAlexaListen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(NEO_ALEXA_LISTEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeNeoAlexaListen(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NEO_ALEXA_LISTEN_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(ALEXA_CHANGED));
}

export function subscribeNeoAlexaListen(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => onChange();
  const onStorage = (e: StorageEvent) => {
    if (e.key === NEO_ALEXA_LISTEN_KEY) onChange();
  };
  window.addEventListener(ALEXA_CHANGED, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ALEXA_CHANGED, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
