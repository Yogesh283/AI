"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import type { KalidokitMouthShape } from "@/lib/vrmKalidokitMouth";
import { speakTextWithAvatarLipSync, stopAvatarTtsAudio } from "@/lib/voiceAvatarTts";
import {
  captureNativeSpeechOnce,
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  isNativeSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  prepareSpeechText,
  primeSpeechVoices,
  readTtsSpeedPreset,
  speakText,
  speechRecognitionErrorMessage,
  stopSpeaking,
  writeTtsGender,
  type TtsVoiceGender,
} from "@/lib/voiceChat";
import { useWakeLock } from "@/lib/useWakeLock";
import {
  buildWhatsAppWebUrl,
  navigateToWhatsAppWeb,
  shouldOpenWhatsAppFromCommand,
  tryOpenWhatsAppPopup,
  whatsAppOpenAck,
} from "@/lib/whatsappOpenCommand";

const VOICE_HISTORY_PREFIX = "neo-voice-history-";

/**
 * Short pause after assistant audio ends before reopening the mic (avoids echo / clipped syllables).
 */
const MIC_RESUME_AFTER_TTS_MS = 180;

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
function VoiceSessionWaveform({
  sessionOn,
  speaking,
  listening,
  thinking,
}: {
  sessionOn: boolean;
  speaking: boolean;
  listening: boolean;
  thinking: boolean;
}) {
  if (!sessionOn) return null;
  const mode = speaking ? "speaking" : listening ? "listening" : thinking ? "thinking" : "idle";
  return (
    <div className="neo-voice-bars" data-voice-mode={mode} aria-hidden>
      {Array.from({ length: 16 }, (_, i) => (
        <div key={i} className="neo-voice-bar" style={{ animationDelay: `${i * 0.045}s` }} />
      ))}
    </div>
  );
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
  /** Monotonic id so stale `speaking` state doesn’t fight after interrupt. */
  const speakGenerationRef = useRef(0);
  /** True while a recognition session is active — prevents overlapping `start()` calls that abort + clear text + jitter the UI. */
  const listeningActiveRef = useRef(false);
  /** Throttle live transcript updates — onresult can fire many times/sec and re-render the whole page. */
  const lastInterimUiMs = useRef(0);

  const scheduleResumeListening = useCallback(() => {
    window.setTimeout(() => {
      if (!sessionOnRef.current) return;
      /* Unstick if a previous session didn’t fire onend — otherwise beginListening no-ops forever */
      listeningActiveRef.current = false;
      beginListeningRef.current();
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
    const pid = normalizeVoicePersonaId(readStoredVoicePersonaId());
    setPersonaId(pid);
    const g = getVoicePersona(pid).ttsGender;
    setTtsGender(g);
    /** Keep storage aligned so a later mount effect cannot overwrite with stale readTtsGender(). */
    writeTtsGender(g);
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
    setSpeechSupported(isSpeechRecognitionSupported());
    setTtsSupported(isSpeechSynthesisSupported());
    primeSpeechVoices();
    const synth = window.speechSynthesis;
    const onVoices = () => primeSpeechVoices();
    synth?.addEventListener?.("voiceschanged", onVoices);
    void (async () => {
      const nativeOk = await isNativeSpeechRecognitionSupported();
      if (nativeOk) setSpeechSupported(true);
    })();
    return () => synth?.removeEventListener?.("voiceschanged", onVoices);
  }, []);

  const stopRecognitionOnly = useCallback(() => {
    listeningActiveRef.current = false;
    lastInterimUiMs.current = 0;
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

  const stopVoiceOutput = useCallback(() => {
    stopSpeaking();
    stopAvatarTtsAudio();
  }, []);

  const stopSession = useCallback(() => {
    sessionOnRef.current = false;
    setSessionOn(false);
    stopVoiceOutput();
    stopRecognitionOnly();
  }, [stopRecognitionOnly, stopVoiceOutput]);

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
      stopVoiceOutput();

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
        const gen = ++speakGenerationRef.current;
        setSpeaking(true);
        try {
          primeSpeechVoices();
          window.speechSynthesis?.resume();
          await speakTextWithAvatarLipSync(ack, speakLang, {
            mouthShapeRef,
            voiceGender: speakGender,
            speedPreset: readTtsSpeedPreset(),
            replyMood: "neutral",
          });
        } catch {
          /* ignore */
        } finally {
          if (speakGenerationRef.current === gen) setSpeaking(false);
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

      if (shouldOpenWhatsAppFromCommand(toSend)) {
        const waUrl = buildWhatsAppWebUrl(toSend);
        const popped = tryOpenWhatsAppPopup(waUrl);
        const ack = whatsAppOpenAck(speakLang, popped ? "new-tab" : "same-tab");
        const turnUser = { role: "user" as const, content: toSend };
        const turnAsst = { role: "assistant" as const, content: ack };
        const next: Turn[] = [...historyRef.current, turnUser, turnAsst];
        historyRef.current = next;
        setHistory(next);
        if (!popped) {
          navigateToWhatsAppWeb(waUrl);
          return;
        }
        const gen = ++speakGenerationRef.current;
        setSpeaking(true);
        try {
          primeSpeechVoices();
          window.speechSynthesis?.resume();
          await speakTextWithAvatarLipSync(ack, speakLang, {
            mouthShapeRef,
            voiceGender: speakGender,
            speedPreset: readTtsSpeedPreset(),
            replyMood: "neutral",
          });
        } catch {
          /* ignore */
        } finally {
          if (speakGenerationRef.current === gen) setSpeaking(false);
        }
        if (sessionOnRef.current) scheduleResumeListening();
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

        const gen = ++speakGenerationRef.current;
        setSpeaking(true);
        try {
          primeSpeechVoices();
          window.speechSynthesis?.resume();
          await speakTextWithAvatarLipSync(prepareSpeechText(reply), speakLang, {
            mouthShapeRef,
            voiceGender: speakGender,
            speedPreset: readTtsSpeedPreset(),
            replyMood: mood,
          });
        } catch (ttsErr) {
          const msg =
            ttsErr instanceof Error ? ttsErr.message : "TTS failed";
          setErr(
            `${msg} — Volume / speakers check karein; Chrome ya Edge try karein.`
          );
        } finally {
          if (speakGenerationRef.current === gen) setSpeaking(false);
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
    [lang, ttsGender, personaId, scheduleResumeListening, stopRecognitionOnly, stopVoiceOutput]
  );

  const beginListening = useCallback(() => {
    if (!sessionOnRef.current) return;
    /* Turn-taking: mic only while assistant is idle (continuous:true broke onend → speech never sent). */
    if (thinkingRef.current || speakingRef.current) return;
    if (listeningActiveRef.current) return;
    if (!isSpeechRecognitionSupported()) {
      listeningActiveRef.current = true;
      setListening(true);
      setInterim("");
      setErr(null);
      void (async () => {
        const { text, error } = await captureNativeSpeechOnce(lang, (it) => {
          const now = Date.now();
          if (now - lastInterimUiMs.current >= 90) {
            lastInterimUiMs.current = now;
            interimRef.current = it;
            setInterim(it);
          }
        });
        listeningActiveRef.current = false;
        setListening(false);
        setInterim("");
        interimRef.current = "";
        lastInterimUiMs.current = 0;

        if (!sessionOnRef.current) return;
        if (error) {
          setErr(error);
          sessionOnRef.current = false;
          setSessionOn(false);
          return;
        }
        if (text.trim()) {
          void sendText(text.trim());
          return;
        }
        queueMicrotask(() => {
          if (!thinkingRef.current && !speakingRef.current) beginListeningRef.current();
        });
      })();
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
      const now = Date.now();
      if (now - lastInterimUiMs.current >= 100) {
        lastInterimUiMs.current = now;
        setInterim(it);
      }
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      listeningActiveRef.current = false;
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
      listeningActiveRef.current = false;
      setListening(false);
      recRef.current = null;
      const said = `${finalBuf.current.trim()} ${interimRef.current.trim()}`.trim();
      interimRef.current = "";
      finalBuf.current = "";
      lastInterimUiMs.current = 0;
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
      listeningActiveRef.current = true;
      setListening(true);
    } catch {
      listeningActiveRef.current = false;
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
    stopVoiceOutput();
    sessionOnRef.current = true;
    setSessionOn(true);
    void (async () => {
      const u = getStoredUser();
      const shortName = shortDisplayNameForGreeting(u?.display_name);
      const welcome = voiceSessionWelcomeLines(lang, shortName);
      const line = shortName ? welcome.withName : welcome.withoutName;
      setErr(null);
      const gen = ++speakGenerationRef.current;
      setSpeaking(true);
      try {
        primeSpeechVoices();
        window.speechSynthesis?.resume();
        await speakTextWithAvatarLipSync(line, lang, {
          mouthShapeRef,
          voiceGender: ttsGender,
          speedPreset: readTtsSpeedPreset(),
          replyMood: "neutral",
        });
      } catch {
        /* still open mic */
      } finally {
        if (speakGenerationRef.current === gen) setSpeaking(false);
      }
      if (sessionOnRef.current) {
        window.setTimeout(() => {
          if (!sessionOnRef.current) return;
          listeningActiveRef.current = false;
          beginListening();
        }, MIC_RESUME_AFTER_TTS_MS);
      }
    })();
  }, [beginListening, stopSession, lang, ttsGender, stopVoiceOutput]);

  useEffect(() => {
    return () => {
      sessionOnRef.current = false;
      try {
        const r = recRef.current;
        if (r && "abort" in r) (r as SpeechRecognition).abort();
      } catch {
        /* ignore */
      }
      stopVoiceOutput();
    };
  }, [stopVoiceOutput]);

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
          primeSpeechVoices();
          window.speechSynthesis?.resume();
          await speakText(pid === "arjun" ? "Male voice." : "Female voice.", lang, {
            voiceGender: p.ttsGender,
            speedPreset: readTtsSpeedPreset(),
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
  const assistantLabel = getVoicePersona(activePersonaId).name;

  const headerTitle = useMemo(
    () =>
      !sessionOn
        ? "Voice chat"
        : listening
          ? "Listening — go ahead"
          : thinking
            ? "One sec…"
            : speaking
              ? "Replying…"
              : "I'm here",
    [sessionOn, listening, thinking, speaking],
  );

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
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/88 break-words">
                    {turn.content}
                  </p>
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
          <VoiceSessionWaveform
            sessionOn={sessionOn}
            speaking={speaking}
            listening={listening}
            thinking={thinking}
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
