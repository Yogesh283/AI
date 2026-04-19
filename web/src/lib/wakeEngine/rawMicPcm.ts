import type { ContinuousMicPcmSession, PcmFrameHandler } from "@/lib/wakeEngine/types";

/**
 * Taps one channel from an existing {@link MediaStream} via Web Audio (no second getUserMedia).
 * Feeds linear16 frames to your wake engine (Porcupine / Vosk WASM). Output is zero-gain so nothing plays to speakers.
 *
 * Prefer {@link AudioWorkletNode} for lower jitter when you add a worklet bundle; ScriptProcessor keeps zero webpack wiring.
 */
export async function startContinuousMicPcm(
  stream: MediaStream,
  onFrame: PcmFrameHandler,
  bufferLength = 4096,
): Promise<ContinuousMicPcmSession> {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    throw new Error("AudioContext not supported");
  }
  const ctx = new AC();
  if (ctx.state === "suspended") {
    await ctx.resume().catch(() => {});
  }
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(bufferLength, 1, 1);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  proc.onaudioprocess = (ev) => {
    const input = ev.inputBuffer.getChannelData(0);
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    onFrame(out, ctx.sampleRate);
  };
  source.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination);
  return {
    close() {
      try {
        proc.disconnect();
      } catch {
        /* ignore */
      }
      try {
        mute.disconnect();
      } catch {
        /* ignore */
      }
      try {
        source.disconnect();
      } catch {
        /* ignore */
      }
      void ctx.close();
    },
  };
}
