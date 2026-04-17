"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getNeoAvatar, readStoredAvatarId } from "@/lib/avatars";

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

export function DashboardModeCards() {
  const [avatarId, setAvatarId] = useState<string | null>(null);
  useEffect(() => {
    setAvatarId(readStoredAvatarId());
  }, []);

  const voiceThumb = getNeoAvatar(avatarId);
  const voiceThumbUnoptimized = voiceThumb.imageSrc.endsWith(".svg");

  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-4 pb-8 pt-4 sm:px-6 md:px-10">
      <div className="mx-auto w-full max-w-lg">
        <nav className="mb-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:mb-10" aria-label="Primary">
          <Link
            href="/voice"
            className="inline-flex min-w-[140px] flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-[#00D4FF] to-[#0891b2] px-5 py-3 text-center text-sm font-bold text-[#050912] shadow-[0_4px_24px_rgba(0,212,255,0.35)] transition hover:brightness-105 sm:flex-initial sm:px-8 sm:py-3.5 sm:text-base"
          >
            Voice chat
          </Link>
          <Link
            href="/chat"
            className="inline-flex min-w-[140px] flex-1 items-center justify-center rounded-xl border border-[#00D4FF]/45 bg-[#0c121c] px-5 py-3 text-center text-sm font-bold text-white shadow-[0_0_20px_rgba(0,212,255,0.12)] transition hover:border-[#00D4FF]/70 hover:bg-[#101820] sm:flex-initial sm:px-8 sm:py-3.5 sm:text-base"
          >
            Open chat
          </Link>
        </nav>

        <header className="mb-6 text-center md:mb-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
            Home
          </p>
          <h1 className="mt-2 bg-gradient-to-r from-white via-white to-white/75 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl">
            Welcome
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-white/55 sm:text-[15px]">
            Use voice for hands-free talk, or chat to type — same assistant.
          </p>
        </header>

        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center sm:gap-6">
          <Link
            href="/voice"
            className="group flex flex-1 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition hover:border-[#00D4FF]/35 hover:bg-white/[0.05] sm:max-w-xs sm:flex-initial"
          >
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/[0.08] bg-black/40">
              <Image
                src={voiceThumb.imageSrc}
                alt=""
                fill
                className="object-cover object-center"
                sizes="48px"
                unoptimized={voiceThumbUnoptimized}
              />
            </div>
            <div className="min-w-0 text-left">
              <h2 className="text-sm font-semibold text-white/90">Neo Assistant</h2>
              <p className="text-[12px] text-white/45">Voice & mic</p>
            </div>
          </Link>

          <Link
            href="/chat"
            className="group flex flex-1 items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 transition hover:border-[#00D4FF]/35 hover:bg-white/[0.05] sm:max-w-xs sm:flex-initial"
          >
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#00D4FF]/25 bg-[#0c121a]">
              <ChatBubbleThumb />
            </div>
            <div className="min-w-0 text-left">
              <h2 className="text-sm font-semibold text-white/90">Neo Chat</h2>
              <p className="text-[12px] text-white/45">Type & send</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
