from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt

from app.config import settings


def create_access_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(hours=settings.jwt_expire_hours)
    payload = {"sub": user_id, "email": email, "iat": now, "exp": exp}
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
