"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  primeSpeechVoices,
  readTtsGender,
  readTtsSpeedPreset,
  speakText,
  speechRecognitionErrorMessage,
} from "@/lib/voiceChat";
import { readStoredVoiceSpeechLang } from "@/lib/voiceLanguages";
import { executeNeoActions, processNeoCommandLine } from "@/lib/neoVoiceCommands";
import {
  readNeoAlexaListen,
  readNeoAssistantActive,
  subscribeNeoAlexaListen,
  subscribeNeoAssistantActive,
} from "@/lib/neoAssistantActive";

const DEBOUNCE_MS = 650;

async function speakReply(text: string, lang: string) {
  primeSpeechVoices();
  try {
    window.speechSynthesis?.resume();
    await speakText(text, lang, {
      voiceGender: readTtsGender(),
      speedPreset: readTtsSpeedPreset(),
      replyMood: "neutral",
    });
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
 * Tap-to-talk + optional Alexa-style continuous listen (foreground only).
 * Wake: **Neo** / **नियो** (Hello Neo still works). Profile toggles; `variant="profile"` only on Profile.
 */
export function HelloNeoVoiceStrip({ variant = "dock" }: Props) {
  const isProfile = variant === "profile";
  const [assistantActive, setAssistantActive] = useState(true);
  const [listening, setListening] = useState(false);
  const [alexaMode, setAlexaMode] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalBuf = useRef("");
  const alexaRecRef = useRef<SpeechRecognition | null>(null);
  const bufferRef = useRef("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alexaStopRef = useRef(false);
  const alexaModeRef = useRef(false);

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

  const stopRec = useCallback(() => {
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
    const { reply, actions } = processNeoCommandLine(said, "voice");
    executeNeoActions(actions);
    if (actions.length > 0) {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
      return;
    }
    if (reply.trim()) await speakReply(reply, lang);
  }, []);

  const startListen = useCallback(() => {
    setHint(null);
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
    if (!isSpeechRecognitionSupported()) {
      setHint("Alexa-style mode needs Chrome or Edge.");
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
    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      const msg = speechRecognitionErrorMessage(ev.error);
      if (msg && ev.error !== "aborted") setHint(msg);
    };
    rec.onend = () => {
      if (!alexaStopRef.current && alexaModeRef.current) {
        try {
          rec.start();
        } catch {
          /* ignore */
        }
      }
    };

    try {
      rec.start();
    } catch {
      setHint("Could not start always-on mic.");
    }

    return () => {
      stopAlexa();
    };
  }, [assistantActive, alexaMode, runPipeline, stopAlexa]);

  if (!assistantActive) {
    if (isProfile) {
      return (
        <section className="neo-glass overflow-hidden rounded-[22px] ring-1 ring-white/[0.06]">
          <div className="border-b border-white/[0.07] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-white/90">Try Neo</h2>
            <p className="mt-0.5 text-xs text-white/40">Voice commands from this screen</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[13px] leading-relaxed text-white/50">
              <span className="font-semibold text-white/65">Neo</span> is set to Inactive above. Turn{" "}
              <span className="text-emerald-400/90">Status</span> to Active, then use the mic or always-on listen.
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
      <section className="neo-glass overflow-hidden rounded-[22px] ring-1 ring-white/[0.06]">
        <div className="border-b border-white/[0.07] px-5 py-3.5">
          <h2 className="text-sm font-semibold text-white/90">Try Neo</h2>
          <p className="mt-0.5 text-xs text-white/40">
            Say <span className="text-white/60">Neo</span> or <span className="text-white/60">नियो</span> (or Hello
            Neo), then e.g. open WhatsApp / Telegram or call a number. Switches are above. Always-on mic only runs
            while you stay on this page.
          </p>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] leading-snug text-amber-300/85">
              Cannot read chats or auto-post for you here — only open WhatsApp Web, Telegram Web, or dial a number.
              Phone locked or app fully closed: not supported in this browser app (needs native Android).
            </p>
            <p className="text-[11px] text-white/38">
              Type?{" "}
              <Link href="/chat" className="text-[#00D4FF]/90 underline-offset-2 hover:underline">
                Chat
              </Link>
              {" · "}
              <Link href="/voice" className="text-[#00D4FF]/90 underline-offset-2 hover:underline">
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
                ? "bg-rose-500/25 text-rose-100 ring-2 ring-rose-400/50"
                : "bg-gradient-to-r from-[#00D4FF] to-[#6366f1] text-[#050912] shadow-[0_4px_24px_rgba(0,212,255,0.35)] hover:brightness-105"
            }`}
            aria-pressed={listening}
          >
            <span className="text-lg" aria-hidden>
              {listening ? "■" : "🎤"}
            </span>
            {alexaMode ? "Mic always on (off above)" : listening ? "Stop" : "Tap — talk once"}
          </button>
        </div>
        {alexaMode ? (
          <p className="border-t border-white/[0.06] px-5 py-2.5 text-center text-[11px] font-medium text-emerald-300/90">
            Listening for &quot;Neo&quot; — only on this page; turn off with the switch above.
          </p>
        ) : null}
        {hint ? (
          <p className="border-t border-white/[0.06] px-5 py-2.5 text-center text-[11px] text-amber-300/95">{hint}</p>
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
              <span className="text-white/88">&quot;Neo open my WhatsApp&quot;</span>,{" "}
              <span className="text-white/88">&quot;Neo open Telegram&quot;</span>, or{" "}
              <span className="text-white/88">call … number</span>. If you only say Neo once, you get a short window
              for the next command without repeating the wake.{" "}
              <span className="text-white/55">Alexa-style always-on mic</span> is only in{" "}
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
                  : "bg-gradient-to-r from-[#00D4FF] to-[#6366f1] text-[#050912] shadow-[0_4px_24px_rgba(0,212,255,0.35)] hover:brightness-105"
              }`}
              aria-pressed={listening}
            >
              <span className="text-lg" aria-hidden>
                {listening ? "■" : "🎤"}
              </span>
              {alexaMode ? "Mic always on (toggle off for tap)" : listening ? "Stop" : "Tap — talk once"}
            </button>
          </div>
        </div>
        {alexaMode ? (
          <p className="text-center text-[11px] font-medium text-emerald-300/90">
            Always listening for &quot;Neo&quot; — change in{" "}
            <Link href="/profile" className="underline underline-offset-2 hover:text-white">
              Profile
            </Link>{" "}
            (keep app open)
          </p>
        ) : null}
        {hint ? (
          <p className="text-center text-[11px] text-amber-300/95">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
