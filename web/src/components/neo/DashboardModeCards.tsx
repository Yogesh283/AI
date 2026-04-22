"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredUser } from "@/lib/auth";
import { getNeoAvatar, readStoredAvatarId } from "@/lib/avatars";
import { IconChat, IconCube3D, IconMemory, IconMicCenter, IconUser } from "@/components/neo/NeoIcons";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { shortDisplayNameForGreeting } from "@/lib/siteBranding";

function ChatBubbleThumb() {
  return (
    <>
      <span
        className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
        aria-hidden
      />
      <svg viewBox="0 0 72 72" className="h-full w-full p-2 text-[#00D4FF]" aria-hidden>
        <path
          fill="currentColor"
          fillOpacity={0.15}
          stroke="currentColor"
          strokeWidth={1.25}
          d="M18 22c0-3.3 2.7-6 6-6h24c3.3 0 6 2.7 6 6v18c0 3.3-2.7 6-6 6H28l-8 8v-8h-2c-3.3 0-6-2.7-6-6V22z"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          strokeOpacity={0.5}
          d="M28 28h16M28 34h10M28 40h14"
        />
      </svg>
    </>
  );
}

function Chevron() {
  return (
    <svg className="h-5 w-5 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#00D4FF]/85" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const quickLinks = [
  { href: "/memory", label: "Memory", Icon: IconMemory },
  { href: "/profile", label: "Profile", Icon: IconUser },
  { href: "/customize", label: "Customize", Icon: IconCube3D },
  { href: "/voice-personas", label: "Voice style", Icon: IconMicCenter },
] as const;

export function DashboardModeCards() {
  const { brandName } = useSiteBrand();
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [greetName, setGreetName] = useState<string | undefined>(undefined);

  useEffect(() => {
    setAvatarId(readStoredAvatarId());
    const u = getStoredUser();
    setGreetName(shortDisplayNameForGreeting(u?.display_name));
  }, []);

  const voiceThumb = getNeoAvatar(avatarId);
  const voiceThumbUnoptimized = voiceThumb.imageSrc.endsWith(".svg");

  const title = greetName ? `Your Intelligent AI Assistant, ${greetName}` : "Your Intelligent AI Assistant";

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-4 pb-12 pt-5 sm:px-6 md:px-10 md:pb-16 md:pt-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="neo-screen-card relative overflow-hidden rounded-[1.85rem] p-5 sm:p-8 md:p-10">
          <div
            className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#00D4FF]/[0.1] blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-[#6A5CFF]/[0.14] blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#6A5CFF]/40 to-transparent"
            aria-hidden
          />

          <div className="relative grid gap-6 md:grid-cols-[1.15fr_0.85fr] md:items-center">
            <header className="relative">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6dd5ff]">
                {brandName}
              </p>
              <h1 className="mt-3 bg-gradient-to-r from-white via-[#d8ecff] to-white/70 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                {title}
              </h1>
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-white/62">
                Chat, search, write, analyze and automate your everyday tasks in one place.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/chat?new=1"
                  className="neo-blue-button inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                >
                  Start Chatting
                </Link>
                <Link
                  href="/customize"
                  className="inline-flex rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/90 transition hover:bg-white/10"
                >
                  Explore Features
                </Link>
              </div>
            </header>
            <div className="relative flex items-center justify-center py-2">
              <div className="absolute h-52 w-52 rounded-full bg-[#1c7dff]/25 blur-3xl" aria-hidden />
              <div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-[#9ec4ff]/35 bg-[radial-gradient(circle_at_35%_30%,rgba(148,215,255,0.44),rgba(23,84,208,0.58)_55%,rgba(9,29,74,0.92)_100%)] shadow-[0_0_55px_rgba(35,136,255,0.45)]">
                <span className="absolute h-24 w-24 rounded-full border border-white/25" />
                <span className="absolute h-4 w-4 rounded-full bg-[#9ee6ff] shadow-[0_0_18px_rgba(158,230,255,0.95)]" />
              </div>
            </div>
          </div>

          <div className="relative mt-8 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Link
              href="/voice"
              className="neo-list-row group relative flex flex-col overflow-hidden rounded-xl p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#3B82F6]/45"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/[0.12] bg-black/50 shadow-inner">
                  <Image
                    src={voiceThumb.imageSrc}
                    alt=""
                    fill
                    className="object-cover object-center"
                    sizes="56px"
                    unoptimized={voiceThumbUnoptimized}
                  />
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00D4FF]/15 text-[#00D4FF] ring-1 ring-[#00D4FF]/28">
                  <IconMicCenter />
                </span>
              </div>
              <h2 className="text-base font-bold tracking-tight text-white">Voice Chat</h2>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-white/55">
                Talk naturally and get instant spoken responses.
              </p>
              <span className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#8dd6ff]">
                Open <Chevron />
              </span>
            </Link>

            <Link
              href="/chat"
              className="neo-list-row group relative flex flex-col overflow-hidden rounded-xl p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#3B82F6]/42"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#00D4FF]/22 bg-[#0a1018]">
                  <ChatBubbleThumb />
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/70 ring-1 ring-white/[0.1]">
                  <IconChat />
                </span>
              </div>
              <h2 className="text-base font-bold tracking-tight text-white">Smart Chat</h2>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-white/55">
                Get clean answers, drafts, ideas and planning help.
              </p>
              <span className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#8dd6ff]">
                Open <Chevron />
              </span>
            </Link>
            {quickLinks.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="neo-list-row group relative flex min-h-[148px] flex-col overflow-hidden rounded-xl p-4 transition duration-200 hover:-translate-y-0.5 hover:border-[#3B82F6]/42"
              >
                <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/80">
                  <Icon />
                </span>
                <h2 className="text-base font-bold tracking-tight text-white">{label}</h2>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-white/55">
                  Manage your {label.toLowerCase()} settings quickly.
                </p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
