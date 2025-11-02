/**
 * Trade service for managing trades.
 * 
 * @module db/services/tradeService
 */

import { db } from '../client';
import type { TradeRecord } from '../client';

/**
 * Generate a unique trade ID.
 */
function generateTradeId(): string {
  return `trade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new trade.
 */
export function createTrade(params: {
  intent_id: string;
  current_state: string;
  metadata?: Record<string, any>;
}): TradeRecord {
  const now = new Date().toISOString();
  const record: TradeRecord = {
    trade_id: generateTradeId(),
    intent_id: params.intent_id,
    current_state: params.current_state,
    created_at: now,
    updated_at: now,
    metadata: params.metadata,
  };

  db.createTrade(record);
  return record;
}

/**
 * Update a trade.
 */
export function updateTrade(trade_id: string, updates: Partial<TradeRecord>): void {
  db.updateTrade(trade_id, updates);
}

/**
 * Get a trade by ID.
 */
export function getTrade(trade_id: string): TradeRecord | undefined {
  return db.getTrade(trade_id);
}

/**
 * Get all trades.
 */
export function getAllTrades(): TradeRecord[] {
  return db.getAllTrades();
}

/**
 * Get active trades (non-terminal states).
 */
export function getActiveTrades(): TradeRecord[] {
  const terminalStates = ['CLOSED', 'CANCELLED', 'REJECTED', 'ERROR'];
  return getAllTrades().filter(t => !terminalStates.includes(t.current_state));
}

/**
 * Get trades by state.
 */
export function getTradesByState(state: string): TradeRecord[] {
  return getAllTrades().filter(t => t.current_state === state);
}

/**
 * Get recent trades.
 */
export function getRecentTrades(limit: number = 100): TradeRecord[] {
  return getAllTrades()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

