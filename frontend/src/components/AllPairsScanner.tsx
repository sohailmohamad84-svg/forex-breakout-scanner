'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  Info,
} from 'lucide-react';
import { ScannerPairResult } from '../lib/api';
import ProbabilityBadge from './ProbabilityBadge';

interface AllPairsScannerProps {
  results: ScannerPairResult[];
  onSelectPair?: (pair: string, timeframe: string) => void;
  activeThreshold: number;
}

export default function AllPairsScanner({
  results,
  activeThreshold,
}: AllPairsScannerProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'QUALIFIED' | 'NO_SIGNAL' | 'CONFLICT' | 'INSUFFICIENT'>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState('ALL');
  const [sortField, setSortField] = useState<keyof ScannerPairResult>('pair');
  const [sortAsc, setSortAsc] = useState(true);

  const filteredResults = useMemo(() => {
    return results
      .filter((r) => {
        if (search && !r.pair.toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
        if (timeframeFilter !== 'ALL' && r.timeframe.toLowerCase() !== timeframeFilter.toLowerCase()) {
          return false;
        }
        if (statusFilter === 'QUALIFIED' && !r.is_qualified) {
          return false;
        }
        if (statusFilter === 'NO_SIGNAL' && r.direction !== 'NO_SIGNAL') {
          return false;
        }
        if (statusFilter === 'CONFLICT' && r.direction !== 'CONFLICT') {
          return false;
        }
        if (statusFilter === 'INSUFFICIENT' && r.direction !== 'INSUFFICIENT_DATA') {
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
  }, [results, search, statusFilter, timeframeFilter, sortField, sortAsc]);

  const handleSort = (field: keyof ScannerPairResult) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'pair');
    }
  };

  return (
    <div className="space-y-4">
      {/* Educational Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <Info className="w-5 h-5 text-cyan-400 shrink-0" />
          <p className="text-slate-300">
            <strong>All-Pairs Transparency Matrix:</strong> Displays every configured forex instrument and its calculated probabilities.
            Inspect the <span className="text-white font-semibold">Exclusion / Qualification Reason</span> column to verify exactly why a pair was rejected or qualified.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-md">
        {/* Search */}
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

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {(
              [
                { id: 'ALL', label: 'All Pairs' },
                { id: 'QUALIFIED', label: 'Qualified Only' },
                { id: 'NO_SIGNAL', label: 'No Signal' },
                { id: 'CONFLICT', label: 'Conflict' },
                { id: 'INSUFFICIENT', label: 'Insufficient Data' },
              ] as const
            ).map((st) => (
              <button
                key={st.id}
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  statusFilter === st.id
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st.label}
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

      {/* Matrix Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold select-none">
                <th onClick={() => handleSort('pair')} className="py-3 px-4 cursor-pointer hover:text-white transition">
                  <div className="flex items-center gap-1.5">
                    <span>Currency Pair</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Timeframe</th>
                <th onClick={() => handleSort('latest_price')} className="py-3 px-3 cursor-pointer hover:text-white transition">
                  <div className="flex items-center gap-1.5">
                    <span>Latest Price</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => handleSort('bullish_probability')} className="py-3 px-3 cursor-pointer hover:text-white transition">
                  <div className="flex items-center gap-1.5">
                    <span>Bullish Prob</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => handleSort('bearish_probability')} className="py-3 px-3 cursor-pointer hover:text-white transition">
                  <div className="flex items-center gap-1.5">
                    <span>Bearish Prob</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th onClick={() => handleSort('direction')} className="py-3 px-3 cursor-pointer hover:text-white transition">
                  <div className="flex items-center gap-1.5">
                    <span>Classification</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3">Data Status</th>
                <th className="py-3 px-4">Exclusion / Qualification Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {filteredResults.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 font-sans text-xs">
                    No currency pair results found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredResults.map((r, idx) => {
                  const isJpy = r.pair.includes('JPY');
                  const pDec = isJpy ? 3 : 5;

                  return (
                    <tr
                      key={`${r.pair}-${r.timeframe}-${idx}`}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Pair */}
                      <td className="py-3 px-4 font-bold text-white font-sans text-xs">
                        {r.pair}
                      </td>

                      {/* Timeframe */}
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px] uppercase">
                          {r.timeframe}
                        </span>
                      </td>

                      {/* Latest Price */}
                      <td className="py-3 px-3 text-white">
                        {r.latest_price > 0 ? r.latest_price.toFixed(pDec) : '—'}
                      </td>

                      {/* Bullish Prob */}
                      <td className="py-3 px-3">
                        <span
                          className={
                            r.bullish_probability >= activeThreshold
                              ? 'text-emerald-400 font-bold'
                              : 'text-slate-400'
                          }
                        >
                          {r.bullish_probability > 0 ? `${r.bullish_probability.toFixed(1)}%` : '—'}
                        </span>
                      </td>

                      {/* Bearish Prob */}
                      <td className="py-3 px-3">
                        <span
                          className={
                            r.bearish_probability >= activeThreshold
                              ? 'text-rose-400 font-bold'
                              : 'text-slate-400'
                          }
                        >
                          {r.bearish_probability > 0 ? `${r.bearish_probability.toFixed(1)}%` : '—'}
                        </span>
                      </td>

                      {/* Direction Classification */}
                      <td className="py-3 px-3">
                        <ProbabilityBadge
                          direction={r.direction}
                          bullishProb={r.bullish_probability}
                          bearishProb={r.bearish_probability}
                          winningProb={r.winning_probability}
                          threshold={activeThreshold}
                          size="sm"
                        />
                      </td>

                      {/* Data Status */}
                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            r.data_status === 'OK'
                              ? 'bg-emerald-950/60 text-emerald-400'
                              : r.data_status === 'STALE'
                              ? 'bg-amber-950/60 text-amber-400'
                              : 'bg-rose-950/60 text-rose-400'
                          }`}
                        >
                          {r.data_status}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 text-slate-300 font-sans text-xs max-w-md">
                        <span
                          className={
                            r.is_qualified
                              ? 'text-emerald-400 font-medium'
                              : r.direction === 'CONFLICT'
                              ? 'text-amber-400 font-medium'
                              : 'text-slate-400'
                          }
                        >
                          {r.qualification_reason}
                        </span>
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
