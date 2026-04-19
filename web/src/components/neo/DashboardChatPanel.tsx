"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getStoredUser } from "@/lib/auth";
import { postChatStream } from "@/lib/api";
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  speechRecognitionErrorMessage,
} from "@/lib/voiceChat";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { NEO_ASSISTANT_NAME, shortDisplayNameForGreeting } from "@/lib/siteBranding";
import { ChatAssistantAvatar, ChatUserAvatar } from "@/components/neo/ChatThreadAvatars";
import {
  clearChatMessages,
  loadChatMessages,
  saveChatMessages,
} from "@/lib/chatStorage";
import { ChatMarkdown } from "@/components/neo/ChatMarkdown";
import { readStoredVoiceSpeechLang } from "@/lib/voiceLanguages";
import {
  buildWhatsAppWebUrl,
  navigateToWhatsAppWeb,
  shouldOpenWhatsAppFromCommand,
  tryOpenWhatsAppPopup,
  whatsAppOpenAck,
} from "@/lib/whatsappOpenCommand";

type Msg = { role: "user" | "assistant"; content: string };

function initialMsgs(displayName?: string | null): Msg[] {
  const name = shortDisplayNameForGreeting(displayName ?? undefined);
  const line = name
    ? `Hey ${name} — main ${NEO_ASSISTANT_NAME}. Yahan bilkul waise hi baat kar sakte ho jaise kisi insaan se: jo man ho poochho, Hindi ya English, short ya detail; main sun ke saath hoon.`
    : `Hi — main ${NEO_ASSISTANT_NAME}. Seedha likho jaise chat pe kisi dost se baat karte ho; main yahan hoon.`;
  return [{ role: "assistant", content: line }];
}

