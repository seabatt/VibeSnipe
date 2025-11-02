/**
 * Trade builder - constructs TradeIntents from TradeSpecs.
 * 
 * Takes a TradeSpec from the decision engine and builds a complete
 * TradeIntent with actual market data (re-validating Greeks),
 * ready for execution by the orchestrator.
 * 
 * @module builder/tradeBuilder
 */

import { buildTradeIntent as buildIntent, type TradeIntent } from '../tradeIntent';
import { createTradeIntent as createIntentRecord } from '../db/services/tradeService';
import { marketStateCache } from '../market/marketStateCache';
import { validateDelta } from '../market/greeksValidator';
import { fetchAndBuildVertical } from '../tastytrade/chains';
import type { TradeSpec } from '../decision/types';
import type { VerticalLegs } from '../tastytrade/types';
import { logger } from '../logger';

/**
 * Trade build result.
 */
export interface TradeBuildResult {
  intent: TradeIntent;
  verticalLegs: VerticalLegs;
  intent_snapshot: {
    market_conditions: Record<string, any>;
    greeks: Record<string, number>;
  };
}

/**
 * Build a trade intent from a trade spec.
 * 
 * This function:
 * 1. Subscribes to market data for the underlying
 * 2. Fetches and builds vertical legs from the spec
 * 3. Re-validates Greeks against live quotes
 * 4. Creates TradeIntent with market snapshot
 * 5. Persists intent to database
 * 
 * @param tradeSpec - Trade spec from decision engine
 * @param decision_id - Decision ID that produced this spec
 * @returns Trade build result
 */
export async function buildTradeFromSpec(
  tradeSpec: TradeSpec,
  decision_id: string
): Promise<TradeBuildResult> {
  // Subscribe to market data
  await marketStateCache.subscribe([tradeSpec.underlying]);

  // Get current market state
  const marketState = marketStateCache.getMarketState(tradeSpec.underlying);

  if (!marketState) {
    throw new Error(`No market data available for ${tradeSpec.underlying}`);
  }

  // Build vertical legs from spec
  const verticalSpec = {
    underlying: tradeSpec.underlying,
    expiration: tradeSpec.expiry,
    targetDelta: tradeSpec.target_delta,
    right: tradeSpec.direction,
    width: tradeSpec.strikes.length > 1 
      ? Math.abs(tradeSpec.strikes[1] - tradeSpec.strikes[0]) 
      : 10,
    quantity: tradeSpec.quantity,
  };

  const verticalLegs = await fetchAndBuildVertical(verticalSpec);

  if (!verticalLegs) {
    throw new Error('Failed to build vertical legs from spec');
  }

  // Validate Greeks if available
  const shortLegSymbol = verticalLegs.shortLeg.streamerSymbol || verticalLegs.shortLeg.symbol;
  const greeksValidation = validateDelta(shortLegSymbol, tradeSpec.target_delta, 2);

  if (!greeksValidation.valid && greeksValidation.current_delta !== undefined) {
    logger.warn('Greeks validation failed', {
      symbol: shortLegSymbol,
      current_delta: greeksValidation.current_delta,
      target_delta: tradeSpec.target_delta,
      reason: greeksValidation.reason,
    });
  }

  // Build trade intent
  const legs = [
    {
      action: 'SELL' as const,
      right: verticalLegs.shortLeg.right,
      strike: verticalLegs.shortLeg.strike,
      expiry: verticalLegs.shortLeg.expiration,
      quantity: tradeSpec.quantity,
    },
    {
      action: 'BUY' as const,
      right: verticalLegs.longLeg.right,
      strike: verticalLegs.longLeg.strike,
      expiry: verticalLegs.longLeg.expiration,
      quantity: tradeSpec.quantity,
    },
  ];

  const intent = buildIntent({
    legs,
    quantity: tradeSpec.quantity,
    limitPrice: tradeSpec.price,
    orderType: 'LIMIT',
    ruleBundle: tradeSpec.ruleBundle,
    accountId: tradeSpec.accountId,
    source: 'webhook',
    strategyVersion: tradeSpec.strategy_version,
    metadata: {
      decision_id,
      trade_spec: tradeSpec,
      greeks_validation: greeksValidation,
    },
  });

  // Create intent snapshot
  const intent_snapshot = {
    market_conditions: {
      bid: marketState.quote.bid,
      ask: marketState.quote.ask,
      mid: marketState.quote.mark,
      spread: marketState.quote.ask - marketState.quote.bid,
      staleness_ms: marketState.staleness_ms,
    },
    greeks: {
      delta: marketState.quote.delta || 0,
      gamma: marketState.quote.gamma || 0,
      theta: marketState.quote.theta || 0,
      vega: marketState.quote.vega || 0,
    },
  };

  // Note: We're using createTradeService but the actual record creation
  // should happen in the orchestrator when the trade is created
  // For now, we just log the intent
  logger.info('Trade intent built', {
    intent_id: intent.id,
    decision_id,
    underlying: tradeSpec.underlying,
  });

  return {
    intent,
    verticalLegs,
    intent_snapshot,
  };
}

