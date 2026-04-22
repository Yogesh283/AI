"use client";

import { useCallback, useEffect, useState } from "react";
import { GradientButton } from "@/components/neo/GradientButton";
import { NEO_ASSISTANT_NAME } from "@/lib/siteBranding";
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
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">
          NeoXAI Memory
        </h1>
        <p className="mb-8 text-sm text-slate-600">
          Saved conversation history from Chat and Voice.
        </p>

        {err ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {err}
          </div>
        ) : null}

        <div className="neo-screen-card space-y-5 rounded-[26px] p-6">
          {loading ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Account
                </p>
                <p className="mt-1 text-sm text-slate-800">
                  {user
                    ? `${user.display_name} · ${user.email}`
                    : "Guest — sign in to see your saved chats here."}
                </p>
              </div>

              {profile ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Display name
                  </p>
                  <p className="mt-1 text-sm text-slate-800">
                    {String(profile.display_name ?? "—")}
                  </p>
                </div>
              ) : null}

              {facts.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Facts NeoXAI remembers
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-slate-700">
                    {facts.map((f, i) => (
                      <li key={`${f.key}-${i}`}>
                        <span className="font-medium text-[#2563eb]">{f.key}:</span>{" "}
                        {f.value}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {insights.length > 0 ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Insights
                  </p>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
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
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">
            Chat &amp; Voice (saved)
          </h2>
          <div className="neo-screen-card max-h-[min(58vh,520px)] space-y-3 overflow-y-auto rounded-[26px] p-4 md:p-5">
            {loading ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : !user ? (
              <p className="text-sm text-slate-600">
                Sign in or register first. After that, anything you chat with NeoXAI (when MySQL is enabled) will
                show up here.
              </p>
            ) : chats.length === 0 ? (
              <p className="text-sm text-slate-600">
                No entries yet. Send a message from <strong className="text-slate-900">Chat</strong> or{" "}
                <strong className="text-slate-900">Voice</strong> first — then your history will appear here. With
                MySQL enabled on the server, data can persist across restarts; without it, you may still see what this
                server process kept in memory.
              </p>
            ) : (
              chats.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-2xl border px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "border-[#2563eb]/25 bg-[#eff6ff] text-slate-900"
                      : "border-slate-200 bg-slate-50 text-slate-800"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    <span>
                      {(m.source === "voice" ? "Voice" : "Chat")} ·{" "}
                      {m.role === "user" ? "You" : NEO_ASSISTANT_NAME}
                    </span>
                    <span className="font-normal normal-case text-slate-400">
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
