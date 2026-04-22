"""Live web context: Brave Web Search (optional), Google CSE (optional), Google News RSS."""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone
from html import unescape
from urllib.parse import urlparse

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Google Programmable Search allows long `q`; keep below API limits but avoid truncating bilingual queries.
MAX_GOOGLE_QUERY_CHARS = 450

GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"
GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search"
BRAVE_WEB_SEARCH_URL = "https://api.search.brave.com/res/v1/web/search"
SERPAPI_URL = "https://serpapi.com/search.json"
IPL_TRUSTED_STANDINGS_HOSTS: tuple[str, ...] = (
    "iplt20.com",
    "www.iplt20.com",
    "espncricinfo.com",
    "www.espncricinfo.com",
    "cricbuzz.com",
    "www.cricbuzz.com",
    "sports.ndtv.com",
    "www.sports.ndtv.com",
)

# Broad industry / sector vocabulary → live Google bias (EN + HI). Avoid very short tokens (false positives).
INDUSTRY_LIVE_QUERY_TERMS_EN: tuple[str, ...] = (
    "industry",
    "industries",
    "sector",
    "sectors",
    "vertical",
    "macro",
    "gdp",
    "inflation",
    "pharma",
    "pharmaceutical",
    "biotech",
    "medtech",
    "healthcare sector",
    "automotive",
    "automobile",
    "manufacturing",
    "industrial production",
    "semiconductor",
    "chip industry",
    "agriculture",
    "agritech",
    "fmcg",
    "consumer goods",
    "retail sector",
    "e-commerce",
    "ecommerce",
    "energy sector",
    "renewable",
    "oil and gas",
    "power sector",
    "telecom",
    "telecommunication",
    "5g",
    "broadband",
    "saas",
    "enterprise software",
    "banking sector",
    "nbfc",
    "fintech",
    "insurance sector",
    "aviation",
    "airline",
    "logistics",
    "shipping",
    "supply chain",
    "infrastructure",
    "construction sector",
    "real estate",
    "cement industry",
    "steel industry",
    "mining sector",
    "chemical industry",
    "textile industry",
    "defence sector",
    "defense sector",
    "aerospace",
    "tourism sector",
    "hospitality industry",
    "hotel industry",
    "gems and jewellery",
    "gems and jewelry",
    "startup ecosystem",
    "unicorn",
    "pse",
    "public sector undertaking",
    "msme",
    "sme sector",
    "edtech",
    "proptech",
    "cleantech",
    "ev industry",
    "electric vehicle",
    "oil price",
    "commodity market",
)
INDUSTRY_LIVE_QUERY_TERMS_HI: tuple[str, ...] = (
    "उद्योग",
    "उद्योगों",
    "क्षेत्र",
    "सेक्टर",
    "विनिर्माण",
    "फार्मा",
    "दवा",
    "ऑटोमोबाइल",
    "टेलीकॉम",
    "बैंकिंग",
    "बीमा",
    "रियल एस्टेट",
    "इंफ्रास्ट्रक्चर",
    "निर्यात",
    "आयात",
    "एमएसएमई",
    "स्टार्टअप",
)


def _looks_like_ipl_points_query(text: str) -> bool:
    s = (text or "").lower()
    return "ipl" in s and any(k in s for k in ("points table", "point table", "standings", "ranking", "ranks"))


def _is_trusted_ipl_standings_entry(query: str, title: str, snippet: str, link: str) -> bool:
    if not _looks_like_ipl_points_query(query):
        return True
    host = urlparse(link).netloc.lower().strip()
    if host not in IPL_TRUSTED_STANDINGS_HOSTS:
        return False
    merged = f"{title} {snippet}".lower()
    return any(k in merged for k in ("points table", "standings", "point table", "pts", "nrr"))


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
        # Keep RSS fast so chat does not feel blocked on web lookup.
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
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
        host = urlparse(link).netloc if link else ""
        src = f" (source: {host})" if host else ""
        lines.append(f"{i}. {title}\n   {snippet}{src}")
    return "\n".join(lines)


