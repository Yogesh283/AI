/**
 * Capacitor sync runs handleCordovaPluginsJS with zero Cordova plugins and removes
 * android .../assets/public/plugins — then JSExport.getCordovaPluginJS logs
 * "Unable to read file at path public/plugins". Recreate a minimal file after sync.
 */
const fs = require("fs");
const path = require("path");

const plat = process.env.CAPACITOR_PLATFORM_NAME || "";
if (plat && plat !== "android") {
  process.exit(0);
}

const destDir = path.join(
  __dirname,
  "..",
  "android",
  "app",
  "src",
  "main",
  "assets",
  "public",
  "plugins",
);
const destFile = path.join(destDir, "cordova-plugins-stub.js");
const contents =
  "/* Stub: no Cordova plugins; Capacitor removes this dir on sync — restored by capacitor:copy:after. */\n";

fs.mkdirSync(destDir, { recursive: true });
fs.writeFileSync(destFile, contents, "utf8");
