/**
 * Node smoke test for voice intent routing (no browser, no mic).
 * Run: npx tsx scripts/test-voice-commands.ts
 */
import {
  extractHelloNeoCommand,
  processNeoCommandLine,
} from "../src/lib/neoVoiceCommands";
import {
  clearNeoFollowUpSession,
  startNeoFollowUpSession,
} from "../src/lib/neoVoiceSession";

let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (!ok) {
    failed++;
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`ok  ${name}`);
  }
}

function main() {
  clearNeoFollowUpSession();

  const hi = extractHelloNeoCommand("Hello Neo open WhatsApp");
  check(
    "extract wake + rest",
    hi.hadWake && /open whatsapp/i.test(hi.rest),
    JSON.stringify(hi),
  );

  const n1 = extractHelloNeoCommand("namaste neo open youtube");
  check("namaste neo wake", n1.hadWake && /open youtube/i.test(n1.rest), JSON.stringify(n1));

  const n2 = extractHelloNeoCommand("हैलो नियो व्हाट्सएप खोलो");
  check("Hindi hailo neo wake", n2.hadWake && /खोलो/.test(n2.rest), JSON.stringify(n2));

  const n3 = extractHelloNeoCommand("hullo neo time");
  check("hullo neo wake", n3.hadWake && /time/i.test(n3.rest), JSON.stringify(n3));

  const rTypo = processNeoCommandLine("Hello Neo open whatasapp", "voice", { speechLang: "en-IN" });
  check(
    "ASR typo whatasapp → open_url",
    rTypo.actions.length === 1 &&
      rTypo.actions[0]?.kind === "open_url" &&
      String(rTypo.actions[0].url).includes("web.whatsapp"),
    JSON.stringify(rTypo.actions),
  );

  const r1 = processNeoCommandLine("Hello Neo, open WhatsApp", "voice", {
    speechLang: "en-IN",
  });
  check(
    "Hello Neo open WhatsApp → open_url",
    r1.actions.length === 1 &&
      r1.actions[0]?.kind === "open_url" &&
      String(r1.actions[0].url).includes("web.whatsapp"),
    JSON.stringify(r1.actions),
  );

  const r2 = processNeoCommandLine("Neo open WhatsApp", "voice", { speechLang: "en-IN" });
  check(
    "Neo open WhatsApp → open_url",
    r2.actions.length === 1 && r2.actions[0]?.kind === "open_url",
    JSON.stringify(r2.actions),
  );

  const r3 = processNeoCommandLine("open WhatsApp", "voice", { speechLang: "en-IN" });
  check(
    "no wake, no follow-up → ignored",
    r3.actions.length === 0 && r3.reply === "",
    `reply=${JSON.stringify(r3.reply)}`,
  );

  startNeoFollowUpSession();
  const r4 = processNeoCommandLine("open WhatsApp", "voice", { speechLang: "en-IN" });
  check(
    "follow-up open WhatsApp → open_url",
    r4.actions.length === 1 && r4.actions[0]?.kind === "open_url",
    JSON.stringify(r4.actions),
  );

  clearNeoFollowUpSession();
  /* Matches `whatsappOpenCommand` Devanagari (ए in व्हाट्सएप for खोलो patterns). */
  const r5 = processNeoCommandLine("Hello Neo व्हाट्सएप खोलो", "voice", { speechLang: "hi-IN" });
  check(
    "Hindi WhatsApp kholo → open_url",
    r5.actions.length === 1 && r5.actions[0]?.kind === "open_url",
    JSON.stringify(r5.actions),
  );

  const r5b = processNeoCommandLine("Hello Neo व्हाट्स एप खोलो", "voice", { speechLang: "hi-IN" });
  check(
    "Hindi WhatsApp spaced → open_url",
    r5b.actions.length === 1 && r5b.actions[0]?.kind === "open_url",
    JSON.stringify(r5b.actions),
  );

  const r5c = processNeoCommandLine("Hello Neo टेली ग्राम खोलो", "voice", { speechLang: "hi-IN" });
  check(
    "Hindi Telegram spaced → open_url",
    r5c.actions.length === 1 && r5c.actions[0]?.kind === "open_url",
    JSON.stringify(r5c.actions),
  );

  const r5d = processNeoCommandLine("Hello Neo मेरी कॉन्टैक्ट लिस्ट खोलो", "voice", { speechLang: "hi-IN" });
  check(
    "Hindi contact list → open_url",
    r5d.actions.length === 1 && r5d.actions[0]?.kind === "open_url",
    JSON.stringify(r5d.actions),
  );

  startNeoFollowUpSession();
  const rMic = processNeoCommandLine("mic off", "voice", { speechLang: "en-IN" });
  check(
    "follow-up mic off → silent (no TTS template)",
    rMic.reply === "" && rMic.actions.length === 0,
    JSON.stringify(rMic),
  );
  clearNeoFollowUpSession();

  const rUnk = processNeoCommandLine("Neo what is my favorite color", "voice", { speechLang: "en-IN" });
  check(
    "voice unknown intent → speakable reply (not empty)",
    rUnk.actions.length === 0 && rUnk.reply.includes("didn't match"),
    JSON.stringify({ reply: rUnk.reply }),
  );

  const r6 = processNeoCommandLine("Hello Neo", "voice", {
    speechLang: "en-IN",
    displayName: "Alex",
  });
  check(
    "wake only → reply + no actions",
    r6.actions.length === 0 && r6.reply.length > 10,
    `reply len=${r6.reply.length}`,
  );

  if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll voice command checks passed.");
}

main();
