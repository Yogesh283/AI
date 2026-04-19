/**
 * Re-applies NeoXAI vendor patch to @capawesome/capacitor-google-sign-in after npm install.
 * CredentialManager must run on the Android main thread (see GoogleSignIn.java header).
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = path.join(root, "patches", "vendor", "capawesome-google-sign-in", "GoogleSignIn.java");
const dest = path.join(
  root,
  "node_modules",
  "@capawesome",
  "capacitor-google-sign-in",
  "android",
  "src",
  "main",
  "java",
  "io",
  "capawesome",
  "capacitorjs",
  "plugins",
  "googlesignin",
  "GoogleSignIn.java",
);

if (!fs.existsSync(src)) {
  console.warn("[apply-google-signin-patch] skip: patch source missing:", src);
  process.exit(0);
}
if (!fs.existsSync(path.dirname(dest))) {
  console.warn("[apply-google-signin-patch] skip: dependency not installed yet");
  process.exit(0);
}
fs.copyFileSync(src, dest);
console.log("[apply-google-signin-patch] OK →", path.relative(root, dest));
