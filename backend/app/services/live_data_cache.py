"""
MySQL `live_data` cache: serve fresh Bing-shaped snippets from DB when within TTL;
otherwise fetch Bing, write through, then fall back to empty (caller uses Google bundle).
"""

from __future__ import annotations

import hashlib
import logging
import re
from app.config import settings
from app.db_mysql import live_data_get_fresh, live_data_upsert, pool_ready
from app.services.bing_search import fetch_bing_web_snippets

logger = logging.getLogger(__name__)

_CACHE_KEY_MAX = 500


def live_cache_key_for_query(search_query: str) -> str:
    """Stable SHA-256 hex for normalized search string (matches DB primary key)."""
    s = (search_query or "").strip().lower()
    s = re.sub(r"\s+", " ", s)[:_CACHE_KEY_MAX]
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


async def try_live_db_then_bing_snippets(primary: str, *, limit: int) -> str:
    """
    If MySQL + row fresh (<= LIVE_CACHE_TTL_MINUTES): return Bing-style body with header.
    Else if Bing API key: fetch, upsert to `live_data`, return body with header.
    Else: "".
    """
    primary = (primary or "").strip()
    if not primary:
        return ""

    key = live_cache_key_for_query(primary)
    ttl = max(1, min(int(settings.live_cache_ttl_minutes or 45), 24 * 60))

    if pool_ready():
        cached = await live_data_get_fresh(key, ttl_minutes=ttl)
        if cached:
            return "## Web (Bing — cached in DB)\n" + cached.strip()

    bing_key = (settings.bing_search_api_key or "").strip()
    if not bing_key:
        return ""

    body = await fetch_bing_web_snippets(primary, limit=limit)
    if not body.strip():
        return ""

    if pool_ready():
        try:
            await live_data_upsert(
                cache_key=key,
                query_sample=primary[:500],
                snippet_body=body.strip(),
                source="bing",
            )
        except Exception as e:
            logger.warning("live_data upsert failed: %s", e)

    return "## Web (Bing Web Search)\n" + body.strip()
