"""Live context from Google only: Programmable Search (JSON) + Google News RSS."""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from html import unescape

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Google Programmable Search allows long `q`; keep below API limits but avoid truncating bilingual queries.
MAX_GOOGLE_QUERY_CHARS = 450

GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"
GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search"


def _strip_xml_tags(text: str) -> str:
    t = re.sub(r"<[^>]+>", " ", text or "")
    t = unescape(t)
    return re.sub(r"\s+", " ", t).strip()


def _parse_google_news_rss(xml_text: str, limit: int) -> list[tuple[str, str, str]]:
    items = re.findall(r"<item>(.*?)</item>", xml_text or "", flags=re.DOTALL | re.IGNORECASE)
    out: list[tuple[str, str, str]] = []
    for raw in items[: max(1, limit)]:
        t = re.search(r"<title>(.*?)</title>", raw, flags=re.DOTALL | re.IGNORECASE)
        l = re.search(r"<link>(.*?)</link>", raw, flags=re.DOTALL | re.IGNORECASE)
        d = re.search(r"<description>(.*?)</description>", raw, flags=re.DOTALL | re.IGNORECASE)
        title = _strip_xml_tags(t.group(1) if t else "")
        link = _strip_xml_tags(l.group(1) if l else "")
        desc = _strip_xml_tags(d.group(1) if d else "")
        if not title and not desc:
            continue
        out.append((title or "Untitled", desc, link))
    return out


async def _fetch_google_news_rss_snippets(query: str, *, limit: int = 5) -> str:
    q = augment_search_query((query or "").strip()[:MAX_GOOGLE_QUERY_CHARS])
    if not q:
        return ""
    params = {"q": q, "hl": "en-IN", "gl": "IN", "ceid": "IN:en"}
    try:
        async with httpx.AsyncClient(timeout=18.0, follow_redirects=True) as client:
            r = await client.get(GOOGLE_NEWS_RSS_URL, params=params)
            r.raise_for_status()
            entries = _parse_google_news_rss(r.text, limit)
    except Exception as e:
        logger.warning("Google News RSS failed: %s", e)
        return ""
    if not entries:
        return ""
    lines: list[str] = []
    for i, (title, snippet, link) in enumerate(entries, 1):
        lines.append(f"{i}. {title}\n   {snippet}\n   {link}")
    return "\n".join(lines)


