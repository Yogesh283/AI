"""
Sports / match-style query detection for chat routing.

Live facts: MySQL `new_data` (cron snapshots) + `live_data` / Bing →
{@link app.services.web_search.fetch_google_snippets} (Brave / CSE / RSS).
"""

from __future__ import annotations

import re
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
    m = re.search(r"\b(20\d{2})\b", t)
    if m:
        y = int(m.group(1))
    if is_sports_live_query(t):
        return f"IPL cricket points table standings team rankings {y} latest news {t[:200]}"
    return t


async def build_live_web_context_block(last_user: str, *, now_ist: datetime) -> str:
    """
    Live-data pipeline: MySQL `new_data` (cron snapshots) when relevant → `live_data` / Bing →
    Brave / Google CSE / News RSS. Same block feeds text chat and voice `/live-context`. `now_ist` stamps IST.
    """
    from app.db_mysql import new_data_bundle_for_live_context, pool_ready
    from app.services.live_data_cache import try_live_db_then_bing_snippets
    from app.services.web_search import fetch_google_snippets

    primary = google_fetch_query(last_user)
    lim = 10 if is_sports_live_query(last_user) else 8

    db_snap = ""
    if pool_ready():
        try:
            db_snap = await new_data_bundle_for_live_context(primary, limit=5)
        except Exception:
            db_snap = ""

    g = await try_live_db_then_bing_snippets(primary, limit=lim)
    if not g.strip():
        g = await fetch_google_snippets(primary, limit=lim)
    if not g.strip() and is_sports_live_query(last_user):
        y = datetime.now(timezone.utc).year
        m = re.search(r"\b(20\d{2})\b", (last_user or "").strip())
        if m:
            y = int(m.group(1))
        g = await fetch_google_snippets(
            f"IPL {y} points table standings teams ranked latest news", limit=lim
        )

    parts: list[str] = []
    if db_snap.strip():
        parts.append("### Cached live rows (MySQL `new_data`)\n" + db_snap.strip())
    if g.strip():
        parts.append("### Live fetch (web search + news)\n" + g.strip())
    if not parts:
        return ""

    stamp = now_ist.strftime("%Y-%m-%d %H:%M %Z")
    anchor = (
        f"Retrieved {stamp}. Use this clock when judging whether a headline's 'current' or 'latest' table matches "
        "what the user asked; if snippets conflict or are stale, say so—do not guess.\n\n"
    )
    return anchor + "\n\n".join(parts)
