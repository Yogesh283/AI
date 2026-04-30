"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ImagePlus, Loader2, Mic, Sparkles, Wand2 } from "lucide-react";
import { NeoPageShell } from "@/components/neo/NeoPageShell";
import { postImageGenerate } from "@/lib/api";

const MAX_PROMPT_LEN = 900;

/** Wrap so chat knows this came from Image create flow (refine prompt only). */
function buildImageCreateChatLine(userPrompt: string): string {
  const p = userPrompt.trim();
  return (
    `[Image create — user prompt]\n${p}\n\n` +
    "Reply in clear English: refine or expand this prompt for a strong image brief (subject, style, lighting, colours). " +
    "The app can also generate a real image from the main button when the server has OpenAI image access."
  );
}

export default function CreatePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [revisedPrompt, setRevisedPrompt] = useState<string | null>(null);

  const displaySrc = imageDataUrl || imageUrl;

  const navCenter = (
    <span className="text-[13px] font-semibold tracking-tight text-slate-900">Create</span>
  );

  const goChatWithPrompt = useCallback(() => {
    const t = prompt.trim();
    if (!t) {
      setHint("Write an image prompt first.");
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

  const generateImage = useCallback(async () => {
    const t = prompt.trim();
    if (!t) {
      setHint("Write an image prompt first.");
      return;
    }
    if (t.length > MAX_PROMPT_LEN) {
      setHint(`Keep your prompt under ${MAX_PROMPT_LEN} characters.`);
      return;
    }
    setHint(null);
    setGenError(null);
    setImageDataUrl(null);
    setImageUrl(null);
    setRevisedPrompt(null);
    setGenerating(true);
    try {
      const res = await postImageGenerate(t);
      if (res.revised_prompt?.trim()) {
        setRevisedPrompt(res.revised_prompt.trim());
      }
      if (res.image_data_url?.trim()) {
        setImageDataUrl(res.image_data_url.trim());
        setImageUrl(null);
      } else if (res.image_url?.trim()) {
        setImageUrl(res.image_url.trim());
        setImageDataUrl(null);
      } else {
        setGenError("No image was returned. Check server logs and OpenAI image access.");
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Image generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [prompt]);

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
    <NeoPageShell navCenter={navCenter} maxWidth="narrow" contentClassName="pt-4">
        <div className="flex w-full flex-col gap-6">
          <section className="neo-screen-card rounded-[26px] px-5 py-6 sm:px-6 sm:py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#2563EB]/90">
              Image create
            </p>
            <h1 className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Describe your image
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
              <strong className="text-slate-800">Generate image</strong> calls OpenAI (DALL·E) on the server and shows
              the result here. <strong className="text-slate-800">Refine in chat</strong> opens a new chat to improve
              the text prompt. Generation can take up to a minute.
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
              disabled={generating}
              placeholder="Example: sunset over a coastal fort, warm orange sky, cinematic lighting, no text on image…"
              className="neo-input mt-2 min-h-[120px] w-full resize-y rounded-[16px] text-[15px] leading-relaxed text-slate-900 disabled:opacity-60"
            />
            <div className="mt-1 flex justify-end text-[11px] text-slate-500">
              {prompt.length}/{MAX_PROMPT_LEN}
            </div>

            {hint ? (
              <p className="mt-2 text-sm text-amber-800" role="status">
                {hint}
              </p>
            ) : null}
            {genError ? (
              <p className="mt-2 text-sm text-rose-700" role="alert">
                {genError}
              </p>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <button
                type="button"
                onClick={() => void generateImage()}
                disabled={generating}
                className="neo-gradient-fill flex flex-1 items-center justify-center gap-2 rounded-[16px] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(37,99,235,0.35)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <Wand2 className="h-5 w-5 shrink-0 opacity-95" strokeWidth={2} aria-hidden />
                )}
                {generating ? "Creating image…" : "Generate image"}
              </button>
              <button
                type="button"
                onClick={() => void goChatWithPrompt()}
                disabled={generating}
                className="flex flex-1 items-center justify-center gap-2 rounded-[16px] border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ImagePlus className="h-5 w-5 shrink-0 text-[#2563EB]" strokeWidth={2} aria-hidden />
                Refine in chat
              </button>
            </div>
          </section>

          {revisedPrompt ? (
            <section className="rounded-[20px] border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Model-refined prompt</p>
              <p className="mt-1 leading-relaxed">{revisedPrompt}</p>
            </section>
          ) : null}

          {displaySrc ? (
            <section className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-lg shadow-slate-200/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={displaySrc}
                alt={prompt.trim().slice(0, 120) || "Generated image"}
                className="max-h-[70vh] w-full object-contain"
              />
              <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
                <a
                  href={displaySrc}
                  download={`neo-image-${Date.now()}.png`}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setImageDataUrl(null);
                    setImageUrl(null);
                    setRevisedPrompt(null);
                    setGenError(null);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear result
                </button>
              </div>
            </section>
          ) : null}

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
    </NeoPageShell>
  );
}
