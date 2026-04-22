"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, MoreHorizontal, Plus, Search } from "lucide-react";

const PRIMARY = "#2563EB";
const MUTED = "#94A3B8";

type Item =
  | {
      kind: "tab";
      href: string;
      label: string;
      Icon: typeof Home;
    }
  | {
      kind: "fab";
      href: string;
      label: string;
    };

/** Matches reference: Home, Search, Add (center), Favorites, More */
const ITEMS: Item[] = [
  { kind: "tab", href: "/dashboard", label: "Home", Icon: Home },
  { kind: "tab", href: "/chat", label: "Search", Icon: Search },
  { kind: "fab", href: "/create", label: "Add" },
  { kind: "tab", href: "/memory", label: "Saved", Icon: Heart },
  { kind: "tab", href: "/profile", label: "More", Icon: MoreHorizontal },
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
      <div className="mx-auto w-[min(92vw,22rem)]">
        <div className="nm-dock-shell px-3 py-2">
          <div className="grid grid-cols-5 items-center gap-1">
            {ITEMS.map((item) => {
              const active = pathActive(path, item.href);

              if (item.kind === "fab") {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={item.label}
                    className="nm-dock-item group relative flex flex-col items-center justify-center"
                  >
                    <span
                      className={`nm-dock-fab relative z-[1] flex h-[52px] w-[52px] items-center justify-center ${
                        active ? "ring-[3px] ring-[#2563EB]/25 ring-offset-[3px] ring-offset-white" : ""
                      }`}
                    >
                      {/* Reference: rounded square + plus inside blue circle */}
                      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border-[2.5px] border-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                        <Plus className="h-[14px] w-[14px] text-white" strokeWidth={3} aria-hidden />
                      </span>
                    </span>
                  </Link>
                );
              }

              const Icon = item.Icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={item.label}
                  className="nm-dock-item group flex min-h-[44px] flex-col items-center justify-center gap-0.5 pt-1 transition-transform duration-300 ease-out active:scale-95"
                >
                  <Icon
                    className="h-[24px] w-[24px]"
                    strokeWidth={2}
                    color={active ? PRIMARY : MUTED}
                    aria-hidden
                  />
                  <span
                    className={`max-w-[3.5rem] truncate text-center text-[8px] font-semibold leading-none transition-colors duration-300 ease-out ${
                      active ? "text-[#2563EB]" : "text-[#94A3B8]"
                    }`}
                  >
                    {item.label}
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
