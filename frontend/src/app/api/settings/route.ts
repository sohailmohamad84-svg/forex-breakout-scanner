import { NextResponse } from 'next/server';
import { getScannerConfig, updateScannerConfig } from '@/lib/scannerEngine';
import { SettingsData } from '@/lib/api';

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

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    settingsState = { ...settingsState, ...body };
    updateScannerConfig(
      body.probability_threshold,
      body.lookback_candles,
      body.percentage_step
    );
    return NextResponse.json(settingsState);
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 400 });
  }
}
