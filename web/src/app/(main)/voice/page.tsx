"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MainTopNav } from "@/components/neo/MainTopNav";
import { fetchMe, getStoredToken, getStoredUser, patchVoicePersona, saveSession } from "@/lib/auth";
import { postVoiceRealtimeToken } from "@/lib/api";
import {
  DEFAULT_VOICE_SPEECH_LANG,
  normalizeVoiceSpeechLang,
  readStoredVoiceSpeechLang,
  writeStoredVoiceSpeechLang,
  type VoiceSpeechLangCode,
} from "@/lib/voiceLanguages";
import {
  getVoicePersona,
  normalizeVoicePersonaId,
  readStoredVoicePersonaId,
  writeStoredVoicePersonaId,
} from "@/lib/voicePersonas";
import type { KalidokitMouthShape } from "@/lib/vrmKalidokitMouth";
import { speakTextWithAvatarLipSync, stopAvatarTtsAudio } from "@/lib/voiceAvatarTts";
import {
  primeSpeechVoices,
  type TtsSpeedPreset,
  type TtsTonePreset,
  unlockWebAudioAndSpeechFromUserGesture,
  stopSpeaking,
  writeTtsGender,
  type TtsVoiceGender,
} from "@/lib/voiceChat";
import { useWakeLock } from "@/lib/useWakeLock";
import { writeNeoAlexaListen } from "@/lib/neoAssistantActive";
import { preferOpenAiTtsForVoiceUi } from "@/lib/voiceTtsPolicy";
import {
  isOpenAiRealtimeVoiceSupported,
  startOpenAiRealtimeVoiceSession,
} from "@/lib/openaiRealtimeVoice";

const VOICE_HISTORY_PREFIX = "neo-voice-history-";

/** Persona preview TTS (Man / Woman) — slow, warm delivery. */
const VOICE_CHAT_TTS_SPEED: TtsSpeedPreset = "slow";
const VOICE_CHAT_TTS_TONE: TtsTonePreset = "warm";
const VOICE_CHAT_AVATAR_OPTS = { voiceChatOpenAiTts: true as const };

