"""
Sports / match-style query detection for chat routing.

Live facts themselves come only from Google in {@link app.services.web_search.fetch_google_snippets}
(Custom Search + News RSS) — see `build_live_web_context_block` below.
"""

from __future__ import annotations

from datetime import datetime


def is_sports_live_query(text: str) -> bool:
    """Match / score / league intent → still triggers the same Google live-data fetch (broader augment)."""
    s = (text or "").strip().lower()
    if not s:
        return False
    keys = (
        "score",
        "scores",
        "scorer",
        "fixture",
        "fixtures",
        "match",
        "matches",
        "cricket",
        "football",
        "soccer",
        "ipl",
        "nba",
        "nfl",
        "tennis",
        "hockey",
        "rugby",
        "golf",
        "f1",
        "formula 1",
        "champions league",
        "premier league",
        "la liga",
        "bundesliga",
        "serie a",
        "world cup",
        "euro ",
        "super bowl",
        "league",
        "tournament",
        "vs ",
        " v ",
        "team ",
        "wicket",
        "overs",
        "मैच",
        "क्रिकेट",
        "फुटबॉल",
        "स्कोर",
        "आईपीएल",
    )
    return any(k in s for k in keys)


async def build_live_web_context_block(last_user: str, *, now_ist: datetime) -> str:
    """
    Single live-data pipeline: **Google only** (Programmable Search + Google News RSS in parallel).
    `now_ist` is kept for callers (IST anchor in chat route); search bias uses UTC in `web_search`.
    """
    _ = now_ist  # reserved for future locale-specific tuning
    from app.services.web_search import fetch_google_snippets

    g = await fetch_google_snippets(last_user)
    if not g.strip():
        return ""
    return "### Live data (Google — web search + news)\n" + g.strip()
