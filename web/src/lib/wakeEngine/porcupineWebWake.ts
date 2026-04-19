/**
 * Browser Porcupine (optional): `npm i @picovoice/porcupine-web`, copy WASM + `.ppn` into `public/porcupine/`,
 * set `NEXT_PUBLIC_PICOVOICE_ACCESS_KEY`, then dynamically import `@picovoice/porcupine-web` and push Int16 frames
 * from {@link startContinuousMicPcm} into `Porcupine.process` (or the worker API Picovoice documents for web).
 *
 * Vosk alternative: `vosk-browser` + small keyword grammar — larger download, no Picovoice account.
 */
export type PorcupineWebWakeConfig = {
  accessKey: string;
  /** e.g. "/porcupine/hello_neo_wasm.ppn" */
  keywordPublicPath: string;
};
