from __future__ import annotations
import math
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from ..market_data.base import Candle, Timeframe
from ..engine.indicator import BreakoutProbabilityIndicator
from ..engine.decision import DecisionEngine, SignalDirection

logger = logging.getLogger(__name__)


@dataclass
class SimulatedTrade:
    entry_time: datetime
    exit_time: datetime
    direction: str  # "BUY" | "SELL"
    entry_price: float
    exit_price: float
    stop_loss: float
    take_profit: float
    pnl_pips: float
    pnl_percent: float
    is_win: bool
    exit_reason: str  # "TAKE_PROFIT" | "STOP_LOSS" | "MAX_HOLDING"
    duration_bars: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "entry_time": self.entry_time.isoformat(),
            "exit_time": self.exit_time.isoformat(),
            "direction": self.direction,
            "entry_price": round(self.entry_price, 5),
            "exit_price": round(self.exit_price, 5),
            "stop_loss": round(self.stop_loss, 5),
            "take_profit": round(self.take_profit, 5),
            "pnl_pips": round(self.pnl_pips, 1),
            "pnl_percent": round(self.pnl_percent, 2),
            "is_win": self.is_win,
            "exit_reason": self.exit_reason,
            "duration_bars": self.duration_bars,
        }


@dataclass
class BacktestSummary:
    pair: str
    timeframe: str
    start_date: datetime
    end_date: datetime
    total_candles_analyzed: int
    total_signals_generated: int
    total_trades_executed: int
    winning_trades: int
    losing_trades: int
    win_rate_percent: float
    profit_factor: float
    max_drawdown_percent: float
    expectancy_pips: float
    gross_pnl_pips: float
    net_pnl_pips: float
    average_trade_duration_bars: float
    trades: List[SimulatedTrade] = field(default_factory=list)
    equity_curve: List[Dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pair": self.pair,
            "timeframe": self.timeframe,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "total_candles_analyzed": self.total_candles_analyzed,
            "total_signals_generated": self.total_signals_generated,
            "total_trades_executed": self.total_trades_executed,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "win_rate_percent": round(self.win_rate_percent, 2),
            "profit_factor": round(self.profit_factor, 2),
            "max_drawdown_percent": round(self.max_drawdown_percent, 2),
            "expectancy_pips": round(self.expectancy_pips, 2),
            "gross_pnl_pips": round(self.gross_pnl_pips, 1),
            "net_pnl_pips": round(self.net_pnl_pips, 1),
            "average_trade_duration_bars": round(self.average_trade_duration_bars, 1),
            "trades": [t.to_dict() for t in self.trades],
            "equity_curve": self.equity_curve,
        }


