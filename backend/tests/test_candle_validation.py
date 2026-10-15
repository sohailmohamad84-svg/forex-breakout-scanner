import pytest
from datetime import datetime, timezone, timedelta
from app.market_data.base import Candle, Timeframe
from app.market_data.validator import CandleValidator, CandleValidationError


def test_valid_candle():
    c = Candle(
        timestamp=datetime.now(timezone.utc),
        open=1.0800,
        high=1.0850,
        low=1.0790,
        close=1.0820,
        volume=100.0,
        is_closed=True,
    )
    is_valid, msg = CandleValidator.validate_candle(c)
    assert is_valid is True
    assert msg == ""
    assert c.is_green is True
    assert c.is_red is False


def test_invalid_candle_high_lower_than_low():
    c = Candle(
        timestamp=datetime.now(timezone.utc),
        open=1.0800,
        high=1.0700,
        low=1.0850,
        close=1.0820,
    )
    is_valid, msg = CandleValidator.validate_candle(c)
    assert is_valid is False
    assert "High (1.07) is lower than Low (1.085)" in msg


def test_invalid_negative_price():
    c = Candle(
        timestamp=datetime.now(timezone.utc),
        open=-1.0800,
        high=1.0850,
        low=1.0700,
        close=1.0820,
    )
    is_valid, msg = CandleValidator.validate_candle(c)
    assert is_valid is False
    assert "Non-positive price" in msg


def test_clean_and_validate_series_deduplication():
    now = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    c1 = Candle(timestamp=now, open=1.0, high=1.2, low=0.9, close=1.1)
    c2_dup = Candle(timestamp=now, open=1.0, high=1.25, low=0.9, close=1.15)  # newer value
    c3 = Candle(timestamp=now + timedelta(hours=1), open=1.15, high=1.3, low=1.1, close=1.2)

    series = [c1, c2_dup, c3]
    # For testing, duplicate handling keeps latest
    cleaned = CandleValidator.clean_and_validate_series(series, min_required=2, filter_unclosed=False)
    assert len(cleaned) == 2
    assert cleaned[0].high == 1.25
    assert cleaned[1].timestamp > cleaned[0].timestamp


def test_insufficient_candles_raises_error():
    now = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    series = [
        Candle(timestamp=now, open=1.0, high=1.1, low=0.9, close=1.05),
        Candle(timestamp=now + timedelta(hours=1), open=1.05, high=1.15, low=1.0, close=1.1),
    ]
    with pytest.raises(CandleValidationError, match="Insufficient historical candles"):
        CandleValidator.clean_and_validate_series(series, min_required=10)
