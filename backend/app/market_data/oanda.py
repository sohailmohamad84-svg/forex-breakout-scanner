from __future__ import annotations
import httpx
import logging
import time
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from .base import BaseMarketDataProvider, Candle, Quote, ProviderHealth, Timeframe
from .validator import CandleValidator

logger = logging.getLogger(__name__)


class OandaProvider(BaseMarketDataProvider):
    """
    Market data provider for OANDA v20 REST API.
    """

    PRACTICE_URL = "https://api-fxpractice.oanda.com/v3"
    LIVE_URL = "https://api-fxtrade.oanda.com/v3"

    TF_MAP = {
        Timeframe.M5: "M5",
        Timeframe.M15: "M15",
        Timeframe.M30: "M30",
        Timeframe.H1: "H1",
        Timeframe.H4: "H4",
        Timeframe.D1: "D",
    }

    def __init__(self, api_key: str = "", account_id: str = "", is_live: bool = False):
        super().__init__(name="OANDA")
        self.api_key = api_key
        self.account_id = account_id
        self.base_url = self.LIVE_URL if is_live else self.PRACTICE_URL

    def normalize_symbol(self, standard_pair: str) -> str:
        # OANDA expects "EUR_USD" format
        clean = standard_pair.replace("/", "_").replace("-", "_").strip().upper()
        if "_" not in clean and len(clean) == 6:
            return f"{clean[:3]}_{clean[3:]}"
        return clean

    async def get_candles(self, symbol: str, timeframe: Timeframe, count: int = 200) -> List[Candle]:
        if not self.api_key:
            raise ValueError("OANDA API key is not configured.")

        instrument = self.normalize_symbol(symbol)
        granularity = self.TF_MAP.get(timeframe, "H1")
        url = f"{self.base_url}/instruments/{instrument}/candles"

        headers = {"Authorization": f"Bearer {self.api_key}"}
        params = {
            "price": "M",  # Midpoint
            "granularity": granularity,
            "count": min(count, 500),
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers, params=params)
            if resp.status_code != 200:
                raise RuntimeError(f"OANDA HTTP {resp.status_code}: {resp.text}")

            data = resp.json()
            raw_candles = data.get("candles", [])
            candles: List[Candle] = []

            for c in raw_candles:
                # OANDA format: "2026-03-30T14:00:00.000000000Z"
                time_str = c["time"]
                # Clean fractional seconds if any
                ts = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
                mid = c["mid"]
                candles.append(Candle(
                    timestamp=ts,
                    open=float(mid["o"]),
                    high=float(mid["h"]),
                    low=float(mid["l"]),
                    close=float(mid["c"]),
                    volume=float(c.get("volume", 0.0)),
                    is_closed=bool(c.get("complete", True))
                ))

            candles.sort(key=lambda c: c.timestamp)
            return CandleValidator.clean_and_validate_series(candles, min_required=10, filter_unclosed=False)

    async def get_quote(self, symbol: str) -> Optional[Quote]:
        if not self.api_key or not self.account_id:
            return None

        instrument = self.normalize_symbol(symbol)
        url = f"{self.base_url}/accounts/{self.account_id}/pricing"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        params = {"instruments": instrument}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers, params=params)
                if resp.status_code != 200:
                    return None
                data = resp.json()
                prices = data.get("prices", [])
                if not prices:
                    return None

                p = prices[0]
                bid = float(p["bids"][0]["price"])
                ask = float(p["asks"][0]["price"])
                spread = ask - bid
                mid = (bid + ask) / 2.0

                return Quote(
                    symbol=symbol,
                    bid=bid,
                    ask=ask,
                    mid=mid,
                    spread=spread,
                    timestamp=datetime.now(timezone.utc)
                )
        except Exception as e:
            logger.error(f"OANDA quote error for {symbol}: {e}")
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
            candles = await self.get_candles("EUR/USD", Timeframe.H1, count=2)
            latency = (time.perf_counter() - start) * 1000
            return ProviderHealth(
                provider_name=self.name,
                is_healthy=len(candles) > 0,
                latency_ms=latency,
                last_updated=datetime.now(timezone.utc),
                error_message=None if len(candles) > 0 else "Empty candle data"
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
