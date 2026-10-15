'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';
import { SignalItem } from '../lib/api';

interface QualifiedSignalsProps {
  signals: SignalItem[];
  onSelectSignal: (signal: SignalItem) => void;
  activeThreshold: number;
}

export default function QualifiedSignals({
  signals,
  onSelectSignal,
  activeThreshold,
}: QualifiedSignalsProps) {
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<string>('ALL');
  const [sortField, setSortField] = useState<keyof SignalItem>('winning_probability');
  const [sortAsc, setSortAsc] = useState(false);

  // Filtered and sorted signals
  const filteredSignals = useMemo(() => {
    return signals
      .filter((s) => {
        // Search filter
        if (search && !s.pair.toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
        // Direction filter
        if (directionFilter !== 'ALL' && s.direction !== directionFilter) {
          return false;
        }
        // Timeframe filter
        if (timeframeFilter !== 'ALL' && s.timeframe.toLowerCase() !== timeframeFilter.toLowerCase()) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortAsc ? valA - valB : valB - valA;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return 0;
      });
  }, [signals, search, directionFilter, timeframeFilter, sortField, sortAsc]);

  const handleSort = (field: keyof SignalItem) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pair (e.g. EUR/USD)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Direction Filter Pills */}
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

          {/* Timeframe Filter */}
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

      {/* Signals Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold select-none">
                <th
                  onClick={() => handleSort('pair')}
                  className="py-3 px-4 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Pair</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('direction')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Direction</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('winning_probability')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5" title="Winning-direction breakout probability estimate (not guaranteed win rate)">
                    <span>Breakout Prob (Est.)</span>
                    <ArrowUpDown className="w-3 h-3 text-emerald-400" />
                  </div>
                </th>
                <th className="py-3 px-3 text-slate-400">Bull / Bear Split</th>
                <th
                  onClick={() => handleSort('signal_price')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Signal Price</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('breakout_level')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Breakout Level</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3 text-slate-400">Timeframe</th>
                <th
                  onClick={() => handleSort('detected_at')}
                  className="py-3 px-3 cursor-pointer hover:text-white transition"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Detected Time</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredSignals.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-sans text-xs">
                    No qualified signals match your active criteria (Threshold: &ge;{activeThreshold}%).
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
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      {/* Pair */}
                      <td className="py-3 px-4 font-bold text-white font-sans text-xs group-hover:text-emerald-400 transition">
                        {s.pair}
                      </td>

                      {/* Direction */}
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

                      {/* Winning Direction Probability */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-xs ${
                              isBuy ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {s.winning_probability.toFixed(1)}%
                          </span>
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                            <div
                              className={`h-full ${isBuy ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(100, s.winning_probability)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Bull / Bear Split */}
                      <td className="py-3 px-3 text-slate-400">
                        <span className="text-emerald-400">{s.bullish_probability.toFixed(1)}%</span>
                        <span className="text-slate-600 mx-1">/</span>
                        <span className="text-rose-400">{s.bearish_probability.toFixed(1)}%</span>
                      </td>

                      {/* Signal Price */}
                      <td className="py-3 px-3 text-white">
                        {s.signal_price.toFixed(pDec)}
                      </td>

                      {/* Breakout Level */}
                      <td className="py-3 px-3">
                        <span className={`font-semibold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {s.breakout_level.toFixed(pDec)}
                        </span>
                      </td>

                      {/* Timeframe */}
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase">
                          {s.timeframe}
                        </span>
                      </td>

                      {/* Detected Time */}
                      <td className="py-3 px-3 text-slate-400">
                        {new Date(s.detected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSignal(s);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition text-[11px] font-sans font-medium inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Analyze</span>
                          <ChevronRight className="w-3 h-3" />
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
