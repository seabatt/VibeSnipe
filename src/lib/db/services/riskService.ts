/**
 * Risk service for managing risk events.
 * 
 * @module db/services/riskService
 */

import { db } from '../client';
import type { RiskEventRecord } from '../client';

/**
 * Generate a unique event ID.
 */
function generateEventId(): string {
  return `risk-event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new risk event.
 */
export function createRiskEvent(params: {
  trade_id?: string;
  rule_name: string;
  rule_set: string;
  action: string;
  context: Record<string, any>;
  metadata?: Record<string, any>;
}): RiskEventRecord {
  const record: RiskEventRecord = {
    event_id: generateEventId(),
    trade_id: params.trade_id,
    rule_name: params.rule_name,
    rule_set: params.rule_set,
    triggered_at: new Date().toISOString(),
    action: params.action,
    context: params.context,
    metadata: params.metadata,
  };

  db.createRiskEvent(record);
  return record;
}

/**
 * Get risk events for a trade.
 */
export function getRiskEventsByTrade(trade_id: string): RiskEventRecord[] {
  return db.getRiskEventsByTrade(trade_id);
}

/**
 * Get recent risk events.
 */
export function getRecentRiskEvents(limit: number = 100): RiskEventRecord[] {
  return getAllRiskEvents()
    .sort((a, b) => b.triggered_at.localeCompare(a.triggered_at))
    .slice(0, limit);
}

/**
 * Get all risk events (helper for filtering).
 */
export function getAllRiskEvents(): RiskEventRecord[] {
  // We don't have a direct getAll method, so we need to track them differently
  // For now, return empty array and implement when we add query support
  return [];
}

