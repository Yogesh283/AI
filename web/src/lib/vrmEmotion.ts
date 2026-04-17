import type { VoiceReplyMood } from "@/lib/voiceReplyMood";

export type AvatarEmotion = "neutral" | "happy" | "sad" | "angry" | "surprised";

/** Map voice TTS mood heuristics → VRM expression presets */
export function avatarEmotionFromVoiceMood(mood: VoiceReplyMood): AvatarEmotion {
  switch (mood) {
    case "laugh":
    case "excited":
      return "happy";
    case "sympathy":
      return "sad";
    case "question":
      return "surprised";
    case "think":
    case "neutral":
    default:
      return "neutral";
  }
}

/**
 * Lightweight keyword-based mood from assistant text (English + Hindi).
 * For richer mapping, swap this for sentiment API or model output.
 */
export function inferEmotionFromText(text: string): AvatarEmotion {
  const t = (text || "").toLowerCase();

  const angry =
    /\b(angry|furious|hate|annoyed|ridiculous|unacceptable)\b/i.test(t) ||
    /(गुस्सा|गुस्से|नाराज|पागल|बकवास)/i.test(t);

  const sad =
    /\b(sad|sorry|unfortunately|miss|cry|depressed|worried|pain)\b/i.test(t) ||
    /(दुख|उदास|माफ|क्षमा|दुखी|रो|पीड़ा|पीडा)/i.test(t);

  const surprised =
    /\b(wow|whoa|really\?|unexpected|amazing|surprising|omg)\b/i.test(t) ||
    /(वाह|हैरान|अचंभा|वाकई|सचमुच)/i.test(t);

  const happy =
    /\b(yay|nice|great|awesome|love|lol|haha|perfect|thanks|thank you|good|wonderful|excellent)\b/i.test(t) ||
    /(खुश|धन्यवाद|बढ़िया|शानदार|अच्छा|हँस|हंस|मज़ा|मजा|प्यार|लोल)/i.test(t);

  if (angry) return "angry";
  if (sad) return "sad";
  if (surprised) return "surprised";
  if (happy) return "happy";
  return "neutral";
}
