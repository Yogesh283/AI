import type { CapacitorConfig } from "@capacitor/cli";

/** Remote origin for the Next app in the WebView. If unset, `public-capacitor/index.html` is only a stub (no JS) and the APK stays on "NeoAssistant loading...". */
const defaultProdServerUrl = "https://myneoxai.com";
const serverUrl =
  process.env.CAP_SERVER_URL?.trim() || defaultProdServerUrl;

const config: CapacitorConfig = {
  appId: "com.neo.assistant",
  appName: "NeoAssistant",
  webDir: "public-capacitor",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
        },
      }
    : {}),
};

export default config;
