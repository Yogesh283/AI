from __future__ import annotations

import json
import logging
import re
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from pydantic import BaseModel, Field

from app.db_mysql import (
    fetch_recent_chat_context,
    insert_chat_messages,
    insert_usage_transaction,
    pool_ready,
)
from app.routers.auth import optional_user
from app.services.ai import ChatCompletionResult
from app.services.chat_inference import (
    chat_inference_backend,
    effective_stream_model_id,
    maybe_append_training_log,
    unified_chat_completion,
    unified_stream_chat_deltas,
)
from app.services.sports_feed import build_live_web_context_block
from app.store import add_chat_turn, add_memory_fact, get_memory, get_profile, get_recent_chat_history

router = APIRouter(prefix="/api/chat", tags=["chat"])
IST = ZoneInfo("Asia/Kolkata")
logger = logging.getLogger(__name__)


def _is_live_datetime_query(text: str) -> bool:
    s = (text or "").strip().lower()
    if not s:
        return False
    # Sports/news schedules can include "time/date", but they are web lookup intents, not clock intents.
    if any(k in s for k in ("match", "team", "schedule", "fixture", "ipl", "cricket", "news")):
        explicit_clock = (
            "what time" in s
            or "current time" in s
            or "what is the time" in s
            or "what's the time" in s
            or "kitne baje" in s
            or "कितने बजे" in s
        )
        if not explicit_clock:
            return False
    # Keep this strict so "today match" or "today news" are NOT mistaken as pure date/time intent.
    patterns = (
        r"\bwhat(?:'s| is)?\s+the\s+time\b",
        r"\bcurrent\s+time\b",
        r"\btime\s+kya\b",
        r"\bkitne\s+baje\b",
        r"\btoday\s+date\b",
        r"\bwhat(?:'s| is)?\s+today'?s?\s+date\b",
        r"\bcurrent\s+date\b",
        r"\bdate\s+kya\b",
        r"आज\s+की\s+तारीख",
        r"कितने\s+बजे",
        r"\b(?:date|time)\b",
        r"(?:तारीख|दिनांक|समय|वक्त|टाइम)",
    )
    return any(re.search(p, s, flags=re.IGNORECASE) for p in patterns)


def _live_datetime_reply(now_ist: datetime) -> str:
    date_label = now_ist.strftime("%d %B %Y")
    day_label = now_ist.strftime("%A")
    t12 = now_ist.strftime("%I:%M %p").lstrip("0")
    t24 = now_ist.strftime("%H:%M")
    return (
        f"Live India time (IST) is {t12} ({t24}).\n"
        f"Today's date is {date_label} ({day_label}).\n\n"
        "If you want, I can sketch a quick schedule for today based on this."
    )


def _looks_like_no_live_access(reply: str) -> bool:
    s = (reply or "").lower()
    hints = (
        "live web access nahi",
        "i don't have live web",
        "i do not have live web",
        "mujhe live web access nahi",
        "google par search",
        "search on google",
        "i can't browse",
        "cannot browse",
        "no internet access",
    )
    return any(h in s for h in hints)


def _compact_line(text: str, max_len: int = 180) -> str:
    t = re.sub(r"\s+", " ", (text or "")).strip()
    if len(t) <= max_len:
        return t
    return t[: max_len - 3].rstrip() + "..."


def _shuddh_hindi_applies(last_user: str, speech_lang: str | None) -> bool:
    """True when we should force Devanagari-only, no-English assistant replies."""
    sl = (speech_lang or "").strip().lower()
    if sl.startswith("hi"):
        return True
    t = (last_user or "").strip()
    if not t:
        return False
    deva = len(re.findall(r"[\u0900-\u097F]", t))
    if deva >= 6:
        return True
    return deva >= 3 and deva / max(len(t), 1) >= 0.12


