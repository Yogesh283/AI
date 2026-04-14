"use client";

import { useCallback, useMemo, useState } from "react";
import { getStoredUser } from "@/lib/auth";
import { postChat } from "@/lib/api";
import { GradientButton } from "@/components/neo/GradientButton";

type ToolId = "writer" | "image" | "code" | "summarize" | "translator" | "planner";

type ToolDef = {
  id: ToolId;
  icon: string;
  title: string;
  desc: string;
  border: string;
  system: string;
  placeholder: string;
  runLabel: string;
};

const TOOLS: ToolDef[] = [
  {
    id: "writer",
    icon: "✍️",
    title: "Writer",
    desc: "Draft, rewrite, tone fix",
    border: "border-[#00D4FF]/40 shadow-[0_0_20px_rgba(0,212,255,0.15)]",
    system:
      "You are a skilled writing assistant. Follow the user's language (Hindi and/or English). Be clear and concise: draft, rewrite, shorten, or change tone as requested. Output only the requested text unless they ask for options.",
    placeholder: "e.g. LinkedIn post on AI in healthcare — friendly tone, 120 words…",
    runLabel: "Generate",
  },
  {
    id: "image",
    icon: "🖼",
    title: "Image",
    desc: "Prompts for image models",
    border: "border-[#BD00FF]/40 shadow-[0_0_20px_rgba(189,0,255,0.15)]",
    system:
      "This app does not render images. You produce copy-paste ready prompts for tools like DALL·E, Midjourney, or SDXL. Give one main prompt plus 2 short variants. Mention style, lighting, composition. Keep under ~200 words total.",
    placeholder: "e.g. cyberpunk street in Mumbai monsoon, neon reflections…",
    runLabel: "Build prompts",
  },
  {
    id: "code",
    icon: "💻",
    title: "Code",
    desc: "Snippets & explanations",
    border: "border-[#9D50BB]/40 shadow-[0_0_20px_rgba(157,80,187,0.15)]",
    system:
      "You are a senior developer. Prefer TypeScript when unspecified. Put code in markdown fenced blocks with language tags. Add a one-line summary before code if helpful. Be minimal unless the user asks for deep explanation.",
    placeholder: "e.g. Next.js route handler that proxies POST to another URL…",
    runLabel: "Run",
  },
  {
    id: "summarize",
    icon: "📄",
    title: "Summarize",
    desc: "TL;DR & bullets",
    border: "border-cyan-400/30",
    system:
      "Summarize the user's text. Use bullet points for long content. Match the user's language. No preamble like 'Here is a summary' unless very short input.",
    placeholder: "Paste article, notes, or long message here…",
    runLabel: "Summarize",
  },
  {
    id: "translator",
    icon: "🌐",
    title: "Translator",
    desc: "Hindi ↔ English & more",
    border: "border-fuchsia-500/35",
    system:
      "Translate accurately. If source/target language is unclear, assume Hindi↔English bilingual user. Preserve names and code. Output only the translation.",
    placeholder: "Paste text + say target language if needed…",
    runLabel: "Translate",
  },
  {
    id: "planner",
    icon: "📋",
    title: "Planner",
    desc: "Steps & checklist",
    border: "border-violet-400/35",
    system:
      "Turn the user's goal into a practical plan: ordered steps, optional rough timeline, and a short checklist. Match Hindi/English as the user writes. Be actionable, not generic fluff.",
    placeholder: "e.g. Launch MVP in 6 weeks with solo dev…",
    runLabel: "Plan",
  },
];

export default function ToolsPage() {
  const [activeId, setActiveId] = useState<ToolId>("writer");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const active = useMemo(
    () => TOOLS.find((t) => t.id === activeId) ?? TOOLS[0],
    [activeId]
  );

  const run = useCallback(async () => {
    const text = input.trim();
    if (!text) {
      setErr("Pehle upar text likho / paste karo.");
      return;
    }
    setErr(null);
    setLoading(true);
    setOutput("");
    try {
      const user = getStoredUser();
      const uid = user?.id ?? "default";
      const { reply } = await postChat(
        [
          { role: "system", content: active.system },
          { role: "user", content: text },
        ],
        uid,
        { source: "tools" }
      );
      setOutput(reply);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [input, active]);

  const copyOut = useCallback(() => {
    if (!output.trim()) return;
    void navigator.clipboard.writeText(output);
  }, [output]);

  return (
    <div className="relative z-[1] px-4 pb-10 pt-6 md:px-8 md:pt-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-white">AI Tools</h1>
        <p className="mb-6 text-sm text-white/45">
          NeoXAI backend se connected — har tool ke liye alag system prompt. Same account as Chat.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TOOLS.map((t) => {
            const on = t.id === activeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveId(t.id);
                  setErr(null);
                  setOutput("");
                }}
                className={`neo-glass flex flex-col items-start rounded-[22px] border-2 bg-black/20 p-4 text-left transition hover:brightness-110 ${
                  t.border
                } ${on ? "ring-2 ring-[#00D4FF]/50" : "ring-0"}`}
              >
                <span className="mb-2 text-2xl drop-shadow-[0_0_12px_rgba(0,212,255,0.25)]">
                  {t.icon}
                </span>
                <span className="font-semibold text-[#00D4FF]">{t.title}</span>
                <span className="mt-0.5 text-[11px] text-white/45">{t.desc}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-8 neo-glass rounded-[26px] border border-white/[0.08] p-5 ring-1 ring-white/[0.06]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-white">
              <span className="mr-2">{active.icon}</span>
              {active.title}
            </h2>
            <GradientButton
              type="button"
              className="!px-5 !py-2.5 text-sm disabled:opacity-60"
              disabled={loading}
              onClick={() => void run()}
            >
              {loading ? "…" : active.runLabel}
            </GradientButton>
          </div>

          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/40">
            Input
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            placeholder={active.placeholder}
            className="neo-glass mb-4 w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none ring-1 ring-white/[0.06] placeholder:text-white/30 focus:border-[#00D4FF]/40"
          />

          {err ? (
            <p className="mb-3 text-sm text-red-400/95" role="alert">
              {err}
            </p>
          ) : null}

          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/40">
              Output
            </span>
            {output.trim() ? (
              <button
                type="button"
                onClick={copyOut}
                className="text-xs font-semibold text-[#00D4FF]/90 hover:underline"
              >
                Copy
              </button>
            ) : null}
          </div>
          <div className="min-h-[8rem] rounded-2xl border border-white/[0.08] bg-black/35 px-4 py-3 text-sm leading-relaxed text-white/85">
            {loading ? (
              <span className="text-white/45">Thinking…</span>
            ) : output ? (
              <pre className="whitespace-pre-wrap font-sans">{output}</pre>
            ) : (
              <span className="text-white/35">Output yahan dikhega.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
