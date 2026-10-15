from __future__ import annotations
from fastapi import APIRouter, HTTPException, Query, Request
from typing import List, Dict, Any, Optional

from ..market_data.base import Timeframe
from ..engine.indicator import BreakoutProbabilityIndicator

router = APIRouter(prefix="/market", tags=["Market Data"])


@router.get("/candles/{pair:path}")
async def get_pair_candles(
    pair: str,
    request: Request,
    timeframe: str = Query("1h", description="5m, 15m, 30m, 1h, 4h, 1d"),
    count: int = Query(100, ge=10, le=500),
):
    scanner = request.app.state.scanner
    adapter = scanner.data_adapter

    try:
        tf = Timeframe.from_string(timeframe)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        candles = await adapter.get_candles(pair, tf, count=count)
        quote = await adapter.get_quote(pair)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch market data: {e}")

    if not candles:
        raise HTTPException(status_code=404, detail=f"No candle data available for {pair}")

    # Calculate indicator on available candles
    indicator = BreakoutProbabilityIndicator(lookback=min(len(candles) - 1, 200), percentage_step=0.002)
    ind_res = indicator.calculate(candles)

    return {
        "pair": pair,
        "timeframe": tf.value,
        "provider": adapter.get_active_provider().name,
        "quote": quote.to_dict() if quote else None,
        "candles": [c.to_dict() for c in candles],
        "indicator": ind_res.to_dict(),
    }
