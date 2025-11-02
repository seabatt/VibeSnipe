/**
 * Declarative chase logic for order execution.
 * 
 * This module provides pure functions for computing chase prices based on
 * market conditions, time elapsed, and attempt number. Unlike iterative
 * logic, these functions are deterministic and easily testable against
 * recorded order books.
 * 
 * Benefits:
 * - Pure functions (no side effects)
 * - Deterministic and reproducible
 * - Easy to backtest offline
 * - Strategy A/B testing
 */

/**
 * Parameters for chase price computation.
 */
export interface ChasePriceParams {
  /** Current mid price */
  mid: number;
  /** Current bid price */
  bid: number;
  /** Current ask price */
  ask: number;
  /** Attempt number (1-indexed) */
  attempt: number;
  /** Elapsed time in milliseconds since chase started */
  elapsedMs: number;
  /** Underlying symbol */
  underlying: string;
  /** Initial limit price */
  initialPrice: number;
  /** Spread width (ask - bid) */
  spread?: number;
  /** Current Greeks (delta, gamma, etc.) */
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
  };
}

/**
 * Chase strategy interface.
 */
export interface ChaseStrategy {
  /** Strategy name */
  name: string;
  /** Description of strategy */
  description?: string;
  /** Pure function to compute next chase price */
  computePrice: (params: ChasePriceParams) => number;
}

/**
 * Aggressive linear chase strategy.
 * 
 * Uses fixed step size per attempt. Simple and predictable.
 */
export const AGGRESSIVE_LINEAR: ChaseStrategy = {
  name: 'aggressive-linear',
  description: 'Fixed step size: underlying === SPX ? 0.05 : 0.01',
  computePrice: ({ bid, attempt, underlying }) => {
    const step = underlying === 'SPX' || underlying === 'NDX' || underlying === 'RUT' ? 0.05 : 0.01;
    return bid + step * attempt;
  },
};

/**
 * Time-weighted chase strategy.
 * 
 * Becomes more aggressive as time passes. Good for time-sensitive fills.
 */
export const TIME_WEIGHTED: ChaseStrategy = {
  name: 'time-weighted',
  description: 'Aggressive as time passes, up to 50% of spread',
  computePrice: ({ bid, mid, elapsedMs, spread }) => {
    const maxElapsed = 30000; // 30 seconds
    const timeWeight = Math.min(elapsedMs / maxElapsed, 1);
    const maxAdjustment = spread ? Math.min(spread * 0.5, mid - bid) : (mid - bid) * 0.5;
    return bid + maxAdjustment * timeWeight;
  },
};

/**
 * Spread-adaptive chase strategy.
 * 
 * Adjusts based on bid/ask spread width. Narrow spreads = smaller steps.
 */
export const SPREAD_ADAPTIVE: ChaseStrategy = {
  name: 'spread-adaptive',
  description: 'Steps proportional to spread width',
  computePrice: ({ bid, ask, attempt, underlying }) => {
    const spread = ask - bid;
    const baseStep = underlying === 'SPX' || underlying === 'NDX' || underlying === 'RUT' ? 0.05 : 0.01;
    
    // Use larger steps if spread is wide
    const spreadMultiplier = spread > 0.25 ? 1.5 : spread > 0.10 ? 1.2 : 1.0;
    const step = baseStep * spreadMultiplier;
    
    return bid + step * attempt;
  },
};

/**
 * Conservative bounded chase strategy.
 * 
 * Chases up to mid price but never beyond. Limits slippage.
 */
export const CONSERVATIVE_BOUNDED: ChaseStrategy = {
  name: 'conservative-bounded',
  description: 'Never chase beyond mid price',
  computePrice: ({ bid, mid, attempt, underlying }) => {
    const step = underlying === 'SPX' || underlying === 'NDX' || underlying === 'RUT' ? 0.05 : 0.01;
    const nextPrice = bid + step * attempt;
    return Math.min(nextPrice, mid);
  },
};

