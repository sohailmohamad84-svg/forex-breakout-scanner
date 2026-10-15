import { NextResponse } from 'next/server';
import { DEFAULT_PAIRS, CurrencyPairInfo } from '@/lib/marketData';

// In-memory state for pairs
const pairsState: CurrencyPairInfo[] = [...DEFAULT_PAIRS];

export async function GET() {
  const result = pairsState.map((p, idx) => ({
    id: idx + 1,
    symbol: p.symbol,
    is_active: p.is_active,
    is_major: p.is_major,
    base_currency: p.base_currency,
    quote_currency: p.quote_currency,
  }));
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const symbol = body.symbol?.trim().toUpperCase();
    if (!symbol) {
      return NextResponse.json({ error: 'Symbol required' }, { status: 400 });
    }

    const existing = pairsState.find((p) => p.symbol === symbol);
    if (existing) {
      return NextResponse.json(existing);
    }

    const parts = symbol.split('/');
    const newPair: CurrencyPairInfo = {
      symbol,
      base_currency: parts[0] || '',
      quote_currency: parts[1] || '',
      is_major: body.is_major ?? false,
      is_active: true,
    };
    pairsState.push(newPair);

    return NextResponse.json({
      id: pairsState.length,
      ...newPair,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
