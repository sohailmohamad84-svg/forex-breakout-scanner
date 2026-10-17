import { NextRequest, NextResponse } from 'next/server';
import { fetchLiveCandles, getFormattedProviderName } from '@/lib/marketData';
import { calculateBreakoutProbability } from '@/lib/indicator';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const rawSymbol = decodeURIComponent(params.symbol);
  const searchParams = req.nextUrl.searchParams;
  const timeframe = searchParams.get('timeframe') || '1h';
  const count = parseInt(searchParams.get('count') || '100', 10);

  const candles = await fetchLiveCandles(rawSymbol, timeframe, count);

  let indResult = null;
  if (candles.length >= 10) {
    indResult = calculateBreakoutProbability(candles, 200, 0.002);
  }

  const latestPrice = candles.length > 0 ? candles[candles.length - 1].close : 1.0;
  const spread = rawSymbol.includes('JPY') ? 0.015 : 0.00015;

  return NextResponse.json({
    pair: rawSymbol,
    timeframe,
    provider: getFormattedProviderName(),
    quote: {
      bid: Number((latestPrice - spread / 2).toFixed(5)),
      ask: Number((latestPrice + spread / 2).toFixed(5)),
      mid: latestPrice,
      spread: Number((spread * (rawSymbol.includes('JPY') ? 100 : 10000)).toFixed(1)),
      timestamp: new Date().toISOString(),
    },
    candles: candles.map((c) => ({
      timestamp: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      is_closed: c.is_closed ?? true,
    })),
    indicator: indResult
      ? {
          bullish_probability: indResult.bullish_probability,
          bearish_probability: indResult.bearish_probability,
          winning_direction: indResult.winning_direction,
          winning_probability: indResult.winning_probability,
          first_level_high: indResult.first_level_high,
          first_level_low: indResult.first_level_low,
          current_price: indResult.current_price,
          candle_timestamp: indResult.candle_timestamp,
          upper_levels: indResult.upper_levels,
          lower_levels: indResult.lower_levels,
          methodology: indResult.methodology,
          disclaimer: indResult.disclaimer,
        }
      : {
          bullish_probability: 50,
          bearish_probability: 50,
          winning_direction: 'NEUTRAL',
          winning_probability: 50,
          first_level_high: latestPrice,
          first_level_low: latestPrice,
          current_price: latestPrice,
          candle_timestamp: new Date().toISOString(),
          upper_levels: [],
          lower_levels: [],
          methodology: 'Zeiierman Model',
          disclaimer: 'Insufficient data',
        },
  });
}
