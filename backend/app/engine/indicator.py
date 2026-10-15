from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import math
import logging

from ..market_data.base import Candle

logger = logging.getLogger(__name__)


@dataclass
class StepLevel:
    level: int
    price: float
    probability: float  # Percentage (0.0 to 100.0)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "level": self.level,
            "price": round(self.price, 5),
            "probability": round(self.probability, 2),
        }


@dataclass
class BreakoutProbabilityResult:
    # Core Directional Probabilities
    bullish_probability: float  # % chance of breaking above prior high
    bearish_probability: float  # % chance of breaking below prior low
    winning_direction: str      # "BULLISH" | "BEARISH" | "NEUTRAL"
    winning_probability: float  # Estimated probability of favored direction (indicator estimate)

    # Key Breakout Price Levels
    first_level_high: float     # Prior High breakout trigger
    first_level_low: float      # Prior Low breakout trigger
    current_price: float        # Price of last completed candle
    candle_timestamp: datetime  # Timestamp of evaluated completed candle

    # Additional Exponential / Percentage Step Levels
    upper_levels: List[StepLevel] = field(default_factory=list)
    lower_levels: List[StepLevel] = field(default_factory=list)

    # Conditioning & Sample Metadata
    prior_candle_direction: str = "BULLISH"  # "BULLISH" | "BEARISH" | "NEUTRAL"
    total_bars_sample: int = 0
    condition_matches_count: int = 0
    lookback_used: int = 0
    percentage_step_used: float = 0.002

    # Verification and Traceability
    methodology: str = "Breakout Probability (Expo) - Conditional Empirical Frequency (Zeiierman Published Model)"
    is_verified_methodology: bool = True
    disclaimer: str = (
        "Calculated using Zeiierman's published conditional transition probability methodology. "
        "Original Pine Script bytecode is closed/protected on TradingView. "
        "Probabilities represent empirical historical frequencies, not guaranteed future win rates."
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "bullish_probability": round(self.bullish_probability, 2),
            "bearish_probability": round(self.bearish_probability, 2),
            "winning_direction": self.winning_direction,
            "winning_probability": round(self.winning_probability, 2),
            "first_level_high": round(self.first_level_high, 5),
            "first_level_low": round(self.first_level_low, 5),
            "current_price": round(self.current_price, 5),
            "candle_timestamp": self.candle_timestamp.isoformat(),
            "upper_levels": [lvl.to_dict() for lvl in self.upper_levels],
            "lower_levels": [lvl.to_dict() for lvl in self.lower_levels],
            "prior_candle_direction": self.prior_candle_direction,
            "total_bars_sample": self.total_bars_sample,
            "condition_matches_count": self.condition_matches_count,
            "lookback_used": self.lookback_used,
            "percentage_step_used": self.percentage_step_used,
            "methodology": self.methodology,
            "is_verified_methodology": self.is_verified_methodology,
            "disclaimer": self.disclaimer,
        }


