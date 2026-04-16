"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

function initialMsgs(brandName: string, displayName?: string | null): Msg[] {
  const name = displayName?.trim() ?? "";
  const line = name
    ? `Hello ${name}! Main ${brandName} hoon — aapka personal assistant. Market, news, aaj ki baat — jo bhi ho, Hindi ya English mein; main yahan hoon.`
    : `Good morning! Main ${brandName} hoon — aapka personal assistant. Jo bhi kaam ya sawaal ho, Hindi ya English mein poochho; main yahan hoon.`;
  return [{ role: "assistant", content: line }];
}

/** Full chat thread + composer for /dashboard (no top bar — layout provides header). */
export function DashboardChatPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { brandName } = useSiteBrand();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>(() => initialMsgs(brandName, null));
  const [profileName, setProfileName] = useState("");
  const msgsRef = useRef(msgs);
  msgsRef.current = msgs;
  const [profileTick, setProfileTick] = useState(0);
  const hydratedRef = useRef(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceHint, setVoiceHint] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalBuf = useRef("");
  const interimRef = useRef("");
  const dictationBaseRef = useRef("");
  const handledSearchKeyRef = useRef<string | null>(null);

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
    setProfileName(u?.display_name?.trim() ?? "");
    const uid = u?.id ?? "anon";
    const loaded = loadChatMessages(uid);
    if (loaded && loaded.length > 0) {
      setMsgs(loaded);
    } else {
      setMsgs(initialMsgs(brandName, u?.display_name));
    }
    setHistoryReady(true);
  }, [brandName]);

  useEffect(() => {
    setProfileTick((n) => n + 1);
  }, [pathname]);

  useEffect(() => {
    setProfileName(getStoredUser()?.display_name?.trim() ?? "");
  }, [pathname, profileTick]);

  useEffect(() => {
    const onFocus = () => setProfileTick((n) => n + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    const uid = getStoredUser()?.id ?? "anon";
    saveChatMessages(uid, msgs);
  }, [msgs]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  const userShort = profileName.split(/\s+/).filter(Boolean)[0] ?? "";

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

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput("");
    const cur = msgsRef.current;
    const next: Msg[] = [...cur, { role: "user", content: trimmed }];
    setMsgs(next);
    msgsRef.current = next;
    setLoading(true);
    try {
      const apiMsgs = next.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      const uid = getStoredUser()?.id ?? "default";
      const { reply } = await postChat(apiMsgs, uid, { useWeb: true });
      const withReply: Msg[] = [...next, { role: "assistant", content: reply }];
      setMsgs(withReply);
      msgsRef.current = withReply;
    } catch (e) {
      const hint =
        e instanceof Error && e.message.trim()
          ? e.message
          : typeof e === "string" && e.trim()
            ? e
            : "Network error — DevTools (F12) → Network tab, retry send.";
      const failed: Msg[] = [
        ...next,
        {
          role: "assistant",
          content:
            `Chat failed: ${hint}\n\n— Open /neo-api/health on this domain. Nginx must send /neo-api to Next (3000), not directly to 8010. PM2: neo-api + neo-web.`,
        },
      ];
      setMsgs(failed);
      msgsRef.current = failed;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!historyReady) return;
    const isNew = searchParams.get("new") === "1";
    const q = searchParams.get("q")?.trim();
    if (!isNew && !q) return;
    const dedupeKey = `${searchParams.toString()}|${isNew ? "n" : ""}|${q ?? ""}`;
    if (handledSearchKeyRef.current === dedupeKey) return;
    handledSearchKeyRef.current = dedupeKey;
    if (isNew) {
      resetConversation();
    }
    router.replace("/dashboard", { scroll: false });
    if (q) {
      const run = () => void sendMessage(q);
      if (isNew) {
        setTimeout(run, 0);
      } else {
        run();
      }
    }
  }, [historyReady, searchParams, router, resetConversation, sendMessage]);

  function send() {
    void sendMessage(input);
  }

  return (
    <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden bg-[#080a0f]">
      <div
        ref={scrollRef}
        className="neo-chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth px-3 py-5 sm:px-5 md:px-8 md:py-6"
      >
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-5 md:gap-6">
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

      <div className="z-10 shrink-0 border-t border-white/[0.06] bg-[#080a0f] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] sm:px-5 md:px-8 md:pt-4">
        <div className="mx-auto w-full max-w-[44rem]">
          <div className="flex w-full items-center gap-1 rounded-full border border-neutral-200/90 bg-white py-1.5 pl-3 pr-1.5 shadow-[0_2px_16px_rgba(0,0,0,0.12)] sm:gap-1.5 sm:pl-4 sm:pr-2">
            <textarea
              className="max-h-36 min-h-[44px] min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-snug text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-0"
              placeholder={
                userShort ? `${userShort}, ask anything…` : "Ask anything"
              }
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
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || voiceListening || !input.trim()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00D4FF] to-[#0891b2] text-[#050912] shadow-[0_1px_10px_rgba(0,212,255,0.35)] transition hover:brightness-105 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
              aria-label="Send message"
              title="Send (Enter)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => toggleVoice()}
              disabled={loading}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-900 transition hover:bg-neutral-100 disabled:opacity-40 ${
                voiceListening ? "bg-emerald-50 text-emerald-700 ring-2 ring-emerald-400/50" : ""
              }`}
              aria-pressed={voiceListening}
              aria-label={voiceListening ? "Stop voice input" : "Voice input"}
              title={voiceListening ? "Rokne ke liye dabayein" : "Bol kar type karein"}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0H5a7 7 0 0 0 6 6.92V22h2v-4.08A7 7 0 0 0 19 11h-1Z"
                />
              </svg>
            </button>
            <Link
              href="/voice"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#10a37f] text-white shadow-[0_2px_12px_rgba(16,163,127,0.45)] transition hover:brightness-105 active:scale-[0.97]"
              aria-label="Voice chat"
              title="Voice chat"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="4" y="10" width="3" height="8" rx="1" fill="currentColor" />
                <rect x="9" y="6" width="3" height="16" rx="1" fill="currentColor" />
                <rect x="14" y="8" width="3" height="12" rx="1" fill="currentColor" />
                <rect x="19" y="4" width="3" height="20" rx="1" fill="currentColor" />
              </svg>
            </Link>
          </div>
          {voiceHint ? (
            <p className="mt-2.5 text-center text-[11px] text-amber-400/95" role="status">
              {voiceHint}
            </p>
          ) : voiceListening ? (
            <p className="mt-2.5 text-center text-[11px] text-emerald-400/85">
              Sun raha hoon… mic dubara dabao to band
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
