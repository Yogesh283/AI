from __future__ import annotations

import json
import logging
from typing import Any

import aiomysql

from app.config import settings

logger = logging.getLogger(__name__)

_pool: aiomysql.Pool | None = None

ALLOWED_VOICE_PERSONA_IDS: frozenset[str] = frozenset({"arjun", "sara"})
DEFAULT_VOICE_PERSONA_ID = "sara"


def mysql_configured() -> bool:
    h = (settings.mysql_host or "").strip()
    d = (settings.mysql_database or "").strip()
    return bool(h and d)


def pool_ready() -> bool:
    return _pool is not None


async def init_pool() -> None:
    global _pool
    if not mysql_configured():
        logger.info("MySQL not configured (MYSQL_HOST / MYSQL_DATABASE empty); skipping pool")
        return
    if _pool is not None:
        return
    try:
        _pool = await aiomysql.create_pool(
            host=settings.mysql_host.strip(),
            port=settings.mysql_port,
            user=settings.mysql_user.strip(),
            password=settings.mysql_password,
            db=settings.mysql_database.strip(),
            charset="utf8mb4",
            autocommit=True,
            minsize=1,
            maxsize=8,
        )
        logger.info("MySQL pool ready (%s/%s)", settings.mysql_host, settings.mysql_database)
    except Exception as e:
        logger.warning("MySQL pool failed: %s", e)
        _pool = None


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        await _pool.wait_closed()
        _pool = None


async def sync_user_record(rec: dict[str, Any]) -> None:
    """Upsert user row for FK targets (chat_messages, usage_transactions)."""
    if _pool is None:
        return
    uid = str(rec["id"])
    email = str(rec["email"])
    dn = str(rec.get("display_name") or "")
    pw = str(rec.get("password_hash_b64") or "")
    prov = str(rec.get("auth_provider") or "password")
    if prov not in ("password", "google"):
        prov = "password"
    sql = (
        "INSERT INTO users (id, email, display_name, password_hash_b64, auth_provider) "
        "VALUES (%s, %s, %s, %s, %s) "
        "ON DUPLICATE KEY UPDATE "
        "email = VALUES(email), "
        "display_name = VALUES(display_name), "
        "auth_provider = VALUES(auth_provider), "
        "password_hash_b64 = COALESCE(NULLIF(VALUES(password_hash_b64), ''), password_hash_b64)"
    )
    try:
        async with _pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(sql, (uid, email, dn, pw, prov))
    except Exception as e:
        logger.warning("sync_user_record failed: %s", e)


async def insert_chat_messages(
    user_id: str,
    user_content: str,
    assistant_content: str,
    *,
    source: str = "chat",
) -> None:
    if _pool is None:
        return
    if source not in ("chat", "voice", "tools"):
        source = "chat"
    try:
        async with _pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "INSERT INTO chat_messages (user_id, role, source, content) VALUES (%s, 'user', %s, %s)",
                    (user_id, source, user_content),
                )
                await cur.execute(
                    "INSERT INTO chat_messages (user_id, role, source, content) VALUES (%s, 'assistant', %s, %s)",
                    (user_id, source, assistant_content),
                )
    except Exception as e:
        logger.warning("insert_chat_messages failed: %s", e)


async def insert_usage_transaction(
    user_id: str,
    txn_type: str,
    *,
    metadata: dict[str, Any] | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    total_tokens: int | None = None,
) -> None:
    if _pool is None:
        return
    meta_json = json.dumps(metadata or {}, ensure_ascii=False)
    try:
        async with _pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "INSERT INTO usage_transactions "
                    "(user_id, txn_type, metadata, prompt_tokens, completion_tokens, total_tokens) "
                    "VALUES (%s, %s, %s, %s, %s, %s)",
                    (
                        user_id,
                        txn_type,
                        meta_json,
                        prompt_tokens,
                        completion_tokens,
                        total_tokens,
                    ),
                )
    except Exception as e:
        logger.warning("insert_usage_transaction failed: %s", e)


def normalize_voice_persona_id(raw: str) -> str | None:
    v = (raw or "").strip().lower()
    return v if v in ALLOWED_VOICE_PERSONA_IDS else None


async def fetch_voice_persona_id(user_id: str) -> str:
    """Return stored persona id, or default when MySQL unavailable / unknown."""
    if _pool is None:
        return DEFAULT_VOICE_PERSONA_ID
    try:
        async with _pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT voice_persona_id FROM users WHERE id = %s LIMIT 1",
                    (user_id,),
                )
                row = await cur.fetchone()
        if not row or row[0] is None:
            return DEFAULT_VOICE_PERSONA_ID
        v = str(row[0]).strip().lower()
        return v if v in ALLOWED_VOICE_PERSONA_IDS else DEFAULT_VOICE_PERSONA_ID
    except Exception as e:
        logger.warning("fetch_voice_persona_id failed: %s", e)
        return DEFAULT_VOICE_PERSONA_ID


