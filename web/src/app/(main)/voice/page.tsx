"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MainTopNav } from "@/components/neo/MainTopNav";
import { fetchMe, getStoredToken, getStoredUser, patchVoicePersona, saveSession } from "@/lib/auth";
/* Voice Live thread is separate from /dashboard text chat — no shared neo-chat-msgs store. */
import {
  LIVE_WEB_CONTEXT_DEFAULT_TIMEOUT_MS,
  postLiveWebContext,
  postVoiceRealtimeToken,
} from "@/lib/api";
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
import { isNativeCapacitor } from "@/lib/nativeAppLinks";
import { setNativeVoiceChatPageActive, syncNativeWakeBridge } from "@/lib/neoWakeNative";
import { preferOpenAiTtsForVoiceUi } from "@/lib/voiceTtsPolicy";
import {
  createVoiceRealtimeMicStreamPromise,
  isOpenAiRealtimeVoiceSupported,
  startOpenAiRealtimeVoiceSession,
} from "@/lib/openaiRealtimeVoice";
import { isStrictHelloNeoWakePhrase } from "@/lib/neoVoiceCommands";

const VOICE_HISTORY_PREFIX = "neo-voice-history-";

/**
 * OpenAI Realtime noise: harmless or self-inflicted; do not flash yellow on APK.
 * LOCKED MIC/VOICE PIPELINE — see `.cursor/rules/voice-live-apk-mic-lock.mdc` before editing.
 */
function shouldSuppressLiveVoiceRealtimeError(msg: string): boolean {
  const s = (msg || "").toLowerCase();
  return (
    s.includes("active response in progress") ||
    s.includes("conversation already has an active response") ||
    (s.includes("wait until the response is finished") && s.includes("creating a new one")) ||
    s.includes("cancellation failed") ||
    s.includes("no active response found")
  );
}

/** Persona preview TTS (Man / Woman) — natural is snappier; still warm tone below. */
const VOICE_CHAT_TTS_SPEED: TtsSpeedPreset = "natural";
const VOICE_CHAT_TTS_TONE: TtsTonePreset = "warm";
const VOICE_CHAT_AVATAR_OPTS = { voiceChatOpenAiTts: true as const };
/** Voice page should feel instant; abort slow live-web enrich quickly and continue answer generation. */
const VOICE_LIVE_WEB_TIMEOUT_MS = 2800;
/** Start assistant response fast; only wait this small grace for live-web block. */
const VOICE_LIVE_WEB_QUICK_START_GRACE_MS = 700;
/** Hard realtime behavior for on-screen/off-screen session continuity. */
const VOICE_REALTIME_PRIORITY_INSTRUCTION =
  "Realtime priority is mandatory: in both app-open and off-screen continuation, respond immediately as soon as user finishes speaking. Do not add intentional delays, long prefaces, or waiting fillers. Keep first response tokens fast and concise, then expand only if user asks.";

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

