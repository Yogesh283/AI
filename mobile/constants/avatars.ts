import AsyncStorage from "@react-native-async-storage/async-storage";

export const NEO_AVATAR_STORAGE_KEY = "neo-avatar-id";

export type NeoAvatar = { id: string; name: string; emoji: string };

export const NEO_AVATARS: NeoAvatar[] = [
  { id: "neo-core", name: "NeoXAI Core", emoji: "🤖" },
  { id: "arc-hud", name: "Arc HUD", emoji: "◉" },
  { id: "nova", name: "Nova", emoji: "✨" },
  { id: "atlas", name: "Atlas", emoji: "🛡️" },
  { id: "spark", name: "Spark", emoji: "⚡" },
  { id: "luna", name: "Luna", emoji: "🌙" },
  { id: "astra", name: "Astra", emoji: "🌟" },
];

export function getNeoAvatar(id: string | null | undefined): NeoAvatar {
  const found = NEO_AVATARS.find((a) => a.id === id);
  return found ?? NEO_AVATARS[0];
}

export async function readStoredAvatarId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(NEO_AVATAR_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function writeStoredAvatarId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(NEO_AVATAR_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
