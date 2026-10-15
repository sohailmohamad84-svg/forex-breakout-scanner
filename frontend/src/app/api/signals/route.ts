import { NextRequest, NextResponse } from 'next/server';
import { getOrRefreshScan } from '@/lib/scannerEngine';

export async function GET(req: NextRequest) {
  const { signals } = await getOrRefreshScan();
  const searchParams = req.nextUrl.searchParams;
  const direction = searchParams.get('direction');
  const timeframe = searchParams.get('timeframe');
  const pair = searchParams.get('pair');
  const minProb = parseFloat(searchParams.get('min_probability') || '0');
  const status = searchParams.get('status');

  let filtered = [...signals];

  if (direction && direction !== 'ALL') {
    filtered = filtered.filter((s) => s.direction === direction);
  }
  if (timeframe && timeframe !== 'ALL') {
    filtered = filtered.filter((s) => s.timeframe === timeframe);
  }
  if (pair) {
    filtered = filtered.filter((s) => s.pair.toLowerCase().includes(pair.toLowerCase()));
  }
  if (minProb > 0) {
    filtered = filtered.filter((s) => s.winning_probability >= minProb);
  }
  if (status && status !== 'ALL') {
    filtered = filtered.filter((s) => s.status === status);
  }

  return NextResponse.json(filtered);
}
