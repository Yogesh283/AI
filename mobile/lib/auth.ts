import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "neo-token";
const USER_KEY = "neo-user";

export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  auth_provider?: string;
  /** Matches web voice persona (`sara` = woman, `arjun` = man). */
  voice_persona_id?: string;
};

const apiBase = () =>
  process.env.EXPO_PUBLIC_API_URL ?? "http://127.0.0.1:8010";

export async function getStoredToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export async function saveSession(token: string, user: AuthUser) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function clearSession() {
  await AsyncStorage.removeItem(TOKEN_KEY);
  await AsyncStorage.removeItem(USER_KEY);
}

export async function registerApi(body: {
  email: string;
  password: string;
  display_name?: string;
}) {
  const r = await fetch(`${apiBase()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "Register failed");
  }
  return r.json() as Promise<{
    access_token: string;
    user: AuthUser;
  }>;
}

export async function loginApi(body: { email: string; password: string }) {
  const r = await fetch(`${apiBase()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "Login failed");
  }
  return r.json() as Promise<{
    access_token: string;
    user: AuthUser;
  }>;
}

export async function patchVoicePersona(voice_persona_id: string): Promise<AuthUser> {
  const token = await getStoredToken();
  if (!token) throw new Error("Not authenticated");
  const r = await fetch(`${apiBase()}/api/auth/me/voice-persona`, {
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
  await saveSession(token, j.user);
  return j.user;
}

export async function googleLoginApi(idToken: string) {
  const r = await fetch(`${apiBase()}/api/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "Google sign-in failed");
  }
  return r.json() as Promise<{
    access_token: string;
    user: AuthUser;
  }>;
}
