import type { CapacitorConfig } from "@capacitor/cli";

/** Remote origin for the Next app in the WebView. If unset, `public-capacitor/index.html` is only a stub (no JS). */
const defaultProdServerUrl = "https://myneoxai.com";
const serverUrl =
  process.env.CAP_SERVER_URL?.trim() || defaultProdServerUrl;

/**
 * Extra origins the WebView may navigate to (OAuth, assets). Without this, some
 * redirects or subresource flows can misbehave; primary fix for “white then timeout”
 * is still a reachable `server.url` + good network.
 */
function navigationAllowlist(url: string): string[] {
  const out = new Set<string>([
    "https://accounts.google.com",
    "https://*.google.com",
    "https://*.gstatic.com",
    "https://*.googleusercontent.com",
    "https://oauth2.googleapis.com",
    "https://www.google.com",
  ]);
  try {
    const u = new URL(url);
    out.add(`${u.protocol}//${u.host}`);
    const h = u.hostname;
    if (h && h !== "localhost" && !/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
      out.add(`https://*.${h}`);
    }
  } catch {
    out.add("https://myneoxai.com");
  }
  return Array.from(out);
}

const config: CapacitorConfig = {
  appId: "com.neo.assistant",
  appName: "NeoAssistant",
  webDir: "public-capacitor",
  /** Dark behind WebView while the remote page paints (reduces harsh white flash). */
  backgroundColor: "#0a0a12",
  android: {
    /**
     * If Next (or a CDN) ever registers a service worker, routing SW fetches through the
     * bridge can break or hang on some WebViews — prefer default browser SW handling.
     */
    resolveServiceWorkerRequests: false,
  },
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
          allowNavigation: navigationAllowlist(serverUrl),
          /** Shown when the remote URL fails to load (no Capacitor plugins on this page). */
          errorPath: "error.html",
        },
      }
    : {}),
};

export default config;
