"use client";

import { MetaPersonCreatorEmbed } from "@/components/metaperson/MetaPersonCreatorEmbed";
import { MetapersonVerifyPanel } from "@/components/metaperson/MetapersonVerifyPanel";
import { NeoPublicShell } from "@/components/neo/NeoPublicShell";

export default function MetaPersonPage() {
  return (
    <NeoPublicShell maxWidth="max-w-6xl" leadingBack={{ href: "/avatars", label: "Avatars" }}>
      <div className="flex min-h-0 flex-1 flex-col">
        <h1 className="neo-gradient-text text-lg font-bold tracking-tight sm:text-xl">
          Create a 3D avatar
        </h1>
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
    </NeoPublicShell>
  );
}
