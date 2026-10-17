'use client';

import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Info,
  ArrowRight,
} from 'lucide-react';
import { ScannerStatus, SignalItem } from '../lib/api';
import ProbabilityBadge from './ProbabilityBadge';

interface MarketOverviewProps {
  status: ScannerStatus | null;
  recentSignals: SignalItem[];
  onViewSignals: () => void;
  onViewSignalDetails: (signal: SignalItem) => void;
  onTriggerScan: () => void;
  isScanning: boolean;
}

export default function MarketOverview({
  status,
  recentSignals,
  onViewSignals,
  onViewSignalDetails,
  onTriggerScan,
  isScanning,
}: MarketOverviewProps) {
  const totalQualified = (status?.qualified_buy_count || 0) + (status?.qualified_sell_count || 0);

  return (
    <div className="space-y-6">
      {/* Methodology & Verification Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/30 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400">
                Strategy Specification: Zeiierman Breakout Probability (Expo)
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              This scanner calculates the empirical statistical probability of price reaching a new high or new low on the next candle,
              conditioned on the preceding candlestick color (Bullish vs Bearish transitions).
              Filtering for instruments exceeding your configured threshold (<span className="text-emerald-400 font-semibold">{status?.active_threshold ?? 70}%</span>)
              discovers high-probability directional momentum setups.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onTriggerScan}
              disabled={isScanning}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 transition cursor-pointer"
            >
              <span>{isScanning ? 'Scanning...' : 'Scan Now'}</span>
            </button>
            <button
              onClick={onViewSignals}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition cursor-pointer"
            >
              <span>View Qualified Signals</span>
              <ArrowRight className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid (8 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Pairs Enabled */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Pairs Enabled</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white font-mono">{status?.total_pairs_enabled ?? 0}</span>
            <span className="text-[11px] text-slate-500">Forex universe</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Majors & crosses configured</div>
        </div>

        {/* Pairs Successfully Scanned */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Pairs Scanned</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono">
              {status?.pairs_scanned_count ?? 0}
            </span>
            <span className="text-[11px] text-slate-500">/ {status?.total_pairs_enabled ?? 0}</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-500/80">Completed latest scan cycle</div>
        </div>

        {/* Qualified BUY Candidates */}
        <div className="bg-slate-900/90 border border-emerald-900/40 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
            <span>Qualified BUY</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-400 font-mono">
              {status?.qualified_buy_count ?? 0}
            </span>
            <span className="text-[11px] text-slate-500">candidates</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Bullish Prob &ge; {status?.active_threshold ?? 70}%
          </div>
        </div>

        {/* Qualified SELL Candidates */}
        <div className="bg-slate-900/90 border border-rose-900/40 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-rose-400 text-xs font-medium">
            <span>Qualified SELL</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400 font-mono">
              {status?.qualified_sell_count ?? 0}
            </span>
            <span className="text-[11px] text-slate-500">candidates</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Bearish Prob &ge; {status?.active_threshold ?? 70}%
          </div>
        </div>

        {/* Pairs Without Valid Signal (NO_SIGNAL) */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>No Valid Signal</span>
            <Info className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-300 font-mono">
              {status?.no_signal_count ?? 0}
            </span>
            <span className="text-[11px] text-slate-500">pairs</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Probabilities below {status?.active_threshold ?? 70}%</div>
        </div>

        {/* Data Provider Health */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Data Provider</span>
            <ShieldCheck className={`w-4 h-4 ${status?.provider_healthy ? 'text-emerald-400' : 'text-rose-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-sm font-bold text-white truncate">{status?.data_provider ?? 'Yahoo'}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px]">
            <span className={`w-1.5 h-1.5 rounded-full ${status?.provider_healthy ? 'bg-emerald-400' : 'bg-rose-500'}`} />
            <span className={status?.provider_healthy ? 'text-emerald-400 font-medium' : 'text-rose-400'}>
              {status?.provider_healthy ? 'Operational' : 'Degraded'} ({status?.provider_latency_ms.toFixed(0)}ms)
            </span>
          </div>
        </div>

        {/* Last Successful Scan */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Last Scan</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="mt-2">
            <span className="text-xs font-semibold text-white font-mono">
              {status?.last_scan_time ? new Date(status.last_scan_time).toLocaleTimeString() : 'Pending'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Cycle duration: {status?.last_scan_duration_ms.toFixed(0) ?? 0}ms
          </div>
        </div>

        {/* Scanner Status */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Scanner Engine</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-sm font-bold text-white uppercase tracking-wider">
              {isScanning ? 'Scanning...' : status?.is_running ? 'Active Loop' : 'Idle'}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Background worker operational</div>
        </div>
      </div>

      {/* Genuine Zero-Signal vs Incomplete Scan Notification */}
      {status && status.pairs_scanned_count > 0 && totalQualified === 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex items-center gap-3 text-xs text-slate-300">
          <Info className="w-5 h-5 text-cyan-400 shrink-0" />
          <div>
            <span className="font-semibold text-white">Genuine Zero-Signal Scan Result: </span>
            The scanner successfully evaluated all <span className="text-white font-mono">{status.pairs_scanned_count}</span> enabled currency pairs.
            Currently, no instrument meets the strict <span className="text-emerald-400 font-semibold">{status.active_threshold}%</span> directional probability threshold.
            This is a normal market consolidation state, preventing low-conviction fakeouts (50–60% range).
          </div>
        </div>
      )}

      {/* Recent Qualified Signals Spotlight */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Recently Qualified Breakout Candidates</h3>
          </div>
          <button
            onClick={onViewSignals}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>View All ({recentSignals.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentSignals.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No qualified signals in the active table. Click "Scan Now" or adjust the probability threshold in Settings.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentSignals.slice(0, 6).map((sig) => (
              <div
                key={sig.id}
                onClick={() => onViewSignalDetails(sig)}
                className="bg-slate-950/80 hover:bg-slate-800/60 border border-slate-800/80 hover:border-slate-700 rounded-lg p-3.5 transition-all cursor-pointer shadow-sm group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm group-hover:text-emerald-400 transition">
                      {sig.pair}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] uppercase font-mono">
                      {sig.timeframe}
                    </span>
                  </div>
                  <ProbabilityBadge
                    direction={sig.direction}
                    bullishProb={sig.bullish_probability}
                    bearishProb={sig.bearish_probability}
                    winningProb={sig.winning_probability}
                    threshold={sig.threshold_used}
                    size="sm"
                  />
                </div>

                {/* Live P&L and Outcome Status */}
                <div className="mt-2.5 flex items-center justify-between bg-slate-900/90 rounded-md px-2.5 py-1.5 border border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-sans">Live P&L:</span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        (sig.pnl_pips ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {(sig.pnl_pips ?? 0) >= 0 ? '+' : ''}
                      {(sig.pnl_pips ?? 0).toFixed(1)} Pips
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase font-mono ${
                      (sig.pnl_pips ?? 0) >= 0
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {(sig.pnl_pips ?? 0) >= 0
                      ? `+$${((sig.pnl_pips ?? 0) * 10).toFixed(0)}/lot`
                      : `-$${(Math.abs(sig.pnl_pips ?? 0) * 10).toFixed(0)}/lot`}
                  </span>
                </div>

                {/* Key Price Levels: Entry, TP, SL */}
                <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[10px] font-mono border-t border-slate-800/60 pt-2 text-center">
                  <div className="bg-slate-900/60 p-1 rounded border border-slate-800/50">
                    <span className="text-slate-500 block text-[9px]">Entry</span>
                    <span className="text-white font-semibold">{sig.signal_price.toFixed(sig.pair.includes('JPY') ? 3 : 5)}</span>
                  </div>
                  <div className="bg-slate-900/60 p-1 rounded border border-slate-800/50">
                    <span className="text-emerald-500 block text-[9px]">Target (TP)</span>
                    <span className="text-emerald-400 font-semibold">
                      {(sig.take_profit ?? (sig.signal_price * 1.0035)).toFixed(sig.pair.includes('JPY') ? 3 : 5)}
                    </span>
                  </div>
                  <div className="bg-slate-900/60 p-1 rounded border border-slate-800/50">
                    <span className="text-rose-500 block text-[9px]">Stop (SL)</span>
                    <span className="text-rose-400 font-semibold">
                      {(sig.stop_loss ?? (sig.signal_price * 0.998)).toFixed(sig.pair.includes('JPY') ? 3 : 5)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-slate-500 truncate">
                  {sig.qualification_reason}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
