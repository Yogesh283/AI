from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

# Always load backend/.env even if uvicorn is started from repo root or another cwd
_BACKEND_DIR = Path(__file__).resolve().parent.parent

# Windows env can have OPENAI_API_KEY="" which overrides pydantic's .env — force file values
load_dotenv(_BACKEND_DIR / ".env", override=True)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        # Windows often has OPENAI_API_KEY="" in user env — ignore empty, use .env file
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
    # MySQL (XAMPP): leave host empty to disable DB persistence
    mysql_host: str = ""
    mysql_port: int = 3306
    mysql_user: str = "root"
    mysql_password: str = ""
    mysql_database: str = ""
    # Optional: Google Programmable Search (Custom Search JSON API) for live web context
    google_cse_api_key: str = ""
    google_cse_cx: str = ""


settings = Settings()
