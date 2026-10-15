from __future__ import annotations
import asyncio
import logging
import time
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
import yfinance as yf
import pandas as pd

from .base import BaseMarketDataProvider, Candle, Quote, ProviderHealth, Timeframe
from .validator import CandleValidator

logger = logging.getLogger(__name__)


class YahooFinanceProvider(BaseMarketDataProvider):
    """
    Market data provider using Yahoo Finance (yfinance).
    Provides real-time and historical forex candle data without requiring API keys.
    """

    TIMEFRAME_MAP = {
        Timeframe.M5: "5m",
        Timeframe.M15: "15m",
        Timeframe.M30: "30m",
        Timeframe.H1: "60m",
        Timeframe.H4: "60m",  # Will resample to 4H
        Timeframe.D1: "1d",
    }

    PERIOD_MAP = {
        Timeframe.M5: "5d",
        Timeframe.M15: "14d",
        Timeframe.M30: "30d",
        Timeframe.H1: "60d",
        Timeframe.H4: "60d",
        Timeframe.D1: "1y",
    }

    def __init__(self):
        super().__init__(name="Yahoo Finance")

    def normalize_symbol(self, standard_pair: str) -> str:
        """
        Convert 'EUR/USD' -> 'EURUSD=X', 'USD/JPY' -> 'USDJPY=X'
        """
        clean = standard_pair.replace("/", "").replace("_", "").replace("-", "").strip().upper()
        if not clean.endswith("=X"):
            clean = f"{clean}=X"
        return clean

    def denormalize_symbol(self, provider_symbol: str) -> str:
        clean = provider_symbol.replace("=X", "")
        if len(clean) == 6:
            return f"{clean[:3]}/{clean[3:]}"
        return clean

    async def get_candles(self, symbol: str, timeframe: Timeframe, count: int = 200) -> List[Candle]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync_get_candles, symbol, timeframe, count)

    def _sync_get_candles(self, symbol: str, timeframe: Timeframe, count: int) -> List[Candle]:
        yf_symbol = self.normalize_symbol(symbol)
        interval = self.TIMEFRAME_MAP.get(timeframe, "60m")
        period = self.PERIOD_MAP.get(timeframe, "60d")

        try:
            ticker = yf.Ticker(yf_symbol)
            df = ticker.history(period=period, interval=interval, auto_adjust=False)
            if df.empty or len(df) == 0:
                logger.warning(f"Yahoo Finance returned empty dataframe for {yf_symbol} ({timeframe.value})")
                return []

            # If 4h requested, resample from 1h
            if timeframe == Timeframe.H4:
                df = df.resample('4h').agg({
                    'Open': 'first',
                    'High': 'max',
                    'Low': 'min',
                    'Close': 'last',
                    'Volume': 'sum'
                }).dropna()

            candles: List[Candle] = []
            now_utc = datetime.now(timezone.utc)

            # Determine timeframe duration for is_closed check
            tf_delta_map = {
                Timeframe.M5: timedelta(minutes=5),
                Timeframe.M15: timedelta(minutes=15),
                Timeframe.M30: timedelta(minutes=30),
                Timeframe.H1: timedelta(hours=1),
                Timeframe.H4: timedelta(hours=4),
                Timeframe.D1: timedelta(days=1),
            }
            tf_delta = tf_delta_map.get(timeframe, timedelta(hours=1))

            for idx, row in df.iterrows():
                ts = idx.to_pydatetime()
                if ts.tzinfo is None:
                    ts = ts.replace(tzinfo=timezone.utc)
                else:
                    ts = ts.astimezone(timezone.utc)

                is_closed = (now_utc - ts) >= tf_delta

                candles.append(Candle(
                    timestamp=ts,
                    open=float(row['Open']),
                    high=float(row['High']),
                    low=float(row['Low']),
                    close=float(row['Close']),
                    volume=float(row.get('Volume', 0.0)),
                    is_closed=is_closed
                ))

            # Validate and clean series
            if len(candles) > count:
                candles = candles[-count:]

            return CandleValidator.clean_and_validate_series(
                candles,
                min_required=10,  # relaxed for short fetches
                filter_unclosed=False  # caller decides if unclosed is needed
            )

        except Exception as e:
            logger.error(f"Error fetching candles from Yahoo Finance for {symbol}: {e}")
            raise

    async def get_quote(self, symbol: str) -> Optional[Quote]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync_get_quote, symbol)

    def _sync_get_quote(self, symbol: str) -> Optional[Quote]:
        yf_symbol = self.normalize_symbol(symbol)
        try:
            ticker = yf.Ticker(yf_symbol)
            # Try fast_info first
            price = None
            try:
                price = getattr(ticker.fast_info, 'last_price', None)
            except Exception:
                pass

            if price is None:
                df = ticker.history(period="1d", interval="1m")
                if not df.empty:
                    price = float(df['Close'].iloc[-1])

            if price is None or price <= 0:
                return None

            # Synthetic spread for Yahoo (typically 1.2 to 2.5 pips on majors)
            pip = 0.0001 if not ("JPY" in symbol) else 0.01
            spread_pips = 1.5
            half_spread = (spread_pips * pip) / 2.0
            bid = price - half_spread
            ask = price + half_spread

            return Quote(
                symbol=symbol,
                bid=bid,
                ask=ask,
                mid=price,
                spread=spread_pips * pip,
                timestamp=datetime.now(timezone.utc)
            )
        except Exception as e:
            logger.error(f"Error getting quote from Yahoo for {symbol}: {e}")
            return None

    async def check_health(self) -> ProviderHealth:
        start = time.perf_counter()
        try:
            quote = await self.get_quote("EUR/USD")
            latency = (time.perf_counter() - start) * 1000
            if quote:
                return ProviderHealth(
                    provider_name=self.name,
                    is_healthy=True,
                    latency_ms=latency,
                    last_updated=datetime.now(timezone.utc)
                )
            else:
                return ProviderHealth(
                    provider_name=self.name,
                    is_healthy=False,
                    latency_ms=latency,
                    last_updated=datetime.now(timezone.utc),
                    error_message="Received null quote response for EUR/USD"
                )
        except Exception as e:
            latency = (time.perf_counter() - start) * 1000
            return ProviderHealth(
                provider_name=self.name,
                is_healthy=False,
                latency_ms=latency,
                last_updated=datetime.now(timezone.utc),
                error_message=str(e)
            )
