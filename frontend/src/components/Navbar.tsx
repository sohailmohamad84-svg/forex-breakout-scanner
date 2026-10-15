'use client';

import React from 'react';
import {
  Activity,
  Table,
  History,
  Settings as SettingsIcon,
  RefreshCw,
  Cpu,
  TrendingUp,
} from 'lucide-react';
import { ScannerStatus } from '../lib/api';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  status: ScannerStatus | null;
  onTriggerScan: () => void;
  isScanning: boolean;
}

export default function Navbar({
  activeTab,
  setActiveTab,
  status,
  onTriggerScan,
  isScanning,
}: NavbarProps) {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity, count: null },
    {
      id: 'qualified',
      label: 'Qualified Signals',
      icon: TrendingUp,
      count: (status?.qualified_buy_count || 0) + (status?.qualified_sell_count || 0),
    },
    { id: 'all_pairs', label: 'All-Pairs Matrix', icon: Table, count: status?.pairs_scanned_count || null },
    { id: 'history', label: 'Historical Signals', icon: History, count: null },
    { id: 'backtest', label: 'Backtest Lab', icon: Cpu, count: null },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, count: null },
  ];

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/90 backdrop-blur-md border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-950/50">
              <Activity className="w-5 h-5 text-white stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">Forex Breakout Scanner</span>
                <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/40">
                  Zeiierman Expo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Conditional Empirical Probability Discovery Engine
              </p>
            </div>
          </div>

          {/* Right action area */}
          <div className="flex items-center gap-3">
            {/* Provider status badge */}
            {status && (
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${
                    status.provider_healthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="text-slate-300 font-medium">{status.data_provider}</span>
                <span className="text-slate-500 text-[11px]">({status.provider_latency_ms.toFixed(0)}ms)</span>
              </div>
            )}

            {/* Manual scan trigger button */}
            <button
              onClick={onTriggerScan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-emerald-950/60 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Now'}</span>
            </button>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="flex space-x-1 overflow-x-auto py-1 scrollbar-none border-t border-slate-900/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.count !== null && tab.count > 0 && (
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-200'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