async def _fetch_brave_web_snippets(query: str, *, limit: int) -> str:
    """Brave Web Search API — JSON results, no Google CSE required."""
    token = (settings.brave_search_api_key or "").strip()
    if not token:
        return ""
    q = augment_search_query((query or "").strip()[:MAX_GOOGLE_QUERY_CHARS])
    if not q:
        return ""
    count = min(max(limit, 1), 20)
    headers = {
        "Accept": "application/json",
        "X-Subscription-Token": token,
    }
    params = {"q": q, "count": count}
    backoff_seconds = (0.8, 1.6)

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(BRAVE_WEB_SEARCH_URL, headers=headers, params=params)

            if r.status_code in (429, 503):
                logger.warning(
                    "Brave Search HTTP %s (attempt %s/3 — quota or overload; retrying)",
                    r.status_code,
                    attempt + 1,
                )
                if attempt < 2:
                    await asyncio.sleep(backoff_seconds[attempt])
                    continue
                return ""

            try:
                r.raise_for_status()
            except httpx.HTTPStatusError as e:
                sc = e.response.status_code if e.response else 0
                logger.warning("Brave Search failed: HTTP %s", sc)
                return ""

            data = r.json()
        except httpx.HTTPStatusError as e:
            sc = e.response.status_code if e.response else 0
            if sc in (429, 503) and attempt < 2:
                await asyncio.sleep(backoff_seconds[attempt])
                continue
            logger.warning("Brave Search failed: HTTP %s", sc)
            return ""
        except Exception as e:
            logger.warning("Brave Search failed: %s", e)
            return ""

        web = data.get("web") if isinstance(data, dict) else None
        results = web.get("results") if isinstance(web, dict) else None
        if not isinstance(results, list) or not results:
            return ""
        lines: list[str] = []
        for i, it in enumerate(results[:limit], 1):
            if not isinstance(it, dict):
                continue
            title = str(it.get("title") or "").strip()
            snippet = str(it.get("description") or "").strip()
            link = str(it.get("url") or "").strip()
            host = urlparse(link).netloc if link else ""
            src = f"\n   (source: {host})" if host else ""
            lines.append(f"{i}. {title}\n   {snippet}{src}")
        return "\n".join(lines)

    return ""


async def _fetch_serpapi_web_snippets(query: str, *, limit: int) -> str:
    """SerpAPI Google engine results — fallback/alternative to Brave and Google CSE."""
    token = (settings.serpapi_api_key or "").strip()
    if not token:
        return ""
    q = augment_search_query((query or "").strip()[:MAX_GOOGLE_QUERY_CHARS])
    if not q:
        return ""
    count = min(max(limit, 1), 10)
    params = {
        "engine": "google",
        "q": q,
        "api_key": token,
        "num": count,
        "hl": "en",
        "gl": "in",
    }
    backoff_seconds = (0.8, 1.6)

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(SERPAPI_URL, params=params)

            if r.status_code in (429, 503):
                logger.warning(
                    "SerpAPI HTTP %s (attempt %s/3 — quota or overload; retrying)",
                    r.status_code,
                    attempt + 1,
                )
                if attempt < 2:
                    await asyncio.sleep(backoff_seconds[attempt])
                    continue
                return ""

            try:
                r.raise_for_status()
            except httpx.HTTPStatusError as e:
                sc = e.response.status_code if e.response else 0
                logger.warning("SerpAPI failed: HTTP %s", sc)
                return ""

            data = r.json()
        except httpx.HTTPStatusError as e:
            sc = e.response.status_code if e.response else 0
            if sc in (429, 503) and attempt < 2:
                await asyncio.sleep(backoff_seconds[attempt])
                continue
            logger.warning("SerpAPI failed: HTTP %s", sc)
            return ""
        except Exception as e:
            logger.warning("SerpAPI failed: %s", e)
            return ""

        items = data.get("organic_results") if isinstance(data, dict) else None
        if not isinstance(items, list) or not items:
            return ""
        filtered: list[dict] = []
        for it in items:
            if not isinstance(it, dict):
                continue
            title = str(it.get("title") or "").strip()
            snippet = str(it.get("snippet") or "").strip()
            link = str(it.get("link") or "").strip()
            if _is_trusted_ipl_standings_entry(query, title, snippet, link):
                filtered.append(it)
        chosen = filtered if filtered else [it for it in items if isinstance(it, dict)]
        lines: list[str] = []
        for i, it in enumerate(chosen[:count], 1):
            if not isinstance(it, dict):
                continue
            title = str(it.get("title") or "").strip()
            snippet = str(it.get("snippet") or "").strip()
            link = str(it.get("link") or "").strip()
            host = urlparse(link).netloc if link else ""
            src = f"\n   (source: {host})" if host else ""
            lines.append(f"{i}. {title}\n   {snippet}{src}")
        return "\n".join(lines)

    return ""


