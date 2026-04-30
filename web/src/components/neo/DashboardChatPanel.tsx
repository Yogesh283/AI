"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getStoredUser } from "@/lib/auth";
import { postChat, postChatStream, type ChatApiMessage } from "@/lib/api";
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
  NEO_CHAT_MESSAGES_CHANGED_EVENT,
  saveChatMessages,
} from "@/lib/chatStorage";
import { ChatMarkdown } from "@/components/neo/ChatMarkdown";
import { readStoredVoiceSpeechLang } from "@/lib/voiceLanguages";
import { executeNeoActions, processNeoCommandLine } from "@/lib/neoVoiceCommands";

type Msg = { role: "user" | "assistant"; content: string; imageDataUrl?: string };

/** JPEG data URL for chat attachment; shrinks until under ~110k chars for storage/API. */
async function compressImageToDataUrl(file: File): Promise<string> {
  const maxChars = 110_000;
  const read = (maxW: number, quality: number) =>
    new Promise<string>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        if (w < 1 || h < 1) {
          reject(new Error("bad image"));
          return;
        }
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("load"));
      };
      img.src = url;
    });

  for (const maxW of [960, 720, 560, 420, 320, 260]) {
    for (const q of [0.82, 0.72, 0.62, 0.52, 0.42]) {
      const dataUrl = await read(maxW, q);
      if (dataUrl.length <= maxChars) return dataUrl;
    }
  }
  throw new Error("too large");
}

