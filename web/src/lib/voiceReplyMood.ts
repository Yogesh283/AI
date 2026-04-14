/**
 * Lightweight reply “mood” for voice + avatar (heuristics, not real NLP).
 * Drives TTS pitch and SpeakingAvatar body language.
 */

export type VoiceReplyMood =
  | "neutral"
  | "laugh"
  | "think"
  | "excited"
  | "question"
  | "sympathy";

const LAUGH =
  /\b(lol|lmao|rofl|haha|ha ha|hehe|heh|teehee|that's funny|how funny)\b/i;
const SYMPATHY =
  /\b(sorry|i'?m sorry|feel bad|that sucks|that rough|i understand|i hear you|take care|hoping you|get well|stay strong)\b/i;
const EXCITED =
  /\b(awesome|amazing|great job|fantastic|excellent|wonderful|love it|so happy|congrats|congratulations|wow)\b/i;
const THINK_START =
  /^(hmm+|well[, ]|so[, ]|let me (think|see)|basically|honestly|the thing is|i mean)/i;

/** Use the model’s raw reply (before TTS stripping). */
export function inferVoiceReplyMood(text: string): VoiceReplyMood {
  const t = text.trim();
  if (!t) return "neutral";

  if (/[\u{1F923}\u{1F602}\u{1F606}\u{1F605}\u{1F604}]/u.test(t)) return "laugh";
  if (LAUGH.test(t) || /(!\s*){3,}/.test(t)) return "laugh";
  if (SYMPATHY.test(t)) return "sympathy";
  if (EXCITED.test(t) || /(!\s*){2}/.test(t)) return "excited";
  if (THINK_START.test(t) || (t.includes("?") && t.split("?").length > 3)) return "think";
  if (t.endsWith("?") && t.length < 280) return "question";

  return "neutral";
}
