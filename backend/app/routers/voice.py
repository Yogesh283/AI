from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from pydantic import BaseModel, Field
from zoneinfo import ZoneInfo

from app.db_mysql import fetch_recent_chat_context, pool_ready
from app.routers.auth import optional_user
from app.routers.chat import IST, _compact_line
from app.services.ai import (
    _openai_api_key,
    mint_openai_realtime_client_secret,
    synthesize_openai_tts,
    transcribe_audio_whisper,
)
from app.store import get_memory, get_profile, get_recent_chat_history

router = APIRouter(prefix="/api/voice", tags=["voice"])
logger = logging.getLogger(__name__)

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
            "hint": (
                "OpenAI Whisper returned no text — check api.openai.com reach, API key, and billing on the server "
                "(e.g. curl -sI https://api.openai.com; set HTTPS_PROXY if you use a proxy)."
            ),
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
    voice: str = Field(default="nova", description="OpenAI TTS voice (e.g. marin, cedar, coral)")
    model: str = Field(default="tts-1-hd", description="tts-1 | tts-1-hd | gpt-4o-mini-tts")
    instructions: str | None = Field(
        default=None,
        max_length=4096,
        description="Optional; only used with gpt-4o-mini-tts (style / pacing hints).",
    )


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
    raw, tts_err = await synthesize_openai_tts(
        payload.text,
        voice=payload.voice,
        model=payload.model,
        instructions=payload.instructions,
    )
    if tts_err == "network":
        raise HTTPException(
            status_code=503,
            detail=(
                "openai_unreachable — this server cannot reach https://api.openai.com "
                "(firewall / DNS / IPv6 / outbound HTTPS). On the host: curl -sI https://api.openai.com | head -1. "
                "If you need a proxy, set HTTPS_PROXY in the backend env; OPENAI_HTTP_MAX_RETRIES=3 by default."
            ),
        )
    if not raw:
        raise HTTPException(
            status_code=502,
            detail=(
                "tts_failed — OpenAI did not return MP3 audio (billing / quota / model). "
                "Check your key and usage at platform.openai.com"
            ),
        )
    return Response(
        content=raw,
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store", "Content-Disposition": "inline; filename=neo-tts.mp3"},
    )


class RealtimeTokenBody(BaseModel):
    """Browser mints ephemeral key for OpenAI Realtime WebRTC (live voice)."""

    speech_lang: str = Field(default="en-IN", max_length=32, description="BCP-47 hint for user language")
    persona_id: str = Field(default="sara", max_length=32, description="arjun | sara — maps to output voice")


def _realtime_output_voice(persona_id: str) -> str:
    """Match OpenAI Realtime / ChatGPT-style defaults: marin (warm), cedar (steady male)."""
    pid = (persona_id or "sara").strip().lower()
    if pid == "arjun":
        return "cedar"
    return "marin"


def _realtime_model() -> str:
    return (os.getenv("OPENAI_REALTIME_MODEL") or "gpt-4o-mini-realtime-preview").strip()