SHUDDH_HINDI_RULE = (
    "CRITICAL — Shuddh Hindi only: The user is using Hindi (speech_lang hi-* or Hindi script in their message). "
    "Write your ENTIRE reply in standard Hindi using ONLY Devanagari script. "
    "Do not use English words, Latin letters for English, or Hinglish. "
    "Sound natural and clear, like a fluent Hindi speaker; keep flow easy to read aloud (voice). "
    "Technical or unfamiliar terms: explain with simple Hindi or established Hindi equivalents. "
    "If live web snippets are in English, convey their meaning in Hindi — do not paste English from snippets. "
    "This overrides any bilingual or Hinglish guidance elsewhere in this system message."
)


def _is_recall_query(text: str) -> bool:
    s = (text or "").strip().lower()
    keys = (
        "when did we talk",
        "when did i talk",
        "what did we talk",
        "what did i talk",
        "last time",
        "pichli baar",
        "pehle kya",
        "history",
        "previous chat",
    )
    if any(k in s for k in keys):
        return True
    patterns = (
        r"kab.*baat",
        r"baat.*kab",
        r"humne.*baat",
        r"kya.*baat",
        r"kis.*topic",
        r"pichl[ie].*baat",
    )
    return any(re.search(p, s, flags=re.IGNORECASE) for p in patterns)


def _recall_reply_from_timeline(rows: list[dict[str, str]]) -> str:
    user_rows = [r for r in rows if r.get("role") == "user" and str(r.get("content") or "").strip()]
    if not user_rows:
        return (
            "I don’t have a previous conversation timeline for this user yet. "
            "Send the line you want remembered and I’ll pin it to memory."
        )
    last = user_rows[-1]
    when = str(last.get("created_at") or "").replace("T", " ")[:19]
    last_topic = _compact_line(str(last.get("content") or ""), max_len=120)
    sample = user_rows[-3:]
    bullets = "\n".join(
        f"- [{str(x.get('created_at') or '').replace('T', ' ')[:19]}] {_compact_line(str(x.get('content') or ''), 90)}"
        for x in sample
    )
    return (
        f"Yes — we last spoke around [{when}].\n"
        f"Last topic: \"{last_topic}\".\n\n"
        "Recent user topics:\n"
        f"{bullets}"
    )


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_id: str = "default"
    # Memory API lists only chat + voice; tools excluded.
    source: Literal["chat", "voice", "tools"] = "chat"
    # When True and GOOGLE_CSE_* are set, last user message is used for Google Custom Search snippets.
    use_web: bool = False
    # BCP-47 hint from client (e.g. hi-IN). When Hindi, assistant replies in Shuddh Hindi only (see system prompt).
    speech_lang: str | None = Field(default=None, max_length=32)


class ChatResponse(BaseModel):
    reply: str
    memory_snippets: list[str] = []


class LiveContextBody(BaseModel):
    """One-shot Google live snippets for voice Realtime injection (same pipeline as chat)."""

    query: str = Field(default="", max_length=500)


@dataclass(frozen=True)
class ChatRouteContext:
    uid: str
    last_user: str
    source: Literal["chat", "voice", "tools"]
    mem: list[Any]
    web_block: str
    system_extra: str
    early_reply: str | None
    openai_messages: list[dict[str, str]] | None


