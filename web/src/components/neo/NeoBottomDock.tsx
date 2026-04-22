"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChat,
  IconHome,
  IconImageGraphics,
  IconPersonalAssistantDock,
  IconUser,
} from "@/components/neo/NeoIcons";

type DockItem =
  | {
      href: string;
      label: string;
      Icon: typeof IconHome;
      variant: "normal";
    }
  | {
      href: string;
      title: string;
      sub: string;
      Icon: typeof IconPersonalAssistantDock;
      variant: "center";
    };

const ITEMS: DockItem[] = [
  { href: "/dashboard", label: "Home", Icon: IconHome, variant: "normal" },
  { href: "/chat", label: "Chat", Icon: IconChat, variant: "normal" },
  {
    href: "/voice",
    title: "Personal Assistant",
    sub: "AI + Voice",
    Icon: IconPersonalAssistantDock,
    variant: "center",
  },
  { href: "/avatars", label: "Image & Graphics", Icon: IconImageGraphics, variant: "normal" },
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
      className="neo-bottom-dock fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-1 md:hidden"
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-end justify-between gap-0.5 rounded-[1.65rem] border border-white/[0.12] bg-[rgba(6,10,18,0.78)] px-1 py-2 shadow-[0_-8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
        {ITEMS.map((item) => {
          if (item.variant === "center") {
            const active = pathActive(path, item.href);
            const Icon = item.Icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex min-w-0 flex-[1.15] flex-col items-center justify-end gap-0.5 px-1 pb-2 pt-3 transition ${
                  active ? "-translate-y-1" : ""
                }`}
              >
                <span
                  className={`relative flex flex-col items-center rounded-2xl border px-2 py-2 transition ${
                    active
                      ? "border-[#00D2FF]/35 bg-gradient-to-br from-[#00D2FF]/20 to-[#9D50BB]/15 shadow-[0_0_28px_rgba(0,210,255,0.25)]"
                      : "border-transparent bg-white/[0.04]"
                  }`}
                >
                  <Icon active={active} />
                </span>
                <span className="max-w-[5.25rem] text-center text-[9px] font-semibold leading-tight text-white/92">
                  {item.title}
                </span>
                <span className="max-w-[5.25rem] text-center text-[8px] font-medium leading-tight text-white/48">
                  {item.sub}
                </span>
                {active ? (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full bg-gradient-to-r from-[#00D2FF] via-[#00D2FF]/90 to-[#9D50BB]"
                    aria-hidden
                  />
                ) : null}
              </Link>
            );
          }

          const active = pathActive(path, item.href);
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 px-1 py-1.5 transition active:opacity-90 ${
                active ? "text-[#00D2FF]" : "text-white/42"
              }`}
            >
              <Icon active={active} />
              <span
                className={`max-w-[4.25rem] truncate text-center text-[10px] font-semibold tracking-tight ${
                  active ? "text-white" : "text-white/52"
                }`}
              >
                {item.label}
              </span>
              {active ? (
                <span
                  className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[#00D2FF] shadow-[0_0_8px_rgba(0,210,255,0.85)]"
                  aria-hidden
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
