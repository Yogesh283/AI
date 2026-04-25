"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getStoredToken, patchVoicePersona, saveSession, type AuthUser } from "@/lib/auth";
import {
  readHelloNeoTtsGender,
  readHelloNeoTtsSpeedPreset,
  readNeoVoiceCommandAudioFeedback,
  readTtsSpeedPreset,
  writeHelloNeoTtsGender,
  writeHelloNeoTtsSpeedPreset,
  writeNeoVoiceCommandAudioFeedback,
  writeTtsGender,
  writeTtsSpeedPreset,
  type NeoVoiceCommandAudioFeedback,
  type TtsSpeedPreset,
  type TtsVoiceGender,
} from "@/lib/voiceChat";
import {
  getVoicePersona,
  normalizeVoicePersonaId,
  writeStoredVoicePersonaId,
} from "@/lib/voicePersonas";

type Props = {
  user: AuthUser;
  onUserUpdated: (u: AuthUser) => void;
  onMessage: (msg: string | null, err: string | null) => void;
};

const SPEED_OPTIONS: { id: TtsSpeedPreset; label: string }[] = [
  { id: "slow", label: "Slow" },
  { id: "natural", label: "Normal" },
  { id: "clear", label: "Crisp" },
  { id: "fast", label: "Fast" },
];

