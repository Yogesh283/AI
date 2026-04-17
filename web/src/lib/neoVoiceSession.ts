/**
 * After "Neo" / wake-only with no command, user can speak the next phrase without saying "Neo" again
 * (Alexa-style follow-up). Web only — resets on navigation.
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
