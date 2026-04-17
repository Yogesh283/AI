"use client";

import Link from "next/link";
import { MetaPersonCreatorEmbed } from "@/components/metaperson/MetaPersonCreatorEmbed";
import { MetapersonVerifyPanel } from "@/components/metaperson/MetapersonVerifyPanel";
import { NeoBackground } from "@/components/neo/NeoBackground";
import { NeoLogoMark } from "@/components/neo/NeoLogoHead";
import { useSiteBrand } from "@/components/SiteBrandProvider";

export default function MetaPersonPage() {
  const { brandName } = useSiteBrand();

  return (
    <div className="relative z-[1] flex min-h-[100dvh] flex-col">
      <NeoBackground stars={12} />
      <header className="sticky top-0 z-50 flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-[#0b0e14]/92 px-3 py-2 backdrop-blur-xl sm:px-5">
        <Link href="/avatars" className="flex min-w-0 items-center gap-2 text-sm text-white/55 transition hover:text-white/90">
          <span aria-hidden>←</span>
          <span>Avatars</span>
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <NeoLogoMark className="h-7 w-7 shrink-0" />
          <span className="truncate text-sm font-medium text-white/85">MetaPerson Creator</span>
        </div>
        <span className="w-16 shrink-0 text-right text-[10px] text-white/30 sm:w-24">{brandName}</span>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 py-4 sm:px-5 sm:py-6">
        <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Create a 3D avatar</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-white/50">
          Design a MetaPerson in the iframe below. Server env{" "}
          <code className="text-cyan-300/90">METAPERSON_CLIENT_ID</code> /{" "}
          <code className="text-cyan-300/90">METAPERSON_CLIENT_SECRET</code> are required for authentication.
        </p>
        <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-white/35">
          Need a fully custom UI or headless pipeline? Avatar SDK documents a MetaPerson{" "}
          <span className="text-white/50">REST API</span> (Enterprise plan) for photo → export (GLB, outfits,
          blendshapes, etc.) — see{" "}
          <a
            href="https://api.avatarsdk.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#00D4FF]/80 underline-offset-2 hover:underline"
          >
            api.avatarsdk.com
          </a>
          . This page uses the low-code iframe only.
        </p>

        <MetapersonVerifyPanel />

        <div className="mt-2 flex min-h-0 flex-1 flex-col">
          <MetaPersonCreatorEmbed />
        </div>
      </div>
    </div>
  );
}