export function ProfileVoiceSettings({ user, onUserUpdated, onMessage }: Props) {
  const [persona, setPersona] = useState<"arjun" | "sara">(() =>
    normalizeVoicePersonaId(user.voice_persona_id),
  );
  const [speed, setSpeed] = useState<TtsSpeedPreset>(() => readTtsSpeedPreset());
  const [helloNeoGender, setHelloNeoGender] = useState<TtsVoiceGender>("female");
  const [helloNeoSpeed, setHelloNeoSpeed] = useState<TtsSpeedPreset>("natural");
  const [voiceCmdAudio, setVoiceCmdAudio] = useState<NeoVoiceCommandAudioFeedback>("silent");
  const [savingPersona, setSavingPersona] = useState(false);

  useEffect(() => {
    setHelloNeoGender(readHelloNeoTtsGender());
    setHelloNeoSpeed(readHelloNeoTtsSpeedPreset());
    setVoiceCmdAudio(readNeoVoiceCommandAudioFeedback());
  }, []);

  const applyPersona = useCallback(
    async (id: "arjun" | "sara") => {
      const pid = normalizeVoicePersonaId(id);
      setSavingPersona(true);
      onMessage(null, null);
      const p = getVoicePersona(pid);
      writeStoredVoicePersonaId(pid);
      writeTtsGender(p.ttsGender);
      setPersona(pid);
      const token = getStoredToken();
      if (token) {
        try {
          const u = await patchVoicePersona(pid);
          saveSession(token, u);
          onUserUpdated(u);
          onMessage("Voice assistant updated. It will use this persona next time you talk.", null);
        } catch (e) {
          onMessage(
            null,
            e instanceof Error ? e.message : "Could not sync voice to your account (saved on this device).",
          );
        }
      } else {
        onMessage("Saved on this device. Sign in to sync across devices.", null);
      }
      setSavingPersona(false);
    },
    [onMessage, onUserUpdated],
  );

  const applySpeed = useCallback(
    (p: TtsSpeedPreset) => {
      writeTtsSpeedPreset(p);
      setSpeed(p);
      onMessage("Voice chat speed saved (Hello Neo has its own below).", null);
    },
    [onMessage],
  );

  const applyHelloNeoGender = useCallback(
    (g: TtsVoiceGender) => {
      writeHelloNeoTtsGender(g);
      setHelloNeoGender(g);
      onMessage("Hello Neo voice saved (separate from voice chat).", null);
    },
    [onMessage],
  );

  const applyHelloNeoSpeed = useCallback(
    (p: TtsSpeedPreset) => {
      writeHelloNeoTtsSpeedPreset(p);
      setHelloNeoSpeed(p);
      onMessage("Hello Neo command speed saved.", null);
    },
    [onMessage],
  );

  const applyVoiceCmdAudio = useCallback(
    (m: NeoVoiceCommandAudioFeedback) => {
      writeNeoVoiceCommandAudioFeedback(m);
      setVoiceCmdAudio(m);
      onMessage(
        m === "silent"
          ? "Try Neo: mic on/off stays quiet; replies still speak when needed."
          : "Try Neo: short tap greeting and “one moment” cues are on.",
        null,
      );
    },
    [onMessage],
  );

  const segOn = "bg-emerald-100 text-emerald-950 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.45)]";
  const segOff = "text-black/55 hover:bg-slate-100 hover:text-black";

  return (
    <section className="neo-screen-card overflow-hidden rounded-[22px]">
      <div className="border-b border-slate-200/90 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-black">Voice settings</h2>
        <p className="mt-0.5 text-xs text-black/70">
          Voice chat and Hello Neo use <span className="font-medium text-black">separate</span> speaking speeds below.
          Tone weight (warm / bright) was removed so replies stay calm and consistent — no extra “mic” or toy sounds from
          those controls.
        </p>
      </div>
      <div className="space-y-6 px-5 py-5">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-black">
            Assistant voice (woman / man)
          </p>
          <div className="flex max-w-md rounded-xl border border-slate-200 bg-slate-100 p-0.5">
            <button
              type="button"
              disabled={savingPersona}
              onClick={() => void applyPersona("sara")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                persona === "sara" ? segOn : segOff
              }`}
            >
              Woman (Sara)
            </button>
            <button
              type="button"
              disabled={savingPersona}
              onClick={() => void applyPersona("arjun")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                persona === "arjun" ? segOn : segOff
              }`}
            >
              Man (Arjun)
            </button>
          </div>
          <p className="mt-2 text-[11px] text-black/65">
            When you pick Woman, the assistant keeps using a woman voice until you change it.
          </p>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-black">
            Voice chat — speaking speed
          </p>
          <div className="flex max-w-md flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-0.5">
            {SPEED_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => applySpeed(o.id)}
                className={`min-w-[5.5rem] flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide sm:text-[13px] ${
                  speed === o.id ? segOn : segOff
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-emerald-200/90 bg-emerald-50/40 p-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-900">
              Hello Neo commands (top bar)
            </p>
            <p className="text-[11px] text-black/70">
              Wake replies, time, open apps — <span className="font-medium text-black">separate</span> speed from voice chat.
            </p>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-black">Voice (man / woman)</p>
            <div className="flex max-w-md rounded-xl border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => applyHelloNeoGender("female")}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  helloNeoGender === "female" ? segOn : segOff
                }`}
              >
                Woman
              </button>
              <button
                type="button"
                onClick={() => applyHelloNeoGender("male")}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  helloNeoGender === "male" ? segOn : segOff
                }`}
              >
                Man
              </button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-black">Speaking speed</p>
            <div className="flex max-w-md flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-0.5">
              {SPEED_OPTIONS.map((o) => (
                <button
                  key={`neo-${o.id}`}
                  type="button"
                  onClick={() => applyHelloNeoSpeed(o.id)}
                  className={`min-w-[5.5rem] flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide sm:text-[13px] ${
                    helloNeoSpeed === o.id ? segOn : segOff
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-black">Voice command audio</p>
            <p className="mb-2 text-[11px] text-black/65">
              Try Neo tap-to-talk: default is quiet mic on/off. Replies (e.g. “Opening WhatsApp”) still play unless the
              command has nothing to say.
            </p>
            <div className="flex max-w-md rounded-xl border border-slate-200 bg-white p-0.5">
              <button
                type="button"
                onClick={() => applyVoiceCmdAudio("silent")}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  voiceCmdAudio === "silent" ? segOn : segOff
                }`}
              >
                Quiet
              </button>
              <button
                type="button"
                onClick={() => applyVoiceCmdAudio("spoken")}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${
                  voiceCmdAudio === "spoken" ? segOn : segOff
                }`}
              >
                Spoken cues
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200/80 pt-4">
          <Link
            href="/voice-personas"
            className="flex w-full items-center justify-center rounded-xl border border-emerald-600 bg-emerald-50 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
          >
            Voice appearance
          </Link>
        </div>
      </div>
    </section>
  );
}
