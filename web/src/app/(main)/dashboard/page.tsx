"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DASHBOARD, REF_TASKS } from "@/shared/neoContent";
import { NeoLogoHead } from "@/components/neo/NeoLogoHead";
import { GradientButton } from "@/components/neo/GradientButton";
import { IconBell } from "@/components/neo/NeoIcons";
import { getStoredUser } from "@/lib/auth";

function statColorClass(t: "cyan" | "magenta" | "purple") {
  if (t === "cyan") return "text-[#00D4FF]";
  if (t === "magenta") return "text-[#BD00FF]";
  return "text-[#9D50BB]";
}

function memoryBulletClass(t: "cyan" | "magenta" | "purple") {
  if (t === "cyan") return "text-[#00D4FF]";
  if (t === "magenta") return "text-[#BD00FF]";
  return "text-[#9D50BB]";
}

export default function DashboardPage() {
  const [name, setName] = useState("there");

  useEffect(() => {
    const u = getStoredUser();
    if (u?.display_name) {
      // localStorage is unavailable during SSR; sync display name after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-hydration read
      setName(u.display_name.split(" ")[0] || u.display_name);
    }
  }, []);

  return (
    <div className="relative z-[1] px-4 pb-10 pt-6 md:px-8 md:pt-8">
      <div className="mx-auto max-w-3xl">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <p className="text-sm text-white/45">Hello,</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">
            {name} <span className="inline-block">👋</span>
          </h1>
          <p className="mt-1 text-sm text-[#00D4FF]/80">{DASHBOARD.greetingLine}</p>
        </div>
        <button
          type="button"
          className="neo-glass neo-glow flex h-12 w-12 items-center justify-center rounded-2xl"
          aria-label="Notifications"
        >
          <IconBell />
        </button>
      </header>

      <section className="mb-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">
          {DASHBOARD.overviewTitle}
        </h2>
      </section>
      <section className="mb-8 grid grid-cols-3 gap-3">
        {DASHBOARD.stats.map((x) => (
          <div
            key={x.l}
            className="neo-glass rounded-[20px] px-2 py-4 text-center ring-1 ring-white/[0.06]"
          >
            <p className={`text-2xl font-bold ${statColorClass(x.tone)}`}>{x.n}</p>
            <p className="text-[11px] font-medium text-white/40">{x.l}</p>
          </div>
        ))}
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          {DASHBOARD.quickTasksTitle}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {REF_TASKS.map((t) => (
            <Link
              key={t.label}
              href={t.webHref}
              className="neo-glass flex min-h-[88px] flex-col justify-center rounded-[22px] px-4 py-3 ring-1 ring-white/[0.06] transition hover:brightness-110"
            >
              <p className="font-semibold text-white">{t.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Voice &amp; sound
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/voice"
            className="neo-glass flex min-h-[76px] flex-col justify-center rounded-[22px] border border-[#00D4FF]/15 bg-[#00D4FF]/[0.06] px-4 py-3 ring-1 ring-[#00D4FF]/10 transition hover:border-[#00D4FF]/35"
          >
            <p className="text-lg">🎙</p>
            <p className="mt-1 font-semibold text-white">Voice chat</p>
            <p className="text-[11px] text-white/45">Talk with your assistant</p>
          </Link>
          <Link
            href="/voice-personas"
            className="neo-glass flex min-h-[76px] flex-col justify-center rounded-[22px] border border-[#BD00FF]/15 bg-[#BD00FF]/[0.06] px-4 py-3 ring-1 ring-[#BD00FF]/10 transition hover:border-[#BD00FF]/35"
          >
            <p className="text-lg">🎭</p>
            <p className="mt-1 font-semibold text-white">Voice &amp; face</p>
            <p className="text-[11px] text-white/45">Speaker + avatar motion</p>
          </Link>
        </div>
      </section>

      <section className="mb-6 flex justify-center">
        <NeoLogoHead className="h-28 w-24 opacity-95 drop-shadow-[0_0_24px_rgba(0,212,255,0.35)]" />
      </section>

      <section className="mb-8 grid grid-cols-2 gap-4">
        {DASHBOARD.mainTiles.map((t) => (
          <Link
            key={t.label + t.webHref}
            href={t.webHref}
            className="neo-glass neo-glow flex min-h-[128px] flex-col justify-between rounded-[26px] p-5 ring-1 ring-white/[0.07] transition hover:brightness-110"
          >
            <span className="text-3xl drop-shadow-[0_0_12px_rgba(0,212,255,0.35)]">
              {t.icon}
            </span>
            <div>
              <p className="font-semibold text-white">{t.label}</p>
              <p className="text-xs text-white/40">{t.sub}</p>
            </div>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-white/40">
          Quick Actions
        </h2>
        <div className="grid grid-cols-4 gap-3">
          {DASHBOARD.quickActions.map((q) => (
            <Link
              key={q.label}
              href={q.webHref}
              className="flex flex-col items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] py-4 text-xl ring-1 ring-white/[0.04] transition hover:border-[#00D4FF]/30"
            >
              {q.icon}
              <span className="text-center text-[10px] font-medium text-white/50">
                {q.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          {DASHBOARD.memoryTitle}
        </h2>
        <div className="neo-glass space-y-3 rounded-[24px] p-5 text-sm text-white/65 ring-1 ring-white/[0.06]">
          {DASHBOARD.memoryLines.map((line) => (
            <p key={line.text} className="flex items-center gap-2">
              <span className={memoryBulletClass(line.tone)}>▸</span> {line.text}
            </p>
          ))}
        </div>
        <div className="mt-6">
          <GradientButton href="/chat">{DASHBOARD.openChat}</GradientButton>
        </div>
      </section>
      </div>
    </div>
  );
}
