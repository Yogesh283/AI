import { apiOrigin } from "@/lib/apiBase";
import { getStoredToken } from "@/lib/auth";

function chatUrl(): string {
  const b = apiOrigin().replace(/\/$/, "");
  return `${b}/api/chat`;
}

export type ChatSource = "chat" | "voice";

export async function postChat(
  messages: { role: "user" | "assistant" | "system"; content: string }[],
  userId = "default",
  opts?: { source?: ChatSource; useWeb?: boolean }
) {
  const token = getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = chatUrl();
  const source = opts?.source ?? "chat";
  const use_web = opts?.useWeb ?? false;
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages, user_id: userId, source, use_web }),
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