function IconMic({ className }: { className?: string }) {
  return (
    <svg className={className} width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 14a3 3 0 003-3V5a3 3 0 10-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0M12 19v3m-4 0h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** CSS-only bars — avoids Framer Motion + 22 animated nodes re-rendering every frame (flicker). */
/** Animated mic bars removed — they read as “sound” / toy UI; status stays in the top bar text only. */
function VoiceSessionWaveform(_props: {
  sessionOn: boolean;
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
}) {
  return null;
}

type Turn = { role: "user" | "assistant"; content: string };

export default function VoicePage() {
  const [listening, setListening] = useState(false);
  const [sessionOn, setSessionOn] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  /** Kalidokit-style A/E/I/O/U — OpenAI TTS + Web Audio, or synthetic with browser TTS */
  const mouthShapeRef = useRef<KalidokitMouthShape>({ A: 0, E: 0, I: 0, O: 0, U: 0 });
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  /** Must match SSR + first client paint — hydrate from storage in useEffect (avoids mismatch). */
  const [lang, setLang] = useState<VoiceSpeechLangCode>(DEFAULT_VOICE_SPEECH_LANG);
  const [ttsGender, setTtsGender] = useState<TtsVoiceGender>("female");
  const [history, setHistory] = useState<Turn[]>([]);
  /** Bumps when `/api/auth/me` refreshes local profile (display name, etc.). */
  const [, setProfileSync] = useState(0);

  const sessionOnRef = useRef(false);
  const thinkingRef = useRef(false);
  const speakingRef = useRef(false);
  const historyRef = useRef<Turn[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);
  /** Monotonic id so stale `speaking` state doesn’t fight after interrupt. */
  const speakGenerationRef = useRef(0);
  const [liveConnecting, setLiveConnecting] = useState(false);
  const liveCloseRef = useRef<(() => void) | null>(null);
  const liveCancelRef = useRef<(() => void) | null>(null);
  /** True between Realtime `response.created` and `response.done` — drives transcript append vs new bubble. */
  const liveAssistStreamOpenRef = useRef(false);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    sessionOnRef.current = sessionOn;
  }, [sessionOn]);

  useEffect(() => {
    thinkingRef.current = thinking;
  }, [thinking]);

  useEffect(() => {
    speakingRef.current = speaking;
  }, [speaking]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [history]);

  useLayoutEffect(() => {
    const pid = normalizeVoicePersonaId(readStoredVoicePersonaId());
    setPersonaId(pid);
    const g = getVoicePersona(pid).ttsGender;
    setTtsGender(g);
    /** Keep storage aligned so a later mount effect cannot overwrite with stale readTtsGender(). */
    writeTtsGender(g);
  }, []);

  useWakeLock(sessionOn);

  useEffect(() => {
    // Voice chat opens: force-disable Alexa-style listen to avoid overlap/interruption.
    writeNeoAlexaListen(false);
  }, []);

  useEffect(() => {
    const uid = getStoredUser()?.id ?? "anon";
    try {
      const raw = localStorage.getItem(`${VOICE_HISTORY_PREFIX}${uid}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Turn[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const clean = parsed.filter(
        (x) =>
          x &&
          (x.role === "user" || x.role === "assistant") &&
          typeof x.content === "string",
      );
      if (clean.length === 0) return;
      historyRef.current = clean;
      setHistory(clean);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const uid = getStoredUser()?.id ?? "anon";
    try {
      localStorage.setItem(`${VOICE_HISTORY_PREFIX}${uid}`, JSON.stringify(history));
    } catch {
      /* ignore */
    }
  }, [history]);

  useEffect(() => {
    let cancelled = false;
    const token = getStoredToken();
    if (!token) return;
       void (async () => {
      try {
        const u = await fetchMe();
        if (cancelled) return;
        const prev = getStoredUser();
        if (prev) {
          saveSession(token, {
            ...prev,
            ...u,
            voice_persona_id: normalizeVoicePersonaId(
              u.voice_persona_id ?? prev.voice_persona_id,
            ),
          });
        }
        const vid = normalizeVoicePersonaId(u.voice_persona_id);
        writeStoredVoicePersonaId(vid);
        const p = getVoicePersona(vid);
        writeTtsGender(p.ttsGender);
        setPersonaId(vid);
        setTtsGender(p.ttsGender);
        setProfileSync((n) => n + 1);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLang(readStoredVoiceSpeechLang());
    /* Do not call readTtsGender() here — it defaults to "female" when key missing and overwrote Man + male avatar. */
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "neo-voice-persona-id" || e.key === "neo-tts-gender") {
        const pid = normalizeVoicePersonaId(readStoredVoicePersonaId());
        setPersonaId(pid);
        setTtsGender(getVoicePersona(pid).ttsGender);
      }
      if (e.key === "neo-voice-speech-lang" && e.newValue) {
        setLang(normalizeVoiceSpeechLang(e.newValue));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    primeSpeechVoices();
    const synth = window.speechSynthesis;
    const onVoices = () => primeSpeechVoices();
    synth?.addEventListener?.("voiceschanged", onVoices);
    return () => synth?.removeEventListener?.("voiceschanged", onVoices);
  }, []);

  const stopBargeInRecognition = useCallback(() => {}, []);

  const stopRecognitionOnly = useCallback(() => {
    setListening(false);
  }, []);

  const stopVoiceOutput = useCallback(() => {
    stopSpeaking();
    stopAvatarTtsAudio();
  }, []);

  const stopSession = useCallback(() => {
    liveAssistStreamOpenRef.current = false;
    try {
      liveCloseRef.current?.();
    } catch {
      /* ignore */
    }
    liveCloseRef.current = null;
    liveCancelRef.current = null;
    setLiveConnecting(false);
    sessionOnRef.current = false;
    setSessionOn(false);
    stopVoiceOutput();
    stopBargeInRecognition();
    stopRecognitionOnly();
    speakingRef.current = false;
    setSpeaking(false);
    setListening(false);
  }, [stopBargeInRecognition, stopRecognitionOnly, stopVoiceOutput]);

  const startLiveVoice = useCallback(async () => {
    if (!sessionOnRef.current) return;
    if (!isOpenAiRealtimeVoiceSupported()) {
      setErr("Live voice needs HTTPS and WebRTC — update the app or use a device with a current WebView.");
      setLiveConnecting(false);
      sessionOnRef.current = false;
      setSessionOn(false);
      return;
    }
    setErr(null);
    setLiveConnecting(true);
    speakingRef.current = false;
    setSpeaking(false);
    liveAssistStreamOpenRef.current = false;
    try {
      unlockWebAudioAndSpeechFromUserGesture();
      const pid = normalizeVoicePersonaId(personaId ?? readStoredVoicePersonaId());
      const tok = await postVoiceRealtimeToken({
        speech_lang: lang,
        persona_id: pid,
      });
      const live = await startOpenAiRealtimeVoiceSession(tok.client_secret, {
        onConnection: (s) => {
          if (!sessionOnRef.current) return;
          if (s === "open") {
            setLiveConnecting(false);
            setListening(true);
          }
          if (s === "closed") {
            setLiveConnecting(false);
            setListening(false);
          }
        },
        onUserTranscript: (t) => {
          const line = t.trim();
          if (!line) return;
          setHistory((h) => {
            const last = h[h.length - 1];
            if (last?.role === "user" && last.content.trim() === line) {
              return h;
            }
            const next = [...h, { role: "user" as const, content: line }];
            historyRef.current = next;
            return next;
          });
        },
        onAssistantTranscriptDelta: (delta) => {
          if (!delta) return;
          setHistory((h) => {
            const next = [...h];
            const L = next.length - 1;
            const appendHere =
              L >= 0 &&
              next[L].role === "assistant" &&
              liveAssistStreamOpenRef.current;
            if (appendHere) {
              next[L] = { role: "assistant", content: next[L].content + delta };
            } else {
              next.push({ role: "assistant", content: delta });
              liveAssistStreamOpenRef.current = true;
            }
            historyRef.current = next;
            return next;
          });
        },
        onAssistantTranscript: (t) => {
          const line = t.trim();
          if (!line) return;
          setHistory((h) => {
            const next = [...h];
            const L = next.length - 1;
            if (L >= 0 && next[L].role === "assistant") {
              const curT = next[L].content.trim();
              if (curT === line) {
                return h;
              }
              /* Ignore a shorter “done” payload when streaming already built a longer prefix (ordering / partial events). */
              if (line.length < curT.length && curT.startsWith(line)) {
                return h;
              }
              next[L] = { role: "assistant", content: line.length >= curT.length ? line : next[L].content };
              historyRef.current = next;
              return next;
            }
            const merged: Turn[] = [...next, { role: "assistant", content: line }];
            historyRef.current = merged;
            return merged;
          });
        },
        onAssistantSpeaking: (on) => {
          speakingRef.current = on;
          setSpeaking(on);
          /* New response: keep false until the first delta creates/opens the row — avoids appending into the prior reply. */
          liveAssistStreamOpenRef.current = false;
        },
        onError: (msg) => {
          setErr(msg);
        },
      });
      liveCloseRef.current = live.close;
      liveCancelRef.current = live.cancelAssistant;
    } catch (e) {
      liveCloseRef.current = null;
      liveCancelRef.current = null;
      setLiveConnecting(false);
      setListening(false);
      sessionOnRef.current = false;
      setSessionOn(false);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [lang, personaId]);

  /** Interrupt assistant audio (OpenAI Realtime). */
  const tapToSpeak = useCallback(() => {
    if (!sessionOnRef.current) return;
    unlockWebAudioAndSpeechFromUserGesture();
    if (speakingRef.current) {
      liveCancelRef.current?.();
      speakingRef.current = false;
      setSpeaking(false);
      liveAssistStreamOpenRef.current = false;
    }
  }, []);

  const toggleMic = useCallback(() => {
    if (sessionOnRef.current) {
      stopSession();
      return;
    }
    if (!isOpenAiRealtimeVoiceSupported()) {
      setErr("Live voice needs HTTPS and WebRTC — update Android System WebView or Chrome.");
      return;
    }
    unlockWebAudioAndSpeechFromUserGesture();
    primeSpeechVoices();
    stopRecognitionOnly();
    stopVoiceOutput();
    stopBargeInRecognition();
    setErr(null);
    sessionOnRef.current = true;
    setSessionOn(true);
    void startLiveVoice();
  }, [stopBargeInRecognition, stopSession, stopRecognitionOnly, stopVoiceOutput, startLiveVoice]);

  useEffect(() => {
    return () => {
      sessionOnRef.current = false;
      try {
        liveCloseRef.current?.();
      } catch {
        /* ignore */
      }
      liveCloseRef.current = null;
      liveCancelRef.current = null;
      stopRecognitionOnly();
      stopBargeInRecognition();
      stopVoiceOutput();
    };
  }, [stopBargeInRecognition, stopRecognitionOnly, stopVoiceOutput]);

  const profileName = getStoredUser()?.display_name?.trim() || "You";

  const clearHistory = useCallback(() => {
    const uid = getStoredUser()?.id ?? "anon";
    historyRef.current = [];
    setHistory([]);
    try {
      localStorage.removeItem(`${VOICE_HISTORY_PREFIX}${uid}`);
    } catch {
      /* ignore */
    }
  }, []);

  const applyPersona = useCallback(
    async (id: "arjun" | "sara") => {
      const pid = normalizeVoicePersonaId(id);
      const p = getVoicePersona(pid);
      writeStoredVoicePersonaId(pid);
      writeTtsGender(p.ttsGender);
      setPersonaId(pid);
      setTtsGender(p.ttsGender);
      const token = getStoredToken();
      if (token) {
        try {
          const u = await patchVoicePersona(pid);
          saveSession(token, u);
        } catch {
          /* offline — local choice still applies */
        }
      }
      if (!sessionOnRef.current) {
        try {
          primeSpeechVoices();
          window.speechSynthesis?.resume();
          unlockWebAudioAndSpeechFromUserGesture();
          await speakTextWithAvatarLipSync(pid === "arjun" ? "Male voice." : "Female voice.", lang, {
            mouthShapeRef,
            voiceGender: p.ttsGender,
            speedPreset: VOICE_CHAT_TTS_SPEED,
            tonePreset: VOICE_CHAT_TTS_TONE,
            replyMood: "neutral",
            preferOpenAiTts: preferOpenAiTtsForVoiceUi(),
            ...VOICE_CHAT_AVATAR_OPTS,
          });
        } catch {
          /* ignore */
        }
      }
    },
    [lang],
  );

  const activePersonaId = normalizeVoicePersonaId(personaId);
  const assistantLabel = getVoicePersona(activePersonaId).name;

  const headerTitle = useMemo(() => {
    if (!sessionOn) return "Voice chat";
    if (liveConnecting) return "Live — connecting…";
    return speaking ? "Live — assistant is speaking" : "Live — speak anytime";
  }, [sessionOn, liveConnecting, speaking]);

  return (
    <div className="relative z-[1] flex min-h-0 flex-1 flex-col bg-[#080a0f] md:min-h-0">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_85%_55%_at_50%_18%,rgba(0,180,220,0.14),transparent_55%),radial-gradient(ellipse_70%_50%_at_80%_70%,rgba(124,58,237,0.12),transparent_50%),linear-gradient(180deg,#080a0f_0%,#070b12_45%,#080a0f_100%)]"
        aria-hidden
      />
      <MainTopNav
        center={headerTitle}
        trailingBeforeProfile={
          <div
            className="relative z-30 flex shrink-0 items-center rounded-xl border border-white/[0.1] bg-black/45 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            role="group"
            aria-label="Assistant voice gender"
          >
            <button
              type="button"
              onClick={() => void applyPersona("arjun")}
              className={`rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition sm:px-2.5 ${
                activePersonaId === "arjun"
                  ? "bg-[#00D4FF]/20 text-white shadow-[inset_0_0_0_1px_rgba(0,212,255,0.35)]"
                  : "text-white/45 hover:bg-white/[0.06] hover:text-white/85"
              }`}
            >
              Man
            </button>
            <button
              type="button"
              onClick={() => void applyPersona("sara")}
              className={`rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition sm:px-2.5 ${
                activePersonaId === "sara"
                  ? "bg-[#00D4FF]/20 text-white shadow-[inset_0_0_0_1px_rgba(0,212,255,0.35)]"
                  : "text-white/45 hover:bg-white/[0.06] hover:text-white/85"
              }`}
            >
              Woman
            </button>
          </div>
        }
      />

      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 py-6 md:max-w-xl">
        {history.length > 0 ? (
          <div className="mb-5 w-full shrink-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Saved conversation
              </p>
              <button
                type="button"
                onClick={clearHistory}
                className="text-[10px] font-semibold text-[#00D4FF]/80 transition hover:text-[#00D4FF]"
              >
                Clear
              </button>
            </div>
            <div
              ref={transcriptRef}
              className="max-h-[min(42vh,240px)] space-y-4 overflow-y-auto overscroll-y-contain pr-1"
            >
              {history.map((turn, i) => (
                <div
                  key={i}
                  className={
                    turn.role === "user"
                      ? "border-l-2 border-[#00D4FF]/35 pl-3"
                      : "border-l-2 border-white/[0.12] pl-3"
                  }
                >
                  <span className="text-[9px] font-bold uppercase tracking-wide text-white/35">
                    {turn.role === "user" ? profileName : assistantLabel}
                  </span>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/88 break-words">
                    {turn.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        {!isOpenAiRealtimeVoiceSupported() ? (
          <p className="mb-6 max-w-sm text-center text-[11px] leading-relaxed text-amber-400/90">
            Live needs HTTPS and WebRTC. Update Android System WebView / Chrome on this device.
          </p>
        ) : null}
        <div className="relative flex flex-col items-center">
          <VoiceSessionWaveform
            sessionOn={sessionOn}
            speaking={speaking}
            listening={listening}
            thinking={thinking}
          />
          {sessionOn && speaking ? (
            <button
              type="button"
              onClick={tapToSpeak}
              className="mb-3 mt-1 rounded-2xl border border-[#00D4FF]/35 bg-[#00D4FF]/10 px-5 py-2.5 text-sm font-semibold text-[#a5f3fc] transition hover:bg-[#00D4FF]/18"
            >
              Tap to interrupt
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleMic}
            className={`relative mt-4 flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full text-white shadow-[0_0_48px_rgba(0,212,255,0.32)] transition active:scale-[0.97] ${
              sessionOn
                ? "bg-gradient-to-br from-emerald-400 to-teal-700 ring-[4px] ring-emerald-300/35"
                : "bg-gradient-to-br from-[#00D4FF] to-[#6366f1] ring-[4px] ring-[#00D4FF]/40"
            }`}
            aria-pressed={sessionOn}
            aria-label={sessionOn ? "End voice session" : "Start voice session"}
          >
            {sessionOn ? (
              <span className="text-2xl" aria-hidden>
                &#x23FB;
              </span>
            ) : (
              <span className="text-[#050912]">
                <IconMic />
              </span>
            )}
          </button>
        </div>

        {err ? (
          <p className="mt-6 max-w-md text-center text-xs leading-relaxed text-amber-400/95" role="alert">
            {err}
          </p>
        ) : null}
        </div>
      </div>
    </div>
  );
}
