/** Int16 PCM chunk from the browser mic graph (see {@link startContinuousMicPcm}). */
export type PcmFrameHandler = (samples: Int16Array, sampleRateHz: number) => void;

export type ContinuousMicPcmSession = {
  /** Stops the audio graph; does not stop underlying MediaStream tracks. */
  close: () => void;
};
