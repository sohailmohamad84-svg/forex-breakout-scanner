'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  TrendingUp,
  TrendingDown,
  Info,
  Layers,
  Cpu,
  DollarSign,
} from 'lucide-react';

import { SignalItem, api, MarketCandlesResponse } from '../lib/api';
import CandlestickChart from './CandlestickChart';


interface SignalDetailsModalProps {
  signal: SignalItem | null;
  onClose: () => void;
  onRunBacktest: (pair: string, timeframe: string) => void;
}

export default function SignalDetailsModal({
  signal,
  onClose,
  onRunBacktest,
}: SignalDetailsModalProps) {
  const [marketData, setMarketData] = useState<MarketCandlesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lotSize, setLotSize] = useState<number>(1.0);

  useEffect(() => {
    if (!signal) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    api
      .getMarketCandles(signal.pair, signal.timeframe, 120)
      .then((data) => {
        if (isMounted) setMarketData(data);
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load chart candles');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [signal]);

  if (!signal) return null;

  const isBuy = signal.direction === 'BUY';
  const isJpy = signal.pair.includes('JPY');
  const pDec = isJpy ? 3 : 5;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl my-auto animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isBuy ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60' : 'bg-rose-950 text-rose-400 border border-rose-800/60'
              }`}
            >
              {isBuy ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{signal.pair}</h2>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-xs uppercase">
                  {signal.timeframe}
                </span>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded font-bold uppercase ${
                    isBuy ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {signal.direction} OPPORTUNITY
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Signal ID #{signal.id} &bull; Detected on completed candle at{' '}
                {new Date(signal.candle_timestamp).toUTCString()}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Methodology Disclosure Alert */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-300 space-y-1">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold">
              <Info className="w-4 h-4 shrink-0" />
              <span>Traceable Methodology Attribution</span>
            </div>
            <p className="text-slate-400 leading-relaxed">
              <strong>Breakout Probability (Expo)</strong> &bull; Conditional Transition Probability Model (Zeiierman Published Methodology).
              TradingView Pine Script source is closed/protected on TradingView; this system independently executes the verified empirical conditional frequency calculations over historical completed bars.
              Directional probability is an empirical indicator estimate, not a guaranteed trade win rate.
            </p>
          </div>

          {/* Candlestick Chart */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>Interactive Candlestick Chart & Breakout Targets</span>
              {loading && <span className="text-emerald-400 text-xs animate-pulse">Loading live candle data...</span>}
            </div>

            {marketData && marketData.candles.length > 0 ? (
              <CandlestickChart
                candles={marketData.candles}
                firstLevelHigh={marketData.indicator?.first_level_high || signal.breakout_level}
                firstLevelLow={marketData.indicator?.first_level_low || signal.signal_price}
                bullishProb={signal.bullish_probability}
                bearishProb={signal.bearish_probability}
                upperLevels={marketData.indicator?.upper_levels || signal.upper_levels}
                lowerLevels={marketData.indicator?.lower_levels || signal.lower_levels}
                currentPrice={signal.signal_price}
                pair={signal.pair}
                timeframe={signal.timeframe}
              />
            ) : error ? (
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-8 text-center text-rose-400 text-xs">
                {error}
              </div>
            ) : (
              <div className="bg-slate-950 border border-slate-800 rounded-lg h-72 flex items-center justify-center text-slate-500 text-xs">
                Fetching chart bars...
              </div>
            )}
          </div>

          {/* Live Trade P&L Tracker & Position Calculator */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  <span>Trade Profit & Loss Tracker (Live Performance)</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Live outcome tracking if you entered at Signal Price ({signal.signal_price.toFixed(pDec)})
                </p>
              </div>

              {/* Lot size selector */}
              <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                <span className="text-[10px] text-slate-400 px-1 font-mono">Lot Size:</span>
                {[
                  { label: '1.0 Std ($10/p)', value: 1.0 },
                  { label: '0.1 Mini ($1/p)', value: 0.1 },
                  { label: '0.01 Micro ($0.10/p)', value: 0.01 },
                ].map((lot) => (
                  <button
                    key={lot.value}
                    onClick={() => setLotSize(lot.value)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                      lotSize === lot.value ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {lot.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-center">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block font-sans">Current Price</span>
                <span className="text-sm font-bold text-white">
                  {(signal.current_price ?? signal.signal_price).toFixed(pDec)}
                </span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block font-sans">Live P&L (Pips)</span>
                <span
                  className={`text-sm font-bold ${
                    (signal.pnl_pips ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {(signal.pnl_pips ?? 0) >= 0 ? '+' : ''}
                  {(signal.pnl_pips ?? 0).toFixed(1)} Pips
                </span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block font-sans">Estimated P&L ($)</span>
                <span
                  className={`text-sm font-bold ${
                    (signal.pnl_pips ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {(signal.pnl_pips ?? 0) >= 0 ? '+' : ''}$
                  {((signal.pnl_pips ?? 0) * 10 * lotSize).toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/60">
                <span className="text-[10px] text-slate-400 block font-sans">Current Status</span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded inline-block uppercase mt-0.5 ${
                    signal.outcome === 'TARGET_HIT' || (signal.pnl_pips ?? 0) > 0
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : signal.outcome === 'STOPPED_OUT' || (signal.pnl_pips ?? 0) < 0
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  }`}
                >
                  {signal.outcome === 'TARGET_HIT'
                    ? 'TARGET REACHED'
                    : signal.outcome === 'STOPPED_OUT'
                    ? 'STOPPED OUT'
                    : (signal.pnl_pips ?? 0) > 0
                    ? 'IN PROFIT'
                    : (signal.pnl_pips ?? 0) < 0
                    ? 'IN LOSS'
                    : 'AT ENTRY (OPEN)'}
                </span>
              </div>

            </div>

            {/* Profit Target & Stop Loss Levels */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-emerald-950/40 border border-emerald-800/50 p-2.5 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-emerald-400 font-sans block font-semibold">Take Profit (Target 1)</span>
                  <span className="text-white font-bold text-sm">
                    {(signal.take_profit ?? (signal.signal_price * 1.0035)).toFixed(pDec)}
                  </span>
                </div>
                <span className="text-emerald-400 font-bold text-xs bg-emerald-900/50 px-2 py-1 rounded">
                  +35.0 Pips
                </span>
              </div>

              <div className="bg-rose-950/40 border border-rose-800/50 p-2.5 rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-rose-400 font-sans block font-semibold">Stop Loss (Invalidation)</span>
                  <span className="text-white font-bold text-sm">
                    {(signal.stop_loss ?? (signal.signal_price * 0.998)).toFixed(pDec)}
                  </span>
                </div>
                <span className="text-rose-400 font-bold text-xs bg-rose-900/50 px-2 py-1 rounded">
                  -20.0 Pips
                </span>
              </div>
            </div>
          </div>

          {/* Probability & Breakdown Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Bullish Probability Card */}
            <div className="bg-slate-950 border border-emerald-950/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Bullish Breakout Prob</span>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold font-mono text-emerald-400">
                {signal.bullish_probability.toFixed(1)}%
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, signal.bullish_probability)}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                Threshold: &ge;{signal.threshold_used}% ({signal.bullish_probability >= signal.threshold_used ? 'SATISFIED' : 'BELOW'})
              </div>
            </div>

            {/* Bearish Probability Card */}
            <div className="bg-slate-950 border border-rose-950/80 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Bearish Breakout Prob</span>
                <TrendingDown className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-3xl font-bold font-mono text-rose-400">
                {signal.bearish_probability.toFixed(1)}%
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, signal.bearish_probability)}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                Threshold: &ge;{signal.threshold_used}% ({signal.bearish_probability >= signal.threshold_used ? 'SATISFIED' : 'BELOW'})
              </div>
            </div>

            {/* Execution Targets Card */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-slate-400 font-sans">
                <span>Key Execution Levels</span>
                <Layers className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">Signal Price:</span>
                <span className="text-white font-bold">{signal.signal_price.toFixed(pDec)}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-1.5">
                <span className="text-slate-400">Breakout Level:</span>
                <span className={isBuy ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {signal.breakout_level.toFixed(pDec)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Data Provider:</span>
                <span className="text-slate-300 font-sans">{signal.data_provider}</span>
              </div>
            </div>
          </div>

          {/* Tiered Step Levels Table */}
          {(signal.upper_levels.length > 0 || signal.lower_levels.length > 0) && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="text-xs font-semibold text-white">Projected Tiered Probability Levels (1..4)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Upper Levels */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-cyan-400">Upper Percentage Levels</div>
                  {signal.upper_levels.map((lvl) => (
                    <div
                      key={lvl.level}
                      className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded border border-slate-800/80 font-mono text-xs"
                    >
                      <span className="text-slate-300">Level +{lvl.level}</span>
                      <span className="text-white font-semibold">{lvl.price.toFixed(pDec)}</span>
                      <span className="text-cyan-400">{lvl.probability.toFixed(1)}% prob</span>
                    </div>
                  ))}
                </div>

                {/* Lower Levels */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-orange-400">Lower Percentage Levels</div>
                  {signal.lower_levels.map((lvl) => (
                    <div
                      key={lvl.level}
                      className="flex items-center justify-between bg-slate-900 px-3 py-1.5 rounded border border-slate-800/80 font-mono text-xs"
                    >
                      <span className="text-slate-300">Level -{lvl.level}</span>
                      <span className="text-white font-semibold">{lvl.price.toFixed(pDec)}</span>
                      <span className="text-orange-400">{lvl.probability.toFixed(1)}% prob</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Qualification Rationale */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
            <span className="font-semibold text-white">Qualification Decision Audit</span>
            <p className="text-slate-300 leading-relaxed font-mono">{signal.qualification_reason}</p>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => {
                onClose();
                onRunBacktest(signal.pair, signal.timeframe);
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <Cpu className="w-4 h-4" />
              <span>Backtest Strategy on {signal.pair}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
