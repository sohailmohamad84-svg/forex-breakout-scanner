import { NextResponse } from 'next/server';
import { getOrRefreshScan } from '@/lib/scannerEngine';

export async function GET() {
  const { results } = await getOrRefreshScan();
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    total_evaluated: results.length,
    results,
  });
}
