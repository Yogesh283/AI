"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearSession } from "@/lib/auth";

const rows = [
  { t: "Account Settings", sub: "Email, password" },
  { t: "Avatar & Voice", sub: "Appearance" },
  { t: "Notifications", sub: "Push & email" },
  { t: "Privacy & Security", sub: "Data & sessions" },
  { t: "Subscription", sub: "Pro Plan", highlight: true },
];

export default function ProfilePage() {
  const router = useRouter();

  function onLogout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="relative z-[1] px-4 pb-10 pt-6 md:px-8 md:pt-8">
      <div className="mx-auto max-w-3xl">
      <div className="mb-10 flex flex-col items-center">
        <div className="mb-4 flex h-28 w-28 items-center justify-center rounded-full border-2 border-[#00D4FF]/35 bg-gradient-to-br from-[#152238] to-[#0a0f18] text-6xl shadow-[0_0_40px_rgba(0,212,255,0.2)]">
          👤
        </div>
        <h1 className="text-xl font-bold">Aman</h1>
        <p className="mt-2 rounded-full border border-[#BD00FF]/35 bg-[#BD00FF]/10 px-4 py-1.5 text-xs font-semibold text-[#e9c2ff]">
          Premium User
        </p>
      </div>
      <div className="neo-glass divide-y divide-white/[0.07] overflow-hidden rounded-[26px] ring-1 ring-white/[0.06]">
        {rows.map((r) => (
          <Link
            key={r.t}
            href="/dashboard"
            className="flex items-center justify-between px-5 py-4 transition hover:bg-white/[0.04]"
          >
            <div>
              <p className="text-sm font-medium text-white/90">{r.t}</p>
              <p className="mt-0.5 text-xs text-white/35">{r.sub}</p>
            </div>
            <span className="text-white/30">›</span>
          </Link>
        ))}
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="mt-8 w-full rounded-[22px] border border-red-500/35 bg-red-500/5 py-4 text-sm font-semibold text-red-400/95"
      >
        Logout
      </button>
      </div>
    </div>
  );
}