async def _build_chat_route_context(body: ChatRequest, user: dict | None) -> ChatRouteContext:
    uid = str(user["id"]) if user else body.user_id
    profile = get_profile(uid)
    mem = get_memory(uid)
    last_user = next((m.content for m in reversed(body.messages) if m.role == "user"), "")
    now_utc = datetime.now(timezone.utc)
    now_ist = now_utc.astimezone(IST)
    timeline_rows: list[dict[str, str]] = []
    if user and pool_ready():
        timeline_rows = await fetch_recent_chat_context(uid, limit=24)
    else:
        timeline_rows = get_recent_chat_history(uid, limit=24)

    if _is_live_datetime_query(last_user):
        reply = _live_datetime_reply(now_ist)
        return ChatRouteContext(
            uid=uid,
            last_user=last_user,
            source=body.source,
            mem=mem,
            web_block="",
            system_extra="",
            early_reply=reply,
            openai_messages=None,
        )

    if _is_recall_query(last_user):
        reply = _recall_reply_from_timeline(timeline_rows)
        return ChatRouteContext(
            uid=uid,
            last_user=last_user,
            source=body.source,
            mem=mem,
            web_block="",
            system_extra="",
            early_reply=reply,
            openai_messages=None,
        )

    web_block = ""
    # Always pull Google snippets for normal turns (when user said something); recall/datetime
    # return above before this. use_web remains supported for clients but is no longer required.
    want_web = bool(last_user.strip())
    if want_web:
        web_block = await build_live_web_context_block(last_user, now_ist=now_ist)

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

    live_year = now_utc.year
    knowledge_cutoff_hint = (
        "Your baked-in general knowledge reflects training up to roughly 2023 — treat it as background only "
        "for time-sensitive facts (prices, sports results, who is in office, etc.). "
        f"When live web snippets are provided below, they are the source for current ({live_year}) facts."
    )
    hindi_only = _shuddh_hindi_applies(last_user, body.speech_lang)

    voice_mode_extra = ""
    if body.source == "voice":
        if hindi_only:
            voice_mode_extra = (
                " Voice mode: reply only in Shuddh Hindi (Devanagari), no English — same natural phone-call rhythm. "
                "Prefer short, clear spoken sentences; no markdown unless they ask for code. "
                "Listen-first; brief acknowledgment then answer; match persona tone calmly."
            )
        else:
            voice_mode_extra = (
                " Voice mode output rules: talk naturally like two humans on a phone call—same rhythm and warmth. "
                "Prefer short, clear spoken sentences (no dense paragraphs). "
                "Avoid markdown, bullets, tables, and code formatting unless user explicitly asks for code. "
                "Mirror the user's language style from their latest message (Hindi, English, or mixed Hinglish) "
                "and keep default replies concise (around 2-4 short lines) unless they ask for detail. "
                "Listen-first: let the user finish; do not talk over them or fill silence unnecessarily; "
                "acknowledge briefly then answer in a calm, attentive way, matching the assistant persona "
                "(warm professional woman vs steady professional man) without being loud or domineering."
            )

    hinglish_line = "" if hindi_only else " Hinglish is welcome when they mix Hindi and English."
    conversation_style = (
        "Conversation feel: this is a real back-and-forth with one human. Be warm, direct, and natural—"
        "varied sentence length, plain words, no corporate script. "
        "Avoid stock-bot openers (e.g. 'I'd be happy to help', 'Great question', 'Certainly', "
        "'As an AI language model', 'How may I assist you today'). "
        "Do not label yourself as an AI or model unless they explicitly ask. "
        "Match their energy: casual if they are casual, brief if they are brief, more detail only when they want it."
        f"{hinglish_line}"
    )

    lang_priority = (
        "Prioritize their goals; your entire reply must be Shuddh Hindi (Devanagari only, no English words). "
        if hindi_only
        else "Prioritize their goals; bilingual Hindi/English. "
    )

    shuddh_block = f" {SHUDDH_HINDI_RULE} " if hindi_only else " "

    system_extra = (
        f"{conversation_style} "
        f"User display name: {profile.get('display_name', 'User')}. "
        f"Address them naturally by name when it fits. "
        f"You are NeoXAI — this user's personal AI assistant (warm, present, one-to-one; not a generic bot). "
        f"{knowledge_cutoff_hint} "
        f"For prices, markets, news, or anything time-sensitive: prefer facts from the live web snippets "
        f"when provided — do not rely on training-only data for numbers, rates, or dates after ~2023. "
        "Treat this as a personal assistant chat, not one-off Q&A. Maintain continuity across sessions. "
        "If user asks what they discussed before or when they talked, answer from known conversation timeline below. "
        "Do not say you have no memory if timeline/current chat context is available. "
        f"{lang_priority}"
        f"{voice_mode_extra}"
        f"{shuddh_block}"
        f"Known preferences / memory hints: {mem[-5:] if mem else 'none yet'}."
    )
    system_extra += (
        f" Live time anchor: UTC now is {now_utc.isoformat(timespec='seconds')}; "
        f"India time (IST) now is {now_ist.strftime('%Y-%m-%d %H:%M:%S %Z')}."
    )
    if web_block:
        system_extra += (
            f"\n\n--- Live data for this turn (Google Programmable Search + Google News RSS; use for {live_year} facts). "
            "Synthesize in your own words; quote numbers, times, and scores only when they appear in the snippets. "
            "If snippets are empty or off-topic, say so briefly — do not invent results.\n"
            f"{web_block}"
        )
    elif want_web:
        system_extra += (
            "\n\n--- Live web fetch note: a web lookup was requested but no usable snippets were fetched. "
            "Do not tell the user to search Google themselves. Instead, say live fetch failed briefly and "
            "provide best-effort answer with clear uncertainty."
        )
    if past_timeline:
        system_extra += (
            "\n\n--- Recent conversation timeline (persisted chat/voice; oldest to newest):\n"
            f"{past_timeline}\n"
            "Use this timeline for continuity and recall questions like 'kal kya baat hui thi?' or "
            "'hum kab baat kiye the?'."
        )
    msgs: list[dict[str, str]] = [{"role": "system", "content": system_extra}]
    for m in body.messages:
        msgs.append({"role": m.role, "content": m.content})

    return ChatRouteContext(
        uid=uid,
        last_user=last_user,
        source=body.source,
        mem=mem,
        web_block=web_block,
        system_extra=system_extra,
        early_reply=None,
        openai_messages=msgs,
    )


