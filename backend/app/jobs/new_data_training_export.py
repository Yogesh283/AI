"""Periodic exporter: MySQL `new_data` -> JSONL corpus for offline model training."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.config import settings
from app.db_mysql import new_data_list_since_id, pool_ready

logger = logging.getLogger(__name__)


def _export_path() -> Path | None:
    raw = (settings.new_data_training_export_path or "").strip()
    if not raw:
        return None
    return Path(raw).expanduser()


def _state_path(export_path: Path) -> Path:
    return export_path.with_suffix(export_path.suffix + ".state.json")


def _load_last_id(path: Path) -> int:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return max(0, int(data.get("last_exported_new_data_id") or 0))
    except Exception:
        return 0


def _save_last_id(path: Path, last_id: int) -> None:
    payload = {
        "last_exported_new_data_id": int(last_id),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _to_training_row(r: dict[str, Any]) -> dict[str, Any]:
    section = str(r.get("section") or "").strip()
    src = str(r.get("api_source") or "").strip() or "unknown"
    body = str(r.get("snippet_body") or "").strip()
    if len(body) > 6000:
        body = body[:6000].rstrip() + "\n...[truncated]"
    created = r.get("created_at")
    created_s = created.isoformat() if hasattr(created, "isoformat") else str(created or "")
    # Instruction-style row for later fine-tune/distillation pipelines.
    return {
        "t": datetime.now(timezone.utc).isoformat(),
        "kind": "new_data_snapshot",
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are a factual assistant. Use only provided live snapshot lines. "
                    "If a value is missing, say not confirmed."
                ),
            },
            {
                "role": "user",
                "content": f"Give latest verified update for: {section}",
            },
            {
                "role": "assistant",
                "content": body,
            },
        ],
        "meta": {
            "new_data_id": int(r.get("id") or 0),
            "section": section,
            "api_source": src,
            "snapshot_created_at": created_s,
        },
    }


async def run_new_data_training_export_once(*, batch_size: int = 250) -> int:
    """
    Append unseen `new_data` rows to JSONL and persist last exported id.
    Returns number of exported rows.
    """
    export_path = _export_path()
    if export_path is None:
        return 0
    if not pool_ready():
        logger.warning("new_data training export skipped: MySQL pool not ready")
        return 0
    state_path = _state_path(export_path)
    last_id = _load_last_id(state_path)
    rows = await new_data_list_since_id(after_id=last_id, limit=batch_size)
    if not rows:
        return 0

    export_path.parent.mkdir(parents=True, exist_ok=True)
    max_id = last_id
    written = 0
    with export_path.open("a", encoding="utf-8") as f:
        for r in rows:
            rid = int(r.get("id") or 0)
            if rid <= 0:
                continue
            row = _to_training_row(r)
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
            written += 1
            if rid > max_id:
                max_id = rid
    _save_last_id(state_path, max_id)
    logger.info(
        "new_data training export: appended=%s last_id=%s file=%s",
        written,
        max_id,
        export_path,
    )
    return written

