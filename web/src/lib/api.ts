import { apiOrigin } from "@/lib/apiBase";
import { getStoredToken } from "@/lib/auth";

function chatUrl(): string {
  const b = apiOrigin().replace(/\/$/, "");
  return `${b}/api/chat`;
}

export type ChatSource = "chat" | "voice";

/** Chat POST body: optional `image_url` data URL for OpenAI vision (dashboard). */
export type ChatApiMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  image_url?: string;
};

const MAX_CHAT_CONTEXT_MESSAGES = 12;

function trimChatContext(messages: ChatApiMessage[]) {
  if (messages.length <= MAX_CHAT_CONTEXT_MESSAGES) return messages;
  return messages.slice(-MAX_CHAT_CONTEXT_MESSAGES);
}

export async function postChat(
  messages: ChatApiMessage[],
  userId = "default",
  opts?: { source?: ChatSource; useWeb?: boolean; speechLang?: string }
) {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = chatUrl();
  const source = opts?.source ?? "chat";
  const use_web = opts?.useWeb ?? false;
  const speech_lang = opts?.speechLang?.trim() || undefined;
  let r: Response;
  try {
    const trimmedMessages = trimChatContext(messages);
    r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: trimmedMessages,
        user_id: userId,
        source,
        use_web,
        ...(speech_lang ? { speech_lang } : {}),
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg.trim() || "fetch failed"
    );
  }
  if (!r.ok) {
    const t = (await r.text()).trim();
    let msg = t;
    try {
      const j = JSON.parse(t) as { detail?: string | string[] };
      const d = j.detail;
      if (typeof d === "string" && d) msg = d;
      else if (Array.isArray(d) && d.length) msg = d.map(String).join("; ");
    } catch {
      /* plain text / HTML error body */
    }
    throw new Error(msg || `HTTP ${r.status} ${r.statusText}`);
  }
  return r.json() as Promise<{ reply: string; memory_snippets?: string[] }>;
}

/** Google live snippet block for voice Realtime injection (same backend pipeline as chat). */
export async function postLiveWebContext(query: string): Promise<{ block: string }> {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${chatUrl()}/live-context`;
  const r = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: query.trim().slice(0, 500) }),
  });
  if (!r.ok) {
    const t = (await r.text()).trim();
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json() as Promise<{ block: string }>;
}

/**
 * Streaming chat: POST /api/chat/stream (SSE). Calls `onDelta` for each token chunk.
 * Server may send `data: {"s":true}` first (live Google fetch starting); then `{"d":"..."}` lines,
 * then `data: {"done":true}`; errors: `{"e":"..."}`.
 */
export async function postChatStream(
  messages: ChatApiMessage[],
  userId: string,
  opts: {
    useWeb?: boolean;
    signal?: AbortSignal;
    source?: ChatSource;
    speechLang?: string;
    /** Fires once when server signals live web lookup (show “Searching…” UI). */
    onLiveFetchStart?: () => void;
  },
  onDelta: (chunk: string) => void,
): Promise<void> {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${chatUrl()}/stream`;
  const source: ChatSource = opts.source ?? "chat";
  const use_web = opts.useWeb ?? false;
  const speech_lang = opts.speechLang?.trim() || undefined;
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: trimChatContext(messages),
        user_id: userId,
        source,
        use_web,
        ...(speech_lang ? { speech_lang } : {}),
      }),
      signal: opts.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg.trim() || "fetch failed");
  }
  if (!r.ok) {
    const t = (await r.text()).trim();
    let msg = t;
    try {
      const j = JSON.parse(t) as { detail?: string | string[] };
      const d = j.detail;
      if (typeof d === "string" && d) msg = d;
      else if (Array.isArray(d) && d.length) msg = d.map(String).join("; ");
    } catch {
      /* plain */
    }
    throw new Error(msg || `HTTP ${r.status} ${r.statusText}`);
  }
  const reader = r.body?.getReader();
  if (!reader) throw new Error("Empty response body");
  const dec = new TextDecoder();
  let carry = "";
  let liveFetchPinged = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += dec.decode(value, { stream: true });
    const blocks = carry.split("\n\n");
    carry = blocks.pop() ?? "";
    for (const block of blocks) {
      for (const line of block.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === "[DONE]") continue;
        let j: { d?: string; done?: boolean; e?: string; s?: boolean };
        try {
          j = JSON.parse(raw) as { d?: string; done?: boolean; e?: string; s?: boolean };
        } catch {
          continue;
        }
        if (typeof j.e === "string" && j.e) throw new Error(j.e);
        if (j.s === true && !liveFetchPinged) {
          liveFetchPinged = true;
          opts.onLiveFetchStart?.();
        }
        if (typeof j.d === "string" && j.d.length) onDelta(j.d);
        if (j.done) return;
      }
    }
  }
}

export type MemoryChatRow = {
  id: number;
  role: string;
  content: string;
  created_at: string;
  /** `chat` | `voice` when provided by API */
  source?: string;
};

export async function getMemory(userId = "default") {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${apiOrigin().replace(/\/$/, "")}/api/memory?user_id=${encodeURIComponent(userId)}`;
  let r: Response;
  try {
    r = await fetch(url, { headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg.trim() || "fetch failed");
  }
  if (!r.ok) {
    const t = (await r.text()).trim();
    throw new Error(t || `HTTP ${r.status} ${r.statusText}`);
  }
  return r.json() as Promise<{
    user_id: string;
    profile: Record<string, unknown>;
    facts: { key: string; value: string }[];
    chat_messages: MemoryChatRow[];
    insights: string[];
  }>;
}

export type VoiceRealtimeTokenResponse = {
  client_secret: string;
  expires_at?: number;
  model: string;
  output_voice: string;
};

/** Ephemeral key for OpenAI Realtime WebRTC (server never exposes main API key). */
export async function postVoiceRealtimeToken(body: {
  speech_lang: string;
  persona_id: string;
}): Promise<VoiceRealtimeTokenResponse> {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${apiOrigin().replace(/\/$/, "")}/api/voice/realtime-token`;
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        speech_lang: body.speech_lang,
        persona_id: body.persona_id,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(msg.trim() || "fetch failed");
  }
  if (!r.ok) {
    const t = (await r.text()).trim();
    let msg = t;
    try {
      const j = JSON.parse(t) as { detail?: string | string[] };
      const d = j.detail;
      if (typeof d === "string" && d) msg = d;
      else if (Array.isArray(d) && d.length) msg = d.map(String).join("; ");
    } catch {
      /* plain */
    }
    throw new Error(msg || `HTTP ${r.status} ${r.statusText}`);
  }
  return r.json() as Promise<VoiceRealtimeTokenResponse>;
}
