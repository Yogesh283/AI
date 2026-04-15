"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import {
  IconChat,
  IconMemory,
  IconMicCenter,
  IconTools,
  IconUser,
} from "@/components/neo/NeoIcons";
import { NeoLogoMark } from "@/components/neo/NeoLogoHead";

const nav = [
  { href: "/chat", label: "Chat", kind: "chat" as const },
  { href: "/memory", label: "Memory", Icon: IconMemory },
  { href: "/voice", label: "Voice", kind: "voice" as const },
  { href: "/voice-personas", label: "Voice & face", kind: "personas" as const },
  { href: "/tools", label: "Tools", Icon: IconTools },
  { href: "/profile", label: "Profile", Icon: IconUser },
] as const;

export function AppSidebar() {
  const path = usePathname();
  const { brandName } = useSiteBrand();

  return (
    <aside className="relative z-[2] hidden w-[260px] shrink-0 flex-col border-r border-white/[0.08] bg-[#0a0d12]/95 backdrop-blur-xl md:flex">
      <div className="flex h-14 items-center border-b border-white/[0.06] px-4">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5"
        >
          <NeoLogoMark className="h-9 w-9 shrink-0 drop-shadow-[0_0_12px_rgba(0,212,255,0.2)]" />
          <span className="truncate bg-gradient-to-r from-[#00D4FF] to-[#BD00FF] bg-clip-text text-lg font-semibold tracking-tight text-transparent">
            {brandName}
          </span>
        </Link>
      </div>
      <div className="p-3">
        <Link
          href="/chat?new=1"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.06] py-2.5 text-sm font-medium text-white/90 transition hover:bg-white/[0.1]"
        >
          <span className="text-lg leading-none">+</span>
          New chat
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-4">
        {nav.map((item) => {
          const active =
            path === item.href || path?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-white/[0.08] text-[#00D4FF]"
                  : "text-white/55 hover:bg-white/[0.06] hover:text-white/90"
              }`}
            >
              {"kind" in item && item.kind === "chat" ? (
                <IconChat active={active} />
              ) : "kind" in item && item.kind === "voice" ? (
                <span
                  className={
                    active
                      ? "drop-shadow-[0_0_8px_rgba(0,212,255,0.45)]"
                      : "opacity-45"
                  }
                >
                  <IconMicCenter />
                </span>
              ) : "kind" in item && item.kind === "personas" ? (
                <span
                  className={
                    active
                      ? "text-[#00D4FF] drop-shadow-[0_0_6px_rgba(0,212,255,0.35)]"
                      : "text-white/45"
                  }
                >
                  <span className="text-base" aria-hidden>
                    🎭
                  </span>
                </span>
              ) : (
                <item.Icon active={active} />
              )}
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
