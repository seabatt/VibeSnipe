/**
 * Trade intent model.
 * 
 * Defines a normalized representation of a trade intent that is independent
 * of its source (manual entry, webhook, scheduled, etc.). This provides a
 * clean separation between the "what to trade" and "when to trade" decisions.
 * 
 * @module tradeIntent
 */

import type { TradeLeg, RuleBundle } from '@/types';

/**
 * Generates a unique ID.
 * 
 * @returns Unique ID string
 */
function generateId(): string {
  return `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Trade source type.
 */
export type TradeSource = 'manual' | 'webhook' | 'scheduled';

/**
 * Convert VerticalLegs to TradeLegs array.
 * 
 * @param verticalLegs - Vertical spread legs
 * @param quantity - Quantity
 * @returns Array of TradeLegs
 */
export function verticalLegsToTradeLegs(
  verticalLegs: { shortLeg: any; longLeg: any },
  quantity: number
): TradeLeg[] {
  return [
    {
      action: 'SELL',
      right: verticalLegs.shortLeg.right,
      strike: verticalLegs.shortLeg.strike,
      expiry: verticalLegs.shortLeg.expiration,
      quantity,
    },
    {
      action: 'BUY',
      right: verticalLegs.longLeg.right,
      strike: verticalLegs.longLeg.strike,
      expiry: verticalLegs.longLeg.expiration,
      quantity,
    },
  ];
}

/**
 * Trade intent structure.
 * 
 * Represents a normalized trade that has been validated and is ready
 * to be executed by the orchestrator.
 */
export interface TradeIntent {
  /** Unique intent ID */
  id: string;
  /** Trade legs */
  legs: TradeLeg[];
  /** Quantity */
  quantity: number;
  /** Limit price (required for LIMIT orders) */
  limitPrice?: number;
  /** Order type */
  orderType: 'LIMIT' | 'MARKET';
  /** Rule bundle for TP/SL */
  ruleBundle: RuleBundle;
  /** Account ID */
  accountId: string;
  /** Source of the trade */
  source: TradeSource;
  /** Strategy version for A/B testing */
  strategyVersion?: string;
  /** Chase strategy name */
  chaseStrategy?: string;
  /** Risk rule set name */
  riskRuleSet?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Options for building a trade intent.
 */
export interface BuildTradeIntentOptions {
  /** Trade legs */
  legs: TradeLeg[];
  /** Quantity */
  quantity: number;
  /** Limit price (optional, will use legs average if not provided) */
  limitPrice?: number;
  /** Order type */
  orderType?: 'LIMIT' | 'MARKET';
  /** Rule bundle for TP/SL */
  ruleBundle: RuleBundle;
  /** Account ID */
  accountId: string;
  /** Source of the trade */
  source: TradeSource;
  /** Custom intent ID (optional, will generate if not provided) */
  id?: string;
  /** Strategy version */
  strategyVersion?: string;
  /** Chase strategy name */
  chaseStrategy?: string;
  /** Risk rule set name */
  riskRuleSet?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Builds a validated TradeIntent from options.
 * 
 * This is the primary factory function for creating trade intents.
 * It validates the input and ensures all required fields are present.
 * 
 * @param options - Intent construction options
 * @returns A validated TradeIntent
 * @throws Error if validation fails
 * 
 * @example
 * ```ts
 * const intent = buildTradeIntent({
 *   legs: [
 *     { action: 'BUY', right: 'CALL', strike: 5000, expiry: '2025-12-31', quantity: 1 },
 *     { action: 'SELL', right: 'CALL', strike: 5050, expiry: '2025-12-31', quantity: 1 },
 *   ],
 *   quantity: 1,
 *   limitPrice: 2.50,
 *   orderType: 'LIMIT',
 *   ruleBundle: { takeProfitPct: 50, stopLossPct: 100 },
 *   accountId: 'account-123',
 *   source: 'manual',
 * });
 * ```
 */
export function buildTradeIntent(options: BuildTradeIntentOptions): TradeIntent {
  const { legs, quantity, limitPrice, orderType, ruleBundle, accountId, source, id, metadata } = options;

  // Validate legs
  if (!legs || legs.length === 0) {
    throw new Error('Trade intent must have at least one leg');
  }

  // Validate quantity
  if (!quantity || quantity <= 0 || !Number.isFinite(quantity)) {
    throw new Error('Trade intent must have a valid positive quantity');
  }

  // Validate limit price for LIMIT orders
  const finalOrderType = orderType || (limitPrice ? 'LIMIT' : 'MARKET');
  if (finalOrderType === 'LIMIT') {
    if (!limitPrice || limitPrice <= 0 || !Number.isFinite(limitPrice)) {
      throw new Error('LIMIT orders require a valid positive limit price');
    }
  }

  // Validate rule bundle
  if (!ruleBundle) {
    throw new Error('Rule bundle is required');
  }
  if (ruleBundle.takeProfitPct !== null && (!Number.isFinite(ruleBundle.takeProfitPct) || ruleBundle.takeProfitPct < 0)) {
    throw new Error('Rule bundle takeProfitPct must be non-negative');
  }
  if (ruleBundle.stopLossPct !== null && (!Number.isFinite(ruleBundle.stopLossPct) || ruleBundle.stopLossPct < 0)) {
    throw new Error('Rule bundle stopLossPct must be non-negative');
  }

  // Validate account ID
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required and must be a string');
  }

  // Validate source
  if (!source || !['manual', 'webhook', 'scheduled'].includes(source)) {
    throw new Error('Source must be one of: manual, webhook, scheduled');
  }

  // Calculate limit price if not provided but order type is LIMIT
  let calculatedLimitPrice = limitPrice;
  if (finalOrderType === 'LIMIT' && !calculatedLimitPrice) {
    // Calculate from leg prices if available
    calculatedLimitPrice = calculateLimitPriceFromLegs(legs);
    if (!calculatedLimitPrice || calculatedLimitPrice <= 0) {
      throw new Error('Cannot determine limit price for LIMIT order from legs');
    }
  }

  return {
    id: id || generateId(),
    legs,
    quantity,
    limitPrice: calculatedLimitPrice,
    orderType: finalOrderType,
    ruleBundle,
    accountId,
    source,
    strategyVersion: options.strategyVersion,
    chaseStrategy: options.chaseStrategy,
    riskRuleSet: options.riskRuleSet,
    metadata: options.metadata || metadata,
  };
}

/**
 * Builds a trade intent from a vertical spread specification.
 * 
 * This is a convenience function for building intents from common
 * vertical spread parameters.
 * 
 * @param spec - Vertical spread specification
 * @param entry - Entry parameters
 * @param ruleBundle - Rule bundle
 * @param accountId - Account ID
 * @param source - Trade source
 * @returns A TradeIntent
 * @throws Error if validation fails
 * 
 * @example
 * ```ts
 * const intent = buildVerticalTradeIntent(
 *   {
 *     underlying: 'SPX',
 *     expiration: '2025-12-31',
 *     targetDelta: 50,
 *     right: 'CALL',
 *     width: 50,
 *     quantity: 1,
 *   },
 *   {
 *     maxPrice: 3.00,
 *     orderType: 'LIMIT',
 *     limitPrice: 2.50,
 *   },
 *   { takeProfitPct: 50, stopLossPct: 100 },
 *   'account-123',
 *   'manual'
 * );
 * ```
 */
export function buildVerticalTradeIntent(
  spec: {
    underlying: string;
    expiration: string;
    targetDelta: number;
    right: 'CALL' | 'PUT';
    width: number;
    quantity: number;
  },
  entry: {
    maxPrice?: number;
    minPrice?: number;
    orderType?: 'LIMIT' | 'MARKET';
    limitPrice?: number;
  },
  ruleBundle: RuleBundle,
  accountId: string,
  source: TradeSource
): TradeIntent {
  // Note: This is a simplified version. In production, you'd want to:
  // 1. Build the vertical from the spec using chains module
  // 2. Convert to TradeIntent format
  // For now, we'll validate and construct placeholder legs
  
  const legs: TradeLeg[] = [];
  // This is a placeholder - actual implementation would need to fetch chain
  // and build proper legs from the spec
  
  return buildTradeIntent({
    legs,
    quantity: spec.quantity,
    limitPrice: entry.limitPrice,
    orderType: entry.orderType || (entry.limitPrice ? 'LIMIT' : 'MARKET'),
    ruleBundle,
    accountId,
    source,
  });
}

/**
 * Builds a trade intent from webhook/alert data.
 * 
 * This parses common webhook payload formats (like Discord alerts)
 * and builds a trade intent.
 * 
 * @param alert - Alert/webhook data
 * @param accountId - Account ID
 * @param ruleBundle - Rule bundle (may override alert data)
 * @returns A TradeIntent
 * @throws Error if parsing or validation fails
 * 
 * @example
 * ```ts
 * const intent = buildTradeIntentFromWebhook(
 *   {
 *     underlying: 'SPX',
 *     strategy: 'Vertical',
 *     direction: 'CALL',
 *     strikes: [5000, 5050],
 *     price: 2.50,
 *     quantity: 1,
 *   },
 *   'account-123',
 *   { takeProfitPct: 50, stopLossPct: 100 }
 * );
 * ```
 */
export function buildTradeIntentFromWebhook(
  alert: {
    underlying: string;
    strategy: string;
    direction: 'CALL' | 'PUT';
    strikes: number[];
    price: number;
    quantity: number;
    expiry?: string;
  },
  accountId: string,
  ruleBundle: RuleBundle
): TradeIntent {
  // Validate alert
  if (!alert.underlying || !alert.strikes || alert.strikes.length < 2) {
    throw new Error('Invalid webhook alert: missing required fields');
  }

  const [shortStrike, longStrike] = alert.strikes;

  // Determine expiry
  const expiry = alert.expiry || new Date().toISOString().split('T')[0];

  // Build legs
  const legs: TradeLeg[] = [
    {
      action: 'SELL',
      right: alert.direction,
      strike: shortStrike,
      expiry,
      quantity: alert.quantity,
    },
    {
      action: 'BUY',
      right: alert.direction,
      strike: longStrike,
      expiry,
      quantity: alert.quantity,
    },
  ];

  return buildTradeIntent({
    legs,
    quantity: alert.quantity,
    limitPrice: alert.price,
    orderType: 'LIMIT',
    ruleBundle,
    accountId,
    source: 'webhook',
    metadata: {
      originalAlert: alert,
    },
  });
}

/**
 * Calculates a limit price from leg prices.
 * 
 * Simple implementation that uses leg price differences.
 * In production, this would be more sophisticated.
 * 
 * @param legs - Trade legs
 * @returns Calculated limit price or undefined if cannot calculate
 */
function calculateLimitPriceFromLegs(legs: TradeLeg[]): number | undefined {
  // Simple calculation: sum of leg prices weighted by action
  let total = 0;
  
  for (const leg of legs) {
    if (!leg.price) {
      return undefined; // Cannot calculate if prices missing
    }
    
    // SELL legs are negative (credit), BUY legs are positive (debit)
    const multiplier = leg.action === 'SELL' ? -1 : 1;
    total += leg.price * multiplier * leg.quantity;
  }
  
  return Math.abs(total);
}

/**
 * Validates a trade intent.
 * 
 * @param intent - Trade intent to validate
 * @returns True if valid, false otherwise
 */
export function validateTradeIntent(intent: TradeIntent): boolean {
  try {
    // Run through buildTradeIntent validation
    buildTradeIntent({
      legs: intent.legs,
      quantity: intent.quantity,
      limitPrice: intent.limitPrice,
      orderType: intent.orderType,
      ruleBundle: intent.ruleBundle,
      accountId: intent.accountId,
      source: intent.source,
      id: intent.id,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Clones a trade intent with optional modifications.
 * 
 * @param intent - Original intent
 * @param modifications - Optional modifications to apply
 * @returns New TradeIntent instance
 */
export function cloneTradeIntent(
  intent: TradeIntent,
  modifications?: Partial<TradeIntent>
): TradeIntent {
  return {
    id: generateId(), // Generate new ID
    legs: modifications?.legs || intent.legs,
    quantity: modifications?.quantity || intent.quantity,
    limitPrice: modifications?.limitPrice || intent.limitPrice,
    orderType: modifications?.orderType || intent.orderType,
    ruleBundle: modifications?.ruleBundle || intent.ruleBundle,
    accountId: modifications?.accountId || intent.accountId,
    source: modifications?.source || intent.source,
    metadata: modifications?.metadata || intent.metadata,
  };
}
