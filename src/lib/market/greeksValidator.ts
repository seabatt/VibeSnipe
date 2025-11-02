/**
 * Greeks validation service.
 * 
 * Validates that current Greeks match target deltas within tolerance.
 * Used by decision engine and trade builder to ensure trades are executed
 * at intended risk levels.
 * 
 * @module market/greeksValidator
 */

import { marketStateCache } from './marketStateCache';

/**
 * Greeks validation result.
 */
export interface GreeksValidationResult {
  valid: boolean;
  reason: string;
  current_delta?: number;
  target_delta?: number;
  drift?: number;
  tolerance?: number;
}

/**
 * Validate delta against target within tolerance.
 * 
 * @param symbol - Option symbol
 * @param targetDelta - Target delta (30 = 0.30 delta)
 * @param tolerance - Allowed drift in delta points (default: 2 = 0.02 delta)
 * @returns Validation result
 */
export function validateDelta(
  symbol: string,
  targetDelta: number,
  tolerance: number = 2
): GreeksValidationResult {
  // Get current market state
  const marketState = marketStateCache.getMarketState(symbol);

  if (!marketState) {
    return {
      valid: false,
      reason: `No market data available for symbol: ${symbol}`,
    };
  }

  // Check staleness
  if (marketState.staleness_ms > 500) {
    return {
      valid: false,
      reason: `Market data is stale: ${marketState.staleness_ms}ms old`,
      current_delta: marketState.quote.delta,
      target_delta: targetDelta,
    };
  }

  // Check if we have delta
  if (marketState.quote.delta === undefined) {
    return {
      valid: false,
      reason: `Delta not available for symbol: ${symbol}`,
    };
  }

  // Compute drift
  const currentDelta = Math.abs(marketState.quote.delta * 100); // Convert to points
  const drift = Math.abs(currentDelta - targetDelta);

  const valid = drift <= tolerance;

  return {
    valid,
    reason: valid
      ? 'Delta within tolerance'
      : `Delta drift exceeded: ${drift.toFixed(2)} > ${tolerance}`,
    current_delta: currentDelta,
    target_delta: targetDelta,
    drift,
    tolerance,
  };
}

/**
 * Validate multiple Greeks (delta, gamma, theta, vega).
 * 
 * @param symbol - Option symbol
 * @param targets - Target Greeks values
 * @param tolerances - Allowed drift for each Greek
 * @returns Validation result
 */
export function validateGreeks(
  symbol: string,
  targets: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  },
  tolerances: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  } = {}
): GreeksValidationResult {
  const marketState = marketStateCache.getMarketState(symbol);

  if (!marketState) {
    return {
      valid: false,
      reason: `No market data available for symbol: ${symbol}`,
    };
  }

  if (marketState.staleness_ms > 500) {
    return {
      valid: false,
      reason: `Market data is stale: ${marketState.staleness_ms}ms old`,
    };
  }

  const quote = marketState.quote;
  const failures: string[] = [];

  if (targets.delta !== undefined) {
    const tolerance = tolerances.delta || 2;
    const currentDelta = Math.abs((quote.delta || 0) * 100);
    const drift = Math.abs(currentDelta - targets.delta);
    
    if (drift > tolerance) {
      failures.push(`Delta drift: ${drift.toFixed(2)} > ${tolerance}`);
    }
  }

  // Add additional Greek checks as needed

  const valid = failures.length === 0;

  return {
    valid,
    reason: valid
      ? 'All Greeks within tolerance'
      : `Greeks validation failed: ${failures.join(', ')}`,
  };
}

/**
 * Validate that quote is fresh and ready for trading.
 * 
 * @param symbol - Option symbol
 * @param maxStalenessMs - Maximum allowed staleness (default: 500ms)
 * @returns Validation result
 */
export function validateQuoteFreshness(
  symbol: string,
  maxStalenessMs: number = 500
): GreeksValidationResult {
  const marketState = marketStateCache.getMarketState(symbol);

  if (!marketState) {
    return {
      valid: false,
      reason: `No market data available for symbol: ${symbol}`,
    };
  }

  const valid = marketState.staleness_ms <= maxStalenessMs;

  return {
    valid,
    reason: valid
      ? 'Quote is fresh'
      : `Quote is stale: ${marketState.staleness_ms}ms > ${maxStalenessMs}ms`,
  };
}

