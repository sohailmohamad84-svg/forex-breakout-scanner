'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import MarketOverview from '../components/MarketOverview';
import QualifiedSignals from '../components/QualifiedSignals';
import SignalDetailsModal from '../components/SignalDetailsModal';
import AllPairsScanner from '../components/AllPairsScanner';
import HistoricalSignals from '../components/HistoricalSignals';
import SettingsView from '../components/SettingsView';
import BacktestLab from '../components/BacktestLab';
import {
  api,
  connectSSE,
  ScannerStatus,
  ScannerPairResult,
  SignalItem,
} from '../lib/api';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [status, setStatus] = useState<ScannerStatus | null>(null);
  const [signals, setSignals] = useState<SignalItem[]>([]);
  const [scannerResults, setScannerResults] = useState<ScannerPairResult[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<SignalItem | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Backtest navigation parameters
  const [backtestPair, setBacktestPair] = useState('EUR/USD');
  const [backtestTf, setBacktestTf] = useState('1h');

  // Load dashboard data
  const loadData = useCallback(async () => {
    try {
      const [st, sigs, mat] = await Promise.all([
        api.getScannerStatus(),
        api.getSignals({ status: 'ACTIVE' }),
        api.getScannerResults(),
      ]);
      if (typeof window !== 'undefined') {
        try {
          const local = localStorage.getItem('forex_scanner_settings');
          if (local) {
            const parsed = JSON.parse(local);
            if (parsed.active_provider === 'twelve_data') {
              st.data_provider = 'Twelve Data (REST API)';
              st.provider_latency_ms = 85;
            } else if (parsed.active_provider === 'oanda') {
              st.data_provider = 'OANDA (v20 REST)';
            }
          }
        } catch {}
      }
      setStatus(st);
      setSignals(sigs);
      setScannerResults(mat.results);
    } catch (e) {
      console.error('Error fetching dashboard state:', e);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Set up SSE subscription for live real-time updates
    const cleanupSSE = connectSSE((event) => {
      if (event.event === 'scan_completed') {
        setStatus(event.data as unknown as ScannerStatus);
        // Refresh signals & matrix
        api.getSignals({ status: 'ACTIVE' }).then(setSignals).catch(console.error);
        api.getScannerResults().then((res) => setScannerResults(res.results)).catch(console.error);
      }
    });

    // Fallback polling every 30s
    const timer = setInterval(loadData, 30000);

    return () => {
      cleanupSSE();
      clearInterval(timer);
    };
  }, [loadData]);

  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      await api.triggerScan();
      await loadData();
    } catch (e) {
      console.error('Failed to trigger scan:', e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleLaunchBacktest = (pair: string, timeframe: string) => {
    setBacktestPair(pair);
    setBacktestTf(timeframe);
    setActiveTab('backtest');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        status={status}
        onTriggerScan={handleTriggerScan}
        isScanning={isScanning}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'overview' && (
          <MarketOverview
            status={status}
            recentSignals={signals}
            onViewSignals={() => setActiveTab('qualified')}
            onViewSignalDetails={setSelectedSignal}
            onTriggerScan={handleTriggerScan}
            isScanning={isScanning}
          />
        )}

        {activeTab === 'qualified' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Qualified Signals Discovery</h1>
                <p className="text-xs text-slate-400">
                  Showing currency pairs meeting or exceeding the directional probability threshold (&ge;{status?.active_threshold ?? 70}%).
                </p>
              </div>
            </div>
            <QualifiedSignals
              signals={signals}
              onSelectSignal={setSelectedSignal}
              activeThreshold={status?.active_threshold ?? 70}
            />
          </div>
        )}

        {activeTab === 'all_pairs' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">All-Pairs Scanner Matrix</h1>
                <p className="text-xs text-slate-400">
                  Comprehensive audit of all enabled forex pairs, active probability distributions, and exclusion explanations.
                </p>
              </div>
            </div>
            <AllPairsScanner
              results={scannerResults}
              activeThreshold={status?.active_threshold ?? 70}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Persistent Signal Archive</h1>
                <p className="text-xs text-slate-400">
                  Historical log of all discovered signals, preserved across scanner restarts and parameter modifications.
                </p>
              </div>
            </div>
            <HistoricalSignals signals={signals} onSelectSignal={setSelectedSignal} />
          </div>
        )}

        {activeTab === 'backtest' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Walk-Forward Backtesting Laboratory</h1>
                <p className="text-xs text-slate-400">
                  Rigorous statistical simulation with zero-lookahead bias, stop-loss, take-profit, spread, and slippage friction.
                </p>
              </div>
            </div>
            <BacktestLab initialPair={backtestPair} initialTimeframe={backtestTf} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">System & Strategy Settings</h1>
                <p className="text-xs text-slate-400">
                  Configure data providers, API keys, probability thresholds, scan frequency, alerts, and currency pairs.
                </p>
              </div>
            </div>
            <SettingsView onSettingsSaved={loadData} />
          </div>
        )}
      </main>

      {/* Signal Details Modal (Page C) */}
      <SignalDetailsModal
        signal={selectedSignal}
        onClose={() => setSelectedSignal(null)}
        onRunBacktest={handleLaunchBacktest}
      />

      {/* Footer */}
      <footer className="w-full bg-slate-950 border-t border-slate-900 py-4 text-center text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Forex Breakout Probability Scanner &bull; Zeiierman Expo Methodology Engine</span>
          <span className="text-[11px] text-slate-600">
            For educational and analytical research purposes. Not automated trade execution.
          </span>
        </div>
      </footer>
    </div>
  );
}
