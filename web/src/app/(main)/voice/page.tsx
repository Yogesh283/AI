"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { SpeakingAvatar } from "@/components/neo/SpeakingAvatar";
import { fetchMe, getStoredToken, getStoredUser, saveSession } from "@/lib/auth";
import { postChat } from "@/lib/api";
import {
  getVoicePersona,
  readStoredVoicePersonaId,
  writeStoredVoicePersonaId,
} from "@/lib/voicePersonas";
import {
  inferVoiceReplyMood,
  type VoiceReplyMood,
} from "@/lib/voiceReplyMood";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  prepareSpeechText,
  primeSpeechVoices,
  readTtsGender,
  speakText,
  speechRecognitionErrorMessage,
  stopSpeaking,
  writeTtsGender,
  type TtsVoiceGender,
} from "@/lib/voiceChat";
import { useWakeLock } from "@/lib/useWakeLock";

const VOICE_HISTORY_PREFIX = "neo-voice-history-";

type Turn = { role: "user" | "assistant"; content: string };

export default function VoicePage() {
  const { brandName } = useSiteBrand();
  const [listening, setListening] = useState(false);
  const [sessionOn, setSessionOn] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechBeat, setSpeechBeat] = useState(0);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [lang, setLang] = useState<"en-IN" | "hi-IN">("en-IN");
  const [ttsGender, setTtsGender] = useState<TtsVoiceGender>(() =>
    typeof window === "undefined" ? "female" : readTtsGender(),
  );
  const [history, setHistory] = useState<Turn[]>([]);
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null);
  const [replyMood, setReplyMood] = useState<VoiceReplyMood>("neutral");
  /** Bumps when `/api/auth/me` refreshes local profile (display name, etc.). */
  const [, setProfileSync] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const sessionOnRef = useRef(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalBuf = useRef("");
  const interimRef = useRef("");
  const historyRef = useRef<Turn[]>([]);
  const beginListeningRef = useRef<() => void>(() => {});

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    sessionOnRef.current = sessionOn;
  }, [sessionOn]);

  const persona = getVoicePersona(personaId ?? undefined);

  useEffect(() => {
    setPersonaId(readStoredVoicePersonaId());
  }, []);

  useWakeLock(sessionOn);

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
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [history, thinking]);

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
            voice_persona_id: u.voice_persona_id ?? prev.voice_persona_id,
          });
        }
        if (u.voice_persona_id) {
          writeStoredVoicePersonaId(u.voice_persona_id);
          const p = getVoicePersona(u.voice_persona_id);
          writeTtsGender(p.ttsGender);
          setPersonaId(u.voice_persona_id);
        }
        setTtsGender(readTtsGender());
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
    setTtsGender(readTtsGender());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "neo-voice-persona-id" || e.key === "neo-tts-gender") {
        setPersonaId(readStoredVoicePersonaId());
        setTtsGender(readTtsGender());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());
    setTtsSupported(isSpeechSynthesisSupported());
    primeSpeechVoices();
    const synth = window.speechSynthesis;
    const onVoices = () => primeSpeechVoices();
    synth?.addEventListener?.("voiceschanged", onVoices);
    return () => synth?.removeEventListener?.("voiceschanged", onVoices);
  }, []);

  const stopRecognitionOnly = useCallback(() => {
    try {
      recRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setListening(false);
    setInterim("");
    finalBuf.current = "";
    interimRef.current = "";
  }, []);

  const stopSession = useCallback(() => {
    sessionOnRef.current = false;
    setSessionOn(false);
    stopSpeaking();
    stopRecognitionOnly();
  }, [stopRecognitionOnly]);

  const sendText = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t) {
        if (sessionOnRef.current) {
          queueMicrotask(() => beginListeningRef.current());
        }
        return;
      }
      setErr(null);
      setThinking(true);
      stopSpeaking();
      try {
        const user = getStoredUser();
        const uid = user?.id ?? "default";
        const msgs = [...historyRef.current, { role: "user" as const, content: t }];
        const { reply } = await postChat(msgs, uid, {
          source: "voice",
          useWeb: true,
        });
        const next: Turn[] = [...msgs, { role: "assistant", content: reply }];
        historyRef.current = next;
        setHistory(next);
        setThinking(false);

        const mood = inferVoiceReplyMood(reply);
        setReplyMood(mood);

        setSpeaking(true);
        setSpeechBeat(0);
        try {
          await speakText(prepareSpeechText(reply), lang, {
            voiceGender: ttsGender,
            speedPreset: "natural",
            replyMood: mood,
            onSpeechBoundary: () => setSpeechBeat((n) => n + 1),
          });
        } catch (ttsErr) {
          const msg =
            ttsErr instanceof Error ? ttsErr.message : "TTS failed";
          setErr(
            `${msg} — Volume / speakers check karein; Chrome ya Edge try karein.`
          );
        } finally {
          setSpeaking(false);
        }
      } catch (e) {
        setErr(
          e instanceof Error
            ? e.message
            : "Chat API failed — check /neo-api/health on this site."
        );
        setThinking(false);
        setSpeaking(false);
      }

      if (sessionOnRef.current) {
        queueMicrotask(() => beginListeningRef.current());
      }
    },
    [lang, ttsGender]
  );

  const beginListening = useCallback(() => {
    if (!sessionOnRef.current) return;
    if (!isSpeechRecognitionSupported()) {
      setErr("Is browser mein voice support nahi (Chrome/Edge try karein).");
      return;
    }

    try {
      recRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    finalBuf.current = "";
    interimRef.current = "";
    setInterim("");
    setErr(null);

    const rec = createSpeechRecognition(lang);
    if (!rec) {
      setErr("Speech recognition start nahi ho paya.");
      return;
    }

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) {
          finalBuf.current += piece;
        } else {
          interimText += piece;
        }
      }
      const it = interimText.trim();
      interimRef.current = it;
      setInterim(it);
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      setListening(false);
      recRef.current = null;
      const msg = speechRecognitionErrorMessage(ev.error);
      if (msg) setErr(msg);
      if (ev.error === "aborted") return;
      // Don't loop forever on permission/device failures.
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed" || ev.error === "audio-capture") {
        sessionOnRef.current = false;
        setSessionOn(false);
        return;
      }
      if (sessionOnRef.current) {
        queueMicrotask(() => beginListeningRef.current());
      }
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const said = `${finalBuf.current.trim()} ${interimRef.current.trim()}`.trim();
      interimRef.current = "";
      finalBuf.current = "";
      setInterim("");

      if (!sessionOnRef.current) return;

      if (said) {
        void sendText(said);
      } else {
        queueMicrotask(() => beginListeningRef.current());
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setErr("Mic already busy — dubara try karein.");
      setListening(false);
    }
  }, [lang, sendText]);

  useEffect(() => {
    beginListeningRef.current = beginListening;
  }, [beginListening]);

  const toggleMic = useCallback(() => {
    if (sessionOnRef.current) {
      stopSession();
      return;
    }
    primeSpeechVoices();
    sessionOnRef.current = true;
    setSessionOn(true);
    void (async () => {
      const u = getStoredUser();
      const nm = u?.display_name?.trim() ?? "";
      const hi = lang.startsWith("hi");
      const line = nm
        ? hi
          ? `Namaste ${nm}, main yahan hoon — aapke saath. Boliye, main sun raha hoon.`
          : `Hello ${nm}, I'm right here with you. Go ahead — I'm listening.`
        : hi
          ? `Namaste, main sun raha hoon. Boliye.`
          : `Hello, I'm listening.`;
      setErr(null);
      setSpeaking(true);
      setSpeechBeat(0);
      try {
        await speakText(line, lang, {
          voiceGender: ttsGender,
          speedPreset: "natural",
          replyMood: "neutral",
          onSpeechBoundary: () => setSpeechBeat((n) => n + 1),
        });
      } catch {
        /* still open mic */
      } finally {
        setSpeaking(false);
      }
      if (sessionOnRef.current) beginListening();
    })();
  }, [beginListening, stopSession, lang, ttsGender]);

  useEffect(() => {
    return () => {
      sessionOnRef.current = false;
      try {
        const r = recRef.current;
        if (r && "abort" in r) (r as SpeechRecognition).abort();
      } catch {
        /* ignore */
      }
      stopSpeaking();
    };
  }, []);

  const pulse = listening || speaking || sessionOn;

  const statusLine = !sessionOn
    ? "Tap mic to start session"
    : thinking
      ? "Thinking…"
      : speaking
        ? "Speaking reply…"
        : listening
          ? "Listening — go ahead"
          : "Ready";

  const statePill = !sessionOn
    ? "off"
    : thinking
      ? "think"
      : speaking
        ? "speak"
        : listening
          ? "listen"
          : "idle";

  const profileName = getStoredUser()?.display_name?.trim() ?? "";

  return (
    <div className="relative z-[1] flex min-h-screen flex-col px-4 pb-36 pt-4 md:min-h-0 md:flex-1 md:px-8 md:pb-10 md:pt-6">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
        <header className="-mx-4 sticky top-0 z-30 mb-5 border-b border-white/[0.1] bg-[#0b0e14]/96 px-4 pb-3 pt-2 backdrop-blur-xl md:static md:z-auto md:mx-0 md:border-white/[0.06] md:bg-transparent md:pb-4 md:pt-0 md:backdrop-blur-none">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Voice
              </p>
              <h1 className="bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-base font-semibold tracking-tight text-transparent sm:text-lg md:text-xl">
                {profileName || `Talk to ${brandName}`}
              </h1>
              {profileName ? (
                <p className="mt-0.5 truncate text-[12px] font-medium text-white/50">
                  with {brandName}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-3 flex justify-center md:justify-end">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as "en-IN" | "hi-IN")}
              className="cursor-pointer rounded-xl border border-white/[0.1] bg-black/35 px-2.5 py-2 text-[11px] font-semibold text-white/85 outline-none ring-1 ring-white/[0.04] transition hover:border-[#00D4FF]/30"
              aria-label="Speech language"
            >
              <option value="en-IN">EN</option>
              <option value="hi-IN">HI</option>
            </select>
          </div>
        </header>

        {history.length > 0 ? (
          <div
            ref={transcriptRef}
            className="neo-glass mb-4 max-h-[min(38vh,22rem)] overflow-y-auto rounded-2xl border border-white/[0.08] px-3 py-2.5 ring-1 ring-white/[0.04]"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/35">
              Conversation
            </p>
            <div className="flex flex-col gap-2.5">
              {history.map((turn, i) => (
                <div
                  key={i}
                  className={`rounded-xl px-2.5 py-2 text-[13px] leading-relaxed ${
                    turn.role === "user"
                      ? "border border-[#00D4FF]/20 bg-[#00D4FF]/10 text-white/90"
                      : "border border-white/[0.06] bg-white/[0.04] text-white/85"
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white/40">
                    {turn.role === "user"
                      ? profileName || "You"
                      : brandName}
                  </span>
                  <p className="mt-1 whitespace-pre-wrap break-words">{turn.content}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mb-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                statePill === "listen"
                  ? "bg-[#00D4FF]/15 text-[#00D4FF]"
                  : statePill === "think"
                    ? "bg-amber-500/15 text-amber-300/95"
                    : statePill === "speak"
                      ? "bg-[#BD00FF]/15 text-[#e9c2ff]"
                      : statePill === "idle"
                        ? "bg-emerald-500/15 text-emerald-300/90"
                        : "bg-white/[0.06] text-white/40"
              }`}
            >
              {statePill === "listen"
                ? "Listening"
                : statePill === "think"
                  ? "Processing"
                  : statePill === "speak"
                    ? "Voice out"
                    : statePill === "idle"
                      ? "Ready"
                      : "Off"}
            </span>
            {sessionOn ? (
              <span className="text-[10px] text-emerald-400/90">● Session live</span>
            ) : null}
          </div>

          <div className="neo-glass flex max-w-xl flex-col gap-2 rounded-2xl border border-white/[0.08] px-4 py-3.5 ring-1 ring-[#00D4FF]/10">
            <div className="flex items-start gap-3">
              <motion.span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                  listening
                    ? "bg-[#00D4FF]"
                    : thinking
                      ? "bg-amber-400"
                      : speaking
                        ? "bg-[#BD00FF]"
                        : sessionOn
                          ? "bg-emerald-400"
                          : "bg-white/25"
                }`}
                animate={{ opacity: pulse ? [1, 0.35, 1] : 0.55 }}
                transition={{ duration: 1.1, repeat: pulse ? Infinity : 0 }}
              />
              <span className="text-[15px] font-medium leading-snug text-white/90">
                {statusLine}
              </span>
            </div>
            {interim && listening ? (
              <p className="border-l-2 border-[#00D4FF]/35 pl-3 text-[13px] italic leading-relaxed text-white/55">
                {interim}
              </p>
            ) : null}
            {err ? (
              <p className="text-xs leading-relaxed text-amber-400/95" role="alert">
                {err}
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative flex flex-1 flex-col items-center">
          <div className="relative mb-10">
            <motion.div
              className="absolute inset-0 -z-10 rounded-full bg-gradient-to-br from-[#00D4FF]/20 to-[#BD00FF]/15 blur-3xl"
              animate={{ scale: pulse ? [1, 1.05, 1] : 1 }}
              transition={{ duration: 1.8, repeat: pulse ? Infinity : 0 }}
            />
            <SpeakingAvatar
              imageSrc={persona.imageSrc}
              name={persona.name}
              speaking={speaking}
              speechBeat={speechBeat}
              listening={listening}
              sessionOn={sessionOn}
              replyMood={replyMood}
              thinking={thinking}
              userTalking={!!interim && listening}
            />
          </div>

          <p className="mb-8 text-center text-[11px] text-white/35">
            <Link href="/voice-personas" className="text-[#00D4FF]/75 hover:text-[#00D4FF] hover:underline">
              Avatar →
            </Link>
          </p>

          <div className="flex flex-col items-center">
            <motion.div
              className="relative"
              animate={
                sessionOn && !thinking && !speaking
                  ? { scale: [1, 1.02, 1] }
                  : {}
              }
              transition={{ duration: 2, repeat: Infinity }}
            >
              {sessionOn ? (
                <div className="absolute inset-[-6px] rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-600/20 opacity-60 blur-md" />
              ) : (
                <div className="absolute inset-[-6px] rounded-full bg-gradient-to-br from-[#00D4FF]/25 to-[#BD00FF]/20 opacity-50 blur-md" />
              )}
              <button
                type="button"
                onClick={toggleMic}
                className={`relative flex h-[92px] w-[92px] items-center justify-center rounded-full text-3xl shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition active:scale-[0.98] ${
                  sessionOn
                    ? "bg-gradient-to-br from-emerald-400 to-teal-700 text-white ring-[3px] ring-emerald-300/35"
                    : "bg-gradient-to-br from-[#00D4FF] to-[#7c3aed] text-white ring-[3px] ring-[#00D4FF]/25"
                }`}
                aria-pressed={sessionOn}
                aria-label={sessionOn ? "Session band karein" : "Session shuru — mic ON"}
              >
                <span className="drop-shadow-md">{sessionOn ? "⏻" : "🎙"}</span>
              </button>
            </motion.div>
            <p className="mt-4 max-w-[280px] text-center text-[12px] leading-relaxed text-white/45">
              {ttsSupported === false
                ? `Is browser mein ${brandName} ki awaaz (TTS) support nahi — Chrome / Edge use karein.`
                : sessionOn
                  ? `Session on — tap again to stop. Mic pauses while ${brandName} replies.`
                  : speechSupported === null
                    ? "Chrome / Edge: mic + speakers / volume on rakhein."
                    : speechSupported
                      ? "One tap = session ON. Avatar selection: link upar."
                      : "Speech ke liye Chrome ya Edge."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
