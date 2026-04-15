"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DASHBOARD } from "@/shared/neoContent";
import { GradientButton } from "@/components/neo/GradientButton";
import { getStoredUser } from "@/lib/auth";

function statColorClass(t: "cyan" | "magenta" | "purple") {
  if (t === "cyan") return "text-[#00D4FF]";
  if (t === "magenta") return "text-[#BD00FF]";
  return "text-[#9D50BB]";
}

const workspaceCards = [
  {
    title: "Assistant Chat",
    desc: "Daily Q&A, planning, and project support.",
    icon: "💬",
    href: "/chat",
  },
  {
    title: "Voice Session",
    desc: "Hands-free conversation with your assistant.",
    icon: "🎙",
    href: "/voice",
  },
  {
    title: "Tools Studio",
    desc: "Writer, code helper, and generation tools.",
    icon: "⚡",
    href: "/tools",
  },
] as const;

const connectionCards = [
  {
    title: "Memory Timeline",
    desc: "Review saved chat and voice history.",
    href: "/memory",
  },
  {
    title: "Profile & Security",
    desc: "Manage identity, password, and account settings.",
    href: "/profile",
  },
  {
    title: "Voice Persona",
    desc: "Select assistant face and speaking persona.",
    href: "/voice-personas",
  },
] as const;

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
      <header className="mb-6">
        <div className="neo-glass rounded-[24px] border border-white/[0.08] p-5 ring-1 ring-white/[0.06]">
          <p className="text-sm text-white/45">Hello,</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-white">
            {name} <span className="inline-block">👋</span>
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60">{DASHBOARD.greetingLine}</p>
        </div>
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
            className="neo-glass rounded-[20px] border border-white/[0.08] px-2 py-4 text-center ring-1 ring-white/[0.05]"
          >
            <p className={`text-2xl font-bold ${statColorClass(x.tone)}`}>{x.n}</p>
            <p className="text-xs font-medium text-white/45">{x.l}</p>
          </div>
        ))}
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Project workspace
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {workspaceCards.map((t) => (
            <Link
              key={t.title + t.href}
              href={t.href}
              className="neo-glass flex min-h-[94px] flex-col justify-center rounded-[22px] border border-white/[0.08] px-4 py-3 ring-1 ring-white/[0.05] transition hover:brightness-110"
            >
              <p className="text-base">{t.icon}</p>
              <p className="mt-1 font-semibold text-white">{t.title}</p>
              <p className="text-xs text-white/45">{t.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Connected sections
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {connectionCards.map((t) => (
            <Link
              key={t.title}
              href={t.href}
              className="neo-glass flex min-h-[84px] flex-col justify-center rounded-[20px] border border-white/[0.08] px-4 py-3 ring-1 ring-white/[0.05] transition hover:border-[#00D4FF]/30"
            >
              <p className="text-sm font-semibold text-white/90">{t.title}</p>
              <p className="mt-0.5 text-xs text-white/50">{t.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Project focus
        </h2>
        <div className="neo-glass rounded-[24px] border border-white/[0.08] p-5 text-sm text-white/65 ring-1 ring-white/[0.05]">
          <p className="leading-relaxed">
            Start from Chat for planning, continue in Voice for fast interaction, and use Tools for writing or code tasks.
            All your key flows stay connected through Memory and Profile sections.
          </p>
        </div>
        <div className="mt-6">
          <GradientButton href="/chat">Open Assistant</GradientButton>
        </div>
      </section>
      </div>
    </div>
  );
}
