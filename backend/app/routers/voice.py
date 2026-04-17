from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field

from app.services.ai import _openai_api_key, synthesize_openai_tts, transcribe_audio_whisper

router = APIRouter(prefix="/api/voice", tags=["voice"])

MAX_AUDIO_BYTES = 24 * 1024 * 1024  # OpenAI allows ~25MB; stay under


class TtsBody(BaseModel):
    text: str = ""


@router.post("/transcribe")
async def transcribe(audio: UploadFile | None = File(None)) -> dict:
    if not audio or not audio.filename:
        return {"text": "", "error": "no_audio"}

    raw = await audio.read()
    if not raw:
        return {"text": "", "error": "empty_audio"}
    if len(raw) > MAX_AUDIO_BYTES:
        return {"text": "", "error": "audio_too_large"}

    if not _openai_api_key():
        return {
            "text": "",
            "error": "openai_not_configured",
            "hint": "Set OPENAI_API_KEY in backend/.env",
        }

    ct = audio.content_type
    text = await transcribe_audio_whisper(raw, audio.filename or "audio.webm", ct)
    if not text:
        return {
            "text": "",
            "error": "transcription_failed",
            "hint": "Check API key, billing, or try a shorter clip.",
        }

    return {"text": text, "duration_ms": None}


@router.post("/tts")
async def tts_stub(payload: TtsBody) -> dict:
    text = payload.text
    return {
        "ok": True,
        "hint": "Web uses speechSynthesis; mobile uses expo-speech.",
        "chars": len(text),
    }


class TtsAudioBody(BaseModel):
    text: str = ""
    voice: str = Field(default="nova", description="OpenAI TTS voice (e.g. nova, alloy, shimmer)")
    model: str = Field(default="tts-1", description="tts-1 | tts-1-hd")


@router.post("/tts-audio")
async def tts_audio(payload: TtsAudioBody) -> Response:
    """
    MP3 bytes for native clients (browser can use `<audio src=blob:...>` too).
    Requires OPENAI_API_KEY on the backend.
    """
    if not _openai_api_key():
        raise HTTPException(
            status_code=503,
            detail="openai_not_configured — set OPENAI_API_KEY in backend/.env",
        )
    raw = await synthesize_openai_tts(
        payload.text,
        voice=payload.voice,
        model=payload.model,
    )
    if not raw:
        raise HTTPException(
            status_code=502,
            detail="tts_failed — empty text, billing, or model error",
        )
    return Response(
        content=raw,
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store", "Content-Disposition": "inline; filename=neo-tts.mp3"},
    )
