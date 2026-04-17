from __future__ import annotations

from datetime import datetime, timezone
import uuid
from typing import Any

_memory: dict[str, list[dict[str, Any]]] = {}
_profiles: dict[str, dict[str, Any]] = {}
_chat_history: dict[str, list[dict[str, Any]]] = {}

# Registered users (demo in-memory; use PostgreSQL in production)
_users: dict[str, dict[str, Any]] = {}
_email_to_id: dict[str, str] = {}


def normalize_email(email: str) -> str:
    return email.strip().lower()


def create_registered_user(email: str, password_hash_b64: str, display_name: str) -> dict[str, Any]:
    em = normalize_email(email)
    if em in _email_to_id:
        raise ValueError("email_exists")
    uid = str(uuid.uuid4())
    rec: dict[str, Any] = {
        "id": uid,
        "email": em,
        "display_name": display_name.strip() or em.split("@")[0],
        "password_hash_b64": password_hash_b64,
        "auth_provider": "password",
    }
    _users[uid] = rec
    _email_to_id[em] = uid
    set_profile(uid, {"display_name": rec["display_name"]})
    return rec


def upsert_google_user(email: str, display_name: str) -> dict[str, Any]:
    """Create or return existing user for verified Google sign-in."""
    em = normalize_email(email)
    existing = get_user_by_email(em)
    if existing:
        if display_name and existing.get("display_name") in ("", em.split("@")[0]):
            existing["display_name"] = display_name.strip() or existing["display_name"]
            set_profile(existing["id"], {"display_name": existing["display_name"]})
        return existing
    uid = str(uuid.uuid4())
    dn = (display_name or "").strip() or em.split("@")[0]
    rec: dict[str, Any] = {
        "id": uid,
        "email": em,
        "display_name": dn,
        "password_hash_b64": "",
        "auth_provider": "google",
    }
    _users[uid] = rec
    _email_to_id[em] = uid
    set_profile(uid, {"display_name": dn})
    return rec


def get_user_by_email(email: str) -> dict[str, Any] | None:
    em = normalize_email(email)
    uid = _email_to_id.get(em)
    return _users.get(uid) if uid else None


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    return _users.get(user_id)


def user_public(rec: dict[str, Any]) -> dict[str, str]:
    return {
        "id": rec["id"],
        "email": rec["email"],
        "display_name": rec["display_name"],
        "auth_provider": rec.get("auth_provider", "password"),
    }


def get_memory(user_id: str) -> list[dict[str, Any]]:
    return _memory.setdefault(user_id, [])


def add_memory_fact(user_id: str, key: str, value: str) -> None:
    get_memory(user_id).append({"key": key, "value": value})


def get_profile(user_id: str) -> dict[str, Any]:
    return _profiles.setdefault(
        user_id,
        {
            "display_name": "User",
            "avatar_id": "neo-core",
            "premium": True,
        },
    )


def set_profile(user_id: str, data: dict[str, Any]) -> dict[str, Any]:
    p = get_profile(user_id)
    p.update({k: v for k, v in data.items() if v is not None})
    return p


def add_chat_turn(user_id: str, role: str, content: str, *, source: str = "chat") -> None:
    hist = _chat_history.setdefault(user_id, [])
    hist.append(
        {
            "role": role,
            "source": source,
            "content": str(content or ""),
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
    )
    # Keep bounded in-memory history
    if len(hist) > 500:
        del hist[: len(hist) - 500]


def get_recent_chat_history(user_id: str, limit: int = 24) -> list[dict[str, Any]]:
    hist = _chat_history.get(user_id, [])
    lim = max(1, min(int(limit), 80))
    return hist[-lim:]


def get_chat_history_for_memory(user_id: str, limit: int = 500) -> list[dict[str, Any]]:
    """
    Chat + Voice turns for Memory UI when MySQL is unavailable or has no rows yet.
    Uses the same in-memory buffer as /api/chat (lost on server restart).
    """
    hist = _chat_history.get(user_id, [])
    filtered = [
        h
        for h in hist
        if str(h.get("source") or "chat") in ("chat", "voice")
    ]
    lim = max(1, min(int(limit), 500))
    slice_hist = filtered[-lim:]
    out: list[dict[str, Any]] = []
    for i, row in enumerate(slice_hist):
        ts = row.get("created_at")
        if isinstance(ts, str):
            created = ts
        elif hasattr(ts, "isoformat"):
            created = ts.isoformat(timespec="seconds")
        else:
            created = str(ts or "")
        out.append(
            {
                "id": -(i + 1),
                "role": str(row.get("role") or "user"),
                "content": str(row.get("content") or ""),
                "source": str(row.get("source") or "chat"),
                "created_at": created,
            }
        )
    return out
