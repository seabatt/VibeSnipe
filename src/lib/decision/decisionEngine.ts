/**
 * Decision engine for making trade decisions.
 * 
 * Takes a normalized Signal and current MarketContext + PortfolioContext,
 * and returns a Decision indicating whether to trade and what to trade.
 * All decisions are logged to the database (even rejections) for audit trail.
 * 
 * @module decision/decisionEngine
 */

import { createDecision } from '../db/services/decisionService';
import type { Signal } from '../signals/types';
import type { Decision, DecisionContext, MarketContext, PortfolioContext, TradeSpec } from './types';
import { logger } from '../logger';

/**
 * Generate a unique decision ID.
 */
function generateDecisionId(): string {
  return `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Make a trading decision based on signal and context.
 * 
 * This is the core decision logic:
 * 1. Evaluate market conditions (freshness, spread, etc.)
 * 2. Check portfolio limits (exposure, buying power)
 * 3. Apply strategy rules
 * 4. Return decision with trade spec (if approved)
 * 
 * @param context - Decision context (signal + market + portfolio)
 * @returns Decision result
 */
export async function makeDecision(context: DecisionContext): Promise<Decision> {
  const { signal, market, portfolio, strategy_version } = context;

  // Initialize decision
  const decision_id = generateDecisionId();
  const decision_time = new Date().toISOString();

  // Evaluate market conditions
  const marketEvaluation = evaluateMarketConditions(market);
  if (!marketEvaluation.approved) {
    const decision: Decision = {
      decision_id,
      signal_id: signal.signal_id,
      should_trade: false,
      reason: marketEvaluation.reason,
      trade_spec: null,
      decision_time,
      strategy_version,
    };

    // Persist to database
    createDecision({
      signal_id: signal.signal_id,
      should_trade: false,
      reason: marketEvaluation.reason,
      trade_spec: null,
      strategy_version,
    });

    logger.info('Decision: trade rejected (market conditions)', {
      decision_id,
      signal_id: signal.signal_id,
      reason: marketEvaluation.reason,
    });

    return decision;
  }

  // Evaluate portfolio limits
  const portfolioEvaluation = evaluatePortfolioLimits(signal, portfolio);
  if (!portfolioEvaluation.approved) {
    const decision: Decision = {
      decision_id,
      signal_id: signal.signal_id,
      should_trade: false,
      reason: portfolioEvaluation.reason,
      trade_spec: null,
      decision_time,
      strategy_version,
    };

    // Persist to database
    createDecision({
      signal_id: signal.signal_id,
      should_trade: false,
      reason: portfolioEvaluation.reason,
      trade_spec: null,
      strategy_version,
    });

    logger.info('Decision: trade rejected (portfolio limits)', {
      decision_id,
      signal_id: signal.signal_id,
      reason: portfolioEvaluation.reason,
    });

    return decision;
  }

  // Build trade spec
  const tradeSpec = buildTradeSpec(signal, context);

  // Approve trade
  const decision: Decision = {
    decision_id,
    signal_id: signal.signal_id,
    should_trade: true,
    reason: 'All checks passed',
    trade_spec: tradeSpec,
    decision_time,
    strategy_version,
  };

  // Persist to database
  createDecision({
    signal_id: signal.signal_id,
    should_trade: true,
    reason: 'All checks passed',
    trade_spec: tradeSpec as any,
    strategy_version,
  });

  logger.info('Decision: trade approved', {
    decision_id,
    signal_id: signal.signal_id,
    underlying: signal.underlying,
  });

  return decision;
}

/**
 * Evaluate market conditions.
 */
interface MarketEvaluation {
  approved: boolean;
  reason: string;
}

function evaluateMarketConditions(market: MarketContext): MarketEvaluation {
  // Check spread (too wide = illiquid)
  const maxSpreadPercent = 5; // 5% of mid
  const spreadPercent = (market.underlying.spread / market.underlying.mid) * 100;

  if (spreadPercent > maxSpreadPercent) {
    return {
      approved: false,
      reason: `Spread too wide: ${spreadPercent.toFixed(2)}% > ${maxSpreadPercent}%`,
    };
  }

  // Check if market data is reasonable (non-zero)
  if (market.underlying.mid <= 0) {
    return {
      approved: false,
      reason: 'Invalid market data',
    };
  }

  return {
    approved: true,
    reason: 'Market conditions acceptable',
  };
}

/**
 * Evaluate portfolio limits.
 */
interface PortfolioEvaluation {
  approved: boolean;
  reason: string;
}

function evaluatePortfolioLimits(
  signal: Signal,
  portfolio: PortfolioContext
): PortfolioEvaluation {
  const exposure = portfolio.exposure.get(signal.underlying);

  // Check position limit per underlying
  if (exposure) {
    const maxDeltaPerUnderlying = 100; // Max aggregate short delta
    if (Math.abs(exposure.short_delta) > maxDeltaPerUnderlying) {
      return {
        approved: false,
        reason: `Max delta exceeded for ${signal.underlying}: ${exposure.short_delta} > ${maxDeltaPerUnderlying}`,
      };
    }
  }

  // Check buying power
  const maxBuyingPowerPercent = 80; // Max 80% of buying power
  const buyingPowerUsedPercent = (portfolio.total_buying_power_used / 100) * 100; // Assuming 100 is total

  if (buyingPowerUsedPercent > maxBuyingPowerPercent) {
    return {
      approved: false,
      reason: `Buying power limit exceeded: ${buyingPowerUsedPercent.toFixed(1)}% > ${maxBuyingPowerPercent}%`,
    };
  }

  return {
    approved: true,
    reason: 'Portfolio limits acceptable',
  };
}

/**
 * Build trade specification from signal.
 */
function buildTradeSpec(signal: Signal, context: DecisionContext): TradeSpec {
  const metadata = signal.metadata || {};
  const rawPayload = signal.raw_payload as any;

  // Extract trade parameters from signal
  const strikes = metadata.strikes || rawPayload.strikes || [];
  const price = metadata.price || rawPayload.price || 0;
  const quantity = metadata.quantity || rawPayload.quantity || 1;
  const expiry = metadata.expiry || rawPayload.expiry || '';
  const accountId = metadata.accountId || rawPayload.accountId || 'default-account';

  // Build rule bundle
  const ruleBundle = metadata.ruleBundle || rawPayload.ruleBundle || {
    takeProfitPct: 50,
    stopLossPct: 100,
  };

  // Determine target delta from signal or strategy
  const targetDelta = metadata.targetDelta || 30; // Default 0.30 delta

  const tradeSpec: TradeSpec = {
    underlying: signal.underlying,
    strategy: signal.strategy_type,
    direction: signal.direction,
    strikes,
    target_delta: targetDelta,
    quantity,
    price,
    expiry,
    accountId,
    ruleBundle,
    strategy_version: context.strategy_version,
  };

  return tradeSpec;
}

