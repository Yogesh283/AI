from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.config import settings
from app.db_mysql import close_pool, init_pool, mysql_configured, pool_ready
from app.routers import auth, chat, memory, voice
from app.services.ai import _openai_api_key


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    yield
    await close_pool()


# redirect_slashes=False: behind nginx/Next, slash redirects can emit Location: http://127.0.0.1:8010/... and break browsers
app = FastAPI(
    title="NeoXAI API",
    version="0.1.0",
    lifespan=lifespan,
    redirect_slashes=False,
)

origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
# Next.js often uses 3001 if 3000 is busy — regex allows any localhost port for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # Dev: LAN IP se Next (e.g. phone) + localhost ports
    allow_origin_regex=(
        r"http://(localhost|127\.0\.0\.1)(:\d+)?|"
        r"http://192\.168\.\d{1,3}\.\d{1,3}(:\d+)?|"
        r"http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(memory.router)
app.include_router(voice.router)


@app.get("/")
async def root() -> RedirectResponse:
    """Bare http://127.0.0.1:8010/ opens Swagger; avoids empty 404 for browser bookmark."""
    return RedirectResponse(url="/docs", status_code=302)


@app.get("/health")
async def health(response: Response) -> dict:
    # Same key source as /api/chat (not only pydantic settings)
    k = _openai_api_key()
    response.headers["Cache-Control"] = "no-store, max-age=0"
    return {
        "status": "ok",
        "service": "neo-backend",
        "openai_configured": bool(k),
        "mysql_configured": mysql_configured(),
        "mysql_pool_ready": pool_ready(),
        "revision": 7,
        # Agar yeh field na dikhe → galat server / purana uvicorn (sirf status+service wala stub)
        "neo_api": "d-ai-backend-chatgpt-env-v6",
    }
