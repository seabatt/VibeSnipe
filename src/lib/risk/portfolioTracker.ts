/**
 * Portfolio exposure tracker.
 * 
 * Tracks aggregate exposure (short_delta, net_credit, margin_usage) per underlying.
 * Provides canAddTrade() check to validate new trades against portfolio limits.
 * 
 * @module risk/portfolioTracker
 */

import { db } from '../db/client';
import { logger } from '../logger';
import type { TradeSpec } from '../decision/types';

/**
 * Portfolio exposure check result.
 */
export interface PortfolioCheckResult {
  /** Whether trade can be added */
  can_add: boolean;
  /** Reason if blocked */
  reason?: string;
  /** Current aggregate exposure for underlying */
  current_exposure: {
    short_delta: number;
    net_credit: number;
    margin_usage: number;
  };
  /** Projected exposure after trade */
  projected_exposure: {
    short_delta: number;
    net_credit: number;
    margin_usage: number;
  };
}

/**
 * Update portfolio state for a filled trade.
 */
export function updatePortfolioAfterFill(
  trade: TradeSpec,
  fillPrice: number
): void {
  const underlying = trade.underlying;

  // Get current exposure
  const current = db.getPortfolioState(underlying) || {
    underlying,
    short_delta: 0,
    net_credit: 0,
    margin_usage: 0,
    updated_at: new Date().toISOString(),
  };

  // Estimate delta impact (simplified - would need actual Greeks from filled legs)
  const deltaImpact = trade.target_delta * trade.quantity;

  // Update exposure
  const updated = {
    short_delta: current.short_delta + deltaImpact,
    net_credit: current.net_credit + (fillPrice * trade.quantity),
    margin_usage: current.margin_usage + (fillPrice * trade.quantity),
  };

  db.updatePortfolioState(underlying, updated);

  logger.info('Portfolio state updated', {
    underlying,
    updated,
  });
}

/**
 * Check if a trade can be added to portfolio.
 * 
 * This is a pre-trade validation that checks if the new trade would
 * violate portfolio limits.
 */
export function canAddTrade(trade: TradeSpec): PortfolioCheckResult {
  const underlying = trade.underlying;

  // Get current exposure
  const current = db.getPortfolioState(underlying) || {
    underlying,
    short_delta: 0,
    net_credit: 0,
    margin_usage: 0,
    updated_at: new Date().toISOString(),
  };

  // Project new exposure
  const deltaImpact = trade.target_delta * trade.quantity;
  const creditImpact = trade.price * trade.quantity;
  const marginImpact = trade.price * trade.quantity;

  const projected = {
    short_delta: current.short_delta + deltaImpact,
    net_credit: current.net_credit + creditImpact,
    margin_usage: current.margin_usage + marginImpact,
  };

  // Check limits (hard limits for now)
  const maxDeltaPerUnderlying = 100; // Max aggregate short delta
  const maxMarginPercent = 90; // Max margin usage (simplified)

  if (Math.abs(projected.short_delta) > maxDeltaPerUnderlying) {
    return {
      can_add: false,
      reason: `Max delta limit exceeded: ${projected.short_delta} > ${maxDeltaPerUnderlying}`,
      current_exposure: {
        short_delta: current.short_delta,
        net_credit: current.net_credit,
        margin_usage: current.margin_usage,
      },
      projected_exposure: projected,
    };
  }

  if (projected.margin_usage > maxMarginPercent) {
    return {
      can_add: false,
      reason: `Max margin usage exceeded: ${projected.margin_usage}% > ${maxMarginPercent}%`,
      current_exposure: {
        short_delta: current.short_delta,
        net_credit: current.net_credit,
        margin_usage: current.margin_usage,
      },
      projected_exposure: projected,
    };
  }

  return {
    can_add: true,
    current_exposure: {
      short_delta: current.short_delta,
      net_credit: current.net_credit,
      margin_usage: current.margin_usage,
    },
    projected_exposure: projected,
  };
}

/**
 * Get portfolio summary across all underlyings.
 */
export function getPortfolioSummary(): {
  total_delta: number;
  total_credit: number;
  total_margin: number;
  by_underlying: Array<{
    underlying: string;
    short_delta: number;
    net_credit: number;
    margin_usage: number;
  }>;
} {
  const allState = db.getAllPortfolioState();

  const summary = allState.reduce(
    (acc, state) => {
      acc.total_delta += state.short_delta;
      acc.total_credit += state.net_credit;
      acc.total_margin += state.margin_usage;
      acc.by_underlying.push({
        underlying: state.underlying,
        short_delta: state.short_delta,
        net_credit: state.net_credit,
        margin_usage: state.margin_usage,
      });
      return acc;
    },
    {
      total_delta: 0,
      total_credit: 0,
      total_margin: 0,
      by_underlying: [] as Array<{
        underlying: string;
        short_delta: number;
        net_credit: number;
        margin_usage: number;
      }>,
    }
  );

  return summary;
}

