"use client";

import Link from "next/link";

/**
 * Login + Register — same bottom bar on both pages (APK / web).
 */
export function AuthBottomNav({ current }: { current: "login" | "register" }) {
  const base =
    "flex flex-1 items-center justify-center rounded-xl py-3.5 text-sm font-semibold transition";
  const active = "bg-white/[0.12] text-white shadow-inner ring-1 ring-white/10";
  const idle = "text-white/50 hover:bg-white/[0.06] hover:text-white/80";

  return (
    <nav
      className="mt-10 border-t border-white/10 pt-6 pb-4"
      aria-label="Log in or register"
    >
      <p className="mb-3 text-center text-[10px] uppercase tracking-[0.2em] text-white/35">
        Log in or register
      </p>
      <div className="flex gap-1 rounded-2xl border border-white/[0.12] bg-black/25 p-1">
        <Link
          href="/login"
          className={`${base} ${current === "login" ? active : idle}`}
          prefetch={true}
        >
          Log in
        </Link>
        <Link
          href="/register"
          className={`${base} ${current === "register" ? active : idle}`}
          prefetch={true}
        >
          Register
        </Link>
      </div>
    </nav>
  );
}
