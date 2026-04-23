"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ImagePlus, MessageCircle, Sparkles, User } from "lucide-react";

const PRIMARY = "#2563EB";
const MUTED = "#94A3B8";

type Item =
  | {
      kind: "tab";
      href: string;
      label: string;
      /** Optional second line under icon (short labels for 8px grid) */
      labelLine2?: string;
      Icon: typeof Home;
      keySuffix?: string;
    }
  | {
      kind: "fab";
      href: string;
      title: string;
    };

/**
 * Bottom nav (mobile):
 * 1. Home → /dashboard
 * 2. Chat → /chat
 * 3. AI Assistant (center FAB) → /voice (voice chat)
 * 4. Image create → /create
 * 5. Profile → /profile
 */
const ITEMS: Item[] = [
  { kind: "tab", href: "/dashboard", label: "Home", Icon: Home },
  { kind: "tab", href: "/chat", label: "Chat", Icon: MessageCircle },
  { kind: "fab", href: "/voice", title: "AI Assistant — voice chat" },
  {
    kind: "tab",
    href: "/create",
    label: "Image",
    labelLine2: "Create",
    Icon: ImagePlus,
    keySuffix: "image-create",
  },
  { kind: "tab", href: "/profile", label: "Profile", Icon: User },
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
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="mx-auto w-[min(96vw,23rem)]">
        <div className="nm-dock-shell px-2 py-2">
          <div className="grid grid-cols-5 items-end gap-0.5 pt-1">
            {ITEMS.map((item, idx) => {
              const active = pathActive(path, item.href);

              if (item.kind === "fab") {
                return (
                  <Link
                    key="fab-ai-assistant"
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={item.title}
                    className="nm-dock-item group relative flex flex-col items-center justify-center"
                  >
                    <span
                      className={`nm-dock-fab relative z-[1] -mt-6 mb-0.5 flex h-[52px] w-[52px] items-center justify-center ${
                        active ? "ring-[3px] ring-[#2563EB]/25 ring-offset-[3px] ring-offset-white" : ""
                      }`}
                    >
                      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border-[2.5px] border-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                        <Sparkles className="h-[14px] w-[14px] text-white" strokeWidth={2.5} aria-hidden />
                      </span>
                    </span>
                    <span className="flex flex-col items-center gap-0">
                      <span
                        className={`text-center text-[8px] font-semibold leading-tight transition-colors duration-300 ease-out ${
                          active ? "text-[#2563EB]" : "text-[#94A3B8]"
                        }`}
                      >
                        AI
                      </span>
                      <span
                        className={`text-center text-[8px] font-semibold leading-tight transition-colors duration-300 ease-out ${
                          active ? "text-[#2563EB]" : "text-[#94A3B8]"
                        }`}
                      >
                        Voice
                      </span>
                    </span>
                  </Link>
                );
              }

              const Icon = item.Icon;
              const key =
                "keySuffix" in item && item.keySuffix ? item.keySuffix : `${item.href}-${idx}`;
              return (
                <Link
                  key={key}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={
                    item.labelLine2 ? `${item.label} ${item.labelLine2}` : item.label
                  }
                  className="nm-dock-item group flex min-h-[46px] flex-col items-center justify-end gap-0 pb-0.5 pt-0.5 transition-transform duration-300 ease-out active:scale-95"
                >
                  <Icon
                    className="h-[22px] w-[22px]"
                    strokeWidth={2}
                    color={active ? PRIMARY : MUTED}
                    aria-hidden
                  />
                  <span className="flex flex-col items-center leading-none">
                    <span
                      className={`max-w-[4rem] truncate text-center text-[8px] font-semibold transition-colors duration-300 ease-out ${
                        active ? "text-[#2563EB]" : "text-[#94A3B8]"
                      }`}
                    >
                      {item.label}
                    </span>
                    {"labelLine2" in item && item.labelLine2 ? (
                      <span
                        className={`max-w-[4rem] truncate text-center text-[8px] font-semibold transition-colors duration-300 ease-out ${
                          active ? "text-[#2563EB]" : "text-[#94A3B8]"
                        }`}
                      >
                        {item.labelLine2}
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
