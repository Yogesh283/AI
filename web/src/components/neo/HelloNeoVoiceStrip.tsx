"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  primeSpeechVoices,
  readHelloNeoTtsGender,
  readHelloNeoTtsSpeedPreset,
  readHelloNeoTtsTonePreset,
  speakText,
  speechRecognitionErrorMessage,
  stopSpeaking,
  unlockWebAudioAndSpeechFromUserGesture,
} from "@/lib/voiceChat";
import { tryPlayOpenAiTtsPlain, stopAvatarTtsAudio } from "@/lib/voiceAvatarTts";
import { preferOpenAiTtsForVoiceUi } from "@/lib/voiceTtsPolicy";
import { neoWorkingAckPhrase, readStoredVoiceSpeechLang } from "@/lib/voiceLanguages";
import { isNativeCapacitor } from "@/lib/nativeAppLinks";
import {
  executeNeoActions,
  extractHelloNeoCommand,
  isShortOpenActionReply,
  processNeoCommandLine,
} from "@/lib/neoVoiceCommands";
import { clearNeoFollowUpSession, isNeoFollowUpActive } from "@/lib/neoVoiceSession";
import {
  readNeoAlexaListen,
  readNeoAssistantActive,
  subscribeNeoAlexaListen,
  subscribeNeoAssistantActive,
} from "@/lib/neoAssistantActive";

/** Lower = faster flush after you pause (wake listen on Profile). */
const DEBOUNCE_MS = 260;
const FLUSH_AFTER_SPEECH_END_MS = 160;
/**
 * After Web Speech `onend`, wait before `start()` again — long enough that short Neo TTS usually finishes
 * (avoids mic catching the reply), short enough that wake listen feels “always on” in the background.
 */
const HELLO_NEO_MIC_RESTART_BASE_MS = 1400;
/** Tiny delay before `start()` after the base cooldown — fewer OEM “tun” / focus glitches than immediate start. */
const HELLO_NEO_ONEND_START_JITTER_MS = 52;

async function speakReply(text: string, lang: string) {
  primeSpeechVoices();
  try {
    window.speechSynthesis?.resume();
    /* APK WebView: no usable `speechSynthesis` — same `/neo-api/api/voice/tts-audio` path as Voice chat. */
    if (preferOpenAiTtsForVoiceUi()) {
      const ok = await tryPlayOpenAiTtsPlain(text, readHelloNeoTtsGender());
      if (ok) return;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      await speakText(text, lang, {
        voiceGender: readHelloNeoTtsGender(),
        speedPreset: readHelloNeoTtsSpeedPreset(),
        tonePreset: readHelloNeoTtsTonePreset(),
        replyMood: "neutral",
      });
    }
  } catch {
    /* ignore */
  }
}

export type HelloNeoVoiceStripVariant = "dock" | "profile";

type Props = {
  /** `profile`: card on Profile only. `dock`: legacy full-width bar (unused in layout). */
  variant?: HelloNeoVoiceStripVariant;
};

/**
 * Tap-to-talk + optional wake listen (foreground only). Commands run only after **Neo** / **Hello Neo** / **हेलो नियो**,
 * or during a short post-wake window (~8s). Wake listen uses one continuous `SpeechRecognition` session; after each
 * engine `onend` it restarts quietly (cooldown + tiny jitter) — no extra UI tones; other speech is ignored until wake.
 * Profile toggles; `variant="profile"` only on Profile.
 */
