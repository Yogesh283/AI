"""Bing Web Search API v7 — snippets for live context (optional; requires BING_SEARCH_API_KEY)."""

from __future__ import annotations

import logging
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.services.web_search import MAX_GOOGLE_QUERY_CHARS, augment_search_query

logger = logging.getLogger(__name__)

DEFAULT_BING_ENDPOINT = "https://api.bing.microsoft.com/v7.0/search"


async def fetch_bing_web_snippets(query: str, *, limit: int = 8) -> str:
    """
    Returns plain numbered lines (title + snippet + host), same shape as Google CSE lines
    inside `fetch_google_snippets` bundles — no section header.
    """
    key = (settings.bing_search_api_key or "").strip()
    if not key:
        return ""
    endpoint = (settings.bing_search_endpoint or "").strip() or DEFAULT_BING_ENDPOINT
    raw = (query or "").strip()[:MAX_GOOGLE_QUERY_CHARS]
    q = augment_search_query(raw)
    if not q:
        return ""
    lim = min(max(int(limit), 1), 10)
    params = {"q": q, "count": str(lim), "textDecorations": "false"}
    headers = {"Ocp-Apim-Subscription-Key": key}
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(endpoint, params=params, headers=headers)
        if r.status_code in (401, 403):
            logger.warning("Bing Web Search HTTP %s (check key / resource)", r.status_code)
            return ""
        r.raise_for_status()
        data = r.json()
    except httpx.HTTPStatusError as e:
        sc = e.response.status_code if e.response else 0
        logger.warning("Bing Web Search failed: HTTP %s", sc)
        return ""
    except Exception as e:
        logger.warning("Bing Web Search failed: %s", type(e).__name__)
        return ""

    web = data.get("webPages") or {}
    items = web.get("value") if isinstance(web, dict) else None
    if not isinstance(items, list) or not items:
        return ""

    lines: list[str] = []
    for i, it in enumerate(items[:lim], 1):
        if not isinstance(it, dict):
            continue
        title = str(it.get("name") or it.get("title") or "").strip()
        snippet = str(it.get("snippet") or "").strip()
        link = str(it.get("url") or it.get("link") or "").strip()
        host = urlparse(link).netloc if link else ""
        src = f"\n   (source: {host})" if host else ""
        lines.append(f"{i}. {title}\n   {snippet}{src}")
    return "\n".join(lines)
