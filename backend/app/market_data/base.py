from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional, Dict, Any
from abc import ABC, abstractmethod


class Timeframe(str, Enum):
    M5 = "5m"
    M15 = "15m"
    M30 = "30m"
    H1 = "1h"
    H4 = "4h"
    D1 = "1d"

    @classmethod
    def from_string(cls, val: str) -> Timeframe:
        clean = val.lower().strip()
        mapping = {
            "5m": cls.M5, "5min": cls.M5, "m5": cls.M5,
            "15m": cls.M15, "15min": cls.M15, "m15": cls.M15,
            "30m": cls.M30, "30min": cls.M30, "m30": cls.M30,
            "1h": cls.H1, "60m": cls.H1, "h1": cls.H1,
            "4h": cls.H4, "240m": cls.H4, "h4": cls.H4,
            "1d": cls.D1, "d": cls.D1, "d1": cls.D1, "daily": cls.D1,
        }
        if clean in mapping:
            return mapping[clean]
        raise ValueError(f"Unsupported timeframe: {val}")


@dataclass
class Candle:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float = 0.0
    is_closed: bool = True

    def __post_init__(self):
        # Ensure timestamp is UTC-aware
        if self.timestamp.tzinfo is None:
            self.timestamp = self.timestamp.replace(tzinfo=timezone.utc)
        else:
            self.timestamp = self.timestamp.astimezone(timezone.utc)

    @property
    def is_green(self) -> bool:
        return self.close > self.open

    @property
    def is_red(self) -> bool:
        return self.close < self.open

    @property
    def is_doji(self) -> bool:
        return self.close == self.open

    @property
    def body_size(self) -> float:
        return abs(self.close - self.open)

    @property
    def range_size(self) -> float:
        return self.high - self.low

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "open": round(self.open, 5),
            "high": round(self.high, 5),
            "low": round(self.low, 5),
            "close": round(self.close, 5),
            "volume": self.volume,
            "is_closed": self.is_closed,
        }


@dataclass
class Quote:
    symbol: str
    bid: float
    ask: float
    mid: float
    spread: float
    timestamp: datetime

    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "bid": round(self.bid, 5),
            "ask": round(self.ask, 5),
            "mid": round(self.mid, 5),
            "spread": round(self.spread, 5),
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class ProviderHealth:
    provider_name: str
    is_healthy: bool
    latency_ms: float
    last_updated: datetime
    error_message: Optional[str] = None
    rate_limit_remaining: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "provider_name": self.provider_name,
            "is_healthy": self.is_healthy,
            "latency_ms": round(self.latency_ms, 2),
            "last_updated": self.last_updated.isoformat(),
            "error_message": self.error_message,
            "rate_limit_remaining": self.rate_limit_remaining,
        }


class BaseMarketDataProvider(ABC):
    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    async def get_candles(self, symbol: str, timeframe: Timeframe, count: int = 200) -> List[Candle]:
        """Fetch historical validated candles in ascending chronological order."""
        pass

    @abstractmethod
    async def get_quote(self, symbol: str) -> Optional[Quote]:
        """Fetch current bid, ask, mid and spread for symbol."""
        pass

    @abstractmethod
    async def check_health(self) -> ProviderHealth:
        """Verify API connectivity and responsiveness."""
        pass

    @abstractmethod
    def normalize_symbol(self, standard_pair: str) -> str:
        """Convert standard symbol like 'EUR/USD' to provider-specific format."""
        pass
