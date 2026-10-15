import pytest
from datetime import datetime, timezone, timedelta
from app.market_data.base import Candle
from app.engine.indicator import BreakoutProbabilityIndicator, BreakoutProbabilityResult


def generate_synthetic_candles(pattern: list, base_price: float = 1.1000):
    """
    pattern: list of tuples (is_green, made_new_high, made_new_low)
    """
    candles = []
    curr = base_price
    start_time = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)

    for i, (is_green, new_high, new_low) in enumerate(pattern):
        ts = start_time + timedelta(hours=i)
        o = curr
        if is_green:
            c = o + 0.0020
        else:
            c = o - 0.0020

        # Previous bar high/low
        prev_h = candles[-1].high if candles else o + 0.0010
        prev_l = candles[-1].low if candles else o - 0.0010

        h = prev_h + 0.0015 if new_high else prev_h - 0.0005
        h = max(h, max(o, c) + 0.0002)

        l = prev_l - 0.0015 if new_low else prev_l + 0.0005
        l = min(l, min(o, c) - 0.0002)

        candles.append(Candle(
            timestamp=ts,
            open=round(o, 5),
            high=round(h, 5),
            low=round(l, 5),
            close=round(c, 5),
            volume=500.0,
            is_closed=True
        ))
        curr = c
    return candles


def test_indicator_conditional_probability_calculation():
    # Construct a series where prior candle was GREEN
    # and whenever prior candle was GREEN, 8 out of 10 times subsequent candle makes new high
    # and 2 out of 10 times subsequent makes new low.
    pattern = []
    # 20 alternating pairs of (Green -> [New High, No New Low])
    for _ in range(20):
        pattern.append((True, True, False))   # Green bar
        pattern.append((True, True, False))   # Subsequent bar makes new high
    for _ in range(5):
        pattern.append((True, True, False))   # Green bar
        pattern.append((False, False, True))  # Subsequent bar makes new low

    # End with a green bar so evaluation condition is GREEN
    pattern.append((True, False, False))

    candles = generate_synthetic_candles(pattern)
    indicator = BreakoutProbabilityIndicator(lookback=100, min_condition_samples=5)
    res = indicator.calculate(candles)

    assert isinstance(res, BreakoutProbabilityResult)
    assert res.prior_candle_direction == "BULLISH"
    assert res.condition_matches_count >= 20
    # Bullish probability should be high
    assert res.bullish_probability > 60.0
    assert res.bearish_probability < 40.0
    assert res.winning_direction == "BULLISH"
    assert len(res.upper_levels) == 4
    assert len(res.lower_levels) == 4


def test_indicator_step_levels_ordering():
    pattern = [(True, True, False)] * 30
    candles = generate_synthetic_candles(pattern)
    indicator = BreakoutProbabilityIndicator(lookback=50, percentage_step=0.005, num_levels=4)
    res = indicator.calculate(candles)

    # Upper levels should be strictly increasing in price
    for k in range(1, len(res.upper_levels)):
        assert res.upper_levels[k].price > res.upper_levels[k-1].price
        # Probabilities of reaching higher levels should be monotonically non-increasing
        assert res.upper_levels[k].probability <= res.upper_levels[k-1].probability

    # Lower levels should be strictly decreasing in price
    for k in range(1, len(res.lower_levels)):
        assert res.lower_levels[k].price < res.lower_levels[k-1].price
        assert res.lower_levels[k].probability <= res.lower_levels[k-1].probability
