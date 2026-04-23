"""Periodic refresh (~45m): fetch live snippets → upsert `live_data`; append `new_data` only when content changes."""

from __future__ import annotations

import logging

from app.config import settings
from app.db_mysql import (
    live_data_list_stale,
    live_data_upsert,
    new_data_insert_if_changed,
    pool_ready,
)
from app.services.bing_search import fetch_bing_web_snippets
from app.services.live_data_cache import live_cache_key_for_query
from app.services.web_search import _fetch_serpapi_web_snippets

logger = logging.getLogger(__name__)


def _cron_query_strings() -> list[str]:
    """Deduped topics: LIVE_CRON_QUERIES first, then legacy BING_CRON_QUERIES."""
    seen: set[str] = set()
    out: list[str] = []
    for blob in (settings.live_cron_queries or ""), (settings.bing_cron_queries or ""):
        for q in (blob or "").split(","):
            s = q.strip()
            if s and s not in seen:
                seen.add(s)
                out.append(s)
    return out


async def run_scheduled_live_data_refresh() -> None:
    if not pool_ready():
        logger.warning(
            "Live cron skipped: MySQL pool not ready — set MYSQL_HOST and MYSQL_DATABASE in .env "
            "and ensure MySQL is running so `live_data` / `new_data` can be filled.",
        )
        return

    serp_key = (settings.serpapi_api_key or "").strip()
    bing_key = (settings.bing_search_api_key or "").strip()
    if not serp_key and not bing_key:
        logger.warning(
            "Live cron skipped: no SERPAPI_API_KEY or BING_SEARCH_API_KEY — nothing to fetch into the database.",
        )
        return

    ttl = max(1, min(int(settings.live_cache_ttl_minutes or 45), 24 * 60))
    lim = 8

    seen: set[str] = set()
    queries: list[str] = []

    for s in _cron_query_strings():
        if s not in seen:
            seen.add(s)
            queries.append(s)

    for row in await live_data_list_stale(ttl_minutes=ttl, limit=30):
        q = (row.get("query_sample") or "").strip()
        if q and q not in seen:
            seen.add(q)
            queries.append(q)

    for q in queries:
        try:
            body = ""
            src = ""
            if serp_key:
                body = await _fetch_serpapi_web_snippets(q, limit=lim)
                if body.strip():
                    src = "serpapi"
            if not body.strip() and bing_key:
                body = await fetch_bing_web_snippets(q, limit=lim)
                if body.strip():
                    src = "bing"
            if not body.strip():
                continue

            text = body.strip()
            section = q  # auto “section” label = cron topic / query text

            inserted = await new_data_insert_if_changed(
                section=section,
                snippet_body=text,
                api_source=src,
            )
            if inserted:
                logger.info("new_data: stored new snapshot (section=%s, source=%s)", section[:120], src)

            key = live_cache_key_for_query(q)
            await live_data_upsert(
                cache_key=key,
                query_sample=q[:500],
                snippet_body=text,
                source=src,
            )
        except Exception as e:
            logger.warning("live_data cron refresh failed for %r: %s", q[:80], e)
