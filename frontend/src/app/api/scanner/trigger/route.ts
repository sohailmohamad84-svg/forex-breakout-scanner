import { NextResponse } from 'next/server';
import { runFullScan } from '@/lib/scannerEngine';

export async function POST() {
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
