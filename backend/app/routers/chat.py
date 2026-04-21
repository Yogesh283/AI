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
from app.services.live_google_query_refine import maybe_refine_google_query
from app.services.sports_feed import build_live_web_context_block, is_sports_live_query
from app.store import add_chat_turn, add_memory_fact, get_memory, get_profile, get_recent_chat_history

router = APIRouter(prefix="/api/chat", tags=["chat"])
IST = ZoneInfo("Asia/Kolkata")
logger = logging.getLogger(__name__)
# Tighter decoding when live Google snippets are in context (reduces invented scores / tables).
CHAT_TEMP_WITH_LIVE_WEB = 0.28


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


def _reply_claims_no_live_data(reply: str) -> bool:
    """True when the model deflects instead of using live/Google-backed facts (Hindi + English)."""
    if not (reply or "").strip():
        return False
    if _looks_like_no_live_access(reply):
        return True
    low = reply.lower()
    needles = (
        "i don't have the latest",
        "i do not have the latest",
        "don't have specific information",
        "do not have specific information",
        "no specific information",
        "no access to live",
        "don't have access to live",
        "unable to provide real-time",
        "cannot provide real-time",
        "no real-time",
        "without live data",
        "no points table",
        "don't have the points",
        "i have no data on",
        "couldn't find specific",
        "could not find specific",
        "i don't have access to",
    )
    if any(n in low for n in needles):
        return True
    r = reply
    if "मेरे पास" in r and "नहीं" in r and any(
        x in r for x in ("डेटा", "जानकारी", "तालिका", "रैंक", "आईपीएल", "ipl")
    ):
        return True
    for frag in ("जानकारी नहीं", "डेटा नहीं", "नहीं मिली है", "नहीं मिली"):
        if frag in r:
            return True
    if "अंक तालिका" in r and "नहीं" in r:
        return True
    return False


_STANDINGS_TABLE_FORMAT_FIX = (
    "\n\n--- MANDATORY FORMAT FIX\n"
    "Your last answer used a markdown pipe table (| … |) for league or IPL standings. That format led to wrong rows "
    "that do not match the LIVE DATA snippets. Regenerate the answer: NO pipe tables and no '|' grids. "
    "Use short bullets or sentences only; each fact must clearly restate wording from the LIVE DATA lines above "
    "(team names, points, matches) without inventing numbers. If snippets only cover some teams, list only those and "
    "say the rest were not in the retrieved lines.\n"
)


def _user_asks_standings_or_table(text: str) -> bool:
    """User wants ranks / points table / tabular style (EN + HI)."""
    s = (text or "").strip().lower()
    hi = text or ""
    if not s:
        return False
    keys_en = (
        "points table",
        "point table",
        "standings",
        "ranking",
        "which rank",
        "which team",
        "tabular",
        "in a table",
    )
    keys_hi = ("टेबल", "तालिका", "सारणी", "रैंक", "अंक तालिका", "रैंकिंग")
    if any(k in s for k in keys_en):
        return True
    if any(k in hi for k in keys_hi):
        return True
    if "table" in s and any(x in s for x in ("rank", "team", "ipl", "point")):
        return True
    return False


def _reply_uses_markdown_pipe_table(reply: str) -> bool:
    """GFM-style pipe tables — common source of fabricated standings grids."""
    lines = (reply or "").splitlines()
    pipe_rows = [ln for ln in lines if ln.count("|") >= 2 and not ln.strip().startswith("```")]
    if len(pipe_rows) >= 2:
        return True
    return any(ln.strip().startswith("|") and ln.count("|") >= 4 for ln in lines)


def _needs_standings_table_retry(last_user: str, reply: str, web_block: str) -> bool:
    if not (web_block or "").strip() or not (reply or "").strip():
        return False
    if not is_sports_live_query(last_user):
        return False
    if not _user_asks_standings_or_table(last_user):
        return False
    return _reply_uses_markdown_pipe_table(reply)


def _append_system_suffix(msgs: list[dict[str, str]], suffix: str) -> list[dict[str, str]]:
    if not msgs or not suffix.strip():
        return msgs
    out: list[dict[str, str]] = []
    for i, m in enumerate(msgs):
        if i == 0 and m.get("role") == "system":
            out.append({"role": "system", "content": (m.get("content") or "") + suffix})
        else:
            out.append(dict(m))
    return out