async def _fetch_google_cse_snippets(query: str, *, limit: int) -> tuple[str, bool]:
    """
    Programmable Search web results. Returns (snippet_text, rate_limited_after_retries).

    Retries on HTTP 429 / 503 with backoff so brief quota spikes behave more like a stable “live search”.
    """
    key = (settings.google_cse_api_key or "").strip()
    cx = (settings.google_cse_cx or "").strip()
    q = augment_search_query((query or "").strip()[:MAX_GOOGLE_QUERY_CHARS])
    if not q or not key or not cx:
        return "", False
    params = {
        "key": key,
        "cx": cx,
        "q": q,
        "num": min(max(limit, 1), 10),
    }
    backoff_seconds = (0.8, 1.6)

    for attempt in range(3):
        try:
            # Short timeout keeps end-user latency responsive on overloaded links.
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(GOOGLE_CSE_URL, params=params)

            if r.status_code in (429, 503):
                logger.warning(
                    "Google CSE HTTP %s (attempt %s/3 — quota or overload; retrying)",
                    r.status_code,
                    attempt + 1,
                )
                if attempt < 2:
                    await asyncio.sleep(backoff_seconds[attempt])
                    continue
                return "", True

            try:
                r.raise_for_status()
            except httpx.HTTPStatusError as e:
                logger.warning(
                    "Google CSE failed: HTTP %s (check API key / quota / referrer restrictions)",
                    e.response.status_code if e.response else "?",
                )
                return "", False

            data = r.json()
        except httpx.HTTPStatusError as e:
            sc = e.response.status_code if e.response else 0
            if sc in (429, 503) and attempt < 2:
                await asyncio.sleep(backoff_seconds[attempt])
                continue
            logger.warning(
                "Google CSE failed: HTTP %s (check API key / quota / referrer restrictions)",
                sc,
            )
            return "", sc in (429, 503)
        except Exception as e:
            logger.warning("Google CSE failed: %s", type(e).__name__)
            return "", False

        items = data.get("items") or []
        if not isinstance(items, list) or not items:
            return "", False
        lines: list[str] = []
        for i, it in enumerate(items[:limit], 1):
            if not isinstance(it, dict):
                continue
            title = str(it.get("title") or "").strip()
            snippet = str(it.get("snippet") or "").strip()
            link = str(it.get("link") or "").strip()
            host = urlparse(link).netloc if link else ""
            src = f"\n   (source: {host})" if host else ""
            lines.append(f"{i}. {title}\n   {snippet}{src}")
        return "\n".join(lines), False

    return "", True


