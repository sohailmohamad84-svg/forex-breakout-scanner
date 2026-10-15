'use client';

import React, { useRef, useEffect, useState } from 'react';
import { CandleData, StepLevel } from '../lib/api';

interface CandlestickChartProps {
  candles: CandleData[];
  firstLevelHigh?: number;
  firstLevelLow?: number;
  bullishProb?: number;
  bearishProb?: number;
  upperLevels?: StepLevel[];
  lowerLevels?: StepLevel[];
  currentPrice?: number;
  pair: string;
  timeframe: string;
}

export default function CandlestickChart({
  candles,
  firstLevelHigh,
  firstLevelLow,
  bullishProb,
  bearishProb,
  upperLevels = [],
  lowerLevels = [],
  currentPrice,
  pair,
  timeframe,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredCandle, setHoveredCandle] = useState<CandleData | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height || 420;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    // Padding
    const padTop = 30;
    const padBottom = 35;
    const padRight = 75; // Price scale
    const chartW = width - padRight;
    const chartH = height - padTop - padBottom;

    // Calculate price extremes across candles + levels
    let minP = Math.min(...candles.map((c) => c.low));
    let maxP = Math.max(...candles.map((c) => c.high));

    if (firstLevelHigh) maxP = Math.max(maxP, firstLevelHigh);
    if (firstLevelLow) minP = Math.min(minP, firstLevelLow);
    upperLevels.forEach((l) => (maxP = Math.max(maxP, l.price)));
    lowerLevels.forEach((l) => (minP = Math.min(minP, l.price)));

    const pRange = maxP - minP || 0.001;
    minP -= pRange * 0.05;
    maxP += pRange * 0.05;
    const effectiveRange = maxP - minP;

    const getY = (price: number) => padTop + chartH - ((price - minP) / effectiveRange) * chartH;

    // Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Grid lines (horizontal prices)
    const priceSteps = 6;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';
    ctx.fillStyle = '#64748b';

    for (let i = 0; i <= priceSteps; i++) {
      const p = minP + (effectiveRange / priceSteps) * i;
      const y = getY(p);

      ctx.beginPath();
      ctx.setLineDash([2, 4]);
      ctx.moveTo(0, y);
      ctx.lineTo(chartW, y);
      ctx.stroke();

      // Price label on right axis
      ctx.fillText(p.toFixed(pair.includes('JPY') ? 3 : 5), chartW + 8, y + 3);
    }
    ctx.setLineDash([]);

    // Candle bar width
    const n = candles.length;
    const barSpacing = chartW / n;
    const barWidth = Math.max(2, barSpacing * 0.7);

    // Draw candles
    candles.forEach((c, i) => {
      const x = i * barSpacing + barSpacing / 2;
      const isGreen = c.close >= c.open;
      const candleColor = isGreen ? '#10b981' : '#f43f5e';
      const wickColor = isGreen ? '#34d399' : '#fb7185';

      // Wick
      ctx.strokeStyle = wickColor;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, getY(c.high));
      ctx.lineTo(x, getY(c.low));
      ctx.stroke();

      // Body
      const top = getY(Math.max(c.open, c.close));
      const bot = getY(Math.min(c.open, c.close));
      const bodyH = Math.max(1.5, bot - top);

      ctx.fillStyle = candleColor;
      ctx.fillRect(x - barWidth / 2, top, barWidth, bodyH);
    });

    // Draw Breakout Levels Overlay
    // First Level High (Bullish breakout level)
    if (firstLevelHigh) {
      const yHigh = getY(firstLevelHigh);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(0, yHigh);
      ctx.lineTo(chartW, yHigh);
      ctx.stroke();

      // Badge label
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 10px sans-serif';
      const label = `BUY Trigger: ${firstLevelHigh.toFixed(pair.includes('JPY') ? 3 : 5)} (${bullishProb?.toFixed(1) ?? '0.0'}%)`;
      ctx.fillText(label, 10, yHigh - 5);
    }

    // First Level Low (Bearish breakout level)
    if (firstLevelLow) {
      const yLow = getY(firstLevelLow);
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(0, yLow);
      ctx.lineTo(chartW, yLow);
      ctx.stroke();

      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 10px sans-serif';
      const label = `SELL Trigger: ${firstLevelLow.toFixed(pair.includes('JPY') ? 3 : 5)} (${bearishProb?.toFixed(1) ?? '0.0'}%)`;
      ctx.fillText(label, 10, yLow + 14);
    }

    // Upper step levels
    upperLevels.forEach((lvl) => {
      const y = getY(lvl.price);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartW, y);
      ctx.stroke();

      ctx.fillStyle = '#06b6d4';
      ctx.font = '9px monospace';
      ctx.fillText(`+L${lvl.level} (${lvl.probability.toFixed(0)}%)`, chartW - 70, y - 3);
    });

    // Lower step levels
    lowerLevels.forEach((lvl) => {
      const y = getY(lvl.price);
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartW, y);
      ctx.stroke();

      ctx.fillStyle = '#f97316';
      ctx.font = '9px monospace';
      ctx.fillText(`-L${lvl.level} (${lvl.probability.toFixed(0)}%)`, chartW - 70, y + 10);
    });

    // Current market price line
    const curP = currentPrice || candles[candles.length - 1]?.close;
    if (curP) {
      const yCur = getY(curP);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([1, 2]);
      ctx.beginPath();
      ctx.moveTo(0, yCur);
      ctx.lineTo(chartW, yCur);
      ctx.stroke();

      // Pill tag on price axis
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(chartW + 2, yCur - 8, padRight - 4, 16);
      ctx.fillStyle = '#090d16';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(curP.toFixed(pair.includes('JPY') ? 3 : 5), chartW + 6, yCur + 4);
    }
    ctx.setLineDash([]);

    // Crosshair hover lines
    if (mousePos && mousePos.x <= chartW) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(mousePos.x, padTop);
      ctx.lineTo(mousePos.x, padTop + chartH);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, mousePos.y);
      ctx.lineTo(chartW, mousePos.y);
      ctx.stroke();

      ctx.setLineDash([]);
    }
  }, [candles, firstLevelHigh, firstLevelLow, bullishProb, bearishProb, upperLevels, lowerLevels, currentPrice, pair, mousePos]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || candles.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    const chartW = rect.width - 75;
    const barSpacing = chartW / candles.length;
    const index = Math.floor(x / barSpacing);
    if (index >= 0 && index < candles.length) {
      setHoveredCandle(candles[index]);
    } else {
      setHoveredCandle(null);
    }
  };

  const handleMouseLeave = () => {
    setMousePos(null);
    setHoveredCandle(null);
  };

  const activeCandle = hoveredCandle || candles[candles.length - 1];

  return (
    <div className="flex flex-col w-full bg-slate-950 border border-slate-800 rounded-lg overflow-hidden shadow-xl">
      {/* Chart Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <span className="font-bold text-white text-sm">{pair}</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px] uppercase">
            {timeframe}
          </span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          {activeCandle && (
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span>O: <span className="text-white">{activeCandle.open.toFixed(pair.includes('JPY') ? 3 : 5)}</span></span>
              <span>H: <span className="text-emerald-400">{activeCandle.high.toFixed(pair.includes('JPY') ? 3 : 5)}</span></span>
              <span>L: <span className="text-rose-400">{activeCandle.low.toFixed(pair.includes('JPY') ? 3 : 5)}</span></span>
              <span>C: <span className={activeCandle.close >= activeCandle.open ? 'text-emerald-400' : 'text-rose-400'}>
                {activeCandle.close.toFixed(pair.includes('JPY') ? 3 : 5)}
              </span></span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] mt-1 sm:mt-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-500 rounded"></span>
            <span className="text-emerald-400">Bullish Trigger ({bullishProb?.toFixed(1) || '0'}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-rose-500 rounded"></span>
            <span className="text-rose-400">Bearish Trigger ({bearishProb?.toFixed(1) || '0'}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-amber-400 rounded"></span>
            <span className="text-amber-400">Market Price</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="relative w-full h-[400px] cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="w-full h-full block"
        />
      </div>
    </div>
  );
}