class BreakoutProbabilityIndicator:
    """
    Implementation of the Breakout Probability (Expo) Indicator by Zeiierman.

    Methodology:
    1. Analyzes the direction of the latest completed candle (green vs red).
       This completed candle forms the "prior" benchmark candle for the next bar.
    2. Filters historical candles over lookback period to find all bars where
       the preceding bar had the identical direction (conditional transition distribution).
    3. Calculates the empirical frequency of reaching:
       - A new high (High_t > High_{t-1})
       - A new low (Low_t < Low_{t-1})
       - Configurable tiered percentage step levels above and below.
    """

    def __init__(
        self,
        lookback: int = 200,
        percentage_step: float = 0.002,  # 0.2% default for forex (customizable)
        num_levels: int = 4,
        min_condition_samples: int = 15,
    ):
        self.lookback = lookback
        self.percentage_step = percentage_step
        self.num_levels = num_levels
        self.min_condition_samples = min_condition_samples

    def calculate(self, candles: List[Candle]) -> BreakoutProbabilityResult:
        """
        Calculates breakout probability on a series of historical candles.
        Assumes candles are sorted ascending in time and already validated.
        """
        if len(candles) < 2:
            raise ValueError(f"Need at least 2 candles for breakout calculation, got {len(candles)}")

        # Limit to lookback + 1
        effective_lookback = min(len(candles) - 1, self.lookback)
        sample = candles[-(effective_lookback + 1):]

        # The completed candle that serves as our benchmark is the last completed candle
        last_completed_candle = sample[-1]

        # Determine condition of the benchmark candle
        if last_completed_candle.close > last_completed_candle.open:
            prior_cond = "BULLISH"
        elif last_completed_candle.close < last_completed_candle.open:
            prior_cond = "BEARISH"
        else:
            prior_cond = "NEUTRAL"

        # Count occurrences in historical sample where preceding bar had matching condition
        matching_count = 0
        new_high_hits = 0
        new_low_hits = 0

        # Step level hits tracking
        upper_hits = [0] * self.num_levels
        lower_hits = [0] * self.num_levels

        # Iterate over historical transitions: bar i is preceded by bar i-1.
        # We look at all bars up to sample[-1] (where target is sample[i] and prior is sample[i-1]).
        for i in range(1, len(sample)):
            prior_bar = sample[i - 1]
            target_bar = sample[i]

            # Check condition of prior_bar
            if prior_bar.close > prior_bar.open:
                bar_cond = "BULLISH"
            elif prior_bar.close < prior_bar.open:
                bar_cond = "BEARISH"
            else:
                bar_cond = "NEUTRAL"

            # Filter for condition match
            if bar_cond != prior_cond:
                continue

            matching_count += 1

            # Base High/Low breakout check
            if target_bar.high > prior_bar.high:
                new_high_hits += 1
            if target_bar.low < prior_bar.low:
                new_low_hits += 1

            # Percentage step levels for historical bar
            for k in range(1, self.num_levels + 1):
                hist_up_level = prior_bar.high * (1.0 + k * self.percentage_step)
                hist_dn_level = prior_bar.low * (1.0 - k * self.percentage_step)

                if target_bar.high >= hist_up_level:
                    upper_hits[k - 1] += 1
                if target_bar.low <= hist_dn_level:
                    lower_hits[k - 1] += 1

        # If too few matching samples in history, return default 50/50
        if matching_count < self.min_condition_samples:
            logger.warning(
                f"Insufficient matching condition samples: {matching_count} < {self.min_condition_samples}"
            )
            bull_prob = 50.0
            bear_prob = 50.0
        else:
            bull_prob = (new_high_hits / matching_count) * 100.0
            bear_prob = (new_low_hits / matching_count) * 100.0

        # Determine winning direction and indicator estimated probability
        if bull_prob > bear_prob:
            win_dir = "BULLISH"
            win_prob = bull_prob
        elif bear_prob > bull_prob:
            win_dir = "BEARISH"
            win_prob = bear_prob
        else:
            win_dir = "NEUTRAL"
            win_prob = 50.0

        # Project levels for upcoming candle based on last completed candle's High & Low
        upper_levels: List[StepLevel] = []
        lower_levels: List[StepLevel] = []

        first_high = last_completed_candle.high
        first_low = last_completed_candle.low

        for k in range(1, self.num_levels + 1):
            up_price = first_high * (1.0 + k * self.percentage_step)
            dn_price = first_low * (1.0 - k * self.percentage_step)

            up_p = (upper_hits[k - 1] / matching_count * 100.0) if matching_count > 0 else 0.0
            dn_p = (lower_hits[k - 1] / matching_count * 100.0) if matching_count > 0 else 0.0

            upper_levels.append(StepLevel(level=k, price=up_price, probability=up_p))
            lower_levels.append(StepLevel(level=k, price=dn_price, probability=dn_p))

        return BreakoutProbabilityResult(
            bullish_probability=bull_prob,
            bearish_probability=bear_prob,
            winning_direction=win_dir,
            winning_probability=win_prob,
            first_level_high=first_high,
            first_level_low=first_low,
            current_price=last_completed_candle.close,
            candle_timestamp=last_completed_candle.timestamp,
            upper_levels=upper_levels,
            lower_levels=lower_levels,
            prior_candle_direction=prior_cond,
            total_bars_sample=len(sample),
            condition_matches_count=matching_count,
            lookback_used=effective_lookback,
            percentage_step_used=self.percentage_step,
        )
