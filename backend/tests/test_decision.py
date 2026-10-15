import pytest
from datetime import datetime, timezone, timedelta
from app.market_data.base import Timeframe
from app.engine.indicator import BreakoutProbabilityResult
from app.engine.decision import DecisionEngine, SignalDirection


def create_mock_indicator_result(bull_p: float, bear_p: float, age_minutes: float = 5.0):
    now = datetime.now(timezone.utc)
    ts = now - timedelta(minutes=age_minutes)
    win_dir = "BULLISH" if bull_p > bear_p else ("BEARISH" if bear_p > bull_p else "NEUTRAL")
    return BreakoutProbabilityResult(
        bullish_probability=bull_p,
        bearish_probability=bear_p,
        winning_direction=win_dir,
        winning_probability=max(bull_p, bear_p),
        first_level_high=1.0900,
        first_level_low=1.0800,
        current_price=1.0850,
        candle_timestamp=ts,
        total_bars_sample=200,
        condition_matches_count=50,
    )


def test_buy_qualification_at_70_percent_threshold():
    engine = DecisionEngine(probability_threshold=70.0)
    # Bullish 72%, Bearish 30% -> BUY candidate
    ind = create_mock_indicator_result(bull_p=72.5, bear_p=30.0, age_minutes=10)
    decision = engine.evaluate("EUR/USD", Timeframe.H1, ind)

    assert decision.direction == SignalDirection.BUY
    assert decision.is_qualified is True
    assert decision.breakout_level == 1.0900
    assert "BUY qualified" in decision.qualification_reason


def test_sell_qualification_matching_reel_example():
    # In Reel example: USD/JPY Bearish ~70.51%, Bullish ~31.68%
    engine = DecisionEngine(probability_threshold=70.0)
    ind = create_mock_indicator_result(bull_p=31.68, bear_p=70.51, age_minutes=15)
    decision = engine.evaluate("USD/JPY", Timeframe.H1, ind)

    assert decision.direction == SignalDirection.SELL
    assert decision.is_qualified is True
    assert decision.breakout_level == 1.0800
    assert "SELL qualified" in decision.qualification_reason


def test_conflict_when_both_exceed_threshold():
    engine = DecisionEngine(probability_threshold=70.0)
    ind = create_mock_indicator_result(bull_p=75.0, bear_p=71.0)
    decision = engine.evaluate("GBP/USD", Timeframe.H1, ind)

    assert decision.direction == SignalDirection.CONFLICT
    assert decision.is_qualified is False
    assert "CONFLICT" in decision.qualification_reason


def test_no_signal_when_neither_meets_threshold():
    engine = DecisionEngine(probability_threshold=70.0)
    # 58% bull, 45% bear -> No signal even though bull > bear
    ind = create_mock_indicator_result(bull_p=58.0, bear_p=45.0)
    decision = engine.evaluate("AUD/USD", Timeframe.H1, ind)

    assert decision.direction == SignalDirection.NO_SIGNAL
    assert decision.is_qualified is False
    assert "NO SIGNAL" in decision.qualification_reason


def test_insufficient_data_rejection():
    engine = DecisionEngine(probability_threshold=70.0)
    # 0 sample matches
    ind = create_mock_indicator_result(bull_p=80.0, bear_p=20.0)
    ind.condition_matches_count = 5  # < minimum 15
    decision = engine.evaluate("NZD/USD", Timeframe.H1, ind, min_condition_matches=15)

    assert decision.direction == SignalDirection.INSUFFICIENT_DATA
    assert decision.is_qualified is False
    assert "Insufficient historical sample" in decision.qualification_reason


def test_stale_signal_rejection():
    engine = DecisionEngine(probability_threshold=70.0, max_signal_age_minutes=60)
    # Signal is 180 minutes old
    ind = create_mock_indicator_result(bull_p=75.0, bear_p=25.0, age_minutes=180)
    decision = engine.evaluate("EUR/USD", Timeframe.H1, ind)

    assert decision.direction == SignalDirection.BUY
    assert decision.is_qualified is False  # Rejected because stale
    assert decision.is_stale is True
    assert "STALE" in decision.qualification_reason
