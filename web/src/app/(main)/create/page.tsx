"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ImagePlus, Mic, Sparkles } from "lucide-react";
import { MainTopNav } from "@/components/neo/MainTopNav";

const MAX_PROMPT_LEN = 900;

/** Wrap so chat knows this came from Image create flow. */
function buildImageCreateChatLine(userPrompt: string): string {
  const p = userPrompt.trim();
  return (
    `[Image create — user prompt]\n${p}\n\n` +
    "Reply in clear English: refine or expand this prompt for a strong image brief (subject, style, lighting, colours). " +
    "If you cannot render actual image files, say that clearly and still give a detailed visual description they can use elsewhere."
  );
}

export default function CreatePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [hint, setHint] = useState<string | null>(null);

  const navCenter = (
    <span className="text-[13px] font-semibold tracking-tight text-slate-900">Create</span>
  );

  const goChatWithPrompt = useCallback(() => {
    const t = prompt.trim();
    if (!t) {
      setHint("Write an image prompt first, then tap Send to chat.");
      return;
    }
    if (t.length > MAX_PROMPT_LEN) {
      setHint(`Keep your prompt under ${MAX_PROMPT_LEN} characters.`);
      return;
    }
    setHint(null);
    const q = buildImageCreateChatLine(t);
    router.push(`/chat?new=1&q=${encodeURIComponent(q)}`);
  }, [prompt, router]);

  const shortcuts = [
    {
      href: "/voice",
      title: "Voice chat",
      desc: "Speak naturally and get spoken replies in real time.",
      Icon: Mic,
    },
    {
      href: "/dashboard",
      title: "Home & tools",
      desc: "Dashboard, memory, and settings.",
      Icon: Sparkles,
    },
  ] as const;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F5F7FA] md:min-h-0">
      <MainTopNav center={navCenter} />
      <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 pb-28 pt-4 md:px-8 md:pb-16">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
          <section className="neo-screen-card rounded-[26px] px-5 py-6 sm:px-6 sm:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563EB]/90">
              Image create
            </p>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Describe your image
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
              Write what you want (scene, style, colours, no text on the image, etc.). Tap{" "}
              <strong className="text-slate-800">Send to chat</strong> to open a new chat with this prompt so the
              assistant can refine it and describe the scene in detail.
            </p>

            <label htmlFor="create-image-prompt" className="mt-5 block text-sm font-semibold text-slate-800">
              Image prompt <span className="font-normal text-slate-500">(required)</span>
            </label>
            <textarea
              id="create-image-prompt"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                if (hint) setHint(null);
              }}
              rows={5}
              maxLength={MAX_PROMPT_LEN}
              placeholder="Example: sunset over a coastal fort, warm orange sky, cinematic lighting, no text on image…"
              className="neo-input mt-2 min-h-[120px] w-full resize-y rounded-[16px] text-[15px] leading-relaxed text-slate-900"
            />
            <div className="mt-1 flex justify-end text-[11px] text-slate-500">
              {prompt.length}/{MAX_PROMPT_LEN}
            </div>

            {hint ? (
              <p className="mt-2 text-sm text-amber-800" role="status">
                {hint}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void goChatWithPrompt()}
              className="neo-gradient-fill mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(37,99,235,0.35)] transition hover:brightness-105 active:scale-[0.99]"
            >
              <ImagePlus className="h-5 w-5 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
              Send to chat
            </button>
          </section>

          <p className="px-1 text-center text-[12px] text-slate-500">Shortcuts:</p>

          <div className="flex flex-col gap-3">
            {shortcuts.map(({ href, title, desc, Icon }) => (
              <Link
                key={href}
                href={href}
                className="neo-list-row group flex gap-4 rounded-[20px] p-4 transition duration-300 ease-out hover:-translate-y-0.5 active:scale-[0.99]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#eff6ff] text-[#2563EB] shadow-[inset_2px_2px_6px_rgba(255,255,255,0.85)]">
                  <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold text-slate-900">{title}</span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
