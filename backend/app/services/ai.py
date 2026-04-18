from __future__ import annotations

import asyncio
import logging
import os
from typing import Any
from dataclasses import dataclass
from pathlib import Path

import httpx
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# app/services/ai.py -> parent.parent.parent = backend (folder that contains app/ and .env)
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent
_ENV_PATH = _BACKEND_ROOT / ".env"


def _candidate_env_files() -> list[Path]:
    """Try every likely .env location (uvicorn cwd differs, multiple clones, etc.)."""
    cwd = Path.cwd().resolve()
    seen: set[Path] = set()
    out: list[Path] = []
    for p in (
        _ENV_PATH,
        cwd / ".env",
        cwd / "backend" / ".env",
        _BACKEND_ROOT.parent / ".env",
    ):
        try:
            r = p.resolve()
        except OSError:
            continue
        if r not in seen:
            seen.add(r)
            out.append(r)
    return out


def _parse_openai_key_from_file(path: Path) -> str:
    """Fallback if load_dotenv fails (BOM, UTF-16, odd line endings)."""
    if not path.is_file():
        return ""
    try:
        raw = path.read_bytes()
    except OSError:
        return ""
    text = None
    for enc in ("utf-8-sig", "utf-8", "utf-16", "utf-16-le", "utf-16-be"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        return ""
    for line in text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        name, _, value = line.partition("=")
        if name.strip().upper() != "OPENAI_API_KEY":
            continue
        return value.strip().strip('"').strip("'")
    return ""


def _openai_api_key() -> str:
    """Load OPENAI_API_KEY from first working .env (dotenv + manual parse)."""
    for env_path in _candidate_env_files():
        load_dotenv(env_path, override=True)
        k = (os.getenv("OPENAI_API_KEY") or "").strip()
        if k:
            logger.info("OPENAI_API_KEY loaded (len=%s) via dotenv from %s", len(k), env_path)
            return k
        k = _parse_openai_key_from_file(env_path).strip()
        if k:
            os.environ["OPENAI_API_KEY"] = k
            logger.info("OPENAI_API_KEY loaded (len=%s) via parse from %s", len(k), env_path)
            return k

    checked = [str(p) for p in _candidate_env_files()]
    exists = [(str(p), p.is_file()) for p in _candidate_env_files()]
    logger.warning("OPENAI_API_KEY missing. Checked: %s", exists)
    return ""


def _openai_max_retries() -> int:
    raw = (os.getenv("OPENAI_HTTP_MAX_RETRIES") or "3").strip()
    try:
        n = int(raw)
        return max(1, min(n, 6))
    except ValueError:
        return 3


def _openai_httpx_timeout() -> httpx.Timeout:
    """Generous connect timeout — slow VPS / DNS / TLS to api.openai.com."""
    return httpx.Timeout(120.0, connect=45.0)


def _openai_async_client() -> httpx.AsyncClient:
    """trust_env=True picks up HTTP_PROXY / HTTPS_PROXY / ALL_PROXY on the server."""
    return httpx.AsyncClient(timeout=_openai_httpx_timeout(), trust_env=True)


async def _post_openai_with_retries(
    client: httpx.AsyncClient,
    url: str,
    *,
    max_attempts: int | None = None,
    **kwargs: Any,
) -> httpx.Response:
    attempts = max_attempts if max_attempts is not None else _openai_max_retries()
    last: httpx.RequestError | None = None
    for i in range(attempts):
        try:
            r = await client.post(url, **kwargs)
            return r
        except httpx.RequestError as e:
            last = e
            logger.warning("OpenAI POST %s attempt %s/%s: %s", url, i + 1, attempts, e)
            if i + 1 < attempts:
                await asyncio.sleep(0.35 * (i + 1))
    assert last is not None
    raise last


@dataclass(frozen=True)
class ChatCompletionResult:
    text: str
    model: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


async def chat_completion(
    messages: list[dict[str, str]],
    *,
    user_id: str | None = None,
) -> ChatCompletionResult:
    key = _openai_api_key()
    if key:
        return await _openai_chat(messages, key)

    last = messages[-1]["content"] if messages else ""
    return ChatCompletionResult(
        text=(
            "Namaste! Main NeoXAI hoon — abhi demo mode mein hoon (OpenAI key set nahi hai).\n\n"
            f"Aapne kaha: «{last}»\n\n"
            "`.env` mein `OPENAI_API_KEY` add karne par yahi endpoint GPT se jawab dega."
        ),
        model=None,
    )


async def _openai_chat(messages: list[dict[str, str]], api_key: str) -> ChatCompletionResult:
    async with _openai_async_client() as client:
        try:
            r = await _post_openai_with_retries(
                client,
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "gpt-4o-mini",
                    "messages": messages,
                    # Slightly higher for more natural, human-like phrasing (still grounded).
                    "temperature": 0.76,
                },
            )
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            try:
                err = e.response.json().get("error", {})
                msg = err.get("message", e.response.text)
            except Exception:
                msg = e.response.text or str(e)
            return ChatCompletionResult(
                text=(
                    f"[OpenAI {e.response.status_code}] {msg}\n\n"
                    "Key / billing check karein: platform.openai.com"
                ),
                model="gpt-4o-mini",
            )
        except httpx.RequestError as e:
            logger.warning("OpenAI request/network error: %s", e)
            return ChatCompletionResult(
                text=(
                    f"[OpenAI network] {type(e).__name__}: {e}\n\n"
                    "Server se api.openai.com reach ho raha hai ya nahi check karein (firewall / DNS / outbound HTTPS)."
                ),
                model="gpt-4o-mini",
            )
        try:
            data = r.json()
        except ValueError as e:
            logger.warning("OpenAI invalid JSON: %s", e)
            return ChatCompletionResult(
                text="[OpenAI] Invalid response — dubara try karein.",
                model="gpt-4o-mini",
            )
        try:
            choices = data.get("choices")
            if not isinstance(choices, list) or not choices:
                raise ValueError("no choices")
            msg = choices[0].get("message") if isinstance(choices[0], dict) else None
            if not isinstance(msg, dict):
                raise ValueError("no message")
            text = (msg.get("content") or "").strip()
        except (TypeError, ValueError, KeyError, IndexError) as e:
            logger.warning("OpenAI unexpected response shape: %s", e)
            return ChatCompletionResult(
                text="[OpenAI] Unexpected reply format — dubara try karein.",
                model="gpt-4o-mini",
            )
        usage = data.get("usage") or {}
        pt = usage.get("prompt_tokens")
        ct = usage.get("completion_tokens")
        tt = usage.get("total_tokens")
        return ChatCompletionResult(
            text=text,
            model=str(data.get("model") or "gpt-4o-mini"),
            prompt_tokens=int(pt) if isinstance(pt, int) else None,
            completion_tokens=int(ct) if isinstance(ct, int) else None,
            total_tokens=int(tt) if isinstance(tt, int) else None,
        )