async def _persist_chat_exchange(
    uid: str,
    last_user: str,
    reply: str,
    source: str,
    user: dict | None,
    result: ChatCompletionResult | None,
) -> None:
    if "schedule" in last_user.lower() or "समय" in last_user:
        add_memory_fact(uid, "interest", "asks about schedule")
    if last_user:
        add_chat_turn(uid, "user", last_user, source=source)
        add_chat_turn(uid, "assistant", reply, source=source)
    if user and pool_ready() and last_user:
        await insert_chat_messages(uid, last_user, reply, source=source)
        if result:
            await insert_usage_transaction(
                uid,
                "chat",
                metadata={
                    "model": result.model,
                    "endpoint": "openai" if chat_inference_backend() == "openai" else "local",
                },
                prompt_tokens=result.prompt_tokens,
                completion_tokens=result.completion_tokens,
                total_tokens=result.total_tokens,
            )


def _sse(obj: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n".encode("utf-8")


def _completion_result_from_stream_usage(
    full_text: str,
    usage_h: list[dict[str, Any]],
    *,
    model_id: str,
) -> ChatCompletionResult:
    usage = usage_h[0] if usage_h else {}
    pt = usage.get("prompt_tokens")
    ct = usage.get("completion_tokens")
    tt = usage.get("total_tokens")
    return ChatCompletionResult(
        text=full_text,
        model=model_id,
        prompt_tokens=int(pt) if isinstance(pt, int) else None,
        completion_tokens=int(ct) if isinstance(ct, int) else None,
        total_tokens=int(tt) if isinstance(tt, int) else None,
    )


@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse)
async def post_chat(
    body: ChatRequest,
    user: dict | None = Depends(optional_user),
) -> ChatResponse:
    ctx = await _build_chat_route_context(body, user)
    mem = ctx.mem
    if ctx.early_reply is not None:
        await _persist_chat_exchange(ctx.uid, ctx.last_user, ctx.early_reply, ctx.source, user, None)
        snippets = [f"{x['key']}: {x['value']}" for x in mem[-3:]]
        return ChatResponse(reply=ctx.early_reply, memory_snippets=snippets)

    msgs = ctx.openai_messages
    assert msgs is not None
    uid = ctx.uid
    last_user = ctx.last_user
    web_block = ctx.web_block
    system_extra = ctx.system_extra

    try:
        result = await unified_chat_completion(msgs, user_id=uid)
        reply = result.text
        if not web_block and last_user and _looks_like_no_live_access(reply):
            forced_block = await build_live_web_context_block(last_user, now_ist=datetime.now(timezone.utc).astimezone(IST))
            if forced_block:
                retry_system = (
                    f"{system_extra}\n\n--- Live web results (forced retry for current facts).\n"
                    f"{forced_block}"
                )
                retry_msgs: list[dict[str, str]] = [{"role": "system", "content": retry_system}]
                for m in body.messages:
                    retry_msgs.append({"role": m.role, "content": m.content})
                retry = await unified_chat_completion(retry_msgs, user_id=uid)
                result = retry
                reply = retry.text
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("post_chat completion failed")
        raise HTTPException(
            status_code=503,
            detail=(
                f"Chat AI error ({type(e).__name__}): {e}. "
                "If NEO_CHAT_BACKEND=openai: check OPENAI_API_KEY, billing, outbound HTTPS (pm2 logs neo-api). "
                "If NEO_CHAT_BACKEND=local: check NEO_LOCAL_CHAT_URL and that the local server is reachable."
            ),
        ) from e

    await _persist_chat_exchange(uid, last_user, reply, ctx.source, user, result)
    maybe_append_training_log(uid, ctx.source, msgs, reply)
    snippets = [f"{x['key']}: {x['value']}" for x in mem[-3:]]
    return ChatResponse(reply=reply, memory_snippets=snippets)


