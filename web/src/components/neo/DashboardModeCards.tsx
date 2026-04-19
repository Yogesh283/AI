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
    <svg className="h-5 w-5 shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-[#00D4FF]/80" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const quickLinks = [
  { href: "/memory", label: "Memory", Icon: IconMemory },
  { href: "/profile", label: "Profile", Icon: IconUser },
  { href: "/customize", label: "Avatars", Icon: IconCube3D },
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

  const title = greetName ? `Welcome back, ${greetName}` : "You're in";

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-4 pb-10 pt-6 sm:px-6 md:px-10 md:pb-12 md:pt-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="relative overflow-hidden rounded-[1.75rem] border border-white/[0.12] bg-gradient-to-b from-white/[0.07] via-[#0c1018]/90 to-[#080b11] p-6 shadow-[0_0_0_1px_rgba(0,212,255,0.06),0_24px_80px_rgba(0,0,0,0.45)] sm:p-8 md:p-10">
          <div
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#00D4FF]/[0.07] blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[#7c3aed]/[0.08] blur-3xl"
            aria-hidden
          />

          <header className="relative text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00D4FF]/70">
              {brandName} · Home
            </p>
            <h1 className="mt-3 bg-gradient-to-r from-white via-[#e8fbff] to-white/70 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl md:text-[2rem]">
              {title}
            </h1>
            <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-white/55 sm:text-[15px]">
              Voice, chat, memory — ek hi assistant, sab connected. Neeche se mode chuno ya quick links use karo.
            </p>
            <p className="mx-auto mt-2 max-w-lg text-[12px] leading-relaxed text-white/38">
              Same account everywhere: browser ya app — settings & memory sync.
            </p>
          </header>

          <div className="relative mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5">
            <Link
              href="/voice"
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-br from-[#00D4FF]/[0.12] to-transparent p-5 transition hover:border-[#00D4FF]/40 hover:shadow-[0_0_40px_rgba(0,212,255,0.12)] sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
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
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00D4FF]/15 text-[#00D4FF] ring-1 ring-[#00D4FF]/25">
                  <IconMicCenter />
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-white">Voice chat</h2>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-white/50">
                Hands-free — mic se bolo, 3D assistant jawab degi.
              </p>
              <span className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#7eeafb]">
                Start session <Chevron />
              </span>
            </Link>

            <Link
              href="/chat"
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-br from-white/[0.05] to-transparent p-5 transition hover:border-[#00D4FF]/35 hover:bg-white/[0.04] sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#00D4FF]/20 bg-[#0a1018]">
                  <ChatBubbleThumb />
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/70 ring-1 ring-white/[0.1]">
                  <IconChat />
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-white">Open chat</h2>
              <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-white/50">
                Type karo — lambi threads, code, aur detail ke liye best.
              </p>
              <span className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-[#00D4FF]/90">
                Open thread <Chevron />
              </span>
            </Link>
          </div>

          <div className="relative mt-8 border-t border-white/[0.08] pt-6">
            <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
              Quick connect
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-2.5">
              {quickLinks.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-black/25 px-3.5 py-2 text-[12px] font-medium text-white/75 transition hover:border-[#00D4FF]/35 hover:bg-white/[0.06] hover:text-white"
                >
                  <Icon />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
