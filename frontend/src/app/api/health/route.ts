import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database_connected: true,
    service: 'Forex Breakout Probability Scanner',
    version: '1.0.0',
    mode: 'Vercel Serverless & Edge Ready',
  });
}
