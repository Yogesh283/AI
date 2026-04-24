"use client";

import { useEffect, useState } from "react";
import { isNativeCapacitor } from "@/lib/nativeAppLinks";
import {
  readNeoAlexaListen,
  readNeoAssistantActive,
  writeNeoAlexaListen,
  writeNeoAssistantActive,
} from "@/lib/neoAssistantActive";
import {
  persistWakeScreenOffNative,
  readWakeListenScreenOffStorage,
  subscribeNeoWakeScreenOffListen,
} from "@/lib/neoWakeNative";

export function ProfileNeoAssistantToggle() {
  const [active, setActive] = useState(false);
  const [alexaListen, setAlexaListen] = useState(false);
  const [wakeScreenOff, setWakeScreenOff] = useState(false);

  useEffect(() => {
    setActive(readNeoAssistantActive());
    setAlexaListen(readNeoAlexaListen());
    setWakeScreenOff(readWakeListenScreenOffStorage());
    return subscribeNeoWakeScreenOffListen(() => {
      setWakeScreenOff(readWakeListenScreenOffStorage());
    });
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
    <section className="neo-screen-card overflow-hidden rounded-[22px]">
      <div className="border-b border-slate-200/90 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-black">Neo assistant</h2>
        <p className="mt-0.5 text-xs text-black/70">
          Starts <span className="font-medium text-black">Inactive</span> — turn Status to Active when you want voice
          commands. Wake with <span className="font-medium text-black">Neo</span>,{" "}
          <span className="font-medium text-black">Hello Neo</span>, or
          <span className="font-medium text-black"> Hello New</span> (speech often writes it that way) — then e.g.
          &quot;open my WhatsApp&quot;, &quot;my Telegram&quot;, or a phone number to call. In the browser, keep this tab
          open; in the Android app, Hello Neo wake can run in the background while the app stays open (optional
          lock-screen listen below). Fully closed app or killed process: wake does not run.
        </p>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-black">Status</p>
          <p className="mt-0.5 text-[11px] text-black/65">
            Inactive: the top bar stays quiet (no wake, no mic). Works only while this app is open — not when the app
            is closed.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              active ? "text-emerald-700" : "text-black/40"
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
              active ? "bg-emerald-500/40 ring-1 ring-emerald-500/50" : "bg-slate-200 ring-1 ring-slate-300"
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

      <div className="border-t border-slate-200/80 px-5 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
        {active && alexaListen ? (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-black/80">
                Neo is ready — say <span className="font-semibold text-black">Hello Neo</span> first, then your command.
                Voice chat turns this off automatically.
              </p>
              <button
                type="button"
                onClick={toggleAlexa}
                className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-700 transition hover:bg-red-100"
              >
                Turn off
              </button>
            </div>
            {isNativeCapacitor() ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-black">Listen when screen is off</p>
                  <p className="mt-0.5 text-[11px] text-black/65">
                    Uses a foreground notification and partial wake lock — higher battery use; turn off if you get pocket
                    noise.
                  </p>
                </div>
                <div className="mt-3 flex shrink-0 items-center justify-end gap-3 sm:mt-0">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      wakeScreenOff ? "text-emerald-700" : "text-black/40"
                    }`}
                  >
                    {wakeScreenOff ? "On" : "Off"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={wakeScreenOff}
                    onClick={() => void persistWakeScreenOffNative(!wakeScreenOff)}
                    className={`relative h-9 w-[52px] shrink-0 rounded-full transition ${
                      wakeScreenOff
                        ? "bg-emerald-500/40 ring-1 ring-emerald-500/50"
                        : "bg-slate-200 ring-1 ring-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition ${
                        wakeScreenOff ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className={`min-w-0 ${!active ? "opacity-45" : ""}`}>
              <p className="text-sm font-medium text-black">Hello Neo wake listen</p>
              <p className="mt-0.5 text-[11px] text-black/65">
                {isNativeCapacitor() ? (
                  <>
                    With wake on, the Android app keeps a native listener while you use other screens in the app. Open{" "}
                    <span className="font-medium text-black">Try Neo</span> below for tap-to-talk. Speech without{" "}
                    <span className="font-medium text-black">Hello Neo</span> /{" "}
                    <span className="font-medium text-black">Neo</span> is ignored.
                  </>
                ) : (
                  <>
                    Mic stays on only on <span className="font-medium text-black">Profile</span> (Try Neo below) to catch{" "}
                    <span className="font-medium text-black">Hello Neo</span> / <span className="font-medium text-black">Neo</span>, then
                    runs your command (music, WhatsApp, Telegram, YouTube, contacts, time). Speech without the wake phrase
                    is ignored — not “always command” mode.
                  </>
                )}
                {!active ? " Turn Neo assistant Active above to enable this." : ""}
              </p>
            </div>
            <div className="mt-3 flex shrink-0 items-center justify-between gap-3 sm:mt-0 sm:justify-end">
              <span
                className={`text-xs font-semibold uppercase tracking-wider ${
                  alexaListen && active ? "text-emerald-700" : "text-black/40"
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
                    ? "bg-emerald-500/40 ring-1 ring-emerald-500/50"
                    : "bg-slate-200 ring-1 ring-slate-300"
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
