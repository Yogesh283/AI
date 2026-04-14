from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.db_mysql import fetch_chat_messages_for_user, pool_ready
from app.routers.auth import optional_user
from app.store import add_memory_fact, get_memory, get_profile, set_profile

router = APIRouter(prefix="/api/memory", tags=["memory"])


class MemoryItem(BaseModel):
    key: str
    value: str


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    avatar_id: str | None = None


@router.get("")
async def list_memory(
    user_id: str = "default",
    user: dict | None = Depends(optional_user),
) -> dict:
    uid = str(user["id"]) if user else user_id
    profile = get_profile(uid)
    facts = get_memory(uid)
    chat_messages: list[dict] = []
    if user and pool_ready():
        chat_messages = await fetch_chat_messages_for_user(uid)
    return {
        "user_id": uid,
        "profile": profile,
        "facts": facts,
        "chat_messages": chat_messages,
        "insights": [],
    }


@router.post("/fact")
async def add_fact(body: MemoryItem, user_id: str = "default") -> dict:
    add_memory_fact(user_id, body.key, body.value)
    return {"ok": True}


@router.patch("/profile")
async def patch_profile(body: ProfileUpdate, user_id: str = "default") -> dict:
    return set_profile(
        user_id,
        {
            "display_name": body.display_name,
            "avatar_id": body.avatar_id,
        },
    )
