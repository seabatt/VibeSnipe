/**
 * Signal ingestion layer.
 * 
 * Normalizes inputs from multiple sources (Discord webhooks, manual UI, scheduled alerts)
 * into standardized Signal objects. All signals are persisted to the database before
 * processing (audit trail).
 * 
 * @module signals/signalIngest
 */

import { createSignal } from '../db/services/signalService';
import type { Signal, DiscordSignalPayload, ManualSignalPayload, ScheduledSignalPayload, SignalValidationResult } from './types';
import { logger } from '../logger';

/**
 * Generate a unique signal ID.
 */
function generateSignalId(): string {
  return `signal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Ingest a Discord signal (8Ball alert).
 */
export function ingestDiscordSignal(payload: DiscordSignalPayload): Signal {
  // Validate payload
  const validation = validateDiscordSignal(payload);
  if (!validation.valid) {
    throw new Error(validation.reason || 'Invalid Discord signal');
  }

  // Normalize to Signal
  const signal: Signal = {
    signal_id: generateSignalId(),
    source: 'discord',
    timestamp: new Date().toISOString(),
    underlying: payload.underlying,
    strategy_type: payload.strategy,
    direction: payload.direction,
    raw_payload: payload as any,
    metadata: {
      strikes: payload.strikes,
      price: payload.price,
      quantity: payload.quantity,
      expiry: payload.expiry,
      accountId: payload.accountId,
      ruleBundle: payload.ruleBundle,
    },
  };

  // Persist to database
  createSignal({
    signal_id: signal.signal_id,
    source: signal.source,
    timestamp: signal.timestamp,
    underlying: signal.underlying,
    strategy_type: signal.strategy_type,
    direction: signal.direction,
    raw_payload: payload as any,
    metadata: signal.metadata,
  });

  logger.info('Discord signal ingested', {
    signal_id: signal.signal_id,
    underlying: signal.underlying,
  });

  return signal;
}

/**
 * Ingest a manual signal (from UI).
 */
export function ingestManualSignal(payload: ManualSignalPayload): Signal {
  // Validate payload
  const validation = validateManualSignal(payload);
  if (!validation.valid) {
    throw new Error(validation.reason || 'Invalid manual signal');
  }

  // Normalize to Signal
  const signal: Signal = {
    signal_id: generateSignalId(),
    source: 'manual',
    timestamp: new Date().toISOString(),
    underlying: payload.underlying,
    strategy_type: payload.strategy,
    direction: payload.direction,
    raw_payload: payload as any,
    metadata: payload.metadata,
  };

  // Persist to database
  createSignal({
    signal_id: signal.signal_id,
    source: signal.source,
    timestamp: signal.timestamp,
    underlying: signal.underlying,
    strategy_type: signal.strategy_type,
    direction: signal.direction,
    raw_payload: payload as any,
    metadata: signal.metadata,
  });

  logger.info('Manual signal ingested', {
    signal_id: signal.signal_id,
    underlying: signal.underlying,
  });

  return signal;
}

/**
 * Ingest a scheduled signal.
 */
export function ingestScheduledSignal(payload: ScheduledSignalPayload): Signal {
  // Validate payload
  const validation = validateScheduledSignal(payload);
  if (!validation.valid) {
    throw new Error(validation.reason || 'Invalid scheduled signal');
  }

  // Normalize to Signal
  const signal: Signal = {
    signal_id: generateSignalId(),
    source: 'scheduled',
    timestamp: new Date().toISOString(),
    underlying: payload.underlying,
    strategy_type: payload.strategy,
    direction: payload.direction,
    raw_payload: payload as any,
    metadata: payload.metadata,
  };

  // Persist to database
  createSignal({
    signal_id: signal.signal_id,
    source: signal.source,
    timestamp: signal.timestamp,
    underlying: signal.underlying,
    strategy_type: signal.strategy_type,
    direction: signal.direction,
    raw_payload: payload as any,
    metadata: signal.metadata,
  });

  logger.info('Scheduled signal ingested', {
    signal_id: signal.signal_id,
    underlying: signal.underlying,
  });

  return signal;
}

/**
 * Validate Discord signal payload.
 */
function validateDiscordSignal(payload: DiscordSignalPayload): SignalValidationResult {
  if (!payload.underlying || typeof payload.underlying !== 'string') {
    return { valid: false, reason: 'Invalid underlying' };
  }

  if (!payload.strategy || typeof payload.strategy !== 'string') {
    return { valid: false, reason: 'Invalid strategy' };
  }

  if (!['CALL', 'PUT'].includes(payload.direction)) {
    return { valid: false, reason: 'Invalid direction' };
  }

  if (!Array.isArray(payload.strikes) || payload.strikes.length < 2) {
    return { valid: false, reason: 'Invalid strikes array' };
  }

  if (typeof payload.price !== 'number' || payload.price <= 0) {
    return { valid: false, reason: 'Invalid price' };
  }

  if (typeof payload.quantity !== 'number' || payload.quantity <= 0) {
    return { valid: false, reason: 'Invalid quantity' };
  }

  return { valid: true };
}

/**
 * Validate manual signal payload.
 */
function validateManualSignal(payload: ManualSignalPayload): SignalValidationResult {
  if (!payload.underlying || typeof payload.underlying !== 'string') {
    return { valid: false, reason: 'Invalid underlying' };
  }

  if (!payload.strategy || typeof payload.strategy !== 'string') {
    return { valid: false, reason: 'Invalid strategy' };
  }

  if (!['CALL', 'PUT'].includes(payload.direction)) {
    return { valid: false, reason: 'Invalid direction' };
  }

  if (!Array.isArray(payload.strikes) || payload.strikes.length < 2) {
    return { valid: false, reason: 'Invalid strikes array' };
  }

  if (typeof payload.price !== 'number' || payload.price <= 0) {
    return { valid: false, reason: 'Invalid price' };
  }

  if (typeof payload.quantity !== 'number' || payload.quantity <= 0) {
    return { valid: false, reason: 'Invalid quantity' };
  }

  if (!payload.expiry || typeof payload.expiry !== 'string') {
    return { valid: false, reason: 'Invalid expiry' };
  }

  if (!payload.accountId || typeof payload.accountId !== 'string') {
    return { valid: false, reason: 'Invalid accountId' };
  }

  return { valid: true };
}

/**
 * Validate scheduled signal payload.
 */
function validateScheduledSignal(payload: ScheduledSignalPayload): SignalValidationResult {
  if (!payload.underlying || typeof payload.underlying !== 'string') {
    return { valid: false, reason: 'Invalid underlying' };
  }

  if (!payload.strategy || typeof payload.strategy !== 'string') {
    return { valid: false, reason: 'Invalid strategy' };
  }

  if (!['CALL', 'PUT'].includes(payload.direction)) {
    return { valid: false, reason: 'Invalid direction' };
  }

  if (!payload.schedule || typeof payload.schedule.entryWindow !== 'string') {
    return { valid: false, reason: 'Invalid schedule' };
  }

  return { valid: true };
}

