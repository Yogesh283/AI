/**
 * Per voice persona (Man / Woman) VRM URLs.
 * Set in `.env.local`:
 * - NEXT_PUBLIC_VRM_MODEL_URL_MALE
 * - NEXT_PUBLIC_VRM_MODEL_URL_FEMALE
 * - NEXT_PUBLIC_VRM_MODEL_URL (legacy: used when gender-specific unset)
 */

export type VoicePersonaVrmId = "arjun" | "sara";

const PIXIV_SAMPLE =
  "https://raw.githubusercontent.com/pixiv/three-vrm/release/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm";

/**
 * Male has no good public default that reads clearly male; without env we skip VRM
 * and show the geometric male bust. Woman keeps the Pixiv sample as default.
 */
export function resolveVrmModelUrlForPersona(personaId: string): string | null {
  const p: VoicePersonaVrmId = personaId === "arjun" ? "arjun" : "sara";
  const male = process.env.NEXT_PUBLIC_VRM_MODEL_URL_MALE?.trim();
  const female = process.env.NEXT_PUBLIC_VRM_MODEL_URL_FEMALE?.trim();
  const legacy = process.env.NEXT_PUBLIC_VRM_MODEL_URL?.trim();

  if (p === "arjun") return male || legacy || null;
  return female || legacy || PIXIV_SAMPLE;
}
