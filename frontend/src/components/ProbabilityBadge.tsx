'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, AlertCircle, MinusCircle, HelpCircle } from 'lucide-react';

interface ProbabilityBadgeProps {
  direction: 'BUY' | 'SELL' | 'CONFLICT' | 'NO_SIGNAL' | 'INSUFFICIENT_DATA';
  bullishProb?: number;
  bearishProb?: number;
  winningProb?: number;
  threshold?: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function ProbabilityBadge({
  direction,
  bullishProb = 0,
  bearishProb = 0,
  winningProb,
  threshold = 70.0,
  size = 'md',
}: ProbabilityBadgeProps) {
  const displayProb = winningProb !== undefined ? winningProb : Math.max(bullishProb, bearishProb);

  const isBuy = direction === 'BUY';
  const isSell = direction === 'SELL';
  const isConflict = direction === 'CONFLICT';
  const isNoSignal = direction === 'NO_SIGNAL';
  const isInsufficient = direction === 'INSUFFICIENT_DATA';

  const badgeStyles = {
    BUY: 'bg-emerald-950/80 text-emerald-400 border-emerald-600/40 shadow-emerald-950/50',
    SELL: 'bg-rose-950/80 text-rose-400 border-rose-600/40 shadow-rose-950/50',
    CONFLICT: 'bg-amber-950/80 text-amber-400 border-amber-600/40 shadow-amber-950/50',
    NO_SIGNAL: 'bg-slate-900 text-slate-400 border-slate-700/60 shadow-slate-950/50',
    INSUFFICIENT_DATA: 'bg-zinc-900 text-zinc-400 border-zinc-700/60 shadow-zinc-950/50',
  }[direction];

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3.5 py-1.5 gap-2 font-semibold',
  }[size];

  return (
    <div className={`inline-flex items-center rounded-md border shadow-sm font-medium transition-all ${badgeStyles} ${sizeClasses}`}>
      {isBuy && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />}
      {isSell && <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 stroke-[2.5]" />}
      {isConflict && <AlertCircle className="w-3.5 h-3.5 text-amber-400" />}
      {isNoSignal && <MinusCircle className="w-3.5 h-3.5 text-slate-400" />}
      {isInsufficient && <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />}

      <span>
        {isBuy && `BUY ${displayProb.toFixed(1)}%`}
        {isSell && `SELL ${displayProb.toFixed(1)}%`}
        {isConflict && `CONFLICT`}
        {isNoSignal && `NO SIGNAL`}
        {isInsufficient && `INSUFFICIENT`}
      </span>

      {(isBuy || isSell) && (
        <span className="text-[10px] text-slate-400 ml-0.5 font-normal">
          (&ge;{threshold.toFixed(0)}%)
        </span>
      )}
    </div>
  );
}
