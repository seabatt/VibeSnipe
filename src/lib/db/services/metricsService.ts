/**
 * Metrics service for computing performance and execution metrics.
 * 
 * @module db/services/metricsService
 */

import { db } from '../client';
import type { FillRecord, TradeRecord, DecisionRecord } from '../client';

/**
 * Compute latency metrics across the pipeline.
 */
export interface LatencyMetrics {
  /** Signal → Decision latency in ms */
  signal_to_decision: number;
  /** Decision → Submit latency in ms */
  decision_to_submit: number;
  /** Submit → Fill latency in ms */
  submit_to_fill: number;
  /** Total signal → Fill latency in ms */
  total_latency: number;
}

/**
 * Compute latency metrics for a trade.
 */
export function computeLatencyMetrics(
  decision: DecisionRecord,
  fill: FillRecord
): LatencyMetrics {
  const signalTime = new Date(decision.decision_time).getTime();
  const fillTime = new Date(fill.fill_time).getTime();
  
  // For now, we don't have submit_time tracked, so we estimate
  // In production, we'd track this from the execution service
  const estimatedSubmitTime = signalTime + 100; // Assume 100ms between decision and submit
  
  return {
    signal_to_decision: 0, // Would need signal timestamp
    decision_to_submit: estimatedSubmitTime - signalTime,
    submit_to_fill: fillTime - estimatedSubmitTime,
    total_latency: fillTime - signalTime,
  };
}

/**
 * Compute slippage for a fill.
 */
export interface SlippageMetrics {
  /** Actual fill price */
  fill_price: number;
  /** Target/decision price */
  target_price: number;
  /** Slippage in dollars */
  slippage_dollars: number;
  /** Slippage as percentage */
  slippage_percent: number;
}

/**
 * Compute slippage metrics.
 */
export function computeSlippageMetrics(
  fill: FillRecord,
  targetPrice: number
): SlippageMetrics {
  const slippageDollars = fill.fill_price - targetPrice;
  const slippagePercent = targetPrice > 0 ? (slippageDollars / targetPrice) * 100 : 0;

  return {
    fill_price: fill.fill_price,
    target_price: targetPrice,
    slippage_dollars: slippageDollars,
    slippage_percent: slippagePercent,
  };
}

/**
 * Trade execution metrics.
 */
export interface TradeMetrics {
  trade_id: string;
  fill_efficiency: number; // Mid price capture %
  latency_ms: number;
  slippage_dollars: number;
  success: boolean;
}

/**
 * Compute execution metrics for a trade.
 */
export function computeTradeMetrics(
  trade: TradeRecord,
  fills: FillRecord[],
  decision?: DecisionRecord
): TradeMetrics {
  // For now, simplified metrics
  // In production, we'd compute actual fill efficiency from mid prices
  const latestFill = fills.length > 0 ? fills[0] : null;

  return {
    trade_id: trade.trade_id,
    fill_efficiency: latestFill ? 100 : 0, // Placeholder
    latency_ms: latestFill?.latency_ms || 0,
    slippage_dollars: latestFill?.slippage || 0,
    success: latestFill !== null && trade.current_state === 'FILLED',
  };
}

/**
 * Get fill efficiency by strategy version.
 */
export function computeFillEfficiencyByVersion(
  versionTag: string,
  fills: FillRecord[]
): number {
  // Placeholder - would need to filter fills by version and compute actual efficiency
  return fills.length > 0 ? 100 : 0;
}

/**
 * Get win rate by strategy version.
 */
export function computeWinRateByVersion(
  versionTag: string,
  trades: TradeRecord[]
): number {
  const versionTrades = trades.filter(t => 
    t.metadata?.strategy_version === versionTag
  );
  
  if (versionTrades.length === 0) return 0;
  
  const winning = versionTrades.filter(t => t.metadata?.pnl > 0);
  return (winning.length / versionTrades.length) * 100;
}

