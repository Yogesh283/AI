"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { MainTopNav } from "@/components/neo/MainTopNav";
import { fetchMe, getStoredToken, getStoredUser, patchVoicePersona, saveSession } from "@/lib/auth";
import { postChat } from "@/lib/api";
import {
  mergeVoicePreferences,
  stripVoicePreferencePhrases,
} from "@/lib/voicePreferenceCommands";
import {
  ackPhraseForLang,
  DEFAULT_VOICE_SPEECH_LANG,
  normalizeVoiceSpeechLang,
  readStoredVoiceSpeechLang,
  voiceSessionWelcomeLines,
  writeStoredVoiceSpeechLang,
  type VoiceSpeechLangCode,
} from "@/lib/voiceLanguages";
import {
  getVoicePersona,
  readStoredVoicePersonaId,
  writeStoredVoicePersonaId,
} from "@/lib/voicePersonas";
import { inferVoiceReplyMood } from "@/lib/voiceReplyMood";
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
  type TtsSpeedPreset,
  type TtsVoiceGender,
} from "@/lib/voiceChat";
import { useWakeLock } from "@/lib/useWakeLock";

const VOICE_HISTORY_PREFIX = "neo-voice-history-";

/**
 * Pause after assistant audio ends before opening the mic again — hand-to-hand turns,
 * avoids echo / clipped first syllable on many devices.
 */
const MIC_RESUME_AFTER_TTS_MS = 420;

/** Voice page: slightly slower, cleaner articulation (browser TTS). */
const VOICE_TTS_PRESET: TtsSpeedPreset = "clear";

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

type Turn = { role: "user" | "assistant"; content: string };

