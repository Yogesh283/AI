/**
 * OpenAI Realtime API over WebRTC — continuous hands-free speech session.
 * @see https://platform.openai.com/docs/guides/realtime-webrtc
 *
 * **Product lock (APK mic / Live voice):** do not change `routeRealtimeEvent`, `cancelAssistant`,
 * or callback wiring without reading `.cursor/rules/voice-live-apk-mic-lock.mdc` and `voice/page.tsx`.
 */

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

export function isOpenAiRealtimeVoiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  const RTC = (window as unknown as { RTCPeerConnection?: new (c?: RTCConfiguration) => RTCPeerConnection })
    .RTCPeerConnection;
  return Boolean(
    window.isSecureContext &&
      typeof navigator !== "undefined" &&
      "mediaDevices" in navigator &&
      navigator.mediaDevices &&
      typeof RTC === "function",
  );
}

/**
 * Call **synchronously** from a click/tap handler and pass the returned promise into
 * {@link startOpenAiRealtimeVoiceSession} (with `localAudioStream` after await) so Android WebView
 * keeps a valid mic grant for Live voice.
 */
export function createVoiceRealtimeMicStreamPromise(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return Promise.reject(new Error("Microphone API not available."));
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

export type OpenAiRealtimeVoiceCallbacks = {
  onConnection?: (state: "connecting" | "open" | "closed") => void;
  /** Streaming user text from OpenAI input-audio ASR (same source as {@link onUserTranscript}). */
  onUserTranscriptDelta?: (delta: string) => void;
  /** Final user line when input-audio transcription completes (authoritative). */
  onUserTranscript?: (text: string) => void;
  /** Assistant transcript streamed token-by-token while audio plays. */
  onAssistantTranscriptDelta?: (delta: string) => void;
  /** Assistant full line when the model finalizes transcript (reconcile / no-delta clients). */
  onAssistantTranscript?: (text: string) => void;
  /** Model started / finished an audio response (best-effort). */
  onAssistantSpeaking?: (speaking: boolean) => void;
  /** Server VAD: user is speaking into the mic (not assistant playback). */
  onUserSpeechActive?: (active: boolean) => void;
  /**
   * True between `response.created` and `response.done` / `response.completed` (server-side in-flight response).
   * Used to avoid `response.cancel` when nothing is active (APK: "Cancellation failed: no active response found").
   */
  onAssistantResponseActive?: (active: boolean) => void;
  onError?: (message: string) => void;
};

function parseServerEvent(raw: string): Record<string, unknown> | null {
  try {
    const ev = JSON.parse(raw) as unknown;
    return ev && typeof ev === "object" ? (ev as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

type RealtimeEventLocks = { assistantDeltaSource: "output" | "legacy" | null };

function routeRealtimeEvent(
  ev: Record<string, unknown>,
  cb: OpenAiRealtimeVoiceCallbacks,
  locks: RealtimeEventLocks,
): void {
  const type = String(ev.type || "");
  if (type === "error") {
    cb.onAssistantResponseActive?.(false);
    const err = ev.error;
    const msg =
      err && typeof err === "object"
        ? String((err as Record<string, unknown>).message || "Realtime error")
        : "Realtime error";
    cb.onError?.(msg);
    return;
  }
  if (type === "input_audio_buffer.speech_started") {
    cb.onUserSpeechActive?.(true);
    return;
  }
  if (type === "input_audio_buffer.speech_stopped") {
    cb.onUserSpeechActive?.(false);
    return;
  }
  if (type === "conversation.item.input_audio_transcription.delta") {
    const d =
      typeof ev.delta === "string"
        ? ev.delta
        : typeof (ev as { text?: unknown }).text === "string"
          ? String((ev as { text: string }).text)
          : "";
    if (d) cb.onUserTranscriptDelta?.(d);
    return;
  }
  if (type === "conversation.item.input_audio_transcription.completed") {
    const t = String(ev.transcript || "").trim();
    if (t) cb.onUserTranscript?.(t);
    return;
  }
  if (type === "conversation.item.input_audio_transcription.failed") {
    const err = ev.error;
    const msg =
      err && typeof err === "object"
        ? String((err as Record<string, unknown>).message || "Input transcription failed")
        : "Input transcription failed";
    cb.onError?.(msg);
    return;
  }
  /* Some sessions emit both GA + legacy delta streams for the same speech — first channel wins per response. */
  if (type === "response.output_audio_transcript.delta") {
    if (locks.assistantDeltaSource === "legacy") return;
    locks.assistantDeltaSource = locks.assistantDeltaSource ?? "output";
    const d =
      typeof ev.delta === "string"
        ? ev.delta
        : typeof (ev as { text?: unknown }).text === "string"
          ? String((ev as { text: string }).text)
          : "";
    if (d) cb.onAssistantTranscriptDelta?.(d);
    return;
  }
  if (type === "response.audio_transcript.delta") {
    if (locks.assistantDeltaSource === "output") return;
    locks.assistantDeltaSource = locks.assistantDeltaSource ?? "legacy";
    const d =
      typeof ev.delta === "string"
        ? ev.delta
        : typeof (ev as { text?: unknown }).text === "string"
          ? String((ev as { text: string }).text)
          : "";
    if (d) cb.onAssistantTranscriptDelta?.(d);
    return;
  }
  if (
    type === "response.audio_transcript.done" ||
    type === "response.output_audio_transcript.done"
  ) {
    const t = String(ev.transcript || "").trim();
    if (t) cb.onAssistantTranscript?.(t);
    return;
  }
  /* Some sessions expose the same reply as text when audio transcript lags or is partial. */
  if (type === "response.output_text.done") {
    const t = String(ev.text || "").trim();
    if (t) cb.onAssistantTranscript?.(t);
    return;
  }
  if (type === "response.created") {
    locks.assistantDeltaSource = null;
    cb.onAssistantResponseActive?.(true);
    cb.onUserSpeechActive?.(false);
    cb.onAssistantSpeaking?.(true);
    return;
  }
  if (type === "response.done" || type === "response.completed" || type === "response.cancelled") {
    locks.assistantDeltaSource = null;
    cb.onAssistantResponseActive?.(false);
    cb.onAssistantSpeaking?.(false);
    return;
  }
}

export type OpenAiRealtimeVoiceSession = {
  close: () => void;
  peerConnection: RTCPeerConnection;
  /** Stop current model audio (barge-in / tap interrupt). */
  cancelAssistant: () => void;
  /** Send a Realtime client event over the data channel (e.g. conversation.item.create). */
  sendClientEvent: (payload: Record<string, unknown>) => void;
  /**
   * Keep the single session mic track enabled (some stacks flip it off after errors / cancel storms).
   * Safe to call often; only touches local uplink tracks.
   */
  ensureLocalMicLive: () => void;
  /**
   * Mute/unmute model downlink (Voice page unmutes after the data channel opens — mic tap unlocks playback).
   * Does not stop the session or cancel in-flight responses.
   */
  setAssistantAudioMuted: (muted: boolean) => void;
};

export type StartOpenAiRealtimeVoiceOptions = {
  /**
   * Mic stream from a {@link navigator.mediaDevices.getUserMedia} call that began in the **same**
   * user gesture as starting Live (e.g. mic button `onClick`). Some Android WebViews drop or weaken
   * mic access when `getUserMedia` runs only after async token fetch — pass a pre-started stream here.
   */
  localAudioStream?: MediaStream;
};

/**
 * Connect mic → OpenAI Realtime (WebRTC). Caller must run after a user gesture
 * so getUserMedia / autoplay policies are satisfied.
 */
export async function startOpenAiRealtimeVoiceSession(
  ephemeralClientSecret: string,
  callbacks: OpenAiRealtimeVoiceCallbacks = {},
  opts?: StartOpenAiRealtimeVoiceOptions,
): Promise<OpenAiRealtimeVoiceSession> {
  callbacks.onConnection?.("connecting");

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  const remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute("playsinline", "true");
  remoteAudio.volume = 1;
  remoteAudio.muted = false;
  try {
    document.body.appendChild(remoteAudio);
  } catch {
    /* ignore */
  }

  pc.ontrack = (e) => {
    const [stream] = e.streams;
    if (stream) remoteAudio.srcObject = stream;
  };

  const dc = pc.createDataChannel("oai-events");
  const eventLocks: RealtimeEventLocks = { assistantDeltaSource: null };
  dc.onmessage = (e) => {
    const ev = parseServerEvent(String(e.data || ""));
    if (ev) routeRealtimeEvent(ev, callbacks, eventLocks);
  };

  /* One mic stream for the whole Realtime session — tracks stay live until `close()` (no per-turn getUserMedia). */
  const ms =
    opts?.localAudioStream ??
    (await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    }));
  for (const track of ms.getTracks()) {
    pc.addTrack(track, ms);
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpRes = await fetch(REALTIME_CALLS_URL, {
    method: "POST",
    body: offer.sdp ?? "",
    headers: {
      Authorization: `Bearer ${ephemeralClientSecret}`,
      "Content-Type": "application/sdp",
    },
  });

  if (!sdpRes.ok) {
    const detail = (await sdpRes.text()).trim() || `HTTP ${sdpRes.status}`;
    for (const t of ms.getTracks()) {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    }
    pc.close();
    remoteAudio.remove();
    remoteAudio.srcObject = null;
    callbacks.onConnection?.("closed");
    throw new Error(detail);
  }

  const answerSdp = await sdpRes.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  dc.onopen = () => {
    callbacks.onConnection?.("open");
    void remoteAudio.play().catch(() => {
      /* Autoplay may still need a gesture on some WebViews; session was opened from mic tap. */
    });
  };

  const cancelAssistant = () => {
    if (dc.readyState !== "open") return;
    try {
      dc.send(JSON.stringify({ type: "response.cancel" }));
    } catch {
      /* ignore */
    }
  };

  const sendClientEvent = (payload: Record<string, unknown>) => {
    if (dc.readyState !== "open") return;
    try {
      dc.send(JSON.stringify(payload));
    } catch {
      /* ignore */
    }
  };

  const ensureLocalMicLive = () => {
    for (const t of ms.getAudioTracks()) {
      if (t.readyState === "live" && !t.enabled) {
        t.enabled = true;
      }
    }
    try {
      for (const sender of pc.getSenders()) {
        const tr = sender.track;
        if (tr && tr.kind === "audio" && tr.readyState === "live" && !tr.enabled) {
          tr.enabled = true;
        }
      }
    } catch {
      /* ignore */
    }
  };

  const setAssistantAudioMuted = (muted: boolean) => {
    remoteAudio.muted = muted;
    remoteAudio.volume = muted ? 0 : 1;
  };

  const close = () => {
    try {
      dc.close();
    } catch {
      /* ignore */
    }
    for (const t of ms.getTracks()) {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    }
    try {
      pc.close();
    } catch {
      /* ignore */
    }
    try {
      remoteAudio.remove();
    } catch {
      /* ignore */
    }
    remoteAudio.srcObject = null;
    callbacks.onConnection?.("closed");
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      callbacks.onError?.(`WebRTC ${pc.connectionState}`);
    }
  };

  return { close, peerConnection: pc, cancelAssistant, sendClientEvent, ensureLocalMicLive, setAssistantAudioMuted };
}
