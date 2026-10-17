export interface StepLevel {
  level: number;
  price: number;
  probability: number;
}

export interface SignalItem {
  id: number;
  pair: string;
  direction: 'BUY' | 'SELL';
  timeframe: string;
  bullish_probability: number;
  bearish_probability: number;
  winning_probability: number;
  threshold_used: number;
  signal_price: number;
  current_price?: number;
  breakout_level: number;
  take_profit?: number;
  stop_loss?: number;
  pnl_pips?: number;
  pnl_percent?: number;
  outcome?: 'IN_PROFIT' | 'IN_LOSS' | 'TARGET_HIT' | 'STOPPED_OUT' | 'ACTIVE';
  candle_timestamp: string;
  detected_at: string;
  qualification_reason: string;
  status: string;
  data_provider: string;
  strategy_version: string;
  upper_levels: StepLevel[];
  lower_levels: StepLevel[];
  subsequent_max_favorable: number;
  subsequent_max_adverse: number;
}


export interface ScannerStatus {
  is_running: boolean;
  last_scan_time: string | null;
  last_scan_duration_ms: number;
  total_pairs_enabled: number;
  pairs_scanned_count: number;
  qualified_buy_count: number;
  qualified_sell_count: number;
  no_signal_count: number;
  conflict_count: number;
  insufficient_data_count: number;
  data_provider: string;
  provider_healthy: boolean;
  provider_latency_ms: number;
  active_threshold: number;
  concurrency_limit: number;
}

export interface ScannerPairResult {
  pair: string;
  timeframe: string;
  latest_price: number;
  bullish_probability: number;
  bearish_probability: number;
  winning_probability: number;
  direction: 'BUY' | 'SELL' | 'CONFLICT' | 'NO_SIGNAL' | 'INSUFFICIENT_DATA';
  is_qualified: boolean;
  breakout_level: number;
  last_scan_time: string;
  candle_timestamp: string;
  data_status: 'OK' | 'STALE' | 'ERROR' | 'INSUFFICIENT_DATA';
  qualification_reason: string;
  upper_levels: StepLevel[];
  lower_levels: StepLevel[];
}

export interface PairItem {
  id: number;
  symbol: string;
  is_active: boolean;
  is_major: boolean;
  base_currency: string | null;
  quote_currency: string | null;
}

export interface SettingsData {
  active_provider: string;
  probability_threshold: number;
  lookback_candles: number;
  percentage_step: number;
  scan_interval_seconds: number;
  max_signal_age_minutes: number;
  enabled_timeframes: string[];
  timezone_display: string;
  telegram_enabled: boolean;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  twelve_data_api_key: string | null;
  oanda_api_key: string | null;
  oanda_account_id: string | null;
}

export interface CandleData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_closed: boolean;
}

export interface MarketCandlesResponse {
  pair: string;
  timeframe: string;
  provider: string;
  quote: {
    bid: number;
    ask: number;
    mid: number;
    spread: number;
    timestamp: string;
  } | null;
  candles: CandleData[];
  indicator: {
    bullish_probability: number;
    bearish_probability: number;
    winning_direction: string;
    winning_probability: number;
    first_level_high: number;
    first_level_low: number;
    current_price: number;
    candle_timestamp: string;
    upper_levels: StepLevel[];
    lower_levels: StepLevel[];
    methodology: string;
    disclaimer: string;
  };
}

export interface BacktestTradeItem {
  entry_time: string;
  exit_time: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  stop_loss: number;
  take_profit: number;
  pnl_pips: number;
  pnl_percent: number;
  is_win: boolean;
  exit_reason: string;
  duration_bars: number;
}