function initialMsgs(displayName?: string | null): Msg[] {
  const name = shortDisplayNameForGreeting(displayName ?? undefined);
  const line = name
    ? `Hey ${name} — I'm ${NEO_ASSISTANT_NAME}. Chat here like you would with a person: ask anything, short or detailed — I'm listening.`
    : `Hi — I'm ${NEO_ASSISTANT_NAME}. Just type like you would to a friend; I'm here.`;
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
  const loadingRef = useRef(false);
  loadingRef.current = loading;
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
  /** When server pings live fetch, buffer streamed tokens until min ~3.5s “Searching…” window ends. */
  const liveSearchActiveRef = useRef(false);
  const liveSearchBufRef = useRef("");
  const liveSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [liveSearchUi, setLiveSearchUi] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{ dataUrl: string; name: string } | null>(null);
  const pendingAttachmentRef = useRef<{ dataUrl: string; name: string } | null>(null);
  pendingAttachmentRef.current = pendingAttachment;
  const imageInputRef = useRef<HTMLInputElement>(null);

  const resetConversation = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    const uid = getStoredUser()?.id ?? "anon";
    clearChatMessages(uid);
    setMsgs(initialMsgs(getStoredUser()?.display_name));
    setInput("");
    setLoading(false);
    liveSearchActiveRef.current = false;
    liveSearchBufRef.current = "";
    if (liveSearchTimerRef.current) {
      clearTimeout(liveSearchTimerRef.current);
      liveSearchTimerRef.current = null;
    }
    setLiveSearchUi(false);
    setPendingAttachment(null);
    setVoiceHint(null);
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

  /** Same-tab thread updates from other components using {@link NEO_CHAT_MESSAGES_CHANGED_EVENT}. */
  useEffect(() => {
    const onVoiceSynced = (e: Event) => {
      const ce = e as CustomEvent<{ userId?: string }>;
      const uid = getStoredUser()?.id ?? "anon";
      if (ce.detail?.userId && ce.detail.userId !== uid) return;
      const loaded = loadChatMessages(uid);
      if (loaded && loaded.length > 0) {
        setMsgs(loaded);
      }
    };
    window.addEventListener(NEO_CHAT_MESSAGES_CHANGED_EVENT, onVoiceSynced as EventListener);
    return () => window.removeEventListener(NEO_CHAT_MESSAGES_CHANGED_EVENT, onVoiceSynced as EventListener);
  }, []);

  useEffect(() => {
    const uid = getStoredUser()?.id ?? "anon";
    const persisted = msgs.map((m) => {
      if (m.role === "user" && m.imageDataUrl) {
        return {
          role: "user" as const,
          content: `${m.content}\n\n📷 (photo was attached — preview not kept after refresh)`.trim(),
        };
      }
      return { role: m.role, content: m.content };
    });
    saveChatMessages(uid, persisted);
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
      setVoiceHint("Voice: use Chrome or Edge and allow the microphone.");
      return;
    }
    if (loading) return;
    setVoiceHint(null);
    dictationBaseRef.current = input.trimEnd();
    finalBuf.current = "";
    interimRef.current = "";

    const rec = createSpeechRecognition(readStoredVoiceSpeechLang());
    if (!rec) {
      setVoiceHint("Could not start speech recognition.");
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
      setVoiceHint("Mic is busy — try again.");
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

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      if (liveSearchTimerRef.current) {
        clearTimeout(liveSearchTimerRef.current);
        liveSearchTimerRef.current = null;
      }
    };
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (loadingRef.current) return;
    const trimmed = text.trim();
    const attach = pendingAttachmentRef.current;
    if (!trimmed && !attach) return;
    const cur = msgsRef.current;

    /* Same intent router as Profile voice (Hello Neo) — typed “Neo, open YouTube” behaves like spoken command. */
    if (trimmed) {
      const neo = processNeoCommandLine(trimmed, "text", {
        speechLang: readStoredVoiceSpeechLang(),
        displayName: getStoredUser()?.display_name ?? undefined,
      });
      if (neo.actions.length > 0) {
        setInput("");
        setPendingAttachment(null);
        pendingAttachmentRef.current = null;
        const ack = neo.reply.trim() || "Done.";
        const next: Msg[] = [...cur, { role: "user", content: trimmed }, { role: "assistant", content: ack }];
        setMsgs(next);
        msgsRef.current = next;
        executeNeoActions(neo.actions);
        return;
      }
    }

    setInput("");
    setPendingAttachment(null);
    pendingAttachmentRef.current = null;

    streamAbortRef.current?.abort();
    streamAbortRef.current = new AbortController();
    const signal = streamAbortRef.current.signal;

    const displayUserText = trimmed || (attach ? "📷" : "");

    const userMsg: Msg = {
      role: "user",
      content: displayUserText,
      ...(attach ? { imageDataUrl: attach.dataUrl } : {}),
    };
    const next: Msg[] = [...cur, userMsg, { role: "assistant", content: "" }];
    setMsgs(next);
    msgsRef.current = next;
    setLoading(true);
    liveSearchActiveRef.current = false;
    liveSearchBufRef.current = "";
    if (liveSearchTimerRef.current) {
      clearTimeout(liveSearchTimerRef.current);
      liveSearchTimerRef.current = null;
    }
    setLiveSearchUi(false);

    const flushLiveSearchBuffer = () => {
      const b = liveSearchBufRef.current;
      liveSearchBufRef.current = "";
      if (!b) return;
      setMsgs((prev) => {
        const out = [...prev];
        const L = out.length - 1;
        if (L >= 0 && out[L].role === "assistant") {
          out[L] = { role: "assistant", content: out[L].content + b };
        }
        return out;
      });
    };

    const scheduleLiveSearchReveal = () => {
      if (liveSearchTimerRef.current) return;
      liveSearchTimerRef.current = setTimeout(() => {
        liveSearchTimerRef.current = null;
        liveSearchActiveRef.current = false;
        setLiveSearchUi(false);
        flushLiveSearchBuffer();
      }, 3500);
    };

    try {
      const apiMsgs = next.slice(0, -1).map((m) => {
        if (m.role === "user" && m.imageDataUrl) {
          const c = m.content.trim() === "📷" ? "" : m.content;
          return { role: "user" as const, content: c, image_url: m.imageDataUrl };
        }
        return { role: m.role as "user" | "assistant", content: m.content };
      });
      const uid = getStoredUser()?.id ?? "default";
      await postChatStream(
        apiMsgs,
        uid,
        {
          useWeb: true,
          signal,
          /** Typed web chat UI is English-first; avoids Hindi replies on short Latin messages (e.g. image + “Hello”). */
          speechLang: "en-IN",
          onLiveFetchStart: () => {
            liveSearchActiveRef.current = true;
            liveSearchBufRef.current = "";
            setLiveSearchUi(true);
            scheduleLiveSearchReveal();
          },
        },
        (delta) => {
          if (liveSearchActiveRef.current) {
            liveSearchBufRef.current += delta;
            return;
          }
          setMsgs((prev) => {
            const out = [...prev];
            const L = out.length - 1;
            if (L >= 0 && out[L].role === "assistant") {
              out[L] = { role: "assistant", content: out[L].content + delta };
            }
            return out;
          });
        },
      );
      /* Stream finished but no text (rare) — same payload as non-stream so user always sees a reply. */
      const after = msgsRef.current;
      const lastIdx = after.length - 1;
      if (
        lastIdx >= 0 &&
        after[lastIdx]?.role === "assistant" &&
        !after[lastIdx].content.trim() &&
        !signal.aborted
      ) {
        const fbMsgs: ChatApiMessage[] = after.slice(0, -1).map((m) => {
          if (m.role === "user" && m.imageDataUrl) {
            const c = m.content.trim() === "📷" ? "" : m.content;
            return { role: "user", content: c, image_url: m.imageDataUrl };
          }
          return { role: m.role, content: m.content };
        });
        try {
          const j = await postChat(fbMsgs, uid, {
            source: "chat",
            useWeb: true,
            speechLang: "en-IN",
          });
          const reply = (j.reply || "").trim() || "No reply from server.";
          setMsgs((prev) => {
            const out = [...prev];
            const L = out.length - 1;
            if (L >= 0 && out[L].role === "assistant") {
              out[L] = { role: "assistant", content: reply };
            }
            msgsRef.current = out;
            return out;
          });
        } catch (fe) {
          const hint =
            fe instanceof Error && fe.message.trim()
              ? fe.message
              : "Could not load a fallback reply.";
          setMsgs((prev) => {
            const out = [...prev];
            const L = out.length - 1;
            if (L >= 0 && out[L].role === "assistant") {
              out[L] = {
                role: "assistant",
                content: `Chat fallback failed: ${hint}`,
              };
            }
            msgsRef.current = out;
            return out;
          });
        }
      }
      setMsgs((prev) => {
        msgsRef.current = prev;
        return prev;
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        if (liveSearchTimerRef.current) {
          clearTimeout(liveSearchTimerRef.current);
          liveSearchTimerRef.current = null;
        }
        liveSearchActiveRef.current = false;
        liveSearchBufRef.current = "";
        setLiveSearchUi(false);
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
      if (liveSearchTimerRef.current) {
        clearTimeout(liveSearchTimerRef.current);
        liveSearchTimerRef.current = null;
      }
      if (liveSearchActiveRef.current) {
        liveSearchActiveRef.current = false;
        setLiveSearchUi(false);
        const b = liveSearchBufRef.current;
        liveSearchBufRef.current = "";
        if (b) {
          setMsgs((prev) => {
            const out = [...prev];
            const L = out.length - 1;
            if (L >= 0 && out[L].role === "assistant") {
              out[L] = { role: "assistant", content: out[L].content + b };
            }
            msgsRef.current = out;
            return out;
          });
        }
      }
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
    if (loadingRef.current) return;
    void sendMessage(input);
  }

  const canClearChat = msgs.length > 1 || input.trim().length > 0 || Boolean(pendingAttachment);

  return (
    <div className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F5F7FA]">
      <div className="shrink-0 border-b border-slate-200/70 bg-[#F5F7FA] px-3 py-2 sm:px-5 md:px-8">
        <div className="mx-auto flex max-w-[52rem] items-center justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (!canClearChat) {
                resetConversation();
                return;
              }
              if (
                typeof window !== "undefined" &&
                !window.confirm("Clear all chat messages on this device? This cannot be undone.")
              ) {
                return;
              }
              resetConversation();
            }}
            className="rounded-[12px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-[2px_3px_10px_rgba(15,23,42,0.05)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40"
            title="Start fresh — clears thread and composer"
          >
            Clear chat
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="neo-chat-scroll min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth bg-[#F5F7FA] px-3 py-5 sm:px-5 md:px-8 md:py-6"
      >
        <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-5 md:gap-6">
          <article className="flex gap-3 sm:gap-4">
            <ChatAssistantAvatar className="mt-0.5" />
            <div className="neo-list-row min-w-0 flex-1 rounded-[16px] px-4 py-3 sm:px-5 sm:py-3.5">
              <p className="line-clamp-2 text-[15px] leading-relaxed text-slate-800 sm:line-clamp-none">
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
                        ? "inline-block max-w-[min(100%,92%)] rounded-[22px] border border-slate-200/90 bg-[linear-gradient(145deg,#ffffff,#eef2f7)] px-4 py-2.5 text-right shadow-[6px_8px_18px_rgba(15,23,42,0.06)] sm:max-w-[85%]"
                        : "neo-list-row rounded-[22px] px-4 py-2.5 text-left shadow-[4px_6px_14px_rgba(15,23,42,0.05)] sm:px-5 sm:py-3"
                    }
                  >
                    {m.role === "user" ? (
                      <div className="text-[15px] leading-relaxed text-slate-900">
                        {m.imageDataUrl ? (
                          <img
                            src={m.imageDataUrl}
                            alt=""
                            className="mb-2 max-h-52 w-full max-w-xs rounded-xl border border-slate-200/90 object-contain shadow-sm"
                          />
                        ) : null}
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                      </div>
                    ) : (
                      <div className="text-[15px] leading-relaxed text-slate-800">
                        {loading && isLast && liveSearchUi ? (
                          <p className="text-[#2563EB]">
                            Searching Google for live data…
                            <span className="ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 animate-pulse rounded-sm bg-[#2563EB] align-middle" aria-hidden />
                          </p>
                        ) : m.content.trim().length > 0 ? (
                          <div className="inline-block max-w-full text-left">
                            <ChatMarkdown text={m.content} />
                            {loading && isLast ? (
                              <span
                                className="ml-0.5 inline-block h-4 w-[3px] translate-y-0.5 animate-pulse rounded-sm bg-[#2563EB] align-middle"
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
                                className="neo-chat-dot h-2 w-2 rounded-full bg-[#2563EB]/70"
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

      <div className="z-10 shrink-0 border-t border-slate-200/90 bg-[#EDEFF3] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_32px_rgba(15,23,42,0.06)] sm:px-5 md:px-8 md:pt-4">
        <div className="mx-auto w-full max-w-[52rem]">
          {pendingAttachment ? (
            <div className="mb-2 flex items-center gap-2 rounded-[16px] border border-slate-200/90 bg-white/90 px-2.5 py-2 shadow-[4px_6px_14px_rgba(15,23,42,0.05)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingAttachment.dataUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded-lg border border-slate-200 object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-600">
                {pendingAttachment.name}
              </span>
              <button
                type="button"
                onClick={() => setPendingAttachment(null)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Remove image"
              >
                Remove
              </button>
            </div>
          ) : null}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f || !f.type.startsWith("image/")) return;
              void (async () => {
                try {
                  const dataUrl = await compressImageToDataUrl(f);
                  setPendingAttachment({ dataUrl, name: f.name });
                  setVoiceHint(null);
                } catch {
                  setVoiceHint("Could not use that image — try a smaller JPG or PNG.");
                }
              })();
            }}
          />
          <div className="flex w-full items-end gap-1.5 rounded-[24px] border border-white bg-[linear-gradient(180deg,#fafbfd,#eef2f7)] py-2 pl-3 pr-2 shadow-[8px_10px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/60 backdrop-blur-md sm:gap-2 sm:pl-4 sm:pr-2.5">
            <textarea
              ref={inputRef}
              className="min-h-[44px] min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-2.5 text-[15px] leading-snug text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-0"
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
              onClick={() => toggleVoice()}
              disabled={loading}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] text-slate-600 transition duration-300 hover:bg-slate-200/90 disabled:opacity-40 ${
                voiceListening ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400/45" : ""
              }`}
              aria-pressed={voiceListening}
              aria-label={voiceListening ? "Stop voice input" : "Voice input"}
              title={voiceListening ? "Press to stop" : "Speak to type"}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  fill="currentColor"
                  d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0H5a7 7 0 0 0 6 6.92V22h2v-4.08A7 7 0 0 0 19 11h-1Z"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={loading || voiceListening}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-sky-100/90 text-sky-800 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.25)] transition duration-300 hover:bg-sky-200/90 disabled:pointer-events-none disabled:opacity-35"
              aria-label="Attach image"
              title="Upload image"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2 1.586-1.586a2 2 0 0 1 2.828 0L20 14M6 20h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.17a2 2 0 0 1-1.41-.59l-1.83-1.83A2 2 0 0 0 9.17 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
                  stroke="currentColor"
                  strokeWidth="1.65"
                  strokeLinejoin="round"
                />
                <circle cx="9" cy="9" r="1.5" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={loading || voiceListening || (!input.trim() && !pendingAttachment)}
              className="neo-gradient-fill flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)] transition duration-300 hover:scale-[1.04] hover:brightness-105 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35"
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
          </div>
          {voiceHint ? (
            <p className="mt-2.5 text-center text-[11px] text-amber-400/95" role="status">
              {voiceHint}
            </p>
          ) : voiceListening ? (
            <p className="mt-2.5 text-center text-[11px] text-emerald-400/85">
              Listening… press the mic again to stop
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
