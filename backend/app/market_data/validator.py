from __future__ import annotations
import logging
from typing import List, Tuple
from datetime import datetime, timezone
from .base import Candle, Timeframe

logger = logging.getLogger(__name__)


class CandleValidationError(Exception):
    pass


class CandleValidator:
    """
    Validates OHLC candle sequences for financial calculations.
    Checks:
    - Positive prices
    - High >= Low
    - High >= Open and High >= Close
    - Low <= Open and Low <= Close
    - Strictly monotonic timestamps (no backwards jumps)
    - Deduplicates duplicate timestamp candles (keeps latest valid)
    - Checks for minimum required history length
    """

    @staticmethod
    def validate_candle(c: Candle) -> Tuple[bool, str]:
        if c.open <= 0 or c.high <= 0 or c.low <= 0 or c.close <= 0:
            return False, f"Non-positive price in candle: O={c.open}, H={c.high}, L={c.low}, C={c.close}"

        if c.high < c.low:
            return False, f"High ({c.high}) is lower than Low ({c.low})"

        # Floating point tolerance check (1e-6)
        tol = 1e-6
        if c.high < c.open - tol:
            return False, f"High ({c.high}) is lower than Open ({c.open})"

        if c.high < c.close - tol:
            return False, f"High ({c.high}) is lower than Close ({c.close})"

        if c.low > c.open + tol:
            return False, f"Low ({c.low}) is higher than Open ({c.open})"

        if c.low > c.close + tol:
            return False, f"Low ({c.low}) is higher than Close ({c.close})"

        return True, ""

    @classmethod
    def clean_and_validate_series(
        cls,
        candles: List[Candle],
        min_required: int = 50,
        filter_unclosed: bool = True
    ) -> List[Candle]:
        """
        Validates, deduplicates, and sorts a list of candles.
        Optionally filters out the final candle if it is still open (uncompleted).
        """
        if not candles:
            raise CandleValidationError("Candle list is empty")

        valid_candles: List[Candle] = []
        for i, c in enumerate(candles):
            is_valid, reason = cls.validate_candle(c)
            if not is_valid:
                logger.warning(f"Discarding invalid candle at index {i}: {reason}")
                continue
            valid_candles.append(c)

        if not valid_candles:
            raise CandleValidationError("No valid candles remaining after validation checks")

        # Sort chronologically
        valid_candles.sort(key=lambda x: x.timestamp)

        # Deduplicate by timestamp (keep last seen)
        deduped: List[Candle] = []
        seen_timestamps = set()
        for c in reversed(valid_candles):
            if c.timestamp not in seen_timestamps:
                seen_timestamps.add(c.timestamp)
                deduped.append(c)
        deduped.reverse()

        # Check strictly monotonic timestamps
        for i in range(1, len(deduped)):
            if deduped[i].timestamp <= deduped[i-1].timestamp:
                raise CandleValidationError(
                    f"Non-monotonic timestamps detected: {deduped[i-1].timestamp} -> {deduped[i].timestamp}"
                )

        # Filter out trailing uncompleted candle if requested
        if filter_unclosed and deduped and not deduped[-1].is_closed:
            logger.debug(f"Filtering out active unclosed candle at {deduped[-1].timestamp}")
            deduped = deduped[:-1]

        if len(deduped) < min_required:
            raise CandleValidationError(
                f"Insufficient historical candles: {len(deduped)} available, minimum {min_required} required"
            )

        return deduped
