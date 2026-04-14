/**
 * Single source of truth for NeoXAI web (Next.js) and mobile (Expo / APK).
 * Keep strings and navigation targets aligned across platforms.
 */

export const SPLASH = {
  tagline: "Your AI Companion",
  loadingLabel: "Loading Intelligence...",
} as const;

export const DASHBOARD = {
  greetingLine: "Ready to assist you.",
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
      webHref: "/chat",
      mobilePath: "/chat" as const,
    },
    {
      label: "Voice",
      sub: "Voice Mode",
      icon: "🎙",
      webHref: "/voice",
      mobilePath: "/(tabs)/voice" as const,
    },
    {
      label: "Generate Image",
      sub: "DALL·E style",
      icon: "🖼",
      webHref: "/tools",
      mobilePath: "/(tabs)/tools" as const,
    },
    {
      label: "Tools",
      sub: "Writer, Code...",
      icon: "⚡",
      webHref: "/tools",
      mobilePath: "/(tabs)/tools" as const,
    },
  ],
  /** Bottom row of small shortcuts */
  quickActions: [
    {
      label: "Chat",
      icon: "💬",
      webHref: "/chat",
      mobilePath: "/chat" as const,
    },
    {
      label: "Voice",
      icon: "🎙",
      webHref: "/voice",
      mobilePath: "/(tabs)/voice" as const,
    },
    {
      label: "Image",
      icon: "🖼",
      webHref: "/tools",
      mobilePath: "/(tabs)/tools" as const,
    },
    {
      label: "Tools",
      icon: "⚙",
      webHref: "/tools",
      mobilePath: "/(tabs)/tools" as const,
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
    webHref: "/tools",
    mobilePath: "/(tabs)/tools" as const,
  },
  {
    label: "Create Image",
    webHref: "/tools",
    mobilePath: "/(tabs)/tools" as const,
  },
  {
    label: "Write an Email",
    webHref: "/chat",
    mobilePath: "/chat" as const,
  },
  {
    label: "Plan Workout",
    webHref: "/chat",
    mobilePath: "/chat" as const,
  },
] as const;
