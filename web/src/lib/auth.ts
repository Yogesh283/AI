import { apiOrigin } from "@/lib/apiBase";
import { writeTtsGender } from "@/lib/voiceChat";
import { getVoicePersona, writeStoredVoicePersonaId } from "@/lib/voicePersonas";

const TOKEN_KEY = "neo-token";
const USER_KEY = "neo-user";

export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  auth_provider?: string;
  /** Voice page human persona; persisted in MySQL when logged in */
  voice_persona_id?: string;
};

const base = () => apiOrigin();

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function saveSession(token: string, user: AuthUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (user.voice_persona_id) {
    writeStoredVoicePersonaId(user.voice_persona_id);
    writeTtsGender(getVoicePersona(user.voice_persona_id).ttsGender);
  }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function registerApi(body: {
  email: string;
  password: string;
  display_name?: string;
}) {
  const r = await fetch(`${base()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { detail?: string | { msg: string } };
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* raw */
    }
    throw new Error(msg || "Register failed");
  }
  return r.json() as Promise<{
    access_token: string;
    token_type: string;
    user: AuthUser;
  }>;
}

export async function loginApi(body: { email: string; password: string }) {
  const r = await fetch(`${base()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { detail?: string };
      msg = typeof j.detail === "string" ? j.detail : msg;
    } catch {
      /* raw */
    }
    throw new Error(msg || "Login failed");
  }
  return r.json() as Promise<{
    access_token: string;
    token_type: string;
    user: AuthUser;
  }>;
}

export async function googleLoginApi(idToken: string) {
  const r = await fetch(`${base()}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { detail?: string };
      msg = typeof j.detail === "string" ? j.detail : msg;
    } catch {
      /* raw */
    }
    throw new Error(msg || "Google sign-in failed");
  }
  return r.json() as Promise<{
    access_token: string;
    token_type: string;
    user: AuthUser;
  }>;
}

export async function fetchMe(): Promise<AuthUser> {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated");
  const r = await fetch(`${base()}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const t = (await r.text()).trim();
    throw new Error(t || `HTTP ${r.status}`);
  }
  const j = (await r.json()) as { user: AuthUser };
  return j.user;
}

export async function patchMe(body: {
  display_name?: string;
  current_password?: string;
  new_password?: string;
}): Promise<AuthUser> {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated");
  const r = await fetch(`${base()}/api/auth/me`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let msg = await r.text();
    try {
      const j = JSON.parse(msg) as { detail?: string | { msg?: string } };
      msg =
        typeof j.detail === "string"
          ? j.detail
          : JSON.stringify(j.detail ?? msg);
    } catch {
      /* raw */
    }
    throw new Error(msg || `HTTP ${r.status}`);
  }
  const j = (await r.json()) as { user: AuthUser };
  saveSession(token, j.user);
  return j.user;
}

export async function patchVoicePersona(voice_persona_id: string): Promise<AuthUser> {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated");
  const r = await fetch(`${base()}/api/auth/me/voice-persona`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ voice_persona_id }),
  });
  if (!r.ok) {
    const t = (await r.text()).trim();
    throw new Error(t || `HTTP ${r.status}`);
  }
  const j = (await r.json()) as { user: AuthUser };
  return j.user;
}
