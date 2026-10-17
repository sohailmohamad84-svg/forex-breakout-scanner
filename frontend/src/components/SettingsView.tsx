'use client';

import React, { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle,
  AlertTriangle,
  Plus,
  Sliders,
  Database,
  Layers,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { SettingsData, PairItem, api } from '../lib/api';

interface SettingsViewProps {
  onSettingsSaved: () => void;
}

export default function SettingsView({ onSettingsSaved }: SettingsViewProps) {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [pairs, setPairs] = useState<PairItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New pair form state
  const [newSymbol, setNewSymbol] = useState('');
  const [isMajor, setIsMajor] = useState(false);
  const [addPairMsg, setAddPairMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([api.getSettings(), api.getPairs()]);
      let mergedSettings = s;
      if (typeof window !== 'undefined') {
        try {
          const local = localStorage.getItem('forex_scanner_settings');
          if (local) {
            const parsed = JSON.parse(local);
            mergedSettings = { ...s, ...parsed };
          }
        } catch {}
      }
      setSettings(mergedSettings);
      setPairs(p);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    // Validate
    if (settings.probability_threshold < 50 || settings.probability_threshold > 95) {
      setErrorMsg('Probability threshold must be between 50% and 95%');
      return;
    }
    if (settings.lookback_candles < 30 || settings.lookback_candles > 1000) {
      setErrorMsg('Lookback candles must be between 30 and 1000');
      return;
    }
    if (settings.scan_interval_seconds < 10 || settings.scan_interval_seconds > 3600) {
      setErrorMsg('Scan interval must be between 10 and 3600 seconds');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('forex_scanner_settings', JSON.stringify(settings));
        document.cookie = `scanner_provider=${settings.active_provider}; path=/; max-age=31536000; SameSite=Lax`;
        if (settings.twelve_data_api_key) {
          document.cookie = `scanner_twelve_key=${encodeURIComponent(settings.twelve_data_api_key)}; path=/; max-age=31536000; SameSite=Lax`;
        }
      }

      await api.updateSettings(settings);
      setSuccessMsg('Settings successfully updated and applied to scanning worker!');
      onSettingsSaved();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePair = async (symbol: string, currentActive: boolean) => {
    try {
      await api.togglePair(symbol, !currentActive);
      setPairs((prev) =>
        prev.map((p) => (p.symbol === symbol ? { ...p, is_active: !currentActive } : p))
      );
    } catch (e: any) {
      setErrorMsg(`Failed to toggle ${symbol}: ${e.message}`);
    }
  };

  const handleAddPair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;

    try {
      const added = await api.addPair(newSymbol.trim(), isMajor);
      setPairs((prev) => [...prev, added]);
      setNewSymbol('');
      setAddPairMsg(`Pair ${added.symbol} successfully added!`);
      setTimeout(() => setAddPairMsg(null), 3000);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to add pair');
    }
  };

  if (loading || !settings) {
    return (
      <div className="py-20 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
        <span>Loading settings...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-5xl">
      {/* Toast Messages */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-600/40 text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-600/40 text-rose-400 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Section 1: Market Data Provider */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Database className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Market Data Architecture</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Active Data Provider</label>
            <select
              value={settings.active_provider}
              onChange={(e) => setSettings({ ...settings, active_provider: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="yahoo">Yahoo Finance (Free Real-time Live Quotes & Candles)</option>
              <option value="twelve_data">Twelve Data (REST API - requires API key)</option>
              <option value="oanda">OANDA v20 (REST API - requires API key)</option>
              <option value="mock">Mock Provider (Deterministic Geometric Brownian Motion Simulator)</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Yahoo Finance provides out-of-the-box live forex data without requiring API keys.
            </p>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Twelve Data API Key</label>
            <input
              type="password"
              placeholder="Enter Twelve Data API key..."
              value={settings.twelve_data_api_key || ''}
              onChange={(e) => setSettings({ ...settings, twelve_data_api_key: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">OANDA v20 API Key</label>
            <input
              type="password"
              placeholder="Enter OANDA API key..."
              value={settings.oanda_api_key || ''}
              onChange={(e) => setSettings({ ...settings, oanda_api_key: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">OANDA Account ID</label>
            <input
              type="text"
              placeholder="e.g. 001-004-1234567-001"
              value={settings.oanda_account_id || ''}
              onChange={(e) => setSettings({ ...settings, oanda_account_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Strategy Qualification Rules */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">Breakout Probability Strategy Parameters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* Probability Threshold */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-slate-300 font-medium">Probability Threshold</label>
              <span className="text-emerald-400 font-mono font-bold">{settings.probability_threshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="1"
              value={settings.probability_threshold}
              onChange={(e) => setSettings({ ...settings, probability_threshold: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1">Default 70%. Prevents entering 50-60% noise signals.</p>
          </div>

          {/* Lookback Candles */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Historical Lookback (Candles)</label>
            <input
              type="number"
              min="50"
              max="1000"
              value={settings.lookback_candles}
              onChange={(e) => setSettings({ ...settings, lookback_candles: parseInt(e.target.value) || 200 })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">Number of completed bars in conditional sample.</p>
          </div>

          {/* Percentage Step */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Percentage Step Level (Step %)</label>
            <input
              type="number"
              step="0.0005"
              min="0.0005"
              max="0.05"
              value={settings.percentage_step}
              onChange={(e) => setSettings({ ...settings, percentage_step: parseFloat(e.target.value) || 0.002 })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">0.002 = 0.2% spacing for projected levels 1..4.</p>
          </div>

          {/* Scan Frequency */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Scan Interval (Seconds)</label>
            <input
              type="number"
              min="10"
              max="3600"
              value={settings.scan_interval_seconds}
              onChange={(e) => setSettings({ ...settings, scan_interval_seconds: parseInt(e.target.value) || 60 })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">Background polling cycle frequency.</p>
          </div>

          {/* Max Signal Age */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Max Signal Age (Minutes)</label>
            <input
              type="number"
              min="5"
              max="1440"
              value={settings.max_signal_age_minutes}
              onChange={(e) => setSettings({ ...settings, max_signal_age_minutes: parseInt(e.target.value) || 180 })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">Signals older than this are flagged STALE.</p>
          </div>

          {/* Timezone Display */}
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Display Timezone</label>
            <select
              value={settings.timezone_display}
              onChange={(e) => setSettings({ ...settings, timezone_display: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500"
            >
              <option value="UTC">UTC (Universal Coordinated Time)</option>
              <option value="America/New_York">New York (EST/EDT)</option>
              <option value="Europe/London">London (GMT/BST)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
            </select>
          </div>
        </div>

        {/* Timeframe Checkboxes */}
        <div className="pt-2">
          <label className="block text-slate-300 font-medium text-xs mb-2">Evaluated Timeframes</label>
          <div className="flex flex-wrap gap-2">
            {['5m', '15m', '30m', '1h', '4h', '1d'].map((tf) => {
              const checked = settings.enabled_timeframes.includes(tf);
              return (
                <label
                  key={tf}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono uppercase cursor-pointer transition select-none ${
                    checked
                      ? 'bg-emerald-950/80 border-emerald-600/50 text-emerald-400 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...settings.enabled_timeframes, tf]
                        : settings.enabled_timeframes.filter((x) => x !== tf);
                      setSettings({ ...settings, enabled_timeframes: next });
                    }}
                    className="hidden"
                  />
                  <span>{tf}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section 3: Telegram Alerts */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">Telegram Alerts</h3>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.telegram_enabled}
              onChange={(e) => setSettings({ ...settings, telegram_enabled: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            <span className="ml-2 text-xs font-medium text-slate-300">
              {settings.telegram_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Telegram Bot Token</label>
            <input
              type="password"
              placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
              value={settings.telegram_bot_token || ''}
              onChange={(e) => setSettings({ ...settings, telegram_bot_token: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">Obtain from @BotFather on Telegram.</p>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1.5">Telegram Chat / Channel ID</label>
            <input
              type="text"
              placeholder="e.g. 987654321 or @yourforexchannel"
              value={settings.telegram_chat_id || ''}
              onChange={(e) => setSettings({ ...settings, telegram_chat_id: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">Your numeric user ID or public channel username.</p>
          </div>
        </div>
      </div>

      {/* Section 4: Forex Pairs Universe Manager */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Forex Universe ({pairs.length} pairs configured)</h3>
          </div>
        </div>

        {/* Add custom pair */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 text-xs space-y-2">
          <div className="font-semibold text-slate-300">Add Provider-Supported Currency Pair</div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="e.g. USD/ZAR or EUR/SEK"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono uppercase text-xs focus:outline-none focus:border-emerald-500"
            />
            <label className="flex items-center gap-1.5 text-slate-300 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={isMajor}
                onChange={(e) => setIsMajor(e.target.checked)}
                className="rounded border-slate-700 text-emerald-500 focus:ring-0"
              />
              <span>Major Pair</span>
            </label>
            <button
              type="button"
              onClick={handleAddPair}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Pair</span>
            </button>
            {addPairMsg && <span className="text-emerald-400 text-xs">{addPairMsg}</span>}
          </div>
        </div>

        {/* Pair toggle chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 pt-2">
          {pairs.map((p) => (
            <button
              type="button"
              key={p.symbol}
              onClick={() => handleTogglePair(p.symbol, p.is_active)}
              className={`px-3 py-2 rounded-lg border text-xs font-mono font-semibold flex items-center justify-between transition cursor-pointer select-none ${
                p.is_active
                  ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              <span>{p.symbol}</span>
              <span className={`w-2 h-2 rounded-full ${p.is_active ? 'bg-emerald-400' : 'bg-slate-700'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Save Button Bar */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs shadow-lg shadow-emerald-950/60 flex items-center gap-2 transition cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>
    </form>
  );
}
