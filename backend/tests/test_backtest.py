import pytest
from datetime import datetime, timezone, timedelta
from app.market_data.base import Candle, Timeframe
from app.market_data.mock_provider import MockProvider
from app.backtesting.engine import WalkForwardBacktester, BacktestSummary


@pytest.mark.asyncio
async def test_walk_forward_backtester_execution():
    provider = MockProvider(seed=123)
    # Generate 300 candles
    candles = await provider.get_candles("EUR/USD", Timeframe.H1, count=300)
    assert len(candles) == 300

    tester = WalkForwardBacktester(
        probability_threshold=65.0,  # 65% for test sample activity
        lookback_candles=100,
        percentage_step=0.002,
        risk_reward_ratio=1.5,
        spread_pips=1.5,
        slippage_pips=0.5,
        max_holding_bars=10,
    )

    summary = tester.run("EUR/USD", Timeframe.H1, candles)

    assert isinstance(summary, BacktestSummary)
    assert summary.total_candles_analyzed == 300
    assert summary.total_signals_generated >= 0
    # Gross PnL should be >= Net PnL because of spread and slippage costs!
    if summary.total_trades_executed > 0:
        assert summary.gross_pnl_pips >= summary.net_pnl_pips
        # Verify trade properties
        for t in summary.trades:
            assert t.entry_time < t.exit_time or t.duration_bars >= 0
            assert t.stop_loss > 0
            assert t.take_profit > 0
            assert t.direction in ["BUY", "SELL"]

    # Equity curve must exist
    assert len(summary.equity_curve) >= 1
    assert summary.equity_curve[0]["equity"] == 10000.0


def test_insufficient_candles_raises_backtest_error():
    base_ts = datetime(2026, 1, 1, 0, 0, tzinfo=timezone.utc)
    candles = [
        Candle(
            timestamp=base_ts + timedelta(hours=i),
            open=1.0, high=1.01, low=0.99, close=1.005,
        )
        for i in range(50)
    ]
    tester = WalkForwardBacktester(lookback_candles=100)
    with pytest.raises(ValueError, match="Insufficient historical candles"):
        tester.run("EUR/USD", Timeframe.H1, candles)
