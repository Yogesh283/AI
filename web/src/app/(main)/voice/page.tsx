"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { MainTopNav } from "@/components/neo/MainTopNav";
import { fetchMe, getStoredToken, getStoredUser, patchVoicePersona, saveSession } from "@/lib/auth";
import { appendUserMessageToChatStorage } from "@/lib/chatStorage";
import { postLiveWebContext, postVoiceRealtimeToken } from "@/lib/api";
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
    liveUserTranscriptOpenRef.current = false;
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
            liveSendClientEventRef.current = live.sendClientEvent;
            liveEnsureMicRef.current = live.ensureLocalMicLive;
            /* One uplink arm after bridge open — avoid repeated native calls (APK “tun” / focus churn). */
            live.ensureLocalMicLive();
            setLiveConnecting(false);
            setListening(true);
            /* No second Web Speech session here: it fought the WebRTC mic and caused OS “tun” cues on phones. */
          }
          if (s === "closed") {
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
            }, 420);
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
            nowMs - lastVoicePipelineUserLineRef.current.at < 3200
          ) {
            liveUserTranscriptOpenRef.current = false;
            return;
          }
          lastVoicePipelineUserLineRef.current = { line, at: nowMs };
          liveUserTranscriptOpenRef.current = false;
          appendUserMessageToChatStorage(getStoredUser()?.id ?? "anon", line);
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
            const t0 = Date.now();
            let block = "";
            let liveFetchFailed = false;
            try {
              const j = await postLiveWebContext(line);
              block = (j.block || "").trim();
              if (!block && sessionOnRef.current && myTurn === voiceLiveWebTurnRef.current) {
                await new Promise<void>((r) => setTimeout(r, 900));
                if (sessionOnRef.current && myTurn === voiceLiveWebTurnRef.current) {
                  const j2 = await postLiveWebContext(line);
                  block = (j2.block || "").trim();
                }
              }
            } catch {
              liveFetchFailed = true;
              /* offline / API error — still continue after min delay */
            }
            /* Give CSE + News time to finish before the model answers (live facts). */
            const waitMs = Math.max(0, 4500 - (Date.now() - t0));
            await new Promise<void>((r) => {
              setTimeout(r, waitMs);
            });
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
              await new Promise<void>((r) => setTimeout(r, 100));
            }
            if (!sessionOnRef.current || myTurn !== voiceLiveWebTurnRef.current) return;
            if (liveResponseBusyRef.current) {
              liveCancelRef.current?.();
              await new Promise<void>((r) => setTimeout(r, 220));
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
                        "Current-data strict mode: for this turn, speak only current facts that are explicitly present in the Live web data lines above. Do not guess any number/date/rank/price from memory. If a specific current value is missing in those lines, say it is not confirmed from retrieved live data.",
                    },
                  ],
                },
              });
            } else {
              const hint = liveFetchFailed
                ? "Live Google lookup failed (network or server). Answer briefly with clear uncertainty. Do not tell the user to visit other sites, official portals, or search engines for the same question—NeoXAI handles lookup here."
                : "Live Google lookup returned no usable snippets for this question. Summarize what you can from training without inventing specifics. Do not tell the user to browse elsewhere or search the web themselves for this same info—keep the answer here.";
              send({
                type: "conversation.item.create",
                item: {
                  type: "message",
                  role: "system",
                  content: [{ type: "input_text", text: hint }],
                },
              });
            }
            send({
              type: "response.create",
              response: {
                modalities: ["audio", "text"],
                max_output_tokens: 8192,
              },
            });
            /* Single re-arm after new response starts — no per-turn spam (reduces APK mic focus noise). */
            liveEnsureMicRef.current?.();
          };
          liveWebPipelineRef.current = liveWebPipelineRef.current
            .then(runPipeline)
            .catch(() => {
              /* ignore */
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
      });
      liveCloseRef.current = live.close;
      liveCancelRef.current = live.cancelAssistant;
      liveSendClientEventRef.current = live.sendClientEvent;
      liveEnsureMicRef.current = live.ensureLocalMicLive;
    } catch (e) {
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
  }, [lang, personaId]);

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
    sessionOnRef.current = true;
    setSessionOn(true);
    setMicSessionKey((k) => k + 1);
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
      liveSendClientEventRef.current = null;
      liveEnsureMicRef.current = null;
      stopRecognitionOnly();
      stopBargeInRecognition();
      stopVoiceOutput();
    };
  }, [stopBargeInRecognition, stopRecognitionOnly, stopVoiceOutput]);

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

  const headerTitle = useMemo(() => {
    if (!sessionOn) return "Voice chat";
    if (liveConnecting) return "Live — connecting…";
    if (liveWebFetching) return "Live — looking up facts…";
    return speaking ? "Live — assistant is speaking" : "Live — speak anytime";
  }, [sessionOn, liveConnecting, liveWebFetching, speaking]);

  const micButtonClass = useMemo(() => {
    if (!sessionOn) {
      return "bg-gradient-to-br from-[#00D4FF] via-[#6A5CFF] to-[#C85CFF] shadow-[0_0_48px_rgba(0,212,255,0.32),0_0_72px_rgba(106,92,255,0.22),0_0_88px_rgba(200,92,255,0.14)] ring-[3px] ring-[#6A5CFF]/45 hover:brightness-110";
    }
    if (speaking) {
      return "bg-gradient-to-br from-violet-600 via-teal-700 to-emerald-900 shadow-[0_0_40px_rgba(139,92,246,0.35)] ring-[4px] ring-violet-400/50";
    }
    if (liveConnecting || liveWebFetching) {
      return "bg-gradient-to-br from-slate-700 via-indigo-800 to-slate-900 shadow-[0_0_32px_rgba(99,102,241,0.25)] ring-[3px] ring-indigo-400/35";
    }
    if (userSpeaking && listening) {
      return "bg-gradient-to-br from-[#00D4FF] via-[#C85CFF] to-[#6A5CFF] shadow-[0_0_44px_rgba(200,92,255,0.35),0_0_56px_rgba(106,92,255,0.25)] ring-[4px] ring-[#C85CFF]/45 neo-voice-mic-user-talk";
    }
    return "bg-gradient-to-br from-emerald-500 to-teal-800 shadow-[0_0_36px_rgba(16,185,129,0.22)] ring-[3px] ring-emerald-300/45 neo-voice-mic-session-start neo-voice-mic-idle-live";
  }, [sessionOn, speaking, liveConnecting, liveWebFetching, userSpeaking, listening]);

  return (
    <div className="relative z-[1] flex min-h-0 flex-1 flex-col bg-[#080a0f] md:min-h-0">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_85%_55%_at_50%_18%,rgba(0,212,255,0.12),transparent_55%),radial-gradient(ellipse_70%_50%_at_80%_70%,rgba(106,92,255,0.14),transparent_50%),radial-gradient(ellipse_55%_40%_at_20%_80%,rgba(200,92,255,0.06),transparent_50%),linear-gradient(180deg,#080a0f_0%,#070b12_45%,#080a0f_100%)]"
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
              className={`relative z-[1] mt-4 flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full text-white transition-transform duration-200 active:scale-[0.97] ${micButtonClass}`}
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
