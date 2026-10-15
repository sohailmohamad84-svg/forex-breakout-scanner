from __future__ import annotations
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class PairItem(BaseModel):
    id: int
    symbol: str
    is_active: bool
    is_major: bool
    base_currency: Optional[str] = None
    quote_currency: Optional[str] = None


class PairToggleRequest(BaseModel):
    symbol: str
    is_active: bool


class PairAddRequest(BaseModel):
    symbol: str
    is_major: bool = False


class StepLevelSchema(BaseModel):
    level: int
    price: float
    probability: float


class SignalItem(BaseModel):
    id: int
    pair: str
    direction: str  # BUY, SELL
    timeframe: str
    bullish_probability: float
    bearish_probability: float
    winning_probability: float
    threshold_used: float
    signal_price: float
    breakout_level: float
    candle_timestamp: str
    detected_at: str
    qualification_reason: str
    status: str
    data_provider: str
    strategy_version: str
    upper_levels: List[StepLevelSchema] = []
    lower_levels: List[StepLevelSchema] = []
    subsequent_max_favorable: float = 0.0
    subsequent_max_adverse: float = 0.0


class ScannerStatusResponse(BaseModel):
    is_running: bool
    last_scan_time: Optional[str] = None
    last_scan_duration_ms: float = 0.0
    total_pairs_enabled: int = 0
    pairs_scanned_count: int = 0
    qualified_buy_count: int = 0
    qualified_sell_count: int = 0
    no_signal_count: int = 0
    conflict_count: int = 0
    insufficient_data_count: int = 0
    data_provider: str
    provider_healthy: bool
    provider_latency_ms: float = 0.0
    active_threshold: float = 70.0
    concurrency_limit: int = 4


class ScannerPairResult(BaseModel):
    pair: str
    timeframe: str
    latest_price: float
    bullish_probability: float
    bearish_probability: float
    winning_probability: float
    direction: str  # BUY, SELL, CONFLICT, NO_SIGNAL, INSUFFICIENT_DATA
    is_qualified: bool
    breakout_level: float
    last_scan_time: str
    candle_timestamp: str
    data_status: str  # OK, STALE, ERROR, INSUFFICIENT_DATA
    qualification_reason: str
    upper_levels: List[StepLevelSchema] = []
    lower_levels: List[StepLevelSchema] = []


class ScannerResultsMatrixResponse(BaseModel):
    timestamp: str
    total_evaluated: int
    results: List[ScannerPairResult]


class SettingsSchema(BaseModel):
    active_provider: str = Field(default="yahoo", description="yahoo, twelve_data, oanda, mock")
    probability_threshold: float = Field(default=70.0, ge=50.0, le=95.0)
    lookback_candles: int = Field(default=200, ge=30, le=1000)
    percentage_step: float = Field(default=0.002, ge=0.0001, le=0.05)
    scan_interval_seconds: int = Field(default=60, ge=10, le=3600)
    max_signal_age_minutes: int = Field(default=180, ge=5, le=1440)
    enabled_timeframes: List[str] = Field(default=["5m", "15m", "30m", "1h", "4h", "1d"])
    timezone_display: str = Field(default="UTC")
    telegram_enabled: bool = False
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    twelve_data_api_key: Optional[str] = None
    oanda_api_key: Optional[str] = None
    oanda_account_id: Optional[str] = None


class BacktestRunRequest(BaseModel):
    pair: str = "EUR/USD"
    timeframe: str = "1h"
    probability_threshold: float = 70.0
    lookback_candles: int = 200
    percentage_step: float = 0.002
    risk_reward_ratio: float = 1.5
    stop_loss_mode: str = "BREAKOUT_LEVEL"  # "BREAKOUT_LEVEL" | "ATR"
    spread_pips: float = 1.5
    slippage_pips: float = 0.5
    max_holding_bars: int = 12


class BacktestTradeItem(BaseModel):
    entry_time: str
    exit_time: str
    direction: str
    entry_price: float
    exit_price: float
    stop_loss: float
    take_profit: float
    pnl_pips: float
    pnl_percent: float
    is_win: bool
    exit_reason: str


class BacktestResponse(BaseModel):
    pair: str
    timeframe: str
    start_date: str
    end_date: str
    total_candles_analyzed: int
    total_signals_generated: int
    total_trades_executed: int
    winning_trades: int
    losing_trades: int
    win_rate_percent: float
    profit_factor: float
    max_drawdown_percent: float
    expectancy_pips: float
    gross_pnl_pips: float
    net_pnl_pips: float
    average_trade_duration_bars: float
    trades: List[BacktestTradeItem] = []
    equity_curve: List[Dict[str, Any]] = []
    methodology_note: str = (
        "Calculated without future-candle leakage. "
        "Trades simulate execution at the open of bar t+1 following a closed qualifying bar at t. "
        "Net PnL factors in transaction costs (spread + slippage)."
    )
