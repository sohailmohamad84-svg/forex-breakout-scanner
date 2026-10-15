from __future__ import annotations
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import List

from ..database import get_db
from ..models import BacktestRecord
from ..schemas import BacktestRunRequest, BacktestResponse, BacktestTradeItem
from ..market_data.base import Timeframe
from ..backtesting.engine import WalkForwardBacktester

router = APIRouter(prefix="/backtest", tags=["Backtesting"])


@router.post("/run", response_model=BacktestResponse)
async def run_backtest(req: BacktestRunRequest, request: Request, db: Session = Depends(get_db)):
    scanner = request.app.state.scanner
    adapter = scanner.data_adapter

    tf = Timeframe.from_string(req.timeframe)
    # Fetch candles for backtest (up to 500 bars)
    try:
        candles = await adapter.get_candles(req.pair, tf, count=min(req.lookback_candles + 250, 600))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch historical market data for {req.pair}: {e}")

    if len(candles) < req.lookback_candles + 10:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient candles returned ({len(candles)}) for lookback requirement ({req.lookback_candles})"
        )

    tester = WalkForwardBacktester(
        probability_threshold=req.probability_threshold,
        lookback_candles=req.lookback_candles,
        percentage_step=req.percentage_step,
        risk_reward_ratio=req.risk_reward_ratio,
        spread_pips=req.spread_pips,
        slippage_pips=req.slippage_pips,
        max_holding_bars=req.max_holding_bars,
    )

    summary = tester.run(req.pair, tf, candles)

    # Persist backtest record
    rec = BacktestRecord(
        pair=req.pair,
        timeframe=req.timeframe,
        start_date=summary.start_date,
        end_date=summary.end_date,
        total_trades=summary.total_trades_executed,
        winning_trades=summary.winning_trades,
        win_rate=summary.win_rate_percent,
        profit_factor=summary.profit_factor,
        max_drawdown=summary.max_drawdown_percent,
        expectancy=summary.expectancy_pips,
        gross_pnl=summary.gross_pnl_pips,
        net_pnl=summary.net_pnl_pips,
        parameters_json=json.dumps(req.model_dump()),
    )
    db.add(rec)
    db.commit()

    return BacktestResponse(
        pair=summary.pair,
        timeframe=summary.timeframe,
        start_date=summary.start_date.isoformat(),
        end_date=summary.end_date.isoformat(),
        total_candles_analyzed=summary.total_candles_analyzed,
        total_signals_generated=summary.total_signals_generated,
        total_trades_executed=summary.total_trades_executed,
        winning_trades=summary.winning_trades,
        losing_trades=summary.losing_trades,
        win_rate_percent=summary.win_rate_percent,
        profit_factor=summary.profit_factor,
        max_drawdown_percent=summary.max_drawdown_percent,
        expectancy_pips=summary.expectancy_pips,
        gross_pnl_pips=summary.gross_pnl_pips,
        net_pnl_pips=summary.net_pnl_pips,
        average_trade_duration_bars=summary.average_trade_duration_bars,
        trades=[BacktestTradeItem(**t.to_dict()) for t in summary.trades],
        equity_curve=summary.equity_curve,
    )


@router.get("/results")
def list_backtests(limit: int = 20, db: Session = Depends(get_db)):
    records = db.query(BacktestRecord).order_by(BacktestRecord.created_at.desc()).limit(limit).all()
    return [r.to_dict() for r in records]
