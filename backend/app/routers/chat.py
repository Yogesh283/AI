from __future__ import annotations

import re
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from typing import Literal

from pydantic import BaseModel, Field

from app.db_mysql import (
    fetch_recent_chat_context,
    insert_chat_messages,
    insert_usage_transaction,
    pool_ready,
)
from app.routers.auth import optional_user
from app.services.ai import chat_completion
from app.services.web_search import fetch_google_snippets, should_auto_fetch_web
from app.store import add_chat_turn, add_memory_fact, get_memory, get_profile, get_recent_chat_history

router = APIRouter(prefix="/api/chat", tags=["chat"])
IST = ZoneInfo("Asia/Kolkata")


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
        f"Abhi live India time (IST) {t12} ({t24}) hai.\n"
        f"Aaj ki date {date_label}, {day_label} hai.\n\n"
        "If you want, main isi ke basis par aaj ka quick schedule bana doon."
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
            "Abhi mere paas is user ke liye purani conversation timeline nahi mili. "
            "Aap jo yaad karna chahte ho woh line likho, main usko memory mein pin kar dunga."
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
        f"Haan, humari pichli baat [{when}] par hui thi.\n"
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


class ChatResponse(BaseModel):
    reply: str
    memory_snippets: list[str] = []


@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse)
async def post_chat(
    body: ChatRequest,
    user: dict | None = Depends(optional_user),
) -> ChatResponse:
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

    # Hard guarantee for date/time queries: reply from live server clock, not model memory.
    if _is_live_datetime_query(last_user):
        reply = _live_datetime_reply(now_ist)
        if last_user:
            add_chat_turn(uid, "user", last_user, source=body.source)
            add_chat_turn(uid, "assistant", reply, source=body.source)
        if user and pool_ready() and last_user:
            await insert_chat_messages(uid, last_user, reply, source=body.source)
        snippets = [f"{x['key']}: {x['value']}" for x in mem[-3:]]
        return ChatResponse(reply=reply, memory_snippets=snippets)

    # Personal recall guarantee for "what/when we talked" questions.
    if _is_recall_query(last_user):
        reply = _recall_reply_from_timeline(timeline_rows)
        if last_user:
            add_chat_turn(uid, "user", last_user, source=body.source)
            add_chat_turn(uid, "assistant", reply, source=body.source)
        if user and pool_ready() and last_user:
            await insert_chat_messages(uid, last_user, reply, source=body.source)
        snippets = [f"{x['key']}: {x['value']}" for x in mem[-3:]]
        return ChatResponse(reply=reply, memory_snippets=snippets)

    web_block = ""
    want_web = bool(last_user.strip()) and (body.use_web or should_auto_fetch_web(last_user))
    if want_web:
        web_block = await fetch_google_snippets(last_user)

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
    # General world knowledge in the model may lag; web snippets are the "live" layer for current-year facts.
    knowledge_cutoff_hint = (
        "Your baked-in general knowledge reflects training up to roughly 2023 — treat it as background only "
        "for time-sensitive facts (prices, sports results, who is in office, etc.). "
        f"When live web snippets are provided below, they are the source for current ({live_year}) facts."
    )
    voice_mode_extra = ""
    if body.source == "voice":
        voice_mode_extra = (
            " Voice mode output rules: talk naturally like two humans in a real call. "
            "Prefer short, clear spoken sentences (no dense paragraphs). "
            "Avoid markdown, bullets, tables, and code formatting unless user explicitly asks for code. "
            "Mirror the user's language style from their latest message (Hindi, English, or mixed Hinglish) "
            "and keep default replies concise (around 2-4 short lines) unless they ask for detail."
        )

    system_extra = (
        f"User display name: {profile.get('display_name', 'User')}. "
        f"Address them naturally by name when it fits. "
        f"You are NeoXAI — this user's personal AI assistant (warm, present, one-to-one; not a generic bot). "
        f"{knowledge_cutoff_hint} "
        f"For prices, markets, news, or anything time-sensitive: prefer facts from the live web snippets "
        f"when provided — do not rely on training-only data for numbers, rates, or dates after ~2023. "
        "Treat this as a personal assistant chat, not one-off Q&A. Maintain continuity across sessions. "
        "If user asks what they discussed before or when they talked, answer from known conversation timeline below. "
        "Do not say you have no memory if timeline/current chat context is available. "
        f"Prioritize their goals; bilingual Hindi/English. "
        f"{voice_mode_extra}"
        f"Known preferences / memory hints: {mem[-5:] if mem else 'none yet'}."
    )
    system_extra += (
        f" Live time anchor: UTC now is {now_utc.isoformat(timespec='seconds')}; "
        f"India time (IST) now is {now_ist.strftime('%Y-%m-%d %H:%M:%S %Z')}."
    )
    if web_block:
        system_extra += (
            f"\n\n--- Live web results (Google; current-year / latest — use for {live_year} facts when relevant). "
            "Answer in your own words; be specific with dates/numbers from snippets when relevant. "
            "If snippets are empty or off-topic, say so briefly.\n"
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

    result = await chat_completion(msgs, user_id=uid)
    reply = result.text
    if not web_block and last_user and _looks_like_no_live_access(reply):
        # Retry once with forced web fetch so the user gets concrete live data when possible.
        forced_block = await fetch_google_snippets(last_user)
        if forced_block:
            retry_system = (
                f"{system_extra}\n\n--- Live web results (forced retry for current facts).\n"
                f"{forced_block}"
            )
            retry_msgs: list[dict[str, str]] = [{"role": "system", "content": retry_system}]
            for m in body.messages:
                retry_msgs.append({"role": m.role, "content": m.content})
            retry = await chat_completion(retry_msgs, user_id=uid)
            result = retry
            reply = retry.text

    if "schedule" in last_user.lower() or "समय" in last_user:
        add_memory_fact(uid, "interest", "asks about schedule")

    if last_user:
        add_chat_turn(uid, "user", last_user, source=body.source)
        add_chat_turn(uid, "assistant", reply, source=body.source)

    if user and pool_ready() and last_user:
        await insert_chat_messages(uid, last_user, reply, source=body.source)
        await insert_usage_transaction(
            uid,
            "chat",
            metadata={"model": result.model, "endpoint": "chat/completions"},
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            total_tokens=result.total_tokens,
        )

    snippets = [f"{x['key']}: {x['value']}" for x in mem[-3:]]
    return ChatResponse(reply=reply, memory_snippets=snippets)
