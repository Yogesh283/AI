"use client";

import Image from "next/image";
import { useState } from "react";
import { getNeoAvatar, readStoredAvatarId } from "@/lib/avatars";
import { getVoicePersona, readStoredVoicePersonaId } from "@/lib/voicePersonas";

/** Assistant side — uses selected voice persona portrait (human). */
export function ChatAssistantAvatar({ className = "" }: { className?: string }) {
  const [personaId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStoredVoicePersonaId(),
  );
  const p = getVoicePersona(personaId);
  return (
    <div
      className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c121c] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-[#00D4FF]/20 ${className}`}
      aria-hidden
    >
      <Image
        src={p.imageSrc}
        alt=""
        width={36}
        height={36}
        className="h-full w-full object-cover object-top"
        unoptimized={p.imageSrc.endsWith(".svg")}
      />
    </div>
  );
}

/** User side — uses avatar chooser (human profile art). */
export function ChatUserAvatar({ className = "" }: { className?: string }) {
  const [avatarId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : readStoredAvatarId(),
  );
  const a = getNeoAvatar(avatarId);
  return (
    <div
      className={`relative h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0c1018] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-[#00D4FF]/12 ${className}`}
      aria-hidden
    >
      <Image
        src={a.imageSrc}
        alt=""
        width={36}
        height={36}
        className="h-full w-full object-cover object-top"
        unoptimized={a.imageSrc.endsWith(".svg")}
      />
    </div>
  );
}