async def fetch_google_snippets(query: str, *, limit: int = 8) -> str:
    """
    Live web bundle for the model: **SerpAPI** (if `SERPAPI_API_KEY`),
    **Brave Search** (if `BRAVE_SEARCH_API_KEY`), **Google CSE** (if `GOOGLE_CSE_*`),
    and **Google News RSS** in parallel.
    If no web-search key is configured, returns News RSS only when available.
    """
    raw = (query or "").strip()[:MAX_GOOGLE_QUERY_CHARS]
    if not augment_search_query(raw):
        return ""

    serpapi_key = (settings.serpapi_api_key or "").strip()
    brave_key = (settings.brave_search_api_key or "").strip()
    cse_key = (settings.google_cse_api_key or "").strip()
    cse_cx = (settings.google_cse_cx or "").strip()
    rss_limit = min(8, max(5, limit))
    cse_limit = min(max(limit, 1), 10)
    brave_limit = min(max(limit, 1), 20)

    async def rss_part() -> str:
        return await _fetch_google_news_rss_snippets(query, limit=rss_limit)

    async def serpapi_part() -> str:
        if not serpapi_key:
            return ""
        return await _fetch_serpapi_web_snippets(query, limit=cse_limit)

    async def brave_part() -> str:
        if not brave_key:
            return ""
        return await _fetch_brave_web_snippets(query, limit=brave_limit)

    async def cse_part() -> tuple[str, bool]:
        if not cse_key or not cse_cx:
            return "", False
        return await _fetch_google_cse_snippets(query, limit=cse_limit)

    if not serpapi_key and not brave_key and not (cse_key and cse_cx):
        rss = await rss_part()
        if rss.strip():
            return "## News (Google News RSS)\n" + rss.strip()
        return ""

    serpapi, brave, (cse, cse_rate_limited), rss = await asyncio.gather(
        serpapi_part(), brave_part(), cse_part(), rss_part()
    )
    parts: list[str] = []
    if serpapi.strip():
        parts.append("## Web (SerpAPI)\n" + serpapi.strip())
    if brave.strip():
        parts.append("## Web (Brave Search)\n" + brave.strip())
    if cse.strip():
        parts.append("## Web (Google Programmable Search)\n" + cse.strip())
    if rss.strip():
        parts.append("## News (Google News RSS)\n" + rss.strip())
    if parts:
        bundle = "\n\n".join(parts)
        if cse_rate_limited and not cse.strip() and rss.strip() and not brave.strip() and not serpapi.strip():
            bundle = (
                "__IMPORTANT: Custom Search (web) API hit rate limits—only News RSS lines appear below. "
                "Headlines may be incomplete; state only facts visible in these lines—do not invent scores or tables.__\n\n"
                + bundle
            )
        return bundle
    return "(No live web results for this query.)"


def should_auto_fetch_web(user_text: str) -> bool:
    """Time-sensitive / market / news / sports / cross-industry sector queries → live web bundle (Brave/CSE/RSS)."""
    s = (user_text or "").lower()
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
        "movie",
        "movies",
        "film",
        "release",
        "bollywood",
        "hollywood",
        "premiere",
        "फिल्म",
        "रिलीज",
        "मूवी",
    ) + INDUSTRY_LIVE_QUERY_TERMS_EN + INDUSTRY_LIVE_QUERY_TERMS_HI
    return any(k in s for k in keys)


def augment_search_query(q: str) -> str:
    """Bias query toward fresh results for market/news/exam-board-style questions."""
    raw = q.strip()
    if not raw:
        return ""
    low = raw.lower()
    marketish = (
        any(
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
        or any(x in low for x in INDUSTRY_LIVE_QUERY_TERMS_EN)
        or any(x in raw for x in INDUSTRY_LIVE_QUERY_TERMS_HI)
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
    movie_tokens_en = ("movie", "movies", "film", "films", "bollywood", "hollywood", "cinema")
    movie_tokens_hi = ("फिल्म", "फिल्में", "मूवी", "सिनेमा")
    releaseish_en = ("release", "releasing", "premiere", "upcoming", "trailer", "theatre", "theater", "ott")
    releaseish_hi = ("रिलीज", "रिलीज़", "कल", "आज", "आ रही", "आएगी", "आएंगी")
    movieish = (
        any(t in low for t in movie_tokens_en) or any(t in raw for t in movie_tokens_hi)
    ) and (
        any(r in low for r in releaseish_en) or any(r in raw for r in releaseish_hi)
    )

    now = datetime.now(timezone.utc)
    if marketish:
        return f"{raw} latest news {now.year}"
    if exam_boardish:
        return f"{raw} {now.year} latest news"
    if movieish:
        return f"{raw} India theatre OTT release date {now.year} latest news bollywood"
    if "today" in low or "aaj" in low or "abhi" in low:
        return f"{raw} {now.year}"
    return raw
