import { NextResponse } from 'next/server';
import { DEFAULT_PAIRS } from '@/lib/marketData';

export async function POST(req: Request) {
  try {
    const { symbol, is_active } = await req.json();
    const pair = DEFAULT_PAIRS.find((p) => p.symbol === symbol);
    if (pair) {
      pair.is_active = Boolean(is_active);
    }
    return NextResponse.json({
      status: 'ok',
      symbol,
      is_active: Boolean(is_active),
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
