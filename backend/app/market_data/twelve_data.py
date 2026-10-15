from __future__ import annotations
import httpx
import logging
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from .base import BaseMarketDataProvider, Candle, Quote, ProviderHealth, Timeframe
from .validator import CandleValidator

logger = logging.getLogger(__name__)


class TwelveDataProvider(BaseMarketDataProvider):
    """
    Market data provider for Twelve Data REST API.
    Requires an API key (passed via settings or env).
    """

    BASE_URL = "https://api.twelvedata.com"

    TF_MAP = {
        Timeframe.M5: "5min",
        Timeframe.M15: "15min",
        Timeframe.M30: "30min",
        Timeframe.H1: "1h",
        Timeframe.H4: "4h",
        Timeframe.D1: "1day",
    }

    def __init__(self, api_key: str = ""):
        super().__init__(name="Twelve Data")
        self.api_key = api_key

    def normalize_symbol(self, standard_pair: str) -> str:
        # Twelve Data expects standard "EUR/USD" format
        clean = standard_pair.strip().upper()
        if "/" not in clean and len(clean) == 6:
            return f"{clean[:3]}/{clean[3:]}"
        return clean

    async def get_candles(self, symbol: str, timeframe: Timeframe, count: int = 200) -> List[Candle]:
        if not self.api_key:
            raise ValueError("Twelve Data API key is required but not configured.")

        norm_symbol = self.normalize_symbol(symbol)
        interval = self.TF_MAP.get(timeframe, "1h")

        url = f"{self.BASE_URL}/time_series"
        params = {
            "symbol": norm_symbol,
            "interval": interval,
            "outputsize": min(count + 10, 5000),
            "apikey": self.api_key,
            "format": "JSON",
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                raise RuntimeError(f"Twelve Data HTTP {resp.status_code}: {resp.text}")

            data = resp.json()
            if data.get("status") == "error":
                raise RuntimeError(f"Twelve Data API Error: {data.get('message')}")

            values = data.get("values", [])
            candles: List[Candle] = []
            for v in values:
                # Twelve Data returns timestamps in ascending or descending order
                dt = datetime.fromisoformat(v["datetime"]).replace(tzinfo=timezone.utc)
                candles.append(Candle(
                    timestamp=dt,
                    open=float(v["open"]),
                    high=float(v["high"]),
                    low=float(v["low"]),
                    close=float(v["close"]),
                    volume=float(v.get("volume", 0.0)),
                    is_closed=True
                ))

            # Sort ascending
            candles.sort(key=lambda c: c.timestamp)
            return CandleValidator.clean_and_validate_series(candles, min_required=10, filter_unclosed=False)

    async def get_quote(self, symbol: str) -> Optional[Quote]:
        if not self.api_key:
            return None

        norm_symbol = self.normalize_symbol(symbol)
        url = f"{self.BASE_URL}/quote"
        params = {"symbol": norm_symbol, "apikey": self.api_key}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, params=params)
                if resp.status_code != 200:
                    return None
                data = resp.json()
                price = float(data.get("close", 0.0))
                if price <= 0:
                    return None

                pip = 0.0001 if "JPY" not in symbol else 0.01
                spread = 1.5 * pip
                return Quote(
                    symbol=symbol,
                    bid=price - spread / 2.0,
                    ask=price + spread / 2.0,
                    mid=price,
                    spread=spread,
                    timestamp=datetime.now(timezone.utc)
                )
        except Exception as e:
            logger.error(f"Twelve Data quote error for {symbol}: {e}")
            return None

    async def check_health(self) -> ProviderHealth:
        start = time.perf_counter()
        if not self.api_key:
            return ProviderHealth(
                provider_name=self.name,
                is_healthy=False,
                latency_ms=0.0,
                last_updated=datetime.now(timezone.utc),
                error_message="API key not configured"
            )

        try:
            q = await self.get_quote("EUR/USD")
            latency = (time.perf_counter() - start) * 1000
            return ProviderHealth(
                provider_name=self.name,
                is_healthy=q is not None,
                latency_ms=latency,
                last_updated=datetime.now(timezone.utc),
                error_message=None if q else "No quote returned"
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
