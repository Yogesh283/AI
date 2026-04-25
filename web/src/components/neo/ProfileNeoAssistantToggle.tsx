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
import { unlockWebAudioAndSpeechFromUserGesture } from "@/lib/voiceChat";

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
    if (next) unlockWebAudioAndSpeechFromUserGesture();
  };

  const toggleAlexa = () => {
    if (!active) return;
    const next = !alexaListen;
    setAlexaListen(next);
    writeNeoAlexaListen(next);
    if (next) unlockWebAudioAndSpeechFromUserGesture();
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

      <div className="flex flex-col gap-4 border-t border-slate-200/80 px-5 py-4">
        <div className={`min-w-0 ${!active ? "opacity-45" : ""}`}>
          <p className="text-sm font-medium text-black">Hello Neo wake listen</p>
          <p className="mt-0.5 text-[11px] text-black/65">
            {isNativeCapacitor() ? (
              <>
                With wake on, the Android app keeps a native listener while you use other screens. Open{" "}
                <span className="font-medium text-black">Try Neo</span> for tap-to-talk. Say{" "}
                <span className="font-medium text-black">Hello Neo</span> or <span className="font-medium text-black">Neo</span>{" "}
                first, then your command. Voice chat may turn this off while you are in a call.
              </>
            ) : (
              <>
                In the browser, the microphone runs only while you use <span className="font-medium text-black">Try Neo</span>{" "}
                tap-to-talk — say <span className="font-medium text-black">Hello Neo</span> or{" "}
                <span className="font-medium text-black">Neo</span> in that clip, then your command. This toggle applies to the{" "}
                <span className="font-medium text-black">Android app</span> background listener when you install the APK.
              </>
            )}
            {!active ? " Turn Neo assistant Active above to enable this." : ""}
          </p>
          {active && alexaListen && isNativeCapacitor() ? (
            <p className="mt-2 text-[11px] font-medium text-emerald-800/90">
              Ready — say <span className="text-black">Hello Neo</span> first, then e.g. open WhatsApp.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
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

        {isNativeCapacitor() && active && alexaListen ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-black">Listen when screen is off</p>
              <p className="mt-0.5 text-[11px] text-black/65">
                Foreground notification + wake lock — more battery; turn off if you get pocket noise.
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
    </section>
  );
}
