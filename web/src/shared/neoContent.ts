/**
 * Single source of truth for NeoXAI web (Next.js) and mobile (Expo / APK).
 * Keep strings and navigation targets aligned across platforms.
 */

export const SPLASH = {
  tagline: "Your Personal AI Assistant",
  loadingLabel: "Loading Intelligence...",
} as const;

export const DASHBOARD = {
  greetingLine: "Your personal assistant — chat, voice & live answers when you need them.",
  overviewTitle: "Today's Overview",
  stats: [
    { n: "3", l: "Tasks", tone: "cyan" as const },
    { n: "2", l: "Meetings", tone: "magenta" as const },
    { n: "8", l: "Messages", tone: "purple" as const },
  ],
  /** Large 2×2 tiles */
  mainTiles: [
    {
      label: "Chat",
      sub: "AI Chat",
      icon: "💬",
      webHref: "/dashboard",
      mobilePath: "/(tabs)" as const,
    },
    {
      label: "Voice",
      sub: "Voice Mode",
      icon: "🎙",
      webHref: "/voice",
      mobilePath: "/(tabs)" as const,
    },
    {
      label: "Memory",
      sub: "Saved context",
      icon: "🧠",
      webHref: "/memory",
      mobilePath: "/(tabs)/memory" as const,
    },
    {
      label: "Profile",
      sub: "Account",
      icon: "👤",
      webHref: "/profile",
      mobilePath: "/(tabs)/profile" as const,
    },
  ],
  /** Bottom row of small shortcuts */
  quickActions: [
    {
      label: "Chat",
      icon: "💬",
      webHref: "/dashboard",
      mobilePath: "/(tabs)" as const,
    },
    {
      label: "Voice",
      icon: "🎙",
      webHref: "/voice",
      mobilePath: "/(tabs)/voice" as const,
    },
    {
      label: "Memory",
      icon: "🧠",
      webHref: "/memory",
      mobilePath: "/(tabs)/memory" as const,
    },
    {
      label: "Profile",
      icon: "👤",
      webHref: "/profile",
      mobilePath: "/(tabs)/profile" as const,
    },
  ],
  memoryTitle: "NeoXAI Memory",
  memoryLines: [
    { text: "You like morning workouts", tone: "cyan" as const },
    { text: "Favorite topic: Tech & AI", tone: "magenta" as const },
    { text: "Prefers concise answers", tone: "purple" as const },
  ],
  openChat: "Open Chat",
  quickTasksTitle: "Quick tasks",
} as const;

/** Smaller suggestion tiles (same on web + APK) */
export const REF_TASKS = [
  {
    label: "Summarize PDF",
    webHref: "/dashboard",
    mobilePath: "/(tabs)" as const,
  },
  {
    label: "Quick question",
    webHref: "/dashboard",
    mobilePath: "/(tabs)" as const,
  },
  {
    label: "Write an Email",
    webHref: "/dashboard",
    mobilePath: "/(tabs)" as const,
  },
  {
    label: "Plan Workout",
    webHref: "/dashboard",
    mobilePath: "/(tabs)" as const,
  },
] as const;
