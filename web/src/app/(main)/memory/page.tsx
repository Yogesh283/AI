"use client";

import { useCallback, useEffect, useState } from "react";
import { GradientButton } from "@/components/neo/GradientButton";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { getMemory, type MemoryChatRow } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

function formatChatTime(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function MemoryPage() {
  const { brandName } = useSiteBrand();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [chats, setChats] = useState<MemoryChatRow[]>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [facts, setFacts] = useState<{ key: string; value: string }[]>([]);
  const [insights, setInsights] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const uid = getStoredUser()?.id ?? "default";
      const data = await getMemory(uid);
      setChats(data.chat_messages ?? []);
      setProfile(data.profile ?? null);
      setFacts(data.facts ?? []);
      setInsights(data.insights ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load memory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const user = getStoredUser();

  return (
    <div className="relative z-[1] px-4 pb-10 pt-6 md:px-8 md:pt-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-2xl font-bold tracking-tight">NeoXAI Memory</h1>
        <p className="mb-8 text-sm text-white/45">
          Saved conversation history from Chat and Voice.
        </p>

        {err ? (
          <div className="mb-6 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200/90">
            {err}
          </div>
        ) : null}

        <div className="neo-glass space-y-5 rounded-[26px] p-6 ring-1 ring-white/[0.06]">
          {loading ? (
            <p className="text-sm text-white/50">Loading…</p>
          ) : (
            <>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                  Account
                </p>
                <p className="mt-1 text-sm text-white/80">
                  {user
                    ? `${user.display_name} · ${user.email}`
                    : "Guest — login karke apni saved chats yahan dikhengi"}
                </p>
              </div>

              {profile ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                    Display name
                  </p>
                  <p className="mt-1 text-sm text-white/80">
                    {String(profile.display_name ?? "—")}
                  </p>
                </div>
              ) : null}

              {facts.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                    Facts NeoXAI remembers
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-white/75">
                    {facts.map((f, i) => (
                      <li key={`${f.key}-${i}`}>
                        <span className="text-[#00D4FF]/80">{f.key}:</span>{" "}
                        {f.value}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {insights.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">
                    Insights
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-white/65">
                    {insights.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-white">
            Chat &amp; Voice (saved)
          </h2>
          <div className="neo-glass max-h-[min(58vh,520px)] space-y-3 overflow-y-auto rounded-[26px] border border-white/[0.08] p-4 ring-1 ring-white/[0.05] md:p-5">
            {loading ? (
              <p className="text-sm text-white/50">Loading…</p>
            ) : !user ? (
              <p className="text-sm text-white/55">
                Pehle login / register karein — uske baad jo bhi NeoXAI se chat
                karenge (MySQL on ho to) yahan dikhega.
              </p>
            ) : chats.length === 0 ? (
              <p className="text-sm text-white/55">
                Abhi koi entry nahi. Pehle <strong className="text-white/75">Chat</strong> ya{" "}
                <strong className="text-white/75">Voice</strong> mein message bhejein — phir yahan
                history dikhegi. Server par MySQL on ho to data restart ke baad bhi rehta hai; bina
                MySQL ke jo is server process ne yaad rakha hai woh yahan aa sakta hai (Tools alag).
              </p>
            ) : (
              chats.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "border-[#00D4FF]/20 bg-[rgba(0,212,255,0.07)] text-white/90"
                      : "border-white/[0.08] bg-black/30 text-white/80"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-white/40">
                    <span>
                      {(m.source === "voice" ? "Voice" : "Chat")} ·{" "}
                      {m.role === "user" ? "You" : brandName}
                    </span>
                    <span className="font-normal normal-case text-white/35">
                      {formatChatTime(m.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-10">
          <GradientButton href="/dashboard" className="w-full !py-4">
            Back to dashboard
          </GradientButton>
        </div>
      </div>
    </div>
  );
}
