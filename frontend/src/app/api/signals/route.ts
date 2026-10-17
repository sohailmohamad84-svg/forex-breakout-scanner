import { NextRequest, NextResponse } from 'next/server';
import { getAllSignalsWithHistory, getOrRefreshScan } from '@/lib/scannerEngine';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {

  const searchParams = req.nextUrl.searchParams;
  const direction = searchParams.get('direction');
  const timeframe = searchParams.get('timeframe');
  const pair = searchParams.get('pair');
  const minProb = parseFloat(searchParams.get('min_probability') || '0');
  const status = searchParams.get('status');

  // If status is strictly ACTIVE, return only live signals.
  // Otherwise, return all signals including historical records.
  let allSignals = [];
  if (status === 'ACTIVE') {
    const { signals } = await getOrRefreshScan();
    allSignals = signals;
  } else {
    allSignals = await getAllSignalsWithHistory();
  }

  let filtered = [...allSignals];

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
