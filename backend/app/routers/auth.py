from __future__ import annotations

import base64
from typing import Any

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from app.auth_jwt import create_access_token, decode_token
from app.config import settings
from app.db_mysql import (
    fetch_auth_user_by_email,
    fetch_auth_user_by_id,
    fetch_voice_persona_id,
    normalize_voice_persona_id,
    sync_user_record,
    update_user_display_name,
    update_user_password_hash,
    update_voice_persona_id,
)
from app.google_verify import verify_google_id_token
from app.store import (
    create_registered_user,
    get_user_by_email,
    get_user_by_id,
    set_profile,
    upsert_google_user,
    user_public,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    display_name: str = Field("", max_length=80)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict
    # True only from POST /google when this Google email was first seen (APK → onboarding).
    is_new_user: bool = False


class GoogleTokenBody(BaseModel):
    id_token: str = Field(..., min_length=20, description="Google ID token (JWT)")


class VoicePersonaBody(BaseModel):
    voice_persona_id: str = Field(..., min_length=1, max_length=32)


class PatchMeBody(BaseModel):
    display_name: str | None = Field(None, max_length=80)
    current_password: str | None = Field(None, max_length=128)
    new_password: str | None = Field(None, min_length=6, max_length=128)


async def _enrich_user(rec: dict[str, Any]) -> dict[str, Any]:
    pub = user_public(rec)
    pub["voice_persona_id"] = await fetch_voice_persona_id(str(rec["id"]))
    return pub


async def _resolve_user_by_email(email: str) -> dict[str, Any] | None:
    u = get_user_by_email(email)
    if u:
        return u
    return await fetch_auth_user_by_email(email)


async def _resolve_user_by_id(user_id: str) -> dict[str, Any] | None:
    u = get_user_by_id(user_id)
    if u:
        return u
    return await fetch_auth_user_by_id(user_id)


def _hash_password(password: str) -> str:
    raw = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return base64.b64encode(raw).decode("ascii")


def _verify_password(password: str, stored_b64: str) -> bool:
    try:
        raw = base64.b64decode(stored_b64.encode("ascii"))
        return bcrypt.checkpw(password.encode("utf-8"), raw)
    except (ValueError, OSError):
        return False


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterBody) -> TokenResponse:
    try:
        h = _hash_password(body.password)
        u = create_registered_user(body.email, h, body.display_name)
    except ValueError as e:
        if str(e) == "email_exists":
            raise HTTPException(status_code=400, detail="Email already registered") from e
        raise
    token = create_access_token(u["id"], u["email"])
    await sync_user_record(u)
    return TokenResponse(access_token=token, user=await _enrich_user(u))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginBody) -> TokenResponse:
    u = await _resolve_user_by_email(body.email)
    if not u:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not u.get("password_hash_b64"):
        raise HTTPException(
            status_code=400,
            detail="This account uses Google sign-in",
        )
    if not _verify_password(body.password, u["password_hash_b64"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(u["id"], u["email"])
    await sync_user_record(u)
    return TokenResponse(access_token=token, user=await _enrich_user(u))


@router.post("/google", response_model=TokenResponse)
async def google_auth(body: GoogleTokenBody) -> TokenResponse:
    if not settings.google_client_ids.strip():
        raise HTTPException(
            status_code=503,
            detail=(
                "Google sign-in is not configured on the server. "
                "Set GOOGLE_CLIENT_IDS (comma-separated) or GOOGLE_CLIENT_ID in backend/.env "
                "(same Web OAuth client ID as NEXT_PUBLIC_GOOGLE_CLIENT_ID), then: pm2 restart neo-api"
            ),
        )
    try:
        info = verify_google_id_token(body.id_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token") from None
    email = info.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Google token has no email")
    name = str(info.get("name") or email.split("@")[0])
    u, created = upsert_google_user(email, name)
    token = create_access_token(u["id"], u["email"])
    await sync_user_record(u)
    return TokenResponse(
        access_token=token,
        user=await _enrich_user(u),
        is_new_user=created,
    )


async def optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict[str, Any] | None:
    if not creds or creds.scheme.lower() != "bearer":
        return None
    payload = decode_token(creds.credentials)
    if not payload or not payload.get("sub"):
        return None
    u = await _resolve_user_by_id(str(payload["sub"]))
    return await _enrich_user(u) if u else None


async def require_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> dict[str, Any]:
    if not creds or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(creds.credentials)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Not authenticated")
    u = await _resolve_user_by_id(str(payload["sub"]))
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return await _enrich_user(u)


@router.get("/me")
async def me(user: dict[str, Any] | None = Depends(optional_user)) -> dict[str, Any]:
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {"user": user}


@router.patch("/me")
async def patch_me(
    body: PatchMeBody,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    uid = str(user["id"])
    u = await _resolve_user_by_id(uid)
    if not u:
        raise HTTPException(status_code=401, detail="Not authenticated")

    changed = False

    if body.new_password is not None:
        if not body.current_password:
            raise HTTPException(
                status_code=400,
                detail="current_password is required to change password",
            )
        if u.get("auth_provider") != "password" or not u.get("password_hash_b64"):
            raise HTTPException(
                status_code=400,
                detail="Password change is not available for this account",
            )
        if not _verify_password(body.current_password, u["password_hash_b64"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        u["password_hash_b64"] = _hash_password(body.new_password)
        await update_user_password_hash(uid, u["password_hash_b64"])
        changed = True

    if body.display_name is not None:
        raw = body.display_name.strip()
        if not raw:
            raise HTTPException(status_code=400, detail="display_name is required")
        dn = raw[:80]
        u["display_name"] = dn
        set_profile(uid, {"display_name": dn})
        await update_user_display_name(uid, dn)
        changed = True

    if changed:
        await sync_user_record(u)

    return {"user": await _enrich_user(u)}


@router.patch("/me/voice-persona")
async def patch_voice_persona(
    body: VoicePersonaBody,
    user: dict[str, Any] = Depends(require_user),
) -> dict[str, Any]:
    norm = normalize_voice_persona_id(body.voice_persona_id)
    if norm is None:
        raise HTTPException(status_code=400, detail="Invalid voice_persona_id")
    uid = str(user["id"])
    await update_voice_persona_id(uid, norm)
    return {"user": {**user, "voice_persona_id": norm}}