export function HelloNeoVoiceStrip({ variant = "dock" }: Props) {
  const isProfile = variant === "profile";
  const [assistantActive, setAssistantActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [alexaMode, setAlexaMode] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  /** True while the post–wake-word command window is active (a few seconds after “Hello Neo” only). */
  const [neoFollowUpOpen, setNeoFollowUpOpen] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalBuf = useRef("");
  const alexaRecRef = useRef<SpeechRecognition | null>(null);
  const bufferRef = useRef("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alexaStopRef = useRef(false);
  const alexaModeRef = useRef(false);
  const alexaRestartTimerRef = useRef<number | null>(null);

  useEffect(() => {
    alexaModeRef.current = alexaMode;
  }, [alexaMode]);

  useEffect(() => {
    setAssistantActive(readNeoAssistantActive());
    return subscribeNeoAssistantActive(() => {
      setAssistantActive(readNeoAssistantActive());
    });
  }, []);

  useEffect(() => {
    setAlexaMode(readNeoAlexaListen());
    return subscribeNeoAlexaListen(() => {
      setAlexaMode(readNeoAlexaListen());
    });
  }, []);

  useEffect(() => {
    if (!assistantActive) {
      setNeoFollowUpOpen(false);
      return;
    }
    const id = window.setInterval(() => {
      setNeoFollowUpOpen(isNeoFollowUpActive());
    }, 600);
    return () => window.clearInterval(id);
  }, [assistantActive]);

  const stopRec = useCallback(() => {
    stopSpeaking();
    stopAvatarTtsAudio();
    try {
      recRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
  }, []);

  const stopAlexa = useCallback(() => {
    alexaStopRef.current = true;
    if (alexaRestartTimerRef.current) {
      clearTimeout(alexaRestartTimerRef.current);
      alexaRestartTimerRef.current = null;
    }
    try {
      alexaRecRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    alexaRecRef.current = null;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    bufferRef.current = "";
  }, []);

  useEffect(() => {
    if (!assistantActive) {
      stopRec();
      stopAlexa();
      return;
    }
    setAlexaMode(readNeoAlexaListen());
  }, [assistantActive, stopRec, stopAlexa]);

  const runPipeline = useCallback(async (said: string) => {
    const lang = readStoredVoiceSpeechLang();
    const syncFollowUp = () => setNeoFollowUpOpen(isNeoFollowUpActive());
    const trimmed = said.replace(/\s+/g, " ").trim();
    if (!trimmed) {
      syncFollowUp();
      return;
    }

    const inFollowUp = isNeoFollowUpActive();
    const { hadWake, rest } = extractHelloNeoCommand(trimmed);

    /** Commands run only after “Neo” / “Hello Neo”, or inside the post-wake window — same for APK native routing. */
    if (!inFollowUp && !hadWake) {
      syncFollowUp();
      return;
    }

    if (!inFollowUp && hadWake && !rest.trim()) {
      const { reply, actions } = processNeoCommandLine(trimmed, "voice", { speechLang: lang });
      if (reply.trim()) {
        await speakReply(reply, lang);
      }
      if (actions.length > 0) {
        executeNeoActions(actions);
      }
      syncFollowUp();
      return;
    }

    const commandText = inFollowUp ? trimmed : rest.trim();

    if (isNativeCapacitor()) {
      try {
        const { NeoNativeRouter } = await import("@/lib/neoNativeRouter");
        const t = commandText.toLowerCase();
        const skipTapBusyLine =
          /\b(what\s+)?(is\s+)?(the\s+)?time\b|\btime\s+now\b|\bcurrent\s+time\b|समय|टाइम\b/.test(t) ||
          /\b(volume|mute|unmute|louder|softer|sound)\b|वॉल्यूम|आवाज|म्यूट/i.test(t);
          /* Native wake uses calm delayed routing in `NeoCommandRouter`; tap path may speak a short line before routing. */
        if (!skipTapBusyLine) {
          await speakReply(neoWorkingAckPhrase(lang, readHelloNeoTtsGender()), lang);
        }
        const { handled } = await NeoNativeRouter.tryRouteCommand({ text: commandText });
        if (handled) {
          clearNeoFollowUpSession();
          syncFollowUp();
          return;
        }
      } catch {
        /* fall through to JS routing */
      }
    }

    const { reply, actions } = processNeoCommandLine(trimmed, "voice", { speechLang: lang });
    const willAct = actions.length > 0;
    if (willAct) {
      await speakReply(neoWorkingAckPhrase(lang, readHelloNeoTtsGender()), lang);
    }
    if (reply.trim()) {
      if (!willAct || !isShortOpenActionReply(reply)) {
        await speakReply(reply, lang);
      }
    }
    if (willAct) {
      executeNeoActions(actions);
    }
    syncFollowUp();
  }, []);

  const startListen = useCallback(() => {
    setHint(null);
    unlockWebAudioAndSpeechFromUserGesture();
    if (!isSpeechRecognitionSupported()) {
      setHint("Voice needs Chrome or Edge on this device.");
      return;
    }
    stopRec();
    finalBuf.current = "";
    const lang = readStoredVoiceSpeechLang();
    const rec = createSpeechRecognition(lang);
    if (!rec) {
      setHint("Could not start microphone.");
      return;
    }
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) {
          finalBuf.current += ev.results[i][0].transcript;
        }
      }
    };
    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      const msg = speechRecognitionErrorMessage(ev.error);
      if (msg) setHint(msg);
      stopRec();
    };
    rec.onend = () => {
      void (async () => {
        const said = finalBuf.current.trim();
        recRef.current = null;
        setListening(false);
        finalBuf.current = "";
        if (!said) {
          setHint("Didn't catch that — tap again and speak.");
          return;
        }
        try {
          await runPipeline(said);
        } catch {
          setHint("Could not respond.");
        }
      })();
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setHint("Mic busy — try again.");
    }
  }, [runPipeline, stopRec]);

  /* Continuous listen — only while app is open & foreground (WebView / browser). */
  useEffect(() => {
    if (!assistantActive) {
      stopAlexa();
      return;
    }
    if (!alexaMode) {
      stopAlexa();
      return;
    }
    if (isNativeCapacitor()) {
      stopAlexa();
      /* Native `WakeWordForegroundService` + `NeoWakeNativeSync` — avoid a second mic in WebView. */
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      setHint("Wake listen needs Chrome or Edge.");
      return;
    }
    alexaStopRef.current = false;
    const lang = readStoredVoiceSpeechLang();
    const rec = createSpeechRecognition(lang, { continuous: true });
    if (!rec) return;
    alexaRecRef.current = rec;

    const flush = () => {
      const t = bufferRef.current.replace(/\s+/g, " ").trim();
      bufferRef.current = "";
      if (!t || alexaStopRef.current) return;
      void runPipeline(t).catch(() => setHint("Could not respond."));
    };

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (!ev.results[i].isFinal) continue;
        bufferRef.current += ev.results[i][0].transcript + " ";
      }
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(flush, DEBOUNCE_MS);
    };
    (rec as SpeechRecognition & { onspeechend?: () => void }).onspeechend = () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(flush, FLUSH_AFTER_SPEECH_END_MS);
    };
    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      const msg = speechRecognitionErrorMessage(ev.error);
      if (msg && ev.error !== "aborted") setHint(msg);
    };
    rec.onend = () => {
      if (alexaStopRef.current || !alexaModeRef.current) return;
      if (alexaRestartTimerRef.current) clearTimeout(alexaRestartTimerRef.current);
      const tid = window.setTimeout(() => {
        alexaRestartTimerRef.current = null;
        if (alexaStopRef.current || !alexaModeRef.current) return;
        const r = alexaRecRef.current;
        if (!r) return;
        window.setTimeout(() => {
          if (alexaStopRef.current || !alexaModeRef.current) return;
          if (alexaRecRef.current !== r) return;
          try {
            r.start();
          } catch {
            /* ignore */
          }
        }, HELLO_NEO_ONEND_START_JITTER_MS);
      }, HELLO_NEO_MIC_RESTART_BASE_MS) as unknown as number;
      alexaRestartTimerRef.current = tid;
    };

    try {
      rec.start();
    } catch {
      setHint("Could not start wake listener.");
    }

    return () => {
      stopAlexa();
    };
  }, [assistantActive, alexaMode, runPipeline, stopAlexa]);

  if (!assistantActive) {
    if (isProfile) {
      return (
        <section className="neo-screen-card overflow-hidden rounded-[22px]">
          <div className="border-b border-slate-200/90 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-black">Try Neo</h2>
            <p className="mt-0.5 text-xs text-black/65">Voice commands from this screen</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[13px] leading-relaxed text-black/75">
              <span className="font-semibold text-black">Neo</span> is set to Inactive above. Turn{" "}
              <span className="font-semibold text-emerald-700">Status</span> to Active, then tap the mic or turn on Hello
              Neo wake listen above.
            </p>
          </div>
        </section>
      );
    }
    return (
      <div className="border-b border-white/[0.06] bg-[#080a0f]/95 px-3 py-2.5 md:px-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-relaxed text-white/45">
            <span className="font-semibold text-white/55">Neo</span> is off — no listening or wake. Turn it{" "}
            <span className="text-emerald-400/90">Active</span> in{" "}
            <Link href="/profile" className="text-[#00D4FF]/90 underline-offset-2 hover:underline">
              Profile
            </Link>
            .
          </p>
        </div>
      </div>
    );
  }

  if (isProfile) {
    return (
      <section className="neo-screen-card overflow-hidden rounded-[22px]">
        <div className="border-b border-slate-200/90 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-black">Try Neo</h2>
          <p className="mt-0.5 text-xs text-black/70">
            Say <span className="font-medium text-black">Neo</span> or Hello Neo, then e.g. music, YouTube, WhatsApp,
            Telegram, contacts, or time.{" "}
            {isNativeCapacitor()
              ? "Wake listen runs in the app while Hello Neo wake is on (see Profile); other speech is ignored until you say the wake phrase."
              : "Wake listen only runs while you stay on this page; other speech is ignored until you say the wake phrase."}
          </p>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] leading-snug text-amber-900/95">
              Cannot read chats or auto-post for you here — only open WhatsApp Web, Telegram Web, or dial a number.
              Phone locked or app fully closed: not supported in this browser app (needs native Android).
            </p>
            <p className="text-[11px] text-black/65">
              Type?{" "}
              <Link href="/chat" className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
                Chat
              </Link>
              {" · "}
              <Link href="/voice" className="font-semibold text-emerald-700 underline-offset-2 hover:underline">
                Voice chat
              </Link>
            </p>
          </div>
          <button
            type="button"
            disabled={alexaMode}
            onClick={listening ? stopRec : startListen}
            className={`flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto ${
              listening
                ? "bg-red-600 text-white shadow-sm ring-2 ring-red-500/40 hover:bg-red-700"
                : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
            }`}
            aria-pressed={listening}
          >
            <span className={`text-lg tabular-nums ${listening ? "text-white/90" : "text-white/80"}`} aria-hidden>
              {listening ? "■" : "●"}
            </span>
            {alexaMode ? "Voice ready (off above)" : listening ? "Stop" : "Tap — talk once"}
          </button>
        </div>
        {neoFollowUpOpen ? (
          <div
            role="status"
            aria-live="polite"
            className="border-t border-slate-200/80 bg-emerald-50/40 px-5 py-2 text-center text-[11px] leading-snug text-black/75"
          >
            Neo is active — say your command now (~8s, no need to say &quot;Neo&quot; again). After that, say{" "}
            <span className="font-semibold text-black">Hello Neo</span> again. Wake listen restarts quietly in the
            background — no extra tones.
          </div>
        ) : null}
        {alexaMode ? (
          <p className="sr-only">
            Hello Neo voice is on — turn off from Profile if you want.
          </p>
        ) : null}
        {hint ? (
          <p className="border-t border-slate-200/80 px-5 py-2.5 text-center text-[11px] text-amber-900">{hint}</p>
        ) : null}
      </section>
    );
  }

  return (
    <div className="border-b border-[#00D4FF]/20 bg-gradient-to-r from-[#0a1018] to-[#080a0f] px-3 py-3 md:px-5">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00D4FF]/90">Neo</p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/65">
              Say <span className="text-white/88">Neo</span> or <span className="text-white/88">Hello Neo</span> — e.g.{" "}
              music / YouTube, <span className="text-white/88">&quot;Neo open my WhatsApp&quot;</span>, Telegram,
              contacts, time, or call a number. Speech without the wake phrase does nothing. If you only say the wake
              phrase, Neo confirms, then you get a short window for the next command without repeating the wake.{" "}
              <span className="text-white/55">Wake listen</span> (mic for Hello Neo on Profile) is only in{" "}
              <Link href="/profile" className="text-[#00D4FF]/90 underline-offset-2 hover:underline">
                Profile
              </Link>
              . Turn the whole assistant off there too.
            </p>
            <p className="mt-1.5 text-[11px] leading-snug text-amber-300/80">
              This app cannot read WhatsApp or Telegram inboxes (same as Alexa with other companies&apos; apps). APK /
              browser: works while the app is <strong className="font-semibold">open</strong> — not after you close it.
            </p>
            <p className="mt-1 text-[11px] text-white/40">
              Type?{" "}
              <Link href="/chat" className="text-[#00D4FF]/90 underline-offset-2 hover:underline">
                Chat
              </Link>
              {" · "}
              Full voice UI?{" "}
              <Link href="/voice" className="text-[#00D4FF]/90 underline-offset-2 hover:underline">
                Voice chat
              </Link>
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <button
              type="button"
              disabled={alexaMode}
              onClick={listening ? stopRec : startListen}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                listening
                  ? "bg-rose-500/25 text-rose-100 ring-2 ring-rose-400/50"
                  : "neo-gradient-fill text-[#050912] shadow-[0_4px_24px_rgba(0,212,255,0.28),0_4px_40px_rgba(106,92,255,0.2)] hover:brightness-105"
              }`}
              aria-pressed={listening}
            >
              <span className="text-lg tabular-nums text-white/50" aria-hidden>
                {listening ? "■" : "●"}
              </span>
              {alexaMode ? "Voice ready (toggle off for tap)" : listening ? "Stop" : "Tap — talk once"}
            </button>
          </div>
        </div>
        {neoFollowUpOpen ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-center text-[11px] leading-snug text-white/50"
          >
            Neo is active — say your command now (~8s, no need to say &quot;Neo&quot; again). Then say{" "}
            <span className="text-white/70">Hello Neo</span> again. Wake listen restarts quietly — no extra tones.
          </div>
        ) : null}
        {alexaMode ? (
          <p className="sr-only">
            Hello Neo voice is on — change in Profile; keep app open.
          </p>
        ) : null}
        {hint ? (
          <p className="text-center text-[11px] text-amber-300/95">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
