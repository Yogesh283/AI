/**
 * Persist chat thread locally so history survives refresh until user starts "New chat".
 */

import { NEO_ASSISTANT_NAME } from "@/lib/siteBranding";

export type ChatTurn = { role: "user" | "assistant"; content: string };

const PREFIX = "neo-chat-msgs-v1-";

/** Same-tab + voice page: Dashboard reloads persisted messages when this fires. */
export const NEO_CHAT_MESSAGES_CHANGED_EVENT = "neo-chat-messages-changed";

function normTranscript(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

/** Avoid double-insert when Google and OpenAI Realtime both transcribe the same utterance. */
export function transcriptsRoughlySame(a: string, b: string): boolean {
  const x = normTranscript(a);
  const y = normTranscript(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x))) return true;
  return false;
}

function seedChatIfEmpty(userId: string): ChatTurn[] {
  const cur = loadChatMessages(userId);
  if (cur && cur.length > 0) return cur;
  return [
    {
      role: "assistant",
      content: `I'm ${NEO_ASSISTANT_NAME} — your typed chat and voice chat stay in sync here.`,
    },
  ];
}

/**
 * Append a user line from Live voice or Google STT fallback so /dashboard shows it without refresh.
 */
export function appendUserMessageToChatStorage(userId: string, text: string): void {
  if (typeof window === "undefined") return;
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) return;
  const cur = seedChatIfEmpty(userId);
  const last = cur[cur.length - 1];
  if (last?.role === "user") {
    if (last.content.trim() === line) return;
    if (transcriptsRoughlySame(last.content, line)) return;
  }
  const next: ChatTurn[] = [...cur, { role: "user", content: line }];
  saveChatMessages(userId, next);
  window.dispatchEvent(
    new CustomEvent(NEO_CHAT_MESSAGES_CHANGED_EVENT, { detail: { userId } } as CustomEventInit<{ userId: string }>),
  );
}

export function chatMessagesKey(userId: string): string {
  return `${PREFIX}${userId}`;
}

export function loadChatMessages(userId: string): ChatTurn[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(chatMessagesKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const out: ChatTurn[] = [];
    for (const m of parsed) {
      if (
        m &&
        typeof m === "object" &&
        (m as ChatTurn).role &&
        ((m as ChatTurn).role === "user" || (m as ChatTurn).role === "assistant") &&
        typeof (m as ChatTurn).content === "string"
      ) {
        out.push({ role: (m as ChatTurn).role, content: (m as ChatTurn).content });
      }
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

export function saveChatMessages(userId: string, messages: ChatTurn[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(chatMessagesKey(userId), JSON.stringify(messages));
  } catch {
    /* quota / private mode */
  }
}

export function clearChatMessages(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(chatMessagesKey(userId));
  } catch {
    /* ignore */
  }
}
