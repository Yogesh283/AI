export const NEO_AVATAR_STORAGE_KEY = "neo-avatar-id";

export type NeoAvatar = {
  id: string;
  name: string;
  emoji: string;
};

/** Placeholder “faces” per companion — swap for real images later */
export const NEO_AVATARS: NeoAvatar[] = [
  { id: "neo-core", name: "NeoXAI Core", emoji: "🤖" },
  { id: "nova", name: "Nova", emoji: "✨" },
  { id: "atlas", name: "Atlas", emoji: "🛡️" },
  { id: "spark", name: "Spark", emoji: "⚡" },
  { id: "luna", name: "Luna", emoji: "🌙" },
  { id: "astra", name: "Astra", emoji: "🌟" },
  { id: "yuna", name: "Yuna", emoji: "👩" },
];

export function getNeoAvatar(id: string | null | undefined): NeoAvatar {
  const found = NEO_AVATARS.find((a) => a.id === id);
  return found ?? NEO_AVATARS[0];
}

export function readStoredAvatarId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(NEO_AVATAR_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeStoredAvatarId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NEO_AVATAR_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
