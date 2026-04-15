"""Optional Google Custom Search JSON API for grounded answers."""

from __future__ import annotations

import logging
from urllib.parse import quote

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"


async def fetch_google_snippets(query: str, *, limit: int = 5) -> str:
    """
    Returns compact text for LLM context, or empty string if disabled / error.
    Requires GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX in .env (Custom Search Engine).
    """
    key = (settings.google_cse_api_key or "").strip()
    cx = (settings.google_cse_cx or "").strip()
    q = (query or "").strip()[:240]
    if not key or not cx or not q:
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
        logger.warning("Google CSE failed: %s", e)
        return ""

    items = data.get("items") or []
    if not items:
        return "(No web results for this query.)"

    lines: list[str] = []
    for i, it in enumerate(items[:limit], 1):
        title = str(it.get("title") or "").strip()
        snippet = str(it.get("snippet") or "").strip()
        link = str(it.get("link") or "").strip()
        lines.append(f"{i}. {title}\n   {snippet}\n   {link}")
    return "\n".join(lines)
