from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.config import settings
from app.db_mysql import close_pool, init_pool, mysql_configured, pool_ready
from app.routers import auth, chat, images, memory, site_settings, voice
from app.services.ai import _openai_api_key

logger = logging.getLogger(__name__)
_live_data_refresh_task: asyncio.Task[None] | None = None
_live_cron_startup_task: asyncio.Task[None] | None = None
_new_data_training_export_task: asyncio.Task[None] | None = None


async def _live_cron_startup_once() -> None:
    """First DB fill soon after boot so voice/chat see `new_data` without waiting 45 minutes."""
    from app.jobs.live_data_refresh import run_scheduled_live_data_refresh

    await asyncio.sleep(12)
    try:
        await run_scheduled_live_data_refresh()
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("startup live cron run failed")


async def _live_data_refresh_loop() -> None:
    """Every ~45m (configurable): SerpAPI/Bing → `live_data` upsert; `new_data` append only if content changed."""
    from app.jobs.live_data_refresh import run_scheduled_live_data_refresh

    interval = max(120, int(getattr(settings, "live_cache_cron_interval_seconds", 2700)))
    await asyncio.sleep(min(90, interval))
    while True:
        try:
            await run_scheduled_live_data_refresh()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("live_data scheduled refresh failed")
        await asyncio.sleep(interval)


async def _new_data_training_export_loop() -> None:
    """Every N seconds: append new MySQL `new_data` rows to JSONL training corpus."""
    from app.jobs.new_data_training_export import run_new_data_training_export_once

    out = (settings.new_data_training_export_path or "").strip()
    if not out:
        return
    interval = max(120, int(getattr(settings, "new_data_training_export_interval_seconds", 1800)))
    await asyncio.sleep(min(60, interval))
    while True:
        try:
            await run_new_data_training_export_once(batch_size=250)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("new_data training export loop failed")
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _live_data_refresh_task, _live_cron_startup_task, _new_data_training_export_task
    await init_pool()
    _live_cron_startup_task = asyncio.create_task(_live_cron_startup_once())
    _live_data_refresh_task = asyncio.create_task(_live_data_refresh_loop())
    _new_data_training_export_task = asyncio.create_task(_new_data_training_export_loop())
    yield
    if _live_cron_startup_task is not None:
        _live_cron_startup_task.cancel()
        try:
            await _live_cron_startup_task
        except asyncio.CancelledError:
            pass
        _live_cron_startup_task = None
    if _live_data_refresh_task is not None:
        _live_data_refresh_task.cancel()
        try:
            await _live_data_refresh_task
        except asyncio.CancelledError:
            pass
        _live_data_refresh_task = None
    if _new_data_training_export_task is not None:
        _new_data_training_export_task.cancel()
        try:
            await _new_data_training_export_task
        except asyncio.CancelledError:
            pass
        _new_data_training_export_task = None
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
app.include_router(site_settings.router_public)
app.include_router(site_settings.router_admin)
app.include_router(images.router)


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
