from __future__ import annotations

import logging

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.ai import ImageGenerateResult, openai_image_generate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/images", tags=["images"])


class ImageGenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=2, max_length=4000)
    size: str | None = Field(
        default=None,
        description="Optional. e.g. 1024x1024, 1792x1024, 1024x1792 for dall-e-3",
    )


class ImageGenerateResponse(BaseModel):
    image_data_url: str | None = None
    image_url: str | None = None
    revised_prompt: str | None = None


def _result_to_response(res: ImageGenerateResult) -> ImageGenerateResponse:
    return ImageGenerateResponse(
        image_data_url=res.image_data_url,
        image_url=res.image_url,
        revised_prompt=res.revised_prompt,
    )


@router.post("/generate", response_model=ImageGenerateResponse)
async def post_generate_image(body: ImageGenerateRequest) -> ImageGenerateResponse:
    """
    Generate an image via OpenAI Images API (default `dall-e-3`).
    Returns either `image_data_url` (base64 data URL) or a short-lived `image_url` from OpenAI.
    """
    size = (body.size or "1024x1024").strip() or "1024x1024"
    try:
        res = await openai_image_generate(body.prompt.strip(), size=size)
        return _result_to_response(res)
    except ValueError as e:
        msg = str(e)
        if "not configured" in msg.lower() or "OPENAI_API_KEY" in msg:
            raise HTTPException(
                status_code=503,
                detail="Image generation is not configured. Set OPENAI_API_KEY on the server.",
            ) from e
        raise HTTPException(status_code=400, detail=msg) from e
    except httpx.HTTPStatusError as e:
        try:
            err = e.response.json().get("error", {})
            msg = err.get("message", e.response.text)
        except Exception:
            msg = e.response.text or str(e)
        logger.warning("OpenAI images HTTP %s: %s", e.response.status_code, msg)
        raise HTTPException(
            status_code=502,
            detail=f"OpenAI image error: {msg}",
        ) from e
    except httpx.RequestError as e:
        logger.warning("OpenAI images network: %s", e)
        raise HTTPException(
            status_code=503,
            detail=f"Could not reach OpenAI: {e}",
        ) from e
    except Exception as e:
        logger.exception("openai_image_generate failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
