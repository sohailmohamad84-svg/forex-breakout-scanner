import { NextResponse } from 'next/server';
import { getScannerStatusData } from '@/lib/scannerEngine';

export async function GET() {
  return NextResponse.json(getScannerStatusData());
}
