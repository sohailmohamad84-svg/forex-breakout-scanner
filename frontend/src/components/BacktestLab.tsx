'use client';

import React, { useState } from 'react';
import {
  Play,
  ShieldAlert,
  Cpu,
} from 'lucide-react';
import { BacktestResponse, api } from '../lib/api';

interface BacktestLabProps {
  initialPair?: string;
  initialTimeframe?: string;
}

export default function BacktestLab({
  initialPair = 'EUR/USD',
  initialTimeframe = '1h',
}: BacktestLabProps) {
  const [pair, setPair] = useState(initialPair);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  const [threshold, setThreshold] = useState(70.0);
  const [lookback, setLookback] = useState(200);
  const [percentageStep, setPercentageStep] = useState(0.002);
  const [riskReward, setRiskReward] = useState(1.5);
  const [spreadPips, setSpreadPips] = useState(1.5);
  const [slippagePips, setSlippagePips] = useState(0.5);
  const [maxHolding, setMaxHolding] = useState(12);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.runBacktest({
        pair,
        timeframe,
        probability_threshold: threshold,
        lookback_candles: lookback,
        percentage_step: percentageStep,
        risk_reward_ratio: riskReward,
        spread_pips: spreadPips,
        slippage_pips: slippagePips,
        max_holding_bars: maxHolding,
      });
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Backtest execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Strict Validation Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300 shadow-sm">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-white">Quantitative Validation Integrity: </span>
          <span>
            Simulates trade execution with strict <strong>zero lookahead bias</strong>.
            Signals are evaluated exclusively on closed historical candles at bar <em>t</em>, and trade execution fills at the Open of bar <em>t+1</em>.
            Transaction friction (spread + slippage) is deducted to separate gross from net performance.
            <span className="text-amber-400 font-medium"> Never assume strategy win rate equals indicator breakout probability!</span>
          </span>
        </div>
      </div>

      {/* Configuration Panel */}
      <form onSubmit={handleRun} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Walk-Forward Backtesting Parameters</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
          {/* Pair */}
          <div>
            <label className="block text-slate-400 mb-1">Currency Pair</label>
            <input
              type="text"
              value={pair}
              onChange={(e) => setPair(e.target.value.toUpperCase())}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Timeframe */}
          <div>
            <label className="block text-slate-400 mb-1">Timeframe</label>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono uppercase focus:outline-none focus:border-emerald-500"
            >
              <option value="5m">5M</option>
              <option value="15m">15M</option>
              <option value="30m">30M</option>
              <option value="1h">1H</option>
              <option value="4h">4H</option>
              <option value="1d">1D</option>
            </select>
          </div>

          {/* Threshold */}
          <div>
            <label className="block text-slate-400 mb-1">Probability Threshold ({threshold}%)</label>
            <input
              type="number"
              min="50"
              max="95"
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Lookback */}
          <div>
            <label className="block text-slate-400 mb-1">Lookback (Bars)</label>
            <input
              type="number"
              min="50"
              max="500"
              value={lookback}
              onChange={(e) => setLookback(parseInt(e.target.value) || 200)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Percentage Step */}
          <div>
            <label className="block text-slate-400 mb-1">Step Level (%)</label>
            <input
              type="number"
              step="0.0005"
              min="0.0005"
              max="0.05"
              value={percentageStep}
              onChange={(e) => setPercentageStep(parseFloat(e.target.value) || 0.002)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Risk:Reward */}
          <div>
            <label className="block text-slate-400 mb-1">Risk : Reward Ratio (R)</label>
            <input
              type="number"
              step="0.1"
              min="0.5"
              max="5.0"
              value={riskReward}
              onChange={(e) => setRiskReward(parseFloat(e.target.value) || 1.5)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Spread */}
          <div>
            <label className="block text-slate-400 mb-1">Spread (Pips)</label>
            <input
              type="number"
              step="0.1"
              min="0.0"
              max="10.0"
              value={spreadPips}
              onChange={(e) => setSpreadPips(parseFloat(e.target.value) || 1.5)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Slippage */}
          <div>
            <label className="block text-slate-400 mb-1">Slippage (Pips)</label>
            <input
              type="number"
              step="0.1"
              min="0.0"
              max="5.0"
              value={slippagePips}
              onChange={(e) => setSlippagePips(parseFloat(e.target.value) || 0.5)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Max Holding Bars */}
          <div>
            <label className="block text-slate-400 mb-1">Max Holding Period (Bars)</label>
            <input
              type="number"
              min="1"
              max="50"
              value={maxHolding}
              onChange={(e) => setMaxHolding(parseInt(e.target.value) || 12)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-950/60 transition cursor-pointer disabled:opacity-50"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{loading ? 'Simulating Historical Trades...' : 'Run Walk-Forward Backtest'}</span>
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-600/40 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {/* Backtest Results Display */}
      {result && (
        <div className="space-y-6 animate-in fade-in">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Win Rate */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] text-slate-400 block">Win Rate</span>
              <span
                className={`text-xl font-bold font-mono ${
                  result.win_rate_percent >= 50 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {result.win_rate_percent.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {result.winning_trades}W / {result.losing_trades}L
              </span>
            </div>

            {/* Profit Factor */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] text-slate-400 block">Profit Factor</span>
              <span
                className={`text-xl font-bold font-mono ${
                  result.profit_factor >= 1.5
                    ? 'text-emerald-400'
                    : result.profit_factor >= 1.0
                    ? 'text-cyan-400'
                    : 'text-rose-400'
                }`}
              >
                {result.profit_factor.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Gross Win / Gross Loss</span>
            </div>

            {/* Net PnL */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] text-slate-400 block">Net PnL (Pips)</span>
              <span
                className={`text-xl font-bold font-mono ${
                  result.net_pnl_pips >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {result.net_pnl_pips >= 0 ? '+' : ''}
                {result.net_pnl_pips.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Gross: {result.gross_pnl_pips.toFixed(1)} pips
              </span>
            </div>

            {/* Expectancy */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] text-slate-400 block">Expectancy / Trade</span>
              <span
                className={`text-xl font-bold font-mono ${
                  result.expectancy_pips >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {result.expectancy_pips.toFixed(1)} pips
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Net edge per signal</span>
            </div>

            {/* Max Drawdown */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] text-slate-400 block">Max Drawdown</span>
              <span className="text-xl font-bold font-mono text-amber-400">
                {result.max_drawdown_percent.toFixed(1)}%
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Peak-to-trough</span>
            </div>

            {/* Total Trades Executed */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm">
              <span className="text-[11px] text-slate-400 block">Executed Trades</span>
              <span className="text-xl font-bold font-mono text-white">
                {result.total_trades_executed}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                From {result.total_signals_generated} signals
              </span>
            </div>
          </div>

          {/* Equity Curve Visualization */}
          {result.equity_curve && result.equity_curve.length > 1 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">Simulated Account Equity Curve ($10,000 Initial)</span>
                <span className="text-slate-400 font-mono">
                  Final: ${result.equity_curve[result.equity_curve.length - 1].equity.toFixed(2)}
                </span>
              </div>
              <div className="h-44 w-full relative bg-slate-950 rounded-lg p-2 flex items-end">
                {/* SVG Curve */}
                <svg className="w-full h-full overflow-visible">
                  {(() => {
                    const pts = result.equity_curve;
                    const minE = Math.min(...pts.map((p) => p.equity)) * 0.98;
                    const maxE = Math.max(...pts.map((p) => p.equity)) * 1.02;
                    const eRange = maxE - minE || 1;

                    const coords = pts.map((p, i) => {
                      const x = (i / (pts.length - 1)) * 100;
                      const y = 100 - ((p.equity - minE) / eRange) * 100;
                      return `${x},${y}`;
                    });

                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2"
                          points={coords.join(' ')}
                        />
                      </>
                    );
                  })()}
                </svg>
              </div>
            </div>
          )}

          {/* Trade Log Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-white">
              <span>Simulated Trade Journal ({result.trades.length} trades)</span>
              <span className="text-slate-500 font-mono font-normal">
                Avg duration: {result.average_trade_duration_bars.toFixed(1)} bars
              </span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 text-[11px] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Direction</th>
                    <th className="py-2.5 px-3">Entry Time</th>
                    <th className="py-2.5 px-3">Exit Time</th>
                    <th className="py-2.5 px-3">Entry</th>
                    <th className="py-2.5 px-3">Exit</th>
                    <th className="py-2.5 px-3">Stop Loss</th>
                    <th className="py-2.5 px-3">Take Profit</th>
                    <th className="py-2.5 px-3">PnL (Pips)</th>
                    <th className="py-2.5 px-3">Exit Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-[11px]">
                  {result.trades.map((t, i) => (
                    <tr key={i} className="hover:bg-slate-800/40">
                      <td className="py-2 px-3 text-slate-500">{i + 1}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            t.direction === 'BUY'
                              ? 'bg-emerald-950 text-emerald-400'
                              : 'bg-rose-950 text-rose-400'
                          }`}
                        >
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-400">
                        {new Date(t.entry_time).toISOString().replace('T', ' ').slice(0, 16)}
                      </td>
                      <td className="py-2 px-3 text-slate-400">
                        {new Date(t.exit_time).toISOString().replace('T', ' ').slice(0, 16)}
                      </td>
                      <td className="py-2 px-3 text-white">{t.entry_price.toFixed(pair.includes('JPY') ? 3 : 5)}</td>
                      <td className="py-2 px-3 text-white">{t.exit_price.toFixed(pair.includes('JPY') ? 3 : 5)}</td>
                      <td className="py-2 px-3 text-rose-400">{t.stop_loss.toFixed(pair.includes('JPY') ? 3 : 5)}</td>
                      <td className="py-2 px-3 text-emerald-400">{t.take_profit.toFixed(pair.includes('JPY') ? 3 : 5)}</td>
                      <td
                        className={`py-2 px-3 font-bold ${
                          t.is_win ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {t.pnl_pips >= 0 ? '+' : ''}
                        {t.pnl_pips.toFixed(1)}
                      </td>
                      <td className="py-2 px-3 text-slate-400 text-[10px] font-sans">
                        {t.exit_reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
