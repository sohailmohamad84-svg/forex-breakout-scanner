from __future__ import annotations
from enum import Enum
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from .indicator import BreakoutProbabilityResult
from ..market_data.base import Timeframe


class SignalDirection(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    CONFLICT = "CONFLICT"
    NO_SIGNAL = "NO_SIGNAL"
    INSUFFICIENT_DATA = "INSUFFICIENT_DATA"


@dataclass
class QualifiedSignalDecision:
    pair: str
    timeframe: Timeframe
    direction: SignalDirection
    is_qualified: bool  # True ONLY for BUY or SELL that passed threshold
    bullish_probability: float
    bearish_probability: float
    winning_probability: float
    threshold_used: float
    current_price: float
    breakout_level: float  # High level if BUY, Low level if SELL
    candle_timestamp: datetime
    signal_age_minutes: float
    is_stale: bool
    qualification_reason: str
    indicator_result: Optional[BreakoutProbabilityResult] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "pair": self.pair,
            "timeframe": self.timeframe.value,
            "direction": self.direction.value,
            "is_qualified": self.is_qualified,
            "bullish_probability": round(self.bullish_probability, 2),
            "bearish_probability": round(self.bearish_probability, 2),
            "winning_probability": round(self.winning_probability, 2),
            "threshold_used": round(self.threshold_used, 2),
            "current_price": round(self.current_price, 5),
            "breakout_level": round(self.breakout_level, 5),
            "candle_timestamp": self.candle_timestamp.isoformat(),
            "signal_age_minutes": round(self.signal_age_minutes, 1),
            "is_stale": self.is_stale,
            "qualification_reason": self.qualification_reason,
            "indicator_data": self.indicator_result.to_dict() if self.indicator_result else None,
        }


