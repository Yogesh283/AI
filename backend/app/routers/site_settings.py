from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.config import settings
from app.db_mysql import (
    get_subscription_plan_pricing_public,
    merge_subscription_plan_pricing,
    mysql_configured,
)

router_public = APIRouter(prefix="/api/public", tags=["public"])
router_admin = APIRouter(prefix="/api/admin", tags=["admin"])


class PlanPricingFields(BaseModel):
    """Numeric bounds shown on the marketing page (INR by default)."""

    title: str | None = Field(None, max_length=80)
    monthly_min: int | None = Field(None, ge=0, le=99_999_999)
    monthly_max: int | None = Field(None, ge=0, le=99_999_999)
    annual_min: int | None = Field(None, ge=0, le=99_999_999)
    annual_max: int | None = Field(None, ge=0, le=99_999_999)

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v: Any) -> str | None:
        if v is None or v == "":
            return None
        s = str(v).strip()
        return s[:80] if s else None


class AdminSubscriptionPlansBody(BaseModel):
    currency: str | None = Field(None, min_length=2, max_length=12)
    currency_symbol: str | None = Field(None, max_length=8)
    plans: dict[str, PlanPricingFields] | None = None


def _require_admin(x_admin_key: str | None) -> None:
    k = (settings.admin_api_key or "").strip()
    if not k:
        raise HTTPException(
            status_code=503,
            detail="Admin API is disabled. Set ADMIN_API_KEY in the backend environment.",
        )
    if (x_admin_key or "").strip() != k:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Admin-Key header")


@router_public.get("/subscription-plans")
async def get_subscription_plans_public() -> dict[str, Any]:
    """Public pricing JSON (defaults + MySQL `public_settings`)."""
    return await get_subscription_plan_pricing_public()


@router_admin.put("/subscription-plans")
async def put_subscription_plans_admin(
    body: AdminSubscriptionPlansBody,
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
) -> dict[str, Any]:
    """
    Update displayed subscription ranges. Send partial updates; values merge into existing JSON.

    Example:
    `curl -X PUT https://host/neo-api/api/admin/subscription-plans \\
      -H 'Content-Type: application/json' -H 'X-Admin-Key: YOUR_KEY' \\
      -d '{"plans":{"basic":{"monthly_min":350,"monthly_max":550}}}'`
    """
    _require_admin(x_admin_key)
    if not mysql_configured():
        raise HTTPException(status_code=503, detail="MySQL not configured")

    patch: dict[str, Any] = {}
    if body.currency is not None:
        patch["currency"] = body.currency.strip().upper()
    if body.currency_symbol is not None:
        patch["currency_symbol"] = body.currency_symbol.strip()
    if body.plans is not None:
        patch["plans"] = {}
        for key, plan in body.plans.items():
            pk = (key or "").strip().lower()
            if not pk:
                continue
            dumped = plan.model_dump(exclude_none=True)
            if not dumped:
                continue
            patch["plans"][pk] = dumped

    if not patch:
        raise HTTPException(status_code=400, detail="Empty body — send currency and/or plans")

    try:
        merged = await merge_subscription_plan_pricing(patch)
    except RuntimeError:
        raise HTTPException(status_code=503, detail="MySQL not available") from None
    return {"ok": True, "data": merged}
