"""
Before calling Google (CSE + News), optionally ask the chat model for ONE short search line.

Fixes vague or misspelled board names (e.g. RCBC → RBSE Rajasthan), adds missing years, and
keeps the user's original message in the conversation — only the Google fetch uses the refined line.
"""

from __future__ import annotations

import logging
import re

from app.services.web_search import INDUSTRY_LIVE_QUERY_TERMS_EN, INDUSTRY_LIVE_QUERY_TERMS_HI

logger = logging.getLogger(__name__)

_REFINE_SYSTEM = (
    "You reply with ONE LINE ONLY: the best short English string to type into Google for live web results.\n"
    "Rules:\n"
    "- Maximum 22 words. No quotes, bullets, labels, or explanation — just the search line.\n"
    "- Include the year if the user gave one (e.g. 2016).\n"
    "- If they ask for topper / first rank / highest marks, include words like topper, first rank, merit list.\n"
    "- For Indian school boards: if the acronym looks wrong or ambiguous (e.g. RCBC in a Rajasthan / 10th context), "
    "prefer RBSE (Rajasthan Board of Secondary Education) or spell the full board name when obvious.\n"
    "- For IPL / cricket points table or team rankings: include IPL, year if known, and words like points table standings "
    "official (English search line even if the user wrote Hindi).\n"
    "- For Indian / Bollywood / OTT movie releases or 'what released today/yesterday': English line with "
    "Bollywood or Hindi cinema, release date, India, current year, latest news.\n"
    "- For sector / industry / manufacturing / energy / telecom / banking / pharma / infra / startup / MSME news: "
    "one English line with India, sector name, latest news, and the current year if the user did not give a year.\n"
    "- Keep place names (state, district) when present.\n"
)


def should_refine_google_query(text: str) -> bool:
    """Narrow trigger so we do not add an extra model call on every short chat."""
    t = (text or "").strip()
    if len(t) < 12:
        return False
    low = t.lower()
    keys = (
        "rank",
        "ranking",
        "standings",
        "points table",
        "point table",
        "ipl",
        "cricket",
        "topper",
        "first rank",
        "merit",
        "board",
        "result",
        "cbse",
        "icse",
        "rbse",
        "rcbc",
        "ncert",
        "class 10",
        "class 12",
        "10th",
        "12th",
        "exam",
        "percentage",
        "marks",
        "रिजल्ट",
        "बोर्ड",
        "टॉपर",
        "रैंक",
        "परिणाम",
        "movie",
        "movies",
        "film",
        "bollywood",
        "hollywood",
        "premiere",
        "ott",
        "फिल्म",
        "रिलीज",
        "मूवी",
    ) + INDUSTRY_LIVE_QUERY_TERMS_EN
    if any(k in low for k in keys) or any(k in t for k in INDUSTRY_LIVE_QUERY_TERMS_HI):
        return True
    if "releas" in low or "reless" in low or "relase" in low:
        return True
    if any(
        k in t
        for k in (
            "रिजल्ट",
            "बोर्ड",
            "टॉपर",
            "रैंक",
            "परिणाम",
            "टेबल",
            "तालिका",
            "अंक तालिका",
            "आईपीएल",
            "फिल्म",
            "रिलीज",
            "मूवी",
        )
    ):
        return True
    return bool(re.search(r"\b(19|20)\d{2}\b", t))


async def maybe_refine_google_query(user_text: str, *, user_id: str) -> str:
    raw = (user_text or "").strip()
    if not raw or not should_refine_google_query(raw):
        return raw
    try:
        from app.services.chat_inference import unified_chat_completion

        r = await unified_chat_completion(
            [
                {"role": "system", "content": _REFINE_SYSTEM},
                {"role": "user", "content": raw},
            ],
            user_id=user_id,
            openai_request_overrides={"temperature": 0.12, "max_tokens": 96},
        )
        out = (r.text or "").strip()
        if not out or "[OpenAI" in out or "[local chat" in out:
            return raw
        line = out.split("\n")[0].strip().strip('"').strip("'").strip()
        if len(line) < 4 or len(line) > 480:
            return raw
        return line
    except Exception as e:
        logger.warning("maybe_refine_google_query failed, using raw user text: %s", e)
        return raw