class DecisionEngine:
    """
    Evaluates indicator results against strategy qualification rules.
    Enforces probability thresholds, directional mutual exclusivity,
    candle completion requirements, and maximum signal age.
    """

    TF_MINUTES = {
        Timeframe.M5: 5,
        Timeframe.M15: 15,
        Timeframe.M30: 30,
        Timeframe.H1: 60,
        Timeframe.H4: 240,
        Timeframe.D1: 1440,
    }

    def __init__(
        self,
        probability_threshold: float = 70.0,
        max_signal_age_bars: int = 3,
        max_signal_age_minutes: Optional[int] = None,
    ):
        self.probability_threshold = probability_threshold
        self.max_signal_age_bars = max_signal_age_bars
        self.max_signal_age_minutes = max_signal_age_minutes

    def evaluate(
        self,
        pair: str,
        timeframe: Timeframe,
        indicator_result: Optional[BreakoutProbabilityResult],
        current_time: Optional[datetime] = None,
        min_condition_matches: int = 15,
    ) -> QualifiedSignalDecision:
        now = current_time or datetime.now(timezone.utc)

        if indicator_result is None:
            return QualifiedSignalDecision(
                pair=pair,
                timeframe=timeframe,
                direction=SignalDirection.INSUFFICIENT_DATA,
                is_qualified=False,
                bullish_probability=0.0,
                bearish_probability=0.0,
                winning_probability=0.0,
                threshold_used=self.probability_threshold,
                current_price=0.0,
                breakout_level=0.0,
                candle_timestamp=now,
                signal_age_minutes=0.0,
                is_stale=False,
                qualification_reason="No indicator result returned: market data unavailable or unvalidated.",
                indicator_result=None,
            )

        # Check sample size validity
        if indicator_result.condition_matches_count < min_condition_matches:
            return QualifiedSignalDecision(
                pair=pair,
                timeframe=timeframe,
                direction=SignalDirection.INSUFFICIENT_DATA,
                is_qualified=False,
                bullish_probability=indicator_result.bullish_probability,
                bearish_probability=indicator_result.bearish_probability,
                winning_probability=indicator_result.winning_probability,
                threshold_used=self.probability_threshold,
                current_price=indicator_result.current_price,
                breakout_level=0.0,
                candle_timestamp=indicator_result.candle_timestamp,
                signal_age_minutes=0.0,
                is_stale=False,
                qualification_reason=(
                    f"Insufficient historical sample: found {indicator_result.condition_matches_count} "
                    f"matching candles (minimum {min_condition_matches} required)."
                ),
                indicator_result=indicator_result,
            )

        # Calculate signal age
        candle_ts = indicator_result.candle_timestamp
        if candle_ts.tzinfo is None:
            candle_ts = candle_ts.replace(tzinfo=timezone.utc)
        age_seconds = max(0.0, (now - candle_ts).total_seconds())
        age_minutes = age_seconds / 60.0

        bar_minutes = self.TF_MINUTES.get(timeframe, 60)
        max_allowed_minutes = (
            self.max_signal_age_minutes
            if self.max_signal_age_minutes is not None
            else self.max_signal_age_bars * bar_minutes
        )
        is_stale = age_minutes > max_allowed_minutes

        bull_p = indicator_result.bullish_probability
        bear_p = indicator_result.bearish_probability
        thresh = self.probability_threshold

        bull_meets = bull_p >= thresh
        bear_meets = bear_p >= thresh

        # Directional rules
        if bull_meets and bear_meets:
            direction = SignalDirection.CONFLICT
            is_qualified = False
            breakout_level = indicator_result.first_level_high
            reason = (
                f"CONFLICT: Both Bullish ({bull_p:.1f}%) and Bearish ({bear_p:.1f}%) "
                f"probabilities meet or exceed threshold ({thresh:.1f}%)."
            )
        elif bull_meets and not bear_meets:
            direction = SignalDirection.BUY
            is_qualified = not is_stale
            breakout_level = indicator_result.first_level_high
            if is_stale:
                reason = (
                    f"BUY condition met (Bullish {bull_p:.1f}% >= {thresh:.1f}%), "
                    f"but signal is STALE (age {age_minutes:.1f}m > max {max_allowed_minutes}m)."
                )
            else:
                reason = (
                    f"BUY qualified: Bullish breakout probability {bull_p:.1f}% >= {thresh:.1f}% "
                    f"(Bearish {bear_p:.1f}% < {thresh:.1f}%). Trigger level: {breakout_level:.5f}."
                )
        elif bear_meets and not bull_meets:
            direction = SignalDirection.SELL
            is_qualified = not is_stale
            breakout_level = indicator_result.first_level_low
            if is_stale:
                reason = (
                    f"SELL condition met (Bearish {bear_p:.1f}% >= {thresh:.1f}%), "
                    f"but signal is STALE (age {age_minutes:.1f}m > max {max_allowed_minutes}m)."
                )
            else:
                reason = (
                    f"SELL qualified: Bearish breakout probability {bear_p:.1f}% >= {thresh:.1f}% "
                    f"(Bullish {bull_p:.1f}% < {thresh:.1f}%). Trigger level: {breakout_level:.5f}."
                )
        else:
            direction = SignalDirection.NO_SIGNAL
            is_qualified = False
            breakout_level = (
                indicator_result.first_level_high if bull_p >= bear_p else indicator_result.first_level_low
            )
            reason = (
                f"NO SIGNAL: Neither Bullish ({bull_p:.1f}%) nor Bearish ({bear_p:.1f}%) "
                f"reached the required threshold ({thresh:.1f}%)."
            )

        return QualifiedSignalDecision(
            pair=pair,
            timeframe=timeframe,
            direction=direction,
            is_qualified=is_qualified,
            bullish_probability=bull_p,
            bearish_probability=bear_p,
            winning_probability=indicator_result.winning_probability,
            threshold_used=thresh,
            current_price=indicator_result.current_price,
            breakout_level=breakout_level,
            candle_timestamp=candle_ts,
            signal_age_minutes=age_minutes,
            is_stale=is_stale,
            qualification_reason=reason,
            indicator_result=indicator_result,
        )
