export interface Candle {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_closed?: boolean;
}

export interface StepLevel {
  level: number;
  price: number;
  probability: number;
}

export interface BreakoutProbabilityResult {
  bullish_probability: number;
  bearish_probability: number;
  winning_direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  winning_probability: number;
  first_level_high: number;
  first_level_low: number;
  current_price: number;
  candle_timestamp: string;
  upper_levels: StepLevel[];
  lower_levels: StepLevel[];
  prior_candle_direction: string;
  total_bars_sample: number;
  condition_matches_count: number;
  lookback_used: number;
  percentage_step_used: number;
  methodology: string;
  is_verified_methodology: boolean;
  disclaimer: string;
}

export function calculateBreakoutProbability(
  candles: Candle[],
  lookback: number = 200,
  percentageStep: number = 0.002,
  numLevels: number = 4,
  minConditionSamples: number = 10
): BreakoutProbabilityResult {
  if (candles.length < 2) {
    throw new Error(`Need at least 2 candles for breakout calculation, got ${candles.length}`);
  }

  const effectiveLookback = Math.min(candles.length - 1, lookback);
  const sample = candles.slice(-(effectiveLookback + 1));
  const lastCompleted = sample[sample.length - 1];

  let priorCond = 'NEUTRAL';
  if (lastCompleted.close > lastCompleted.open) {
    priorCond = 'BULLISH';
  } else if (lastCompleted.close < lastCompleted.open) {
    priorCond = 'BEARISH';
  }

  let matchingCount = 0;
  let newHighHits = 0;
  let newLowHits = 0;
  const upperHits = new Array(numLevels).fill(0);
  const lowerHits = new Array(numLevels).fill(0);

  for (let i = 1; i < sample.length; i++) {
    const priorBar = sample[i - 1];
    const targetBar = sample[i];

    let barCond = 'NEUTRAL';
    if (priorBar.close > priorBar.open) {
      barCond = 'BULLISH';
    } else if (priorBar.close < priorBar.open) {
      barCond = 'BEARISH';
    }

    if (barCond !== priorCond) {
      continue;
    }

    matchingCount += 1;

    if (targetBar.high > priorBar.high) {
      newHighHits += 1;
    }
    if (targetBar.low < priorBar.low) {
      newLowHits += 1;
    }

    for (let k = 1; k <= numLevels; k++) {
      const upTarget = priorBar.high * (1.0 + k * percentageStep);
      const downTarget = priorBar.low * (1.0 - k * percentageStep);

      if (targetBar.high >= upTarget) {
        upperHits[k - 1] += 1;
      }
      if (targetBar.low <= downTarget) {
        lowerHits[k - 1] += 1;
      }
    }
  }

  let bullishProb = 50.0;
  let bearishProb = 50.0;
  const upperLevels: StepLevel[] = [];
  const lowerLevels: StepLevel[] = [];

  if (matchingCount >= minConditionSamples) {
    bullishProb = (newHighHits / matchingCount) * 100.0;
    bearishProb = (newLowHits / matchingCount) * 100.0;

    for (let k = 1; k <= numLevels; k++) {
      const priceUp = lastCompleted.high * (1.0 + k * percentageStep);
      const probUp = (upperHits[k - 1] / matchingCount) * 100.0;
      upperLevels.push({
        level: k,
        price: Number(priceUp.toFixed(5)),
        probability: Number(probUp.toFixed(2)),
      });

      const priceDown = lastCompleted.low * (1.0 - k * percentageStep);
      const probDown = (lowerHits[k - 1] / matchingCount) * 100.0;
      lowerLevels.push({
        level: k,
        price: Number(priceDown.toFixed(5)),
        probability: Number(probDown.toFixed(2)),
      });
    }
  }

  let winningDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let winningProbability = Math.max(bullishProb, bearishProb);

  if (bullishProb > bearishProb) {
    winningDirection = 'BULLISH';
    winningProbability = bullishProb;
  } else if (bearishProb > bullishProb) {
    winningDirection = 'BEARISH';
    winningProbability = bearishProb;
  }

  return {
    bullish_probability: Number(bullishProb.toFixed(2)),
    bearish_probability: Number(bearishProb.toFixed(2)),
    winning_direction: winningDirection,
    winning_probability: Number(winningProbability.toFixed(2)),
    first_level_high: Number(lastCompleted.high.toFixed(5)),
    first_level_low: Number(lastCompleted.low.toFixed(5)),
    current_price: Number(lastCompleted.close.toFixed(5)),
    candle_timestamp: lastCompleted.time,
    upper_levels: upperLevels,
    lower_levels: lowerLevels,
    prior_candle_direction: priorCond,
    total_bars_sample: sample.length,
    condition_matches_count: matchingCount,
    lookback_used: effectiveLookback,
    percentage_step_used: percentageStep,
    methodology: 'Breakout Probability (Expo) - Conditional Empirical Frequency (Zeiierman Published Model)',
    is_verified_methodology: true,
    disclaimer:
      "Calculated using Zeiierman's published conditional transition probability methodology. Probabilities represent empirical historical frequencies, not guaranteed future win rates.",
  };
}

export function evaluateDecision(
  bullishProb: number,
  bearishProb: number,
  threshold: number = 70.0
): {
  decision: 'BUY' | 'SELL' | 'CONFLICT' | 'NO SIGNAL';
  reason: string;
  isQualified: boolean;
} {
  const bullPass = bullishProb >= threshold;
  const bearPass = bearishProb >= threshold;

  if (bullPass && bearPass) {
    return {
      decision: 'CONFLICT',
      reason: `Both bullish (${bullishProb.toFixed(1)}%) and bearish (${bearishProb.toFixed(1)}%) >= ${threshold}%`,
      isQualified: false,
    };
  }

  if (bullPass) {
    return {
      decision: 'BUY',
      reason: `Bullish probability (${bullishProb.toFixed(1)}%) >= threshold (${threshold}%)`,
      isQualified: true,
    };
  }

  if (bearPass) {
    return {
      decision: 'SELL',
      reason: `Bearish probability (${bearishProb.toFixed(1)}%) >= threshold (${threshold}%)`,
      isQualified: true,
    };
  }

  return {
    decision: 'NO SIGNAL',
    reason: `Neither meets threshold (Bullish: ${bullishProb.toFixed(1)}%, Bearish: ${bearishProb.toFixed(1)}% < ${threshold}%)`,
    isQualified: false,
  };
}
