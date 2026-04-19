/**
 * After "Neo" / "Hello Neo" with no command, the assistant speaks a short wake ack, then this window is active
 * so the user can say the command **without** repeating the wake (a few seconds — not always-on listening).
 * Web only — resets on navigation.
 */

/** Default ~7.5s: enough for one follow-up command, then user should say "Hello Neo" again for the next cycle. */
const DEFAULT_COMMAND_WINDOW_MS = 7500;

let followUpUntil = 0;

export function startNeoFollowUpSession(durationMs = DEFAULT_COMMAND_WINDOW_MS): void {
  followUpUntil = Date.now() + durationMs;
}

export function isNeoFollowUpActive(): boolean {
  return Date.now() < followUpUntil;
}

export function clearNeoFollowUpSession(): void {
  followUpUntil = 0;
}
