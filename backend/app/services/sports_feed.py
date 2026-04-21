"""
Sports / match-style query detection for chat routing.

Live facts themselves come only from Google in {@link app.services.web_search.fetch_google_snippets}
(Custom Search + News RSS) — see `build_live_web_context_block` below.
"""

from __future__ import annotations

from datetime import datetime, timezone


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
        "standings",
        "ranking",
        "rankings",
        "points table",
        "points-table",
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
        "रैंक",
        "रैंकिंग",
        "पॉइंट्स",
        "अंक तालिका",
    )
    return any(k in s for k in keys)


def google_fetch_query(user_text: str) -> str:
    """
    Build the actual Google CSE/RSS query string. English tokens first so a length cap
    still retrieves IPL/sports tables when the user writes in Hindi script.
    """
    t = (user_text or "").strip()
    if not t:
        return t
    y = datetime.now(timezone.utc).year
    if is_sports_live_query(t):
        return f"IPL cricket points table standings team rankings {y} latest news {t[:200]}"
    return t


async def build_live_web_context_block(last_user: str, *, now_ist: datetime) -> str:
    """
    Single live-data pipeline: **Google only** (Programmable Search + Google News RSS in parallel).
    `now_ist` stamps the block so the model can align 'current season' headlines with real time.
    """
    from app.services.web_search import fetch_google_snippets

    primary = google_fetch_query(last_user)
    g = await fetch_google_snippets(primary)
    if not g.strip() and is_sports_live_query(last_user):
        y = datetime.now(timezone.utc).year
        g = await fetch_google_snippets(f"IPL {y} points table standings teams ranked latest news")
    if not g.strip():
        return ""
    stamp = now_ist.strftime("%Y-%m-%d %H:%M %Z")
    anchor = (
        f"Retrieved {stamp}. Use this clock when judging whether a headline's 'current' or 'latest' table matches "
        "what the user asked; if snippets conflict or are stale, say so—do not guess.\n\n"
    )
    return anchor + "### Live data (Google — web search + news)\n" + g.strip()