export default function VoicePage() {
  const [listening, setListening] = useState(false);
  const [sessionOn, setSessionOn] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [err, setErr] = useState<string | null>(null);
  /** Must match SSR + first client paint — hydrate from storage in useEffect (avoids mismatch). */
  const [lang, setLang] = useState<VoiceSpeechLangCode>(DEFAULT_VOICE_SPEECH_LANG);
  const [ttsGender, setTtsGender] = useState<TtsVoiceGender>("female");
  const [history, setHistory] = useState<Turn[]>([]);
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null);
  const [ttsSupported, setTtsSupported] = useState<boolean | null>(null);
  /** Bumps when `/api/auth/me` refreshes local profile (display name, etc.). */
  const [, setProfileSync] = useState(0);

  const sessionOnRef = useRef(false);
  const thinkingRef = useRef(false);
  const speakingRef = useRef(false);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalBuf = useRef("");
  const interimRef = useRef("");
  const historyRef = useRef<Turn[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const beginListeningRef = useRef<() => void>(() => {});

  const scheduleResumeListening = useCallback(() => {
    window.setTimeout(() => {
      if (sessionOnRef.current) beginListeningRef.current();
    }, MIC_RESUME_AFTER_TTS_MS);
  }, []);

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
    setLang(readStoredVoiceSpeechLang());
    setTtsGender(readTtsGender());
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "neo-voice-persona-id" || e.key === "neo-tts-gender") {
        setPersonaId(readStoredVoicePersonaId());
        setTtsGender(readTtsGender());
      }
      if (e.key === "neo-voice-speech-lang" && e.newValue) {
        setLang(normalizeVoiceSpeechLang(e.newValue));
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
          queueMicrotask(() => {
            if (!thinkingRef.current && !speakingRef.current) beginListeningRef.current();
          });
        }
        return;
      }
      setErr(null);
      stopRecognitionOnly();
      stopSpeaking();

      const { cleaned, prefs } = stripVoicePreferencePhrases(t);
      const merged = mergeVoicePreferences(prefs);
      const nextLang = merged.lang ? normalizeVoiceSpeechLang(merged.lang) : undefined;
      const langChanged = Boolean(nextLang && nextLang !== lang);
      const personaChanged = Boolean(
        merged.personaId && merged.personaId !== (personaId ?? readStoredVoicePersonaId() ?? "sara"),
      );

      let speakLang: VoiceSpeechLangCode = lang;
      let speakGender: TtsVoiceGender = ttsGender;
      if (nextLang) {
        speakLang = nextLang;
        setLang(nextLang);
        writeStoredVoiceSpeechLang(nextLang);
      }
      if (merged.personaId) {
        const p = getVoicePersona(merged.personaId);
        speakGender = p.ttsGender;
        writeStoredVoicePersonaId(merged.personaId);
        writeTtsGender(p.ttsGender);
        setPersonaId(merged.personaId);
        setTtsGender(p.ttsGender);
        const token = getStoredToken();
        if (token) {
          void patchVoicePersona(merged.personaId).catch(() => {
            /* offline — local choice still applies */
          });
        }
      }

      const toSend = cleaned.trim();
      const prefsOnly = toSend.length === 0 && (langChanged || personaChanged);

      if (prefsOnly) {
        const bits: string[] = [];
        if (langChanged) bits.push(ackPhraseForLang(speakLang));
        if (personaChanged)
          bits.push(merged.personaId === "arjun" ? "Male voice." : "Female voice.");
        const ack = bits.join(" ") || "Okay.";
        setSpeaking(true);
        try {
          await speakText(ack, speakLang, {
            voiceGender: speakGender,
            speedPreset: VOICE_TTS_PRESET,
            replyMood: "neutral",
          });
        } catch {
          /* ignore */
        } finally {
          setSpeaking(false);
        }
        if (sessionOnRef.current) scheduleResumeListening();
        return;
      }

      if (!toSend) {
        if (sessionOnRef.current) {
          queueMicrotask(() => {
            if (!thinkingRef.current && !speakingRef.current) beginListeningRef.current();
          });
        }
        return;
      }

      setThinking(true);
      try {
        const user = getStoredUser();
        const uid = user?.id ?? "default";
        const msgs = [...historyRef.current, { role: "user" as const, content: toSend }];
        const { reply } = await postChat(msgs, uid, {
          source: "voice",
          useWeb: true,
        });
        const next: Turn[] = [...msgs, { role: "assistant", content: reply }];
        historyRef.current = next;
        setHistory(next);
        setThinking(false);

        const mood = inferVoiceReplyMood(reply);

        setSpeaking(true);
        try {
          await speakText(prepareSpeechText(reply), speakLang, {
            voiceGender: speakGender,
            speedPreset: VOICE_TTS_PRESET,
            replyMood: mood,
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
        scheduleResumeListening();
      }
    },
    [lang, ttsGender, personaId, scheduleResumeListening, stopRecognitionOnly]
  );

  const beginListening = useCallback(() => {
    if (!sessionOnRef.current) return;
    /* Mic only while assistant is idle — strict turn-taking. */
    if (thinkingRef.current || speakingRef.current) return;
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
        queueMicrotask(() => {
          if (!thinkingRef.current && !speakingRef.current) beginListeningRef.current();
        });
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
        queueMicrotask(() => {
          if (!thinkingRef.current && !speakingRef.current) beginListeningRef.current();
        });
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
    stopRecognitionOnly();
    stopSpeaking();
    sessionOnRef.current = true;
    setSessionOn(true);
    void (async () => {
      const u = getStoredUser();
      const nm = u?.display_name?.trim() ?? "";
      const welcome = voiceSessionWelcomeLines(lang, u?.display_name);
      const line = nm ? welcome.withName : welcome.withoutName;
      setErr(null);
      setSpeaking(true);
      try {
        await speakText(line, lang, {
          voiceGender: ttsGender,
          speedPreset: VOICE_TTS_PRESET,
          replyMood: "neutral",
        });
      } catch {
        /* still open mic */
      } finally {
        setSpeaking(false);
      }
      if (sessionOnRef.current) {
        window.setTimeout(() => {
          if (sessionOnRef.current) beginListening();
        }, MIC_RESUME_AFTER_TTS_MS);
      }
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

  const headerTitle = !sessionOn
    ? "Voice chat"
    : listening
      ? "Listening…"
      : thinking
        ? "Thinking…"
        : speaking
          ? "Speaking…"
          : "Ready";

  return (
    <div className="relative z-[1] flex min-h-0 flex-1 flex-col bg-[#080a0f] md:min-h-0">
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_85%_55%_at_50%_18%,rgba(0,180,220,0.14),transparent_55%),radial-gradient(ellipse_70%_50%_at_80%_70%,rgba(124,58,237,0.12),transparent_50%),linear-gradient(180deg,#080a0f_0%,#070b12_45%,#080a0f_100%)]"
        aria-hidden
      />
      <MainTopNav center={headerTitle} />

      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col px-4 py-6 md:max-w-xl">
        {history.length > 0 ? (
          <div className="mb-4 shrink-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Saved conversation
              </p>
              <button
                type="button"
                onClick={clearHistory}
                className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-2.5 py-1 text-[10px] font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
              >
                Clear
              </button>
            </div>
            <div
              ref={transcriptRef}
              className="max-h-36 space-y-2 overflow-y-auto rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2 ring-1 ring-white/[0.04]"
            >
              {history.map((turn, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-2.5 py-1.5 text-[12px] leading-snug ${
                    turn.role === "user"
                      ? "border border-[#00D4FF]/20 bg-[#00D4FF]/8 text-white/90"
                      : "border border-white/[0.06] bg-white/[0.04] text-white/82"
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wide text-white/35">
                    {turn.role === "user" ? profileName : "Assistant"}
                  </span>
                  <p className="mt-0.5 whitespace-pre-wrap break-words">{turn.content}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
        {ttsSupported === false || speechSupported === false ? (
          <p className="mb-8 max-w-sm text-center text-[11px] leading-relaxed text-white/35">
            {speechSupported === false
              ? "Voice input needs Chrome or Edge on desktop."
              : "Speech output works best in Chrome or Edge."}
          </p>
        ) : null}

        <div className="relative flex flex-col items-center">
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[#00a8cc]/35 to-[#6d28d9]/28 blur-3xl md:h-52 md:w-52"
            animate={{ scale: pulse ? [1, 1.12, 1] : 1, opacity: pulse ? [0.65, 1, 0.65] : 0.45 }}
            transition={{ duration: 2.2, repeat: pulse ? Infinity : 0 }}
          />
          <button
            type="button"
            onClick={toggleMic}
            className={`relative flex h-[88px] w-[88px] shrink-0 items-center justify-center rounded-full text-white shadow-[0_0_48px_rgba(0,212,255,0.32)] transition active:scale-[0.97] ${
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

        {interim && listening ? (
          <p className="mt-8 max-w-md border-l-2 border-[#00D4FF]/35 pl-3 text-center text-[13px] italic text-white/55 md:text-left">
            {interim}
          </p>
        ) : null}
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