export interface BacktestResponse {
  pair: string;
  timeframe: string;
  start_date: string;
  end_date: string;
  total_candles_analyzed: number;
  total_signals_generated: number;
  total_trades_executed: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_percent: number;
  profit_factor: number;
  max_drawdown_percent: number;
  expectancy_pips: number;
  gross_pnl_pips: number;
  net_pnl_pips: number;
  average_trade_duration_bars: number;
  trades: BacktestTradeItem[];
  equity_curve: { time: string; equity: number; pnl: number }[];
  methodology_note: string;
}
// API Base URL resolution:
// 1. If NEXT_PUBLIC_API_URL is provided, use it directly (e.g. https://backend-production.up.railway.app)
// 2. In browser, fallback to '' so requests are relative (/api/...) and routed via Next.js rewrites
// 3. In Node server SSR, fallback to BACKEND_URL or http://localhost:8000
const getApiBase = (): string => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    return '';
  }
  return process.env.BACKEND_URL || 'http://localhost:8000';
};

const API_BASE = getApiBase();

export async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`API Error ${res.status}: ${errorBody || res.statusText}`);
  }

  return res.json();
}

export const api = {
  getHealth: () => fetchApi<{ status: string; timestamp: string; database_connected: boolean }>('/api/health'),
  getScannerStatus: () => fetchApi<ScannerStatus>('/api/scanner/status'),
  getScannerResults: () => fetchApi<{ timestamp: string; total_evaluated: number; results: ScannerPairResult[] }>('/api/scanner/results'),
  triggerScan: () => fetchApi<{ status: string; pairs_scanned: number; signals_detected: number; duration_ms: number }>('/api/scanner/trigger', { method: 'POST' }),
  getSignals: (params?: { direction?: string; timeframe?: string; pair?: string; min_prob?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.direction) q.set('direction', params.direction);
    if (params?.timeframe) q.set('timeframe', params.timeframe);
    if (params?.pair) q.set('pair', params.pair);
    if (params?.min_prob) q.set('min_probability', params.min_prob.toString());
    if (params?.status) q.set('status', params.status);
    return fetchApi<SignalItem[]>(`/api/signals?${q.toString()}`);
  },
  getSignal: (id: number) => fetchApi<SignalItem>(`/api/signals/${id}`),
  getPairs: () => fetchApi<PairItem[]>('/api/pairs'),
  togglePair: (symbol: string, is_active: boolean) =>
    fetchApi<{ status: string; symbol: string; is_active: boolean }>('/api/pairs/toggle', {
      method: 'POST',
      body: JSON.stringify({ symbol, is_active }),
    }),
  addPair: (symbol: string, is_major: boolean = false) =>
    fetchApi<PairItem>('/api/pairs', {
      method: 'POST',
      body: JSON.stringify({ symbol, is_major }),
    }),
  getSettings: () => fetchApi<SettingsData>('/api/settings'),
  updateSettings: (settings: SettingsData) =>
    fetchApi<SettingsData>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  getMarketCandles: (pair: string, timeframe: string = '1h', count: number = 100) => {
    // Encodes pair symbol like EUR/USD
    return fetchApi<MarketCandlesResponse>(`/api/market/candles/${encodeURIComponent(pair)}?timeframe=${timeframe}&count=${count}`);
  },
  runBacktest: (params: {
    pair: string;
    timeframe: string;
    probability_threshold: number;
    lookback_candles: number;
    percentage_step: number;
    risk_reward_ratio: number;
    spread_pips: number;
    slippage_pips: number;
    max_holding_bars: number;
  }) =>
    fetchApi<BacktestResponse>('/api/backtest/run', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  getBacktestResults: () => fetchApi<Record<string, unknown>[]>('/api/backtest/results'),
};

export function connectSSE(onEvent: (data: Record<string, unknown>) => void): () => void {
  const url = `${API_BASE}/api/scanner/events`;
  const es = new EventSource(url);

  es.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onEvent(parsed);
    } catch (e) {
      console.error('Error parsing SSE event data:', e);
    }
  };

  es.onerror = (err) => {
    console.warn('SSE connection warning/closed, will reconnect automatically:', err);
  };

  return () => {
    es.close();
  };
}
