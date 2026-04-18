"use client";

import { useEffect, useState } from "react";
import {
  readNeoAlexaListen,
  readNeoAssistantActive,
  writeNeoAlexaListen,
  writeNeoAssistantActive,
} from "@/lib/neoAssistantActive";

export function ProfileNeoAssistantToggle() {
  const [active, setActive] = useState(false);
  const [alexaListen, setAlexaListen] = useState(false);

  useEffect(() => {
    setActive(readNeoAssistantActive());
    setAlexaListen(readNeoAlexaListen());
  }, []);

  const toggle = () => {
    const next = !active;
    setActive(next);
    writeNeoAssistantActive(next);
  };

  const toggleAlexa = () => {
    if (!active) return;
    const next = !alexaListen;
    setAlexaListen(next);
    writeNeoAlexaListen(next);
  };

  return (
    <section className="neo-glass overflow-hidden rounded-[22px] ring-1 ring-white/[0.06]">
      <div className="border-b border-white/[0.07] px-5 py-3.5">
        <h2 className="text-sm font-semibold text-white/90">Neo assistant</h2>
        <p className="mt-0.5 text-xs text-white/40">
          Starts <span className="text-white/50">Inactive</span> — turn Status to Active when you want voice commands.
          Wake with <span className="text-white/55">Neo</span>, <span className="text-white/55">Hello Neo</span>, or
          <span className="text-white/55"> Hello New</span> (speech often writes it that way) — then e.g. &quot;open my
          WhatsApp&quot;, &quot;my Telegram&quot;, or a phone number to call. This screen must be on and this app open;
          screen-off / app-killed wake needs a separate native Android build, not this web app.
        </p>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/85">Status</p>
          <p className="mt-0.5 text-[11px] text-white/38">
            Inactive: the top bar stays quiet (no wake, no mic). Works only while this app is open — not when the app
            is closed.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              active ? "text-emerald-400/95" : "text-white/35"
            }`}
          >
            {active ? "Active" : "Inactive"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={active}
            onClick={toggle}
            className={`relative h-9 w-[52px] shrink-0 rounded-full transition ${
              active ? "bg-emerald-500/35 ring-1 ring-emerald-400/40" : "bg-white/[0.08] ring-1 ring-white/10"
            }`}
          >
            <span
              className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition ${
                active ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="border-t border-white/[0.06] px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        {active && alexaListen ? (
          <div className="flex w-full items-center justify-between gap-3">
            <p className="text-[12px] text-emerald-300/90">
              Wake listen is on — say Hello Neo first, then your command. Voice chat turns this off automatically.
            </p>
            <button
              type="button"
              onClick={toggleAlexa}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-white/80 transition hover:bg-white/[0.06]"
            >
              Turn off
            </button>
          </div>
        ) : (
          <>
            <div className={`min-w-0 ${!active ? "opacity-45" : ""}`}>
              <p className="text-sm font-medium text-white/85">Hello Neo wake listen</p>
              <p className="mt-0.5 text-[11px] text-white/38">
                Mic stays on only on <span className="text-white/50">Profile</span> (Try Neo below) to catch{" "}
                <span className="text-white/55">Hello Neo</span> / <span className="text-white/55">Neo</span>, then runs
                your command (music, WhatsApp, Telegram, YouTube, contacts, time). Speech without the wake phrase is
                ignored — not “always command” mode.
                {!active ? " Turn Neo assistant Active above to enable this." : ""}
              </p>
            </div>
            <div className="mt-3 flex shrink-0 items-center justify-between gap-3 sm:mt-0 sm:justify-end">
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  alexaListen && active ? "text-emerald-400/95" : "text-white/35"
                }`}
              >
                {alexaListen && active ? "On" : "Off"}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={alexaListen && active}
                disabled={!active}
                onClick={toggleAlexa}
                className={`relative h-9 w-[52px] shrink-0 rounded-full transition ${
                  alexaListen && active
                    ? "bg-emerald-500/35 ring-1 ring-emerald-400/40"
                    : "bg-white/[0.08] ring-1 ring-white/10"
                } ${!active ? "cursor-not-allowed opacity-50" : ""}`}
              >
                <span
                  className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition ${
                    alexaListen && active ? "left-6" : "left-1"
                  }`}
                />
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
