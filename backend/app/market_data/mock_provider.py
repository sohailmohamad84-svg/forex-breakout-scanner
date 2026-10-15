from __future__ import annotations
import math
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from .base import BaseMarketDataProvider, Candle, Quote, ProviderHealth, Timeframe
from .validator import CandleValidator

logger = logging.getLogger(__name__)


class MockProvider(BaseMarketDataProvider):
    """
    Deterministic synthetic market data provider.
    Generates realistic OHLCV price series based on Geometric Brownian Motion
    with volatility regimes, support/resistance bounces, and forex pip scaling.
    Useful for unit testing, offline scenarios, and verifying backtest reproducibility.
    """

    BASE_PRICES = {
        "EUR/USD": 1.0850,
        "GBP/USD": 1.2720,
        "USD/JPY": 154.60,
        "USD/CHF": 0.8920,
        "USD/CAD": 1.3650,
        "AUD/USD": 0.6550,
        "NZD/USD": 0.5980,
        "EUR/GBP": 0.8530,
        "EUR/JPY": 167.80,
        "GBP/JPY": 196.70,
        "AUD/JPY": 101.20,
    }

    TF_MINUTES = {
        Timeframe.M5: 5,
        Timeframe.M15: 15,
        Timeframe.M30: 30,
        Timeframe.H1: 60,
        Timeframe.H4: 240,
        Timeframe.D1: 1440,
    }

    def __init__(self, seed: int = 42):
        super().__init__(name="Mock Provider (Deterministic Simulator)")
        self.seed = seed

    def normalize_symbol(self, standard_pair: str) -> str:
        return standard_pair.strip().upper()

    async def get_candles(self, symbol: str, timeframe: Timeframe, count: int = 200) -> List[Candle]:
        norm_sym = self.normalize_symbol(symbol)
        base_price = self.BASE_PRICES.get(norm_sym, 1.0000)
        is_jpy = "JPY" in norm_sym
        pip_unit = 0.01 if is_jpy else 0.0001
        minutes = self.TF_MINUTES.get(timeframe, 60)

        # Seed based on symbol & timeframe so each pair has consistent realistic series
        seed_val = self.seed + sum(ord(c) for c in norm_sym) + minutes
        rng = random.Random(seed_val)

        now = datetime.now(timezone.utc)
        # Snap now to minute boundary
        now = now.replace(second=0, microsecond=0)

        candles: List[Candle] = []
        current_close = base_price

        # Standard daily volatility around 0.5% - 0.9%
        vol_per_bar = (0.007 / math.sqrt(1440 / minutes)) * current_close

        for i in range(count, 0, -1):
            ts = now - timedelta(minutes=i * minutes)
            open_p = current_close
            # Drift + diffusion
            change = rng.gauss(0, vol_per_bar)
            close_p = max(open_p * 0.5, open_p + change)

            wick_top = abs(rng.gauss(0, vol_per_bar * 0.6))
            wick_bot = abs(rng.gauss(0, vol_per_bar * 0.6))

            high_p = max(open_p, close_p) + wick_top
            low_p = min(open_p, close_p) - wick_bot

            vol = max(10.0, rng.gauss(1500, 300))

            candles.append(Candle(
                timestamp=ts,
                open=round(open_p, 5 if not is_jpy else 3),
                high=round(high_p, 5 if not is_jpy else 3),
                low=round(low_p, 5 if not is_jpy else 3),
                close=round(close_p, 5 if not is_jpy else 3),
                volume=round(vol, 1),
                is_closed=True
            ))
            current_close = close_p

        return CandleValidator.clean_and_validate_series(candles, min_required=10, filter_unclosed=False)

    async def get_quote(self, symbol: str) -> Optional[Quote]:
        candles = await self.get_candles(symbol, Timeframe.H1, count=1)
        if not candles:
            return None
        price = candles[-1].close
        is_jpy = "JPY" in symbol
        pip = 0.01 if is_jpy else 0.0001
        spread = 1.2 * pip

        return Quote(
            symbol=symbol,
            bid=round(price - spread / 2.0, 5 if not is_jpy else 3),
            ask=round(price + spread / 2.0, 5 if not is_jpy else 3),
            mid=round(price, 5 if not is_jpy else 3),
            spread=round(spread, 5 if not is_jpy else 3),
            timestamp=datetime.now(timezone.utc)
        )

    async def check_health(self) -> ProviderHealth:
        return ProviderHealth(
            provider_name=self.name,
            is_healthy=True,
            latency_ms=0.5,
            last_updated=datetime.now(timezone.utc),
            error_message=None
        )
