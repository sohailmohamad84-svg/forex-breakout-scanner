from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json

from ..database import get_db
from ..models import SignalRecord
from ..schemas import SignalItem, StepLevelSchema

router = APIRouter(prefix="/signals", tags=["Signals"])


@router.get("", response_model=List[SignalItem])
def list_signals(
    direction: Optional[str] = Query(None, description="BUY or SELL"),
    timeframe: Optional[str] = Query(None, description="e.g. 1h, 4h, 1d"),
    pair: Optional[str] = Query(None, description="e.g. EUR/USD"),
    min_probability: Optional[float] = Query(None, ge=0.0, le=100.0),
    status: Optional[str] = Query("ACTIVE", description="ACTIVE, EXPIRED, ALL"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(SignalRecord)

    if direction:
        query = query.filter(SignalRecord.direction == direction.upper())
    if timeframe:
        query = query.filter(SignalRecord.timeframe == timeframe.lower())
    if pair:
        query = query.filter(SignalRecord.pair == pair.upper())
    if min_probability is not None:
        query = query.filter(SignalRecord.winning_probability >= min_probability)
    if status and status.upper() != "ALL":
        query = query.filter(SignalRecord.status == status.upper())

    records = query.order_by(SignalRecord.detected_at.desc()).offset(offset).limit(limit).all()

    return [
        SignalItem(
            id=r.id,
            pair=r.pair,
            direction=r.direction,
            timeframe=r.timeframe,
            bullish_probability=r.bullish_probability,
            bearish_probability=r.bearish_probability,
            winning_probability=r.winning_probability,
            threshold_used=r.threshold_used,
            signal_price=r.signal_price,
            breakout_level=r.breakout_level,
            candle_timestamp=r.candle_timestamp.isoformat(),
            detected_at=r.detected_at.isoformat(),
            qualification_reason=r.qualification_reason,
            status=r.status,
            data_provider=r.data_provider,
            strategy_version=r.strategy_version,
            upper_levels=[StepLevelSchema(**lvl) for lvl in json.loads(r.upper_levels_json or "[]")],
            lower_levels=[StepLevelSchema(**lvl) for lvl in json.loads(r.lower_levels_json or "[]")],
            subsequent_max_favorable=r.subsequent_max_favorable,
            subsequent_max_adverse=r.subsequent_max_adverse,
        )
        for r in records
    ]


@router.get("/{signal_id}", response_model=SignalItem)
def get_signal(signal_id: int, db: Session = Depends(get_db)):
    r = db.query(SignalRecord).filter(SignalRecord.id == signal_id).first()
    if not r:
        raise HTTPException(status_code=404, detail=f"Signal with ID {signal_id} not found")

    return SignalItem(
        id=r.id,
        pair=r.pair,
        direction=r.direction,
        timeframe=r.timeframe,
        bullish_probability=r.bullish_probability,
        bearish_probability=r.bearish_probability,
        winning_probability=r.winning_probability,
        threshold_used=r.threshold_used,
        signal_price=r.signal_price,
        breakout_level=r.breakout_level,
        candle_timestamp=r.candle_timestamp.isoformat(),
        detected_at=r.detected_at.isoformat(),
        qualification_reason=r.qualification_reason,
        status=r.status,
        data_provider=r.data_provider,
        strategy_version=r.strategy_version,
        upper_levels=[StepLevelSchema(**lvl) for lvl in json.loads(r.upper_levels_json or "[]")],
        lower_levels=[StepLevelSchema(**lvl) for lvl in json.loads(r.lower_levels_json or "[]")],
        subsequent_max_favorable=r.subsequent_max_favorable,
        subsequent_max_adverse=r.subsequent_max_adverse,
    )
