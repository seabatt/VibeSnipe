/**
 * Signal service for managing trade signals.
 * 
 * @module db/services/signalService
 */

import { db } from '../client';
import type { SignalRecord } from '../client';

/**
 * Generate a unique signal ID.
 */
function generateSignalId(): string {
  return `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new signal.
 */
export function createSignal(params: {
  source: 'discord' | 'manual' | 'scheduled';
  underlying: string;
  strategy_type: string;
  direction: 'CALL' | 'PUT';
  raw_payload: Record<string, any>;
  metadata?: Record<string, any>;
}): SignalRecord {
  const record: SignalRecord = {
    signal_id: generateSignalId(),
    source: params.source,
    timestamp: new Date().toISOString(),
    underlying: params.underlying,
    strategy_type: params.strategy_type,
    direction: params.direction,
    raw_payload: params.raw_payload,
    metadata: params.metadata,
  };

  db.createSignal(record);
  return record;
}

/**
 * Get a signal by ID.
 */
export function getSignal(signal_id: string): SignalRecord | undefined {
  return db.getSignal(signal_id);
}

/**
 * Get all signals.
 */
export function getAllSignals(): SignalRecord[] {
  return db.getAllSignals();
}

/**
 * Get recent signals.
 */
export function getRecentSignals(limit: number = 100): SignalRecord[] {
  return getAllSignals()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

