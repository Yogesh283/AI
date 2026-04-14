from __future__ import annotations

from fastapi import APIRouter, Depends
from typing import Literal

from pydantic import BaseModel, Field

from app.db_mysql import insert_chat_messages, insert_usage_transaction, pool_ready
from app.routers.auth import optional_user
from app.services.ai import chat_completion
from app.store import add_memory_fact, get_memory, get_profile

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant|system)$")
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    user_id: str = "default"
    # Memory API lists only chat + voice; tools excluded.
    source: Literal["chat", "voice", "tools"] = "chat"


class ChatResponse(BaseModel):
    reply: str
    memory_snippets: list[str] = []


@router.post("", response_model=ChatResponse)
@router.post("/", response_model=ChatResponse)
async def post_chat(
    body: ChatRequest,
    user: dict | None = Depends(optional_user),
) -> ChatResponse:
    uid = str(user["id"]) if user else body.user_id
    profile = get_profile(uid)
    mem = get_memory(uid)
    system_extra = (
        f"User display name: {profile.get('display_name', 'User')}. "
        f"You are NeoXAI, a friendly bilingual (Hindi/English) AI companion. "
        f"Known preferences: {mem[-5:] if mem else 'none yet'}."
    )
    msgs: list[dict[str, str]] = [{"role": "system", "content": system_extra}]
    for m in body.messages:
        msgs.append({"role": m.role, "content": m.content})

    result = await chat_completion(msgs, user_id=uid)
    reply = result.text

    last_user = next((m.content for m in reversed(body.messages) if m.role == "user"), "")
    if "schedule" in last_user.lower() or "समय" in last_user:
        add_memory_fact(uid, "interest", "asks about schedule")

    if user and pool_ready() and last_user:
        await insert_chat_messages(uid, last_user, reply, source=body.source)
        await insert_usage_transaction(
            uid,
            "chat",
            metadata={"model": result.model, "endpoint": "chat/completions"},
            prompt_tokens=result.prompt_tokens,
            completion_tokens=result.completion_tokens,
            total_tokens=result.total_tokens,
        )

    snippets = [f"{x['key']}: {x['value']}" for x in mem[-3:]]
    return ChatResponse(reply=reply, memory_snippets=snippets)
