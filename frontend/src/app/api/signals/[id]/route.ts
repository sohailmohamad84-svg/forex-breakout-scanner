import { NextRequest, NextResponse } from 'next/server';
import { getOrRefreshScan } from '@/lib/scannerEngine';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { signals } = await getOrRefreshScan();
  const idNum = parseInt(params.id, 10);
  const sig = signals.find((s) => s.id === idNum);

  if (!sig) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
  }

  return NextResponse.json(sig);
}
