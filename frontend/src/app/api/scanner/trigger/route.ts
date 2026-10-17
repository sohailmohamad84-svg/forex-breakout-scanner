import { NextRequest, NextResponse } from 'next/server';
import { runFullScan } from '@/lib/scannerEngine';
import { setMarketDataProvider } from '@/lib/marketData';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const queryProvider = req.nextUrl.searchParams.get('provider');
  const headerProvider = req.headers.get('x-market-provider');
  const cookieProvider = req.cookies.get('scanner_provider')?.value;
  const cookieKey = req.cookies.get('scanner_twelve_key')?.value;

  const activeProvider = queryProvider || headerProvider || cookieProvider;
  if (activeProvider) {
    setMarketDataProvider(activeProvider, cookieKey ? decodeURIComponent(cookieKey) : undefined);
  }

  const start = Date.now();
  const { results, signals } = await runFullScan();
  const duration = Date.now() - start;

  return NextResponse.json({
    status: 'completed',
    pairs_scanned: results.length,
    signals_detected: signals.length,
    duration_ms: duration,
  });
}
