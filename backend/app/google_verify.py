from __future__ import annotations

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.config import settings


def verify_google_id_token(token: str) -> dict:
    """Verify Google ID token; try each configured OAuth client ID as audience."""
    ids = [x.strip() for x in settings.google_client_ids.split(",") if x.strip()]
    if not ids:
        raise ValueError("no_google_client_ids")
    req = google_requests.Request()
    last: Exception | None = None
    for cid in ids:
        try:
            return google_id_token.verify_oauth2_token(token, req, cid)
        except Exception as e:
            last = e
            continue
    raise ValueError(str(last) if last else "invalid_token")
