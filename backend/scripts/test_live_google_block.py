"""One-off: test build_live_web_context_block (Google). Run from repo: python backend/scripts/test_live_google_block.py"""
from __future__ import annotations

import asyncio
import sys
from datetime import datetime
from pathlib import Path

# Add backend root to path when run as `python backend/scripts/...` from repo root
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


async def main() -> None:
    from zoneinfo import ZoneInfo

    from app.services.sports_feed import build_live_web_context_block

    ist = ZoneInfo("Asia/Kolkata")
    q = "IPL latest standings points table 2026"
    block = await build_live_web_context_block(q, now_ist=datetime.now(ist))
    print("query:", q)
    print("len:", len(block))
    print("---")
    print(block[:1200] if block else "(empty — set GOOGLE_CSE_* or check outbound HTTPS for News RSS)")


if __name__ == "__main__":
    asyncio.run(main())