/** End Live session — vector (avoids missing-font “tofu” on some APK WebViews). */
function IconLiveEnd({ className }: { className?: string }) {
  return (
    <svg className={className} width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.75" />
      <rect x="8.25" y="8.25" width="7.5" height="7.5" rx="1.5" fill="currentColor" />
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

/** Explicit stop / cancel — do not start a new assistant reply for this line. */
function isVoiceUserStopIntent(text: string): boolean {
  const raw = (text || "").trim();
  if (raw.length > 120) return false;
  const low = raw.toLowerCase();
  if (/\b(stop|enough|quiet|cancel|no more|shut up|skip)\b/.test(low)) return true;
  return /^(रुको|बस|चुप|बंद|रोक|रोको|बस करो|रोक दो|बस हो)/.test(raw);
}

/** Tells Android not to pause WebView during Live WebRTC (lock screen / app switch). */
async function syncNativeVoiceLiveWebRtcFlag(active: boolean): Promise<void> {
  if (!isNativeCapacitor()) return;
  try {
    const { NeoNativeRouter } = await import("@/lib/neoNativeRouter");
    await NeoNativeRouter.setVoiceLiveWebRtcActive({ active });
  } catch {
    /* ignore */
  }
}

export default function VoicePage() {
  const [hasMounted, setHasMounted] = useState(false);
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
  /** Monotonic id so stale `speaking` state doesn’t fight after interrupt. */
  const speakGenerationRef = useRef(0);
  const [liveConnecting, setLiveConnecting] = useState(false);
  const [liveWebFetching, setLiveWebFetching] = useState(false);
  /** Server VAD / transcript hint: user is talking (not assistant playback). */
  const [userSpeaking, setUserSpeaking] = useState(false);
  const userSpeechDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumps when Live session starts so the main control remounts once and plays the session-in animation. */
  const [micSessionKey, setMicSessionKey] = useState(0);
  const liveCloseRef = useRef<(() => void) | null>(null);
  const liveCancelRef = useRef<(() => void) | null>(null);
  const liveSendClientEventRef = useRef<((o: Record<string, unknown>) => void) | null>(null);
  const liveEnsureMicRef = useRef<(() => void) | null>(null);
  /** Realtime remote audio mute — set when session opens; used on lock-screen / app background. */
  const liveMuteFnRef = useRef<((muted: boolean) => void) | null>(null);
  /**
   * APK: while screen is off/background, assistant downlink stays muted until “Hello Neo” in transcript
   * (see visibility handler + onUserTranscript). Browser/desktop: treated as unlocked when session is visible.
   */
  const liveAssistantAudioUnlockedRef = useRef(true);
  /** APK: native wake was stopped so WebRTC can own the mic for Live voice. */
  const nativeWakePausedForLiveRef = useRef(false);
  /** Monotonic id so stale live-web async work never calls `response.create` after a newer utterance. */
  const voiceLiveWebTurnRef = useRef(0);
  /** Drop duplicate finalized transcripts (Realtime + sidecar) within a short window. */
  const lastVoicePipelineUserLineRef = useRef<{ line: string; at: number }>({ line: "", at: 0 });
  /** Serialize post-transcript work so two response.create calls never overlap. */
  const liveWebPipelineRef = useRef(Promise.resolve());
  /** From Realtime `response.created` → `done` / `completed` / `cancelled` / `error` — gates `response.cancel`. */
  const liveResponseBusyRef = useRef(false);
  /** True between Realtime `response.created` and `response.done` — drives transcript append vs new bubble. */
  const liveAssistStreamOpenRef = useRef(false);
  /** True while OpenAI `input_audio_transcription.delta` is building the current user line. */
  const liveUserTranscriptOpenRef = useRef(false);
  /** After first hydrate from voice-only local backup — blocks saving `[]` over a good session. */
  const voiceHistoryHydratedRef = useRef(false);
  /** Skip redundant localStorage writes when thread unchanged (streaming deltas). */
  const lastPersistedJsonRef = useRef<string>("");

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
    if (isNativeCapacitor()) {
      void setNativeVoiceChatPageActive(true);
    }
    return () => {
      if (isNativeCapacitor()) {
        void setNativeVoiceChatPageActive(false);
      }
    };
  }, []);

  /* Voice-only transcript backup (not typed chat). UI stays mic-first — no transcript bubbles on this page. */
  useEffect(() => {
    const uid = getStoredUser()?.id ?? "anon";
    try {
      const raw = localStorage.getItem(`${VOICE_HISTORY_PREFIX}${uid}`);
      if (!raw) {
        voiceHistoryHydratedRef.current = true;
        return;
      }
      const parsed = JSON.parse(raw) as Turn[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        voiceHistoryHydratedRef.current = true;
        return;
      }
      const clean = parsed.filter(
        (x) =>
          x &&
          (x.role === "user" || x.role === "assistant") &&
          typeof x.content === "string",
      );
      if (clean.length === 0) {
        voiceHistoryHydratedRef.current = true;
        return;
      }
      historyRef.current = clean;
      setHistory(clean);
    } catch {
      /* ignore */
    }
    voiceHistoryHydratedRef.current = true;
  }, []);

  /*
   * Persist voice thread only under neo-voice-history-* (does not touch typed chat).
   * Debounced ~85ms during streaming assistant tokens.
   */
  useEffect(() => {
    if (!voiceHistoryHydratedRef.current) return;
    if (history.length === 0) return;
    const uid = getStoredUser()?.id ?? "anon";
    const t = window.setTimeout(() => {
      try {
        const snap = JSON.stringify(historyRef.current);
        if (snap === lastPersistedJsonRef.current) return;
        lastPersistedJsonRef.current = snap;
        localStorage.setItem(`${VOICE_HISTORY_PREFIX}${uid}`, snap);
      } catch {
        /* quota */
      }
    }, 85);
    return () => window.clearTimeout(t);
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

  const resumeNativeWakeAfterVoiceLive = useCallback(() => {
    if (!nativeWakePausedForLiveRef.current) return;
    nativeWakePausedForLiveRef.current = false;
    void syncNativeWakeBridge(true);
  }, []);

  const stopSession = useCallback(() => {
    void syncNativeVoiceLiveWebRtcFlag(false);
    liveAssistStreamOpenRef.current = false;
    liveUserTranscriptOpenRef.current = false;
    try {
      liveCloseRef.current?.();
    } catch {
      /* ignore */
    }
    liveCloseRef.current = null;
    liveCancelRef.current = null;
    liveSendClientEventRef.current = null;
    liveEnsureMicRef.current = null;
    liveMuteFnRef.current = null;
    voiceLiveWebTurnRef.current += 1;
    liveWebPipelineRef.current = Promise.resolve();
    liveResponseBusyRef.current = false;
    setLiveWebFetching(false);
    setLiveConnecting(false);
    if (userSpeechDebounceRef.current) {
      clearTimeout(userSpeechDebounceRef.current);
      userSpeechDebounceRef.current = null;
    }
    setUserSpeaking(false);
    sessionOnRef.current = false;
    setSessionOn(false);
    stopVoiceOutput();
    stopBargeInRecognition();
    stopRecognitionOnly();
    speakingRef.current = false;
    setSpeaking(false);
    setListening(false);
    liveAssistantAudioUnlockedRef.current = !isNativeCapacitor();
    resumeNativeWakeAfterVoiceLive();
    try {
      const uid = getStoredUser()?.id ?? "anon";
      const h = historyRef.current;
      if (h.length > 0) {
        const snap = JSON.stringify(h);
        lastPersistedJsonRef.current = snap;
        localStorage.setItem(`${VOICE_HISTORY_PREFIX}${uid}`, snap);
      }
    } catch {
      /* quota */
    }
  }, [stopBargeInRecognition, stopRecognitionOnly, stopVoiceOutput, resumeNativeWakeAfterVoiceLive]);

  const startLiveVoice = useCallback(async (micPromise: Promise<MediaStream>) => {
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
    liveUserTranscriptOpenRef.current = false;
    let acquiredMic: MediaStream | null = null;
    try {
      unlockWebAudioAndSpeechFromUserGesture();
      /* Native wake + pipeline hold AudioRecord — release before WebRTC mic (APK / Mediatek stability). */
      if (isNativeCapacitor()) {
        try {
          const { NeoNativeRouter } = await import("@/lib/neoNativeRouter");
          await NeoNativeRouter.stopWakeListener();
          nativeWakePausedForLiveRef.current = true;
          await new Promise<void>((r) => setTimeout(r, 140));
        } catch {
          /* ignore */
        }
      }
      const pid = normalizeVoicePersonaId(personaId ?? readStoredVoicePersonaId());
      /* Mic promise must be created in the mic-button click (transient activation); await only after that. */
      try {
        acquiredMic = await micPromise;
      } catch (e) {
        resumeNativeWakeAfterVoiceLive();
        const msg = e instanceof Error ? e.message : String(e);
        setErr(msg.trim() ? msg : "Microphone access failed — allow mic for this app.");
        setLiveConnecting(false);
        sessionOnRef.current = false;
        setSessionOn(false);
        return;
      }
      const tok = await postVoiceRealtimeToken({
        speech_lang: lang,
        persona_id: pid,
      });
      const live = await startOpenAiRealtimeVoiceSession(
        tok.client_secret,
        {
        onConnection: (s) => {
          if (!sessionOnRef.current) return;
          if (s === "open") {
            liveSendClientEventRef.current = live.sendClientEvent;
            liveEnsureMicRef.current = live.ensureLocalMicLive;
            /* One uplink arm after bridge open — avoid repeated native calls (APK “tun” / focus churn). */
            live.ensureLocalMicLive();
            live.sendClientEvent({
              type: "session.update",
              session: {
                instructions: VOICE_REALTIME_PRIORITY_INSTRUCTION,
              },
            });
            setLiveConnecting(false);
            setListening(true);
            /*
             * APK: if user is on the voice screen, unmute immediately. If session opened while already hidden
             * (rare), keep muted until they say “Hello Neo” (handled in onUserTranscript + visibility).
             */
            if (isNativeCapacitor()) {
              const vis =
                typeof document === "undefined" || document.visibilityState === "visible";
              liveAssistantAudioUnlockedRef.current = vis;
              live.setAssistantAudioMuted(!vis);
            }
            /* No second Web Speech session here: it fought the WebRTC mic and caused OS “tun” cues on phones. */
          }
          if (s === "closed") {
            void syncNativeVoiceLiveWebRtcFlag(false);
            liveSendClientEventRef.current = null;
            liveEnsureMicRef.current = null;
            setLiveConnecting(false);
            setListening(false);
            setLiveWebFetching(false);
            if (userSpeechDebounceRef.current) {
              clearTimeout(userSpeechDebounceRef.current);
              userSpeechDebounceRef.current = null;
            }
            setUserSpeaking(false);
            resumeNativeWakeAfterVoiceLive();
          }
        },
        onUserSpeechActive: (active) => {
          if (userSpeechDebounceRef.current) {
            clearTimeout(userSpeechDebounceRef.current);
            userSpeechDebounceRef.current = null;
          }
          if (active && speakingRef.current) return;
          setUserSpeaking(active);
        },
        onUserTranscriptDelta: (delta) => {
          if (!delta) return;
          if (sessionOnRef.current && !speakingRef.current) {
            setUserSpeaking(true);
            if (userSpeechDebounceRef.current) {
              clearTimeout(userSpeechDebounceRef.current);
            }
            userSpeechDebounceRef.current = setTimeout(() => {
              userSpeechDebounceRef.current = null;
              setUserSpeaking(false);
            }, 180);
          }
          /* Do not mark Google grace here — every OpenAI delta would block Google gap-fill forever. */
          setHistory((h) => {
            const next = [...h];
            const L = next.length - 1;
            const appendHere =
              L >= 0 && next[L].role === "user" && liveUserTranscriptOpenRef.current;
            if (appendHere) {
              next[L] = { role: "user", content: next[L].content + delta };
            } else {
              next.push({ role: "user", content: delta });
              liveUserTranscriptOpenRef.current = true;
            }
            historyRef.current = next;
            return next;
          });
        },
        onUserTranscript: (t) => {
          const line = t.trim();
          if (!line) return;
          /*
           * APK lock screen / background: only a strict “Hello Neo” / “Hi Neo” / नमस्ते नियो style phrase arms Live —
           * not bare “Neo” in other speech (see isStrictHelloNeoWakePhrase). Must run before background guard.
           */
          if (isNativeCapacitor() && !liveAssistantAudioUnlockedRef.current) {
            if (isStrictHelloNeoWakePhrase(line)) {
              liveAssistantAudioUnlockedRef.current = true;
              try {
                live.setAssistantAudioMuted(false);
              } catch {
                /* ignore */
              }
            }
          }
          /*
           * Browser: no Live web pipeline when tab hidden. APK: only after wake unlock (off-screen voice chat).
           */
          if (typeof document !== "undefined" && document.visibilityState !== "visible") {
            if (!isNativeCapacitor()) {
              liveUserTranscriptOpenRef.current = false;
              return;
            }
            if (!liveAssistantAudioUnlockedRef.current) {
              liveUserTranscriptOpenRef.current = false;
              return;
            }
          }
          if (isVoiceUserStopIntent(line)) {
            liveCancelRef.current?.();
            speakingRef.current = false;
            setSpeaking(false);
            setUserSpeaking(false);
            liveResponseBusyRef.current = false;
            liveAssistStreamOpenRef.current = false;
            liveEnsureMicRef.current?.();
            liveUserTranscriptOpenRef.current = false;
            return;
          }
          const nowMs = Date.now();
          if (
            line === lastVoicePipelineUserLineRef.current.line &&
            nowMs - lastVoicePipelineUserLineRef.current.at < 1800
          ) {
            liveUserTranscriptOpenRef.current = false;
            return;
          }
          lastVoicePipelineUserLineRef.current = { line, at: nowMs };
          liveUserTranscriptOpenRef.current = false;
          setHistory((h) => {
            const next = [...h];
            const L = next.length - 1;
            if (L >= 0 && next[L].role === "user") {
              if (next[L].content.trim() === line) {
                return h;
              }
              next[L] = { role: "user", content: line };
              historyRef.current = next;
              return next;
            }
            const last = h[h.length - 1];
            if (last?.role === "user" && last.content.trim() === line) {
              return h;
            }
            const merged: Turn[] = [...next, { role: "user", content: line }];
            historyRef.current = merged;
            return merged;
          });

          const myTurn = ++voiceLiveWebTurnRef.current;
          const runPipeline = async () => {
            if (!sessionOnRef.current) return;
            if (myTurn !== voiceLiveWebTurnRef.current) return;
            const send = liveSendClientEventRef.current;
            if (!send) return;
            setLiveWebFetching(true);
            let block = "";
            let liveFetchFailed = false;
            let fetchResolvedInGrace = false;
            try {
              const fetchPromise = postLiveWebContext(line, {
                timeoutMs: Math.min(LIVE_WEB_CONTEXT_DEFAULT_TIMEOUT_MS, VOICE_LIVE_WEB_TIMEOUT_MS),
              });
              const quick = await Promise.race([
                fetchPromise.then((j) => ({ done: true as const, block: (j.block || "").trim() })),
                new Promise<{ done: false }>((resolve) =>
                  setTimeout(() => resolve({ done: false as const }), VOICE_LIVE_WEB_QUICK_START_GRACE_MS),
                ),
              ]);
              if (quick.done) {
                fetchResolvedInGrace = true;
                block = quick.block;
              } else {
                fetchPromise
                  .then((j) => {
                    if (!sessionOnRef.current || myTurn !== voiceLiveWebTurnRef.current) return;
                    const lateBlock = (j.block || "").trim();
                    if (lateBlock) {
                      /* Late live block is intentionally ignored for this turn to keep response start instant. */
                    }
                  })
                  .catch(() => {
                    /* late failure ignored */
                  });
              }
            } catch {
              liveFetchFailed = true;
              /* timeout/offline/API error — continue fast; backend falls back to cached DB snapshots when possible */
            }
            /* Same `/live-context` pipeline as text chat; timeout matches chat stream (refine + Google can take several seconds). */
            if (!sessionOnRef.current || myTurn !== voiceLiveWebTurnRef.current) {
              setLiveWebFetching(false);
              return;
            }
            setLiveWebFetching(false);
            /*
             * Do not cancel mid-playback: that was cutting answers off mid-word. Wait for the prior response to
             * fully finish; only cancel if generation is still stuck busy after the wait (safety).
             */
            const maxIdleMs = 180_000;
            const idle0 = Date.now();
            while (
              sessionOnRef.current &&
              myTurn === voiceLiveWebTurnRef.current &&
              (liveResponseBusyRef.current || speakingRef.current)
            ) {
              if (Date.now() - idle0 > maxIdleMs) break;
              await new Promise<void>((r) => setTimeout(r, 42));
            }
            if (!sessionOnRef.current || myTurn !== voiceLiveWebTurnRef.current) return;
            if (liveResponseBusyRef.current) {
              liveCancelRef.current?.();
              await new Promise<void>((r) => setTimeout(r, 70));
            }
            if (!sessionOnRef.current || myTurn !== voiceLiveWebTurnRef.current) return;
            if (block) {
              send({
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "system",
                  content: [
                    {
                      type: "input_text",
                      text: `Live web data (Google; use for current facts; do not invent beyond this):\n${block.slice(0, 7500)}`,
                    },
                  ],
                },
              });
              send({
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "system",
                  content: [
                    {
                      type: "input_text",
                      text:
                        "Use the Live web lines above for breaking news, prices, scores, dates, and rankings when present. You may still answer fully from general knowledge for explanations, how-to, definitions, and context—sound helpful and confident. Only disclaim or say you lack live confirmation when the user asks for an exact current number/date/rank/price and it does not appear in the snippets above.",
                    },
                  ],
                },
              });
            } else {
              const hint = liveFetchFailed
                ? "Live Google lookup did not run this turn (network or timeout). Answer the user helpfully from your knowledge anyway—full sentences, same language as the user. For time-sensitive facts (today's rates, live scores), say you don't have a fresh lookup right now without inventing numbers. Do not send them to other websites for the same answer."
                : fetchResolvedInGrace
                  ? "No fresh web snippets for this query—answer normally from your knowledge: be useful, complete, and in the user's language. For precise live figures you cannot verify, say so briefly and still explain what you can."
                  : "Start responding immediately without waiting for live web snippets. Give a clear helpful answer in the user's language from your knowledge first.";
              send({
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "system",
                  content: [{ type: "input_text", text: hint }],
                },
              });
            }
            send({ type: "response.create" });
            /* Single re-arm after new response starts — no per-turn spam (reduces APK mic focus noise). */
            liveEnsureMicRef.current?.();
          };
          liveWebPipelineRef.current = liveWebPipelineRef.current
            .then(runPipeline)
            .catch((e) => {
              if (!sessionOnRef.current) return;
              const msg = e instanceof Error ? e.message : String(e);
              if (msg.trim()) setErr(`Voice lookup: ${msg.trim()}`);
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
          if (on) {
            if (userSpeechDebounceRef.current) {
              clearTimeout(userSpeechDebounceRef.current);
              userSpeechDebounceRef.current = null;
            }
            setUserSpeaking(false);
          }
          speakingRef.current = on;
          setSpeaking(on);
          /* New response: keep false until the first delta creates/opens the row — avoids appending into the prior reply. */
          liveAssistStreamOpenRef.current = false;
        },
        onAssistantResponseActive: (active) => {
          liveResponseBusyRef.current = active;
        },
        onError: (msg) => {
          if (shouldSuppressLiveVoiceRealtimeError(msg)) {
            if ((msg || "").toLowerCase().includes("cancellation failed")) {
              liveResponseBusyRef.current = false;
            }
            return;
          }
          setErr(msg);
        },
        },
        { localAudioStream: acquiredMic },
      );
      void syncNativeVoiceLiveWebRtcFlag(true);
      acquiredMic = null;
      liveCloseRef.current = live.close;
      liveCancelRef.current = live.cancelAssistant;
      liveSendClientEventRef.current = live.sendClientEvent;
      liveEnsureMicRef.current = live.ensureLocalMicLive;
      liveMuteFnRef.current = live.setAssistantAudioMuted;
      if (isNativeCapacitor()) {
        const vis = typeof document === "undefined" || document.visibilityState === "visible";
        liveAssistantAudioUnlockedRef.current = vis;
        live.setAssistantAudioMuted(!vis);
      } else {
        liveAssistantAudioUnlockedRef.current = true;
        live.setAssistantAudioMuted(false);
      }
    } catch (e) {
      void syncNativeVoiceLiveWebRtcFlag(false);
      resumeNativeWakeAfterVoiceLive();
      if (acquiredMic) {
        for (const t of acquiredMic.getTracks()) {
          try {
            t.stop();
          } catch {
            /* ignore */
          }
        }
        acquiredMic = null;
      }
      liveCloseRef.current = null;
      liveCancelRef.current = null;
      liveSendClientEventRef.current = null;
      liveEnsureMicRef.current = null;
      setLiveConnecting(false);
      setListening(false);
      sessionOnRef.current = false;
      setSessionOn(false);
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, [lang, personaId, resumeNativeWakeAfterVoiceLive]);

  /** Interrupt assistant audio (OpenAI Realtime). */
  const tapToSpeak = useCallback(() => {
    if (!sessionOnRef.current) return;
    unlockWebAudioAndSpeechFromUserGesture();
    if (speakingRef.current) {
      liveCancelRef.current?.();
      speakingRef.current = false;
      setSpeaking(false);
      setUserSpeaking(false);
      liveAssistStreamOpenRef.current = false;
      liveResponseBusyRef.current = false;
      liveEnsureMicRef.current?.();
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
    /* Start getUserMedia in this click tick so Android WebView keeps mic permission / non-silent capture. */
    const micPromise = createVoiceRealtimeMicStreamPromise();
    sessionOnRef.current = true;
    setSessionOn(true);
    setMicSessionKey((k) => k + 1);
    void startLiveVoice(micPromise);
  }, [stopBargeInRecognition, stopSession, stopRecognitionOnly, stopVoiceOutput, startLiveVoice]);

  useEffect(() => {
    return () => {
      void syncNativeVoiceLiveWebRtcFlag(false);
      sessionOnRef.current = false;
      try {
        liveCloseRef.current?.();
      } catch {
        /* ignore */
      }
      liveCloseRef.current = null;
      liveCancelRef.current = null;
      liveSendClientEventRef.current = null;
      liveEnsureMicRef.current = null;
      stopRecognitionOnly();
      stopBargeInRecognition();
      stopVoiceOutput();
      if (nativeWakePausedForLiveRef.current) {
        nativeWakePausedForLiveRef.current = false;
        void syncNativeWakeBridge(true);
      }
    };
  }, [stopBargeInRecognition, stopRecognitionOnly, stopVoiceOutput]);

  useEffect(() => {
    const hardStop = () => {
      if (!sessionOnRef.current) return;
      stopSession();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        if (isNativeCapacitor() && sessionOnRef.current) {
          liveAssistantAudioUnlockedRef.current = true;
          try {
            liveMuteFnRef.current?.(false);
          } catch {
            /* ignore */
          }
        }
        return;
      }
      /* Screen off / app background: keep WebRTC session on APK so lock-screen voice chat can work. */
      if (isNativeCapacitor() && sessionOnRef.current) {
        liveAssistantAudioUnlockedRef.current = false;
        try {
          liveMuteFnRef.current?.(true);
        } catch {
          /* ignore */
        }
        return;
      }
      hardStop();
    };
    window.addEventListener("pagehide", hardStop);
    window.addEventListener("beforeunload", hardStop);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", hardStop);
      window.removeEventListener("beforeunload", hardStop);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [stopSession]);

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
        if (isNativeCapacitor()) {
          return;
        }
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

  const headerTitle = useMemo(() => {
    if (!sessionOn) return "Voice chat";
    if (liveConnecting) return "Live — connecting…";
    if (liveWebFetching) return "Live — looking up facts…";
    return speaking ? "Live — assistant is speaking" : "Live — speak anytime";
  }, [sessionOn, liveConnecting, liveWebFetching, speaking]);

  const micButtonClass = useMemo(() => {
    if (!sessionOn) {
      return "bg-gradient-to-br from-[#00E5FF] via-[#22D3EE] to-[#7C3AED] shadow-[0_0_42px_rgba(0,229,255,0.3),0_0_64px_rgba(124,58,237,0.2)] ring-[3px] ring-[#22D3EE]/45 hover:brightness-110";
    }
    if (speaking) {
      return "bg-gradient-to-br from-[#7C3AED] via-[#22D3EE] to-[#0F172A] shadow-[0_0_36px_rgba(124,58,237,0.32)] ring-[4px] ring-[#7C3AED]/45";
    }
    if (liveConnecting || liveWebFetching) {
      return "bg-gradient-to-br from-slate-700 via-[#334155] to-slate-900 shadow-[0_0_30px_rgba(34,211,238,0.22)] ring-[3px] ring-[#22D3EE]/35";
    }
    if (userSpeaking && listening) {
      return "bg-gradient-to-br from-[#00E5FF] via-[#22D3EE] to-[#7C3AED] shadow-[0_0_40px_rgba(0,229,255,0.28),0_0_52px_rgba(124,58,237,0.24)] ring-[4px] ring-[#7C3AED]/45 neo-voice-mic-user-talk";
    }
    return "bg-gradient-to-br from-[#22D3EE] to-[#0F172A] shadow-[0_0_30px_rgba(34,211,238,0.22)] ring-[3px] ring-[#22D3EE]/45 neo-voice-mic-session-start neo-voice-mic-idle-live";
  }, [sessionOn, speaking, liveConnecting, liveWebFetching, userSpeaking, listening]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const showRealtimeSupportWarning = hasMounted && !isOpenAiRealtimeVoiceSupported();

  return (
    <div className="relative z-[1] flex h-full min-h-0 flex-1 flex-col bg-[#F5F7FA] md:min-h-0">
      <MainTopNav
        center={headerTitle}
        trailingBeforeProfile={
          <div
            className="relative z-30 flex shrink-0 items-center rounded-[12px] border border-slate-200 bg-white p-0.5 shadow-sm"
            role="group"
            aria-label="Assistant voice gender"
          >
            <button
              type="button"
              onClick={() => void applyPersona("arjun")}
              className={`rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition sm:px-2.5 ${
                activePersonaId === "arjun"
                  ? "bg-[#eff6ff] text-[#1e40af] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.35)]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              Man
            </button>
            <button
              type="button"
              onClick={() => void applyPersona("sara")}
              className={`rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition sm:px-2.5 ${
                activePersonaId === "sara"
                  ? "bg-[#eff6ff] text-[#1e40af] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.35)]"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              Woman
            </button>
          </div>
        }
      />

      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center px-4 py-4 md:max-w-xl md:py-6">
        <div className="neo-screen-card flex min-h-0 w-full flex-col items-center justify-center rounded-[16px] px-4 py-8 text-center sm:py-10">
          {showRealtimeSupportWarning ? (
            <p className="mb-6 max-w-sm text-center text-[11px] leading-relaxed text-amber-400/90">
              Live needs HTTPS and WebRTC. Update Android System WebView / Chrome on this device.
            </p>
          ) : null}
            <div className="relative mx-auto flex flex-col items-center justify-center">
              <div
                className="pointer-events-none absolute -left-20 top-1/2 h-[2px] w-16 bg-gradient-to-r from-transparent via-[#58adff]/90 to-transparent"
                aria-hidden
              />
              <div
                className="pointer-events-none absolute -right-20 top-1/2 h-[2px] w-16 bg-gradient-to-r from-transparent via-[#58adff]/90 to-transparent"
                aria-hidden
              />
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
                className="mb-3 mt-1 rounded-[12px] border border-[#2563EB]/35 bg-[#eff6ff] px-5 py-2.5 text-sm font-semibold text-[#1e40af] transition hover:bg-[#dbeafe]"
              >
                Tap to interrupt
              </button>
            ) : null}
            {sessionOn && userSpeaking && !speaking && !liveConnecting && !liveWebFetching ? (
              <div
                className="pointer-events-none absolute -inset-14 rounded-full bg-gradient-to-tr from-fuchsia-500/30 via-cyan-400/25 to-violet-500/25 blur-2xl motion-safe:animate-pulse"
                aria-hidden
              />
            ) : null}
            {sessionOn && speaking ? (
              <div
                className="pointer-events-none absolute -inset-10 rounded-full bg-violet-500/15 blur-2xl"
                aria-hidden
              />
            ) : null}
            {sessionOn && listening && !userSpeaking && !speaking && !liveConnecting && !liveWebFetching ? (
              <div
                className="pointer-events-none absolute -inset-10 rounded-full bg-emerald-500/12 blur-2xl"
                aria-hidden
              />
            ) : null}
            <button
              key={sessionOn ? `live-${micSessionKey}` : "idle-mic"}
              type="button"
              onClick={toggleMic}
              className={`relative z-[1] mt-4 flex h-[106px] w-[106px] shrink-0 items-center justify-center rounded-full text-white transition-transform duration-200 active:scale-[0.97] ${micButtonClass}`}
              aria-pressed={sessionOn}
              aria-label={sessionOn ? "End voice session" : "Start voice session"}
            >
              {sessionOn ? (
                <IconLiveEnd className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" />
              ) : (
                <span className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">
                  <IconMic />
                </span>
              )}
            </button>
          </div>

          <p className="mt-4 w-full text-center text-sm font-medium text-slate-800">
            {sessionOn ? "Listening..." : "Voice Chat"}
          </p>
          <p className="mt-1 w-full text-center text-xs text-slate-500">
            {sessionOn ? "Tap the button to stop" : "Speak with AI naturally"}
          </p>
          {err && !sessionOn ? (
            <p className="mt-6 max-w-md text-center text-xs leading-relaxed text-amber-400/95" role="alert">
              {err}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
