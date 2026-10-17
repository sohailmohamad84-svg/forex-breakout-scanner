import { NextResponse } from 'next/server';
import { getScannerStatusData } from '@/lib/scannerEngine';
export const dynamic = 'force-dynamic';

export async function GET() {

  return NextResponse.json(getScannerStatusData());
}
