/**
 * Decision service for managing trading decisions.
 * 
 * @module db/services/decisionService
 */

import { db } from '../client';
import type { DecisionRecord } from '../client';

/**
 * Generate a unique decision ID.
 */
function generateDecisionId(): string {
  return `decision-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new decision.
 */
export function createDecision(params: {
  signal_id: string;
  should_trade: boolean;
  reason: string;
  trade_spec: Record<string, any> | null;
  strategy_version?: string;
  metadata?: Record<string, any>;
}): DecisionRecord {
  const record: DecisionRecord = {
    decision_id: generateDecisionId(),
    signal_id: params.signal_id,
    should_trade: params.should_trade,
    reason: params.reason,
    trade_spec: params.trade_spec,
    decision_time: new Date().toISOString(),
    strategy_version: params.strategy_version,
    metadata: params.metadata,
  };

  db.createDecision(record);
  return record;
}

/**
 * Get a decision by ID.
 */
export function getDecision(decision_id: string): DecisionRecord | undefined {
  return db.getDecision(decision_id);
}

/**
 * Get decisions for a signal.
 */
export function getDecisionsBySignal(signal_id: string): DecisionRecord[] {
  return db.getDecisionsBySignal(signal_id);
}

/**
 * Get recent decisions.
 */
export function getRecentDecisions(limit: number = 100): DecisionRecord[] {
  return db.getAllDecisions()
    .sort((a, b) => b.decision_time.localeCompare(a.decision_time))
    .slice(0, limit);
}

