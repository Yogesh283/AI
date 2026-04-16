"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MainTopNav } from "@/components/neo/MainTopNav";
import { fetchMe, getStoredToken, getStoredUser, patchVoicePersona, saveSession } from "@/lib/auth";
import { postChat } from "@/lib/api";
import {
  mergeVoicePreferences,
  stripVoicePreferencePhrases,
} from "@/lib/voicePreferenceCommands";
import { shortDisplayNameForGreeting } from "@/lib/siteBranding";
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
  normalizeVoicePersonaId,
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

type VoiceAvatarState = "idle" | "listening" | "thinking" | "speaking";

function VirtualVoiceAssistant({
  state,
  active,
  personaId,
}: {
  state: VoiceAvatarState;
  active: boolean;
  personaId: "arjun" | "sara";
}) {
  const speaking = state === "speaking";
  const listening = state === "listening";
  const thinking = state === "thinking";
  const isMale = personaId === "arjun";
  const hoodieFrom = isMale ? "#1e3a8a" : "#295f73";
  const hoodieTo = isMale ? "#1e1b4b" : "#1b3f52";
  const hairColor = isMale ? "#111827" : "#3b0764";
  const skin = "#f4c8a8";
  const bodyGradId = isMale ? "va-body-grad-man" : "va-body-grad-woman";
  const faceGradId = isMale ? "va-face-grad-man" : "va-face-grad-woman";
  const glowGradId = isMale ? "va-glow-grad-man" : "va-glow-grad-woman";
  const auraPulse = speaking ? 0.6 : listening ? 0.85 : 1.8;

  return (
    <div className="relative flex h-[330px] w-[245px] items-end justify-center sm:h-[352px] sm:w-[270px]">
      <motion.div
        className="pointer-events-none absolute inset-x-2 bottom-8 h-56 rounded-[42%] bg-gradient-to-br from-cyan-400/35 via-indigo-500/30 to-fuchsia-500/35 blur-2xl"
        animate={{
          scale: active ? [1, 1.11, 1] : 1,
          opacity: active ? [0.35, 0.92, 0.35] : 0.22,
        }}
        transition={{ duration: auraPulse, repeat: active ? Infinity : 0 }}
      />
      <motion.div
        className="relative"
        animate={{
          y: thinking ? [0, -7, 0] : active ? [0, -2, 0] : 0,
          scale: speaking ? [1, 1.015, 1] : [1, 1.008, 1],
        }}
        transition={{
          duration: thinking ? 1.22 : speaking ? 0.85 : 2.5,
          repeat: thinking || active ? Infinity : 0,
        }}
      >
        <motion.svg
          viewBox="0 0 220 320"
          className="h-[325px] w-[245px] drop-shadow-[0_18px_40px_rgba(0,0,0,0.45)] sm:h-[346px] sm:w-[264px]"
          role="img"
          aria-label={isMale ? "Virtual male AI assistant" : "Virtual female AI assistant"}
        >
          <defs>
            <linearGradient id={bodyGradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={hoodieFrom} />
              <stop offset="100%" stopColor={hoodieTo} />
            </linearGradient>
            <radialGradient id={faceGradId} cx="46%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#ffd8bb" />
              <stop offset="100%" stopColor={skin} />
            </radialGradient>
            <radialGradient id={glowGradId} cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="rgba(34,211,238,0.6)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0)" />
            </radialGradient>
          </defs>

          <ellipse cx="110" cy="198" rx="74" ry="62" fill={`url(#${glowGradId})`} opacity={active ? 0.55 : 0.32} />
          <ellipse cx="110" cy="304" rx="58" ry="12" fill="rgba(56,189,248,0.2)" />

          <motion.circle
            cx="56"
            cy="74"
            r="8"
            fill={skin}
            animate={{ scale: listening ? [1, 1.12, 1] : 1 }}
            transition={{ duration: 0.95, repeat: listening ? Infinity : 0 }}
          />
          <motion.circle
            cx="164"
            cy="74"
            r="8"
            fill={skin}
            animate={{ scale: listening ? [1, 1.12, 1] : 1 }}
            transition={{ duration: 0.95, repeat: listening ? Infinity : 0, delay: 0.08 }}
          />

          <rect x="80" y="226" width="22" height="72" rx="11" fill="#0f172a" />
          <rect x="118" y="226" width="22" height="72" rx="11" fill="#0f172a" />
          <rect x="74" y="294" width="34" height="12" rx="6" fill="#111827" />
          <rect x="112" y="294" width="34" height="12" rx="6" fill="#111827" />

          <motion.g
            style={{ transformOrigin: "110px 174px" }}
            animate={{ rotate: speaking ? [0, 1.8, -1.8, 0] : 0 }}
            transition={{ duration: 0.9, repeat: speaking ? Infinity : 0 }}
          >
            {isMale ? (
              <>
                <path
                  d="M62 148c0-20 16-36 36-36h24c20 0 36 16 36 36v82H62z"
                  fill={`url(#${bodyGradId})`}
                />
                <path d="M70 150c8-20 24-30 40-30s32 10 40 30v28H70z" fill="rgba(255,255,255,0.08)" />
              </>
            ) : (
              <>
                <path d="M60 150c0-21 17-38 38-38h24c21 0 38 17 38 38v82H60z" fill={`url(#${bodyGradId})`} />
                <path d="M76 154c7-18 20-28 34-28 15 0 28 10 35 28v26H76z" fill="rgba(255,255,255,0.12)" />
                <rect x="72" y="162" width="76" height="52" rx="18" fill="rgba(10,20,28,0.42)" />
                <path d="M84 178h52" stroke="rgba(148,220,255,0.55)" strokeWidth="2.5" />
              </>
            )}
            <rect x="94" y="108" width="32" height="24" rx="12" fill={skin} />
            <path d="M78 152l18 30h28l18-30-14-16H92z" fill={isMale ? "#0f255f" : "#184c60"} />
            <rect x="104" y="158" width="12" height="34" rx="6" fill="#e5e7eb" />
            <circle cx="108" cy="172" r="1.8" fill="#94a3b8" />
            <circle cx="112" cy="186" r="1.8" fill="#94a3b8" />
          </motion.g>

          <motion.g
            style={{ transformOrigin: "70px 148px" }}
            animate={{ rotate: speaking ? [10, 26, 8] : listening ? [10, 16, 10] : 10 }}
            transition={{ duration: speaking ? 0.55 : 1.3, repeat: speaking || listening ? Infinity : 0 }}
          >
            <rect x="52" y="130" width="20" height="78" rx="10" fill={skin} />
            <rect x="52" y="152" width="20" height="42" rx="10" fill={isMale ? "#1e3a8a" : "#295f73"} />
            <circle cx="62" cy="214" r="10" fill={skin} />
          </motion.g>

          <motion.g
            style={{ transformOrigin: "150px 148px" }}
            animate={{ rotate: speaking ? [-10, -26, -8] : listening ? [-10, -16, -10] : -10 }}
            transition={{ duration: speaking ? 0.55 : 1.3, repeat: speaking || listening ? Infinity : 0, delay: 0.08 }}
          >
            <rect x="148" y="130" width="20" height="78" rx="10" fill={skin} />
            <rect x="148" y="152" width="20" height="42" rx="10" fill={isMale ? "#1e3a8a" : "#295f73"} />
            <circle cx="158" cy="214" r="10" fill={skin} />
          </motion.g>

          <circle cx="110" cy="74" r="46" fill={`url(#${faceGradId})`} />
          {isMale ? (
            <>
              <path
                d="M62 74c1-30 21-54 48-54 25 0 47 20 48 54-10-10-24-14-37-14-17 0-33 6-43 14z"
                fill={hairColor}
              />
              <path
                d="M72 48c9-16 24-24 40-24 14 0 27 5 36 18-8-3-16-5-24-5-20 0-37 8-52 11z"
                fill="#374151"
              />
              <rect x="78" y="66" width="27" height="20" rx="8" fill="none" stroke="#0f172a" strokeWidth="3" />
              <rect x="115" y="66" width="27" height="20" rx="8" fill="none" stroke="#0f172a" strokeWidth="3" />
              <rect x="105" y="73" width="10" height="4" rx="2" fill="#0f172a" />
            </>
          ) : (
            <>
              <path
                d="M64 78c0-32 19-57 46-57 26 0 46 24 46 57-10-9-22-14-35-14-16 0-31 6-43 14z"
                fill={hairColor}
              />
              <path d="M75 48c8-10 20-16 35-16 15 0 26 6 34 16-8-2-16-4-25-4-18 0-31 4-44 4z" fill="#7f1d1d" />
              <path d="M66 58a44 44 0 0188 0" stroke="#0b2230" strokeWidth="7" fill="none" />
              <circle cx="62" cy="72" r="12" fill="#2f6f86" stroke="#0b2230" strokeWidth="3" />
              <circle cx="158" cy="72" r="12" fill="#2f6f86" stroke="#0b2230" strokeWidth="3" />
            </>
          )}
          <path d="M88 70c4-3 9-4 14-1" stroke="#1f2937" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M118 69c4-3 10-4 14-1" stroke="#1f2937" strokeWidth="2.2" strokeLinecap="round" />

          <motion.circle
            cx="93"
            cy="77"
            r="4.2"
            fill="#0f172a"
            animate={{ scaleY: listening ? [1, 0.35, 1] : 1 }}
            transition={{ duration: 0.85, repeat: listening ? Infinity : 0 }}
          />
          <motion.circle
            cx="127"
            cy="77"
            r="4.2"
            fill="#0f172a"
            animate={{ scaleY: listening ? [1, 0.35, 1] : 1 }}
            transition={{ duration: 0.85, repeat: listening ? Infinity : 0, delay: 0.08 }}
          />
          <ellipse cx="110" cy="89" rx="3.4" ry="2.4" fill="#e8a58d" />
          <motion.rect
            x="97"
            y="99"
            width="26"
            height="6"
            rx="3.2"
            fill="#7f1d1d"
            transform="translate(0 0)"
            animate={{
              width: speaking ? [26, 11, 30, 14, 26] : [26, 20, 26],
              height: speaking ? [6, 16, 7, 14, 6] : [6, 5, 6],
              x: speaking ? [97, 105, 95, 103, 97] : [97, 100, 97],
              y: speaking ? [99, 101, 100, 101, 99] : 99,
            }}
            transition={{ duration: speaking ? 0.32 : 1.4, repeat: speaking || listening ? Infinity : 0 }}
          />
          <path d="M95 111c10 8 20 8 30 0" stroke="#f8fafc" strokeOpacity="0.7" strokeWidth="1.2" />
          <motion.path
            d="M66 118c15 8 28 12 44 12 18 0 31-4 45-12"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="2"
            fill="none"
            animate={{ opacity: active ? [0.2, 0.65, 0.2] : 0.2 }}
            transition={{ duration: 1.25, repeat: active ? Infinity : 0 }}
          />
        </motion.svg>
      </motion.div>
      <motion.div
        className="pointer-events-none absolute bottom-3 h-10 w-32 rounded-[100%] bg-cyan-400/20 blur-xl"
        animate={{ opacity: active ? [0.25, 0.55, 0.25] : 0.18, scaleX: active ? [1, 1.2, 1] : 1 }}
        transition={{ duration: 1.5, repeat: active ? Infinity : 0 }}
      />
    </div>
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

  useLayoutEffect(() => {
    setPersonaId(normalizeVoicePersonaId(readStoredVoicePersonaId()));
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
        setPersonaId(normalizeVoicePersonaId(readStoredVoicePersonaId()));
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
      const prevPid = normalizeVoicePersonaId(personaId ?? readStoredVoicePersonaId());
      const personaChanged = Boolean(
        merged.personaId && normalizeVoicePersonaId(merged.personaId) !== prevPid,
      );

      let speakLang: VoiceSpeechLangCode = lang;
      let speakGender: TtsVoiceGender = ttsGender;
      if (nextLang) {
        speakLang = nextLang;
        setLang(nextLang);
        writeStoredVoiceSpeechLang(nextLang);
      }
      if (merged.personaId) {
        const pid = normalizeVoicePersonaId(merged.personaId);
        const p = getVoicePersona(pid);
        speakGender = p.ttsGender;
        writeStoredVoicePersonaId(pid);
        writeTtsGender(p.ttsGender);
        setPersonaId(pid);
        setTtsGender(p.ttsGender);
        const token = getStoredToken();
        if (token) {
          void patchVoicePersona(pid)
            .then((u) => saveSession(token, u))
            .catch(() => {
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
          bits.push(normalizeVoicePersonaId(merged.personaId) === "arjun" ? "Male voice." : "Female voice.");
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
          useWeb: false,
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
      const shortName = shortDisplayNameForGreeting(u?.display_name);
      const welcome = voiceSessionWelcomeLines(lang, shortName);
      const line = shortName ? welcome.withName : welcome.withoutName;
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

  const avatarActive = listening || speaking || thinking || sessionOn;
  const avatarState: VoiceAvatarState = speaking
    ? "speaking"
    : listening
      ? "listening"
      : thinking
        ? "thinking"
        : "idle";

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
      if (!sessionOnRef.current && isSpeechSynthesisSupported()) {
        try {
          await speakText(pid === "arjun" ? "Male voice." : "Female voice.", lang, {
            voiceGender: p.ttsGender,
            speedPreset: VOICE_TTS_PRESET,
            replyMood: "neutral",
          });
        } catch {
          /* ignore */
        }
      }
    },
    [lang],
  );

  const activePersonaId = normalizeVoicePersonaId(personaId);

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
          <VirtualVoiceAssistant
            state={avatarState}
            active={avatarActive}
            personaId={activePersonaId}
          />
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
