/**
 * Persist chat thread locally so history survives refresh until user starts "New chat".
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };

const PREFIX = "neo-chat-msgs-v1-";

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