async def update_voice_persona_id(user_id: str, persona_id: str) -> bool:
    """Persist persona; returns False if pool missing or invalid id."""
    norm = normalize_voice_persona_id(persona_id)
    if norm is None:
        return False
    if _pool is None:
        logger.warning("update_voice_persona_id: no MySQL pool; not persisted")
        return False
    try:
        async with _pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE users SET voice_persona_id = %s WHERE id = %s",
                    (norm, user_id),
                )
        return True
    except Exception as e:
        logger.warning("update_voice_persona_id failed: %s", e)
        return False


async def update_user_display_name(user_id: str, display_name: str) -> None:
    if _pool is None:
        return
    try:
        async with _pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE users SET display_name = %s WHERE id = %s",
                    (display_name, user_id),
                )
    except Exception as e:
        logger.warning("update_user_display_name failed: %s", e)


async def update_user_password_hash(user_id: str, password_hash_b64: str) -> None:
    if _pool is None:
        return
    try:
        async with _pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    "UPDATE users SET password_hash_b64 = %s WHERE id = %s",
                    (password_hash_b64, user_id),
                )
    except Exception as e:
        logger.warning("update_user_password_hash failed: %s", e)


async def fetch_chat_messages_for_user(user_id: str, limit: int = 500) -> list[dict[str, Any]]:
    """Chronological rows for Memory UI — Chat + Voice only (excludes Tools, etc.)."""
    if _pool is None:
        return []
    try:
        async with _pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    "SELECT id, role, content, source, created_at FROM chat_messages "
                    "WHERE user_id = %s AND source IN ('chat', 'voice') "
                    "ORDER BY created_at ASC, id ASC LIMIT %s",
                    (user_id, limit),
                )
                rows = await cur.fetchall()
        out: list[dict[str, Any]] = []
        for r in rows:
            ts = r.get("created_at")
            created = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            out.append(
                {
                    "id": int(r["id"]),
                    "role": str(r["role"]),
                    "content": str(r["content"] or ""),
                    "source": str(r.get("source") or "chat"),
                    "created_at": created,
                }
            )
        return out
    except Exception as e:
        logger.warning("fetch_chat_messages_for_user failed: %s", e)
        return []


async def fetch_auth_user_by_email(email: str) -> dict[str, Any] | None:
    """Read minimal auth user fields from MySQL by email."""
    if _pool is None:
        return None
    em = (email or "").strip().lower()
    if not em:
        return None
    try:
        async with _pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    "SELECT id, email, display_name, password_hash_b64, auth_provider "
                    "FROM users WHERE email = %s LIMIT 1",
                    (em,),
                )
                row = await cur.fetchone()
        if not row:
            return None
        return {
            "id": str(row.get("id") or ""),
            "email": str(row.get("email") or ""),
            "display_name": str(row.get("display_name") or ""),
            "password_hash_b64": str(row.get("password_hash_b64") or ""),
            "auth_provider": str(row.get("auth_provider") or "password"),
        }
    except Exception as e:
        logger.warning("fetch_auth_user_by_email failed: %s", e)
        return None


async def fetch_auth_user_by_id(user_id: str) -> dict[str, Any] | None:
    """Read minimal auth user fields from MySQL by id."""
    if _pool is None:
        return None
    uid = (user_id or "").strip()
    if not uid:
        return None
    try:
        async with _pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    "SELECT id, email, display_name, password_hash_b64, auth_provider "
                    "FROM users WHERE id = %s LIMIT 1",
                    (uid,),
                )
                row = await cur.fetchone()
        if not row:
            return None
        return {
            "id": str(row.get("id") or ""),
            "email": str(row.get("email") or ""),
            "display_name": str(row.get("display_name") or ""),
            "password_hash_b64": str(row.get("password_hash_b64") or ""),
            "auth_provider": str(row.get("auth_provider") or "password"),
        }
    except Exception as e:
        logger.warning("fetch_auth_user_by_id failed: %s", e)
        return None


async def fetch_recent_chat_context(user_id: str, limit: int = 24) -> list[dict[str, Any]]:
    """
    Recent chat+voice rows for model context (oldest -> newest).
    Uses smaller default limit to keep prompt size stable.
    """
    if _pool is None:
        return []
    lim = max(1, min(int(limit), 80))
    try:
        async with _pool.acquire() as conn:
            async with conn.cursor(aiomysql.DictCursor) as cur:
                await cur.execute(
                    "SELECT role, source, content, created_at FROM chat_messages "
                    "WHERE user_id = %s AND source IN ('chat', 'voice') "
                    "ORDER BY created_at DESC, id DESC LIMIT %s",
                    (user_id, lim),
                )
                rows = await cur.fetchall()
        out: list[dict[str, Any]] = []
        for r in reversed(rows):
            ts = r.get("created_at")
            created = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            out.append(
                {
                    "role": str(r.get("role") or ""),
                    "source": str(r.get("source") or ""),
                    "content": str(r.get("content") or ""),
                    "created_at": created,
                }
            )
        return out
    except Exception as e:
        logger.warning("fetch_recent_chat_context failed: %s", e)
        return []
