from __future__ import annotations

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from app.services.ai import _openai_api_key, transcribe_audio_whisper

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
