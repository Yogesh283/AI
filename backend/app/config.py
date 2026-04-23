from pathlib import Path

from dotenv import load_dotenv
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Always load backend/.env even if uvicorn is started from repo root or another cwd
_BACKEND_DIR = Path(__file__).resolve().parent.parent

# Windows env can have OPENAI_API_KEY="" which overrides pydantic's .env â€” force file values
load_dotenv(_BACKEND_DIR / ".env", override=True)


def _last_nonempty_google_client_ids_from_env_file() -> str:
    """
    Duplicate `GOOGLE_CLIENT_IDS=` lines (especially an empty one in the middle) can make
    pydantic/dotenv resolve to ''. Scan the file and use the last non-empty assignment.
    """
    path = _BACKEND_DIR / ".env"
    if not path.is_file():
        return ""
    last = ""
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if not line.upper().startswith("GOOGLE_CLIENT_IDS="):
            continue
        val = line.split("=", 1)[1].strip().strip('"').strip("'")
        if val:
            last = val
    return last


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        # Windows often has OPENAI_API_KEY="" in user env â€” ignore empty, use .env file
        env_ignore_empty=True,
    )

    openai_api_key: str = ""
    cors_origins: str = (
        "http://localhost:3000,http://127.0.0.1:3000,"
        "http://localhost:3001,http://127.0.0.1:3001,"
        "http://localhost:8081"
    )
    jwt_secret: str = "neo-dev-secret-change-me"
    jwt_expire_hours: int = 168
    # Comma-separated OAuth 2.0 Client IDs (Web, Android, iOS) from Google Cloud Console
    google_client_ids: str = ""
    # Single Web client ID (optional). Used if GOOGLE_CLIENT_IDS is empty â€” easier for small deploys.
    google_client_id: str = ""
    # MySQL (XAMPP): leave host empty to disable DB persistence
    mysql_host: str = ""
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = ""
    mysql_database: str = ""
    # Optional: Google Programmable Search (Custom Search JSON API) for live web context
    google_cse_api_key: str = ""
    google_cse_cx: str = ""
    # Optional: Brave Web Search API (https://api.search.brave.com) - works when Google CSE JSON is unavailable
    brave_search_api_key: str = ""
    # Optional: SerpAPI (Google/Bing wrappers) for live web snippets
    serpapi_api_key: str = ""
    # SerpAPI Google engine localization (optional). Example India + Hindi UI:
    # SERPAPI_LOCATION=India SERPAPI_GOOGLE_DOMAIN=google.co.in SERPAPI_HL=hi SERPAPI_GL=in
    serpapi_location: str = ""
    serpapi_google_domain: str = ""
    serpapi_hl: str = "en"
    serpapi_gl: str = "in"
    # Optional: Azure Bing Web Search v7 — cached in MySQL `live_data` (see live_data_cache + cron)
    bing_search_api_key: str = ""
    bing_search_endpoint: str = ""
    live_cache_ttl_minutes: int = 45
    live_cache_cron_interval_seconds: int = 2700
    # Comma-separated topics polled every cron tick → `live_data` + `new_data` (append only if content changed).
    # Prefer LIVE_CRON_QUERIES; if empty, BING_CRON_QUERIES is used (backward compatible).
    live_cron_queries: str = ""
    bing_cron_queries: str = ""

    @model_validator(mode="after")
    def _merge_google_client_id(self):
        ids = (self.google_client_ids or "").strip()
        single = (self.google_client_id or "").strip()
        if not ids:
            from_file = _last_nonempty_google_client_ids_from_env_file()
            if from_file:
                object.__setattr__(self, "google_client_ids", from_file)
            elif single:
                object.__setattr__(self, "google_client_ids", single)
        return self


settings = Settings()