async def _build_realtime_instructions(
    *,
    uid: str,
    display_name: str,
    speech_lang: str,
    persona_id: str,
) -> str:
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc.astimezone(IST)
    profile = get_profile(uid)
    mem = get_memory(uid)
    name = (display_name or profile.get("display_name") or "User").strip() or "User"
    timeline_rows: list[dict[str, str]] = []
    if pool_ready():
        timeline_rows = await fetch_recent_chat_context(uid, limit=20)
    else:
        timeline_rows = get_recent_chat_history(uid, limit=20)

    past_timeline = ""
    if timeline_rows:
        lines: list[str] = []
        for r in timeline_rows:
            role = "User" if r.get("role") == "user" else "Assistant"
            when = str(r.get("created_at") or "").replace("T", " ")[:19]
            content = _compact_line(str(r.get("content") or ""))
            if not content:
                continue
            lines.append(f"- [{when}] {role}: {content}")
        past_timeline = "\n".join(lines)

    voice_persona = "steady, calm male assistant (Arjun)" if persona_id.strip().lower() == "arjun" else "warm female assistant (Sara)"
    lang_hint = (speech_lang or "en-IN").strip()
    live_year = now_utc.year
    if lang_hint.lower().startswith("hi"):
        lang_line = (
            f"User speech locale: {lang_hint}. CRITICAL: They are using Hindi. "
            "Respond ONLY in Shuddh Hindi (Devanagari script). Do not use English words, Latin letters, or Hinglish. "
            "Sound like a natural Hindi speaker on a phone call — short, clear, flowing sentences. "
            "Explain technical ideas in simple Hindi.\n"
        )
    else:
        lang_line = (
            f"User speech locale hint: {lang_hint} — mirror Hindi, English, or Hinglish as they speak.\n"
        )
    return (
        "You are NeoXAI — this user's personal voice assistant. "
        f"Address them naturally as «{name}» when it fits. "
        f"Persona: {voice_persona}. "
        f"{lang_line}"
        "Voice mode rules: sound like a natural phone call — short clear sentences, no markdown or bullet lists "
        "unless they explicitly want detail. Do not read URLs character-by-character. "
        "Avoid stock-bot phrases ('I'd be happy to help', 'Great question', 'As an AI'). "
        "Do not label yourself as an AI unless they ask.\n"
        "Spoken audio: use warm, human pacing — slight pauses between thoughts, varied intonation, never monotone or "
        "flat like a screen reader. Sound like a calm friend speaking, not a robot.\n"
        f"General knowledge may lag; for time-sensitive facts prefer caution. Current year context: {live_year}. "
        f"Live time anchor: India (IST) now is {now_ist.strftime('%Y-%m-%d %H:%M:%S %Z')}.\n"
        f"Known preferences / memory hints: {mem[-5:] if mem else 'none yet'}.\n"
        + (
            (
                "--- Recent chat timeline (oldest to newest):\n"
                f"{past_timeline}\n"
                "Use for continuity and 'what did we talk about' questions.\n"
            )
            if past_timeline
            else ""
        )
    )


@router.post("/realtime-token")
async def post_realtime_token(
    body: RealtimeTokenBody,
    user: dict | None = Depends(optional_user),
) -> dict:
    """
    Mint a short-lived OpenAI Realtime client secret for browser WebRTC.
    The browser POSTs SDP to https://api.openai.com/v1/realtime/calls with Bearer <value>.
    """
    if not _openai_api_key():
        raise HTTPException(
            status_code=503,
            detail="openai_not_configured — set OPENAI_API_KEY in backend/.env",
        )
    uid = str(user["id"]) if user else "default"
    display_name = str(user.get("display_name") or "") if user else ""
    pid = (body.persona_id or "sara").strip().lower()
    if pid not in ("arjun", "sara"):
        pid = "sara"
    instructions = await _build_realtime_instructions(
        uid=uid,
        display_name=display_name,
        speech_lang=body.speech_lang,
        persona_id=pid,
    )
    model = _realtime_model()
    out_voice = _realtime_output_voice(pid)
    session_payload: dict = {
        "type": "realtime",
        "model": model,
        "instructions": instructions[:32000],
        "audio": {
            "input": {
                "transcription": {"model": "whisper-1"},
            },
            "output": {"voice": out_voice},
        },
    }
    data, err = await mint_openai_realtime_client_secret(session_payload=session_payload, expires_seconds=600)
    if err or not data:
        # Some models reject nested input.transcription — retry audio output only.
        session_payload = {
            "type": "realtime",
            "model": model,
            "instructions": instructions[:32000],
            "audio": {"output": {"voice": out_voice}},
        }
        data, err = await mint_openai_realtime_client_secret(session_payload=session_payload, expires_seconds=600)
    if err or not data:
        raise HTTPException(
            status_code=502,
            detail=err or "realtime_mint_failed",
        )
    secret = data.get("value")
    if not secret:
        nested = data.get("client_secret")
        if isinstance(nested, dict):
            secret = nested.get("value")
    if not secret or not isinstance(secret, str):
        logger.warning("realtime client_secrets missing value: keys=%s", list(data.keys()) if isinstance(data, dict) else type(data))
        raise HTTPException(status_code=502, detail="realtime_mint_missing_value")
    expires_at = data.get("expires_at")
    if expires_at is None and isinstance(nested := data.get("client_secret"), dict):
        expires_at = nested.get("expires_at")
    return {
        "client_secret": secret,
        "expires_at": expires_at,
        "model": model,
        "output_voice": out_voice,
    }
