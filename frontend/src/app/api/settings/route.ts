import { NextResponse } from 'next/server';
import { getScannerConfig, updateScannerConfig } from '@/lib/scannerEngine';
import { setMarketDataProvider } from '@/lib/marketData';
import { SettingsData } from '@/lib/api';

export const dynamic = 'force-dynamic';

let settingsState: SettingsData = {
  active_provider: 'yahoo',
  probability_threshold: 70.0,
  lookback_candles: 200,
  percentage_step: 0.002,
  scan_interval_seconds: 60,
  max_signal_age_minutes: 180,
  enabled_timeframes: ['5m', '15m', '30m', '1h', '4h', '1d'],
  timezone_display: 'UTC',
  telegram_enabled: false,
  telegram_bot_token: null,
  telegram_chat_id: null,
  twelve_data_api_key: null,
  oanda_api_key: null,
  oanda_account_id: null,
};

export async function GET() {
  const cfg = getScannerConfig();
  return NextResponse.json({
    ...settingsState,
    probability_threshold: cfg.threshold,
    lookback_candles: cfg.lookback,
    percentage_step: cfg.percentage_step,
  });
}

async function handleUpdate(req: Request) {
  try {
    const body = await req.json();
    settingsState = { ...settingsState, ...body };

    // Update scanner strategy parameters
    updateScannerConfig(
      body.probability_threshold,
      body.lookback_candles,
      body.percentage_step
    );

    // Update active market data provider and API key
    if (body.active_provider) {
      setMarketDataProvider(body.active_provider, body.twelve_data_api_key);
    }

    return NextResponse.json(settingsState);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update settings' }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  return handleUpdate(req);
}

export async function POST(req: Request) {
  return handleUpdate(req);
}
