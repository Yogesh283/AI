export const NEO_AVATAR_STORAGE_KEY = "neo-avatar-id";

export type NeoAvatar = {
  id: string;
  name: string;
  /** Legacy / fallback */
  emoji: string;
  /** Illustrated human portrait (public/) */
  imageSrc: string;
};

export const NEO_AVATARS: NeoAvatar[] = [
  { id: "neo-core", name: "NeoXAI Core", emoji: "🤖", imageSrc: "/avatars/human-neo-core.svg" },
  { id: "nova", name: "Nova", emoji: "✨", imageSrc: "/avatars/human-nova.svg" },
  { id: "atlas", name: "Atlas", emoji: "🛡️", imageSrc: "/avatars/human-atlas.svg" },
  { id: "spark", name: "Spark", emoji: "⚡", imageSrc: "/avatars/human-spark.svg" },
  { id: "luna", name: "Luna", emoji: "🌙", imageSrc: "/avatars/human-luna.svg" },
  { id: "astra", name: "Astra", emoji: "🌟", imageSrc: "/avatars/human-astra.svg" },
  { id: "yuna", name: "Yuna", emoji: "👩", imageSrc: "/avatars/human-yuna.svg" },
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
