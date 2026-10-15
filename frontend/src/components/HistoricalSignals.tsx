'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  TrendingUp,
  TrendingDown,
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

  return (
    <div className="space-y-4">
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

      {/* Historical Signals Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold select-none">
                <th className="py-3 px-4">Signal ID</th>
                <th className="py-3 px-3">Pair</th>
                <th className="py-3 px-3">Direction</th>
                <th className="py-3 px-3">Breakout Prob (Est.)</th>
                <th className="py-3 px-3">Signal Price</th>
                <th className="py-3 px-3">Trigger Level</th>
                <th className="py-3 px-3">Timeframe</th>
                <th className="py-3 px-3">Detected Date (UTC)</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Provider</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredSignals.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 font-sans text-xs">
                    No historical signal records stored yet. Signals will accumulate automatically as qualified opportunities are discovered.
                  </td>
                </tr>
              ) : (
                filteredSignals.map((s) => {
                  const isBuy = s.direction === 'BUY';
                  const isJpy = s.pair.includes('JPY');
                  const pDec = isJpy ? 3 : 5;

                  return (
                    <tr
                      key={s.id}
                      onClick={() => onSelectSignal(s)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 text-slate-500">#{s.id}</td>
                      <td className="py-3 px-3 font-bold text-white font-sans text-xs">{s.pair}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
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
                      <td className="py-3 px-3 text-white">{s.signal_price.toFixed(pDec)}</td>
                      <td className="py-3 px-3">
                        <span className={isBuy ? 'text-emerald-400' : 'text-rose-400'}>
                          {s.breakout_level.toFixed(pDec)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                          {s.timeframe}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {new Date(s.detected_at).toISOString().replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-semibold">
                          {s.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-sans">{s.data_provider}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSignal(s);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans text-[11px] transition cursor-pointer"
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
