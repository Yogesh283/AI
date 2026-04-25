import { registerPlugin } from "@capacitor/core";

export type NeoNativeRouterPlugin = {
  tryRouteCommand(options: { text: string }): Promise<{ handled: boolean }>;
  /** In-app WebView route, e.g. `/profile` (voice “open my account”). */
  openAppPath(options: { path: string }): Promise<void>;
  /** Android: {@code ACTION_VIEW} for {@code whatsapp://}, {@code tg://}, {@code tel:}, etc. — avoids WebView “invalid link”. */
  openDeepLink(options: { url: string }): Promise<{ opened: boolean; reason?: string }>;
  startWakeListener(options?: { screenOffListen?: boolean }): Promise<void>;
  stopWakeListener(): Promise<void>;
  setWakeScreenOffListen(options: { enabled: boolean }): Promise<void>;
  getWakeScreenOffListen(): Promise<{ enabled: boolean }>;
  setWakePorcupineStream(options: { enabled: boolean }): Promise<void>;
  getWakePorcupineStream(): Promise<{ enabled: boolean }>;
};

/** Android: runs `NeoCommandRouter.execute` (real app intents, not WebView https). */
export const NeoNativeRouter = registerPlugin<NeoNativeRouterPlugin>("NeoNativeRouter", {
  web: {
    tryRouteCommand: async () => ({ handled: false }),
    openAppPath: async () => {},
    openDeepLink: async ({ url }) => {
      if (typeof window !== "undefined" && url) {
        try {
          window.location.assign(url);
        } catch {
          /* ignore */
        }
      }
      return { opened: true };
    },
    startWakeListener: async () => {},
    stopWakeListener: async () => {},
    setWakeScreenOffListen: async () => {},
    getWakeScreenOffListen: async () => ({ enabled: false }),
    setWakePorcupineStream: async () => {},
    getWakePorcupineStream: async () => ({ enabled: false }),
  },
});
