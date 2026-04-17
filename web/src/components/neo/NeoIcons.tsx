export function IconHome({ active }: { active?: boolean }) {
  const c = active ? "#00D4FF" : "rgba(255,255,255,0.4)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke={c}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChat({ active }: { active?: boolean }) {
  const c = active ? "#00D4FF" : "rgba(255,255,255,0.4)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 6h16v10H8l-4 3V6Z"
        stroke={c}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconMemory({ active }: { active?: boolean }) {
  const c = active ? "#00D4FF" : "rgba(255,255,255,0.4)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c4.97 0 9 3.58 9 8s-4.03 8-9 8c-.94 0-1.84-.13-2.68-.37L4 21l1.2-4.8C4.43 14.6 3 12.4 3 11c0-4.42 4.03-8 9-8Z"
        stroke={c}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconUser({ active }: { active?: boolean }) {
  const c = active ? "#00D4FF" : "rgba(255,255,255,0.4)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.5" stroke={c} strokeWidth="1.6" />
      <path
        d="M5 20c.5-3.5 3.5-6 7-6s6.5 2.5 7 6"
        stroke={c}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMicCenter() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fill="#0a0a0a"
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm6-3a6 6 0 0 1-12 0H5a7 7 0 0 0 6 6.92V22h2v-4.08A7 7 0 0 0 19 11h-1Z"
      />
    </svg>
  );
}

/** Sidebar: 3D avatar + chat + TTS demo */
export function IconCube3D({ active }: { active?: boolean }) {
  const c = active ? "#00D4FF" : "rgba(255,255,255,0.4)";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l6.5 3.75v7.5L12 17l-6.5-3.75v-7.5L12 2z"
        stroke={c}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 6.25L12 10l6.5-3.75M12 10v8"
        stroke={c}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}

export function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm8-4H4l1.7-1.7A2 2 0 0 0 7 14.5V9a5 5 0 1 1 10 0v5.5a2 2 0 0 0 1.3 1.8L20 18Z"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconBack() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M15 18l-6-6 6-6"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconSettings() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="rgba(255,255,255,0.75)"
        strokeWidth="1.5"
      />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .73 1.7 1.7 0 0 0-.2 1.31V22a2 2 0 1 1-4 0v-.56a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.31-.2 1.7 1.7 0 0 0-.87.48l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.31-.2H3a2 2 0 1 1 0-4h.29a1.7 1.7 0 0 0 1.31-.2 1.7 1.7 0 0 0 .87-.48l.06-.06a2 2 0 1 1 2.83-2.83l.06.06c.25.25.56.43.9.53V4a2 2 0 1 1 4 0v.29c0 .5.2.98.55 1.33.35.35.83.55 1.33.55H15a1.7 1.7 0 0 0 1.55-1.11c.1-.34.1-.7 0-1.04l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06c.25.25.43.56.53.9H22a2 2 0 1 1 0 4h-.56a1.7 1.7 0 0 0-1.55 1.11Z"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.1"
      />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" />
      <path d="M15 15l5 5" stroke="rgba(255,255,255,0.55)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconGrid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path fill="rgba(255,255,255,0.55)" d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z" />
    </svg>
  );
}