class WalkForwardBacktester:
    """
    Simulates strategy execution without lookahead bias.
    Step-by-step:
    1. For each bar t (t >= lookback), compute Breakout Probability indicator on bars [0..t].
    2. If qualified BUY or SELL signal occurs at close of bar t, enter at Open of bar t+1.
    3. Apply spread and slippage transaction costs.
    4. Track high/low of subsequent bars to detect TP/SL exits.
    """

    def __init__(
        self,
        probability_threshold: float = 70.0,
        lookback_candles: int = 200,
        percentage_step: float = 0.002,
        risk_reward_ratio: float = 1.5,
        spread_pips: float = 1.5,
        slippage_pips: float = 0.5,
        max_holding_bars: int = 12,
    ):
        self.probability_threshold = probability_threshold
        self.lookback_candles = lookback_candles
        self.percentage_step = percentage_step
        self.risk_reward_ratio = risk_reward_ratio
        self.spread_pips = spread_pips
        self.slippage_pips = slippage_pips
        self.max_holding_bars = max_holding_bars

    def run(self, pair: str, timeframe: Timeframe, candles: List[Candle]) -> BacktestSummary:
        if len(candles) < self.lookback_candles + 20:
            raise ValueError(
                f"Insufficient historical candles for backtesting: {len(candles)} available, "
                f"need at least {self.lookback_candles + 20}"
            )

        indicator = BreakoutProbabilityIndicator(
            lookback=self.lookback_candles,
            percentage_step=self.percentage_step,
            num_levels=4,
            min_condition_samples=15
        )
        decision_engine = DecisionEngine(probability_threshold=self.probability_threshold)

        is_jpy = "JPY" in pair
        pip_unit = 0.01 if is_jpy else 0.0001
        transaction_cost = (self.spread_pips + self.slippage_pips) * pip_unit

        trades: List[SimulatedTrade] = []
        total_signals = 0
        in_trade = False
        trade_exit_bar = 0

        # Walk-forward loop through closed bars
        for t in range(self.lookback_candles, len(candles) - 1):
            if in_trade and t <= trade_exit_bar:
                continue
            in_trade = False

            # Strict slice up to bar t: only bars [0..t] are visible!
            eval_slice = candles[:t + 1]
            try:
                ind_res = indicator.calculate(eval_slice)
            except Exception as e:
                continue

            dec = decision_engine.evaluate(pair, timeframe, ind_res, current_time=eval_slice[-1].timestamp)
            if not dec.is_qualified or dec.direction not in [SignalDirection.BUY, SignalDirection.SELL]:
                continue

            total_signals += 1

            # Execution occurs on bar t+1
            entry_bar = candles[t + 1]
            entry_time = entry_bar.timestamp

            if dec.direction == SignalDirection.BUY:
                raw_entry = entry_bar.open
                entry_price = raw_entry + transaction_cost / 2.0
                # Stop loss at prior candle low
                sl_price = eval_slice[-1].low - transaction_cost / 2.0
                risk = max(entry_price - sl_price, 10.0 * pip_unit)
                tp_price = entry_price + risk * self.risk_reward_ratio

                # Walk forward through subsequent bars to simulate exit
                exit_price = entry_price
                exit_time = entry_time
                exit_reason = "MAX_HOLDING"
                bars_held = 0

                for f_idx in range(t + 1, min(t + 1 + self.max_holding_bars, len(candles))):
                    future_bar = candles[f_idx]
                    bars_held = f_idx - t
                    # Check SL hit first (conservative assumption)
                    if future_bar.low <= sl_price:
                        exit_price = sl_price
                        exit_time = future_bar.timestamp
                        exit_reason = "STOP_LOSS"
                        break
                    elif future_bar.high >= tp_price:
                        exit_price = tp_price
                        exit_time = future_bar.timestamp
                        exit_reason = "TAKE_PROFIT"
                        break
                else:
                    # Exited at close of last holding bar
                    last_held_bar = candles[min(t + self.max_holding_bars, len(candles) - 1)]
                    exit_price = last_held_bar.close
                    exit_time = last_held_bar.timestamp
                    exit_reason = "MAX_HOLDING"

                # Calculate PnL
                pnl_pips = (exit_price - entry_price) / pip_unit
                pnl_percent = ((exit_price - entry_price) / entry_price) * 100.0

            else:  # SELL
                raw_entry = entry_bar.open
                entry_price = raw_entry - transaction_cost / 2.0
                # Stop loss at prior candle high
                sl_price = eval_slice[-1].high + transaction_cost / 2.0
                risk = max(sl_price - entry_price, 10.0 * pip_unit)
                tp_price = entry_price - risk * self.risk_reward_ratio

                exit_price = entry_price
                exit_time = entry_time
                exit_reason = "MAX_HOLDING"
                bars_held = 0

                for f_idx in range(t + 1, min(t + 1 + self.max_holding_bars, len(candles))):
                    future_bar = candles[f_idx]
                    bars_held = f_idx - t
                    if future_bar.high >= sl_price:
                        exit_price = sl_price
                        exit_time = future_bar.timestamp
                        exit_reason = "STOP_LOSS"
                        break
                    elif future_bar.low <= tp_price:
                        exit_price = tp_price
                        exit_time = future_bar.timestamp
                        exit_reason = "TAKE_PROFIT"
                        break
                else:
                    last_held_bar = candles[min(t + self.max_holding_bars, len(candles) - 1)]
                    exit_price = last_held_bar.close
                    exit_time = last_held_bar.timestamp
                    exit_reason = "MAX_HOLDING"

                pnl_pips = (entry_price - exit_price) / pip_unit
                pnl_percent = ((entry_price - exit_price) / entry_price) * 100.0

            trades.append(SimulatedTrade(
                entry_time=entry_time,
                exit_time=exit_time,
                direction=dec.direction.value,
                entry_price=entry_price,
                exit_price=exit_price,
                stop_loss=sl_price,
                take_profit=tp_price,
                pnl_pips=pnl_pips,
                pnl_percent=pnl_percent,
                is_win=pnl_pips > 0,
                exit_reason=exit_reason,
                duration_bars=bars_held
            ))
            in_trade = True
            trade_exit_bar = t + bars_held

        # Compute summary metrics
        total_trades = len(trades)
        wins = [t for t in trades if t.is_win]
        losses = [t for t in trades if not t.is_win]

        win_rate = (len(wins) / total_trades * 100.0) if total_trades > 0 else 0.0
        gross_profit_pips = sum(t.pnl_pips for t in wins)
        gross_loss_pips = abs(sum(t.pnl_pips for t in losses))

        profit_factor = (gross_profit_pips / gross_loss_pips) if gross_loss_pips > 0 else (
            999.0 if gross_profit_pips > 0 else 1.0
        )
        net_pnl_pips = sum(t.pnl_pips for t in trades)
        gross_pnl_pips = net_pnl_pips + (total_trades * (self.spread_pips + self.slippage_pips))
        expectancy_pips = (net_pnl_pips / total_trades) if total_trades > 0 else 0.0

        # Equity curve & Max Drawdown
        equity = 10000.0  # $10k base account
        peak = equity
        max_dd = 0.0
        equity_curve: List[Dict[str, Any]] = [
            {"time": candles[self.lookback_candles].timestamp.isoformat(), "equity": equity, "pnl": 0.0}
        ]

        for trade in trades:
            # Assume 1 standard lot or $10 per pip on major
            trade_dollar_pnl = trade.pnl_pips * 10.0
            equity += trade_dollar_pnl
            if equity > peak:
                peak = equity
            dd = ((peak - equity) / peak * 100.0) if peak > 0 else 0.0
            if dd > max_dd:
                max_dd = dd
            equity_curve.append({
                "time": trade.exit_time.isoformat(),
                "equity": round(equity, 2),
                "pnl": round(trade_dollar_pnl, 2)
            })

        avg_bars = (sum(t.duration_bars for t in trades) / total_trades) if total_trades > 0 else 0.0

        return BacktestSummary(
            pair=pair,
            timeframe=timeframe.value,
            start_date=candles[0].timestamp,
            end_date=candles[-1].timestamp,
            total_candles_analyzed=len(candles),
            total_signals_generated=total_signals,
            total_trades_executed=total_trades,
            winning_trades=len(wins),
            losing_trades=len(losses),
            win_rate_percent=win_rate,
            profit_factor=profit_factor,
            max_drawdown_percent=max_dd,
            expectancy_pips=expectancy_pips,
            gross_pnl_pips=gross_pnl_pips,
            net_pnl_pips=net_pnl_pips,
            average_trade_duration_bars=avg_bars,
            trades=trades,
            equity_curve=equity_curve,
        )
