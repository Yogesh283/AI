"""NewsAPI.org v2 /everything — headlines for live context and MySQL cron cache."""

from __future__ import annotations

import logging
from urllib.parse import urlparse

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

NEWSAPI_EVERYTHING_URL = "https://newsapi.org/v2/everything"
# Free/developer tiers: keep page size modest.
MAX_NEWSAPI_PAGE = 20


async def fetch_newsapi_everything_snippets(query: str, *, limit: int = 8) -> str:
    """
    Fetch recent articles for `q`, format like other live snippet blocks.
    See https://newsapi.org/docs/endpoints/everything
    """
    key = (settings.newsapi_api_key or "").strip()
    if not key:
        return ""
    q = (query or "").strip()
    if not q:
        return ""
    q = q[:500]
    page_size = min(max(limit, 1), MAX_NEWSAPI_PAGE)
    params = {
        "q": q,
        "sortBy": "publishedAt",
        "language": (settings.newsapi_language or "en").strip() or "en",
        "pageSize": page_size,
        "apiKey": key,
    }
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(NEWSAPI_EVERYTHING_URL, params=params)
        if r.status_code == 401:
            logger.warning("NewsAPI failed: HTTP 401 (invalid API key)")
            return ""
        if r.status_code == 429:
            logger.warning("NewsAPI failed: HTTP 429 (rate limit)")
            return ""
        r.raise_for_status()
        data = r.json()
    except httpx.HTTPStatusError as e:
        logger.warning("NewsAPI failed: HTTP %s", e.response.status_code if e.response else "?")
        return ""
    except Exception as e:
        logger.warning("NewsAPI failed: %s", e)
        return ""

    if not isinstance(data, dict) or data.get("status") != "ok":
        return ""
    articles = data.get("articles")
    if not isinstance(articles, list) or not articles:
        return ""
    lines: list[str] = []
    for i, art in enumerate(articles[:page_size], 1):
        if not isinstance(art, dict):
            continue
        title = str(art.get("title") or "").strip()
        desc = str(art.get("description") or "").strip()
        link = str(art.get("url") or "").strip()
        when = str(art.get("publishedAt") or "").strip()
        if not title and not desc:
            continue
        host = urlparse(link).netloc if link else ""
        src = f"\n   (source: {host})" if host else ""
        time_bit = f" [{when}]" if when else ""
        lines.append(f"{i}. {title}{time_bit}\n   {desc}{src}")
    return "\n".join(lines)
