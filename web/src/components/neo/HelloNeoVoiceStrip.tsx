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
  readNeoVoiceCommandAudioFeedback,
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
  isMicControlCommand,
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
 * **Tap:** arms a short command window so the same clip may be **wake-free** (e.g. “open WhatsApp”) or include **Neo** /
 * **Hello Neo**; a follow-up window still applies after wake-only phrases.
 * **Wake listen (native):** say **Neo** / **Hello Neo** / **हेलो नियो** first unless already in that window.
 */
export function HelloNeoVoiceStrip({ variant = "dock" }: Props) {
  const isProfile = variant === "profile";
  const [assistantActive, setAssistantActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [alexaMode, setAlexaMode] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  /** True while the post–wake command window is active (after “Hello Neo” only, or after Try Neo greeting). */
  const [neoFollowUpOpen, setNeoFollowUpOpen] = useState(false);
  /** After mic capture ends, until command routing + reply TTS finish. */
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  /** True after tap opens a command window — cleared on pipeline start, empty capture, or stop so abort does not leave a stray window. */
  const tapFollowUpArmedRef = useRef(false);
  const finalBuf = useRef("");
  /** DOM timers are numeric handles in browsers (Node typings use `Timeout`). */
  const tapIdleTimerRef = useRef<number | null>(null);
  /** Browser-only continuous listen when “Hello Neo wake” is on in Profile. */
  const wakeRecRef = useRef<SpeechRecognition | null>(null);
  const wakeRestartTimerRef = useRef<number | null>(null);
  const wakeDebounceTimerRef = useRef<number | null>(null);
  const listeningRef = useRef(false);
  /** True after we stopped {@link NeoNativeRouter} wake for a Try Neo tap (must restart when tap ends). */
  const wakePausedForTapRef = useRef(false);

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
    try {
      wakeRecRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    wakeRecRef.current = null;
  }, []);

  const resumeNativeWakeAfterTapIfNeeded = useCallback(async () => {
    if (!wakePausedForTapRef.current) return;
    wakePausedForTapRef.current = false;
    if (!isNativeCapacitor()) return;
    if (!readNeoAssistantActive() || !readNeoAlexaListen()) return;
    try {
      const { syncNativeWakeBridge } = await import("@/lib/neoWakeNative");
      await syncNativeWakeBridge(true);
    } catch {
      /* ignore */
    }
  }, []);

  const stopRec = useCallback(() => {
    clearTapIdle();
    stopSpeaking();
    stopAvatarTtsAudio();
    if (tapFollowUpArmedRef.current) {
      clearNeoFollowUpSession();
      tapFollowUpArmedRef.current = false;
    }
    try {
      recRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    listeningRef.current = false;
    setListening(false);
    void resumeNativeWakeAfterTapIfNeeded();
  }, [clearTapIdle, resumeNativeWakeAfterTapIfNeeded]);

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
    tapFollowUpArmedRef.current = false;
    const spokenExtras = readNeoVoiceCommandAudioFeedback() === "spoken";
    setPipelineBusy(true);
    const lang = readStoredVoiceSpeechLang();
    const syncFollowUp = () => setNeoFollowUpOpen(isNeoFollowUpActive());
    try {
      const trimmed = said.replace(/\s+/g, " ").trim();
      if (!trimmed) {
        syncFollowUp();
        return;
      }

      const inFollowUp = isNeoFollowUpActive();
      const { hadWake, rest } = extractHelloNeoCommand(trimmed);

      /**
       * Continuous / ambient listen: still wake-gated. Tap-to-talk arms {@link startNeoFollowUpSession} before
       * `rec.start()` so this clip runs as follow-up — user may say the command directly or include Hello Neo.
       */
      if (!inFollowUp && !hadWake) {
        syncFollowUp();
        setHint(
          "पहले «Hello Neo», «Hey Neo», या «नियो» बोलें, फिर कमांड (जैसे व्हाट्सऐप खोलो)। Say Hello Neo (or Neo) first, then your command.",
        );
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
            /\b(volume|mute|unmute|louder|softer|sound)\b|वॉल्यूम|आवाज|म्यूट/i.test(t) ||
            isMicControlCommand(commandText);
          /* Native wake uses calm delayed routing in `NeoCommandRouter`; tap path may speak a short line before routing. */
          if (spokenExtras && !skipTapBusyLine) {
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

      const neoProcessed = processNeoCommandLine(trimmed, "voice", {
        speechLang: lang,
        displayName: getStoredUser()?.display_name,
      });
      let { reply } = neoProcessed;
      const { actions } = neoProcessed;
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
        } else if (spokenExtras) {
          await speakReply(neoWorkingAckPhrase(lang, readHelloNeoTtsGender()), lang);
          if (reply.trim() && !isShortOpenActionReply(reply)) {
            await speakReply(reply, lang);
          }
        } else if (reply.trim()) {
          await speakReply(reply, lang);
        }
      } else if (reply.trim()) {
        await speakReply(reply, lang);
      }
      if (willAct) {
        executeNeoActions(actions);
      }
      syncFollowUp();
    } finally {
      setPipelineBusy(false);
      await resumeNativeWakeAfterTapIfNeeded();
    }
  }, [resumeNativeWakeAfterTapIfNeeded]);

  /**
   * Browser: no always-on wake mic (noise). Tap-to-talk arms a command window — speak a command directly or with
   * Hello Neo. Android APK wake stays in {@link NeoWakeNativeSync} + native service when wake listen is on.
   */
  useEffect(() => {
    stopWakeListen();
  }, [assistantActive, isProfile, stopWakeListen]);

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
      if (readNeoVoiceCommandAudioFeedback() === "spoken") {
        await speakReply(neoVoiceCommandSessionGreeting(lang, name), lang);
      }
      const rec = createSpeechRecognition(lang);
      if (!rec) {
        setHint("Could not start microphone.");
        return;
      }
      /*
       * Native wake holds the device mic — pause it for this WebView STT tap so the user always gets a response path.
       * {@link resumeNativeWakeAfterTapIfNeeded} runs from `runPipeline` finally, `stopRec`, or empty `onend`.
       */
      if (isNativeCapacitor() && readNeoAlexaListen()) {
        try {
          const { NeoNativeRouter } = await import("@/lib/neoNativeRouter");
          await NeoNativeRouter.stopWakeListener();
          wakePausedForTapRef.current = true;
        } catch {
          /* tap may still work if wake was not running */
        }
      }
      /*
       * Opening the command window on tap: same clip may be wake-free (e.g. “open WhatsApp”) or include Hello Neo.
       * Session starts only after we have a recognizer so we do not leave a stray window if creation fails.
       */
      startNeoFollowUpSession();
      tapFollowUpArmedRef.current = true;
      setNeoFollowUpOpen(isNeoFollowUpActive());
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
            if (tapFollowUpArmedRef.current) {
              clearNeoFollowUpSession();
              tapFollowUpArmedRef.current = false;
            }
            setHint("I didn't quite hear that — tap again and speak clearly.");
            await resumeNativeWakeAfterTapIfNeeded();
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
        if (tapFollowUpArmedRef.current) {
          clearNeoFollowUpSession();
          tapFollowUpArmedRef.current = false;
        }
        await resumeNativeWakeAfterTapIfNeeded();
        setHint("Mic busy — try again.");
      }
    })();
  }, [runPipeline, resumeNativeWakeAfterTapIfNeeded, stopRec, stopWakeListen, clearTapIdle]);

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
              <span className="font-semibold text-emerald-700">Status</span> to Active, then use Try Neo (tap mic — say
              your command, or Hello Neo first if you prefer).
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
            <span className="font-medium text-black">Tap the mic</span> — indicator shows while Neo listens (~10s). You can
            say your command directly (e.g. open WhatsApp), or start with{" "}
            <span className="font-medium text-black">Hello Neo</span> / <span className="font-medium text-black">Neo</span> /{" "}
            <span className="font-medium text-black">नियो</span>. After a wake phrase you get a short extra window without repeating
            it. The page mic is only on while you hold a tap session. Optional tap greeting / “one moment” cues:{" "}
            <span className="font-medium text-black">Profile → Voice settings → Voice command audio</span>.{" "}
            {isNativeCapacitor()
              ? "Hands-free wake listen (Profile): native listener until you say the wake phrase. Tap Try Neo anytime — wake pauses briefly so the app can hear you."
              : "Always-on page mic is off — only this tap session uses the microphone."}
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
          <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {(listening || pipelineBusy) && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-center gap-2 rounded-full border border-emerald-200/90 bg-emerald-50/90 px-3 py-1.5"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    listening ? "animate-pulse bg-emerald-500" : "animate-pulse bg-amber-500"
                  }`}
                  aria-hidden
                />
                <span className="text-[11px] font-semibold text-emerald-950">
                  {listening ? "Listening…" : "Working…"}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={listening ? stopRec : startListen}
              className={`flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition sm:w-auto ${
                listening
                  ? "bg-red-600 text-white shadow-sm ring-2 ring-red-500/40 hover:bg-red-700"
                  : "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
              }`}
              aria-pressed={listening}
            >
              <span className={`text-lg tabular-nums ${listening ? "text-white/90" : "text-white/80"}`} aria-hidden>
                {listening ? "■" : "●"}
              </span>
              {listening ? "Stop" : "Tap — talk once"}
            </button>
          </div>
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
              <span className="text-white/88">Profile → Try Neo:</span> tap the mic — say your command directly, or say{" "}
              <span className="text-white/88">Hello Neo</span> / <span className="text-white/88">Neo</span> first; the
              browser mic is not always on. After wake-only, you get a short window without repeating the phrase. Full
              toggles live in{" "}
              <Link href="/profile" className="text-[#00D4FF]/90 underline-offset-2 hover:underline">
                Profile
              </Link>
              .
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
          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            {(listening || pipelineBusy) && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-3 py-1.5"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    listening ? "animate-pulse bg-emerald-400" : "animate-pulse bg-amber-400"
                  }`}
                  aria-hidden
                />
                <span className="text-[11px] font-semibold text-white/75">
                  {listening ? "Listening…" : "Working…"}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={listening ? stopRec : startListen}
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition ${
                listening
                  ? "bg-rose-500/25 text-rose-100 ring-2 ring-rose-400/50"
                  : "neo-gradient-fill text-[#050912] shadow-[0_4px_24px_rgba(0,212,255,0.28),0_4px_40px_rgba(106,92,255,0.2)] hover:brightness-105"
              }`}
              aria-pressed={listening}
            >
              <span className="text-lg tabular-nums text-white/50" aria-hidden>
                {listening ? "■" : "●"}
              </span>
              {listening ? "Stop" : "Tap — talk once"}
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
