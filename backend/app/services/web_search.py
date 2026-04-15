"""Optional Google Custom Search JSON API for grounded answers."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from html import unescape

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

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
    q = augment_search_query((query or "").strip()[:240])
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


async def fetch_google_snippets(query: str, *, limit: int = 5) -> str:
    """
    Returns compact text for LLM context, or empty string if disabled / error.
    Requires GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX in .env (Custom Search Engine).
    """
    key = (settings.google_cse_api_key or "").strip()
    cx = (settings.google_cse_cx or "").strip()
    q = augment_search_query((query or "").strip()[:240])
    if not q:
        return ""
    if not key or not cx:
        # No paid CSE config? still provide live Google-backed data via Google News RSS.
        return await _fetch_google_news_rss_snippets(query, limit=limit)

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
        logger.warning("Google CSE failed: %s", e)
        # Fallback path keeps live web answers available even if CSE quota/key has issues.
        return await _fetch_google_news_rss_snippets(query, limit=limit)

    items = data.get("items") or []
    if not items:
        rss = await _fetch_google_news_rss_snippets(query, limit=limit)
        if rss:
            return rss
        return "(No web results for this query.)"

    lines: list[str] = []
    for i, it in enumerate(items[:limit], 1):
        title = str(it.get("title") or "").strip()
        snippet = str(it.get("snippet") or "").strip()
        link = str(it.get("link") or "").strip()
        lines.append(f"{i}. {title}\n   {snippet}\n   {link}")
    return "\n".join(lines)


def should_auto_fetch_web(user_text: str) -> bool:
    """Time-sensitive / market / news queries → pull live Google snippets when CSE is configured."""
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
    )
    return any(k in s for k in keys)


def augment_search_query(q: str) -> str:
    """Bias query toward fresh results for market/news-style questions."""
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
        )
    )
    now = datetime.now(timezone.utc)
    if marketish:
        return f"{raw} latest news {now.year}"
    if "today" in low or "aaj" in low or "abhi" in low:
        return f"{raw} {now.year}"
    return raw