def _friendly_chat_stream_failure_message(exc: BaseException) -> str:
    """Shown in-chat when SSE cannot finish — no raw stack traces or vendor noise."""
    low = str(exc).lower()
    if any(x in low for x in ("connect", "connection", "timeout", "timed out", "unreachable", "refused", "reset")):
        return (
            "That request didn’t finish (network or service was busy). "
            "Please tap **Send** again — your message is fine. "
            "If it keeps happening, check Wi‑Fi/VPN or wait a minute."
        )
    return (
        "Something went wrong while drafting that reply. "
        "Please try **Send** once more. If it repeats, refresh the page or check **Profile**."
    )


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
        try:
            query_for_google = await maybe_refine_google_query(last_user, user_id=uid)
            web_block = await build_live_web_context_block(query_for_google, now_ist=now_ist)
        except Exception as e:
            logger.warning("live Google context skipped for this turn: %s", e)
            web_block = ""

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
    live_google_policy = (
        "Live Google policy: for this turn the backend already ran (or attempted) a Google-backed web+news lookup "
        "from the user's latest message before you answer—covers general A-to-Z topics, not only news or markets. "
        "When snippets appear below, treat them as your research: synthesize the answer here in the user's language. "
        "Never tell the user to open other websites, official portals, apps, or search engines for the same "
        "information (no 'go check there', 'search Google', or browsing homework). "
        "If snippets are missing or thin, give a short honest reply: say live search did not return verified lines "
        "for the exact figures they asked for—do **not** fill gaps from training memory (no plausible-looking fake "
        "scores, tables, prices, or ranks). Wrong confident data is worse than 'not confirmed from search'. "
        "Still do not send them elsewhere for the same lookup. "
        "Accuracy over completeness: never invent numbers, rates, or ranks to look helpful—only state what snippets support."
    )
    live_presentation_policy = (
        "Live presentation (chat): the snippet block below is internal research—not something to paste. In your reply, "
        "never dump raw search payload: no HTML/XML tags, no long Google redirect or encoded link strings (e.g. "
        "news.google.com/rss/articles/CBM…), no scraper junk. Rewrite as a clean, readable short analysis—lead with "
        "the takeaway, then key facts in plain words. If snippets disagree or are too thin, say that clearly. "
        "Before you send: every number or rank you state must be traceable to a specific phrase in the snippet lines; "
        "if you cannot trace it, omit it."
    )
    sports_standings_rule = ""
    if is_sports_live_query(last_user):
        sports_standings_rule = (
            "Sports / IPL / league standings: NEVER use a GitHub markdown pipe table (no | rows), even if the user "
            "asks for a 'table' or 'टेबल'. Pipe tables caused wrong invented scores. Use bullets or short sentences; "
            "each line must follow the LIVE DATA snippet lines—same teams and numbers as written there. "
        )
    table_format_policy = (
        f"{sports_standings_rule}"
        "For non-sports topics only: when the user asks for a table and snippets already contain the same numbers "
        "next to the same labels, you may use a small markdown pipe table; otherwise use prose. "
        "If snippets are narrative-only or missing columns, do **not** invent a full grid — answer in clear prose "
        "with only facts from snippets and say the full table is not in the retrieved lines."
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
        f"{live_google_policy} "
        f"{live_presentation_policy} "
        f"{table_format_policy} "
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
            "STANDINGS / IPL / LEAGUE: never use markdown pipe tables (|). Do not output a full ladder unless snippets "
            "literally list those teams with those numbers. Prefer bullets mirroring snippet lines. If snippets only "
            "give partial info or headlines, summarize honestly — never fabricate rows from training memory. "
            "Answer here from these snippets—do not tell the user to browse other websites for the same lookup. "
            "If snippets are empty or off-topic, say so briefly — do not invent results.\n"
            f"{web_block}"
        )
    elif want_web:
        system_extra += (
            "\n\n--- Live web fetch note: Google-backed lookup did not return usable snippets for this message. "
            "For anything that needs **exact** current facts (sports scores/points, live prices, election counts, "
            "breaking who-won): do not invent numbers or a full table from memory—say clearly that live lines were "
            "not retrieved so those specifics are not confirmed here. General background without fake figures is OK. "
            "Reply in a few concise sentences. "
            "Do not tell the user to search Google, open official sites, or use other apps for the same question."
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
        live_ov = {"temperature": CHAT_TEMP_WITH_LIVE_WEB} if web_block else None
        result = await unified_chat_completion(msgs, user_id=uid, openai_request_overrides=live_ov)
        reply = result.text
        if web_block and last_user and _reply_claims_no_live_data(reply):
            retry_system = (
                f"{system_extra}\n\n--- MANDATORY CORRECTION\n"
                "Your last answer wrongly implied you lack live data. The LIVE DATA section above already contains "
                "Google snippets. Answer again using ONLY those lines for ranks, points, teams, and dates—do not say "
                "you have no points table while that section is non-empty.\n"
            )
            retry_msgs = [{"role": "system", "content": retry_system}]
            for m in body.messages:
                retry_msgs.append({"role": m.role, "content": m.content})
            retry = await unified_chat_completion(
                retry_msgs,
                user_id=uid,
                openai_request_overrides={"temperature": CHAT_TEMP_WITH_LIVE_WEB},
            )
            result = retry
            reply = retry.text
        elif not web_block and last_user and _reply_claims_no_live_data(reply):
            try:
                rq = await maybe_refine_google_query(last_user, user_id=uid)
                forced_block = await build_live_web_context_block(
                    rq, now_ist=datetime.now(timezone.utc).astimezone(IST)
                )
            except Exception as fe:
                logger.warning("post_chat forced Google fetch failed: %s", fe)
                forced_block = ""
            if forced_block:
                retry_system = (
                    f"{system_extra}\n\n--- Live web results (forced retry for current facts).\n"
                    f"{forced_block}"
                )
                retry_msgs = [{"role": "system", "content": retry_system}]
                for m in body.messages:
                    retry_msgs.append({"role": m.role, "content": m.content})
                retry = await unified_chat_completion(
                    retry_msgs,
                    user_id=uid,
                    openai_request_overrides={"temperature": CHAT_TEMP_WITH_LIVE_WEB},
                )
                result = retry
                reply = retry.text
        if web_block and last_user and _needs_standings_table_retry(last_user, reply, web_block):
            retry_msgs = _append_system_suffix(msgs, _STANDINGS_TABLE_FORMAT_FIX)
            retry = await unified_chat_completion(
                retry_msgs,
                user_id=uid,
                openai_request_overrides={"temperature": CHAT_TEMP_WITH_LIVE_WEB},
            )
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
    q = (body.query or "").strip()
    if not q:
        return {"block": ""}
    uid = str(user["id"]) if user else "default"
    now_ist = datetime.now(timezone.utc).astimezone(IST)
    try:
        rq = await maybe_refine_google_query(q, user_id=uid)
        block = await build_live_web_context_block(rq, now_ist=now_ist)
    except Exception as e:
        logger.warning("post_live_context Google fetch failed: %s", e)
        block = ""
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
            stream_temp = CHAT_TEMP_WITH_LIVE_WEB if (ctx.web_block or "").strip() else None

            async def _collect_stream(
                mlist: list[dict[str, str]],
                uh: list[dict[str, Any]],
                *,
                force_live_temp: bool = False,
            ) -> str:
                acc: list[str] = []
                t = CHAT_TEMP_WITH_LIVE_WEB if force_live_temp else stream_temp
                async for delta in unified_stream_chat_deltas(mlist, usage_holder=uh, temperature=t):
                    acc.append(delta)
                return "".join(acc)

            if emit_searching_ping:
                full = await _collect_stream(msgs, usage_h)
                retry_msgs: list[dict[str, str]] | None = None
                if ctx.last_user.strip() and _reply_claims_no_live_data(full):
                    if ctx.web_block:
                        suffix = (
                            "\n\n--- MANDATORY CORRECTION\n"
                            "Your draft wrongly implied you lack live data. The LIVE DATA section above already "
                            "contains Google snippets. Answer using ONLY those lines for ranks, points, and teams—"
                            "do not claim you have no table while that section is non-empty.\n"
                        )
                        retry_msgs = _append_system_suffix(msgs, suffix)
                    else:
                        try:
                            rq = await maybe_refine_google_query(ctx.last_user, user_id=ctx.uid)
                            forced_block = await build_live_web_context_block(
                                rq, now_ist=datetime.now(timezone.utc).astimezone(IST)
                            )
                        except Exception as fe:
                            logger.warning("stream retry Google fetch failed: %s", fe)
                            forced_block = ""
                        if forced_block:
                            retry_msgs = _append_system_suffix(
                                msgs,
                                "\n\n--- Live web results (retrieved on retry — use for this answer)\n"
                                f"{forced_block}\n",
                            )
                if retry_msgs is not None:
                    usage_h2: list[dict[str, Any]] = []
                    full2 = await _collect_stream(retry_msgs, usage_h2, force_live_temp=True)
                    if len(full2.strip()) >= max(24, int(len(full.strip()) * 0.35)):
                        full = full2
                        usage_h.clear()
                        usage_h.extend(usage_h2)
                if (
                    ctx.web_block
                    and ctx.last_user.strip()
                    and _needs_standings_table_retry(ctx.last_user, full, ctx.web_block)
                ):
                    fix_msgs = _append_system_suffix(msgs, _STANDINGS_TABLE_FORMAT_FIX)
                    usage_h3: list[dict[str, Any]] = []
                    full3 = await _collect_stream(fix_msgs, usage_h3, force_live_temp=True)
                    if len(full3.strip()) >= 40:
                        full = full3
                        usage_h.clear()
                        usage_h.extend(usage_h3)
                for i in range(0, len(full), 120):
                    yield _sse({"d": full[i : i + 120]})
            else:
                async for delta in unified_stream_chat_deltas(
                    msgs, usage_holder=usage_h, temperature=stream_temp
                ):
                    parts.append(delta)
                    yield _sse({"d": delta})
                full = "".join(parts)
            result = _completion_result_from_stream_usage(full, usage_h, model_id=model_id)
            await _persist_chat_exchange(ctx.uid, ctx.last_user, full, ctx.source, user, result)
            maybe_append_training_log(ctx.uid, ctx.source, msgs, full)
            yield _sse({"done": True})
        except Exception as e:
            logger.exception("post_chat_stream failed")
            # Send assistant text instead of `{"e":...}` so the web client does not throw and the user
            # still sees a calm message (especially after live-fetch turns).
            yield _sse({"d": _friendly_chat_stream_failure_message(e)})
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