async def transcribe_audio_whisper(
    audio_bytes: bytes,
    filename: str,
    content_type: str | None,
) -> str:
    """Speech-to-text via OpenAI Whisper. Empty string if no API key."""
    key = _openai_api_key()
    if not key:
        return ""
    # Whisper accepts many types; default if missing
    mime = content_type or "application/octet-stream"
    safe_name = filename.strip() or "audio.webm"
    async with _openai_async_client() as client:
        try:
            r = await _post_openai_with_retries(
                client,
                "https://api.openai.com/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {key}"},
                files={"file": (safe_name, audio_bytes, mime)},
                data={"model": "whisper-1"},
            )
            r.raise_for_status()
        except httpx.RequestError as e:
            logger.warning("Whisper network error: %s", e)
            return ""
        except httpx.HTTPStatusError as e:
            try:
                err = e.response.json().get("error", {})
                msg = err.get("message", e.response.text)
            except Exception:
                msg = e.response.text or str(e)
            logger.warning("Whisper HTTP %s: %s", e.response.status_code, msg)
            return ""
        data = r.json()
        text = (data.get("text") or "").strip()
        return text


_OPENAI_TTS_VOICES = frozenset(
    {
        "alloy",
        "ash",
        "ballad",
        "coral",
        "echo",
        "fable",
        "onyx",
        "nova",
        "sage",
        "shimmer",
    }
)


async def synthesize_openai_tts(
    text: str,
    *,
    voice: str = "alloy",
    model: str = "tts-1",
) -> tuple[bytes, str]:
    """
    OpenAI TTS → (mp3_bytes, err_tag).
    err_tag is '' on success; 'network' if api.openai.com could not be reached; 'http' on non-2xx.
    """
    key = _openai_api_key()
    if not key:
        return b"", "no_key"
    clean = (text or "").strip()
    if not clean:
        return b"", "empty_text"
    if len(clean) > 4096:
        clean = clean[:4096]

    v = (voice or "alloy").strip().lower()
    if v not in _OPENAI_TTS_VOICES:
        v = "alloy"

    m = (model or "tts-1").strip()
    if m not in ("tts-1", "tts-1-hd"):
        m = "tts-1"

    async with _openai_async_client() as client:
        try:
            r = await _post_openai_with_retries(
                client,
                "https://api.openai.com/v1/audio/speech",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": m,
                    "input": clean,
                    "voice": v,
                },
            )
            r.raise_for_status()
        except httpx.RequestError as e:
            logger.warning("OpenAI TTS network error: %s", e)
            return b"", "network"
        except httpx.HTTPStatusError as e:
            try:
                err = e.response.json().get("error", {})
                msg = err.get("message", e.response.text)
            except Exception:
                msg = e.response.text or str(e)
            logger.warning("OpenAI TTS HTTP %s: %s", e.response.status_code, msg)
            return b"", "http"
        return r.content, ""