async def _fetch_google_cse_snippets(query: str, *, limit: int) -> str:
    """Programmable Search web results only (empty if not configured or error)."""
    key = (settings.google_cse_api_key or "").strip()
    cx = (settings.google_cse_cx or "").strip()
    q = augment_search_query((query or "").strip()[:MAX_GOOGLE_QUERY_CHARS])
    if not q or not key or not cx:
        return ""
    params = {
        "key": key,
        "cx": cx,
        "q": q,
        "num": min(max(limit, 1), 10),
    }
    try:
        async with httpx.AsyncClient(timeout=18.0) as client:
            r = await client.get(GOOGLE_CSE_URL, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        if isinstance(e, httpx.HTTPStatusError):
            logger.warning("Google CSE failed: HTTP %s (check API key / quota / referrer restrictions)", e.response.status_code)
        else:
            logger.warning("Google CSE failed: %s", type(e).__name__)
        return ""

    items = data.get("items") or []
    if not isinstance(items, list) or not items:
        return ""
    lines: list[str] = []
    for i, it in enumerate(items[:limit], 1):
        if not isinstance(it, dict):
            continue
        title = str(it.get("title") or "").strip()
        snippet = str(it.get("snippet") or "").strip()
        link = str(it.get("link") or "").strip()
        lines.append(f"{i}. {title}\n   {snippet}\n   {link}")
    return "\n".join(lines)


async def fetch_google_snippets(query: str, *, limit: int = 8) -> str:
    """
    Live Google-only bundle for the model: **Custom Search (web)** when `GOOGLE_CSE_*` is set,
    plus **Google News RSS** in parallel so sports/news/market-style questions get broader coverage.
    If CSE is not configured, returns News RSS only (still Google).
    """
    raw = (query or "").strip()[:MAX_GOOGLE_QUERY_CHARS]
    if not augment_search_query(raw):
        return ""

    key = (settings.google_cse_api_key or "").strip()
    cx = (settings.google_cse_cx or "").strip()
    rss_limit = min(8, max(5, limit))

    async def rss_part() -> str:
        return await _fetch_google_news_rss_snippets(query, limit=rss_limit)

    if not key or not cx:
        rss = await rss_part()
        if rss.strip():
            return "## News (Google News RSS)\n" + rss.strip()
        return ""

    cse_limit = min(max(limit, 1), 10)
    cse, rss = await asyncio.gather(
        _fetch_google_cse_snippets(query, limit=cse_limit),
        rss_part(),  # coroutine
    )
    parts: list[str] = []
    if cse.strip():
        parts.append("## Web (Google Programmable Search)\n" + cse.strip())
    if rss.strip():
        parts.append("## News (Google News RSS)\n" + rss.strip())
    if parts:
        return "\n\n".join(parts)
    return "(No live Google results for this query.)"


def should_auto_fetch_web(user_text: str) -> bool:
    """Time-sensitive / market / news / sports queries → pull live Google bundle (CSE + News RSS when applicable)."""
    s = user_text.lower()
    keys = (
        "today",
        "aaj",
        "abhi",
        "abhi tak",
        "date",
        "time",
        "today date",
        "current time",
        "what time",
        "what date",
        "latest",
        "live",
        "breaking",
        "market",
        "stock",
        "stocks",
        "share price",
        "share ",
        "nifty",
        "sensex",
        "crypto",
        "bitcoin",
        "gold rate",
        "silver",
        "ipo",
        "news",
        "current",
        "rate ",
        "price ",
        "भाव",
        "बाजार",
        "शेयर",
        "ताजा",
        "तारीख",
        "दिनांक",
        "समय",
        "टाइम",
        "कितने बजे",
        "score",
        "scores",
        "fixture",
        "football",
        "soccer",
        "cricket",
        "ipl",
        "nba",
        "tennis",
        "hockey",
        "match ",
        "candle",
        "chart",
        "cbse",
        "icse",
        "board result",
        "board results",
        "exam result",
        "topper",
        "cutoff",
        "merit",
        "रिजल्ट",
        "परिणाम",
        "बोर्ड",
    )
    return any(k in s for k in keys)


def augment_search_query(q: str) -> str:
    """Bias query toward fresh results for market/news/exam-board-style questions."""
    raw = q.strip()
    if not raw:
        return ""
    low = raw.lower()
    marketish = any(
        x in low
        for x in (
            "stock",
            "market",
            "share",
            "nifty",
            "sensex",
            "crypto",
            "gold",
            "ipo",
            "price",
            "rate",
            "today",
            "aaj",
            "live",
            "latest",
            "news",
            "date",
            "time",
            "current time",
            "score",
            "cricket",
            "football",
            "soccer",
            "match",
            "ipl",
            "fixture",
            "candle",
            "standings",
            "ranking",
            "rankings",
            "points table",
        )
    )
    exam_boardish = any(
        x in low
        for x in (
            "cbse",
            "icse",
            "board exam",
            "board result",
            "board results",
            "class 10",
            "class 12",
            "10th ",
            "12th ",
            "merit list",
            "merit",
            "topper",
            "cutoff",
            "cut off",
            "jee",
            "neet",
            "upsc",
            "exam result",
            "exam results",
            "result ",
            "results",
        )
    )
    now = datetime.now(timezone.utc)
    if marketish:
        return f"{raw} latest news {now.year}"
    if exam_boardish:
        return f"{raw} {now.year} latest news"
    if "today" in low or "aaj" in low or "abhi" in low:
        return f"{raw} {now.year}"
    return raw
