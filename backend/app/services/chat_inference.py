"""
Two-module chat inference for Neo:

1) **openai** (default) — existing OpenAI `chat/completions` path (`app.services.ai`).
2) **local** — same message/response contract against an OpenAI-*compatible* HTTP endpoint
   (Ollama `/v1/chat/completions`, vLLM, llama.cpp server, etc.). No vendor lock-in at the router layer.

Switch with `NEO_CHAT_BACKEND=local` and set `NEO_LOCAL_CHAT_URL` (+ optional model / API key).

**Training corpus (optional):** when `NEO_TRAINING_LOG_PATH` is set, each successful assistant reply
is appended as one JSON line — useful later for fine-tuning / distillation / evaluation. This does
not train a model by itself; it records (teacher or student) turns for your offline pipeline.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from app.services.ai import (
    ChatCompletionResult,
    _openai_api_key,
    _openai_max_retries,
    chat_completion,
    stream_openai_chat_deltas,
)

logger = logging.getLogger(__name__)


def chat_inference_backend() -> str:
    """`openai` | `local` — controlled by NEO_CHAT_BACKEND."""
    v = (os.getenv("NEO_CHAT_BACKEND") or "openai").strip().lower()
    if v in ("local", "native", "self", "ollama", "vllm", "llamacpp"):
        return "local"
    return "openai"


def local_chat_url() -> str:
    """Full URL to POST chat completions (stream or not). Default: Ollama OpenAI shim."""
    u = (os.getenv("NEO_LOCAL_CHAT_URL") or "").strip()
    if u:
        return u.rstrip("/")
    return "http://127.0.0.1:11434/v1/chat/completions"


def local_chat_model_id() -> str:
    return (os.getenv("NEO_LOCAL_CHAT_MODEL") or "llama3.1").strip() or "llama3.1"


def local_chat_api_key() -> str:
    return (os.getenv("NEO_LOCAL_CHAT_API_KEY") or "").strip()


def training_log_path() -> Path | None:
    raw = (os.getenv("NEO_TRAINING_LOG_PATH") or "").strip()
    if not raw:
        return None
    return Path(raw).expanduser()


def _local_httpx_timeout() -> httpx.Timeout:
    return httpx.Timeout(180.0, connect=30.0)


def _local_async_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=_local_httpx_timeout(), trust_env=True)


async def _post_local_with_retries(client: httpx.AsyncClient, url: str, **kwargs: Any) -> httpx.Response:
    attempts = _openai_max_retries()
    last: httpx.RequestError | None = None
    for i in range(attempts):
        try:
            return await client.post(url, **kwargs)
        except httpx.RequestError as e:
            last = e
            logger.warning("Local chat POST %s attempt %s/%s: %s", url, i + 1, attempts, e)
            if i + 1 < attempts:
                await asyncio.sleep(0.35 * (i + 1))
    assert last is not None
    raise last


async def _read_openai_style_sse_deltas(
    response: httpx.Response,
    *,
    usage_holder: list[dict[str, Any]] | None,
) -> AsyncIterator[str]:
    async for line in response.aiter_lines():
        if not line or line.startswith(":"):
            continue
        if not line.startswith("data: "):
            continue
        raw = line[6:].strip()
        if raw == "[DONE]":
            break
        try:
            chunk = json.loads(raw)
        except json.JSONDecodeError:
            continue
        if usage_holder is not None and isinstance(chunk.get("usage"), dict):
            usage_holder.clear()
            usage_holder.append(chunk["usage"])
        choices = chunk.get("choices")
        if not isinstance(choices, list) or not choices:
            continue
        c0 = choices[0]
        if not isinstance(c0, dict):
            continue
        delta = c0.get("delta")
        if not isinstance(delta, dict):
            continue
        piece = delta.get("content")
        if isinstance(piece, str) and piece:
            yield piece


async def stream_local_chat_deltas(
    messages: list[dict[str, str]],
    *,
    usage_holder: list[dict[str, Any]] | None = None,
    temperature: float | None = None,
) -> AsyncIterator[str]:
    url = local_chat_url()
    model = local_chat_model_id()
    key = local_chat_api_key()
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"

    temp = 0.76 if temperature is None else float(temperature)
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temp,
        "stream": True,
    }

    async with _local_async_client() as client:
        try:
            async with client.stream(
                "POST",
                url,
                headers=headers,
                json=payload,
            ) as response:
                try:
                    response.raise_for_status()
                except httpx.HTTPStatusError as e:
                    try:
                        msg = e.response.text[:400]
                    except Exception:
                        msg = str(e)
                    raise RuntimeError(f"[local chat {e.response.status_code}] {msg}") from e
                async for piece in _read_openai_style_sse_deltas(response, usage_holder=usage_holder):
                    yield piece
        except httpx.RequestError as e:
            raise RuntimeError(f"[local chat network] {type(e).__name__}: {e}") from e


async def local_chat_completion(
    messages: list[dict[str, str]],
    *,
    openai_request_overrides: dict[str, Any] | None = None,
) -> ChatCompletionResult:
    """Non-streaming completion against the local OpenAI-compatible endpoint."""
    url = local_chat_url()
    model = local_chat_model_id()
    key = local_chat_api_key()
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": 0.76,
        "stream": False,
    }
    if openai_request_overrides:
        for k, v in openai_request_overrides.items():
            if k in ("model", "messages", "stream"):
                continue
            payload[k] = v

    async with _local_async_client() as client:
        try:
            r = await _post_local_with_retries(
                client,
                url,
                headers=headers,
                json=payload,
            )
            r.raise_for_status()
        except httpx.HTTPStatusError as e:
            try:
                msg = e.response.text[:500]
            except Exception:
                msg = str(e)
            return ChatCompletionResult(
                text=f"[local chat {e.response.status_code}] {msg}",
                model=model,
            )
        except httpx.RequestError as e:
            return ChatCompletionResult(
                text=f"[local chat network] {type(e).__name__}: {e}",
                model=model,
            )
        try:
            data = r.json()
        except ValueError:
            return ChatCompletionResult(text="[local chat] Invalid JSON response.", model=model)
        choices = data.get("choices")
        if not isinstance(choices, list) or not choices:
            return ChatCompletionResult(text="[local chat] No choices in response.", model=model)
        msg = choices[0].get("message") if isinstance(choices[0], dict) else None
        if not isinstance(msg, dict):
            return ChatCompletionResult(text="[local chat] Bad message shape.", model=model)
        text = (msg.get("content") or "").strip()
        usage = data.get("usage") or {}
        pt = usage.get("prompt_tokens")
        ct = usage.get("completion_tokens")
        tt = usage.get("total_tokens")
        return ChatCompletionResult(
            text=text,
            model=str(data.get("model") or model),
            prompt_tokens=int(pt) if isinstance(pt, int) else None,
            completion_tokens=int(ct) if isinstance(ct, int) else None,
            total_tokens=int(tt) if isinstance(tt, int) else None,
        )


async def unified_chat_completion(
    messages: list[dict[str, str]],
    *,
    user_id: str | None = None,
    openai_request_overrides: dict[str, Any] | None = None,
) -> ChatCompletionResult:
    if chat_inference_backend() == "local":
        return await local_chat_completion(messages, openai_request_overrides=openai_request_overrides)
    return await chat_completion(
        messages,
        user_id=user_id,
        openai_request_overrides=openai_request_overrides,
    )


async def unified_stream_chat_deltas(
    messages: list[dict[str, str]],
    *,
    usage_holder: list[dict[str, Any]] | None = None,
    temperature: float | None = None,
) -> AsyncIterator[str]:
    if chat_inference_backend() == "local":
        async for piece in stream_local_chat_deltas(messages, usage_holder=usage_holder, temperature=temperature):
            yield piece
        return
    key = _openai_api_key()
    async for piece in stream_openai_chat_deltas(
        messages, key, usage_holder=usage_holder, temperature=temperature
    ):
        yield piece


def effective_stream_model_id() -> str:
    if chat_inference_backend() == "local":
        return local_chat_model_id()
    return "gpt-4o-mini"


def maybe_append_training_log(
    uid: str,
    source: str,
    messages: list[dict[str, str]],
    assistant_reply: str,
) -> None:
    """
    Append one supervision/example line for future offline training.
    Controlled only by NEO_TRAINING_LOG_PATH (empty = disabled).
    """
    path = training_log_path()
    if path is None or not assistant_reply.strip():
        return
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        row = {
            "t": datetime.now(timezone.utc).isoformat(),
            "uid": uid,
            "source": source,
            "backend": chat_inference_backend(),
            "messages": messages[-12:],
            "assistant": assistant_reply,
        }
        line = json.dumps(row, ensure_ascii=False) + "\n"
        with path.open("a", encoding="utf-8") as f:
            f.write(line)
    except OSError as e:
        logger.warning("training log append failed: %s", e)


__all__ = [
    "ChatCompletionResult",
    "chat_inference_backend",
    "effective_stream_model_id",
    "local_chat_model_id",
    "local_chat_url",
    "maybe_append_training_log",
    "training_log_path",
    "unified_chat_completion",
    "unified_stream_chat_deltas",
]
