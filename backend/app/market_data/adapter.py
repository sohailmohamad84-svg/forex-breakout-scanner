from __future__ import annotations
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple, Any

from .base import BaseMarketDataProvider, Candle, Quote, ProviderHealth, Timeframe
from .yahoo import YahooFinanceProvider
from .twelve_data import TwelveDataProvider
from .oanda import OandaProvider
from .mock_provider import MockProvider

logger = logging.getLogger(__name__)


# Standard forex universes
DEFAULT_MAJOR_PAIRS = [
    "EUR/USD",
    "GBP/USD",
    "USD/JPY",
    "USD/CHF",
    "USD/CAD",
    "AUD/USD",
    "NZD/USD",
]

DEFAULT_CROSS_PAIRS = [
    "EUR/GBP",
    "EUR/JPY",
    "EUR/CHF",
    "EUR/CAD",
    "EUR/AUD",
    "EUR/NZD",
    "GBP/JPY",
    "GBP/CHF",
    "GBP/CAD",
    "GBP/AUD",
    "GBP/NZD",
    "AUD/JPY",
    "AUD/CAD",
    "AUD/CHF",
    "AUD/NZD",
    "CAD/JPY",
    "CAD/CHF",
    "NZD/JPY",
    "NZD/CAD",
    "NZD/CHF",
    "AUD/NOK",
    "USD/SGD",
]

ALL_DEFAULT_PAIRS = DEFAULT_MAJOR_PAIRS + DEFAULT_CROSS_PAIRS


class MarketDataAdapter:
    """
    Central provider-agnostic market data adapter with caching,
    incremental candle updates, rate limiting, and fallback handling.
    """

    def __init__(
        self,
        provider_name: str = "yahoo",
        twelve_data_key: str = "",
        oanda_key: str = "",
        oanda_account: str = "",
        oanda_is_live: bool = False,
        cache_ttl_seconds: int = 45,
    ):
        self.provider_name = provider_name.lower()
        self.cache_ttl_seconds = cache_ttl_seconds

        # Initialize providers
        self.providers: Dict[str, BaseMarketDataProvider] = {
            "yahoo": YahooFinanceProvider(),
            "twelve_data": TwelveDataProvider(api_key=twelve_data_key),
            "oanda": OandaProvider(api_key=oanda_key, account_id=oanda_account, is_live=oanda_is_live),
            "mock": MockProvider(),
        }

        # Cache: key = (symbol, timeframe) -> (cached_at_datetime, candles)
        self._candle_cache: Dict[Tuple[str, str], Tuple[datetime, List[Candle]]] = {}
        # Quote cache: key = symbol -> (cached_at_datetime, quote)
        self._quote_cache: Dict[str, Tuple[datetime, Quote]] = {}
        self._lock = asyncio.Lock()

    def set_provider(self, provider_name: str, **kwargs):
        name = provider_name.lower()
        if name not in self.providers:
            raise ValueError(f"Unknown provider '{provider_name}'. Available: {list(self.providers.keys())}")
        self.provider_name = name

        # Update provider credentials if provided
        if name == "twelve_data" and "api_key" in kwargs:
            self.providers["twelve_data"] = TwelveDataProvider(api_key=kwargs["api_key"])
        elif name == "oanda":
            self.providers["oanda"] = OandaProvider(
                api_key=kwargs.get("api_key", ""),
                account_id=kwargs.get("account_id", ""),
                is_live=kwargs.get("is_live", False)
            )

        # Clear cache when provider changes
        self._candle_cache.clear()
        self._quote_cache.clear()
        logger.info(f"Switched market data provider to: {name}")

    def get_active_provider(self) -> BaseMarketDataProvider:
        return self.providers.get(self.provider_name, self.providers["yahoo"])

    async def get_candles(
        self,
        symbol: str,
        timeframe: Timeframe,
        count: int = 200,
        force_refresh: bool = False
    ) -> List[Candle]:
        cache_key = (symbol, timeframe.value)
        now = datetime.now(timezone.utc)

        async with self._lock:
            if not force_refresh and cache_key in self._candle_cache:
                cached_at, cached_candles = self._candle_cache[cache_key]
                if (now - cached_at).total_seconds() < self.cache_ttl_seconds:
                    return cached_candles

        provider = self.get_active_provider()
        try:
            candles = await provider.get_candles(symbol, timeframe, count=count)
            async with self._lock:
                self._candle_cache[cache_key] = (now, candles)
            return candles
        except Exception as e:
            logger.error(f"Failed to fetch candles for {symbol} ({timeframe.value}) via {provider.name}: {e}")
            # If current provider fails and is not mock, try fallback to yahoo or mock
            if self.provider_name != "mock":
                logger.warning(f"Attempting fallback to Mock provider for {symbol}")
                candles = await self.providers["mock"].get_candles(symbol, timeframe, count=count)
                async with self._lock:
                    self._candle_cache[cache_key] = (now, candles)
                return candles
            raise

    async def get_quote(self, symbol: str, force_refresh: bool = False) -> Optional[Quote]:
        now = datetime.now(timezone.utc)
        async with self._lock:
            if not force_refresh and symbol in self._quote_cache:
                cached_at, cached_q = self._quote_cache[symbol]
                if (now - cached_at).total_seconds() < 10:  # 10s quote cache
                    return cached_q

        provider = self.get_active_provider()
        try:
            quote = await provider.get_quote(symbol)
            if quote:
                async with self._lock:
                    self._quote_cache[symbol] = (now, quote)
            return quote
        except Exception as e:
            logger.error(f"Failed to fetch quote for {symbol} via {provider.name}: {e}")
            return await self.providers["mock"].get_quote(symbol)

    async def check_health(self) -> ProviderHealth:
        provider = self.get_active_provider()
        return await provider.check_health()
