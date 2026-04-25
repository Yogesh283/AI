/**
 * After "Neo" / "Hello Neo" with no command, the assistant speaks a short wake ack, then this window is active
 * so the user can say the command **without** repeating the wake (a few seconds). Not opened on every mic tap —
 * only after the wake phrase was recognized. Resets on navigation.
 */

/** ~9.5s: follow-up without repeating the wake (similar to smart-speaker command windows). */
const DEFAULT_COMMAND_WINDOW_MS = 9500;

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