@router.post("/live-context")
async def post_live_context(
    body: LiveContextBody,
    user: dict | None = Depends(optional_user),
) -> dict[str, str]:
    """Return Google web+news snippet block for a user line (voice Realtime sidecar)."""
    _ = user
    q = (body.query or "").strip()
    if not q:
        return {"block": ""}
    now_ist = datetime.now(timezone.utc).astimezone(IST)
    block = await build_live_web_context_block(q, now_ist=now_ist)
    return {"block": block or ""}


@router.post("/stream")
async def post_chat_stream(
    body: ChatRequest,
    user: dict | None = Depends(optional_user),
) -> StreamingResponse:
    """SSE: optional `{"s":true}` first (live fetch starting), then `{"d":"delta"}` chunks, then `{"done":true}`."""

    last_user_for_ping = next((m.content for m in reversed(body.messages) if m.role == "user"), "")
    emit_searching_ping = bool((last_user_for_ping or "").strip()) and (
        not _is_live_datetime_query(last_user_for_ping) and not _is_recall_query(last_user_for_ping)
    )

    async def gen() -> AsyncIterator[bytes]:
        try:
            if emit_searching_ping:
                yield _sse({"s": True})
            ctx = await _build_chat_route_context(body, user)
            if ctx.early_reply is not None:
                yield _sse({"d": ctx.early_reply})
                await _persist_chat_exchange(ctx.uid, ctx.last_user, ctx.early_reply, ctx.source, user, None)
                yield _sse({"done": True})
                return

            msgs = ctx.openai_messages
            assert msgs is not None
            usage_h: list[dict[str, Any]] = []
            parts: list[str] = []
            model_id = effective_stream_model_id()
            async for delta in unified_stream_chat_deltas(msgs, usage_holder=usage_h):
                parts.append(delta)
                yield _sse({"d": delta})
            full = "".join(parts)
            result = _completion_result_from_stream_usage(full, usage_h, model_id=model_id)
            await _persist_chat_exchange(ctx.uid, ctx.last_user, full, ctx.source, user, result)
            maybe_append_training_log(ctx.uid, ctx.source, msgs, full)
            yield _sse({"done": True})
        except Exception as e:
            logger.exception("post_chat_stream failed")
            yield _sse({"e": str(e)})
            yield _sse({"done": True})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
