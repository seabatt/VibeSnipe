/**
 * Tastytrade API integration layer.
 * 
 * This module provides a complete integration layer for the Tastytrade API,
 * including OAuth2 authentication, market data streaming, option chain
 * fetching, and order management.
 * 
 * @example
 * ```ts
 * import { getClient, subscribeQuotes, submitVertical } from '@/lib/tastytrade';
 * 
 * // Initialize client
 * const client = await getClient();
 * 
 * // Subscribe to quotes
 * subscribeQuotes(['SPX', 'QQQ']);
 * 
 * // Submit a vertical spread
 * const order = await submitVertical(vertical, 1, 2.50, 'LIMIT', 'account-123');
 * ```
 */

// Client
export { getClient, resetClient, getEnv, getAccount } from './client';

// Market Data
export {
  quoteEmitter,
  connect,
  subscribeQuotes,
  unsubscribeQuotes,
  getSubscribedSymbols,
  isQuoteStreamConnected,
} from './marketData';

// Option Chains
export {
  fetchOptionChain,
  pickShortByDelta,
  buildVertical,
  buildVerticalFromChain,
  fetchAndBuildVertical,
} from './chains';

// Orders
export {
  dryRunVertical,
  submitVertical,
  cancelOrder,
  replaceOrder,
  buildOTOCOBrackets,
} from './orders';

// Chase Engine
export {
  chaseOrder,
  on as onChase,
  off as offChase,
} from './chaseEngine';

// Types
export type {
  TastytradeEnv,
  OptionInstrument,
  GreekQuote,
  VerticalSpec,
  EntryConfig,
  OrderLeg,
  AppOrder,
  OptionChain,
  VerticalLegs,
  OCOBracket,
  ComplexOrderPayload,
  ReplaceOrderPayload,
  DryRunResult,
} from './types';

// Chase Engine Types
export type {
  ChaseConfig,
  EntryConfigWithChase,
  ChaseAttempt,
  ChaseFillResult,
  ChaseAbortResult,
} from './chaseEngine';

