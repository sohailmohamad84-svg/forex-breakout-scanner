from __future__ import annotations
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone

from ..database import get_db
from ..models import SignalRecord, CurrencyPair
from ..config import settings

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("")
async def get_health(db: Session = Depends(get_db)):
    # Check DB
    db_ok = True
    try:
        db.query(CurrencyPair).first()
    except Exception:
        db_ok = False

    return {
        "status": "online" if db_ok else "degraded",
        "app_name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database_connected": db_ok,
    }
