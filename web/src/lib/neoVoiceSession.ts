/**
 * After "Neo" / "Hello Neo" with no command, the assistant speaks a short wake ack, then this window is active
 * (~18s) so the user can speak the next phrase without saying "Neo" again. Web only — resets on navigation.
 */

let followUpUntil = 0;

export function startNeoFollowUpSession(durationMs = 18000): void {
  followUpUntil = Date.now() + durationMs;
}

export function isNeoFollowUpActive(): boolean {
  return Date.now() < followUpUntil;
}

export function clearNeoFollowUpSession(): void {
  followUpUntil = 0;
}
