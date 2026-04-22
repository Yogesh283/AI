"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import {
  IconChat,
  IconHome,
  IconPersonalAssistantDock,
  IconUser,
} from "@/components/neo/NeoIcons";

function IconBooks({ active }: { active?: boolean }) {
  return (
    <BookOpen
      size={18}
      strokeWidth={2}
      className={active ? "text-[#7FDFFF]" : "text-[#A7B0D6]/80"}
      aria-hidden
    />
  );
}

type DockItem =
  | {
      href: string;
      label: string;
      Icon: React.ComponentType<{ active?: boolean }>;
      variant: "normal";
    }
  | {
      href: string;
      title: string;
      sub: string;
      Icon: React.ComponentType<{ active?: boolean }>;
      variant: "center";
    };

const ITEMS: DockItem[] = [
  { href: "/dashboard", label: "Home", Icon: IconHome, variant: "normal" },
  { href: "/chat", label: "Chat", Icon: IconChat, variant: "normal" },
  {
    href: "/voice",
    title: "Assistant",
    sub: "AI Voice",
    Icon: IconPersonalAssistantDock,
    variant: "center",
  },
  {
    href: "/customize",
    label: "Books",
    Icon: IconBooks,
    variant: "normal",
  },
  { href: "/profile", label: "Profile", Icon: IconUser, variant: "normal" },
];

function pathActive(path: string | null, href: string) {
  if (!path) return false;
  if (href === "/dashboard") return path === "/dashboard";
  return path === href || path.startsWith(`${href}/`);
}

export function NeoBottomDock() {
  const path = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(0.2rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="mx-auto w-[min(96vw,52rem)]">
        <div className="relative overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(7,16,36,0.96),rgba(4,10,24,0.98))] shadow-[0_-10px_34px_rgba(0,0,0,0.46),inset_0_1px_0_rgba(255,255,255,0.07)] backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#3B82F6]/60 to-transparent" />
          <div className="pointer-events-none absolute -top-11 left-1/2 h-24 w-44 -translate-x-1/2 rounded-full bg-[#00D4FF]/12 blur-3xl" />

          <div className="grid h-[70px] grid-cols-5 items-stretch gap-1 px-1">
            {ITEMS.map((item) => {
              const active = pathActive(path, item.href);
              const Icon = item.Icon;

              if (item.variant === "center") {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={item.title}
                    className={`group relative flex min-w-0 flex-col items-center justify-end px-1 pb-0.5 pt-1 transition-all duration-300 hover:-translate-y-0.5 ${
                      active ? "-translate-y-1" : ""
                    }`}
                  >
                    <span className="pointer-events-none absolute -top-6 rounded-md border border-white/15 bg-[#081a37]/90 px-2 py-0.5 text-[10px] font-medium text-white/90 opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
                      {item.title}
                    </span>
                    <span
                      className={`relative flex flex-col items-center border px-2 py-1 transition-all duration-300 ${
                        active
                          ? "border-[#3B82F6]/45 bg-gradient-to-br from-[#00D4FF]/18 via-[#3B82F6]/14 to-[#6A5CFF]/18 shadow-[0_0_30px_rgba(59,130,246,0.28)]"
                          : "border-white/5 bg-white/[0.03]"
                      }`}
                    >
                      <Icon active={active} />
                    </span>

                    <span className="mt-0.5 max-w-[4.8rem] truncate text-center text-[7.4px] font-semibold leading-tight text-white/95">
                      {item.title}
                    </span>
                    <span className="max-w-[4.8rem] truncate text-center text-[6.5px] font-medium leading-tight text-white/60">
                      {item.sub}
                    </span>

                    {active && (
                      <span
                        aria-hidden
                        className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full bg-gradient-to-r from-[#00D4FF] via-[#3B82F6] to-[#6A5CFF] shadow-[0_0_14px_rgba(59,130,246,0.68)]"
                      />
                    )}
                  </Link>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className={`group relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 py-1 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] ${
                    active ? "text-[#79D8FF]" : "text-[#A7B0D6]/75"
                  }`}
                >
                  <Icon active={active} />

                  <span
                    title={item.label}
                    className={`max-w-[4.6rem] truncate text-center text-[8px] font-semibold tracking-tight leading-tight transition-colors ${
                      active ? "text-white" : "text-white/72 group-hover:text-white/90"
                    }`}
                  >
                    {item.label}
                  </span>

                  {active && (
                    <span
                      aria-hidden
                      className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#00D4FF] shadow-[0_0_12px_rgba(0,212,255,0.9)]"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
