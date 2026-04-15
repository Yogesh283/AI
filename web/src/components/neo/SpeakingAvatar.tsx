"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import type { VoiceReplyMood } from "@/lib/voiceReplyMood";

type Props = {
  imageSrc: string;
  name: string;
  speaking: boolean;
  listening: boolean;
  sessionOn: boolean;
  /** Derived from the latest assistant reply — drives body language. */
  replyMood?: VoiceReplyMood;
  /** Model is generating text — subtle “thinking” pose. */
  thinking?: boolean;
  /** User is mid-utterance (interim STT) — attentive lean. */
  userTalking?: boolean;
};

/**
 * Reply-aware motion on a static portrait: glances, head tilt, laugh / think / question cues.
 * Still not a video avatar — browser TTS + CSS motion only.
 */
export function SpeakingAvatar({
  imageSrc,
  name,
  speaking,
  listening,
  sessionOn,
  replyMood = "neutral",
  thinking = false,
  userTalking = false,
}: Props) {
  const reduceMotion = useReducedMotion();
  const pulse = listening || speaking || sessionOn;
  const mouthIdle = listening && sessionOn && !speaking;
  /** While the model “thinks”, use a consistent reflective pose (not the previous reply mood). */
  const mood: VoiceReplyMood = thinking ? "think" : speaking ? replyMood : "neutral";

  const glanceX =
    mood === "think"
      ? [-4, 10, -8, 6, -5, 0]
      : mood === "question"
        ? [0, 12, 8, 0, -6, 0]
        : mood === "laugh"
          ? [0, -5, 6, -4, 5, 0]
          : mood === "excited"
            ? [0, 8, -10, 7, -7, 0]
            : mood === "sympathy"
              ? [0, 4, -3, 5, -4, 0]
              : [0, 7, -6, 5, -8, 4, 0];

  const headRotateY =
    mood === "think"
      ? [0, 5, -6, 4, -3, 0]
      : mood === "laugh"
        ? [0, -4, 5, -3, 4, 0]
        : [0, 3.5, -4, 3, -3.5, 0];

  const bodyY =
    mood === "laugh" && speaking
      ? [0, -4, -1, -5, -2, -4, 0]
      : speaking
        ? [0, -2.5, 0, -1.2, 0, -2, 0]
        : pulse          ? [0, -1, 0]
          : [0];

  const bodyRotate =
    mood === "laugh" && speaking
      ? [-0.5, 1.2, -1, 1.4, -0.8, 1, -0.5]
      : speaking
        ? [-0.9, 0.7, -0.5, 0.8, -0.6, 0.5, -0.9]
        : pulse
          ? [-0.3, 0.3, -0.3]
          : [0];

  const mouthDuration = mood === "laugh" ? 0.34 : mood === "think" ? 0.5 : 0.4;
  const handSpeed = mood === "excited" || mood === "laugh" ? 0.42 : 0.55;

  return (
    <div className="flex flex-col items-center" style={{ perspective: 920 }}>
      <div className="relative w-[min(17rem,72vw)] max-w-[280px]">
        {sessionOn ? (
          <motion.div
            className="pointer-events-none absolute inset-[-4%] rounded-[1.75rem] border border-[#00D4FF]/25"
            animate={
              reduceMotion ? {} : { opacity: listening ? [0.35, 0.85, 0.35] : 0.3 }
            }
            transition={{ duration: 2, repeat: reduceMotion ? 0 : Infinity }}
          />
        ) : null}

        <motion.div
          className="relative overflow-hidden rounded-[1.65rem] border border-white/[0.12] bg-gradient-to-b from-[#121a2e] to-[#080c14] shadow-[0_0_60px_rgba(0,212,255,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]"
          animate={
            reduceMotion
              ? {}
              : thinking
                ? { y: [0, 1.5, 0], rotate: [0.4, -0.5, 0.3, -0.4, 0], scale: [1, 0.995, 1] }
                : userTalking && sessionOn && !speaking
                  ? { y: [0, -1, 0], scale: [1, 1.008, 1] }
                  : speaking || pulse
                    ? {
                        y: bodyY,
                        rotate: bodyRotate,
                        scale: speaking
                          ? mood === "laugh"
                            ? [1, 1.018, 1.01, 1.02, 1.008, 1.015, 1]
                            : mood === "excited"
                              ? [1, 1.014, 1.008, 1.016, 1, 1.012, 1]
                              : [1, 1.012, 1, 1.008, 1, 1.01, 1]
                          : [1, 1.012, 1],
                      }
                    : {}
          }
          transition={{
            duration: speaking ? (mood === "laugh" ? 0.95 : 1.15) : thinking ? 2.2 : 2.2,
            repeat: speaking || pulse || thinking ? Infinity : 0,
            ease: "easeInOut",
          }}
        >
          <div
            className="relative aspect-[3/4] w-full overflow-hidden"
            style={{ transformStyle: "preserve-3d" }}
          >
            <motion.div
              className="absolute inset-0"
              animate={
                reduceMotion
                  ? {}
                  : thinking
                    ? {
                        x: [-2, 7, -5, 4, -3, 0],
                        rotateY: [0, 4, -5, 3, -2, 0],
                        rotateZ: [0, 0.4, -0.35, 0.25, 0],
                      }
                    : speaking
                      ? {
                          x: glanceX,
                          rotateY: headRotateY,
                          rotateZ:
                            mood === "question"
                              ? [0, -1.2, 0.8, -0.6, 0]
                              : mood === "sympathy"
                                ? [0, 0.5, -0.4, 0.3, 0]
                                : [0, 0.6, -0.5, 0.4, -0.3, 0],
                        }
                      : {}
              }
              transition={{
                duration: thinking ? 4.6 : mood === "think" ? 5.2 : mood === "laugh" ? 2.8 : 4.2,
                repeat: (speaking || thinking) && !reduceMotion ? Infinity : 0,
                ease: "easeInOut",
              }}
            >
              <Image
                src={imageSrc}
                alt={name}
                fill
                className="object-cover object-top"
                sizes="280px"
                priority
                unoptimized={imageSrc.endsWith(".svg")}
              />
            </motion.div>

            {!reduceMotion && speaking ? (
              <>
                <motion.div
                  className="pointer-events-none absolute bottom-[20.5%] left-1/2 z-[2] h-[2%] w-[12%] -translate-x-1/2 rounded-full bg-neutral-950/35"
                  aria-hidden
                  animate={{
                    scaleY:
                      mood === "laugh"
                        ? [1, 1.35, 1.85, 1.2, 1.9, 1.4, 1.6, 1]
                        : [1, 1.25, 1.55, 1.1, 1.7, 1.15, 1.45, 1],
                    scaleX:
                      mood === "laugh"
                        ? [1, 1.15, 0.92, 1.2, 0.95, 1.1, 1, 1]
                        : [1, 1.12, 0.95, 1.08, 1.02, 1.1, 0.98, 1],
                  }}
                  transition={{
                    duration: mouthDuration,
                    repeat: Infinity,
                    ease: [0.45, 0, 0.55, 1],
                    times: [0, 0.12, 0.28, 0.4, 0.55, 0.68, 0.82, 1],
                  }}
                />
                <motion.div
                  className="pointer-events-none absolute bottom-[18.2%] left-1/2 z-[2] h-[3.2%] w-[17%] -translate-x-1/2 rounded-[35%] bg-neutral-900/50 mix-blend-multiply"
                  aria-hidden
                  animate={{
                    scaleY:
                      mood === "laugh"
                        ? [0.9, 1.6, 1.1, 1.75, 1, 1.5, 1.2, 0.95]
                        : [0.85, 1.45, 1.05, 1.55, 0.95, 1.35, 1.1, 0.9],
                    opacity:
                      mood === "sympathy"
                        ? [0.4, 0.65, 0.45, 0.6, 0.42, 0.55, 0.48, 0.4]
                        : [0.45, 0.85, 0.55, 0.9, 0.5, 0.8, 0.65, 0.45],
                  }}
                  transition={{
                    duration: mouthDuration * 0.92,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.04,
                  }}
                />
                <motion.div
                  className="pointer-events-none absolute bottom-[6%] left-[5%] z-[2] h-[19%] w-[24%] rounded-[42%] bg-gradient-to-br from-white/28 to-white/6 opacity-75"
                  aria-hidden
                  animate={{
                    y:
                      mood === "laugh"
                        ? [0, -10, -5, -12, -4, -9, 0]
                        : [0, -7, -3, -8, -2, -6, 0],
                    rotate:
                      mood === "excited"
                        ? [0, 10, 5, 12, 4, 9, 0]
                        : [0, 7, 3, 9, 2, 8, 0],
                    x: [0, 3, 1, 4, 0, 2, 0],
                  }}
                  transition={{
                    duration: handSpeed,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
                <motion.div
                  className="pointer-events-none absolute bottom-[6%] right-[5%] z-[2] h-[19%] w-[24%] rounded-[42%] bg-gradient-to-bl from-white/28 to-white/6 opacity-75"
                  aria-hidden
                  animate={{
                    y:
                      mood === "laugh"
                        ? [0, -9, -12, -5, -10, -4, 0]
                        : [0, -6, -9, -4, -7, -3, 0],
                    rotate:
                      mood === "excited"
                        ? [0, -11, -6, -13, -5, -10, 0]
                        : [0, -8, -4, -10, -3, -9, 0],
                    x: [0, -3, -1, -4, 0, -2, 0],
                  }}
                  transition={{
                    duration: handSpeed + 0.02,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.07,
                  }}
                />
              </>
            ) : null}

            {!reduceMotion && mouthIdle ? (
              <motion.div
                className="pointer-events-none absolute bottom-[19%] left-1/2 z-[2] h-[2%] w-[11%] -translate-x-1/2 rounded-full bg-neutral-900/40 mix-blend-multiply"
                aria-hidden
                animate={{
                  scaleY: [1, 1.12, 1, 1.08, 1],
                  opacity: [0.35, 0.55, 0.4, 0.5, 0.35],
                }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
            ) : null}
          </div>
        </motion.div>

        <motion.div
          className="pointer-events-none absolute -bottom-1 left-1/2 h-[18%] w-[70%] -translate-x-1/2 rounded-full bg-[#00D4FF]/15 blur-2xl"
          animate={
            reduceMotion
              ? {}
              : { opacity: pulse ? [0.35, 0.65, 0.35] : 0.2, scale: pulse ? [1, 1.06, 1] : 1 }
          }
          transition={{ duration: 1.8, repeat: pulse && !reduceMotion ? Infinity : 0 }}
        />
      </div>

      <span className="mt-3 max-w-[14rem] truncate text-center text-[11px] font-semibold uppercase tracking-wider text-white/45">
        {name}
      </span>
    </div>
  );
}