/**
 * Delta-weighted chase strategy.
 * 
 * Adjusts aggression based on option delta. Higher deltas = less aggressive.
 */
export const DELTA_WEIGHTED: ChaseStrategy = {
  name: 'delta-weighted',
  description: 'Less aggressive for higher delta options',
  computePrice: ({ bid, attempt, underlying, greeks }) => {
    const baseStep = underlying === 'SPX' || underlying === 'NDX' || underlying === 'RUT' ? 0.05 : 0.01;
    
    // Reduce step size for higher deltas (more ITM)
    const delta = greeks?.delta ? Math.abs(greeks.delta) : 0.5;
    const deltaWeight = delta > 0.7 ? 0.5 : delta > 0.5 ? 0.75 : 1.0;
    const step = baseStep * deltaWeight;
    
    return bid + step * attempt;
  },
};

/**
 * Hybrid strategy combining time and delta.
 * 
 * Uses both time pressure and delta sensitivity.
 */
export const HYBRID_TIME_DELTA: ChaseStrategy = {
  name: 'hybrid-time-delta',
  description: 'Combines time weighting with delta sensitivity',
  computePrice: ({ bid, mid, attempt, elapsedMs, underlying, greeks, spread }) => {
    // Time component
    const maxElapsed = 30000;
    const timeWeight = Math.min(elapsedMs / maxElapsed, 1);
    
    // Delta component
    const delta = greeks?.delta ? Math.abs(greeks.delta) : 0.5;
    const deltaWeight = delta > 0.7 ? 0.5 : delta > 0.5 ? 0.75 : 1.0;
    
    // Base step size
    const baseStep = underlying === 'SPX' || underlying === 'NDX' || underlying === 'RUT' ? 0.05 : 0.01;
    
    // Combined adjustment
    const adjustedStep = baseStep * deltaWeight * (1 + timeWeight);
    const nextPrice = bid + adjustedStep * attempt;
    
    // Don't go beyond mid
    return Math.min(nextPrice, mid);
  },
};

/**
 * All available chase strategies.
 */
export const CHASE_STRATEGIES: Record<string, ChaseStrategy> = {
  'aggressive-linear': AGGRESSIVE_LINEAR,
  'time-weighted': TIME_WEIGHTED,
  'spread-adaptive': SPREAD_ADAPTIVE,
  'conservative-bounded': CONSERVATIVE_BOUNDED,
  'delta-weighted': DELTA_WEIGHTED,
  'hybrid-time-delta': HYBRID_TIME_DELTA,
};

/**
 * Gets a chase strategy by name.
 * 
 * @param name - Strategy name
 * @returns Chase strategy or null if not found
 */
export function getChaseStrategy(name: string): ChaseStrategy | null {
  return CHASE_STRATEGIES[name] || null;
}

/**
 * Gets all available chase strategies.
 * 
 * @returns Object mapping strategy names to strategies
 */
export function getAllChaseStrategies(): Record<string, ChaseStrategy> {
  return CHASE_STRATEGIES;
}

/**
 * Validates chase price against limits.
 * 
 * @param computedPrice - Price from chase strategy
 * @param initialPrice - Original limit price
 * @param maxSlippage - Maximum allowed slippage
 * @returns Validated price (capped at initial + maxSlippage)
 */
export function validateChasePrice(
  computedPrice: number,
  initialPrice: number,
  maxSlippage: number
): number {
  const maxPrice = initialPrice + maxSlippage;
  return Math.min(computedPrice, maxPrice);
}

/**
 * Computes slippage incurred by chase strategy.
 * 
 * @param initialPrice - Original limit price
 * @param finalPrice - Price after chase
 * @returns Slippage amount (always >= 0)
 */
export function computeSlippage(initialPrice: number, finalPrice: number): number {
  return Math.max(0, finalPrice - initialPrice);
}

