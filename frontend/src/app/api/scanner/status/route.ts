import { NextRequest, NextResponse } from 'next/server';
import { getScannerStatusData } from '@/lib/scannerEngine';
import { setMarketDataProvider, getFormattedProviderName } from '@/lib/marketData';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const queryProvider = req.nextUrl.searchParams.get('provider');
  const headerProvider = req.headers.get('x-market-provider');
  const cookieProvider = req.cookies.get('scanner_provider')?.value;
  const cookieKey = req.cookies.get('scanner_twelve_key')?.value;

  const activeProvider = queryProvider || headerProvider || cookieProvider;
  if (activeProvider) {
    setMarketDataProvider(activeProvider, cookieKey ? decodeURIComponent(cookieKey) : undefined);
  }

  const formattedName = getFormattedProviderName(activeProvider || undefined);
  return NextResponse.json(getScannerStatusData(formattedName));
}