/** Full chat thread + composer for /dashboard (no top bar — layout provides header). */
export function DashboardChatPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { brandName } = useSiteBrand();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>(() => initialMsgs(null));
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const finalBuf = useRef("");
  const interimRef = useRef("");
  const dictationBaseRef = useRef("");
  const handledSearchKeyRef = useRef<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const resetConversation = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    const uid = getStoredUser()?.id ?? "anon";
    clearChatMessages(uid);
    setMsgs(initialMsgs(getStoredUser()?.display_name));
    setInput("");
    setLoading(false);
  }, [brandName]);

  /** Match Tailwind max-h-36 (9rem) / min-h ~ single line composer. */
  const fitComposerHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const minH = 44;
    const maxH = 144;
    el.style.height = "auto";
    const sh = el.scrollHeight;
    const h = Math.max(minH, Math.min(sh, maxH));
    el.style.height = `${h}px`;
    el.style.overflowY = sh > maxH ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => fitComposerHeight());
  }, [input, fitComposerHeight]);

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
      setMsgs(initialMsgs(u?.display_name));
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

    if (shouldOpenWhatsAppFromCommand(trimmed)) {
      const waUrl = buildWhatsAppWebUrl(trimmed);
      const popped = tryOpenWhatsAppPopup(waUrl);
      const ack = whatsAppOpenAck(readStoredVoiceSpeechLang(), popped ? "new-tab" : "same-tab");
      const next: Msg[] = [...cur, { role: "user", content: trimmed }, { role: "assistant", content: ack }];
      setMsgs(next);
      msgsRef.current = next;
      if (!popped) navigateToWhatsAppWeb(waUrl);
      return;
    }

    streamAbortRef.current?.abort();
    streamAbortRef.current = new AbortController();
    const signal = streamAbortRef.current.signal;

    const next: Msg[] = [...cur, { role: "user", content: trimmed }, { role: "assistant", content: "" }];
    setMsgs(next);
    msgsRef.current = next;
    setLoading(true);
    try {
      const apiMsgs = next.slice(0, -1).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      const uid = getStoredUser()?.id ?? "default";
      await postChatStream(apiMsgs, uid, { useWeb: false, signal }, (delta) => {
        setMsgs((prev) => {
          const out = [...prev];
          const L = out.length - 1;
          if (L >= 0 && out[L].role === "assistant") {
            out[L] = { role: "assistant", content: out[L].content + delta };
          }
          return out;
        });
      });
      setMsgs((prev) => {
        msgsRef.current = prev;
        return prev;
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        setMsgs((prev) => {
          const out = [...prev];
          const L = out.length - 1;
          if (L >= 0 && out[L].role === "assistant" && !out[L].content.trim()) {
            out.pop();
          }
          msgsRef.current = out;
          return out;
        });
        return;
      }
      const hint =
        e instanceof Error && e.message.trim()
          ? e.message
          : typeof e === "string" && e.trim()
            ? e
            : "Network error — DevTools (F12) → Network tab, retry send.";
      setMsgs((prev) => {
        const out = [...prev];
        const L = out.length - 1;
        if (L >= 0 && out[L].role === "assistant") {
          const prevC = out[L].content.trim();
          out[L] = {
            role: "assistant",
            content: prevC
              ? `${prevC}\n\n— ${hint}`
              : `Chat failed: ${hint}\n\n— Open /neo-api/health on this domain. Nginx must send /neo-api to Next (3000), not directly to 8010. PM2: neo-api + neo-web.`,
          };
        }
        msgsRef.current = out;
        return out;
      });
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
    router.replace(pathname || "/chat", { scroll: false });
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
        <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-6 md:gap-7">
          <article className="flex gap-3 sm:gap-4">
            <ChatAssistantAvatar className="mt-0.5" />
            <div className="min-w-0 flex-1 border-l-2 border-white/[0.1] pl-3 sm:pl-4">
              <p className="line-clamp-2 text-[15px] leading-relaxed text-white/[0.92] sm:line-clamp-none">
                {msgs[0]?.content}
              </p>
            </div>
          </article>

          {msgs.slice(1).map((m, i) => {
            const isLast = i === msgs.length - 2;
            return (
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
                  className={`min-w-0 flex-1 ${m.role === "user" ? "text-right" : ""}`}
                >
                  <div
                    className={
                      m.role === "user"
                        ? "inline-block max-w-[min(100%,92%)] border-r-2 border-[#00D4FF]/30 pr-3 text-right sm:max-w-[85%]"
                        : "border-l-2 border-white/[0.1] pl-3 sm:pl-4"
                    }
                  >
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90">
                        {m.content}
                      </p>
                    ) : (
                      <div className="text-[15px] leading-relaxed text-white/[0.9]">
                        {m.content.trim().length > 0 ? (
                          <div className="inline-block max-w-full text-left">
                            <ChatMarkdown text={m.content} />
                            {loading && isLast ? (
                              <span
                                className="ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 animate-pulse rounded-sm bg-[#00D4FF]/90 align-middle"
                                aria-hidden
                              />
                            ) : null}
                          </div>
                        ) : loading && isLast ? (
                          <div className="flex items-center gap-1.5">
                            <span className="sr-only">{NEO_ASSISTANT_NAME} typing</span>
                            {[0, 1, 2].map((d) => (
                              <span
                                key={d}
                                className="neo-chat-dot h-2 w-2 rounded-full bg-[#00D4FF]/70"
                                style={{ animationDelay: `${d * 0.16}s` }}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="z-10 shrink-0 border-t border-white/[0.06] bg-[#080a0f] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] sm:px-5 md:px-8 md:pt-4">
        <div className="mx-auto w-full max-w-[44rem]">
          <div className="flex w-full items-end gap-1 rounded-2xl border border-neutral-200/90 bg-white py-1.5 pl-3 pr-1.5 shadow-[0_2px_16px_rgba(0,0,0,0.12)] sm:gap-1.5 sm:pl-4 sm:pr-2">
            <textarea
              ref={inputRef}
              className="min-h-[44px] min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-2.5 text-[15px] leading-snug text-neutral-900 outline-none placeholder:text-neutral-400 focus-visible:ring-0"
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
