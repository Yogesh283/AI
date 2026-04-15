"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getStoredUser } from "@/lib/auth";
import { postChat } from "@/lib/api";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  speechRecognitionErrorMessage,
} from "@/lib/voiceChat";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { ChatAssistantAvatar, ChatUserAvatar } from "@/components/neo/ChatThreadAvatars";
import {
  clearChatMessages,
  loadChatMessages,
  saveChatMessages,
} from "@/lib/chatStorage";

type Msg = { role: "user" | "assistant"; content: string };

function initialMsgs(brandName: string, firstName?: string | null): Msg[] {
  const first = firstName?.trim().split(/\s+/)[0] ?? "";
  const line = first
    ? `Hello ${first}! Main ${brandName} hoon — aapka personal assistant. Market, news, aaj ki baat — jo bhi ho, Hindi ya English mein; main yahan hoon.`
    : `Good morning! Main ${brandName} hoon — aapka personal assistant. Jo bhi kaam ya sawaal ho, Hindi ya English mein poochho; main yahan hoon.`;
  return [{ role: "assistant", content: line }];
}

const CHAT_USE_WEB_KEY = "neo-chat-use-web";

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { brandName } = useSiteBrand();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>(() => initialMsgs(brandName));
  const hydratedRef = useRef(false);
  const [useWeb, setUseWeb] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalBuf = useRef("");
  const interimRef = useRef("");
  const dictationBaseRef = useRef("");

  const resetConversation = useCallback(() => {
    const uid = getStoredUser()?.id ?? "anon";
    clearChatMessages(uid);
    setMsgs(initialMsgs(brandName, getStoredUser()?.display_name));
    setInput("");
  }, [brandName]);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const u = getStoredUser();
    const uid = u?.id ?? "anon";
    const loaded = loadChatMessages(uid);
    if (loaded && loaded.length > 0) {
      setMsgs(loaded);
    } else {
      setMsgs(initialMsgs(brandName, u?.display_name));
    }
  }, [brandName]);

  useEffect(() => {
    const uid = getStoredUser()?.id ?? "anon";
    saveChatMessages(uid, msgs);
  }, [msgs]);

  useEffect(() => {
    try {
      if (localStorage.getItem(CHAT_USE_WEB_KEY) === "1") setUseWeb(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_USE_WEB_KEY, useWeb ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [useWeb]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      resetConversation();
      router.replace("/chat", { scroll: false });
    }
  }, [searchParams, router, resetConversation]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  const stopVoice = useCallback(() => {
    try {
      recRef.current?.abort?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    setVoiceListening(false);
    finalBuf.current = "";
    interimRef.current = "";
  }, []);

  const toggleVoice = useCallback(() => {
    if (voiceListening) {
      stopVoice();
      return;
    }
    if (!isSpeechRecognitionSupported()) {
      setVoiceHint("Voice: Chrome ya Edge use karein (mic allow).");
      return;
    }
    if (loading) return;
    setVoiceHint(null);
    dictationBaseRef.current = input.trimEnd();
    finalBuf.current = "";
    interimRef.current = "";

    const rec = createSpeechRecognition("hi-IN");
    if (!rec) {
      setVoiceHint("Speech recognition start nahi ho paya.");
      return;
    }

    rec.onresult = (ev: SpeechRecognitionEvent) => {
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const piece = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) {
          finalBuf.current += piece;
        } else {
          interimText += piece;
        }
      }
      const it = interimText.trim();
      interimRef.current = it;
      const live = `${finalBuf.current.trim()} ${it}`.trim();
      const base = dictationBaseRef.current;
      setInput(base ? (live ? `${base} ${live}` : base) : live);
    };

    rec.onerror = (ev: SpeechRecognitionErrorEvent) => {
      setVoiceListening(false);
      recRef.current = null;
      const msg = speechRecognitionErrorMessage(ev.error);
      if (msg) setVoiceHint(msg);
    };

    rec.onend = () => {
      setVoiceListening(false);
      recRef.current = null;
      const said = `${finalBuf.current.trim()} ${interimRef.current.trim()}`.trim();
      interimRef.current = "";
      finalBuf.current = "";
      const base = dictationBaseRef.current;
      if (said) {
        setInput(base ? `${base} ${said}`.trim() : said);
      }
    };

    recRef.current = rec;
    try {
      rec.start();
      setVoiceListening(true);
    } catch {
      setVoiceHint("Mic busy — dubara try karein.");
    }
  }, [voiceListening, stopVoice, loading, input]);

  useEffect(() => {
    return () => {
      try {
        if (recRef.current && "abort" in recRef.current) {
          (recRef.current as SpeechRecognition).abort();
        }
      } catch {
        /* ignore */
      }
    };
  }, []);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setLoading(true);
    try {
      const apiMsgs = next.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      const uid = getStoredUser()?.id ?? "default";
      const { reply } = await postChat(apiMsgs, uid, { useWeb });
      setMsgs([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      const hint =
        e instanceof Error && e.message.trim()
          ? e.message
          : typeof e === "string" && e.trim()
            ? e
            : "Network error — DevTools (F12) → Network tab, retry send.";
      setMsgs([
        ...next,
        {
          role: "assistant",
          content:
            `Chat failed: ${hint}\n\n— Open /neo-api/health on this domain. Nginx must send /neo-api to Next (3000), not directly to 8010. PM2: neo-api + neo-web.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative z-[1] flex min-h-0 flex-1 flex-col bg-[#080a0f] md:h-full">
      {/* Header */}
      <header className="sticky top-0 z-40 flex h-[52px] shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] bg-[#0b0e14]/98 px-3 backdrop-blur-xl sm:h-14 sm:gap-3 sm:px-5 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <ChatAssistantAvatar />
          <div className="min-w-0">
            <h1 className="truncate font-semibold leading-tight tracking-tight text-white">
              {brandName}
            </h1>
            <p className="text-[11px] font-medium tracking-wide text-white/45">
              AI Assistant · <span className="text-emerald-400/90">Online</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link
            href="/voice-personas"
            className="rounded-lg px-2 py-1.5 text-[10px] font-medium text-white/50 transition hover:text-[#00D4FF] sm:text-xs"
          >
            Voice &amp; face
          </Link>
          <Link
            href="/voice"
            className="hidden rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/70 transition hover:border-[#00D4FF]/25 hover:text-white/90 md:inline-flex"
          >
            Voice
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#00D4FF]/90 transition hover:bg-white/[0.05] hover:text-[#00D4FF] md:hidden"
          >
            Home
          </Link>
        </div>
      </header>

      {/* Thread */}
      <div
        ref={scrollRef}
        className="neo-chat-scroll min-h-0 flex-1 overflow-y-auto scroll-smooth px-3 py-5 sm:px-5 md:px-8 md:py-6"
      >
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-5 md:gap-6">
          {/* Opening message */}
          <article className="flex gap-3 sm:gap-4">
            <ChatAssistantAvatar className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-[#10151f] px-4 py-3.5 shadow-[0_2px_24px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/[0.03] sm:px-5 sm:py-4">
                <p className="text-[15px] leading-[1.6] text-white/[0.92]">
                  {msgs[0]?.content}
                </p>
              </div>
            </div>
          </article>

          {msgs.slice(1).map((m, i) => (
            <article
              key={i}
              className={`flex gap-3 sm:gap-4 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {m.role === "user" ? (
                <ChatUserAvatar className="mt-0.5" />
              ) : (
                <ChatAssistantAvatar className="mt-0.5" />
              )}
              <div
                className={`min-w-0 ${m.role === "user" ? "ml-auto max-w-[min(100%,85%)] sm:max-w-[75%]" : "max-w-[min(100%,90%)] sm:max-w-[85%]"}`}
              >
                <div
                  className={
                    m.role === "user"
                      ? "rounded-2xl rounded-tr-md border border-white/[0.1] bg-gradient-to-br from-[#0f3d5c] via-[#1a1f3a] to-[#241438] px-4 py-3.5 text-[15px] leading-[1.6] text-white shadow-[0_4px_28px_rgba(0,212,255,0.12)] ring-1 ring-[#00D4FF]/15 sm:px-5 sm:py-4"
                      : "rounded-2xl rounded-tl-md border border-white/[0.07] bg-[#10151f] px-4 py-3.5 text-[15px] leading-[1.6] text-white/[0.9] shadow-[0_2px_20px_rgba(0,0,0,0.3)] ring-1 ring-inset ring-white/[0.03] sm:px-5 sm:py-4"
                  }
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              </div>
            </article>
          ))}

          {loading ? (
            <div className="flex items-center gap-3 pl-1 sm:pl-2">
              <ChatAssistantAvatar />
              <div className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-[#10151f] px-4 py-2.5">
                <span className="sr-only">{brandName} typing</span>
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="neo-chat-dot h-2 w-2 rounded-full bg-[#00D4FF]/70"
                    style={{ animationDelay: `${d * 0.16}s` }}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Composer dock */}
      <div className="shrink-0 border-t border-white/[0.08] bg-[#060910]/98 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-5 md:px-8 md:pt-4">
        <div className="mx-auto w-full max-w-[44rem] space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-white/45">
              <input
                type="checkbox"
                checked={useWeb}
                onChange={(e) => setUseWeb(e.target.checked)}
                className="h-4 w-4 accent-[#00D4FF]"
              />
              <span title="Live Google snippets when keys set; auto for market/today queries too.">
                Web / live data
              </span>
            </label>
            <div className="flex items-center gap-3 text-[11px]">
              <Link
                href="/voice-personas"
                className="text-[#00D4FF]/80 transition hover:text-[#00D4FF] hover:underline"
              >
                Voice &amp; face
              </Link>
              <Link
                href="/chat?new=1"
                className="text-white/40 transition hover:text-white/75 hover:underline"
              >
                New chat
              </Link>
            </div>
          </div>
          <div className="flex items-end gap-2 rounded-2xl border border-white/[0.1] bg-[#0c1018] p-1.5 shadow-[0_0_0_1px_rgba(0,212,255,0.05),inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-[#00D4FF]/10 sm:gap-2 sm:p-2">
            <textarea
              className="max-h-36 min-h-[48px] min-w-0 flex-1 resize-none rounded-xl bg-transparent px-3 py-3 text-[15px] leading-snug text-white outline-none placeholder:text-white/30 focus-visible:ring-0 sm:px-4"
              placeholder={`Message ${brandName}…`}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              disabled={voiceListening}
            />
            <div className="flex shrink-0 flex-col gap-1 pb-0.5">
              <button
                type="button"
                onClick={() => toggleVoice()}
                disabled={loading}
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg transition ${
                  voiceListening
                    ? "bg-emerald-500/20 text-emerald-200 ring-2 ring-emerald-400/40"
                    : "text-white/75 hover:bg-white/[0.08] hover:text-white"
                } disabled:opacity-40`}
                aria-pressed={voiceListening}
                aria-label={voiceListening ? "Stop voice input" : "Voice input"}
                title={voiceListening ? "Rokne ke liye dabayein" : "Bol kar type karein"}
              >
                🎙
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={loading || voiceListening}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#00c8f0] to-[#a855f7] text-white shadow-[0_4px_20px_rgba(0,212,255,0.35)] transition hover:brightness-110 active:scale-[0.97] disabled:opacity-45"
                aria-label="Send"
              >
                <span className="text-lg leading-none">➤</span>
              </button>
            </div>
          </div>
          {voiceHint ? (
            <p className="mt-2.5 text-center text-[11px] text-amber-400/95" role="status">
              {voiceHint}
            </p>
          ) : voiceListening ? (
            <p className="mt-2.5 text-center text-[11px] text-emerald-400/85">
              Sun raha hoon… 🎙 dubara dabao to band
            </p>
          ) : (
            <p className="mt-2.5 text-center text-[11px] text-white/30">
              Enter bhejta hai · Shift+Enter nayi line · Assistant galat ho sakta hai — verify zaroori kaam
            </p>
          )}
        </div>
      </div>

    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center bg-[#080a0f] p-12 text-sm text-white/45">
          Loading chat…
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}
