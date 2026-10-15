from __future__ import annotations
from datetime import datetime, timezone
import json
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, UniqueConstraint
from .database import Base


def utcnow():
    return datetime.now(timezone.utc)


class CurrencyPair(Base):
    __tablename__ = "currency_pairs"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), unique=True, index=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_major = Column(Boolean, default=False, nullable=False)
    base_currency = Column(String(10), nullable=True)
    quote_currency = Column(String(10), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "symbol": self.symbol,
            "is_active": self.is_active,
            "is_major": self.is_major,
            "base_currency": self.base_currency,
            "quote_currency": self.quote_currency,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SignalRecord(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, index=True)
    pair = Column(String(20), index=True, nullable=False)
    direction = Column(String(10), index=True, nullable=False)  # BUY, SELL
    timeframe = Column(String(10), index=True, nullable=False)  # 5m, 15m, 1h, etc.
    bullish_probability = Column(Float, nullable=False)
    bearish_probability = Column(Float, nullable=False)
    winning_probability = Column(Float, nullable=False)
    threshold_used = Column(Float, nullable=False)
    signal_price = Column(Float, nullable=False)
    breakout_level = Column(Float, nullable=False)
    candle_timestamp = Column(DateTime, index=True, nullable=False)
    detected_at = Column(DateTime, default=utcnow, nullable=False)
    qualification_reason = Column(Text, nullable=False)
    status = Column(String(20), default="ACTIVE", index=True, nullable=False)
    data_provider = Column(String(50), nullable=False)
    strategy_version = Column(String(50), default="1.0.0", nullable=False)
    upper_levels_json = Column(Text, nullable=True)
    lower_levels_json = Column(Text, nullable=True)
    subsequent_max_favorable = Column(Float, default=0.0)
    subsequent_max_adverse = Column(Float, default=0.0)

    __table_args__ = (
        # Deduplication constraint: pair + direction + timeframe + candle_timestamp
        UniqueConstraint("pair", "direction", "timeframe", "candle_timestamp", name="uq_signal_dedup"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "pair": self.pair,
            "direction": self.direction,
            "timeframe": self.timeframe,
            "bullish_probability": round(self.bullish_probability, 2),
            "bearish_probability": round(self.bearish_probability, 2),
            "winning_probability": round(self.winning_probability, 2),
            "threshold_used": round(self.threshold_used, 2),
            "signal_price": round(self.signal_price, 5),
            "breakout_level": round(self.breakout_level, 5),
            "candle_timestamp": self.candle_timestamp.isoformat() if self.candle_timestamp else None,
            "detected_at": self.detected_at.isoformat() if self.detected_at else None,
            "qualification_reason": self.qualification_reason,
            "status": self.status,
            "data_provider": self.data_provider,
            "strategy_version": self.strategy_version,
            "upper_levels": json.loads(self.upper_levels_json) if self.upper_levels_json else [],
            "lower_levels": json.loads(self.lower_levels_json) if self.lower_levels_json else [],
            "subsequent_max_favorable": round(self.subsequent_max_favorable, 5),
            "subsequent_max_adverse": round(self.subsequent_max_adverse, 5),
        }


class ScanAuditLog(Base):
    __tablename__ = "scan_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    started_at = Column(DateTime, default=utcnow, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    duration_ms = Column(Float, default=0.0)
    pairs_scanned = Column(Integer, default=0)
    signals_detected = Column(Integer, default=0)
    provider_status = Column(String(50), default="HEALTHY")
    details_json = Column(Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "duration_ms": round(self.duration_ms, 2),
            "pairs_scanned": self.pairs_scanned,
            "signals_detected": self.signals_detected,
            "provider_status": self.provider_status,
        }


class ScannerSetting(Base):
    __tablename__ = "scanner_settings"

    key = Column(String(50), primary_key=True, index=True)
    value = Column(Text, nullable=False)
    description = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    def to_dict(self):
        return {
            "key": self.key,
            "value": self.value,
            "description": self.description,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class BacktestRecord(Base):
    __tablename__ = "backtest_records"

    id = Column(Integer, primary_key=True, index=True)
    pair = Column(String(20), nullable=False)
    timeframe = Column(String(10), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    total_trades = Column(Integer, nullable=False)
    winning_trades = Column(Integer, nullable=False)
    win_rate = Column(Float, nullable=False)
    profit_factor = Column(Float, nullable=False)
    max_drawdown = Column(Float, nullable=False)
    expectancy = Column(Float, nullable=False)
    gross_pnl = Column(Float, nullable=False)
    net_pnl = Column(Float, nullable=False)
    parameters_json = Column(Text, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "pair": self.pair,
            "timeframe": self.timeframe,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "win_rate": round(self.win_rate, 2),
            "profit_factor": round(self.profit_factor, 2),
            "max_drawdown": round(self.max_drawdown, 2),
            "expectancy": round(self.expectancy, 4),
            "gross_pnl": round(self.gross_pnl, 2),
            "net_pnl": round(self.net_pnl, 2),
            "parameters": json.loads(self.parameters_json) if self.parameters_json else {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
