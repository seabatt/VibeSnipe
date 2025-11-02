/**
 * Decision engine types.
 * 
 * @module decision/types
 */

import type { Signal } from '../signals/types';

/**
 * Market context for decision making.
 */
export interface MarketContext {
  /** Current market state for underlying */
  underlying: {
    symbol: string;
    bid: number;
    ask: number;
    mid: number;
    spread: number;
  };
  /** Greeks data (if available) */
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  /** Timestamp of context */
  timestamp: string;
}

/**
 * Portfolio context for decision making.
 */
export interface PortfolioContext {
  /** Current exposure by underlying */
  exposure: Map<string, {
    short_delta: number;
    net_credit: number;
    margin_usage: number;
  }>;
  /** Total buying power used */
  total_buying_power_used: number;
  /** Timestamp of context */
  timestamp: string;
}

/**
 * Decision result.
 */
export interface Decision {
  /** Unique decision ID */
  decision_id: string;
  /** Signal that triggered this decision */
  signal_id: string;
  /** Whether we should trade */
  should_trade: boolean;
  /** Reason for the decision */
  reason: string;
  /** Trade spec (if should_trade) */
  trade_spec: TradeSpec | null;
  /** When the decision was made */
  decision_time: string;
  /** Strategy version used */
  strategy_version?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Trade specification (what to trade if approved).
 */
export interface TradeSpec {
  /** Underlying symbol */
  underlying: string;
  /** Strategy type */
  strategy: string;
  /** Direction */
  direction: 'CALL' | 'PUT';
  /** Strikes */
  strikes: number[];
  /** Target delta */
  target_delta: number;
  /** Quantity */
  quantity: number;
  /** Price */
  price: number;
  /** Expiration */
  expiry: string;
  /** Account ID */
  accountId: string;
  /** Rule bundle */
  ruleBundle: {
    takeProfitPct: number;
    stopLossPct: number;
  };
  /** Strategy version */
  strategy_version?: string;
}

/**
 * Decision context (combined inputs).
 */
export interface DecisionContext {
  /** The signal to evaluate */
  signal: Signal;
  /** Current market state */
  market: MarketContext;
  /** Current portfolio state */
  portfolio: PortfolioContext;
  /** Strategy version to use */
  strategy_version?: string;
}

