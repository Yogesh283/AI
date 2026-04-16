import { getStoredToken } from "./auth";

const API = () => process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8010";

export type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

export type ChatSource = "chat" | "voice";

/**
 * Sends Bearer JWT when logged in so the backend resolves the real user id and
 * persists turns to MySQL (`chat_messages` with `user_id`).
 */
export async function postChat(
  messages: ChatMsg[],
  userId = "default",
  opts?: { source?: ChatSource; useWeb?: boolean }
) {
  const source = opts?.source ?? "chat";
  const use_web = opts?.useWeb ?? false;
  const token = await getStoredToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(`${API()}/api/chat/`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, user_id: userId, source, use_web }),
  });
  if (!r.ok) {
    const t = (await r.text()).trim();
    throw new Error(t || `HTTP ${r.status}`);
  }
  return r.json() as Promise<{ reply: string; memory_snippets?: string[] }>;
}

/** Upload recorded audio; requires OpenAI key on backend for Whisper. */
export async function transcribeRecording(localUri: string) {
  const form = new FormData();
  form.append("audio", {
    uri: localUri,
    name: "clip.m4a",
    type: "audio/m4a",
  } as unknown as Blob);
  const r = await fetch(`${API()}/api/voice/transcribe`, {
    method: "POST",
    body: form,
    headers: { Accept: "application/json" },
  });
  const data = (await r.json()) as {
    text?: string;
    error?: string;
    hint?: string;
  };
  if (!r.ok) {
    throw new Error(data.hint || data.error || "transcribe_http_error");
  }
  if (data.error) {
    throw new Error(data.hint || data.error);
  }
  return (data.text || "").trim();
}
