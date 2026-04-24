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
import {
  neoVoiceCommandSessionGreeting,
  neoWorkingAckPhrase,
  readStoredVoiceSpeechLang,
} from "@/lib/voiceLanguages";
import { postChat } from "@/lib/api";
import { getStoredToken, getStoredUser } from "@/lib/auth";
import { isNativeCapacitor } from "@/lib/nativeAppLinks";
import {
  executeNeoActions,
  extractHelloNeoCommand,
  isShortOpenActionReply,
  isVoiceGeneralHelpReply,
  processNeoCommandLine,
} from "@/lib/neoVoiceCommands";
import {
  clearNeoFollowUpSession,
  isNeoFollowUpActive,
  startNeoFollowUpSession,
} from "@/lib/neoVoiceSession";
import {
  readNeoAlexaListen,
  readNeoAssistantActive,
  subscribeNeoAlexaListen,
  subscribeNeoAssistantActive,
} from "@/lib/neoAssistantActive";

/** Tap-to-talk: silence after last speech (final or interim) before stopping the mic — finals are often late in Chrome. */
const TAP_TO_TALK_IDLE_MS = 5500;

async function speakReply(text: string, lang: string) {
  primeSpeechVoices();
  try {
    window.speechSynthesis?.resume();
    /* APK WebView: no usable `speechSynthesis` — same `/neo-api/api/voice/tts-audio` path as Voice chat. */
    if (preferOpenAiTtsForVoiceUi()) {
      const ok = await tryPlayOpenAiTtsPlain(text, readHelloNeoTtsGender(), { calmCommandVoice: true });
      if (ok) return;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      await speakText(text, lang, {
        voiceGender: readHelloNeoTtsGender(),
        speedPreset: readHelloNeoTtsSpeedPreset(),
        tonePreset: readHelloNeoTtsTonePreset(),
        replyMood: "neutral",
        voiceCommandCalmDelivery: true,
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
 * Tap-to-talk + optional Hello Neo wake. **Browser (Profile):** Web Speech + same command router as typed chat.
 * **Android:** native wake service when installed; tap path can forward to {@link NeoNativeRouter}.
 * **Tap:** after the greeting, a follow-up window opens so commands can run **without** repeating the wake phrase.
 * **Wake listen:** say **Neo** / **Hello Neo** / **हेलो नियो** first (unless already in that window).
 */
export function HelloNeoVoiceStrip({ variant = "dock" }: Props) {
  const isProfile = variant === "profile";
  const [assistantActive, setAssistantActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [alexaMode, setAlexaMode] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  /** True while the post–wake command window is active (after “Hello Neo” only, or after Try Neo greeting). */
  const [neoFollowUpOpen, setNeoFollowUpOpen] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalBuf = useRef("");
  /** DOM timers are numeric handles in browsers (Node typings use `Timeout`). */
  const tapIdleTimerRef = useRef<number | null>(null);
  /** Browser-only continuous listen when “Hello Neo wake” is on in Profile. */
  const wakeRecRef = useRef<SpeechRecognition | null>(null);
  const wakeRestartTimerRef = useRef<number | null>(null);
  const wakeDebounceTimerRef = useRef<number | null>(null);
  const wakeBufRef = useRef("");
  /** Latest interim slice from the wake recognizer — combined with finals so “Hello Neo” is heard before `isFinal`. */
  const wakeInterimRef = useRef("");
  const listeningRef = useRef(false);
  const lastWakeProcessedRef = useRef<{ t: string; at: number }>({ t: "", at: 0 });

  const clearTapIdle = useCallback(() => {
    if (tapIdleTimerRef.current !== null) {
      clearTimeout(tapIdleTimerRef.current);
      tapIdleTimerRef.current = null;
    }
  }, []);

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

  const stopWakeListen = useCallback(() => {
    if (wakeRestartTimerRef.current !== null) {
      clearTimeout(wakeRestartTimerRef.current);
      wakeRestartTimerRef.current = null;
    }
    if (wakeDebounceTimerRef.current !== null) {
      clearTimeout(wakeDebounceTimerRef.current);
      wakeDebounceTimerRef.current = null;
    }
    wakeBufRef.current = "";
    wakeInterimRef.current = "";
    try {
      wakeRecRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    wakeRecRef.current = null;
  }, []);

  const stopRec = useCallback(() => {
    clearTapIdle();
    stopSpeaking();
    stopAvatarTtsAudio();
    try {
      recRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    listeningRef.current = false;
    setListening(false);
  }, [clearTapIdle]);

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  useEffect(() => {
    if (!assistantActive) {
      stopRec();
      return;
    }
    setAlexaMode(readNeoAlexaListen());
  }, [assistantActive, stopRec]);

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

    /** Wake listen: need wake unless follow-up is active (after “Hello Neo” or after Try Neo greeting). */
    if (!inFollowUp && !hadWake) {
      syncFollowUp();
      return;
    }

    if (!inFollowUp && hadWake && !rest.trim()) {
      const { reply, actions } = processNeoCommandLine(trimmed, "voice", {
        speechLang: lang,
        displayName: getStoredUser()?.display_name,
      });
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
        await speakReply("I can only open installed phone apps in APK mode. Please say the exact app name.", lang);
        clearNeoFollowUpSession();
        syncFollowUp();
        return;
      } catch {
        await speakReply("Native app command service is not available right now.", lang);
        clearNeoFollowUpSession();
        syncFollowUp();
        return;
      }
    }

    let { reply, actions } = processNeoCommandLine(trimmed, "voice", {
      speechLang: lang,
      displayName: getStoredUser()?.display_name,
    });
    const willAct = actions.length > 0;
    if (
      !isNativeCapacitor() &&
      !willAct &&
      reply.trim() &&
      isVoiceGeneralHelpReply(reply) &&
      getStoredToken() &&
      commandText.replace(/\s+/g, " ").trim().length >= 2
    ) {
      try {
        const uid = getStoredUser()?.id ?? "default";
        const j = await postChat(
          [
            {
              role: "system",
              content:
                "You are Neo, a warm human-like assistant. The user used a short voice phrase (maybe mixed Hindi/English). Reply in at most 3 short sentences — conversational, calm, no bullet points or numbered lists. If they asked to open a site or app, you may suggest the closest helpful step for a browser. Never sound rushed.",
            },
            { role: "user", content: commandText.replace(/\s+/g, " ").trim().slice(0, 1400) },
          ],
          uid,
          { source: "voice", speechLang: lang },
        );
        const ai = (j.reply || "").trim();
        if (ai.length > 24) reply = ai.slice(0, 1200);
      } catch {
        /* keep template reply */
      }
    }
    if (willAct) {
      /* Short “Opening …” lines were skipped → users heard nothing if working-ack TTS failed. Speak the concrete line. */
      if (reply.trim() && isShortOpenActionReply(reply)) {
        await speakReply(reply, lang);
      } else {
        await speakReply(neoWorkingAckPhrase(lang, readHelloNeoTtsGender()), lang);
        if (reply.trim() && !isShortOpenActionReply(reply)) {
          await speakReply(reply, lang);
        }
      }
    } else if (reply.trim()) {
      await speakReply(reply, lang);
    }
    if (willAct) {
      executeNeoActions(actions);
    }
    syncFollowUp();
  }, []);

  const flushWakeBuffer = useCallback(() => {
    const said = `${wakeBufRef.current} ${wakeInterimRef.current}`.replace(/\s+/g, " ").trim();
    wakeBufRef.current = "";
    wakeInterimRef.current = "";
    if (!said) return;
    const now = Date.now();
    if (
      said === lastWakeProcessedRef.current.t &&
      now - lastWakeProcessedRef.current.at < 2400
    ) {
      return;
    }
    lastWakeProcessedRef.current = { t: said, at: now };
    void runPipeline(said);
  }, [runPipeline]);

  const scheduleWakeFlush = useCallback(() => {
    if (wakeDebounceTimerRef.current !== null) clearTimeout(wakeDebounceTimerRef.current);
    wakeDebounceTimerRef.current = window.setTimeout(() => {
      wakeDebounceTimerRef.current = null;
      flushWakeBuffer();
    }, 500);
  }, [flushWakeBuffer]);

  /* Web Profile: continuous mic when “Hello Neo wake listen” is on (native uses foreground service). */
  useEffect(() => {
    if (isNativeCapacitor() || !isProfile || !assistantActive || !alexaMode) {
      stopWakeListen();
      return;
    }
    if (listeningRef.current) {
      stopWakeListen();
      return;
    }

    const mayRunWake = () =>
      !isNativeCapacitor() &&
      readNeoAssistantActive() &&
      readNeoAlexaListen() &&
      !listeningRef.current;

    const startWake = () => {
      if (!mayRunWake()) return;
      if (!isSpeechRecognitionSupported()) return;
      try {
        wakeRecRef.current?.abort?.();
      } catch {
        /* ignore */
      }
      wakeRecRef.current = null;
      const lang = readStoredVoiceSpeechLang();
      const rec = createSpeechRecognition(lang, { continuous: true });
      if (!rec) return;
      wakeRecRef.current = rec;
      rec.onresult = (ev: SpeechRecognitionEvent) => {
        let interimAll = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const piece = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) {
            wakeBufRef.current = `${wakeBufRef.current} ${piece}`.trim();
          }
        }
        for (let i = 0; i < ev.results.length; i++) {
          if (!ev.results[i].isFinal) interimAll += ev.results[i][0].transcript;
        }
        wakeInterimRef.current = interimAll.trim();
        const combined = `${wakeBufRef.current} ${wakeInterimRef.current}`.replace(/\s+/g, " ").trim();
        if (combined) scheduleWakeFlush();
      };
      rec.onerror = () => {
        try {
          wakeRecRef.current?.abort?.();
        } catch {
          /* ignore */
        }
        wakeRecRef.current = null;
        if (wakeRestartTimerRef.current !== null) clearTimeout(wakeRestartTimerRef.current);
        if (!mayRunWake()) return;
        const jitter = 200 + Math.floor(Math.random() * 500);
        wakeRestartTimerRef.current = window.setTimeout(startWake, 2200 + jitter);
      };
      rec.onend = () => {
        wakeRecRef.current = null;
        if (wakeRestartTimerRef.current !== null) clearTimeout(wakeRestartTimerRef.current);
        if (!mayRunWake()) return;
        const jitter = 200 + Math.floor(Math.random() * 600);
        wakeRestartTimerRef.current = window.setTimeout(startWake, 2000 + jitter);
      };
      try {
        rec.start();
      } catch {
        if (wakeRestartTimerRef.current !== null) clearTimeout(wakeRestartTimerRef.current);
        if (!mayRunWake()) return;
        const jitter = 200 + Math.floor(Math.random() * 500);
        wakeRestartTimerRef.current = window.setTimeout(startWake, 2600 + jitter);
      }
    };

    startWake();
    return () => {
      stopWakeListen();
    };
  }, [assistantActive, alexaMode, isProfile, listening, stopWakeListen, scheduleWakeFlush]);

  const startListen = useCallback(() => {
    void (async () => {
      stopWakeListen();
      setHint(null);
      unlockWebAudioAndSpeechFromUserGesture();
      if (!isSpeechRecognitionSupported()) {
        setHint("Voice needs Chrome or Edge on this device.");
        return;
      }
      stopRec();
      finalBuf.current = "";
      const tapInterimRef = { current: "" };
      const lang = readStoredVoiceSpeechLang();
      const name = getStoredUser()?.display_name;
      await speakReply(neoVoiceCommandSessionGreeting(lang, name), lang);
      /* Same window as after “Hello Neo” only — users expect “open WhatsApp” right after tapping, without saying Neo. */
      startNeoFollowUpSession();
      setNeoFollowUpOpen(true);

      const rec = createSpeechRecognition(lang);
      if (!rec) {
        setHint("Could not start microphone.");
        return;
      }
      const armTapIdle = () => {
        clearTapIdle();
        tapIdleTimerRef.current = window.setTimeout(() => {
          tapIdleTimerRef.current = null;
          if (recRef.current === rec) {
            stopRec();
          }
        }, TAP_TO_TALK_IDLE_MS);
      };
      rec.onresult = (ev: SpeechRecognitionEvent) => {
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const piece = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) {
            finalBuf.current += piece;
          } else {
            interim += piece;
          }
        }
        tapInterimRef.current = interim;
        const live = `${finalBuf.current} ${tapInterimRef.current}`.replace(/\s+/g, " ").trim();
        if (live) {
          clearTapIdle();
          armTapIdle();
        }
      };
      rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
        const msg = speechRecognitionErrorMessage(ev.error);
        if (msg) setHint(msg);
        stopRec();
      };
      rec.onend = () => {
        void (async () => {
          clearTapIdle();
          const said = `${finalBuf.current} ${tapInterimRef.current}`.replace(/\s+/g, " ").trim();
          recRef.current = null;
          listeningRef.current = false;
          setListening(false);
          finalBuf.current = "";
          tapInterimRef.current = "";
          if (!said) {
            setHint("I didn't quite hear that — tap again and speak clearly.");
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
        listeningRef.current = true;
        setListening(true);
        armTapIdle();
      } catch {
        setHint("Mic busy — try again.");
      }
    })();
  }, [runPipeline, stopRec, stopWakeListen, clearTapIdle]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") {
        stopRec();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [stopRec]);

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
            <span className="font-medium text-black">Tap the mic</span> — after the short greeting you can say your
            command directly (e.g. open WhatsApp, YouTube, time) for ~10 seconds. You can still start with{" "}
            <span className="font-medium text-black">Neo</span> or Hello Neo if you prefer.{" "}
            {isNativeCapacitor()
              ? "Hands-free wake listen (Profile): other speech is ignored until you say the wake phrase."
              : "Hands-free wake listen on this page: say Neo or Hello Neo first, then your command."}
          </p>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] leading-snug text-amber-900/95">
              {isNativeCapacitor()
                ? "Android: enable Notification access for Neo in system settings to hear your latest WhatsApp notification text, then open WhatsApp. Auto-opening a specific chat or sending without your tap is not supported."
                : "Cannot read chats or auto-post for you here — only open WhatsApp Web, Telegram Web, or dial a number. Phone locked or app fully closed: not supported in this browser app (needs native Android)."}
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
            disabled={alexaMode && isNativeCapacitor()}
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
            {alexaMode && isNativeCapacitor()
              ? "Voice ready (off above)"
              : listening
                ? "Stop"
                : "Tap — talk once"}
          </button>
        </div>
        {neoFollowUpOpen ? (
          <div
            role="status"
            aria-live="polite"
            className="border-t border-slate-200/80 bg-emerald-50/40 px-5 py-2 text-center text-[11px] leading-snug text-black/75"
          >
            Neo is active — say your command now (~10s, no need to say &quot;Neo&quot; again). After that, say{" "}
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
              <span className="text-white/88">Profile → Try Neo:</span> tap the mic; after the greeting say your command
              directly (open WhatsApp, time, …) for ~10s, or start with{" "}
              <span className="text-white/88">Neo / Hello Neo</span>. Hands-free{" "}
              <span className="text-white/55">wake listen</span> needs the wake phrase first. If you only say the wake
              phrase, Neo confirms, then you get a short window without repeating it. Wake listen (Profile) is only in{" "}
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
              disabled={alexaMode && isNativeCapacitor()}
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
              {alexaMode && isNativeCapacitor()
                ? "Voice ready (toggle off for tap)"
                : listening
                  ? "Stop"
                  : "Tap — talk once"}
            </button>
          </div>
        </div>
        {neoFollowUpOpen ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-center text-[11px] leading-snug text-white/50"
          >
            Neo is active — say your command now (~10s, no need to say &quot;Neo&quot; again). Then say{" "}
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
