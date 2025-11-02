/**
 * TypeScript type definitions for Tastytrade API integration.
 * These types provide strong typing for option instruments, quotes, orders, and related structures.
 */

/**
 * Environment configuration for Tastytrade API.
 */
export type TastytradeEnv = 'prod' | 'sandbox';

/**
 * Option contract instrument with all necessary trading information.
 */
export interface OptionInstrument {
  /** Underlying symbol (e.g., "SPX", "QQQ") */
  symbol: string;
  /** Strike price */
  strike: number;
  /** Option type: "CALL" or "PUT" */
  right: 'CALL' | 'PUT';
  /** Expiration date in ISO format (e.g., "2025-10-31") */
  expiration: string;
  /** Streamer symbol used for real-time quotes */
  streamerSymbol: string;
  /** Delta value for the option contract */
  delta?: number;
  /** Gamma value for the option contract */
  gamma?: number;
  /** Theta value for the option contract */
  theta?: number;
  /** Vega value for the option contract */
  vega?: number;
  /** Bid price */
  bid?: number;
  /** Ask price */
  ask?: number;
  /** Mark price (midpoint of bid/ask) */
  mark?: number;
}

/**
 * Quote data with Greeks for an option contract or underlying.
 */
export interface GreekQuote {
  /** Symbol being quoted */
  symbol: string;
  /** Bid price */
  bid: number;
  /** Ask price */
  ask: number;
  /** Mark price (midpoint) */
  mark: number;
  /** Delta value */
  delta?: number;
  /** Gamma value */
  gamma?: number;
  /** Theta value */
  theta?: number;
  /** Vega value */
  vega?: number;
  /** Timestamp of the quote */
  timestamp?: string;
}

/**
 * Specification for a vertical spread strategy.
 */
export interface VerticalSpec {
  /** Underlying symbol */
  underlying: string;
  /** Expiration date in ISO format */
  expiration: string;
  /** Target delta for short leg selection */
  targetDelta: number;
  /** Option type: "CALL" or "PUT" */
  right: 'CALL' | 'PUT';
  /** Width between short and long legs */
  width: number;
  /** Quantity of spreads */
  quantity: number;
}

/**
 * Entry configuration for a trade.
 */
export interface EntryConfig {
  /** Vertical specification */
  vertical: VerticalSpec;
  /** Maximum acceptable price for entry */
  maxPrice?: number;
  /** Minimum acceptable price for entry */
  minPrice?: number;
  /** Order type: "LIMIT", "MARKET", etc. */
  orderType?: 'LIMIT' | 'MARKET';
}

/**
 * Order leg for multi-leg strategies.
 */
export interface OrderLeg {
  /** Instrument ID or streamer symbol */
  instrumentId?: string;
  /** Streamer symbol for the instrument */
  streamerSymbol: string;
  /** Action: "BUY_TO_OPEN", "SELL_TO_OPEN", "BUY_TO_CLOSE", "SELL_TO_CLOSE" */
  action: 'BUY_TO_OPEN' | 'SELL_TO_OPEN' | 'BUY_TO_CLOSE' | 'SELL_TO_CLOSE';
  /** Quantity for this leg */
  quantity: number;
  /** Limit price (optional for market orders) */
  price?: number;
}

/**
 * Application-level order representation.
 */
export interface AppOrder {
  /** Unique order ID */
  id: string;
  /** Account ID */
  accountId: string;
  /** Order legs */
  legs: OrderLeg[];
  /** Order type */
  orderType: 'LIMIT' | 'MARKET';
  /** Time in force: "DAY", "GTC", etc. */
  timeInForce?: 'DAY' | 'GTC' | 'EXT' | 'IOC' | 'FOK';
  /** Order status */
  status: 'PENDING' | 'WORKING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
  /** Net price of the spread */
  netPrice?: number;
  /** Quantity */
  quantity: number;
  /** Created timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt?: string;
  /** Error message if order failed */
  error?: string;
}

/**
 * Option chain data structure.
 */
export interface OptionChain {
  /** Underlying symbol */
  symbol: string;
  /** Expiration date */
  expiration: string;
  /** Array of option contracts */
  contracts: OptionInstrument[];
}

/**
 * Vertical spread leg pair.
 */
export interface VerticalLegs {
  /** Short leg (typically the entry leg) */
  shortLeg: OptionInstrument;
  /** Long leg (typically the protective leg) */
  longLeg: OptionInstrument;
}

/**
 * OCO (One-Cancels-Other) bracket configuration.
 */
export interface OCOBracket {
  /** Parent order ID */
  parentOrderId: string;
  /** Take profit order configuration */
  takeProfit?: {
    /** Order ID */
    orderId: string;
    /** Target price */
    targetPrice: number;
  };
  /** Stop loss order configuration */
  stopLoss?: {
    /** Order ID */
    orderId: string;
    /** Stop price */
    stopPrice: number;
  };
}

/**
 * Complex order submission payload.
 */
export interface ComplexOrderPayload {
  /** Order type */
  orderType: 'LIMIT' | 'MARKET';
  /** Time in force */
  timeInForce: 'DAY' | 'GTC' | 'EXT' | 'IOC' | 'FOK';
  /** Legs */
  legs: OrderLeg[];
  /** Price (for limit orders) */
  price?: string;
  /** Quantity */
  quantity: number;
}

/**
 * Order replacement payload.
 */
export interface ReplaceOrderPayload {
  /** Order ID to replace */
  orderId: string;
  /** New price */
  price?: string;
  /** New quantity */
  quantity?: number;
  /** New time in force */
  timeInForce?: 'DAY' | 'GTC' | 'EXT' | 'IOC' | 'FOK';
}

/**
 * Dry run result for order validation.
 */
export interface DryRunResult {
  /** Whether the order is valid */
  valid: boolean;
  /** Estimated net price */
  estimatedPrice?: number;
  /** Validation errors */
  errors?: string[];
  /** Warnings */
  warnings?: string[];
}

