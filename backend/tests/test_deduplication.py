import pytest
from datetime import datetime, timezone
from app.market_data.base import Timeframe
from app.engine.decision import SignalDirection, QualifiedSignalDecision
from app.alerts.telegram import TelegramAlertDispatcher


@pytest.mark.asyncio
async def test_telegram_alert_deduplication():
    dispatcher = TelegramAlertDispatcher(bot_token="", chat_id="", enabled=False)

    ts = datetime(2026, 3, 30, 14, 0, tzinfo=timezone.utc)
    dec = QualifiedSignalDecision(
        pair="GBP/USD",
        timeframe=Timeframe.H1,
        direction=SignalDirection.BUY,
        is_qualified=True,
        bullish_probability=74.2,
        bearish_probability=26.5,
        winning_probability=74.2,
        threshold_used=70.0,
        current_price=1.2750,
        breakout_level=1.2760,
        candle_timestamp=ts,
        signal_age_minutes=5.0,
        is_stale=False,
        qualification_reason="BUY qualified",
    )

    # First send: recorded in internal deduplication set (returns False because not enabled, but key added)
    await dispatcher.send_signal_alert(dec, "Yahoo Finance")
    assert len(dispatcher._sent_keys) == 1

    # Second send with identical (pair, direction, timeframe, timestamp): MUST be skipped immediately
    res2 = await dispatcher.send_signal_alert(dec, "Yahoo Finance")
    assert res2 is False
    assert len(dispatcher._sent_keys) == 1  # No duplicate entry


def test_telegram_message_formatting_matches_spec():
    dispatcher = TelegramAlertDispatcher()
    ts = datetime(2026, 3, 30, 14, 0, tzinfo=timezone.utc)
    dec = QualifiedSignalDecision(
        pair="GBP/USD",
        timeframe=Timeframe.H1,
        direction=SignalDirection.BUY,
        is_qualified=True,
        bullish_probability=74.20,
        bearish_probability=26.50,
        winning_probability=74.20,
        threshold_used=70.0,
        current_price=1.27500,
        breakout_level=1.27620,
        candle_timestamp=ts,
        signal_age_minutes=5.0,
        is_stale=False,
        qualification_reason="BUY qualified: Bullish breakout probability >= 70%",
    )

    msg = dispatcher.format_signal_message(dec, "Yahoo Finance")
    assert "FOREX SIGNAL DETECTED" in msg
    assert "Pair:</b> GBP/USD" in msg
    assert "Direction:</b> BUY" in msg
    assert "Timeframe:</b> 1H" in msg
    assert "Bullish probability:</b> 74.20%" in msg
    assert "Bearish probability:</b> 26.50%" in msg
    assert "Signal price:</b> 1.27500" in msg
    assert "Breakout level:</b> 1.27620" in msg
    assert "Data provider:</b> Yahoo Finance" in msg
