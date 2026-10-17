'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  Zap,
  CheckCircle2,
  XCircle,

} from 'lucide-react';
import { SignalItem } from '../lib/api';

interface HistoricalSignalsProps {
  signals: SignalItem[];
  onSelectSignal: (signal: SignalItem) => void;
}

export default function HistoricalSignals({
  signals,
  onSelectSignal,
}: HistoricalSignalsProps) {
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState('ALL');

  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (search && !s.pair.toLowerCase().includes(search.toLowerCase())) return false;
      if (directionFilter !== 'ALL' && s.direction !== directionFilter) return false;
      if (timeframeFilter !== 'ALL' && s.timeframe.toLowerCase() !== timeframeFilter.toLowerCase()) return false;
      return true;
    });
  }, [signals, search, directionFilter, timeframeFilter]);

  // Aggregate Historical Profit and Loss Metrics
  const metrics = useMemo(() => {
    const total = filteredSignals.length;
    if (total === 0) {
      return { total: 0, winCount: 0, lossCount: 0, winRate: 0, netPips: 0, profitFactor: 0 };
    }

    let winCount = 0;
    let lossCount = 0;
    let grossWinPips = 0;
    let grossLossPips = 0;
    let netPips = 0;

    filteredSignals.forEach((s) => {
      const pips = s.pnl_pips ?? 0;
      netPips += pips;
      if (pips > 0) {
        winCount++;
        grossWinPips += pips;
      } else if (pips < 0) {
        lossCount++;
        grossLossPips += Math.abs(pips);
      }
    });

    const winRate = total > 0 ? (winCount / total) * 100 : 0;
    const profitFactor = grossLossPips > 0 ? grossWinPips / grossLossPips : grossWinPips > 0 ? 9.99 : 0;

    return {
      total,
      winCount,
      lossCount,
      winRate: Number(winRate.toFixed(1)),
      netPips: Number(netPips.toFixed(1)),
      profitFactor: Number(profitFactor.toFixed(2)),
    };
  }, [filteredSignals]);

  return (
    <div className="space-y-4">
      {/* Historical Profit & Loss KPI Performance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Historical Win Rate</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {metrics.winRate}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {metrics.winCount} Won / {metrics.lossCount} Lost
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Historical P&L</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div
            className={`text-2xl font-bold font-mono mt-1 ${
              metrics.netPips >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {metrics.netPips >= 0 ? '+' : ''}
            {metrics.netPips} Pips
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {metrics.netPips >= 0
              ? `+$${(metrics.netPips * 10).toFixed(0)} / Std Lot`
              : `-$${(Math.abs(metrics.netPips) * 10).toFixed(0)} / Std Lot`}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Profit Factor</span>
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            {metrics.profitFactor}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Gross Wins / Gross Losses</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Signals Stored</span>
            <Target className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {metrics.total}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Evaluated against actual market moves</div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pair..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direction */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {(['ALL', 'BUY', 'SELL'] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setDirectionFilter(dir)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  directionFilter === dir
                    ? dir === 'BUY'
                      ? 'bg-emerald-600 text-white'
                      : dir === 'SELL'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {dir}
              </button>
            ))}
          </div>

          {/* Timeframe */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {['ALL', '5m', '15m', '30m', '1h', '4h', '1d'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframeFilter(tf)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono uppercase transition cursor-pointer ${
                  timeframeFilter === tf
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Historical Signals Table with PnL */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold select-none">
                <th className="py-3 px-3">ID</th>
                <th className="py-3 px-3">Pair</th>
                <th className="py-3 px-3">Direction</th>
                <th className="py-3 px-3">Prob (Est.)</th>
                <th className="py-3 px-3">Signal Price</th>
                <th className="py-3 px-3">Target (TP)</th>
                <th className="py-3 px-3">Stop (SL)</th>
                <th className="py-3 px-3">Realized P&L</th>
                <th className="py-3 px-3">Outcome</th>
                <th className="py-3 px-3">Detected Time</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredSignals.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 font-sans text-xs">
                    No historical signal records match your filter.
                  </td>
                </tr>
              ) : (
                filteredSignals.map((s) => {
                  const isBuy = s.direction === 'BUY';
                  const isJpy = s.pair.includes('JPY');
                  const pDec = isJpy ? 3 : 5;
                  const pips = s.pnl_pips ?? 0;
                  const isWin = pips > 0;
                  const isTargetHit = s.outcome === 'TARGET_HIT';
                  const isStoppedOut = s.outcome === 'STOPPED_OUT';

                  return (
                    <tr
                      key={s.id}
                      onClick={() => onSelectSignal(s)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-3 text-slate-500">#{s.id}</td>
                      <td className="py-3 px-3 font-bold text-white font-sans text-xs group-hover:text-emerald-400 transition">
                        {s.pair}
                        <span className="ml-1.5 px-1 py-0.2 rounded bg-slate-800 text-slate-400 text-[9px] uppercase">
                          {s.timeframe}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isBuy
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                              : 'bg-rose-950 text-rose-400 border border-rose-800/50'
                          }`}
                        >
                          {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {s.direction}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold">
                        <span className={isBuy ? 'text-emerald-400' : 'text-rose-400'}>
                          {s.winning_probability.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-white font-medium">{s.signal_price.toFixed(pDec)}</td>
                      <td className="py-3 px-3 text-emerald-400">
                        {(s.take_profit ?? (s.signal_price * 1.0035)).toFixed(pDec)}
                      </td>
                      <td className="py-3 px-3 text-rose-400">
                        {(s.stop_loss ?? (s.signal_price * 0.998)).toFixed(pDec)}
                      </td>
                      {/* Realized PnL Column */}
                      <td className="py-3 px-3 font-bold">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                            isWin
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {pips >= 0 ? '+' : ''}
                          {pips.toFixed(1)} pips
                        </span>
                      </td>
                      {/* Trade Outcome Column */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isTargetHit
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60'
                              : isStoppedOut
                              ? 'bg-rose-950 text-rose-300 border border-rose-700/60'
                              : 'bg-cyan-950 text-cyan-300 border border-cyan-700/60'
                          }`}
                        >
                          {isTargetHit ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : isStoppedOut ? (
                            <XCircle className="w-3 h-3 text-rose-400" />
                          ) : (
                            <Target className="w-3 h-3 text-cyan-400" />
                          )}
                          {s.outcome?.replace('_', ' ') || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[10px]">
                        {new Date(s.detected_at).toISOString().replace('T', ' ').slice(0, 16)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSignal(s);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans text-[11px] transition cursor-pointer"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
