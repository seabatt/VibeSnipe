/**
 * Type declarations for Tastytrade API integration barrel exports.
 * This helps TypeScript resolve exports through the barrel file.
 */

// Re-export all types and functions to help TypeScript resolution
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
  ChaseConfig,
  EntryConfigWithChase,
  ChaseAttempt,
  ChaseFillResult,
  ChaseAbortResult,
} from './types';

export type {
  ChaseConfig,
  EntryConfigWithChase,
  ChaseAttempt,
  ChaseFillResult,
  ChaseAbortResult,
} from './chaseEngine';

// Re-export functions
export { getClient, resetClient, getEnv, getAccount } from './client';
export {
  quoteEmitter,
  connect,
  subscribeQuotes,
  unsubscribeQuotes,
  getSubscribedSymbols,
  isQuoteStreamConnected,
} from './marketData';
export {
  fetchOptionChain,
  pickShortByDelta,
  buildVertical,
  buildVerticalFromChain,
  fetchAndBuildVertical,
} from './chains';
export {
  dryRunVertical,
  submitVertical,
  cancelOrder,
  replaceOrder,
  buildOTOCOBrackets,
} from './orders';
export {
  chaseOrder,
  on as onChase,
  off as offChase,
} from './chaseEngine';

