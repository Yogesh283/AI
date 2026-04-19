/**
 * OpenAI Realtime API over WebRTC — ChatGPT-style continuous speech session.
 * @see https://platform.openai.com/docs/guides/realtime-webrtc
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

export type OpenAiRealtimeVoiceCallbacks = {
  onConnection?: (state: "connecting" | "open" | "closed") => void;
  /** User line from input transcription (when enabled server-side). */
  onUserTranscript?: (text: string) => void;
  /** Assistant spoken text (when model emits transcript events). */
  onAssistantTranscript?: (text: string) => void;
  /** Model started / finished an audio response (best-effort). */
  onAssistantSpeaking?: (speaking: boolean) => void;
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

function routeRealtimeEvent(
  ev: Record<string, unknown>,
  cb: OpenAiRealtimeVoiceCallbacks,
): void {
  const type = String(ev.type || "");
  if (type === "error") {
    const err = ev.error;
    const msg =
      err && typeof err === "object"
        ? String((err as Record<string, unknown>).message || "Realtime error")
        : "Realtime error";
    cb.onError?.(msg);
    return;
  }
  if (type === "conversation.item.input_audio_transcription.completed") {
    const t = String(ev.transcript || "").trim();
    if (t) cb.onUserTranscript?.(t);
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
  if (type === "response.created") {
    cb.onAssistantSpeaking?.(true);
    return;
  }
  if (type === "response.done" || type === "response.completed") {
    cb.onAssistantSpeaking?.(false);
    return;
  }
}

export type OpenAiRealtimeVoiceSession = {
  close: () => void;
  peerConnection: RTCPeerConnection;
  /** Stop current model audio (barge-in / tap interrupt). */
  cancelAssistant: () => void;
};

/**
 * Connect mic → OpenAI Realtime (WebRTC). Caller must run after a user gesture
 * so getUserMedia / autoplay policies are satisfied.
 */
export async function startOpenAiRealtimeVoiceSession(
  ephemeralClientSecret: string,
  callbacks: OpenAiRealtimeVoiceCallbacks = {},
): Promise<OpenAiRealtimeVoiceSession> {
  callbacks.onConnection?.("connecting");

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  const remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute("playsinline", "true");

  pc.ontrack = (e) => {
    const [stream] = e.streams;
    if (stream) remoteAudio.srcObject = stream;
  };

  const dc = pc.createDataChannel("oai-events");
  dc.onmessage = (e) => {
    const ev = parseServerEvent(String(e.data || ""));
    if (ev) routeRealtimeEvent(ev, callbacks);
  };

  const ms = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
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
    remoteAudio.srcObject = null;
    callbacks.onConnection?.("closed");
    throw new Error(detail);
  }

  const answerSdp = await sdpRes.text();
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

  dc.onopen = () => {
    callbacks.onConnection?.("open");
  };

  const cancelAssistant = () => {
    if (dc.readyState !== "open") return;
    try {
      dc.send(JSON.stringify({ type: "response.cancel" }));
    } catch {
      /* ignore */
    }
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
    remoteAudio.srcObject = null;
    callbacks.onConnection?.("closed");
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed" || pc.connectionState === "closed") {
      callbacks.onError?.(`WebRTC ${pc.connectionState}`);
    }
  };

  return { close, peerConnection: pc, cancelAssistant };
}
